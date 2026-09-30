import 'server-only';
import { pool } from './db';
import { HS_CHAPTERS } from './trade-names';
import { sentenced, titled } from './trade-text';
import { aggregateSql } from './trade-records-sql';
import { grainFor, withoutOwn } from './trade-records-query';
import type { Dimension, Grain, TradeQuery } from './trade-records-query';

/**
 * La base aduanera del INE, leída vista por vista.
 *
 * Cada vista es una suma agrupada por una dimensión (año, capítulo, país…)
 * filtrada por todo lo que el lector eligió **menos lo suyo**: el ránking de
 * países no se recorta por el país elegido, para que el lector vea las
 * alternativas y pueda cambiar de elección. Es la misma regla del filtro
 * cruzado del resto del tablero (`cross-filter.ts`), sólo que aquí se cuenta en
 * la base y no en el navegador, porque son más de un millón de filas.
 *
 * Las respuestas se guardan diez minutos por pedido exacto, con un tope de
 * entradas: el INE publica una vez al mes y el mismo filtro lo piden muchos.
 */

export interface TradeItem {
  key: string | null;
  label: string;
  usd: number;
  kg: number;
  fineKg: number | null;
  lastUsd: number | null;
  priorUsd: number | null;
}

export interface TradeView {
  by: Dimension;
  grain: Grain | null;
  unavailable: string | null;
  items: TradeItem[];
}

export interface TradeCodes {
  /** Por dimensión (`COUNTRY`, `CHAPTER`…): código → nombre y grupo. */
  codes: Record<string, Array<{ code: string; name: string; parent: string | null }>>;
  coverage: Array<{ grain: Grain; first: number; last: number; lastMonth: number }>;
}

export interface ViewSpec {
  name: string;
  by: Dimension;
  limit: number;
}

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 300;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

function remembered<T>(key: string, build: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = build();
  cache.set(key, { at: now, value });
  value.catch(() => cache.delete(key));
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  return value;
}

/** Un modelo que el núcleo aún no creó o no llenó es un capítulo vacío, no un error. */
export function isUnbuilt(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === '42P01' || code === '55000' || code === '42501';
}

export function readTradeCodes(): Promise<TradeCodes> {
  return remembered('codes', async () => {
    try {
      const [codes, coverage] = await Promise.all([
        pool().query<{
          dimension: string;
          code: string;
          name: string | null;
          parent: string | null;
        }>(
          'SELECT dimension, code, name, parent FROM read_models.trade_code ORDER BY dimension, code',
        ),
        pool().query<{ grain: Grain; first: number; last: number; last_month: number }>(
          `WITH span AS (
             SELECT grain, min(year)::int AS first, max(year)::int AS last
               FROM read_models.trade_flow GROUP BY grain
           )
           SELECT span.grain, span.first, span.last,
                  (SELECT max(t.month)::int FROM read_models.trade_flow t
                    WHERE t.grain = span.grain AND t.year = span.last) AS last_month
             FROM span`,
        ),
      ]);
      const grouped: TradeCodes['codes'] = {};
      for (const row of codes.rows) {
        (grouped[row.dimension] ??= []).push({
          code: row.code,
          name: row.name ?? row.code,
          parent: row.parent,
        });
      }
      return {
        codes: grouped,
        coverage: coverage.rows.map((row) => ({
          grain: row.grain,
          first: row.first,
          last: row.last,
          lastMonth: row.last_month || 12,
        })),
      };
    } catch (error) {
      if (!isUnbuilt(error)) throw error;
      console.warn('[observatorio] la base aduanera aún no está construida');
      return { codes: {}, coverage: [] };
    }
  });
}

export async function searchProducts(
  text: string,
): Promise<Array<{ code: string; name: string; chapter: string }>> {
  const clean = text.trim().slice(0, 60);
  if (clean.length < 2) return [];
  const byCode = /^\d{2,10}$/u.test(clean);
  return remembered(`search:${clean.toLowerCase()}`, async () => {
    const { rows } = await pool().query<{ nandina: string; name: string; chapter: string }>(
      byCode
        ? 'SELECT nandina, name, chapter FROM read_models.trade_product WHERE nandina LIKE $1 ORDER BY nandina LIMIT 40'
        : "SELECT nandina, name, chapter FROM read_models.trade_product WHERE name ILIKE '%' || $1 || '%' ORDER BY nandina LIMIT 40",
      [byCode ? `${clean}%` : clean],
    );
    return rows.map((row) => ({
      code: row.nandina,
      name: sentenced(row.name),
      chapter: row.chapter,
    }));
  });
}

/** Los grandes grupos de la CUODE: el primer dígito del código. */
export const USE_GROUPS: Record<string, string> = {
  '0': 'Diversos (incluye oro)',
  '1': 'Bienes de consumo no duradero',
  '2': 'Bienes de consumo duradero',
  '3': 'Combustibles y lubricantes',
  '4': 'Materias primas para la agricultura',
  '5': 'Materias primas para la industria',
  '6': 'Materiales de construcción',
  '7': 'Bienes de capital para la agricultura',
  '8': 'Bienes de capital para la industria',
  '9': 'Equipo de transporte',
  X: 'Efectos personales',
};

const KINDS: Record<string, string> = {
  '1': 'Exportaciones',
  '2': 'Reexportaciones',
  '3': 'Efectos personales',
};

async function productNames(codes: readonly string[]): Promise<Map<string, string>> {
  if (!codes.length) return new Map();
  const { rows } = await pool().query<{ nandina: string; name: string }>(
    'SELECT nandina, name FROM read_models.trade_product WHERE nandina = ANY($1::text[])',
    [codes],
  );
  return new Map(rows.map((row) => [row.nandina, sentenced(row.name)]));
}

function labeler(codes: TradeCodes['codes'], by: Dimension): (key: string) => string {
  const named = (dimension: string, tidy: (text: string) => string) => {
    const names = new Map((codes[dimension] ?? []).map((entry) => [entry.code, tidy(entry.name)]));
    return (key: string) => names.get(key) ?? key;
  };
  switch (by) {
    case 'chapter': {
      const names = named('CHAPTER', sentenced);
      return (key) => {
        const name = names(key);
        return `${key} · ${name !== key ? name : (HS_CHAPTERS[key] ?? `Capítulo ${key}`)}`;
      };
    }
    case 'section':
      return named('SECTION', sentenced);
    case 'country':
      return named('COUNTRY', titled);
    case 'department':
      return named('DEPARTMENT', titled);
    case 'activity':
      return named('ACTIVITY', sentenced);
    case 'traditional':
      return named('TRADITIONAL', sentenced);
    case 'use':
      return named('USE', sentenced);
    case 'useGroup':
      return (key) => USE_GROUPS[key] ?? key;
    case 'kind':
      return (key) => KINDS[key] ?? key;
    case 'zone':
    case 'activityGroup':
    case 'traditionalGroup':
      return titled;
    default:
      return (key) => key;
  }
}

interface Row {
  key: string | null;
  usd: string | null;
  kg: string | null;
  fine_kg: string | null;
  last_usd: string | null;
  prior_usd: string | null;
  sample: string | null;
}

const num = (value: string | null): number | null => (value === null ? null : Number(value));

async function readView(query: TradeQuery, spec: ViewSpec, codes: TradeCodes): Promise<TradeView> {
  const own = withoutOwn(query, spec.by);
  const choice = grainFor(own, spec.by);
  if ('unavailable' in choice) {
    return { by: spec.by, grain: null, unavailable: choice.unavailable, items: [] };
  }
  const sql = aggregateSql(own, spec.by, choice.grain, spec.limit);
  const { rows } = await pool().query<Row>(sql.text, sql.values);
  const label = labeler(codes.codes, spec.by);
  const needsNames = spec.by === 'nandina' || spec.by === 'heading' || spec.by === 'subheading';
  const names = needsNames
    ? await productNames(
        rows.map((row) => (spec.by === 'nandina' ? row.key : row.sample) ?? '').filter(Boolean),
      )
    : new Map<string, string>();
  const items = rows.map((row) => {
    let text = row.key === null ? 'Sin clasificar' : label(row.key);
    if (spec.by === 'nandina' && row.key) text = `${row.key} · ${names.get(row.key) ?? ''}`;
    if ((spec.by === 'heading' || spec.by === 'subheading') && row.key) {
      text = `${row.key} · ${names.get(row.sample ?? '') ?? ''}`;
    }
    return {
      key: row.key,
      label: text,
      usd: num(row.usd) ?? 0,
      kg: num(row.kg) ?? 0,
      fineKg: num(row.fine_kg),
      lastUsd: num(row.last_usd),
      priorUsd: num(row.prior_usd),
    };
  });
  return { by: spec.by, grain: choice.grain, unavailable: null, items };
}

/**
 * Las vistas pedidas, una tras otra y no en paralelo: el tablero de pablo-h310
 * corre con cuatro conexiones, y cuatro sumas a la vez lo dejarían sin ninguna
 * para el resto del informe.
 */
export function readTradeViews(
  query: TradeQuery,
  specs: readonly ViewSpec[],
): Promise<Record<string, TradeView>> {
  return remembered(`views:${JSON.stringify({ query, specs })}`, async () => {
    const codes = await readTradeCodes();
    const out: Record<string, TradeView> = {};
    for (const spec of specs) {
      try {
        out[spec.name] = await readView(query, spec, codes);
      } catch (error) {
        if (!isUnbuilt(error)) throw error;
        out[spec.name] = {
          by: spec.by,
          grain: null,
          unavailable: 'La base aduanera todavía se está cargando en este servidor.',
          items: [],
        };
      }
    }
    return out;
  });
}

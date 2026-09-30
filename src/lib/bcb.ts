import 'server-only';
import { pool } from './db';
import { held } from './hold';
import { PAGE, familyLabel } from './bcb-board';
import type { BcbCatalogPage, BcbFamily, BcbSeriesData, BcbSeriesInfo } from './bcb-board';

/**
 * Las estadísticas del Banco Central, leídas de `read_models.bcb_statistic_catalog`
 * (una fila chica por serie) y `read_models.bcb_statistic_data` (los puntos, que solo se
 * desempaquetan de la serie pedida).
 *
 * Las búsquedas van a la base con parámetros y no se sostienen en memoria —la
 * combinación de filtros es casi infinita—; lo único que se guarda es la lista de
 * familias, que es una consulta sobre doce mil filas y no cambia entre lecturas.
 */

interface CatalogRow {
  indicator_code: string;
  name: string;
  family: string;
  workbook: string;
  sheet: string;
  unit: string | null;
  frequency: string;
  first_period: string;
  last_period: string;
  point_count: number;
}

const toInfo = (row: CatalogRow): BcbSeriesInfo => ({
  code: row.indicator_code,
  name: row.name,
  family: row.family,
  workbook: row.workbook,
  sheet: row.sheet,
  unit: row.unit,
  frequency: row.frequency,
  firstPeriod: row.first_period,
  lastPeriod: row.last_period,
  pointCount: row.point_count,
});

const SELECT = `SELECT indicator_code, name, family, workbook, sheet, unit, frequency,
  to_char(first_period, 'YYYY-MM-DD') AS first_period,
  to_char(last_period, 'YYYY-MM-DD') AS last_period, point_count`;

const MISSING_MODEL = new Set(['42P01', '42501', '42703']);

function emptyOrThrow<T>(error: unknown, empty: T): T {
  const code = (error as { code?: string }).code;
  if (code && MISSING_MODEL.has(code)) {
    console.warn(`[observatorio] modelo ilegible: read_models.bcb_statistic_* (${code})`);
    return empty;
  }
  throw error;
}

export function readBcbFamilies(): Promise<BcbFamily[]> {
  return held('bcb-families', async () => {
    try {
      const { rows } = await pool().query<{ family: string; series: string }>(
        `SELECT family, count(*)::text AS series
         FROM read_models.bcb_statistic_catalog GROUP BY family ORDER BY count(*) DESC`,
      );
      return rows.map((row) => ({
        family: row.family,
        label: familyLabel(row.family),
        series: Number(row.series),
      }));
    } catch (error) {
      return emptyOrThrow(error, []);
    }
  });
}

/** `%` y `_` del texto buscado son texto, no comodines. */
const literal = (text: string): string => text.replace(/[\\%_]/gu, (char) => `\\${char}`);

export async function searchBcb(params: {
  family: string;
  frequency: string;
  text: string;
  offset: number;
}): Promise<BcbCatalogPage> {
  const families = await readBcbFamilies();
  const words = params.text.trim().split(/\s+/u).filter(Boolean).slice(0, 5);
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (params.family) {
    values.push(params.family);
    conditions.push(`family = $${values.length}`);
  }
  if (params.frequency) {
    values.push(params.frequency);
    conditions.push(`frequency = $${values.length}`);
  }
  // Cada palabra tiene que aparecer en el nombre, la hoja o el informe: «reservas oro»
  // encuentra lo que dice las dos, en cualquier orden.
  for (const word of words) {
    values.push(`%${literal(word)}%`);
    const at = values.length;
    conditions.push(`(name ILIKE $${at} OR sheet ILIKE $${at} OR workbook ILIKE $${at})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const counted = await pool().query<{ total: string }>(
      `SELECT count(*)::text AS total FROM read_models.bcb_statistic_catalog ${where}`,
      values,
    );
    const { rows } = await pool().query<CatalogRow>(
      `${SELECT} FROM read_models.bcb_statistic_catalog ${where}
       ORDER BY family, workbook, sheet, name
       LIMIT ${PAGE} OFFSET ${Math.max(0, Math.floor(params.offset))}`,
      values,
    );
    return { families, results: rows.map(toInfo), total: Number(counted.rows[0]?.total ?? 0) };
  } catch (error) {
    return emptyOrThrow(error, { families, results: [], total: 0 });
  }
}

export async function readBcbSeries(codes: readonly string[]): Promise<BcbSeriesData[]> {
  const wanted = [...new Set(codes)].slice(0, 8);
  if (!wanted.length) return [];
  try {
    const { rows } = await pool().query<
      CatalogRow & {
        locator: Record<string, string | number> | null;
        source_url: string | null;
        evidence_sha256: string | null;
        points: Array<[string, string]>;
      }
    >(
      `SELECT c.indicator_code, c.name, c.family, c.workbook, c.sheet, c.unit, c.frequency,
              to_char(c.first_period, 'YYYY-MM-DD') AS first_period,
              to_char(c.last_period, 'YYYY-MM-DD') AS last_period, c.point_count,
              c.locator, d.source_url, d.evidence_sha256, d.points
       FROM read_models.bcb_statistic_catalog c
       JOIN read_models.bcb_statistic_data d USING (indicator_code)
       WHERE c.indicator_code = ANY($1::text[])`,
      [wanted],
    );
    return rows.map((row) => ({
      ...toInfo(row),
      locator: row.locator,
      sourceUrl: row.source_url,
      evidenceSha256: row.evidence_sha256,
      points: row.points.map(([date, value]): [string, number] => [date, Number(value)]),
    }));
  } catch (error) {
    return emptyOrThrow(error, []);
  }
}

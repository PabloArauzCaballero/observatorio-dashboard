import type { Dimension, Grain, TradeQuery } from './trade-records-query';

/**
 * El SQL de una vista de la base aduanera: una suma agrupada por una dimensión.
 *
 * Cada vista pide lo mismo —valor, peso, peso fino— sobre el periodo elegido,
 * más dos columnas para la variación: el último año del periodo y el anterior.
 * Por eso el `WHERE` de un ránking arranca un año antes del periodo cuando el
 * periodo es de un solo año: la cifra del año previo tiene que estar en la
 * misma pasada, y la suma principal lo excluye con su propio `FILTER`.
 *
 * Los catálogos (`trade_product`, `trade_code`) se unen sólo cuando la pregunta
 * los usa; la tabla de flujos sola es la consulta barata.
 */

export interface BuiltSql {
  readonly text: string;
  readonly values: unknown[];
}

type Join = 'product' | 'chapter' | 'country' | 'activity' | 'traditional';

const JOINS: Record<Join, string> = {
  product: 'LEFT JOIN read_models.trade_product p ON p.nandina = f.nandina',
  chapter:
    "LEFT JOIN read_models.trade_code ch ON ch.dimension = 'CHAPTER' AND ch.code = f.chapter",
  country:
    "LEFT JOIN read_models.trade_code cz ON cz.dimension = 'COUNTRY' AND cz.code = f.country",
  activity:
    "LEFT JOIN read_models.trade_code ca ON ca.dimension = 'ACTIVITY' AND ca.code = p.activity",
  traditional:
    "LEFT JOIN read_models.trade_code ct ON ct.dimension = 'TRADITIONAL' AND ct.code = p.traditional",
};

/** La expresión que agrupa, y los catálogos que necesita. */
function keyOf(by: Dimension, grain: Grain): { expression: string; joins: Join[] } {
  switch (by) {
    case 'year':
      return { expression: 'f.year::text', joins: [] };
    case 'month':
      return { expression: "f.year::text || '-' || lpad(f.month::text, 2, '0')", joins: [] };
    case 'section':
      return { expression: 'ch.parent', joins: ['chapter'] };
    case 'chapter':
      return { expression: 'f.chapter', joins: [] };
    case 'heading':
      return { expression: 'left(f.nandina, 4)', joins: [] };
    case 'subheading':
      return { expression: 'left(f.nandina, 6)', joins: [] };
    case 'nandina':
      return { expression: 'f.nandina', joins: [] };
    case 'country':
      return { expression: 'f.country', joins: [] };
    case 'zone':
      return { expression: 'cz.parent', joins: ['country'] };
    case 'department':
      return { expression: 'f.department', joins: [] };
    case 'activity':
      return { expression: 'p.activity', joins: ['product'] };
    case 'activityGroup':
      return { expression: 'ca.parent', joins: ['product', 'activity'] };
    case 'traditional':
      return { expression: 'p.traditional', joins: ['product'] };
    case 'traditionalGroup':
      return { expression: 'ct.parent', joins: ['product', 'traditional'] };
    case 'use':
      return grain === 'M_MONTHLY'
        ? { expression: 'f.use_code', joins: [] }
        : { expression: 'p.use_code', joins: ['product'] };
    case 'useGroup':
      return grain === 'M_MONTHLY'
        ? { expression: 'left(f.use_code, 1)', joins: [] }
        : { expression: 'left(p.use_code, 1)', joins: ['product'] };
    case 'kind':
      return { expression: 'f.kind::text', joins: [] };
  }
}

const TIME: readonly Dimension[] = ['year', 'month'];

export function aggregateSql(
  query: TradeQuery,
  by: Dimension,
  grain: Grain,
  limit: number,
): BuiltSql {
  const values: unknown[] = [grain];
  const bind = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };
  const key = keyOf(by, grain);
  const joins = new Set<Join>(key.joins);
  const where = ['f.grain = $1'];
  const ranked = !TIME.includes(by);
  const lowest = ranked ? Math.min(query.from, query.to - 1) : query.from;
  where.push(`f.year BETWEEN ${bind(lowest)} AND ${bind(query.to)}`);
  if (query.months && grain !== 'M_DETAIL') {
    where.push(`f.month BETWEEN ${bind(query.months[0])} AND ${bind(query.months[1])}`);
  }

  const { filters } = query;
  const chapters = filters.product.filter((code) => code.length === 2);
  const prefixes = filters.product.filter((code) => code.length > 2).map((code) => `${code}%`);
  if (chapters.length || prefixes.length) {
    const parts: string[] = [];
    if (chapters.length) parts.push(`f.chapter = ANY(${bind(chapters)}::text[])`);
    if (prefixes.length) parts.push(`f.nandina LIKE ANY(${bind(prefixes)}::text[])`);
    where.push(`(${parts.join(' OR ')})`);
  }
  if (filters.section.length) {
    joins.add('chapter');
    where.push(`ch.parent = ANY(${bind(filters.section)}::text[])`);
  }
  if (filters.country.length && grain !== 'M_MONTHLY') {
    where.push(`f.country = ANY(${bind(filters.country)}::text[])`);
  }
  if (filters.department.length && grain !== 'M_DETAIL') {
    where.push(`f.department = ANY(${bind(filters.department)}::text[])`);
  }
  if (grain === 'X_DETAIL') {
    if (filters.activity.length) {
      joins.add('product');
      where.push(`p.activity = ANY(${bind(filters.activity)}::text[])`);
    }
    if (filters.traditional.length) {
      joins.add('product');
      where.push(`p.traditional = ANY(${bind(filters.traditional)}::text[])`);
    }
    if (filters.kind.length) {
      where.push(`f.kind = ANY(${bind(filters.kind.map(Number))}::smallint[])`);
    }
  } else if (filters.use.length) {
    if (grain === 'M_MONTHLY') where.push(`f.use_code = ANY(${bind(filters.use)}::text[])`);
    else {
      joins.add('product');
      where.push(`p.use_code = ANY(${bind(filters.use)}::text[])`);
    }
  }

  const from = bind(query.from);
  const last = bind(query.to);
  const inRange = `FILTER (WHERE f.year >= ${from})`;
  // La partida más grande del grupo pone el nombre a una partida de 4 o 6 dígitos.
  const sample =
    by === 'heading' || by === 'subheading'
      ? `, (array_agg(f.nandina ORDER BY f.usd DESC NULLS LAST))[1] AS sample`
      : ', NULL::text AS sample';
  const ordered: Join[] = ['product', 'chapter', 'country', 'activity', 'traditional'];
  const text = `
SELECT ${key.expression} AS key,
       sum(f.usd) ${inRange} AS usd,
       sum(f.kg) ${inRange} AS kg,
       sum(f.fine_kg) ${inRange} AS fine_kg,
       sum(f.usd) FILTER (WHERE f.year = ${last}) AS last_usd,
       sum(f.usd) FILTER (WHERE f.year = ${last} - 1) AS prior_usd${sample}
FROM read_models.trade_flow f
${ordered
  .filter((join) => joins.has(join))
  .map((join) => JOINS[join])
  .join('\n')}
WHERE ${where.join('\n  AND ')}
GROUP BY 1
${ranked ? `HAVING sum(f.usd) ${inRange} > 0 ORDER BY usd DESC NULLS LAST LIMIT ${bind(limit)}` : 'ORDER BY 1'}`;
  return { text, values };
}

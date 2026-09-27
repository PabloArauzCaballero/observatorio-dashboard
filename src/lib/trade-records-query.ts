/**
 * Qué se le puede preguntar a la base aduanera del INE, y cómo se traduce a SQL.
 *
 * Puro a propósito —sin base ni `server-only`— para que las reglas se prueben
 * sin servidor: qué parámetros se aceptan, qué grano de la tabla contesta cada
 * pregunta y qué combinaciones no tienen respuesta.
 *
 * **Los tres granos** (`read_models.trade_flow`, migración 0087 del núcleo):
 * - `X_DETAIL`: exportaciones por partida NANDINA, país, departamento, mes y
 *   tipo de flujo. Cualquier cruce vale.
 * - `M_DETAIL`: importaciones por partida y país, **por año**.
 * - `M_MONTHLY`: importaciones por uso económico (CUODE), capítulo,
 *   departamento y **mes**, sin país.
 *
 * Las importaciones no se publican aquí con país y departamento a la vez, ni
 * con país y mes: el INE sí las tiene, pero a ese detalle son ciento ochenta
 * mil filas por año y la carga las resume en dos cubos. Una vista que pide las
 * dos cosas no se inventa: devuelve por qué no hay respuesta.
 *
 * Toda entrada del lector pasa por una lista blanca o una expresión regular y
 * viaja como parámetro (`$n`); lo único que se escribe en el texto del SQL son
 * fragmentos de este archivo.
 */

export type Flow = 'X' | 'M';
export type Grain = 'X_DETAIL' | 'M_DETAIL' | 'M_MONTHLY';

export const DIMENSIONS = [
  'year',
  'month',
  'section',
  'chapter',
  'heading',
  'subheading',
  'nandina',
  'country',
  'zone',
  'department',
  'activity',
  'activityGroup',
  'traditional',
  'traditionalGroup',
  'use',
  'useGroup',
  'kind',
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** Los filtros que el lector puede poner; cada uno es una lista (disyunción). */
export interface TradeFilters {
  product: string[];
  section: string[];
  country: string[];
  department: string[];
  activity: string[];
  traditional: string[];
  use: string[];
  kind: string[];
}

export interface TradeQuery {
  flow: Flow;
  from: number;
  to: number;
  /** Meses 1-12 incluidos; `null` es el año entero. Sirve para comparar enero-julio con enero-julio. */
  months: [number, number] | null;
  filters: TradeFilters;
}

export type FilterKey = keyof TradeFilters;

/** Qué filtro «es» cada dimensión, para excluirlo de su propio gráfico. */
export const OWN_FILTER: Partial<Record<Dimension, FilterKey[]>> = {
  country: ['country'],
  zone: ['country'],
  department: ['department'],
  activity: ['activity'],
  activityGroup: ['activity'],
  traditional: ['traditional'],
  traditionalGroup: ['traditional'],
  use: ['use'],
  useGroup: ['use'],
  kind: ['kind'],
};

const PATTERNS: Record<FilterKey, RegExp> = {
  product: /^\d{2,10}$/u,
  section: /^\d{1,2}$/u,
  country: /^\d{1,4}$/u,
  department: /^\d{1,2}$/u,
  activity: /^[A-Z0-9]{1,6}$/u,
  traditional: /^\d{1,3}$/u,
  use: /^[0-9X]{1,4}$/u,
  kind: /^[1-3]$/u,
};

const MAX_VALUES = 40;

const listOf = (raw: string | null, pattern: RegExp): string[] =>
  [...new Set((raw ?? '').split(',').map((value) => value.trim()))]
    .filter((value) => pattern.test(value))
    .slice(0, MAX_VALUES);

export function parseQuery(params: URLSearchParams): TradeQuery {
  const flow: Flow = params.get('flow') === 'M' ? 'M' : 'X';
  const year = (name: string, fallback: number): number => {
    const value = Number(params.get(name));
    return Number.isInteger(value) && value >= 1990 && value <= 2100 ? value : fallback;
  };
  const to = year('to', 2100);
  const from = Math.min(year('from', 1990), to);
  const monthMatch = /^(\d{1,2})-(\d{1,2})$/u.exec(params.get('months') ?? '');
  const first = Number(monthMatch?.[1]);
  const last = Number(monthMatch?.[2]);
  const months: [number, number] | null =
    monthMatch && first >= 1 && last <= 12 && first <= last && !(first === 1 && last === 12)
      ? [first, last]
      : null;
  const filters = Object.fromEntries(
    (Object.keys(PATTERNS) as FilterKey[]).map((key) => [
      key,
      listOf(params.get(key), PATTERNS[key]),
    ]),
  ) as unknown as TradeFilters;
  return { flow, from, to, months, filters };
}

/** Lo que la pregunta necesita de la tabla, para elegir grano en importaciones. */
function needs(query: TradeQuery, by: Dimension): { monthly: boolean; detail: boolean } {
  const { filters } = query;
  const monthly =
    query.months !== null || filters.department.length > 0 || by === 'month' || by === 'department';
  const detail =
    filters.country.length > 0 ||
    filters.product.some((code) => code.length > 2) ||
    ['country', 'zone', 'heading', 'subheading', 'nandina'].includes(by);
  return { monthly, detail };
}

/** Las dimensiones que sólo tienen sentido en exportaciones. */
const EXPORT_ONLY: readonly Dimension[] = [
  'activity',
  'activityGroup',
  'traditional',
  'traditionalGroup',
  'kind',
];

export type GrainChoice = { grain: Grain } | { unavailable: string };

export function grainFor(query: TradeQuery, by: Dimension): GrainChoice {
  if (query.flow === 'X') {
    return by === 'use' || by === 'useGroup'
      ? { unavailable: 'El uso económico (CUODE) es una clasificación de las importaciones.' }
      : { grain: 'X_DETAIL' };
  }
  if (EXPORT_ONLY.includes(by)) {
    return {
      unavailable:
        'Esa clasificación es de las exportaciones; las importaciones se clasifican por uso económico.',
    };
  }
  const need = needs(query, by);
  if (need.monthly && need.detail) {
    return {
      unavailable:
        'Las importaciones por país o por partida se publican aquí por año y sin departamento: ' +
        'quita el filtro de departamento o de meses —o el de país o partida— para ver esta vista.',
    };
  }
  return { grain: need.monthly ? 'M_MONTHLY' : 'M_DETAIL' };
}

/** Cuántos dígitos de la NANDINA tiene cada nivel del árbol de producto. */
export const PRODUCT_LEVEL: Partial<Record<Dimension, number>> = {
  section: 0,
  chapter: 2,
  heading: 4,
  subheading: 6,
  nandina: 10,
};

/**
 * El mismo pedido, sin el filtro que la vista dibuja.
 *
 * Con una excepción que es la que hace funcionar el desglose: en el árbol de
 * producto, la vista conserva los filtros de los niveles de arriba. Elegido
 * el capítulo 26, la vista por partida muestra las partidas del 26 —eso es
 * bajar un nivel—; lo que suelta es la elección en su propio nivel y debajo,
 * para que el lector siga viendo las alternativas.
 */
export function withoutOwn(query: TradeQuery, by: Dimension): TradeQuery {
  const filters = { ...query.filters };
  const depth = PRODUCT_LEVEL[by];
  if (depth !== undefined) {
    filters.product = filters.product.filter((code) => code.length < depth);
    if (by === 'section') filters.section = [];
    return { ...query, filters };
  }
  for (const key of OWN_FILTER[by] ?? []) filters[key] = [];
  return { ...query, filters };
}

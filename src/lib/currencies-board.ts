/**
 * El boliviano frente a las monedas que publica el Banco Central.
 *
 * Tipos, catálogo y cuentas sin nada de servidor, para que el explorador las
 * rehaga en el navegador cada vez que se mueve un filtro.
 *
 * Cada serie es lo que vale **una unidad** de la moneda en bolivianos, tal como
 * la tabla del BCB la escribe. Para leerla se presenta por un múltiplo —el yen
 * por 100, el won por 1.000, el guaraní por 10.000—: «1 yen = 0,076 Bs» no se
 * lee, «100 yenes = 7,63 Bs» sí. El múltiplo es de presentación y viaja con la
 * moneda; el dato guardado no se toca.
 */

export type Region = 'NEIGHBOURS' | 'ASIA' | 'WORLD';

export type CurrencyPoint = [date: string, bobPerUnit: number];

export interface CurrencySeries {
  iso: string;
  label: string;
  country: string;
  note: string;
  sourceUrl: string | null;
  /** Dónde esta serie toma otra moneda prestada, dicho para quien la lea. */
  spliced?: string;
  points: CurrencyPoint[];
}

export interface CurrencyBoard {
  series: CurrencySeries[];
  latestDate: string | null;
}

interface Entry {
  region: Region;
  /** Las que el comercio de Bolivia pide ver primero. */
  focus: boolean;
  /** Cuántas unidades se muestran juntas: 100 yenes, 1.000 wones. */
  scale: number;
}

export const CATALOG: Readonly<Record<string, Entry>> = {
  CNY: { region: 'ASIA', focus: true, scale: 1 },
  JPY: { region: 'ASIA', focus: true, scale: 100 },
  EUR: { region: 'WORLD', focus: true, scale: 1 },
  BRL: { region: 'NEIGHBOURS', focus: true, scale: 1 },
  ARS: { region: 'NEIGHBOURS', focus: true, scale: 1_000 },
  CLP: { region: 'NEIGHBOURS', focus: false, scale: 1_000 },
  PEN: { region: 'NEIGHBOURS', focus: false, scale: 1 },
  PYG: { region: 'NEIGHBOURS', focus: false, scale: 10_000 },
  UYU: { region: 'NEIGHBOURS', focus: false, scale: 10 },
  COP: { region: 'NEIGHBOURS', focus: false, scale: 1_000 },
  MXN: { region: 'NEIGHBOURS', focus: false, scale: 10 },
  CNH: { region: 'ASIA', focus: false, scale: 1 },
  KRW: { region: 'ASIA', focus: false, scale: 1_000 },
  INR: { region: 'ASIA', focus: false, scale: 10 },
  HKD: { region: 'ASIA', focus: false, scale: 1 },
  AED: { region: 'ASIA', focus: false, scale: 1 },
  GBP: { region: 'WORLD', focus: false, scale: 1 },
  CHF: { region: 'WORLD', focus: false, scale: 1 },
  CAD: { region: 'WORLD', focus: false, scale: 1 },
  AUD: { region: 'WORLD', focus: false, scale: 1 },
  NOK: { region: 'WORLD', focus: false, scale: 10 },
  SEK: { region: 'WORLD', focus: false, scale: 10 },
};

/** El dólar oficial viaja en el mismo tablero, como referencia y no como una más. */
export const DOLLAR = 'USD';

export const REGIONS: ReadonlyArray<{ key: Region; label: string; hint: string }> = [
  { key: 'ASIA', label: 'Asia', hint: 'China, Japón, Corea del Sur, India, Hong Kong y Emiratos.' },
  { key: 'NEIGHBOURS', label: 'Región', hint: 'Los vecinos de Bolivia, Colombia y México.' },
  { key: 'WORLD', label: 'Mundo', hint: 'Euro, libra, franco, y los dólares canadiense y australiano.' },
];

export const entryOf = (iso: string): Entry | undefined => CATALOG[iso];

export const scaleOf = (iso: string): number => CATALOG[iso]?.scale ?? 1;

/** «por 100 yenes» o «por unidad»: lo que el lector necesita para no leer mal la cifra. */
export const sayScale = (iso: string): string => {
  const scale = scaleOf(iso);
  return scale === 1 ? 'por unidad' : `por ${new Intl.NumberFormat('es-BO').format(scale)}`;
};

export type Measure = 'LEVEL' | 'INDEX' | 'YOY';

const MS_PER_DAY = 86_400_000;
const dayOf = (date: string): number => Date.parse(`${date}T00:00:00Z`);

/**
 * El punto de hace `days` días, o el más cercano si ese día no hay cotización.
 *
 * La historia vieja es semanal y no tiene siempre el mismo día de la semana:
 * se acepta el más próximo hasta una semana de distancia y nada más allá, que
 * es el límite entre una comparación y una invención.
 */
export function pointNear(
  points: readonly CurrencyPoint[],
  date: string,
  days: number,
): CurrencyPoint | null {
  const wanted = dayOf(date) - days * MS_PER_DAY;
  let best: CurrencyPoint | null = null;
  let gap = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const distance = Math.abs(dayOf(point[0]) - wanted);
    if (distance < gap) {
      gap = distance;
      best = point;
    }
    if (dayOf(point[0]) > wanted + 8 * MS_PER_DAY) break;
  }
  return best && gap <= 7 * MS_PER_DAY ? best : null;
}

/**
 * La serie como el lector la pidió, recortada a sus años.
 *
 * El índice toma como base el primer punto visible y no uno fijo: quien mueve
 * el «desde» a 2024 quiere ver cuánto subió cada moneda desde 2024.
 */
export function measured(
  points: readonly CurrencyPoint[],
  iso: string,
  measure: Measure,
  from: number,
  to: number,
): CurrencyPoint[] {
  const inRange = points.filter(([date]) => {
    const year = Number(date.slice(0, 4));
    return year >= from && year <= to;
  });
  if (measure === 'LEVEL') {
    const scale = scaleOf(iso);
    return inRange.map(([date, value]) => [date, value * scale]);
  }
  if (measure === 'INDEX') {
    const base = inRange.find(([, value]) => value !== 0)?.[1];
    if (base === undefined) return [];
    return inRange.map(([date, value]) => [date, (value / base) * 100]);
  }
  return inRange.flatMap(([date, value]): CurrencyPoint[] => {
    const before = pointNear(points, date, 365);
    return before && before[1] !== 0 ? [[date, (value / before[1] - 1) * 100]] : [];
  });
}

export interface Summary {
  last: CurrencyPoint | null;
  /** Contra la cotización anterior guardada. */
  day: number | null;
  month: number | null;
  year: number | null;
}

const ratio = (now: number, before: CurrencyPoint | null): number | null =>
  before === null || before[1] === 0 ? null : (now / before[1] - 1) * 100;

export function summarize(series: CurrencySeries): Summary {
  const last = series.points.at(-1) ?? null;
  if (!last) return { last, day: null, month: null, year: null };
  return {
    last,
    day: ratio(last[1], series.points.at(-2) ?? null),
    month: ratio(last[1], pointNear(series.points, last[0], 30)),
    year: ratio(last[1], pointNear(series.points, last[0], 365)),
  };
}

/** Unidades de la moneda por un dólar: el dólar oficial dividido por lo que vale la moneda. */
export function perDollar(series: CurrencySeries, dollar: CurrencySeries | undefined): number | null {
  const last = series.points.at(-1);
  const usd = dollar?.points.find(([date]) => date === last?.[0])?.[1];
  return last && usd && last[1] ? usd / last[1] : null;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function sayDate(date: string): string {
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1] ?? ''} ${date.slice(0, 4)}`;
}

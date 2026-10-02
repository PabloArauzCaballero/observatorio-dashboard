import { closed, ofGdp, yearly } from './public-accounts-board';
import type { Index, YearValue } from './public-accounts-board';

/**
 * Las filas que los gráficos de cuentas públicas piden, armadas a partir de las series.
 *
 * Dos formas: **líneas** (un punto por año y serie, solo años cerrados, para comparar
 * niveles) y **apilados** (las partes de un total por año, con el año en curso a la vista y
 * marcado). Las dos aceptan la unidad —millones de bolivianos o parte del PIB— y el año
 * desde el que se dibuja, que es lo que el lector mueve.
 */

export type Measure = 'bs' | 'pib';

export interface Part {
  key: string;
  label: string;
  tone: string;
  /** Las series cuya suma es esta parte (el IVA es la del mercado interno más la de importaciones). */
  codes: readonly string[];
}

export interface LineRow {
  year: string;
  [key: string]: string | number | null;
}

export interface BarRow {
  label: string;
  [key: string]: string | number | null;
}

/** Valor de una parte en un año: la suma de sus series, o `undefined` si ninguna lo tiene. */
function partValue(
  index: Index,
  codes: readonly string[],
  year: number,
  stock: boolean,
): { value: number; months: number } | undefined {
  let total: number | undefined;
  let months = 12;
  for (const code of codes) {
    const entry = yearly(index.get(code), stock).find((candidate) => candidate.year === year);
    if (!entry) continue;
    total = (total ?? 0) + entry.value;
    months = Math.min(months, entry.months);
  }
  return total === undefined ? undefined : { value: total, months };
}

const inUnit = (index: Index, year: number, value: number, measure: Measure): number | null =>
  measure === 'bs' ? value : ofGdp(index, year, value);

/** Todos los años en que alguna de las series tiene un dato. */
function yearsOf(index: Index, codes: readonly string[], stock: boolean): number[] {
  const years = new Set<number>();
  for (const code of codes) for (const entry of yearly(index.get(code), stock)) years.add(entry.year);
  return [...years].sort((left, right) => left - right);
}

/** Líneas por año: un punto por serie, solo años cerrados, desde `from`. */
export function lineRows(
  index: Index,
  parts: readonly Part[],
  measure: Measure,
  from: number,
): LineRow[] {
  const all = parts.flatMap((part) => part.codes);
  return yearsOf(index, all, false)
    .filter((year) => year >= from)
    .map((year) => {
      const row: LineRow = { year: String(year) };
      for (const part of parts) {
        const found = partValue(index, part.codes, year, false);
        row[part.key] = found && found.months === 12 ? inUnit(index, year, found.value, measure) : null;
      }
      return row;
    })
    .filter((row) => parts.some((part) => typeof row[part.key] === 'number'));
}

/**
 * Las partes de un total por año.
 *
 * `total` es la serie del todo: lo que no suman las partes queda en una última parte
 * `rest` («Otros») para que el apilado cierre con el total publicado en vez de con la suma
 * de lo que se eligió dibujar. El año en curso aparece solo en bolivianos y con asterisco:
 * dividido por un PIB de doce meses, siete meses de gasto parecerían un recorte.
 */
export function stackRows(
  index: Index,
  parts: readonly Part[],
  total: readonly string[],
  measure: Measure,
  from: number,
  rest?: { key: string; label: string },
): BarRow[] {
  const years = yearsOf(index, total, false).filter((year) => year >= from);
  const rows: BarRow[] = [];
  for (const year of years) {
    const whole = partValue(index, total, year, false);
    if (!whole) continue;
    if (measure === 'pib' && whole.months < 12) continue;
    const row: BarRow = { label: whole.months < 12 ? `${year}*` : String(year) };
    let sum = 0;
    for (const part of parts) {
      const found = partValue(index, part.codes, year, false);
      const converted = found ? inUnit(index, year, found.value, measure) : null;
      row[part.key] = converted;
      if (found) sum += found.value;
    }
    if (rest) {
      const left = inUnit(index, year, whole.value - sum, measure);
      row[rest.key] = left !== null && left > 0 ? left : 0;
    }
    rows.push(row);
  }
  return rows;
}

/** Valores anuales cerrados de una serie, como pares año-valor. */
export function closedYears(index: Index, code: string, stock = false): YearValue[] {
  return closed(yearly(index.get(code), stock));
}

/**
 * Las partes de un saldo mes a mes, para la deuda.
 *
 * Un saldo no se suma ni se anualiza: cada barra es el mes que el Ministerio informó. `total`
 * es la serie del todo y lo que no suman las partes queda en `rest`, igual que en `stackRows`.
 */
export function monthRows(
  index: Index,
  parts: readonly Part[],
  total: string,
  rest: { key: string; label: string },
): BarRow[] {
  return (index.get(total)?.points ?? []).map(([date, whole]) => {
    const row: BarRow = { label: date.slice(0, 7) };
    let sum = 0;
    for (const part of parts) {
      let value: number | null = null;
      for (const code of part.codes) {
        const found = index.get(code)?.points.find(([when]) => when === date)?.[1];
        if (found !== undefined) value = (value ?? 0) + found;
      }
      row[part.key] = value;
      sum += value ?? 0;
    }
    row[rest.key] = Math.max(0, whole - sum);
    return row;
  });
}

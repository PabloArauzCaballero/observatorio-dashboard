import type { FxConclusion } from './fx-snapshot';

/**
 * Las cuentas públicas, en la forma que los paneles las piden.
 *
 * Aquí está lo que no depende de la pantalla: cómo se llama cada serie en la base, cómo se
 * pasan los meses a años, cómo se divide por el PIB y qué frases salen de las cifras. Sin
 * `server-only` a propósito: el navegador recibe las series tal como están en la base y arma
 * cada gráfico con esto, y lo que cambia al mover un filtro no tiene por qué volver al
 * servidor.
 */

export type Unit = 'PCT_GDP' | 'PCT_REVENUE' | 'MM_BOB' | 'MM_USD' | 'PCT';

export interface AccountSeries {
  code: string;
  name: string;
  family: string;
  topic: string;
  place: string;
  concept: string;
  perimeter: string;
  unit: Unit;
  frequency: 'ANNUAL' | 'MONTHLY';
  publisher: string;
  sourceUrl: string | null;
  points: Array<[string, number]>;
}

export interface AccountsPayload {
  series: AccountSeries[];
  /** PIB a precios corrientes, en millones de bolivianos, por año. */
  gdp: Array<{ year: number; value: number }>;
}

/** Un año de una serie: el valor y de cuántos meses salió (12 = año cerrado). */
export interface YearValue {
  year: number;
  value: number;
  months: number;
}

export interface Index {
  get: (code: string) => AccountSeries | undefined;
  gdp: Map<number, number>;
}

export function indexOf(payload: AccountsPayload): Index {
  const byCode = new Map(payload.series.map((one) => [one.code, one]));
  return {
    get: (code) => byCode.get(code),
    gdp: new Map(payload.gdp.map((entry) => [entry.year, entry.value])),
  };
}

/**
 * Los valores de una serie por año.
 *
 * Una serie anual pasa tal cual. Una mensual de flujo (ingresos, gastos) se suma por año, y
 * cada año dice de cuántos meses salió: el año en curso trae siete y compararlo con uno de
 * doce sin decirlo es la forma más fácil de dibujar una caída que no existe.
 *
 * Una serie de **saldo** (deuda) no se suma: se toma el último mes del año.
 */
export function yearly(series: AccountSeries | undefined, stock = false): YearValue[] {
  if (!series) return [];
  const years = new Map<number, YearValue>();
  for (const [date, value] of series.points) {
    const year = Number(date.slice(0, 4));
    const held = years.get(year);
    if (series.frequency === 'ANNUAL') {
      years.set(year, { year, value, months: 12 });
    } else if (stock) {
      years.set(year, { year, value, months: (held?.months ?? 0) + 1 });
    } else {
      years.set(year, { year, value: (held?.value ?? 0) + value, months: (held?.months ?? 0) + 1 });
    }
  }
  return [...years.values()].sort((left, right) => left.year - right.year);
}

/** Solo los años cerrados, que son los comparables entre sí. */
export const closed = (values: readonly YearValue[]): YearValue[] =>
  values.filter((entry) => entry.months === 12);

export const lastOf = (values: readonly YearValue[]): YearValue | undefined => values.at(-1);

export function valueIn(values: readonly YearValue[], year: number): number | undefined {
  return values.find((entry) => entry.year === year)?.value;
}

/** Una cifra en millones de bolivianos como parte del PIB de su año, en %. */
export function ofGdp(index: Index, year: number, millions: number): number | null {
  const gdp = index.gdp.get(year);
  return gdp && gdp > 0 ? (millions / gdp) * 100 : null;
}

/* ───────────────────────── Nombres de las series ───────────────────────── */

export const spnfCode = (perimeter: string, concept: string): string =>
  `FISC_SPNF_${perimeter}_${concept}_MM_BOB`;
export const oecdCode = (place: string, concept: string): string =>
  `FISC_OECD_${place}_${concept}_PCT_GDP`;
export const bcbTaxCode = (concept: string): string => `FISC_BCB_${concept}_MM_BOB`;
export const debtCode = (kind: 'EXT' | 'INT', concept: string): string =>
  `FISC_DEBT_${kind}_${concept}_${kind === 'EXT' ? 'MM_USD' : 'MM_BOB'}`;
export const subsidyCode = (kind: 'EXPLICITA' | 'IMPLICITA', fuel: string): string =>
  `FISC_IMF_FFS_${kind}_${fuel}_PCT_GDP`;

export const PERIMETERS = [
  { key: 'SPNF', label: 'Sector público no financiero', hint: 'Gobierno general más empresas públicas: el perímetro con que el Ministerio informa el déficit.' },
  { key: 'GG', label: 'Gobierno general', hint: 'Ministerios, gobernaciones, municipios, universidades y seguridad social, sin empresas.' },
  { key: 'EMP', label: 'Empresas públicas', hint: 'YPFB, ENDE, COMIBOL, BoA y las demás, sin el gobierno.' },
] as const;

export interface Concept {
  key: string;
  label: string;
  side: 'ingreso' | 'gasto' | 'resultado';
}

export const SPNF_CONCEPTS: readonly Concept[] = [
  { key: 'INGRESOS_TOTALES', label: 'Ingresos totales', side: 'ingreso' },
  { key: 'INGRESOS_TRIBUTARIOS', label: 'Impuestos', side: 'ingreso' },
  { key: 'IMPUESTOS_HIDROCARBUROS', label: 'IDH y regalías', side: 'ingreso' },
  { key: 'VENTA_HIDROCARBUROS', label: 'Venta de hidrocarburos', side: 'ingreso' },
  { key: 'OTRAS_EMPRESAS', label: 'Otras empresas públicas', side: 'ingreso' },
  { key: 'OTROS_INGRESOS_CORRIENTES', label: 'Otros ingresos', side: 'ingreso' },
  { key: 'EGRESOS_TOTALES', label: 'Gasto total', side: 'gasto' },
  { key: 'SERVICIOS_PERSONALES', label: 'Sueldos y salarios', side: 'gasto' },
  { key: 'BIENES_SERVICIOS', label: 'Bienes y servicios', side: 'gasto' },
  { key: 'INTERESES_EXTERNOS', label: 'Intereses de deuda externa', side: 'gasto' },
  { key: 'INTERESES_INTERNOS', label: 'Intereses de deuda interna', side: 'gasto' },
  { key: 'TRANSFERENCIAS_CORRIENTES', label: 'Transferencias y subvenciones', side: 'gasto' },
  { key: 'EGRESOS_CAPITAL', label: 'Inversión (gasto de capital)', side: 'gasto' },
  { key: 'RESULTADO_GLOBAL', label: 'Resultado global (déficit)', side: 'resultado' },
  { key: 'RESULTADO_CORRIENTE', label: 'Resultado corriente', side: 'resultado' },
];

export const OECD_MEASURES = [
  { key: 'TOTAL', label: 'Total de ingresos tributarios' },
  { key: 'RENTA', label: 'Renta y utilidades' },
  { key: 'SEGURIDAD_SOCIAL', label: 'Seguridad social' },
  { key: 'BIENES_SERVICIOS', label: 'Bienes y servicios' },
  { key: 'IVA', label: 'IVA' },
  { key: 'SELECTIVOS', label: 'Selectivos al consumo' },
  { key: 'ADUANAS', label: 'Aduanas' },
  { key: 'PROPIEDAD', label: 'Propiedad' },
  { key: 'OTROS', label: 'Otros' },
] as const;

export const OECD_PLACES = [
  { key: 'BOL', label: 'Bolivia' },
  { key: 'PER', label: 'Perú' },
  { key: 'CHL', label: 'Chile' },
  { key: 'ARG', label: 'Argentina' },
  { key: 'BRA', label: 'Brasil' },
  { key: 'PRY', label: 'Paraguay' },
  { key: 'COL', label: 'Colombia' },
  { key: 'ECU', label: 'Ecuador' },
] as const;

/** Los impuestos del cuadro 13.05 del BCB que se dibujan uno a uno. */
export const BCB_TAXES = [
  { key: 'IVA_MERCADO_INTERNO', label: 'IVA, mercado interno' },
  { key: 'IVA_IMPORTACIONES', label: 'IVA, importaciones' },
  { key: 'IUE', label: 'IUE (utilidades)' },
  { key: 'IT', label: 'IT (transacciones)' },
  { key: 'IDH', label: 'IDH' },
  { key: 'IEHD', label: 'IEHD (combustibles)' },
  { key: 'GRAVAMEN_ARANCELARIO', label: 'Aranceles' },
  { key: 'RC_IVA', label: 'RC-IVA (sueldos)' },
  { key: 'ICE_MERCADO_INTERNO', label: 'ICE, mercado interno' },
  { key: 'ITF', label: 'ITF (transacciones financieras)' },
  { key: 'GRANDES_FORTUNAS_RESIDENTES', label: 'Grandes fortunas' },
] as const;

/* ───────────────────────── Formato ───────────────────────── */

export const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const millions = (value: number): string => `Bs ${number(value, 0)} millones`;
export const percent = (value: number, decimals = 1): string => `${number(value, decimals)} %`;

/* ───────────────────────── Lecturas derivadas ───────────────────────── */

const median = (values: readonly number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

/**
 * Las frases de la lectura de arriba, hechas de las series y no escritas a mano.
 *
 * Dice qué nivel hay y contra qué se compara; no dice por qué ni qué va a pasar. Cada una se
 * omite si la serie que la sostiene no está, así que un lector nunca ve una cifra de una
 * fuente que no llegó.
 */
export function buildConclusions(payload: AccountsPayload): FxConclusion[] {
  const index = indexOf(payload);
  const out: FxConclusion[] = [];
  const annual = (concept: string) => closed(yearly(index.get(spnfCode('SPNF', concept))));
  const income = annual('INGRESOS_TOTALES');
  const spending = annual('EGRESOS_TOTALES');
  const balance = annual('RESULTADO_GLOBAL');
  const year = income.at(-1)?.year;

  if (year !== undefined) {
    const inc = valueIn(income, year);
    const spent = valueIn(spending, year);
    if (inc && spent) {
      out.push({
        key: 'gasto',
        claim: `Por cada Bs 100 que ingresaron al sector público en ${year}, se gastaron`,
        figure: `Bs ${number((spent / inc) * 100, 0)}`,
        detail: `Ingresos de ${millions(inc)} y egresos de ${millions(spent)} (sector público no financiero, Ministerio de Economía). La diferencia se financió con deuda.`,
        tone: spent > inc ? 'adverse' : 'neutral',
      });
    }
    const deficit = valueIn(balance, year);
    const share = deficit === undefined ? null : ofGdp(index, year, deficit);
    if (deficit !== undefined && share !== null) {
      out.push({
        key: 'deficit',
        claim: `Resultado global de ${year}, como parte del PIB`,
        figure: percent(share),
        detail: `${millions(deficit)}, dividido por el PIB nominal del Banco Mundial (${millions(index.gdp.get(year) ?? 0)}). El Ministerio informa otra cifra para el mismo año porque usa un PIB estimado distinto: ver la nota de «Panorama».`,
        tone: deficit < 0 ? 'adverse' : 'favourable',
      });
    }
    const tax = valueIn(annual('INGRESOS_TRIBUTARIOS'), year);
    if (tax && inc) {
      out.push({
        key: 'impuestos',
        claim: 'Parte de los ingresos del Estado que son impuestos',
        figure: percent((tax / inc) * 100, 0),
        detail: `${millions(tax)} de ${millions(inc)} en ${year}. El resto es venta de gas y combustibles por las empresas públicas, regalías y otros ingresos.`,
        tone: 'neutral',
      });
    }
    const wages = valueIn(annual('SERVICIOS_PERSONALES'), year);
    const interest =
      (valueIn(annual('INTERESES_EXTERNOS'), year) ?? 0) + (valueIn(annual('INTERESES_INTERNOS'), year) ?? 0);
    if (wages && spent && tax) {
      out.push({
        key: 'sueldos',
        claim: 'Sueldos y salarios como parte del gasto total',
        figure: percent((wages / (valueIn(spending, year) ?? 1)) * 100, 0),
        detail: `${millions(wages)} en ${year}. Los intereses de la deuda sumaron ${millions(interest)}, el ${number((interest / tax) * 100, 0)} % de lo recaudado en impuestos.`,
        tone: interest / tax > 0.15 ? 'adverse' : 'neutral',
      });
    }
  }

  const total = (place: string) => closed(yearly(index.get(oecdCode(place, 'TOTAL')))).at(-1);
  const bolivia = total('BOL');
  const neighbours = OECD_PLACES.filter((place) => place.key !== 'BOL')
    .map((place) => total(place.key))
    .filter((entry): entry is YearValue => entry !== undefined && entry.year === bolivia?.year)
    .map((entry) => entry.value);
  const mid = median(neighbours);
  if (bolivia && mid !== null) {
    out.push({
      key: 'carga',
      claim: `Ingresos tributarios de Bolivia, como parte del PIB (${bolivia.year})`,
      figure: percent(bolivia.value),
      detail: `La mediana de los siete vecinos es ${percent(mid)}. Incluye las contribuciones a la seguridad social y excluye el IDH y las regalías, con la clasificación común de la OCDE y la CEPAL.`,
      tone: 'neutral',
    });
  }

  const inner = index.get(debtCode('INT', 'TOTAL'))?.points.at(-1);
  const holder = index.get(debtCode('INT', 'BANCO_CENTRAL'))?.points.at(-1);
  if (inner && holder && inner[0] === holder[0] && inner[1] > 0) {
    out.push({
      key: 'deuda',
      claim: 'Parte de la deuda interna del Tesoro que tiene el Banco Central',
      figure: percent((holder[1] / inner[1]) * 100, 0),
      detail: `${millions(holder[1])} de ${millions(inner[1])} al ${inner[0].slice(0, 7)}. Es deuda del Tesoro General de la Nación; no incluye la de gobernaciones, municipios ni empresas públicas.`,
      tone: 'adverse',
    });
  }

  const explicit = closed(yearly(index.get(subsidyCode('EXPLICITA', 'TOTAL'))));
  const lastSubsidy = explicit.at(-1);
  const peak = explicit.reduce<YearValue | undefined>((best, entry) => (!best || entry.value > best.value ? entry : best), undefined);
  if (lastSubsidy && peak) {
    out.push({
      key: 'subsidio',
      claim: `Subvención explícita a combustibles en ${lastSubsidy.year}, como parte del PIB`,
      figure: percent(lastSubsidy.value),
      detail: `Estimación del FMI, no el gasto presupuestario. El máximo fue ${percent(peak.value)} en ${peak.year}.`,
      tone: 'neutral',
    });
  }
  return out;
}

/**
 * La retrospectiva de los videos de vendedores (ADR 0031 del núcleo): tendencias por rubro y mes, cobertura por
 * año y precios por producto, listos para dibujar. Puro y sin importar módulos propios, para que `node --test`
 * lo pruebe.
 *
 * El núcleo ya calculó todo con el umbral de trend POR MES Y RUBRO (5 % superior de vistas dentro de su mes y
 * su rubro, nunca global); aquí solo se recorta, se cruzan los filtros y se ordena. Un mes con menos de `minN`
 * videos viene con su cantidad y sin estadística: aquí se cuenta aparte, nunca se dibuja como un cero.
 */

export interface TrendMonth {
  rubro: string;
  month: string;
  n: number;
  accounts: number;
  median: number | null;
  p95: number | null;
  trendN: number | null;
  shareRatio: number | null;
  priced: number;
  priceMedian: number | null;
  products: { product: string; n: number }[];
  newTags: { tag: string; n: number }[];
  baseline: boolean;
  tactics: { tactic: string; share: number }[];
}

export interface TrendProduct {
  year: string;
  rubro: string;
  product: string;
  n: number;
  prices: number;
  p25: number | null;
  median: number | null;
  p75: number | null;
}

export interface VideoTrends {
  minN: number;
  trendShare: number;
  months: TrendMonth[];
  products: TrendProduct[];
}

export interface YearCoverage {
  videos: number;
  accountsWithVideos: number;
  accountsFull: number;
  accountsPartial: number;
  accountsNone: number;
  cause: 'COMPLETO' | 'PARCIAL' | 'SIN_ALCANCE' | 'SIN_CUENTAS';
  why: string;
}

export interface RetroFilters {
  rubro: ReadonlySet<string>;
  /** AAAA-MM, o vacío para «desde el primero». */
  from: string;
  /** AAAA-MM, o vacío para «hasta el último». */
  to: string;
}

export const NO_RETRO_FILTERS: RetroFilters = { rubro: new Set(), from: '', to: '' };

const inRange = (month: string, filters: RetroFilters): boolean =>
  (!filters.from || month >= filters.from) && (!filters.to || month <= filters.to);

/** Los meses del recorte. `except: 'rubro'` deja libre el rubro para contar sus opciones (filtro cruzado). */
export function filterMonths(trends: VideoTrends, filters: RetroFilters, except?: 'rubro' | 'range'): TrendMonth[] {
  return trends.months.filter(
    (row) =>
      (except === 'rubro' || filters.rubro.size === 0 || filters.rubro.has(row.rubro)) &&
      (except === 'range' || inRange(row.month, filters)),
  );
}

/** Rubros con los videos que tienen dentro del rango de fechas elegido. */
export function rubroOptions(trends: VideoTrends, filters: RetroFilters): { value: string; count: number }[] {
  const all = new Set(trends.months.map((row) => row.rubro));
  const counts = new Map<string, number>();
  for (const row of filterMonths(trends, filters, 'rubro')) counts.set(row.rubro, (counts.get(row.rubro) ?? 0) + row.n);
  return [...all]
    .map((value) => ({ value, count: counts.get(value) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Meses que existen para los rubros elegidos: lo que ofrecen los selectores de rango. */
export function monthOptions(trends: VideoTrends, filters: RetroFilters): string[] {
  return [...new Set(filterMonths(trends, filters, 'range').map((row) => row.month))].sort();
}

/** Cuántos meses-rubro del recorte tienen estadística y cuántos solo cantidad (n menor que el mínimo). */
export function sampleSplit(months: readonly TrendMonth[], minN: number): { withStat: number; countOnly: number; videosCountOnly: number } {
  const small = months.filter((row) => row.n < minN);
  return {
    withStat: months.length - small.length,
    countOnly: small.length,
    videosCountOnly: small.reduce((sum, row) => sum + row.n, 0),
  };
}

export interface HeatCell {
  row: string;
  column: string;
  value: number;
  hint?: string;
}

/** Mapa de calor rubro × mes del p95 de vistas. Solo los meses con estadística; el resto no se pinta. */
export function heatCells(months: readonly TrendMonth[], labelOf: (rubro: string) => string): { rows: string[]; columns: string[]; cells: HeatCell[] } {
  const drawn = months.filter((row) => row.p95 !== null);
  const totals = new Map<string, number>();
  for (const row of drawn) totals.set(row.rubro, (totals.get(row.rubro) ?? 0) + row.n);
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([rubro]) => labelOf(rubro));
  const columns = [...new Set(drawn.map((row) => row.month))].sort();
  return {
    rows,
    columns,
    cells: drawn.map((row) => ({
      row: labelOf(row.rubro),
      column: row.month,
      value: row.p95 ?? 0,
      hint: `${row.n} videos de ${row.accounts} cuentas · mediana ${Math.round(row.median ?? 0).toLocaleString('es-BO')} vistas`,
    })),
  };
}

/** Hashtags nuevos por mes: cuántos aparecieron por primera vez ese mes (en algún rubro del recorte) y cuáles. */
export function newTagsByMonth(months: readonly TrendMonth[]): { month: string; count: number; tags: { tag: string; rubro: string; n: number }[] }[] {
  const byMonth = new Map<string, { tag: string; rubro: string; n: number }[]>();
  for (const row of months) {
    if (!row.newTags.length) continue;
    const list = byMonth.get(row.month) ?? [];
    for (const tag of row.newTags) list.push({ tag: tag.tag, rubro: row.rubro, n: tag.n });
    byMonth.set(row.month, list);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, tags]) => ({ month, count: tags.length, tags: tags.sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag)) }));
}

/** Los años del recorte (por el rango de meses) para la cobertura. */
export function yearsInRange(filters: RetroFilters, all: readonly string[]): string[] {
  return all.filter(
    (year) => (!filters.from || year >= filters.from.slice(0, 4)) && (!filters.to || year <= filters.to.slice(0, 4)),
  );
}

/** Los productos que dicen precio, con el rubro elegido y el rango de años, del que más precios junta al que menos. */
export function productChoices(products: readonly TrendProduct[], filters: RetroFilters, limit = 40): { product: string; n: number; prices: number }[] {
  const from = filters.from.slice(0, 4);
  const to = filters.to.slice(0, 4);
  const totals = new Map<string, { n: number; prices: number }>();
  for (const row of products) {
    if (filters.rubro.size && !filters.rubro.has(row.rubro)) continue;
    if ((from && row.year < from) || (to && row.year > to)) continue;
    const own = totals.get(row.product) ?? { n: 0, prices: 0 };
    own.n += row.n;
    own.prices += row.prices;
    totals.set(row.product, own);
  }
  return [...totals.entries()]
    .filter(([, own]) => own.prices > 0)
    .map(([product, own]) => ({ product, ...own }))
    .sort((a, b) => b.prices - a.prices || a.product.localeCompare(b.product))
    .slice(0, limit);
}

export interface PriceYear {
  year: string;
  videos: number;
  prices: number;
  p25: number | null;
  median: number | null;
  p75: number | null;
  dollar: number | null;
  medianUsd: number | null;
}

/**
 * El precio dicho de un producto, año por año, con el dólar paralelo promedio del año al lado. Si el producto
 * está en varios rubros del recorte, la mediana es la del rubro con más precios (no se mezclan medianas).
 */
export function priceByYear(
  products: readonly TrendProduct[],
  product: string,
  filters: RetroFilters,
  dollarByMonth: Readonly<Record<string, number>>,
): PriceYear[] {
  const from = filters.from.slice(0, 4);
  const to = filters.to.slice(0, 4);
  const byYear = new Map<string, TrendProduct[]>();
  for (const row of products) {
    if (row.product !== product) continue;
    if (filters.rubro.size && !filters.rubro.has(row.rubro)) continue;
    if ((from && row.year < from) || (to && row.year > to)) continue;
    byYear.set(row.year, [...(byYear.get(row.year) ?? []), row]);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, rows]) => {
      const best = [...rows].sort((a, b) => b.prices - a.prices)[0];
      const months = Object.entries(dollarByMonth).filter(([month]) => month.startsWith(year));
      const dollar = months.length ? Math.round((100 * months.reduce((sum, [, value]) => sum + value, 0)) / months.length) / 100 : null;
      const median = best?.median ?? null;
      return {
        year,
        videos: rows.reduce((sum, row) => sum + row.n, 0),
        prices: rows.reduce((sum, row) => sum + row.prices, 0),
        p25: best?.p25 ?? null,
        median,
        p75: best?.p75 ?? null,
        dollar,
        medianUsd: median !== null && dollar ? Math.round((100 * median) / dollar) / 100 : null,
      };
    });
}

/** Dólar paralelo promedio por mes (Bs por USD) desde la serie diaria del punto medio. */
export function monthlyAverage(points: readonly { date: string; value: number }[]): Record<string, number> {
  const sums = new Map<string, { total: number; days: number }>();
  for (const point of points) {
    if (!Number.isFinite(point.value)) continue;
    const month = point.date.slice(0, 7);
    const own = sums.get(month) ?? { total: 0, days: 0 };
    own.total += point.value;
    own.days += 1;
    sums.set(month, own);
  }
  return Object.fromEntries([...sums.entries()].map(([month, own]) => [month, Math.round((100 * own.total) / own.days) / 100]));
}

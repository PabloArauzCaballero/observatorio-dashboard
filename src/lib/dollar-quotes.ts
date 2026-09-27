import type { DailyPoint, StablecoinSeries } from './series';

/**
 * Lo que cuesta un dólar hoy, en las tres cotizaciones que un lector usa.
 *
 * Es lo primero que se busca en la portada y lo único que hasta ahora había que
 * armar a mano: el oficial estaba en una tarjeta, el paralelo en otra como punto
 * medio sin nombre de ficha, y USDC solo existía dentro del capítulo del tipo de
 * cambio. Quien entra a preguntar «¿a cuánto está el dólar?» se encuentra ahora
 * las tres respuestas juntas, en la misma escala —bolivianos por dólar— y con la
 * fecha de cada una.
 *
 * Tres decisiones que no se ven en la tarjeta:
 *
 * - **USDT y USDC se leen por ficha, no del agregado.** El paralelo empalmado
 *   tiene dos años de historia pero no dice qué dólar cotiza; la lectura por
 *   ficha sí, y la diferencia entre las dos fichas es el precio del riel (USDC
 *   sale más caro y su libro es más fino). Promediarlas la borraría.
 * - **Compra y venta salen del menor y el mayor de los dos lados**, no de su
 *   rótulo. Varias plazas rotulan el lado al revés, y la convención de las casas
 *   de cambio —compra la más baja, venta la más alta— no depende de eso.
 * - **La edad del dato se calcula y se publica.** El recolector puede quedarse
 *   días sin correr, y una cotización de hace una semana con cara de hoy es peor
 *   que ninguna: la tarjeta dice cuántos días tiene.
 */

export type QuoteKey = 'USDT' | 'USDC' | 'OFICIAL';

export interface DollarQuote {
  key: QuoteKey;
  label: string;
  /** Qué es y dónde se forma el precio. */
  detail: string;
  /** Bolivianos por dólar: punto medio entre plazas o el oficial publicado. */
  value: number;
  /** El menor de los dos lados, cuando la fuente los separa. */
  buy: number | null;
  /** El mayor de los dos lados, con la misma condición. */
  sell: number | null;
  date: string;
  /** Diferencia contra la lectura anterior, en bolivianos. */
  change: number | null;
  changePercent: number | null;
  /** El día contra el que se midió el cambio. */
  previousDate: string | null;
  /** Cuántas plazas cotizaron la ficha ese día; null en el oficial. */
  venues: number | null;
  spark: number[];
}

export interface DollarQuotes {
  quotes: DollarQuote[];
  /** La fecha más reciente entre las tres. */
  latestDate: string | null;
  /** Días entre esa fecha y hoy en La Paz. */
  ageDays: number | null;
  /** USDT sobre el oficial del mismo día (o del último anterior), en %. */
  usdtOverOfficial: number | null;
}

/** Cuántas jornadas dibuja la chispa de cada cotización. */
const SPARK_DAYS = 30;

const DETAIL: Record<QuoteKey, string> = {
  USDT: 'Tether · mercado P2P en bolivianos',
  USDC: 'USD Coin · mercado P2P en bolivianos',
  OFICIAL: 'Banco Central de Bolivia',
};

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function sides(bid: number | null, ask: number | null): { buy: number | null; sell: number | null } {
  if (bid === null || ask === null) return { buy: null, sell: null };
  return { buy: Math.min(bid, ask), sell: Math.max(bid, ask) };
}

function changeOf(
  last: { value: number },
  previous: { value: number; date: string } | undefined,
): Pick<DollarQuote, 'change' | 'changePercent' | 'previousDate'> {
  if (!previous || previous.value === 0) {
    return { change: null, changePercent: null, previousDate: null };
  }
  const change = last.value - previous.value;
  return {
    change,
    changePercent: (change / previous.value) * 100,
    previousDate: previous.date,
  };
}

function tokenQuote(series: StablecoinSeries | undefined, key: 'USDT' | 'USDC'): DollarQuote | null {
  const points = series?.points ?? [];
  const last = points.at(-1);
  if (!last || !Number.isFinite(last.mid)) return null;
  const previous = points.at(-2);
  return {
    key,
    label: key,
    detail: DETAIL[key],
    value: last.mid,
    ...sides(last.bid, last.ask),
    date: last.date,
    ...changeOf(
      { value: last.mid },
      previous ? { value: previous.mid, date: previous.date } : undefined,
    ),
    venues: last.venues,
    spark: points.slice(-SPARK_DAYS).map((point) => point.mid),
  };
}

function officialQuote(
  official: readonly DailyPoint[],
  officialSides: { buy: readonly DailyPoint[]; sell: readonly DailyPoint[] } | undefined,
): DollarQuote | null {
  const last = official.at(-1);
  if (!last || !Number.isFinite(last.value)) return null;
  // Contra la jornada publicada anterior, que es con lo que el lector compara.
  const previous = official.at(-2);
  // Los dos lados sólo si el banco publicó ambos ese mismo día.
  const buy = officialSides?.buy.find((point) => point.date === last.date)?.value ?? null;
  const sell = officialSides?.sell.find((point) => point.date === last.date)?.value ?? null;
  return {
    key: 'OFICIAL',
    label: 'Oficial',
    detail: DETAIL.OFICIAL,
    value: last.value,
    ...sides(buy, sell),
    date: last.date,
    ...changeOf(last, previous),
    venues: null,
    spark: official.slice(-SPARK_DAYS).map((point) => point.value),
  };
}

export interface DollarQuotesInput {
  stablecoins: readonly StablecoinSeries[];
  official: readonly DailyPoint[];
  /** Los lados que el banco publica por separado, si los publica. */
  officialSides?: { buy: readonly DailyPoint[]; sell: readonly DailyPoint[] };
  /** Hoy en La Paz, AAAA-MM-DD. Se inyecta para que la función siga siendo pura. */
  today: string;
}

export function buildDollarQuotes({
  stablecoins,
  official,
  officialSides,
  today,
}: DollarQuotesInput): DollarQuotes {
  const usdt = tokenQuote(
    stablecoins.find((series) => series.token === 'USDT'),
    'USDT',
  );
  const usdc = tokenQuote(
    stablecoins.find((series) => series.token === 'USDC'),
    'USDC',
  );
  const oficial = officialQuote(official, officialSides);

  const quotes = [usdt, usdc, oficial].filter((quote): quote is DollarQuote => quote !== null);

  const latestDate = quotes.reduce<string | null>(
    (latest, quote) => (!latest || quote.date > latest ? quote.date : latest),
    null,
  );

  /*
   * La brecha contra el oficial vigente ese día, no contra el último publicado:
   * si el oficial es de hoy y USDT de hace tres días, compararlos mezclaría dos
   * mercados distintos.
   */
  let usdtOverOfficial: number | null = null;
  if (usdt) {
    const sameDay = [...official].reverse().find((point) => point.date <= usdt.date);
    if (sameDay && sameDay.value > 0) {
      usdtOverOfficial = (usdt.value / sameDay.value - 1) * 100;
    }
  }

  return {
    quotes,
    latestDate,
    ageDays: latestDate ? Math.max(0, daysBetween(latestDate, today)) : null,
    usdtOverOfficial,
  };
}

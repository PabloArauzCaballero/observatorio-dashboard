/**
 * Velas a partir de una lectura por jornada, y lo que se puede decir de ellas.
 *
 * El observatorio guarda una cotización por día, no los tics de una sesión, así
 * que ninguna vela de aquí es intradía. Lo que sí hay es real y alcanza para
 * una: un punto medio por jornada, que da la apertura (el de la jornada
 * anterior) y el cierre (el de esta), y —cuando la fuente los publica— los dos
 * lados de ese día, que son el máximo y el mínimo que un lector pudo pagar. El
 * cuerpo es entonces la variación del día y la mecha la horquilla publicada;
 * inventar cuatro precios a partir de una sola cotización sería lo contrario.
 *
 * Esta agregación vivía dentro del panel del paralelo. Se saca a un módulo
 * puro porque las fichas por riel (USDT/BOB, USDC/BOB) y el nivel real piden
 * la misma lectura, y tres copias de una regla de agrupación por semanas son
 * tres sitios donde el umbral puede dejar de coincidir. Nada de aquí toca el
 * DOM: entra una lista de jornadas y sale una lista de velas y un resumen que
 * el pie de figura imprime tal cual.
 */

/** Una jornada tal como la guarda el observatorio: un punto medio y, si los hay, sus lados. */
export interface CandleSession {
  date: string;
  /** El punto medio de la jornada: lo que abre y cierra el cuerpo. */
  mid: number;
  /**
   * Los precios publicados ese día además del punto medio —compra y venta,
   * en el orden que sea—. Definen la mecha. Sin ellos la mecha se limita al
   * cuerpo, que es lo único que se sabe.
   */
  sides?: readonly number[];
}

export interface DayCandle {
  date: string;
  /** Dónde empezó: el punto medio de la jornada anterior. */
  open: number;
  /** Dónde acabó: el punto medio de esta jornada. */
  close: number;
  /** El máximo y el mínimo del día: los lados publicados y los dos extremos del cuerpo. */
  high: number;
  low: number;
}

/** Qué es cada vela: una jornada, o una semana de ellas. */
export type CandleGrouping = 'JORNADA' | 'SEMANA';

/**
 * Por encima de estas jornadas las velas se agrupan por semana para seguir
 * siendo legibles.
 *
 * Ciento veinte y no noventa: «90 días» deja noventa y una jornadas, y un
 * umbral de noventa convertía la única selección que el pie de figura manda
 * elegir en la vista semanal de la que pretendía escapar.
 */
export const CANDLE_DAILY_LIMIT = 120;
/** Y no más semanas de las que caben con un cuerpo que se vea. */
export const CANDLE_WEEK_LIMIT = 104;

export interface CandleSet {
  candles: DayCandle[];
  grouping: CandleGrouping;
  /** Verdadero si la vista semanal tuvo que dejar fuera las semanas más viejas. */
  clipped: boolean;
}

/**
 * Las jornadas como velas: una por jornada mientras se lean, por semana cuando no.
 *
 * Una vela necesita un máximo y un mínimo que no sean su propio cuerpo. Con
 * una cotización al día el cierre de cada jornada ES la apertura de la
 * siguiente, así que las velas diarias se pegan en una cinta continua:
 * honesto, e ilegible como gráfico de velas. Agrupar las jornadas por semana
 * lo arregla con números reales: la semana abre en su primer punto medio,
 * cierra en el último, y su máximo y mínimo son los que el precio alcanzó de
 * verdad dentro de ella.
 *
 * Las selecciones cortas se quedan diarias, porque noventa jornadas sí se
 * leen, y ahí la mecha es la horquilla que la fuente publicó ese día: una
 * mecha larga es una jornada en la que compra y venta se separaron, que es
 * cuando el mercado está bajo tensión.
 */
export function sessionCandles(sessions: readonly CandleSession[]): CandleSet {
  const ordered = [...sessions]
    .filter((session) => Number.isFinite(session.mid))
    .sort((left, right) => left.date.localeCompare(right.date));

  if (ordered.length <= CANDLE_DAILY_LIMIT) {
    const candles: DayCandle[] = [];
    let previous: number | null = null;
    for (const session of ordered) {
      if (previous !== null) {
        const known = [previous, session.mid, ...(session.sides ?? [])].filter((value) =>
          Number.isFinite(value),
        );
        candles.push({
          date: session.date,
          open: previous,
          close: session.mid,
          high: Math.max(...known),
          low: Math.min(...known),
        });
      }
      previous = session.mid;
    }
    return { candles, grouping: 'JORNADA', clipped: false };
  }

  /** Las jornadas agrupadas por el lunes al que pertenecen. */
  const weeks = new Map<string, CandleSession[]>();
  for (const session of ordered) {
    const day = new Date(`${session.date}T12:00:00Z`);
    const monday = new Date(day);
    monday.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    weeks.set(key, [...(weeks.get(key) ?? []), session]);
  }

  const sorted = [...weeks.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  const candles = sorted.slice(-CANDLE_WEEK_LIMIT).map(([week, held]) => {
    const mids = held.map((session) => session.mid);
    return {
      date: week,
      open: held[0]?.mid ?? 0,
      close: held.at(-1)?.mid ?? 0,
      high: Math.max(...mids),
      low: Math.min(...mids),
    };
  });
  return { candles, grouping: 'SEMANA', clipped: sorted.length > candles.length };
}

/**
 * Lo que un análisis variacional pide de un tramo de velas, sacado de las velas.
 *
 * Tres cosas y no más: cuánto se movió el precio de la primera apertura al
 * último cierre, entre qué extremos anduvo, y qué vela tuvo la mayor amplitud
 * —la jornada o la semana en que el precio se abrió más—. Todo sale de la
 * lista dibujada, así que el resumen describe exactamente lo que hay en
 * pantalla, con el mismo agrupamiento y el mismo recorte.
 */
export interface CandleSummary {
  /** Cuántas velas hay en el tramo. */
  count: number;
  from: string;
  to: string;
  open: number;
  close: number;
  /** Último cierre menos primera apertura, en la unidad de la serie. */
  change: number;
  /** La misma variación como porcentaje de la primera apertura. */
  changePercent: number;
  high: number;
  highOn: string;
  low: number;
  lowOn: string;
  /** La vela con mayor distancia entre su máximo y su mínimo. */
  widest: { date: string; range: number; rangePercent: number };
}

export function candleSummary(candles: readonly DayCandle[]): CandleSummary | null {
  const first = candles[0];
  const last = candles.at(-1);
  if (!first || !last || first.open === 0) return null;

  let high = first;
  let low = first;
  let widest = first;
  for (const candle of candles) {
    if (candle.high > high.high) high = candle;
    if (candle.low < low.low) low = candle;
    if (candle.high - candle.low > widest.high - widest.low) widest = candle;
  }

  const change = last.close - first.open;
  return {
    count: candles.length,
    from: first.date,
    to: last.date,
    open: first.open,
    close: last.close,
    change,
    changePercent: (change / first.open) * 100,
    high: high.high,
    highOn: high.date,
    low: low.low,
    lowOn: low.date,
    widest: {
      date: widest.date,
      range: widest.high - widest.low,
      rangePercent: widest.low > 0 ? ((widest.high - widest.low) / widest.low) * 100 : 0,
    },
  };
}

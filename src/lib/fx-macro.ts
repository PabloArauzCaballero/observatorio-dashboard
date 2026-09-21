/**
 * The exchange rate read as a macroeconomic question rather than a price chart.
 *
 * The section used to open on realised volatility, skewness, excess kurtosis and
 * a 95% value at risk. Those are the statistics of a traded asset, and they
 * answer "how violently did this move" — a fair question about a stock, and
 * close to meaningless about a currency that was administered at 6.91 for
 * twenty-three months and then let go. Worse, computed over the whole history
 * they pool two regimes into one number that describes neither.
 *
 * What a reader actually wants to know about the Bolivian dollar is four
 * things, and none of them is a moment of the return distribution:
 *
 * 1. **Is a dollar scarce?** That is the gap between the administered rate and
 *    the market one, and it is the question the report already answered.
 * 2. **Which regime is this?** A fixed rate and a moving one are different
 *    economies, and a statistic that straddles the change is an artefact.
 * 3. **Is the currency actually cheaper, or only nominally?** A rate that rises
 *    less than prices has not depreciated, it has stood still while the ground
 *    moved. This is the question the old panel could not ask at all, and the
 *    answer reverses the impression the nominal chart gives.
 * 4. **How fast are prices moving right now?** Not last year — today.
 *
 * The third and fourth are answerable here because of the UFV. The Unidad de
 * Fomento de Vivienda is the unit Bolivian contracts and credit are indexed to,
 * the central bank computes it from the consumer price index, and it is
 * published **every calendar day** back to 7 December 2001, when it was created
 * worth exactly 1. That makes it a daily price index: deflating a daily
 * exchange rate by it yields a daily real exchange rate, and its own rate of
 * change is domestic inflation at daily frequency. The annual series from the
 * multilateral compiler cannot do either — it arrives once a year and years
 * late.
 *
 * Everything here is a pure function over observations the report already
 * shows, so a reader can reproduce any figure from the CSV the same page serves.
 * Nothing here interprets: it states what the level is, against which base, and
 * under which regime.
 */

import type { Observation } from './econometrics';

/** A dated figure, which is what every series here reduces to. */
export interface MacroPoint {
  date: string;
  value: number;
}

/**
 * Which exchange-rate regime a day belongs to.
 *
 * Two values and not three. The data distinguishes a rate that does not move
 * from one that does; it does not distinguish a crawling peg from a managed
 * float, and naming that difference would be an interpretation dressed as an
 * observation.
 */
export type FxRegime = 'FIJO' | 'EN_MOVIMIENTO';

export interface RegimeSegment {
  regime: FxRegime;
  from: string;
  to: string;
  /** Calendar days the segment covers, both ends included. */
  days: number;
  rateFrom: number;
  rateTo: number;
}

/** A move only counts once it would show in a rate printed to the centavo. */
const MOVE_THRESHOLD = 0.005;

/**
 * Forward-fills a daily index onto whichever dates are asked for.
 *
 * The UFV needs this twice over. It is published about a fortnight ahead of
 * today, so a contract settling next week knows its unit now, which means the
 * series runs past the last exchange-rate reading. And a day may be missing
 * from either series independently. Carrying the last published value forward
 * is what the unit itself does — a UFV with no new publication has not stopped
 * existing — whereas interpolating would invent a price index.
 */
export function alignIndex(
  index: readonly MacroPoint[],
  dates: readonly string[],
): Map<string, number> {
  const ordered = [...index].sort((left, right) => left.date.localeCompare(right.date));
  const aligned = new Map<string, number>();
  let cursor = 0;
  let carried: number | null = null;
  for (const date of [...dates].sort((left, right) => left.localeCompare(right))) {
    while (cursor < ordered.length && (ordered[cursor]?.date ?? '') <= date) {
      carried = ordered[cursor]?.value ?? carried;
      cursor += 1;
    }
    if (carried !== null) aligned.set(date, carried);
  }
  return aligned;
}

/**
 * A nominal series expressed in the purchasing power of its base date.
 *
 * Indexed to 100 rather than left in bolivianos, because the level of a real
 * rate has no unit anybody recognises: what carries meaning is whether it is
 * above or below where it started. Above 100 the dollar has become genuinely
 * dearer; below it, the nominal rise has not kept up with inflation and a
 * dollar costs less in real terms than it did, however much larger the printed
 * figure is.
 */
export function realIndex(
  nominal: readonly MacroPoint[],
  priceIndex: readonly MacroPoint[],
  baseDate?: string,
): MacroPoint[] {
  const ordered = [...nominal].sort((left, right) => left.date.localeCompare(right.date));
  const aligned = alignIndex(
    priceIndex,
    ordered.map((point) => point.date),
  );
  const base = baseDate ?? ordered.find((point) => aligned.has(point.date))?.date;
  if (!base) return [];
  const nominalBase = ordered.find((point) => point.date === base)?.value;
  const priceBase = aligned.get(base);
  if (!nominalBase || !priceBase) return [];

  const out: MacroPoint[] = [];
  for (const point of ordered) {
    const price = aligned.get(point.date);
    if (!price || point.value <= 0) continue;
    out.push({
      date: point.date,
      value: (100 * (point.value / nominalBase)) / (price / priceBase),
    });
  }
  return out;
}

/**
 * Domestic inflation at daily frequency, annualised over a trailing window.
 *
 * Read off the UFV's own rate of change, which is why it exists at this
 * frequency at all. A year-long window is used rather than a month because a
 * month of a price index annualised swings on rounding: the UFV moves in the
 * fifth decimal, and a fortnight of that scaled up by twenty-six produces a
 * figure that says more about the divisor than about prices.
 */
export function impliedInflation(
  priceIndex: readonly MacroPoint[],
  windowDays = 365,
): MacroPoint[] {
  const ordered = [...priceIndex].sort((left, right) => left.date.localeCompare(right.date));
  /*
   * The window's far end is looked up through the same forward-filling the real
   * index uses, rather than by searching back through the series for the nearest
   * earlier day. A search would be a scan per point, and this series is
   * twenty-five years of daily readings: the difference is one pass against
   * nine thousand of them.
   */
  const aligned = alignIndex(
    ordered,
    ordered.map((point) => shiftDate(point.date, -windowDays)),
  );

  const out: MacroPoint[] = [];
  for (const point of ordered) {
    const past = aligned.get(shiftDate(point.date, -windowDays));
    if (!past || past <= 0) continue;
    out.push({
      date: point.date,
      value: ((point.value / past) ** (365 / windowDays) - 1) * 100,
    });
  }
  return out;
}

function shiftDate(date: string, days: number): string {
  const moved = new Date(`${date}T12:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/**
 * Splits the administered rate into the stretches where it held and the
 * stretches where it moved.
 *
 * This is the first thing computed and the thing everything else is qualified
 * by, because a figure that straddles a regime change is not a measurement of
 * either regime.
 *
 * A day is classified by whether the rate moved **at any point in the preceding
 * window**, not by whether it moved that morning. Classifying day by day looks
 * simpler and does not work: a managed rate holds still at weekends and on
 * holidays, so a moving stretch comes out as scores of one-day runs alternating
 * with one-day pauses, and any rule that then absorbs the short runs folds the
 * whole history into whichever regime came first. Asking the wider question
 * instead — has this rate moved lately — gives the two stretches the series
 * actually contains.
 *
 * The window has a visible consequence worth stating: a rate that froze today
 * is not called fixed until it has been still for the whole window. That is the
 * right way round. Calling a peg on the first quiet Saturday would be the error
 * this is built to avoid.
 */
export function detectRegimes(official: readonly MacroPoint[], windowDays = 30): RegimeSegment[] {
  const ordered = [...official].sort((left, right) => left.date.localeCompare(right.date));
  if (ordered.length < 2) return [];

  /*
   * Dates on which the rate changed, in order. Both series are sorted, so the
   * window is answered by advancing one cursor over this list rather than by
   * rescanning it per day.
   */
  const movedOn = ordered
    .slice(1)
    .filter(
      (point, index) =>
        Math.abs(point.value - (ordered[index]?.value ?? point.value)) > MOVE_THRESHOLD,
    )
    .map((point) => point.date);

  let lastMove: string | null = null;
  let cursor = 0;
  const marked = ordered.map((point) => {
    while (cursor < movedOn.length && (movedOn[cursor] ?? '') <= point.date) {
      lastMove = movedOn[cursor] ?? lastMove;
      cursor += 1;
    }
    return { ...point, moving: lastMove !== null && lastMove > shiftDate(point.date, -windowDays) };
  });

  const runs: Array<{ moving: boolean; points: typeof marked }> = [];
  for (const point of marked) {
    const current = runs.at(-1);
    if (current && current.moving === point.moving) current.points.push(point);
    else runs.push({ moving: point.moving, points: [point] });
  }

  return runs.map((run) => {
    const from = run.points.at(0)?.date ?? '';
    const to = run.points.at(-1)?.date ?? '';
    return {
      regime: run.moving ? 'EN_MOVIMIENTO' : 'FIJO',
      from,
      to,
      days: spanDays(from, to),
      rateFrom: run.points.at(0)?.value ?? 0,
      rateTo: run.points.at(-1)?.value ?? 0,
    };
  });
}

function spanDays(from: string | undefined, to: string | undefined): number {
  if (!from || !to) return 0;
  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

export interface GapReading {
  date: string;
  gapPercent: number;
}

export interface GapProfile {
  current: GapReading | null;
  peak: GapReading | null;
  /** Days the administered rate sat above the market one. */
  daysInverted: number;
  observations: number;
}

/**
 * What the gap did over the whole period, not just today.
 *
 * The peak is reported beside the current level because a gap of eight per cent
 * reads as calm on its own and as a collapse from a hundred and fifty-eight
 * beside its own maximum. The inverted days are counted because an administered
 * rate quoted above the market is the sign that the correction overshot, and a
 * single figure for the gap hides them behind a small average.
 */
export function gapProfile(gap: readonly GapReading[]): GapProfile {
  if (!gap.length) return { current: null, peak: null, daysInverted: 0, observations: 0 };
  const ordered = [...gap].sort((left, right) => left.date.localeCompare(right.date));
  return {
    current: ordered.at(-1) ?? null,
    peak: ordered.reduce((best, point) => (point.gapPercent > best.gapPercent ? point : best)),
    daysInverted: ordered.filter((point) => point.gapPercent < 0).length,
    observations: ordered.length,
  };
}

/** Turns the report's daily points into the shape this module works on. */
export function toMacroPoints(series: readonly Observation[]): MacroPoint[] {
  return series.map((point) => ({ date: point.date, value: point.value }));
}

/* El resumen y su lectura viven aparte; se reexportan aquí porque este es el
 * módulo que el resto del informe conoce por su nombre. */
export type {
  ConclusionTone,
  FxConclusion,
  FxMacroInput,
  FxSnapshot,
  StablecoinInput,
  StablecoinReading,
} from './fx-snapshot';
export { fxSnapshot, stablecoinPremium } from './fx-snapshot';

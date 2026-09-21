import 'server-only';

import { officialSeries, readGap, readObservatory, readStablecoins } from './series';
import type { StablecoinSeries } from './series';
import { toMacroPoints, type MacroPoint } from './fx-macro';
import { fxSnapshot, type FxSnapshot } from './fx-snapshot';

/**
 * One reading of the exchange rate, for every surface that shows it.
 *
 * It exists so the front page, the exchange-rate panel and the printed report
 * cannot disagree. They were each deriving their own figures from overlapping
 * queries, which is how two tabs of the same report end up stating different
 * gaps for the same day — not through a bug, but because "the parallel rate"
 * has several defensible definitions and nothing forced them to pick one.
 *
 * The reads underneath are the ones the page already performs and they are held
 * in memory for five minutes each, so calling this from a second place costs a
 * map lookup rather than another pass over the evidence.
 */
export async function readFxSnapshot(): Promise<FxSnapshot> {
  const [observatory, gap, stablecoins] = await Promise.all([
    readObservatory(),
    readGap(),
    readStablecoins(),
  ]);

  return fxSnapshot({
    official: toMacroPoints(
      officialSeries(observatory).map((point) => ({
        date: point.date,
        value: point.value,
        aggregation: point.aggregation,
      })),
    ),
    parallelMid: parallelMidSeries(observatory.series),
    ufv: toMacroPoints(
      (observatory.series.get('UFV_BOB') ?? []).map((point) => ({
        date: point.date,
        value: point.value,
        aggregation: point.aggregation,
      })),
    ),
    gap: gap.map((point) => ({ date: point.date, gapPercent: point.gapPercent })),
    stablecoins: stablecoins.map(toStablecoinInput),
  });
}

/**
 * The mid-point of the two sides the source publishes for the parallel rate.
 *
 * Derived here rather than taken from one side because the source's `buy` and
 * `sell` labels swap order halfway through the series, so neither side is a
 * stable definition of "the parallel rate" while the mid-point is unaffected by
 * the swap. The same choice the gap view makes in the database, for the same
 * reason.
 */
function parallelMidSeries(
  series: Map<string, Array<{ date: string; value: number }>>,
): MacroPoint[] {
  const sell = new Map(
    (series.get('FX_PARALLEL_USD_BOB:SELL') ?? []).map((point) => [point.date, point.value]),
  );
  return (series.get('FX_PARALLEL_USD_BOB:BUY') ?? []).flatMap((point) => {
    const other = sell.get(point.date);
    return other === undefined ? [] : [{ date: point.date, value: (point.value + other) / 2 }];
  });
}

function toStablecoinInput(entry: StablecoinSeries) {
  return {
    token: entry.token,
    sidesResolved: entry.sidesResolved,
    points: entry.points.map((point) => ({
      date: point.date,
      mid: point.mid,
      bid: point.bid,
      ask: point.ask,
      venues: point.venues,
    })),
  };
}

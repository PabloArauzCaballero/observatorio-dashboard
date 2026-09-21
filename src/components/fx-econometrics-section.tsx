import { FxEconometricsPanel } from './fx-econometrics-panel';
import { officialSeries, readGap, readObservatory } from '@/lib/series';
import { detectRegimes, realIndex, toMacroPoints } from '@/lib/fx-macro';
import type { MacroPoint } from '@/lib/fx-macro';
import { fxEconometrics } from '@/lib/fx-econometrics';
import { econometricConclusions } from '@/lib/fx-econometrics-reading';

/**
 * The econometric chapter, assembled where the data lives.
 *
 * Reads the same series the exchange-rate chapter already read — each read is
 * held for five minutes, so this costs a map lookup — and hands the client
 * panel a result it can only display. The arithmetic runs here on purpose:
 * a GARCH likelihood over eight hundred days is a few hundred passes and
 * belongs on the server, not in every visitor's browser.
 */
export async function FxEconometricsSection() {
  const observatory = await readObservatory();
  const gap = await readGap();

  const official = toMacroPoints(
    officialSeries(observatory).map((point) => ({
      date: point.date,
      value: point.value,
      aggregation: point.aggregation,
    })),
  );
  const buy = observatory.series.get('FX_PARALLEL_USD_BOB:BUY') ?? [];
  const sellByDate = new Map(
    (observatory.series.get('FX_PARALLEL_USD_BOB:SELL') ?? []).map((point) => [
      point.date,
      point.value,
    ]),
  );
  const parallelMid: MacroPoint[] = buy.flatMap((point) => {
    const other = sellByDate.get(point.date);
    return other === undefined ? [] : [{ date: point.date, value: (point.value + other) / 2 }];
  });
  const ufv: MacroPoint[] = (observatory.series.get('UFV_BOB') ?? []).map((point) => ({
    date: point.date,
    value: point.value,
  }));
  if (parallelMid.length < 60) return null;

  const regimes = detectRegimes(official);
  const base = parallelMid[0]?.date;
  const realParallel = base ? realIndex(parallelMid, ufv, base) : [];

  const result = fxEconometrics({
    official,
    parallelMid,
    ufv,
    gap: gap.map((point) => ({ date: point.date, gapPercent: point.gapPercent })),
    regimes,
    realParallel,
  });

  return <FxEconometricsPanel result={result} conclusions={econometricConclusions(result)} />;
}

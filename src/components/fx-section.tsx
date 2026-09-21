import { FxExplorer } from './fx-explorer';
import { FxMacroPanels } from './fx-macro-panels';
import type { RatePoint } from './charts';
import { officialSeries, readObservatory, readStablecoins } from '@/lib/series';
import type { Observatory } from '@/lib/series';
import { realIndex, toMacroPoints } from '@/lib/fx-macro';
import type { MacroPoint } from '@/lib/fx-macro';
import { readFxSnapshot } from '@/lib/fx-reader';
import type { Observation } from '@/lib/econometrics';

/**
 * The whole exchange-rate chapter, assembled where the data lives.
 *
 * It takes no props on purpose. The front page used to compute the rate series,
 * the official observations and the reading count and hand them down, which
 * meant the page owned the shape of an analysis it does not perform — and any
 * new figure this section needed became an edit to the page. Now the page renders
 * one element and this reads what it needs.
 *
 * The reads are the ones the page already performs and each is held in memory
 * for five minutes, so calling them again here costs a map lookup rather than
 * another pass over a million and a half observations.
 */
export async function FxSection() {
  /*
   * En serie y no en paralelo, a propósito. El resumen ya lee el observatorio,
   * la brecha y las fichas, y todas las lecturas se sostienen cinco minutos:
   * pedirlas primero deja las de abajo resueltas desde memoria. Lanzadas a la
   * vez, la primera visita tras vencer el plazo dispara la consulta de fichas
   * —la más cara de la página— dos veces al mismo tiempo, y en el servidor
   * chico eso bastaba para que la brecha no entrara en su plazo.
   */
  const snapshot = await readFxSnapshot();
  const [observatory, stablecoins] = await Promise.all([readObservatory(), readStablecoins()]);

  const official = officialSeries(observatory);
  const buy = observatory.series.get('FX_PARALLEL_USD_BOB:BUY') ?? [];
  const sell = observatory.series.get('FX_PARALLEL_USD_BOB:SELL') ?? [];
  const ufv = toMacroPoints(asObservations(observatory.series.get('UFV_BOB') ?? []));

  const parallelMid = midSeries(buy, sell);
  const base = parallelMid.at(0)?.date;
  const realParallel = base ? realIndex(parallelMid, ufv, base) : [];

  /*
   * Las fichas, sobre la misma ventana que el oficial y el paralelo.
   *
   * El archivo no registró el instrumento hasta 2026, así que la serie por ficha
   * empieza ahí y dibujada sola arrancaba dos años después que las otras dos
   * líneas del capítulo. Lo que el archivo sí tiene antes de esa fecha es el
   * paralelo, y el paralelo es USDT: son las mismas plazas cotizando la misma
   * ficha, solo que sin que nadie escribiera su nombre en la lectura. La línea
   * de USDT se empalma con el punto medio del paralelo hasta el día en que la
   * lectura por instrumento existe; de ahí en adelante es la ficha leída, y la
   * franja sombreada marca dónde pasa una cosa a ser la otra.
   *
   * Ninguna otra ficha se empalma. USDC no estaba en ese archivo bajo ningún
   * nombre, y prolongarla hacia atrás con el paralelo sería inventarle historia.
   */
  const labelled = stablecoins.find((entry) => entry.token === 'USDT')?.points.at(0)?.date;
  const tokens = stablecoins.map((entry) => {
    const own = entry.points.map((point) => ({ date: point.date, value: point.mid }));
    const spliced =
      entry.token === 'USDT' && labelled
        ? [...parallelMid.filter((point) => point.date < labelled), ...own]
        : own;
    return { token: entry.token, points: spliced };
  });

  return (
    <>
      <FxMacroPanels
        snapshot={snapshot}
        realParallel={realParallel}
        tokens={tokens}
        labelledFrom={labelled}
      />
      <FxExplorer
        rows={buildRateSeries(observatory, official)}
        official={asObservations(official)}
        readingCount={observatory.readingCount}
      />
    </>
  );
}

type DailyPoints = NonNullable<ReturnType<Observatory['series']['get']>>;

function asObservations(points: DailyPoints): Observation[] {
  return points.map((point) => ({
    date: point.date,
    value: point.value,
    aggregation: point.aggregation,
  }));
}

/** Mid-point of the two published sides, which no relabelling can move. */
function midSeries(buy: DailyPoints, sell: DailyPoints): MacroPoint[] {
  const sellByDate = new Map(sell.map((point) => [point.date, point.value]));
  return buy.flatMap((point) => {
    const other = sellByDate.get(point.date);
    return other === undefined ? [] : [{ date: point.date, value: (point.value + other) / 2 }];
  });
}

/**
 * The rows the level chart draws: both published sides and the official rate.
 *
 * The same construction the front page performed, kept identical in behaviour
 * so the chart does not change shape because of where it is now assembled. Two
 * details carry over deliberately.
 *
 * The official line is withheld unless there are at least two of its points,
 * because a single point draws no line and an axis fitted around it distorts
 * the market series it shares the frame with.
 *
 * `archived` marks a day whose figure is a daily average rather than a reading
 * taken at a moment. They are different statistics and the chart says which it
 * is drawing rather than splicing them silently.
 */
function buildRateSeries(observatory: Observatory, allOfficial: DailyPoints): RatePoint[] {
  const buy = observatory.series.get('FX_PARALLEL_USD_BOB:BUY') ?? [];
  const sell = observatory.series.get('FX_PARALLEL_USD_BOB:SELL') ?? [];
  const official = allOfficial.length >= 2 ? allOfficial : [];

  const byDate = new Map<string, RatePoint & { archived?: boolean }>();
  const at = (date: string): RatePoint & { archived?: boolean } =>
    byDate.get(date) ?? { date, archived: false };

  for (const point of buy) {
    byDate.set(point.date, {
      ...at(point.date),
      parallelBuy: point.value,
      archived: at(point.date).archived || point.aggregation === 'DAILY_AVERAGE',
    });
  }
  for (const point of sell) {
    byDate.set(point.date, {
      ...at(point.date),
      parallelSell: point.value,
      archived: at(point.date).archived || point.aggregation === 'DAILY_AVERAGE',
    });
  }
  for (const point of official) {
    byDate.set(point.date, {
      ...at(point.date),
      official: point.value,
      archived: at(point.date).archived || point.aggregation === 'DAILY_AVERAGE',
    });
  }

  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

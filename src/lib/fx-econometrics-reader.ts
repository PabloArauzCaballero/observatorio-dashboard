import 'server-only';
import { held } from './hold';
import { officialSeries, readGap, readObservatory } from './series';
import { assembleEconometrics, econometricsReport, reportFileName } from './fx-econometrics-report';

/**
 * El informe econométrico del tipo de cambio, armado una vez y sostenido.
 *
 * Un GARCH por máxima verosimilitud sobre ochocientas jornadas son unos
 * cientos de pasadas, y un lector que no ve arrancar la descarga pulsa otra
 * vez. Se sostiene **el documento ya compuesto** —unos kilobytes— bajo la
 * misma regla que las demás lecturas (`hold.ts`): el corpus solo cambia
 * cuando el recolector publica, y diez clics seguidos esperan un cálculo en
 * vez de lanzar diez.
 *
 * Lee las mismas dos lecturas que el capítulo —el observatorio y la brecha—, y
 * esas ya están sostenidas, así que tras abrir la pestaña esto no toca la base.
 * En serie y no en paralelo, por la misma razón que `FxSection`: la brecha
 * puede derivarse del observatorio si la vista no responde, y pedirlo primero
 * la deja resuelta desde memoria.
 */
export interface EconometricsDocument {
  bytes: Uint8Array<ArrayBuffer>;
  fileName: string;
  asOf: string | null;
}

export function readEconometricsReport(): Promise<EconometricsDocument | null> {
  return held('econometricsReport', buildEconometricsReport);
}

async function buildEconometricsReport(): Promise<EconometricsDocument | null> {
  const observatory = await readObservatory();
  const gap = await readGap();
  const plain = (key: string) =>
    (observatory.series.get(key) ?? []).map((point) => ({ date: point.date, value: point.value }));

  const result = assembleEconometrics({
    official: officialSeries(observatory).map((point) => ({
      date: point.date,
      value: point.value,
    })),
    parallelBuy: plain('FX_PARALLEL_USD_BOB:BUY'),
    parallelSell: plain('FX_PARALLEL_USD_BOB:SELL'),
    ufv: plain('UFV_BOB'),
    gap: gap.map((point) => ({ date: point.date, gapPercent: point.gapPercent })),
  });
  if (!result) return null;
  return { bytes: econometricsReport(result), fileName: reportFileName(result), asOf: result.asOf };
}

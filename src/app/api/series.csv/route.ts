import { readObservatory } from '@/lib/series';

/**
 * The whole series as a file.
 *
 * An analyst who is shown a chart will want the numbers behind it, and the
 * alternative to offering them is being asked for them. Every row states how it
 * was measured, so the file cannot be read as one homogeneous series when it is
 * not.
 */

export const dynamic = 'force-dynamic';

const HEADER = 'fecha,indicador,lado,agregacion,valor,unidad,dispersion,plazas,variacion_pct';

const UNITS: Record<string, string> = {
  FX_OFFICIAL_USD_BOB: 'BOB/USD',
  FX_PARALLEL_USD_BOB: 'BOB/USD',
  UFV_BOB: 'BOB/UFV',
};

export async function GET(): Promise<Response> {
  try {
    const observatory = await readObservatory();
    const lines = [HEADER];

    for (const [key, points] of observatory.series) {
      const [indicator = key, side = ''] = key.split(':');
      for (const point of points) {
        lines.push(
          [
            point.date,
            indicator,
            side,
            point.aggregation,
            point.value,
            UNITS[indicator] ?? '',
            point.spread ?? '',
            point.venues ?? '',
            point.changePercent ?? '',
          ].join(','),
        );
      }
    }

    return new Response(`${lines.join('\n')}\n`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="observatorio-series.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new Response(
      `No fue posible leer la serie: ${error instanceof Error ? error.message : 'error desconocido'}\n`,
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }
}

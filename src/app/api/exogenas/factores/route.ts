import { readFactorHistory, readFactorSeries } from '@/lib/exogenous-factors';
import {
  FactorQueryError,
  FactorHistoryCompatibilityError,
  factorCsv,
  historyQuery,
} from '@/lib/exogenous-factor-query';
import { freeCut, freeCutNote } from '@/lib/plans';
import { jsonResponse } from '@/lib/respond';
export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    if (!params.has('series')) {
      if (params.get('family') && !/^[A-Z][A-Z0-9_]{1,100}$/.test(params.get('family')!))
        throw new FactorQueryError('Familia no válida.');
      if (params.get('sector') && !/^[A-U]$/.test(params.get('sector')!))
        throw new FactorQueryError('Sector no válido.');
      return jsonResponse(request, await readFactorSeries(params), {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }
    const csv = params.get('format') === 'csv';
    const result = await readFactorHistory(historyQuery(params), csv);
    if (!result) return Response.json({ error: 'Serie no encontrada.' }, { status: 404 });
    if (csv) {
      // Sin un plan, los quinientos puntos más recientes, y el archivo lo avisa.
      const cut = freeCut(result.points, 'cola');
      const warnings = cut.recortado ? [freeCutNote(cut.total), ...result.warnings] : result.warnings;
      return new Response(factorCsv(result.series, cut.filas, result.asOf, warnings), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${result.series.code}.csv"`,
          'Cache-Control': 'no-store',
          'X-Data-Warnings': encodeURIComponent(warnings.join(' ')),
        },
      });
    }
    return jsonResponse(request, result, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (error) {
    const invalid = error instanceof FactorQueryError;
    const incompatible = error instanceof FactorHistoryCompatibilityError;
    const limit = error instanceof Error && error.message === 'EXPORT_LIMIT';
    return Response.json(
      {
        error:
          invalid || incompatible
            ? error.message
            : limit
              ? 'La descarga supera 20.000 puntos; reduce el rango.'
              : 'No se pudieron consultar los factores económicos.',
      },
      { status: invalid ? 400 : incompatible ? 409 : limit ? 413 : 503 },
    );
  }
}

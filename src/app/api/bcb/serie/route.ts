import { readBcbSeries } from '@/lib/bcb';
import { isUnaffordableRead } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * Los puntos de las series elegidas (hasta ocho), con de dónde salió cada una.
 *
 * `codigos` va separado por comas. Solo estas series se desempaquetan: abrir un
 * gráfico no toca las otras doce mil.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const codes = (new URL(request.url).searchParams.get('codigos') ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter((code) => /^BCB_[A-Z0-9_]{1,115}$/u.test(code));
  try {
    return jsonResponse(
      request,
      { series: await readBcbSeries(codes) },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    console.error('[observatorio] serie del BCB ilegible', error);
    return Response.json(
      { error: 'No se pudo leer la serie' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

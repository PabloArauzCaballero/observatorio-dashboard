import { readBusinessAnnual } from '@/lib/business-annual';
import { buildOwnersBoard } from '@/lib/business-owners-board';
import { jsonResponse } from '@/lib/respond';
import { isUnaffordableRead } from '@/lib/series';

/**
 * Los empresarios y sus fortunas, pedidos al abrir su página de «Empresas».
 *
 * Lee dos rubros: el patrimonio de las empresas («Las 500», en el ránking) y
 * lo que el observatorio guarda de sus dueños y de la riqueza del país
 * (participaciones, Forbes, el impuesto a las grandes fortunas, múltiplos de
 * mercado). La estimación se arma aquí, al dibujar, como manda el ADR 0028
 * del núcleo: al corpus entran los insumos, nunca el producto.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const [ranking, fortunes] = await Promise.all([
      readBusinessAnnual('RANKING_EMPRESARIAL'),
      readBusinessAnnual('FORTUNAS'),
    ]);
    return jsonResponse(
      request,
      { board: buildOwnersBoard(ranking, fortunes) },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] empresarios ilegibles', error);
    return Response.json(
      { error: 'No se pudo leer el registro de empresarios' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

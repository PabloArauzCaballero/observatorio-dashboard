import { readBankAssets } from '@/lib/bank-assets';
import { isUnaffordableRead } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * Los bancos que ofrecen dólar digital, pedidos al abrir «Tipo de cambio».
 *
 * Nunca se leen en la portada: la única llamada es la de `useOnOpen` cuando el
 * panel se monta. Son diez series y unos cientos de puntos, y van de una vez.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    return jsonResponse(
      request,
      { board: await readBankAssets() },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] bancos con dólar digital ilegibles', error);
    return Response.json(
      { error: 'No se pudieron leer los bancos con dólar digital' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

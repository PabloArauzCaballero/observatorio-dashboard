import {
  ENVIRONMENT_CODES,
  ENVIRONMENT_PLACE_CODES,
  buildEnvironmentBoard,
} from '@/lib/environment-board';
import { isUnaffordableRead, readWorldBoard } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * El capítulo ambiental, pedido al abrir su rubro.
 *
 * Veintisiete series del panel para ocho países. La lectura está sostenida en
 * memoria con una clave que lleva los códigos pedidos, así que este tablero no
 * se pisa con el energético ni con el de recursos aunque compartan alguna
 * serie.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const points = await readWorldBoard(ENVIRONMENT_CODES, ENVIRONMENT_PLACE_CODES);
    return jsonResponse(
      request,
      { board: buildEnvironmentBoard(points) },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] capitulo ambiental ilegible', error);
    return Response.json(
      { error: 'No se pudo leer el capítulo de medio ambiente' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

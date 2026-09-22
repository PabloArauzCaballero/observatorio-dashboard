import { RESOURCE_CODES, RESOURCE_PLACE_CODES, buildResourceBoard } from '@/lib/resources-board';
import { isUnaffordableRead, readWorldBoard } from '@/lib/series';

/**
 * El capítulo de recursos naturales, pedido al abrir su rubro.
 *
 * Mismo trato que la matriz energética: una consulta por los códigos y lugares
 * que el tablero nombra, y lo que viaja al navegador es el tablero ya armado y
 * no las treinta mil filas del panel que lo arman.
 *
 * Se pide al abrirlo y no antes. Es un rubro de la lista de la izquierda de una
 * de siete pestañas: la mayoría de las visitas no lo abre nunca, y una consulta
 * que corre en cada carga de la portada para nadie es la que hacía que el
 * informe tardara veinte segundos en decir la primera palabra.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const points = await readWorldBoard(RESOURCE_CODES, RESOURCE_PLACE_CODES);
    return Response.json(
      { board: buildResourceBoard(points) },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] capitulo de recursos ilegible', error);
    return Response.json(
      { error: 'No se pudo leer el capítulo de recursos naturales' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

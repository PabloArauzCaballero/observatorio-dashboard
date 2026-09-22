import { RESOURCE_CODES, RESOURCE_PLACE_CODES, buildResourceBoard } from '@/lib/resources-board';
import { isUnaffordableRead, readMacroAnnual, readWorldBoard } from '@/lib/series';

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
 *
 * Dos lecturas y no una porque el capítulo tiene dos corpus: el panel del Banco
 * Mundial dice cuánto deja el subsuelo y con qué se compara en la región, y las
 * series medidas traen la declaración aduanera partida por partida —de ahí sale
 * el litio—. Las dos están sostenidas en memoria y las comparte con el panel de
 * medidas, así que abrir este rubro no cuesta una consulta nueva.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const [points, measured] = await Promise.all([
      readWorldBoard(RESOURCE_CODES, RESOURCE_PLACE_CODES),
      readMacroAnnual(),
    ]);
    return Response.json(
      { board: buildResourceBoard(points, measured) },
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

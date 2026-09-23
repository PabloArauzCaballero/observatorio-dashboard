import { ENERGY_CODES, ENERGY_PLACE_CODES, buildEnergyBoard } from '@/lib/energy-board';
import { isUnaffordableRead, readWorldBoard } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * La matriz energética, pedida al abrir su rubro.
 *
 * El capítulo vivía en un componente de servidor dentro de la pestaña de
 * Macroeconomía, y ahí hacía su consulta en **cada** carga de la portada —esté
 * la pestaña abierta o no, porque un panel escondido se dibuja en el servidor
 * igual que uno visible—. Es el último rubro de la lista de la izquierda de una
 * de siete pestañas: la mayoría de las visitas no lo abre nunca.
 *
 * Lo que viaja es el tablero ya construido y no las filas que lo arman, que es
 * lo mismo que hacía el componente de servidor: el navegador recibe las cifras
 * del capítulo, no el panel entero del Banco Mundial.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const points = await readWorldBoard(ENERGY_CODES, ENERGY_PLACE_CODES);
    return jsonResponse(
      request,
      { board: buildEnergyBoard(points) },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] matriz energetica ilegible', error);
    return Response.json(
      { error: 'No se pudo leer la matriz energética' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

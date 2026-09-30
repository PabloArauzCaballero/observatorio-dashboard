import { buildDepartmentBoard } from '@/lib/departments-board';
import { isUnaffordableRead, readMacroAnnual } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * El capítulo departamental, pedido al abrir su rubro.
 *
 * Lee las mismas medidas anuales que el resto de «Macroeconomía» y se queda con
 * las que la vista marcó como `DEPARTAMENTAL`. Esa lectura está sostenida en
 * memoria y la comparten el panel de medidas y los rubros invitados, así que
 * abrir este no cuesta una consulta nueva.
 *
 * Lo que viaja es el tablero ya armado —doscientas series reducidas a lo que se
 * dibuja— y no las nueve mil filas de las que sale. Es la misma economía que
 * hacen los capítulos de energía y de recursos, por la misma razón: el navegador
 * no tiene por qué volver a recorrer un corpus para pintar cuatro figuras.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const macro = await readMacroAnnual();
    return jsonResponse(
      request,
      { board: buildDepartmentBoard(macro.filter((point) => point.sector === 'DEPARTAMENTAL')) },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] capitulo departamental ilegible', error);
    return Response.json(
      { error: 'No se pudo leer el capítulo departamental' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

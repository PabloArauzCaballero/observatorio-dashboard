import { buildInstitutionsBoard } from '@/lib/institutions-board';
import { packMacro } from '@/lib/macro-transport';
import { isUnaffordableRead, readMacroAnnual } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * Las medidas anuales de Bolivia, pedidas al abrir «Macroeconomía».
 *
 * Es la misma lectura que el resumen de «Hoy» usa para fechar cada cifra, y por
 * eso no es una consulta más: `readMacroAnnual` está sostenida en memoria, así
 * que esto reaprovecha la que la portada ya hizo. Lo que se ahorra no es la
 * consulta, es el peso —**442 KB** del documento, medidos el 2026-09-22— y el
 * trabajo de volver a analizar en el navegador nueve mil lecturas que sólo se
 * dibujan si alguien abre la pestaña.
 *
 * Sale empaquetado —catálogo aparte, lecturas como tuplas— por lo que explica
 * `macro-transport`: el nombre de una serie se repite una vez por año y esa
 * repetición era casi todo el archivo.
 *
 * El tablero de instituciones viaja con ellas porque se construye de estas
 * mismas filas —las del sector `INSTITUCIONAL`— y vive dentro de la misma
 * pestaña. Pedirlo aparte sería un segundo viaje por algo que ya está leído.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const macro = await readMacroAnnual();
    return jsonResponse(
      request,
      {
        bundle: packMacro(macro),
        institutions: buildInstitutionsBoard(
          macro.filter((point) => point.sector === 'INSTITUCIONAL'),
        ),
      },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] medidas anuales ilegibles', error);
    return Response.json(
      { error: 'No se pudieron leer las medidas anuales' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

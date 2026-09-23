import { buildExportersBoard } from '@/lib/exporters-board';
import { isUnaffordableRead, readMacroAnnual } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * Las exportadoras y su reputación, pedidas al abrir cualquiera de sus dos
 * páginas de «Empresas».
 *
 * Lee las medidas anuales y se queda con las que la vista marcó como
 * `EMPRESARIAL`: trescientas filas de las nueve mil. La lectura está sostenida
 * en memoria y la comparte con «Macroeconomía», así que abrir estas páginas no
 * añade una consulta.
 *
 * Una ruta para dos pestañas a propósito. «Exportadoras» y «Reputación
 * empresarial» se muestran aparte porque miden cosas distintas, pero el cruce
 * entre ambas —las pocas que están en las dos listas— se calcula aquí y
 * necesita las dos mitades, así que el cuerpo viaja entero y cada página toma
 * lo suyo. El `max-age` de diez minutos es lo que evita que pasar de una
 * pestaña a la otra vuelva a leer: la segunda sale de la caché del navegador.
 *
 * Aparte de los hechos relevantes a propósito. Aquello es el registro de la
 * Bolsa Boliviana de Valores —lo que sus emisores están obligados a comunicar—
 * y esto es comercio exterior y percepción; ninguna fila de uno explica una
 * fila del otro, y mezclarlos en un mismo panel sugeriría un vínculo que no
 * existe.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const macro = await readMacroAnnual();
    return jsonResponse(
      request,
      { board: buildExportersBoard(macro.filter((point) => point.sector === 'EMPRESARIAL')) },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] registro de exportadoras ilegible', error);
    return Response.json(
      { error: 'No se pudo leer el registro de exportadoras' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

import { buildExportersBoard } from '@/lib/exporters-board';
import { isUnaffordableRead, readMacroAnnual } from '@/lib/series';

/**
 * Las exportadoras y su reputación, pedidas al abrir su página de «Empresas».
 *
 * Lee las medidas anuales y se queda con las que la vista marcó como
 * `EMPRESARIAL`: trescientas filas de las nueve mil. La lectura está sostenida
 * en memoria y la comparte con «Macroeconomía», así que abrir esta página no
 * añade una consulta.
 *
 * Aparte de los hechos relevantes a propósito. Aquello es el registro de la
 * Bolsa Boliviana de Valores —lo que sus emisores están obligados a comunicar—
 * y esto es un ránking de comercio exterior con un monitor de reputación al
 * lado. Comparten pestaña porque las dos hablan de empresas y nada más; ninguna
 * fila de una explica una fila de la otra, y mezclarlas en un mismo panel
 * sugeriría un vínculo que no existe.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const macro = await readMacroAnnual();
    return Response.json(
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

import { readBusinessAnnual } from '@/lib/business-annual';
import { buildFabricBoard, withOfficialRecentClosures } from '@/lib/business-fabric-board';
import { jsonResponse } from '@/lib/respond';
import { isUnaffordableRead } from '@/lib/series';

/**
 * El tejido empresarial, pedido al abrir su página de «Empresas».
 *
 * Cuántas empresas tiene Bolivia por tipo societario, departamento y actividad
 * desde 2008, quién las encabeza, de qué tamaño se declaran y cómo se reparte el
 * padrón de Impuestos. Unas seis mil lecturas que cambian una vez al año: diez
 * minutos de caché en el navegador bastan para que moverse entre pestañas no
 * vuelva a pedirlas.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const points = await readBusinessAnnual('TEJIDO_EMPRESARIAL');
    const board = buildFabricBoard(withOfficialRecentClosures(points));
    board.sources.FIRMS_CANCELLED = {
      publisher: 'FUNDEMPRESA y Servicio Plurinacional de Registro de Comercio (SEPREC)',
      url: 'https://www.seprec.gob.bo/wp-content/uploads/2025/10/Memoria_ANUAL-2023.pdf',
    };
    return jsonResponse(
      request,
      { board },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] tejido empresarial ilegible', error);
    return Response.json(
      { error: 'No se pudo leer el tejido empresarial' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

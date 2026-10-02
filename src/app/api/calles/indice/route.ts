import { jsonResponse } from '@/lib/respond';
import { readStreetIndex } from '@/lib/street-cells';

/**
 * Cada nombre de calle que OpenStreetMap da a una ciudad, con sus km y su caja.
 *
 * Es lo que busca el buscador sin bajar ninguna geometría: ~19.000 nombres, unos
 * 3,4 MB que en brotli son una quinta parte. Se pide cuando la tabla de calles entra
 * en pantalla, no al abrir la pestaña.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    return jsonResponse(
      request,
      { streets: await readStreetIndex() },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    console.error('[observatorio] índice de calles ilegible', error);
    return Response.json({ error: 'No se pudo leer el índice de calles' }, { status: 500 });
  }
}

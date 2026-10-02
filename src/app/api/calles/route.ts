import { jsonResponse } from '@/lib/respond';
import { cellsInBox, readStreetCells } from '@/lib/street-cells';
import type { LonLatBox } from '@/lib/street-types';

/**
 * Las calles de las ciudades que cruzan una pantalla: `?bbox=minLon,minLat,maxLon,maxLat`.
 *
 * Se pide sólo al acercar el mapa de carreteras hasta una ciudad; nunca en la portada
 * ni al abrir la pestaña. Devuelve las celdas (~2,2 km de lado) cuya caja cruza la
 * vista, las más cercanas al centro primero y no más de `MAX_CELLS`: si hay más, lo
 * dice (`truncated`) y el mapa no finge que dibujó todo.
 */

export const dynamic = 'force-dynamic';

const MAX_CELLS = 300;
/** Bolivia, con aire: una caja fuera de aquí no tiene nada que leer. */
const COUNTRY: LonLatBox = [-70.5, -23.5, -57, -9];
/** Lo más ancho que se atiende, en grados: una ciudad y su entorno, no un departamento. */
const MAX_SPAN = 1.2;

function parseBox(text: string | null): LonLatBox | null {
  const parts = (text ?? '').split(',').map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
  const [minLon, minLat, maxLon, maxLat] = parts as LonLatBox;
  if (minLon >= maxLon || minLat >= maxLat) return null;
  if (maxLon - minLon > MAX_SPAN || maxLat - minLat > MAX_SPAN) return null;
  if (maxLon < COUNTRY[0] || minLon > COUNTRY[2] || maxLat < COUNTRY[1] || minLat > COUNTRY[3]) return null;
  return [minLon, minLat, maxLon, maxLat];
}

export async function GET(request: Request): Promise<Response> {
  const box = parseBox(new URL(request.url).searchParams.get('bbox'));
  if (!box) {
    return Response.json({ error: 'bbox debe ser minLon,minLat,maxLon,maxLat dentro de Bolivia' }, { status: 400 });
  }
  try {
    const { ids, truncated } = await cellsInBox(box, MAX_CELLS);
    const cells = await readStreetCells(ids);
    return jsonResponse(
      request,
      { cells, truncated },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] calles ilegibles', error);
    return Response.json({ error: 'No se pudieron leer las calles' }, { status: 500 });
  }
}

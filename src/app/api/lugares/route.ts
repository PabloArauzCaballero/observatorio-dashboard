import { readPlaces } from '@/lib/places';
import { jsonResponse } from '@/lib/respond';

/**
 * The places of the chosen cities, fetched when the reader chooses them.
 *
 * The family counts travel with the page because a chooser is useless without
 * them. The places do not: twenty-six thousand of them with a name, a position
 * and an address apiece is several megabytes, and a reader looks at one city —
 * usually one family — at a time.
 *
 * Ciudad y familia llegan separadas por coma, porque el mapa deja sumar varias
 * con Ctrl+clic. Sin ciudad no hay respuesta: el mapa dibuja un recorte, no el
 * país entero.
 */

export const dynamic = 'force-dynamic';

/** Las categorías de una dimensión tal como viajan: separadas por coma. */
function many(raw: string | null, limit: number): string[] {
  if (!raw) return [];
  const values = raw
    .split(',')
    .map((one) => one.trim().slice(0, 60))
    .filter((one) => one.length > 0);
  return [...new Set(values)].slice(0, limit);
}

export async function GET(request: Request): Promise<Response> {
  const parameters = new URL(request.url).searchParams;
  /*
   * El tope de ciudades no es una formalidad: cada una suma sus lugares al
   * mismo recorte, y este tablero comparte servidor con otros.
   */
  const cities = many(parameters.get('ciudad'), 12);
  if (cities.length === 0) {
    return Response.json({ error: 'Falta la ciudad' }, { status: 400 });
  }

  try {
    const families = many(parameters.get('familia'), 60);
    /*
     * El mapa pide cuatro mil y el lector puede pedir el resto. No se sirve
     * todo por defecto porque son varios megas en cada cambio de ciudad, y este
     * tablero comparte servidor.
     */
    const all = parameters.get('todos') === '1';
    const { places, total } = await readPlaces(cities, families, all ? 20000 : 4000);
    /*
     * Comprimido aquí y sostenido diez minutos en el navegador, como las demás
     * rutas de pestaña. Una ciudad grande son 1,5 MB de JSON: en pablo-h310
     * viajaban en crudo, y el lector que vuelve a una ciudad que ya miró —el
     * mapa se remonta en cada cambio de pestaña— la volvía a pedir entera.
     */
    return jsonResponse(
      request,
      { places, total },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // The message can carry the host, the user and the port. It belongs in the
    // log, not in a response served to the public.
    console.error('[observatorio] lugares ilegibles', error);
    return Response.json({ error: 'No se pudieron leer los lugares' }, { status: 500 });
  }
}

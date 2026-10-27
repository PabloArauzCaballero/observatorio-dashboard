import { HOUR_MS, admit, clientIp, remaining, spend } from '@/lib/ip-limit';
import { readPlaces } from '@/lib/places';
import { FREE_MAP_PER_HOUR, FREE_MAP_PLACES_PER_HOUR, MAP_VIEW_CAP, SERVICES_PATH } from '@/lib/plans';
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

  /*
   * Ver el mapa es libre; copiarlo entero con un script, no. Ciento veinte
   * vistas por hora son muchas más de las que hace una persona cambiando de
   * ciudad y de familia, y muchas menos de las que hacen falta para recorrer
   * las setenta y dos mil fichas.
   */
  const ip = clientIp(request);
  const admission = admit('lugares', ip, FREE_MAP_PER_HOUR, HOUR_MS);
  /*
   * Contar pedidos no alcanza: cuatro mil por pedido, el tope de pedidos
   * dejaba llevarse la base varias veces por hora. Se cuentan también los
   * lugares servidos.
   */
  const presupuesto = remaining('lugares-filas', ip, FREE_MAP_PLACES_PER_HOUR, HOUR_MS);
  if (!admission.ok || presupuesto === 0) {
    return Response.json(
      {
        error: 'Se alcanzó el límite de consultas al mapa por hora. Con un plan de DatosBolivia.com el mapa no tiene ese límite.',
        servicios: SERVICES_PATH,
      },
      { status: 429, headers: { 'Retry-After': String(admission.ok ? 900 : admission.retryAfter) } },
    );
  }

  /*
   * «Dibujar todos» era la puerta para bajarse una ciudad entera sin pasar por
   * la descarga. Ahora es parte de los planes: sin uno, la respuesta lo dice en
   * vez de servir un recorte que parezca completo.
   */
  if (parameters.get('todos') === '1') {
    return Response.json(
      {
        error: 'Ver todos los lugares de una selección grande es parte de los planes de DatosBolivia.com.',
        servicios: SERVICES_PATH,
      },
      { status: 402 },
    );
  }

  try {
    const families = many(parameters.get('familia'), 60);
    /*
     * El mapa pide cuatro mil: son varios megas en cada cambio de ciudad, y
     * este tablero comparte servidor.
     */
    // Reservado antes de esperar la base, en el mismo paso que la consulta del saldo.
    const reserva = Math.min(MAP_VIEW_CAP, presupuesto);
    spend('lugares-filas', ip, reserva, HOUR_MS);
    let servidos = 0;
    const { places, total } = await readPlaces(cities, families, reserva).finally(() => {
      spend('lugares-filas', ip, servidos - reserva, HOUR_MS);
    });
    servidos = places.length;
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

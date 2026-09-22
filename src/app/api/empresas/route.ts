import { isUnaffordableRead, readCompanyFilings } from '@/lib/series';

/**
 * Los hechos relevantes, pedidos al abrir su pestaña.
 *
 * Mil comunicados **con su texto completo**: 1,43 MB del documento de la
 * portada, medidos el 2026-09-22 sobre el informe que servía `test`. La pestaña
 * de Empresas es la cuarta de siete y la mayoría de las visitas no llega a
 * abrirla, así que ese peso viajaba —y se serializaba, y se volvía a analizar en
 * el navegador— para nada.
 *
 * Es el mismo patrón que ya seguían «Social Info» y «Economía mundial», por la
 * misma razón y con la misma cabecera: el recolector publica tres veces al día,
 * así que un navegador que sale de la pestaña y vuelve puede quedarse diez
 * minutos con lo que ya tiene en vez de preguntar otra vez. Las pestañas se
 * vuelven a montar en cada cambio, y cada montaje sería si no una lectura nueva.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    return Response.json(
      { filings: await readCompanyFilings() },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto. Va al
    // registro, no a una respuesta servida al público.
    console.error('[observatorio] hechos relevantes ilegibles', error);
    /*
     * Un plazo agotado no es lo mismo que una base caída, y el navegador tiene
     * que poder decir cuál de las dos fue: la portada perdona la primera y
     * nombra la sección, y con un 500 a secas no podría distinguirlas.
     */
    return Response.json(
      { error: 'No se pudieron leer los hechos relevantes' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

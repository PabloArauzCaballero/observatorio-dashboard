import { isUnaffordableRead, readTermMonths, readTermTotals } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * Los temas de prensa mes a mes, pedidos al abrir su subpestaña.
 *
 * **1,85 MB: la sección más pesada del informe**, medida el 2026-09-22 sobre lo
 * que servía `test`. Ocho mil doscientas filas —un término, un mes y seis
 * recuentos de tono— que además viven dentro de una subpestaña: para verlas hay
 * que abrir «Prensa» y después «Temas», dos clics que casi ninguna visita da, y
 * el peso viajaba en todas.
 *
 * Los dos recuentos salen juntos porque el explorador necesita los dos a la vez:
 * los meses dibujan la serie y los totales ordenan la lista de la izquierda.
 * Pedirlos en dos viajes sólo pondría media pantalla antes que la otra.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const [months, totals] = await Promise.all([readTermMonths(), readTermTotals()]);
    return jsonResponse(
      request,
      { months, totals },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] temas de prensa ilegibles', error);
    return Response.json(
      { error: 'No se pudieron leer los temas de prensa' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

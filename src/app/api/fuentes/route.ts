import { isUnaffordableRead, readObservatory, readSources } from '@/lib/series';
import { sideOrderReversal } from '@/lib/side-order';

/**
 * El capítulo del método, pedido al abrir su pestaña.
 *
 * Mil seiscientas ochenta notas de fuente con su dirección de publicación:
 * **778 KB** de la portada, medidos el 2026-09-22, en la séptima de siete
 * pestañas. Es el capítulo que explica de dónde sale cada cifra —imprescindible
 * para quien va a comprobarlas y casi nunca lo primero que alguien abre—.
 *
 * Con las notas van las dos cifras que el capítulo enmarca: cuántas lecturas
 * diarias hay detrás del informe y el día en que las dos puntas publicadas se
 * invirtieron. Las dos salen del observatorio, que está sostenido en memoria, así
 * que calcularlas aquí no cuesta una consulta.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const [sources, observatory] = await Promise.all([readSources(), readObservatory()]);

    return Response.json(
      {
        sources,
        readingCount: observatory.readingCount,
        reversal: sideOrderReversal(
          observatory.series.get('FX_PARALLEL_USD_BOB:BUY') ?? [],
          observatory.series.get('FX_PARALLEL_USD_BOB:SELL') ?? [],
        ),
      },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] notas de fuente ilegibles', error);
    return Response.json(
      { error: 'No se pudieron leer las fuentes' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

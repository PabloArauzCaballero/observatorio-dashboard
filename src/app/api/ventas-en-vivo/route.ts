import { readLiveCommerce } from '@/lib/live-commerce';
import { isUnaffordableRead } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * Las ventas en vivo de TikTok, pedidas al abrir su página en «Empresas». Cambian
 * una vez por semana: diez minutos de caché en el navegador alcanzan para ir y
 * volver de pestaña sin pedirlas otra vez.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    return jsonResponse(
      request,
      { board: await readLiveCommerce() },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] ventas en vivo ilegibles', error);
    return Response.json(
      { error: 'No se pudieron leer las ventas en vivo' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

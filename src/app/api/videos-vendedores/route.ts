import { readTiktokVideos } from '@/lib/tiktok-videos';
import { isUnaffordableRead } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * Los videos de los vendedores de TikTok, pedidos al abrir su página en «Empresas». Cambian una vez por
 * semana: diez minutos de caché en el navegador.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    return jsonResponse(
      request,
      { board: await readTiktokVideos() },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] videos de vendedores ilegibles', error);
    return Response.json(
      { error: 'No se pudieron leer los videos de los vendedores' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

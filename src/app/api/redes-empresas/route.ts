import { readCompanySocial } from '@/lib/company-social';
import { isUnaffordableRead } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * Las redes sociales de las empresas del ránking Merco, pedidas al abrir su
 * página en «Empresas». Una lectura por semana: diez minutos de caché en el
 * navegador alcanzan para que ir y volver de pestaña no vuelva a pedirla.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    return jsonResponse(
      request,
      { board: await readCompanySocial() },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] redes sociales de empresas ilegibles', error);
    return Response.json(
      { error: 'No se pudieron leer las redes sociales de las empresas' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

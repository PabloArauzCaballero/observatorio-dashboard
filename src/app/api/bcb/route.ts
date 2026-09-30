import { searchBcb } from '@/lib/bcb';
import { isUnaffordableRead } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * El catálogo de las estadísticas del Banco Central, con su búsqueda.
 *
 * Nunca viaja entero: son doce mil series. Cada petición trae una página de las que
 * coinciden con la familia, la frecuencia y el texto pedidos.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  try {
    return jsonResponse(
      request,
      {
        page: await searchBcb({
          family: (url.searchParams.get('familia') ?? '').slice(0, 40),
          workbook: (url.searchParams.get('informe') ?? '').slice(0, 300),
          sheet: (url.searchParams.get('hoja') ?? '').slice(0, 120),
          frequency: (url.searchParams.get('frecuencia') ?? '').slice(0, 20),
          text: (url.searchParams.get('q') ?? '').slice(0, 120),
          offset: Number(url.searchParams.get('desde') ?? 0) || 0,
        }),
      },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    );
  } catch (error) {
    console.error('[observatorio] estadísticas del BCB ilegibles', error);
    return Response.json(
      { error: 'No se pudieron leer las estadísticas del BCB' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

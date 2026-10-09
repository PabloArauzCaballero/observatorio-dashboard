import { readCompanyPosts } from '@/lib/company-social-posts';
import { parseQuery } from '@/lib/company-social-posts-view';
import { isUnaffordableRead } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * Los posts de las redes de las empresas, con los filtros del panel «Posts a fondo». Se pide por POST
 * porque la lista de empresas elegidas puede pasar de los trescientos nombres; el cuerpo se acota
 * entero en `parseQuery` y la lectura sale de memoria, no de la base.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'El cuerpo de la petición no es JSON' }, { status: 400 });
  }
  try {
    return jsonResponse(request, await readCompanyPosts(parseQuery(body)), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[observatorio] posts de redes de empresas ilegibles', error);
    return Response.json(
      { error: 'No se pudieron leer los posts de las redes de las empresas' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

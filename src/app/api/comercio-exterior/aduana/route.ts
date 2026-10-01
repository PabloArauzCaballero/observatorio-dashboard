import { jsonResponse } from '@/lib/respond';
import { isUnaffordableRead } from '@/lib/series';
import { readTradeViews } from '@/lib/trade-records';
import type { ViewSpec } from '@/lib/trade-records';
import { DIMENSIONS, parseQuery } from '@/lib/trade-records-query';
import type { Dimension } from '@/lib/trade-records-query';

/**
 * La base aduanera del INE, vista por vista, para «Detalle aduanero».
 *
 * `?flow=X&from=2015&to=2025&country=245&views=serie:year,productos:chapter`
 * devuelve una suma por vista. Cada vista se cuenta con todos los filtros
 * menos el suyo (ver `trade-records.ts`), y una combinación que la base no
 * publica —importaciones por país y departamento a la vez— vuelve con el
 * motivo en `unavailable`, no vacía.
 */

export const dynamic = 'force-dynamic';

const MAX_VIEWS = 6;
/** Todos los países caben: el mapa los pide de una vez, y no hay más de ~260 códigos. */
const MAX_ROWS = 300;

function viewsOf(raw: string | null): ViewSpec[] {
  const specs: ViewSpec[] = [];
  for (const part of (raw ?? '').split(',')) {
    const [name = '', by = '', limit = ''] = part.split(':');
    if (!/^[a-z]{1,16}$/u.test(name) || !DIMENSIONS.includes(by as Dimension)) continue;
    const top = Number(limit);
    specs.push({
      name,
      by: by as Dimension,
      limit: Number.isInteger(top) && top > 0 && top <= MAX_ROWS ? top : 25,
    });
  }
  return specs.slice(0, MAX_VIEWS);
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const query = parseQuery(params);
  const specs = viewsOf(params.get('views'));
  if (!specs.length) return Response.json({ error: 'Falta views' }, { status: 400 });
  try {
    const views = await readTradeViews(query, specs);
    return jsonResponse(
      request,
      { query, views },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] base aduanera ilegible', error);
    return Response.json(
      { error: 'No se pudo leer la base aduanera' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

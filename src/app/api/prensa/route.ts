import { readPressCube, readPressPage } from '@/lib/series';

/**
 * The stories behind a selection, fetched when the selection changes.
 *
 * The panel holds the cross-tabulation and can therefore answer "how many"
 * without asking anything; it cannot answer "which ones" without the corpus,
 * and the corpus stays in the database. So a click updates every count
 * instantly and the cards arrive a moment later, which is the right way round:
 * the reader is choosing, not reading, while they click.
 */

export const dynamic = 'force-dynamic';

/** How many stories a page of the register holds; the panel asks for the same. */
const PAGE_SIZE = 60;

/** A selection value only reaches SQL when it is a real filter. */
const pick = (value: string | null): string | undefined =>
  value && value !== 'TODOS' ? value.slice(0, 120) : undefined;

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const search = pick(params.get('buscar'));
  try {
    /*
     * A search changes the counts as well as the stories, and the panel cannot
     * work that out from the cross-tabulation it holds — there is no text in
     * it. So a searching request brings back a cube rebuilt under the same
     * predicate, and every visual on the panel then speaks for the search.
     */
    const cube = params.get('cubo') === '1' ? await readPressCube(search) : null;
    const page = await readPressPage(
      {
        year: pick(params.get('anio')),
        tone: pick(params.get('tono')),
        topic: pick(params.get('tema')),
        region: pick(params.get('region')),
        outlet: pick(params.get('medio')),
        term: pick(params.get('termino')),
        search,
      },
      PAGE_SIZE,
      Math.max(0, Number(params.get('desde') ?? 0)) || 0,
    );
    return Response.json({ ...page, cube }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json(
      { articles: [], total: 0, error: error instanceof Error ? error.message : 'sin respuesta' },
      { status: 500 },
    );
  }
}

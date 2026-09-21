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

/**
 * Las categorías de una dimensión, tal como las manda el tablero.
 *
 * Separadas por coma, porque el lector puede sumar varias con Ctrl+clic. El
 * centinela `TODOS` de las direcciones viejas se sigue entendiendo como «sin
 * recorte», y cada valor se recorta a lo que un código puede medir: lo que
 * llega por aquí es texto de fuera.
 */
const pickMany = (value: string | null): string[] | undefined => {
  if (!value) return undefined;
  const values = value
    .split(',')
    .map((one) => one.trim().slice(0, 120))
    .filter((one) => one.length > 0 && one !== 'TODOS');
  return values.length ? values.slice(0, 200) : undefined;
};

/** Lo mismo para la búsqueda, que es una sola cadena y no una lista. */
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
        year: pickMany(params.get('anio')),
        tone: pickMany(params.get('tono')),
        topic: pickMany(params.get('tema')),
        region: pickMany(params.get('region')),
        outlet: pickMany(params.get('medio')),
        term: pickMany(params.get('termino')),
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

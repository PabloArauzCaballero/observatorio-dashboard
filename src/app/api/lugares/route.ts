import { readPlaces } from '@/lib/places';

/**
 * The places of one city, fetched when the reader chooses one.
 *
 * The family counts travel with the page because a chooser is useless without
 * them. The places do not: twenty-six thousand of them with a name, a position
 * and an address apiece is several megabytes, and a reader looks at one city —
 * usually one family — at a time.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const parameters = new URL(request.url).searchParams;
  const city = parameters.get('ciudad');
  if (!city) {
    return Response.json({ error: 'Falta la ciudad' }, { status: 400 });
  }

  try {
    const family = parameters.get('familia');
    const { places, total } = await readPlaces(city, family);
    return Response.json({ places, total });
  } catch (error) {
    // The message can carry the host, the user and the port. It belongs in the
    // log, not in a response served to the public.
    console.error('[observatorio] lugares ilegibles', error);
    return Response.json({ error: 'No se pudieron leer los lugares' }, { status: 500 });
  }
}

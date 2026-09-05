import { readPanelSeries } from '@/lib/series';

/**
 * One indicator's history, fetched when the reader picks it.
 *
 * The catalogue travels with the page because a chooser is useless without it.
 * The observations do not: fifteen hundred series at sixty years and thirty
 * economies apiece is more than a million points, and a reader looks at one
 * series at a time. So the page ships the list and asks for the numbers.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const code = new URL(request.url).searchParams.get('indicador');
  if (!code) {
    return Response.json({ error: 'Falta el indicador' }, { status: 400 });
  }
  try {
    return Response.json({ points: await readPanelSeries(code) });
  } catch (error) {
    // The message can carry the host, the user and the port. It belongs in the
    // log, not in a response served to the public.
    console.error('[observatorio] panel ilegible', error);
    return Response.json({ error: 'No se pudo leer el panel' }, { status: 500 });
  }
}

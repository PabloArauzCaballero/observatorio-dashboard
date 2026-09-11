import { readWorldBoard } from '@/lib/series';
import { WORLD_CODES, WORLD_PLACE_CODES } from '@/lib/world-board';

/**
 * The world board's figures, fetched when the board is opened.
 *
 * Not shipped with the page: the briefing already waits on a dozen reads, and
 * this tab is one most visitors never open. The answer is annual data that
 * changes a few times a year, so a browser that switches away from the tab and
 * back is allowed to keep what it already has for ten minutes instead of
 * asking the server again — the sub-tabs remount on every switch, and each
 * remount would otherwise be a fresh read.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    return Response.json(
      { points: await readWorldBoard(WORLD_CODES, WORLD_PLACE_CODES) },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // The message can carry the host, the user and the port. It belongs in the
    // log, not in a response served to the public.
    console.error('[observatorio] tablero mundial ilegible', error);
    return Response.json({ error: 'No se pudo leer el tablero mundial' }, { status: 500 });
  }
}

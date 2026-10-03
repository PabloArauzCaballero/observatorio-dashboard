import { buildRoadTransportBoard } from '@/lib/road-transport-board';
import { readRoadTransport } from '@/lib/transport';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    return Response.json(
      { board: buildRoadTransportBoard(await readRoadTransport()) },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    console.error('[observatorio] transporte terrestre ilegible', error);
    return Response.json({ error: 'No se pudo leer el transporte terrestre' }, { status: 500 });
  }
}

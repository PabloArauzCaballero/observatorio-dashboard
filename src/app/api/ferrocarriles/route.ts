import { buildRailBoard } from '@/lib/transport-board';
import { readRailFlows, readRailLines, readRailStations } from '@/lib/transport';

/**
 * La red ferroviaria, pedida al abrir su página de «Transporte».
 *
 * La misma economía que `/api/carreteras`: nadie la lee en la portada, se
 * sostiene con `held()` y se guarda diez minutos en el navegador.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const [lines, stations, flows] = await Promise.all([
      readRailLines(),
      readRailStations(),
      readRailFlows(),
    ]);
    return Response.json(
      { board: buildRailBoard(lines, stations, flows) },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] red ferroviaria ilegible', error);
    return Response.json({ error: 'No se pudo leer la red ferroviaria' }, { status: 500 });
  }
}

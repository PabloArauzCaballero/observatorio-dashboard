import { buildWaterBoard } from '@/lib/transport-board';
import { readWaterPorts, readWaterways } from '@/lib/transport';

/**
 * La red fluvial, pedida al abrir su página de «Transporte».
 *
 * La misma economía que `/api/carreteras`: nadie la lee en la portada, se
 * sostiene con `held()` y se guarda diez minutos en el navegador.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const [waterways, ports] = await Promise.all([readWaterways(), readWaterPorts()]);
    return Response.json(
      { board: buildWaterBoard(waterways, ports) },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] red fluvial ilegible', error);
    return Response.json({ error: 'No se pudo leer la red fluvial' }, { status: 500 });
  }
}

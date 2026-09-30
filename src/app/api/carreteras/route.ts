import { buildRoadBoard } from '@/lib/roads-board';
import { readRoadLengths, readRoadSections } from '@/lib/roads';

/**
 * La red vial, pedida al abrir su pestaña.
 *
 * Nunca se lee en la portada: `TodaySection` no la menciona y esta ruta no
 * tiene otro llamador que `useOnOpen`. El tablero completo pesa varios cientos
 * de tramos con su geometría — de ahí `Cache-Control: private, max-age=600` y
 * el sostén de `held()` en `lib/roads.ts`, la misma economía que ya hacen
 * `departamentos`, `energia` y `recursos`.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const [sections, lengths] = await Promise.all([readRoadSections(), readRoadLengths()]);
    return Response.json(
      { board: buildRoadBoard(sections, lengths) },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] red vial ilegible', error);
    return Response.json({ error: 'No se pudo leer la red vial' }, { status: 500 });
  }
}

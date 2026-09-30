import { readExogenousBoard } from '@/lib/exogenous';
import { isUnaffordableRead } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * Las variables exógenas, pedidas al abrir su pestaña.
 *
 * Nunca se leen en la portada: la única llamada es la de `useOnOpen` cuando el
 * lector elige «Variables exógenas» dentro de Macroeconomía. El tablero entero
 * viaja de una vez —unas cien series— porque los filtros se cruzan en el
 * navegador y cada clic que pidiera al servidor sería una espera por nada.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    return jsonResponse(
      request,
      { board: await readExogenousBoard() },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] variables exógenas ilegibles', error);
    return Response.json(
      { error: 'No se pudieron leer las variables exógenas' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

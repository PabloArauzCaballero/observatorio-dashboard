import { readPublicAccounts } from '@/lib/public-accounts';
import { isUnaffordableRead } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * Las cuentas públicas, pedidas al abrir su rubro.
 *
 * No viajan con la portada: son cientos de series para un rubro del que la mayoría de las
 * visitas no pasa. La lectura está sostenida en memoria por `held`, así que un navegador
 * que sale del rubro y vuelve no vuelve a la base; y la fuente cambia una vez al mes, cuando
 * el Ministerio publica su cuaderno.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    return jsonResponse(
      request,
      { accounts: await readPublicAccounts() },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] cuentas publicas ilegibles', error);
    return Response.json(
      { error: 'No se pudieron leer las cuentas públicas' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

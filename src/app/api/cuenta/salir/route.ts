import { endCustomerSession, refuse, requestIsSameOrigin } from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cierra la sesión borrando lo único que la prueba: la cookie. */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return refuse(403, 'ORIGIN_REJECTED', 'La petición no salió de este sitio.');
  await endCustomerSession(request);
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

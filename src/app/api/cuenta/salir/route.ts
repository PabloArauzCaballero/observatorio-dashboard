import { done, endCustomerSession, foreignOrigin, requestIsSameOrigin } from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cierra la sesión de este navegador borrando lo único que la prueba: la cookie. */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return foreignOrigin();
  await endCustomerSession(request);
  return done();
}

import { safeReturnPath } from '@/lib/cuenta/puro';
import { currentCustomer, endCustomerSession, freshAccount } from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A dónde manda la página de la cuenta una sesión que el núcleo ya cerró.
 *
 * Una página no puede borrar cookies; esta ruta sí. Es un GET porque llega por
 * una redirección, y por eso vuelve a preguntar al núcleo antes de borrar: un
 * enlace puesto en otro sitio no puede cerrar una sesión que sigue en pie. Las
 * redirecciones son relativas, porque detrás del proxy la dirección de la
 * petición es la del contenedor.
 */
export async function GET(request: Request): Promise<Response> {
  const volver = safeReturnPath(new URL(request.url).searchParams.get('volver'));
  const customer = await currentCustomer(request);
  if (customer) {
    const fresh = await freshAccount(customer);
    // En pie, o sin poder confirmarlo: la cookie se queda y la página dice lo que pase.
    if (fresh.ok || !fresh.revoked) return redirectTo(volver);
  }
  await endCustomerSession(request);
  return redirectTo(`/cuenta/ingresar?volver=${encodeURIComponent(volver)}&motivo=sesion`);
}

function redirectTo(location: string): Response {
  return new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store' } });
}

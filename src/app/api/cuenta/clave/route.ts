import { passwordProblem } from '@/lib/cuenta/puro';
import { changePassword, currentCustomer, refuse, requestIsSameOrigin } from '@/lib/cuenta/servidor';
import { admit, clientIp } from '@/lib/ip-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cambia la contraseña: pide la actual, porque una sesión abierta en otra máquina no basta. */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return refuse(403, 'ORIGIN_REJECTED', 'La petición no salió de este sitio.');
  const customer = await currentCustomer(request);
  if (!customer) return refuse(401, 'UNAUTHORIZED', 'La sesión venció. Volver a ingresar.');
  const admission = admit('cuenta-clave', clientIp(request), 10, 15 * 60 * 1000);
  if (!admission.ok) {
    return refuse(429, 'RATE_LIMITED', 'Demasiados intentos. Intentar de nuevo en unos minutos.', {
      'Retry-After': String(admission.retryAfter),
    });
  }

  const body = (await request.json().catch(() => null)) as { actual?: unknown; nueva?: unknown } | null;
  const actual = typeof body?.actual === 'string' ? body.actual : '';
  if (!actual || actual.length > 200) return refuse(400, 'VALIDATION_ERROR', 'Escribir la contraseña actual.');
  const problema = passwordProblem(body?.nueva);
  if (problema) return refuse(400, 'VALIDATION_ERROR', problema);
  const nueva = String(body?.nueva);
  if (nueva === actual) return refuse(400, 'VALIDATION_ERROR', 'La contraseña nueva debe ser distinta de la actual.');

  const result = await changePassword(customer.accountId, actual, nueva);
  if (!result.ok) {
    if (result.status === 401) return refuse(401, 'WRONG_PASSWORD', 'La contraseña actual no es correcta.');
    return refuse(503, 'CORE_REFUSED', 'No se pudo cambiar la contraseña. Intentar de nuevo en unos minutos.');
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

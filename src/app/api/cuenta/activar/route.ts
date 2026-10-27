import { admit, clientIp } from '@/lib/ip-limit';
import { TERMS_VERSION, isActivationToken, passwordProblem } from '@/lib/cuenta/puro';
import {
  accountsAreConfigured,
  activateAccount,
  refuse,
  requestIsSameOrigin,
  startCustomerSession,
} from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QUINCE_MINUTOS = 15 * 60 * 1000;

/**
 * Fija la contraseña con el enlace de un solo uso y deja constancia de la
 * versión de los términos aceptada. Sirve igual para activar una cuenta nueva y
 * para recuperar la contraseña: el núcleo sabe para qué se emitió el enlace. Al
 * terminar, la sesión queda abierta.
 */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return refuse(403, 'ORIGIN_REJECTED', 'La petición no salió de este sitio.');
  const admission = admit('cuenta-activar', clientIp(request), 10, QUINCE_MINUTOS);
  if (!admission.ok) {
    return refuse(429, 'RATE_LIMITED', 'Demasiados intentos. Intentar de nuevo en unos minutos.', {
      'Retry-After': String(admission.retryAfter),
    });
  }
  if (!accountsAreConfigured()) {
    return refuse(503, 'NOT_CONFIGURED', 'Las cuentas no están disponibles en este momento.');
  }

  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
    password?: unknown;
    terminos?: unknown;
  } | null;
  const token = body?.token;
  if (!isActivationToken(token)) return refuse(400, 'INVALID_TOKEN', 'El enlace no es válido o ya venció.');
  const problema = passwordProblem(body?.password);
  if (problema) return refuse(400, 'VALIDATION_ERROR', problema);
  if (body?.terminos !== true) return refuse(400, 'TERMS_REQUIRED', 'Hace falta aceptar los términos de uso.');

  const result = await activateAccount(token, String(body.password), TERMS_VERSION);
  if (!result.ok) {
    if (result.status >= 400 && result.status < 500) {
      return refuse(400, 'INVALID_TOKEN', 'El enlace no es válido o ya venció. Pedir uno nuevo a DatosBolivia.com.');
    }
    return refuse(503, 'CORE_UNAVAILABLE', 'No se pudo activar la cuenta. Intentar de nuevo en unos minutos.');
  }
  await startCustomerSession(request, result.body.data.account);
  return Response.json({ volver: '/cuenta' }, { headers: { 'cache-control': 'no-store' } });
}

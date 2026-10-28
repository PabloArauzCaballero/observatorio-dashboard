import { admit, clientIp } from '@/lib/ip-limit';
import { TERMS_VERSION, isActivationToken, passwordProblem } from '@/lib/cuenta/puro';
import {
  accountsAreConfigured,
  activateAccount,
  answer,
  endCustomerSession,
  forgetAccount,
  forgetMember,
  foreignOrigin,
  readJson,
  refuse,
  requestIsSameOrigin,
  startCustomerSession,
  tooMany,
} from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QUINCE_MINUTOS = 15 * 60 * 1000;

/**
 * Fija la contraseña con el enlace de un solo uso y deja constancia de la
 * versión de los términos aceptada. Sirve igual para activar una cuenta nueva,
 * para el acceso de un miembro y para recuperar la contraseña: el núcleo sabe
 * para qué se emitió el enlace, y al usarlo cierra las demás sesiones y quita
 * el bloqueo por intentos fallidos.
 *
 * La sesión queda abierta solo cuando la respuesta dice de quién era el enlace
 * (`member`, nulo para la titular). Si no lo dice, abrirla a nombre de la
 * cuenta podría darle a un miembro la sesión de la titular, así que se pide
 * ingresar con la contraseña nueva.
 */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return foreignOrigin();
  const admission = admit('cuenta-activar', clientIp(request), 10, QUINCE_MINUTOS);
  if (!admission.ok) return tooMany(admission.retryAfter);
  if (!accountsAreConfigured()) {
    return refuse(503, 'NOT_CONFIGURED', 'Las cuentas no están disponibles en este momento.');
  }

  const body = await readJson<{ token: unknown; password: unknown; terminos: unknown }>(request);
  const token = body?.token;
  if (!isActivationToken(token)) return refuse(400, 'INVALID_TOKEN', 'El enlace no es válido o ya venció.');
  const problema = passwordProblem(body?.password);
  if (problema) return refuse(400, 'VALIDATION_ERROR', problema, { field: 'password' });
  if (body?.terminos !== true) {
    return refuse(400, 'TERMS_REQUIRED', 'Hace falta aceptar los términos de uso.', { field: 'terminos' });
  }

  const result = await activateAccount(token, String(body.password), TERMS_VERSION);
  if (!result.ok) {
    if (result.status >= 400 && result.status < 500) {
      return refuse(400, 'INVALID_TOKEN', 'El enlace no es válido, ya se usó o venció.');
    }
    return refuse(503, 'CORE_UNAVAILABLE', 'No se pudo guardar la contraseña. Intentar de nuevo en unos minutos.');
  }

  const datos = result.body?.data;
  const account = datos?.account;
  if (account) forgetAccount(account.subscriberAccountId);
  if (account && datos && 'member' in datos) {
    const member = datos.member ?? null;
    if (member) forgetMember(account.subscriberAccountId, member.memberId);
    if (await startCustomerSession(request, account, member)) return answer({ volver: '/cuenta' });
  }
  // Una sesión anterior en este navegador —de esta u otra persona— no sigue abierta por encima de la nueva clave.
  await endCustomerSession(request);
  return answer({ volver: '/cuenta/ingresar?listo=1' });
}

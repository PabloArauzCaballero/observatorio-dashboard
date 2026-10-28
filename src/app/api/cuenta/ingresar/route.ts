import { admit, clientIp, remaining, reserve } from '@/lib/ip-limit';
import { normalizeEmail, safeReturnPath } from '@/lib/cuenta/puro';
import {
  accountsAreConfigured,
  answer,
  forgetAccount,
  forgetMember,
  foreignOrigin,
  readJson,
  refuse,
  requestIsSameOrigin,
  signIn,
  startCustomerSession,
  tooMany,
} from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QUINCE_MINUTOS = 15 * 60 * 1000;

/**
 * El ingreso de titulares y miembros, por el mismo formulario: el núcleo
 * compara la contraseña y dice quién es; el sitio abre la cookie.
 *
 * Tres frenos, de afuera hacia adentro:
 * - Diez intentos por dirección cada quince minutos, cuenten o no.
 * - Cinco fallos por correo y dirección cada quince minutos. Va atado a la
 *   dirección para que nadie pueda bloquear a un cliente fallando con su correo
 *   desde otra parte.
 * - El bloqueo por cuenta, sin importar la dirección, lo lleva el núcleo: diez
 *   fallos seguidos cierran el ingreso quince minutos y contesta 423.
 *
 * Los dos primeros se anotan antes de esperar al núcleo, para que intentos
 * simultáneos no pasen todos; el segundo se devuelve si el ingreso salió bien o
 * si el núcleo falló. El mensaje de error es el mismo para un correo que no
 * existe y para una contraseña equivocada.
 */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return foreignOrigin();
  const ip = clientIp(request);
  const admission = admit('cuenta-ingresar', ip, 10, QUINCE_MINUTOS);
  if (!admission.ok) return tooMany(admission.retryAfter);
  if (!accountsAreConfigured()) {
    return refuse(503, 'NOT_CONFIGURED', 'Las cuentas no están disponibles en este momento.');
  }

  const body = await readJson<{ email: unknown; password: unknown; volver: unknown }>(request);
  const email = normalizeEmail(body?.email);
  if (!email) return refuse(400, 'VALIDATION_ERROR', 'Escribir el correo de la cuenta.', { field: 'email' });
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password || password.length > 200) {
    return refuse(400, 'VALIDATION_ERROR', 'Escribir la contraseña.', { field: 'password' });
  }

  const clave = `${email}|${ip}`;
  if (remaining('cuenta-ingresar-correo', clave, 5, QUINCE_MINUTOS) === 0) return tooMany(QUINCE_MINUTOS / 1000);
  const intento = reserve('cuenta-ingresar-correo', clave, 1, QUINCE_MINUTOS);

  const result = await signIn(email, password);
  if (!result.ok) {
    if (result.status === 423) {
      return refuse(
        423,
        'ACCOUNT_LOCKED',
        'El ingreso a esta cuenta quedó bloqueado por unos minutos después de varios intentos fallidos. Volver a intentar más tarde o recuperar la clave.',
      );
    }
    if (result.status >= 400 && result.status < 500) {
      return refuse(401, 'UNAUTHORIZED', 'El correo o la contraseña no son correctos.');
    }
    intento.saldar(0);
    return refuse(503, 'CORE_UNAVAILABLE', 'No se pudo verificar el ingreso. Intentar de nuevo en unos minutos.');
  }
  intento.saldar(0);

  const account = result.body?.data?.account;
  const member = result.body?.data?.member ?? null;
  // La sesión empieza con lo que el núcleo tiene ahora, no con lo que quedó en la memoria.
  if (account) {
    forgetAccount(account.subscriberAccountId);
    if (member) forgetMember(account.subscriberAccountId, member.memberId);
  }
  if (!account || !(await startCustomerSession(request, account, member))) {
    return refuse(503, 'CORE_UNAVAILABLE', 'No se pudo abrir la sesión. Intentar de nuevo en unos minutos.');
  }
  return answer({ volver: safeReturnPath(body?.volver) });
}

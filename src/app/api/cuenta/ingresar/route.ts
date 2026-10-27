import { admit, clientIp, remaining, reserve } from '@/lib/ip-limit';
import { normalizeEmail, safeReturnPath } from '@/lib/cuenta/puro';
import {
  accountsAreConfigured,
  refuse,
  requestIsSameOrigin,
  signIn,
  startCustomerSession,
} from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QUINCE_MINUTOS = 15 * 60 * 1000;

/**
 * El ingreso de un cliente: el núcleo compara la contraseña, el sitio abre la
 * cookie. Diez intentos por dirección cada quince minutos; el mensaje de error
 * es el mismo para un correo que no existe y para una contraseña equivocada.
 */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return refuse(403, 'ORIGIN_REJECTED', 'La petición no salió de este sitio.');
  const admission = admit('cuenta-ingresar', clientIp(request), 10, QUINCE_MINUTOS);
  if (!admission.ok) {
    return refuse(429, 'RATE_LIMITED', 'Demasiados intentos. Intentar de nuevo en unos minutos.', {
      'Retry-After': String(admission.retryAfter),
    });
  }
  if (!accountsAreConfigured()) {
    return refuse(503, 'NOT_CONFIGURED', 'Las cuentas no están disponibles en este momento.');
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    volver?: unknown;
  } | null;
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password || password.length > 200) {
    return refuse(400, 'VALIDATION_ERROR', 'Escribir el correo y la contraseña.');
  }

  /*
   * Un segundo freno por correo y dirección, que cuenta solo los intentos
   * fallidos: cinco cada quince minutos. Va atado a la dirección para que nadie
   * pueda bloquear a un cliente fallando con su correo desde otra parte. El
   * intento se reserva en el mismo paso que se consulta el saldo, antes de
   * esperar al núcleo, para que intentos simultáneos no pasen todos; se
   * devuelve si el ingreso salió bien o si el núcleo falló. El mensaje es el
   * mismo que el del freno por IP.
   * El contador por cuenta, sin importar la dirección, corresponde al núcleo y está pendiente.
   */
  const clave = `${email}|${clientIp(request)}`;
  if (remaining('cuenta-ingresar-correo', clave, 5, QUINCE_MINUTOS) === 0) {
    return refuse(429, 'RATE_LIMITED', 'Demasiados intentos. Intentar de nuevo en unos minutos.', {
      'Retry-After': '900',
    });
  }
  const intento = reserve('cuenta-ingresar-correo', clave, 1, QUINCE_MINUTOS);

  const result = await signIn(email, password);
  if (!result.ok) {
    if (result.status >= 400 && result.status < 500) {
      return refuse(401, 'UNAUTHORIZED', 'El correo o la contraseña no son correctos.');
    }
    intento.saldar(0);
    return refuse(503, 'CORE_UNAVAILABLE', 'No se pudo verificar el ingreso. Intentar de nuevo en unos minutos.');
  }
  intento.saldar(0);
  await startCustomerSession(request, result.body.data.account);
  return Response.json({ volver: safeReturnPath(body?.volver) }, { headers: { 'cache-control': 'no-store' } });
}

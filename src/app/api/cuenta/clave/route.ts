import { passwordProblem } from '@/lib/cuenta/puro';
import {
  answer,
  changeMemberPassword,
  changePassword,
  customerFor,
  done,
  endCustomerSession,
  foreignOrigin,
  readJson,
  refuse,
  reissueCustomerSession,
  requestIsSameOrigin,
  tooMany,
} from '@/lib/cuenta/servidor';
import { admit, clientIp } from '@/lib/ip-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QUINCE_MINUTOS = 15 * 60 * 1000;

/**
 * Cambia la contraseña de quien está conectado, titular o miembro. Pide la
 * actual, porque una sesión abierta en otra máquina no basta.
 *
 * El núcleo sube la versión de sesión al cambiarla: las sesiones de otros
 * equipos se cierran y esta recibe una cookie con la versión nueva. Si no se
 * puede leer la versión nueva, esta sesión también se cierra y se pide volver a
 * ingresar, en vez de dejar una cookie que ya no vale.
 */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return foreignOrigin();
  const admission = admit('cuenta-clave', clientIp(request), 10, QUINCE_MINUTOS);
  if (!admission.ok) return tooMany(admission.retryAfter);
  const contexto = await customerFor(request);
  if (contexto instanceof Response) return contexto;
  const { customer } = contexto;
  // Un segundo freno por persona: con una cookie robada no se prueba la contraseña actual desde muchas direcciones.
  const porPersona = admit('cuenta-clave-persona', customer.mid ?? customer.accountId, 10, QUINCE_MINUTOS);
  if (!porPersona.ok) return tooMany(porPersona.retryAfter);

  const body = await readJson<{ actual: unknown; nueva: unknown }>(request);
  const actual = typeof body?.actual === 'string' ? body.actual : '';
  if (!actual || actual.length > 200) {
    return refuse(400, 'VALIDATION_ERROR', 'Escribir la contraseña actual.', { field: 'actual' });
  }
  const problema = passwordProblem(body?.nueva);
  if (problema) return refuse(400, 'VALIDATION_ERROR', problema, { field: 'nueva' });
  const nueva = String(body?.nueva);
  if (nueva === actual) {
    return refuse(400, 'VALIDATION_ERROR', 'La contraseña nueva debe ser distinta de la actual.', { field: 'nueva' });
  }

  const result = customer.mid
    ? await changeMemberPassword(customer.accountId, customer.mid, actual, nueva)
    : await changePassword(customer.accountId, actual, nueva);
  if (!result.ok) {
    if (result.status === 401) {
      return refuse(401, 'WRONG_PASSWORD', 'La contraseña actual no es correcta.', { field: 'actual' });
    }
    return refuse(503, 'CORE_REFUSED', 'No se pudo cambiar la contraseña. Intentar de nuevo en unos minutos.');
  }

  if (await reissueCustomerSession(request, customer)) return done();
  await endCustomerSession(request);
  return answer({ reingresar: true });
}

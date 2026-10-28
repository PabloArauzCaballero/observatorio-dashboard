import { admit, clientIp } from '@/lib/ip-limit';
import {
  answer,
  customerFor,
  done,
  endCustomerSession,
  forgetAccount,
  foreignOrigin,
  refuse,
  requestIsSameOrigin,
  revokeSessions,
  startCustomerSession,
  tooMany,
} from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * «Cerrar las demás sesiones»: el núcleo sube la versión de sesión de la
 * cuenta, con lo que dejan de valer todas las cookies emitidas antes —las de
 * otros equipos de la titular y las de los miembros—, y esta recibe una cookie
 * con la versión nueva. Solo la titular puede hacerlo.
 */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return foreignOrigin();
  const admission = admit('cuenta-sesiones', clientIp(request), 10, 15 * 60 * 1000);
  if (!admission.ok) return tooMany(admission.retryAfter);
  const contexto = await customerFor(request, 'owner');
  if (contexto instanceof Response) return contexto;
  const { customer } = contexto;

  const result = await revokeSessions(customer.accountId);
  forgetAccount(customer.accountId);
  if (!result.ok) {
    return refuse(503, 'CORE_REFUSED', 'No se pudieron cerrar las sesiones. Intentar de nuevo en unos minutos.');
  }
  const account = result.body?.data?.account;
  if (account && (await startCustomerSession(request, account))) return done();
  // Las sesiones ya se cerraron en el núcleo; sin la versión nueva esta tampoco vale.
  await endCustomerSession(request);
  return answer({ reingresar: true });
}

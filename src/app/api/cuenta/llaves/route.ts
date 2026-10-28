import { admit, clientIp } from '@/lib/ip-limit';
import { cleanLabel } from '@/lib/cuenta/puro';
import {
  answer,
  createApiKey,
  customerFor,
  forgetAccount,
  foreignOrigin,
  readJson,
  refuse,
  requestIsSameOrigin,
  tooMany,
} from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Crea una llave de API. Solo la titular, con la cuenta vigente según el
 * núcleo: una cookie vieja no crea llaves. La llave completa viaja una sola
 * vez, en esta respuesta; el núcleo guarda solo su huella y el prefijo. El tope
 * de llaves activas sale del plan y lo hace cumplir el núcleo (409 si ya se
 * alcanzó).
 */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return foreignOrigin();
  const admission = admit('cuenta-llaves', clientIp(request), 20, 60 * 60 * 1000);
  if (!admission.ok) return tooMany(admission.retryAfter);
  const contexto = await customerFor(request, 'owner');
  if (contexto instanceof Response) return contexto;
  const { customer, detail, plan } = contexto;
  if (!detail.account.entitled) return refuse(403, 'NOT_ENTITLED', 'La cuenta no está vigente.');
  if (!plan || plan.llaves <= 0) return refuse(403, 'NOT_ENTITLED', 'El plan no incluye llaves de API.');

  const body = await readJson<{ label: unknown }>(request);
  const label = cleanLabel(body?.label);
  if (!label) {
    return refuse(400, 'VALIDATION_ERROR', 'Escribir un nombre para la llave, de hasta 60 caracteres.', { field: 'label' });
  }

  const result = await createApiKey(customer.accountId, label, plan.llaves);
  forgetAccount(customer.accountId);
  if (!result.ok) {
    if (result.status === 409) {
      return refuse(409, 'KEY_LIMIT', 'Se alcanzó el número de llaves del plan. Revocar una para crear otra.');
    }
    return refuse(503, 'CORE_REFUSED', 'No se pudo crear la llave. Intentar de nuevo en unos minutos.');
  }
  const llave = result.body?.data;
  if (!llave || typeof llave.key !== 'string') {
    return refuse(503, 'CORE_REFUSED', 'No se pudo crear la llave. Intentar de nuevo en unos minutos.');
  }
  return answer({ apiKeyId: llave.apiKeyId, prefix: llave.prefix, key: llave.key }, 201);
}

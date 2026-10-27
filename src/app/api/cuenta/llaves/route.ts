import { PLANS } from '@/lib/plans';
import { cleanLabel, planFor } from '@/lib/cuenta/puro';
import { createApiKey, currentCustomer, refuse, requestIsSameOrigin } from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Crea una llave de API. La llave completa viaja una sola vez, en esta
 * respuesta; el núcleo guarda solo su huella y el prefijo. El tope de llaves
 * activas sale del plan y lo hace cumplir el núcleo (409 si ya se alcanzó).
 */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return refuse(403, 'ORIGIN_REJECTED', 'La petición no salió de este sitio.');
  const customer = await currentCustomer(request);
  if (!customer) return refuse(401, 'UNAUTHORIZED', 'La sesión venció. Volver a ingresar.');
  if (!customer.entitled) return refuse(403, 'NOT_ENTITLED', 'La cuenta no está vigente.');
  const plan = planFor(PLANS, customer.planCode);
  if (!plan || plan.llaves <= 0) return refuse(403, 'NOT_ENTITLED', 'El plan no incluye llaves de API.');

  const body = (await request.json().catch(() => null)) as { label?: unknown } | null;
  const label = cleanLabel(body?.label);
  if (!label) return refuse(400, 'VALIDATION_ERROR', 'Escribir un nombre para la llave, de hasta 60 caracteres.');

  const result = await createApiKey(customer.accountId, label, plan.llaves);
  if (!result.ok) {
    if (result.status === 409) {
      return refuse(409, 'KEY_LIMIT', 'Se alcanzó el número de llaves del plan. Revocar una para crear otra.');
    }
    return refuse(503, 'CORE_REFUSED', 'No se pudo crear la llave. Intentar de nuevo en unos minutos.');
  }
  return Response.json(result.body.data, { status: 201, headers: { 'cache-control': 'no-store' } });
}

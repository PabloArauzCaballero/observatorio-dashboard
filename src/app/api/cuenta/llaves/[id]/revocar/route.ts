import { isUuid } from '@/lib/cuenta/puro';
import { currentCustomer, forgetAccount, refuse, requestIsSameOrigin, revokeApiKey } from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Revoca una llave de la propia cuenta: la cuenta sale de la cookie, nunca del cuerpo. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!requestIsSameOrigin(request)) return refuse(403, 'ORIGIN_REJECTED', 'La petición no salió de este sitio.');
  const customer = await currentCustomer(request);
  if (!customer) return refuse(401, 'UNAUTHORIZED', 'La sesión venció. Volver a ingresar.');
  const { id } = await params;
  if (!isUuid(id)) return refuse(400, 'VALIDATION_ERROR', 'La llave no es válida.');

  const result = await revokeApiKey(customer.accountId, id);
  forgetAccount(customer.accountId);
  if (!result.ok) {
    if (result.status === 404) return refuse(404, 'NOT_FOUND', 'La llave no existe en esta cuenta.');
    return refuse(503, 'CORE_REFUSED', 'No se pudo revocar la llave. Intentar de nuevo en unos minutos.');
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

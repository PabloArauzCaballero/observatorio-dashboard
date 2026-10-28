import { admit, clientIp } from '@/lib/ip-limit';
import { billingChanges } from '@/lib/cuenta/puro';
import {
  customerFor,
  done,
  forgetAccount,
  foreignOrigin,
  readJson,
  refuse,
  requestIsSameOrigin,
  tooMany,
  updateBilling,
} from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Los datos con que se emite la factura: organización, razón social y NIT.
 * Solo la titular los cambia. Un campo en blanco se borra.
 */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return foreignOrigin();
  const admission = admit('cuenta-facturacion', clientIp(request), 20, 15 * 60 * 1000);
  if (!admission.ok) return tooMany(admission.retryAfter);
  const contexto = await customerFor(request, 'owner');
  if (contexto instanceof Response) return contexto;

  const datos = billingChanges(await readJson(request));
  if (!datos.ok) return refuse(400, 'VALIDATION_ERROR', datos.message, { field: datos.field });

  const result = await updateBilling(contexto.customer.accountId, datos.value);
  forgetAccount(contexto.customer.accountId);
  if (!result.ok) {
    return refuse(503, 'CORE_REFUSED', 'No se pudieron guardar los datos. Intentar de nuevo en unos minutos.');
  }
  return done();
}

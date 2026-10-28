import { isUuid } from '@/lib/cuenta/puro';
import {
  customerFor,
  done,
  forgetAccount,
  foreignOrigin,
  refuse,
  requestIsSameOrigin,
  revokeApiKey,
} from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Revoca una llave de la propia cuenta. Solo la titular, y aunque la cuenta
 * no esté vigente: cerrar un acceso nunca debe depender de haber pagado. La
 * cuenta sale de la cookie, nunca del cuerpo.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!requestIsSameOrigin(request)) return foreignOrigin();
  const contexto = await customerFor(request, 'owner');
  if (contexto instanceof Response) return contexto;
  const { id } = await params;
  if (!isUuid(id)) return refuse(400, 'VALIDATION_ERROR', 'La llave no es válida.');

  const result = await revokeApiKey(contexto.customer.accountId, id);
  forgetAccount(contexto.customer.accountId);
  if (!result.ok) {
    if (result.status === 404) return refuse(404, 'NOT_FOUND', 'La llave no existe en esta cuenta.');
    return refuse(503, 'CORE_REFUSED', 'No se pudo revocar la llave. Intentar de nuevo en unos minutos.');
  }
  return done();
}

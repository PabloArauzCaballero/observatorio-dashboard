import { isUuid } from '@/lib/cuenta/puro';
import {
  customerFor,
  done,
  forgetMember,
  foreignOrigin,
  refuse,
  removeMember,
  requestIsSameOrigin,
} from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Quita a una persona de la cuenta. El núcleo la marca como quitada y sube su
 * versión de sesión, así que su cookie deja de valer en el pedido siguiente.
 * Solo la titular; la cuenta sale de la cookie, nunca del cuerpo.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!requestIsSameOrigin(request)) return foreignOrigin();
  const contexto = await customerFor(request, 'owner');
  if (contexto instanceof Response) return contexto;
  const { id } = await params;
  if (!isUuid(id)) return refuse(400, 'VALIDATION_ERROR', 'La persona no es válida.');

  const result = await removeMember(contexto.customer.accountId, id);
  forgetMember(contexto.customer.accountId, id);
  if (!result.ok) {
    if (result.status === 404) return refuse(404, 'NOT_FOUND', 'Esa persona no está en esta cuenta.');
    return refuse(503, 'CORE_REFUSED', 'No se pudo quitar a la persona. Intentar de nuevo en unos minutos.');
  }
  return done();
}

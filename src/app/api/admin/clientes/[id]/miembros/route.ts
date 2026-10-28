import { isUuid } from '@/lib/cuenta/puro';
import { adminError, adminOk, coreRefusal, listMembers, operatorForRead } from '@/lib/cuenta/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Las personas que comparten la cuenta, para la ficha que el operador abre a pedido. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await operatorForRead();
  if (session instanceof Response) return session;
  const { id } = await params;
  if (!isUuid(id)) return adminError(400, 'VALIDATION_ERROR', 'La cuenta no es válida.');

  const result = await listMembers(session, id);
  if (!result.ok) return coreRefusal('listar miembros', result);
  return adminOk({ items: result.body.data?.items ?? [] });
}

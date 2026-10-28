import { isUuid } from '@/lib/cuenta/puro';
import { adminError, adminOk, coreRefusal, operatorFor, revokeSessions } from '@/lib/cuenta/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cierra todas las sesiones de la cuenta y de sus miembros: el núcleo sube la
 * versión de sesión y el sitio deja de aceptar las cookies emitidas antes.
 * Sirve ante una contraseña filtrada o un equipo perdido.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await operatorFor(request);
  if (session instanceof Response) return session;
  const { id } = await params;
  if (!isUuid(id)) return adminError(400, 'VALIDATION_ERROR', 'La cuenta no es válida.');

  const result = await revokeSessions(session, id);
  if (!result.ok) return coreRefusal('cerrar sesiones', result);
  return adminOk(result.body.data);
}

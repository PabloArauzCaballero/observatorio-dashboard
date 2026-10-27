import { callCore } from '@/lib/admin/core-client';
import { currentSession, mutationIsAuthentic } from '@/lib/admin/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = ['NEW', 'CONTACTED', 'WON', 'LOST'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * El estado de un pedido, relevado al núcleo con la identidad del operador.
 *
 * Igual que las validaciones de sembradores: esta ruta convierte la cookie en
 * una credencial y rechaza lo que no vino de una página de esta sesión. Si el
 * operador puede o no cambiar el pedido lo decide el núcleo.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await currentSession();
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'La sesión no es válida' } },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }
  if (!mutationIsAuthentic(session, request.headers, undefined)) {
    return Response.json(
      { error: { code: 'CSRF_REJECTED', message: 'La petición no pasó la verificación de origen' } },
      { status: 403, headers: { 'cache-control': 'no-store' } },
    );
  }
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
    operatorNote?: unknown;
  } | null;
  const status = body?.status;
  const note = typeof body?.operatorNote === 'string' ? body.operatorNote.trim().slice(0, 2_000) : null;
  if (!UUID.test(id) || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'El pedido o el estado no son válidos' } },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }

  const result = await callCore(`/api/v1/admin/inquiries/${id}`, session, {
    method: 'PATCH',
    body: { status, operatorNote: note || null },
  });
  if (!result.ok) {
    return Response.json(
      { error: { code: result.code, message: result.message } },
      { status: result.status, headers: { 'cache-control': 'no-store' } },
    );
  }
  return Response.json(result.body, { status: 200, headers: { 'cache-control': 'no-store' } });
}

import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * What a seed run is doing right now, for the dialog that is watching it.
 *
 * It is a read, so it needs a session and nothing else: no CSRF token, because
 * nothing changes, and no mutation path, because a screen that could restart a
 * run by polling it would be a screen nobody could leave open safely.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ seedRunId: string }> },
): Promise<Response> {
  const session = await currentSession();
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'La sesión no es válida' } },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }
  const { seedRunId } = await context.params;
  if (!UUID.test(seedRunId)) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Identificador inválido' } },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }
  const result = await callCore(`/api/v1/admin/seeds/runs/${seedRunId}`, session);
  if (!result.ok) {
    return Response.json(
      { error: { code: result.code, message: result.message } },
      { status: result.status, headers: { 'cache-control': 'no-store' } },
    );
  }
  return Response.json(result.body, { status: 200, headers: { 'cache-control': 'no-store' } });
}

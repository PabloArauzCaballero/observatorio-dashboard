import { callCore } from '@/lib/admin/core-client';
import { currentSession, mutationIsAuthentic } from '@/lib/admin/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Validation, relayed to the core under the operator's own identity.
 *
 * The route adds exactly two things the core cannot do for itself: it turns the
 * browser's session cookie into a credential the core accepts, and it refuses a
 * request that did not come from a page this server rendered for that session.
 *
 * It decides nothing else. Whether this operator may validate this package is
 * the core's answer, and a 403 from there is returned unchanged rather than
 * being pre-empted by a check here that could drift out of step with it.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await currentSession();
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'La sesión no es válida' } },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }
  if (!mutationIsAuthentic(session, request.headers, undefined)) {
    return Response.json(
      {
        error: { code: 'CSRF_REJECTED', message: 'La petición no pasó la verificación de origen' },
      },
      { status: 403, headers: { 'cache-control': 'no-store' } },
    );
  }
  const body: unknown = await request.json().catch(() => null);
  const packageCode =
    typeof (body as { packageCode?: unknown })?.packageCode === 'string'
      ? (body as { packageCode: string }).packageCode
      : '';
  if (!/^[a-z][a-z0-9-]{1,79}$/u.test(packageCode)) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'El código de paquete no es válido' } },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }

  const result = await callCore('/api/v1/admin/seeds/validations', session, {
    method: 'POST',
    body: { packageCode },
  });
  if (!result.ok) {
    return Response.json(
      { error: { code: result.code, message: result.message } },
      { status: result.status, headers: { 'cache-control': 'no-store' } },
    );
  }
  return Response.json(result.body, { status: 200, headers: { 'cache-control': 'no-store' } });
}

import { callCore } from '@/lib/admin/core-client';
import { currentSession, mutationIsAuthentic } from '@/lib/admin/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReconciliationBody {
  packageCode?: unknown;
  expectedVersion?: unknown;
  expectedChecksum?: unknown;
  reason?: unknown;
}

/**
 * Relays a reconciliation and returns the acceptance, never a result.
 *
 * The version and checksum the operator saw travel with the request and the
 * core refuses them if the package has changed since. That is what makes
 * «aplicar la diferencia que acabo de revisar» mean that, and not «aplicar lo
 * que haya ahora» — and it is why this route does not helpfully fill them in
 * from the current manifest when they are missing.
 *
 * The answer is 202 with a run identifier. The screen then watches that run; it
 * does not report a catalogue as loaded because a request was accepted.
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
  const body = (await request.json().catch(() => ({}))) as ReconciliationBody;
  const packageCode = typeof body.packageCode === 'string' ? body.packageCode : '';
  const expectedVersion = typeof body.expectedVersion === 'string' ? body.expectedVersion : '';
  const expectedChecksum = typeof body.expectedChecksum === 'string' ? body.expectedChecksum : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (
    !/^[a-z][a-z0-9-]{1,79}$/u.test(packageCode) ||
    !/^\d+\.\d+\.\d+$/u.test(expectedVersion) ||
    !/^[a-f0-9]{64}$/u.test(expectedChecksum) ||
    reason.length < 4
  ) {
    return Response.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Falta el paquete, la versión revisada, su checksum o el motivo',
        },
      },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }

  const result = await callCore('/api/v1/admin/seeds/reconciliations', session, {
    method: 'POST',
    body: { packageCode, expectedVersion, expectedChecksum, reason },
  });
  if (!result.ok) {
    return Response.json(
      { error: { code: result.code, message: result.message } },
      { status: result.status, headers: { 'cache-control': 'no-store' } },
    );
  }
  return Response.json(result.body, { status: 202, headers: { 'cache-control': 'no-store' } });
}

import { authenticate } from '@/lib/admin/operators';
import {
  currentSession,
  issueSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/admin/session';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Credentials {
  subject?: unknown;
  password?: unknown;
}

/**
 * Exchanges a password for a session cookie, and says nothing else.
 *
 * The refusal is the same sentence whether the operator does not exist or the
 * password was wrong, and the verification takes the same time either way, so
 * the endpoint cannot be used to find out who has an account here.
 *
 * What comes back is the CSRF token and the name to greet the operator with.
 * The credential the core accepts is never minted here and never reaches the
 * browser: it is created per request, on the server, from the session.
 */
export async function POST(request: Request): Promise<Response> {
  let body: Credentials;
  try {
    body = (await request.json()) as Credentials;
  } catch {
    return refuse(400, 'La petición no es JSON válido');
  }
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!subject || !password) return refuse(400, 'Faltan credenciales');

  const account = authenticate(subject, password);
  if (!account) return refuse(401, 'Credenciales inválidas');

  const { value, session } = issueSession(account);
  const store = await cookies();
  store.set(SESSION_COOKIE, value, sessionCookieOptions());
  return Response.json(
    {
      name: session.name,
      roles: session.roles,
      csrf: session.csrf,
      expiresAt: new Date(session.expiresAt * 1000).toISOString(),
    },
    { status: 200, headers: { 'cache-control': 'no-store' } },
  );
}

/**
 * What the current session is, for the page that has it.
 *
 * It returns the CSRF token, which is the point: the browser cannot read the
 * session cookie, so the token has to reach the page some other way. A
 * cross-origin script cannot read this response — no `Access-Control-Allow-Origin`
 * is sent — so the token stays with the site that owns the session.
 *
 * It never returns the credential the core accepts. That is minted per request
 * on the server and has no reason to exist in a browser.
 */
export async function GET(): Promise<Response> {
  const session = await currentSession();
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'No hay sesión' } },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }
  return Response.json(
    {
      subject: session.subject,
      name: session.name,
      roles: session.roles,
      csrf: session.csrf,
      expiresAt: new Date(session.expiresAt * 1000).toISOString(),
    },
    { status: 200, headers: { 'cache-control': 'no-store' } },
  );
}

/** Ends the session on the server by clearing the only thing that proves it. */
export async function DELETE(): Promise<Response> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

function refuse(status: number, message: string): Response {
  return Response.json(
    { error: { code: status === 401 ? 'UNAUTHORIZED' : 'VALIDATION_ERROR', message } },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { OperatorAccount } from './operators';

export const SESSION_COOKIE = 'obs_admin_session';
export const CSRF_HEADER = 'x-obs-csrf';

const SESSION_MINUTES = 60;

export interface AdminSession {
  readonly subject: string;
  readonly name: string;
  readonly roles: readonly string[];
  readonly organizationId?: string;
  /** Seconds since the epoch. */
  readonly expiresAt: number;
  /** Paired with the cookie and required on every mutation. */
  readonly csrf: string;
}

/**
 * The session lives in a signed cookie the browser cannot read.
 *
 * Two things are deliberately absent. There is no bearer token in the cookie:
 * the credential the core accepts is minted per request, on the server, and
 * never leaves it. And there is nothing in `localStorage`, because anything a
 * script can read is something an injected script can take.
 *
 * The cookie is `HttpOnly` and `SameSite=Lax`, which stops a cross-site form
 * from carrying it on a POST; the CSRF token inside it is the second lock, and
 * it exists because `Lax` is a browser's promise and not this server's.
 */
function secret(): Buffer {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET debe existir y tener al menos 32 caracteres');
  }
  return Buffer.from(value, 'utf8');
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function issueSession(account: OperatorAccount): { value: string; session: AdminSession } {
  const session: AdminSession = {
    subject: account.subject,
    name: account.name,
    roles: account.roles,
    ...(account.organizationId ? { organizationId: account.organizationId } : {}),
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
    csrf: randomBytes(24).toString('base64url'),
  };
  const payload = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  return { value: `${payload}.${sign(payload)}`, session };
}

/**
 * Reads a session only if this server signed it and it has not expired.
 *
 * Any failure returns null rather than throwing: an expired or tampered cookie
 * must send a visitor to the login screen, not to an error page that tells them
 * which of the two it was.
 */
export function readSession(value: string | undefined): AdminSession | null {
  if (!value) return null;
  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = sign(payload);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminSession;
    if (typeof session.expiresAt !== 'number' || session.expiresAt * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** The session of the request being served, or null. */
export async function currentSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions(): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    // Secure everywhere except plain-HTTP development, where the browser would
    // simply drop the cookie and make the private area impossible to open.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MINUTES * 60,
  };
}

/**
 * Whether a mutating request may be believed.
 *
 * Both checks matter and neither replaces the other: the token proves the
 * request came from a page this server rendered for this session, and the
 * origin check refuses a request that a browser should never have sent.
 */
export function mutationIsAuthentic(
  session: AdminSession,
  headers: Headers,
  allowedOrigin: string | undefined,
): boolean {
  const token = headers.get(CSRF_HEADER) ?? '';
  if (token.length !== session.csrf.length) return false;
  if (!timingSafeEqual(Buffer.from(token), Buffer.from(session.csrf))) return false;
  const origin = headers.get('origin');
  if (!origin) return true;
  const expected = allowedOrigin ?? process.env.ADMIN_PUBLIC_ORIGIN;
  return expected ? origin === expected : true;
}

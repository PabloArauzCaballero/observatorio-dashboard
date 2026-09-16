import 'server-only';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Who may open the private area, read from the server's configuration.
 *
 * There is no identity provider in front of this deployment and inventing one
 * was not the job. What the core already knows how to do is verify an RS256
 * token against a JWKS endpoint and apply its own roles to it, so the dashboard
 * authenticates a person here and then mints a short-lived token the core
 * verifies exactly as it verifies any other. The roles a person carries are
 * the core's roles, checked by the core; this file decides only who they are.
 *
 * Passwords never appear here in the clear. The configuration carries a scrypt
 * digest and its salt, and the comparison is constant time, so a wrong password
 * and a wrong operator take the same time to refuse.
 */
export interface OperatorAccount {
  readonly subject: string;
  readonly name: string;
  readonly roles: readonly string[];
  readonly organizationId?: string;
  readonly salt: string;
  readonly digest: string;
}

const SCRYPT_KEY_LENGTH = 64;

/**
 * Reads the roster once per process, and treats a broken roster as an empty one.
 *
 * A malformed `ADMIN_OPERATORS` must not crash the public site: the report is
 * what most visitors came for, and the private area refusing everybody is a
 * better failure than a page that will not render.
 */
let cached: OperatorAccount[] | undefined;

export function operators(): OperatorAccount[] {
  if (cached) return cached;
  const raw = process.env.ADMIN_OPERATORS;
  if (!raw) {
    cached = [];
    return cached;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    cached = Array.isArray(parsed) ? parsed.filter(isOperator) : [];
  } catch {
    cached = [];
  }
  return cached;
}

function isOperator(value: unknown): value is OperatorAccount {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.subject === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.roles) &&
    candidate.roles.every((role) => typeof role === 'string') &&
    typeof candidate.salt === 'string' &&
    typeof candidate.digest === 'string'
  );
}

/**
 * Verifies a password without letting the answer depend on who was named.
 *
 * An unknown subject still pays for a scrypt derivation against a throwaway
 * salt, so the response time cannot be used to enumerate operators.
 */
export function authenticate(subject: string, password: string): OperatorAccount | null {
  const account = operators().find((operator) => operator.subject === subject);
  const salt = account?.salt ?? randomBytes(16).toString('hex');
  const expected = account?.digest ?? randomBytes(SCRYPT_KEY_LENGTH).toString('hex');
  const derived = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');
  const matches = constantTimeEquals(derived, expected);
  return account && matches ? account : null;
}

function constantTimeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Derives the pair an operator entry stores, for the setup documentation. */
export function deriveCredential(password: string): { salt: string; digest: string } {
  const salt = randomBytes(16).toString('hex');
  return { salt, digest: scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex') };
}

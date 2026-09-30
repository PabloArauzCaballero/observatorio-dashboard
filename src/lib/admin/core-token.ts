import 'server-only';
import { createHash, createPrivateKey, createPublicKey, createSign } from 'node:crypto';
import type { AdminSession } from './session';

/**
 * Mints the credential the core already knows how to verify.
 *
 * The core authenticates RS256 tokens against a JWKS endpoint, checks issuer,
 * audience and expiry, and applies its own roles. Reusing that path means the
 * portal adds no second authorization implementation: the dashboard states who
 * the person is, and every decision about what they may do is still taken by
 * the core, against the same rules an external identity provider would meet.
 *
 * The token is short-lived and is created per request on the server. It is
 * never written into the session cookie, never returned to the browser and
 * never logged.
 */
const TOKEN_SECONDS = 120;

function privateKey() {
  const pem = process.env.ADMIN_JWT_PRIVATE_KEY;
  if (!pem) throw new Error('ADMIN_JWT_PRIVATE_KEY no está configurada');
  return createPrivateKey(pem.includes('\\n') ? pem.replace(/\\n/gu, '\n') : pem);
}

function keyId(): string {
  const declared = process.env.ADMIN_JWT_KEY_ID;
  if (declared) return declared;
  // Derived from the public key so the published JWKS and the tokens agree
  // without a second variable somebody has to remember to keep in step.
  const exported = createPublicKey(privateKey()).export({ type: 'spki', format: 'der' });
  return createHash('sha256').update(exported).digest('base64url').slice(0, 16);
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function mintCoreToken(session: AdminSession): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url({ alg: 'RS256', typ: 'JWT', kid: keyId() });
  const payload = base64url({
    sub: session.subject,
    iss: process.env.ADMIN_JWT_ISSUER ?? 'observatorio-dashboard',
    aud: process.env.ADMIN_JWT_AUDIENCE ?? 'observatorio-economico-core',
    iat: issuedAt,
    // Required, and checked by the core: a token minted without an expiry
    // verifies forever, which no rotation or revocation window ever reaches.
    exp: issuedAt + TOKEN_SECONDS,
    roles: session.roles,
    ...(session.organizationId ? { organization_id: session.organizationId } : {}),
  });
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(privateKey()).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

/**
 * The public half, in the shape the core's JWKS client reads.
 *
 * Only the modulus and the exponent are published. Everything else about the
 * key stays on this server, and the endpoint that serves this is the only part
 * of the private area that is deliberately public.
 */
export function publicJwks(): { keys: Array<Record<string, string>> } {
  const jwk = createPublicKey(privateKey()).export({ format: 'jwk' }) as {
    n?: string;
    e?: string;
    kty?: string;
  };
  if (!jwk.n || !jwk.e || jwk.kty !== 'RSA') {
    throw new Error('ADMIN_JWT_PRIVATE_KEY debe ser una clave RSA');
  }
  return {
    keys: [{ kty: 'RSA', use: 'sig', alg: 'RS256', kid: keyId(), n: jwk.n, e: jwk.e }],
  };
}

export function jwtIsConfigured(): boolean {
  return Boolean(process.env.ADMIN_JWT_PRIVATE_KEY);
}

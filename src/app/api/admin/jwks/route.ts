import { jwtIsConfigured, publicJwks } from '@/lib/admin/core-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The public half of the key the core verifies administrative tokens with.
 *
 * This is the one part of the private area that is deliberately public, and it
 * has to be: the core fetches it to check a signature, exactly as it would
 * fetch any identity provider's. A public key is not a secret, and publishing
 * it is what lets the core keep owning every authorization decision instead of
 * trusting a claim the dashboard makes about itself.
 *
 * It is cached for ten minutes because a rotation is a deployment, not an
 * emergency, and because the core's own client caches for the same window.
 */
export function GET(): Response {
  if (!jwtIsConfigured()) {
    return Response.json(
      { error: { code: 'NOT_CONFIGURED', message: 'Este despliegue no emite tokens' } },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
  return Response.json(publicJwks(), {
    status: 200,
    headers: { 'cache-control': 'public, max-age=600' },
  });
}

import 'server-only';
import { mintCoreToken } from './core-token';
import type { AdminSession } from './session';

/**
 * The one way the private area talks to the core.
 *
 * Every call is made on the server with a freshly minted credential, so the
 * browser never holds one. Nothing here interprets the domain: it carries a
 * request and hands back what the core decided, including its refusals, because
 * a client that re-decided a refusal would be a second authorization system.
 */
export interface CoreEnvelope<T> {
  readonly data: T;
  readonly meta: {
    readonly environmentId: string;
    readonly observedAt: string | null;
    readonly generatedAt: string;
    readonly evidenceState: 'known' | 'unknown' | 'stale' | 'not_applicable';
    readonly requestId: string;
  };
}

export type CoreResult<T> =
  | { readonly ok: true; readonly body: CoreEnvelope<T> }
  | {
      readonly ok: false;
      readonly status: number;
      readonly code: string;
      readonly message: string;
    };

function baseUrl(): string {
  const url = process.env.CORE_API_URL;
  if (!url) throw new Error('CORE_API_URL no está configurada');
  return url.replace(/\/+$/u, '');
}

interface CoreErrorBody {
  error?: { code?: string; message?: string };
  message?: string;
}

/**
 * Calls the core and turns anything that is not a success into a typed refusal.
 *
 * A thrown exception would become a five hundred on a screen whose whole job is
 * to explain what happened, so a 403 arrives here as a 403 with its code and is
 * rendered as «no tiene permiso» rather than as a crash. A network failure is
 * reported as a dependency that did not answer, which is a different sentence
 * from «there is nothing to show».
 */
export async function callCore<T>(
  path: string,
  session: AdminSession,
  init: {
    method?: string;
    body?: unknown;
    search?: URLSearchParams;
    /**
     * How long this call may take before it is abandoned.
     *
     * A call with no deadline is a call that can hang forever, and a screen
     * waiting on one is indistinguishable from a screen that is broken. It is
     * left unset for the reads a person is waiting on, where the page already
     * bounds the wait, and set for the calls made on the path that serves a
     * file to a reader, where the register must never be able to hold the
     * download open.
     */
    timeoutMs?: number;
  } = {},
): Promise<CoreResult<T>> {
  const search = init.search?.toString();
  const url = `${baseUrl()}${path}${search ? `?${search}` : ''}`;
  try {
    const response = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        authorization: `Bearer ${mintCoreToken(session)}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      ...(init.timeoutMs === undefined ? {} : { signal: AbortSignal.timeout(init.timeoutMs) }),
      cache: 'no-store',
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as CoreErrorBody;
      return {
        ok: false,
        status: response.status,
        code: body.error?.code ?? `HTTP_${response.status}`,
        message: body.error?.message ?? body.message ?? 'El núcleo rechazó la petición',
      };
    }
    return { ok: true, body: (await response.json()) as CoreEnvelope<T> };
  } catch (error) {
    // The detail belongs in the server log: a connection message can carry the
    // host and the port of a service that is not meant to be addressable.
    console.error('[observatorio] el núcleo no respondió', error);
    return {
      ok: false,
      status: 503,
      code: 'CORE_UNAVAILABLE',
      message: 'El núcleo no respondió',
    };
  }
}

/** True when this deployment has everything it needs to reach the core. */
export function coreIsConfigured(): boolean {
  return Boolean(process.env.CORE_API_URL && process.env.ADMIN_JWT_PRIVATE_KEY);
}

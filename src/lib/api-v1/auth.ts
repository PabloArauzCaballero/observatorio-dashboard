import 'server-only';
import { createHash } from 'node:crypto';
import { callCore } from '@/lib/admin/core-client';
import type { AdminSession } from '@/lib/admin/session';
import { admit } from '@/lib/ip-limit';
import { PLANS, SERVICES_PATH, type Plan } from '@/lib/plans';
import {
  BURST_PER_MINUTE,
  decideAccess,
  parseBearer,
  quotaHeaders,
  type VerifiedAccount,
} from './contrato';

/**
 * Quién llama a `/api/v1` y si puede.
 *
 * La llave no se guarda en ningún lado del sitio: viaja al núcleo como su
 * huella sha256, y el núcleo —el único que escribe— dice de quién es, si el
 * plan está vigente y cuántas consultas lleva el mes, contando esta. El sitio
 * se presenta con un rol propio, `SITE_SUBSCRIPTIONS`, que no lee ni toca nada
 * más que eso.
 */
function apiIdentity(): AdminSession {
  return {
    subject: process.env.SITE_TELEMETRY_SUBJECT ?? 'observatorio-dashboard',
    name: 'Sitio público (API)',
    roles: ['SITE_SUBSCRIPTIONS'],
    expiresAt: Math.floor(Date.now() / 1000) + 120,
    csrf: '',
  };
}

const VERIFY_PATH = '/api/v1/site/subscriptions/api-keys/verify';
const VERIFY_TIMEOUT_MS = 4_000;
const MINUTE_MS = 60_000;

/** Lo que una ruta necesita saber de quien llama. */
export interface ApiCaller {
  account: VerifiedAccount;
  plan: Plan;
  used: number;
  /** Los encabezados de cupo, ya calculados para esta respuesta. */
  headers: Record<string, string>;
}

/** Permitir `GET` desde cualquier origen con la llave en `Authorization`. */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization',
  'Access-Control-Expose-Headers': 'X-Cupo-Limite, X-Cupo-Restante, X-Cupo-Reinicio, Retry-After, X-Siguiente',
  'Access-Control-Max-Age': '86400',
};

/** Un error de la API: siempre JSON, siempre con CORS y cupo. */
export function apiError(
  status: number,
  error: string,
  headers: Record<string, string>,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json(
    { error, ...extra },
    { status, headers: { ...CORS_HEADERS, ...headers, 'Cache-Control': 'no-store' } },
  );
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Autoriza un pedido o devuelve la respuesta de error ya armada.
 *
 * El freno por minuto va antes del núcleo: una llave que insiste sesenta veces
 * por minuto no gasta su cupo mensual ni hace trabajar al núcleo de más.
 */
export async function authorize(
  request: Request,
): Promise<{ ok: true; caller: ApiCaller } | { ok: false; response: Response }> {
  const now = new Date();
  const anonymous = quotaHeaders(0, 0, now);
  const key = parseBearer(request.headers.get('authorization'));
  if (!key) {
    return {
      ok: false,
      response: apiError(
        401,
        'Falta la llave. Va en el encabezado «Authorization: Bearer obs_live_…».',
        { ...anonymous, 'WWW-Authenticate': 'Bearer realm="api-v1"' },
      ),
    };
  }
  const keyHash = sha256(key);

  const burst = admit('api-v1', keyHash, BURST_PER_MINUTE, MINUTE_MS);
  if (!burst.ok) {
    return {
      ok: false,
      response: apiError(
        429,
        `Más de ${BURST_PER_MINUTE} consultas por minuto con esta llave. Conviene espaciarlas.`,
        { ...anonymous, 'Retry-After': String(burst.retryAfter) },
      ),
    };
  }

  const result = await callCore<{ account: VerifiedAccount; used: number }>(
    VERIFY_PATH,
    apiIdentity(),
    {
      method: 'POST',
      body: { keyHash, usageKind: 'API', amount: 1 },
      timeoutMs: VERIFY_TIMEOUT_MS,
    },
  ).catch((error: unknown) => {
    // Sin `CORE_API_URL` o sin la llave privada, `callCore` lanza antes de pedir.
    console.error('[observatorio] api-v1: no se pudo preguntar al núcleo', error);
    return { ok: false as const, status: 503, code: 'CORE_UNAVAILABLE', message: '' };
  });

  // Un 200 sin la forma pactada se trata como un núcleo que no respondió bien,
  // no como una llave válida.
  const answered = result.ok ? result.body?.data : undefined;
  const verify =
    answered?.account && typeof answered.used === 'number'
      ? { status: 200 as const, account: answered.account, used: answered.used }
      : { status: result.ok ? 503 : result.status };
  const plan = verify.account ? PLANS.find((one) => one.code === verify.account.planCode) : undefined;
  const limit = plan?.apiPorMes ?? 0;
  const used = verify.used ?? 0;
  const headers = verify.account ? quotaHeaders(limit, used, now) : anonymous;

  const decision = decideAccess(verify, plan ? limit : null, now);
  if (!decision.ok) {
    const extra = decision.status === 402 || decision.status === 429 ? { planes: SERVICES_PATH } : {};
    return {
      ok: false,
      response: apiError(
        decision.status,
        decision.status === 402
          ? `${decision.error} Los planes están en https://datosbolivia.com${SERVICES_PATH}`
          : decision.error,
        {
          ...headers,
          ...(decision.retryAfter ? { 'Retry-After': String(decision.retryAfter) } : {}),
          ...(decision.status === 401 ? { 'WWW-Authenticate': 'Bearer error="invalid_token"' } : {}),
        },
        extra,
      ),
    };
  }

  return {
    ok: true,
    caller: { account: verify.account as VerifiedAccount, plan: plan as Plan, used, headers },
  };
}

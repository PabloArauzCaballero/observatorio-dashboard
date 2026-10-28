import 'server-only';
import { createHash } from 'node:crypto';
import { callCore } from '@/lib/admin/core-client';
import type { AdminSession } from '@/lib/admin/session';
import { admit, clientIp } from '@/lib/ip-limit';
import { PLANS, SERVICES_PATH, type Plan } from '@/lib/plans';
import {
  FAILED_KEYS_PER_WINDOW,
  FailureLedger,
  PlanMemory,
  burstPerMinute,
  decideAccess,
  quotaHeaders,
  readBearer,
  type FailureTicket,
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

/** El plan de cada llave que el núcleo aceptó en el último minuto. */
const plans = new PlanMemory();

/** Las llaves rechazadas de cada dirección en los últimos diez minutos. */
const failures = new FailureLedger();

/** El 429 de una dirección que ya probó demasiadas llaves: no se pregunta al núcleo. */
function tooManyFailures(retryAfter: number, headers: Record<string, string>): Response {
  return apiError(
    429,
    `Más de ${FAILED_KEYS_PER_WINDOW} llaves rechazadas desde esta dirección en diez minutos. Conviene revisar la llave y esperar.`,
    { ...headers, 'Retry-After': String(retryAfter) },
  );
}

/** Lo que una ruta necesita saber de quien llama. */
export interface ApiCaller {
  account: VerifiedAccount;
  plan: Plan;
  used: number;
  /** Los encabezados de cupo, ya calculados para esta respuesta. */
  headers: Record<string, string>;
}

/** Los encabezados propios que un cliente en el navegador necesita poder leer. */
export const EXPOSED_HEADERS = [
  'X-Cupo-Limite',
  'X-Cupo-Restante',
  'X-Cupo-Reinicio',
  'Retry-After',
  'X-Siguiente',
  'X-Tope-Lugares',
  'X-Lectura-Truncada',
] as const;

/** Permitir `GET` desde cualquier origen con la llave en `Authorization`. */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization',
  'Access-Control-Expose-Headers': EXPOSED_HEADERS.join(', '),
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

const planByCode = (code: string | undefined): Plan | undefined =>
  code === undefined ? undefined : PLANS.find((one) => one.code === code);

/**
 * Autoriza un pedido o devuelve la respuesta de error ya armada.
 *
 * El freno por minuto va antes del núcleo y se reserva antes de cualquier
 * espera: una llave que insiste más de lo que admite su plan no gasta su cupo
 * mensual ni hace trabajar al núcleo de más, y dos pedidos simultáneos no ven
 * los dos el mismo lugar libre. El ritmo es el del plan que el núcleo dio para
 * esa llave en el último minuto; una llave que no se recuerda va con el ritmo
 * por omisión hasta que el núcleo la verifica.
 *
 * Antes todavía, cada dirección tiene un cupo de llaves rechazadas (mal
 * escritas, desconocidas o revocadas): quien inventa una llave por pedido no
 * toca el freno por llave, y sin este cupo haría trabajar al núcleo sin fin.
 * Una llave que el núcleo aceptó en el último minuto no pasa por él: una
 * oficina con un programa mal configurado no deja sin servicio a la llave buena.
 */
export async function authorize(
  request: Request,
): Promise<{ ok: true; caller: ApiCaller } | { ok: false; response: Response }> {
  const now = new Date();
  const anonymous = quotaHeaders(0, 0, now);
  const bearer = readBearer(request.headers.get('authorization'));
  const address = clientIp(request);
  if (bearer.kind === 'malformed') {
    const admission = failures.admit(address, now.getTime());
    if (!admission.ok) return { ok: false, response: tooManyFailures(admission.retryAfter, anonymous) };
    admission.ticket.confirm();
  }
  if (bearer.kind !== 'key') {
    return {
      ok: false,
      response: apiError(
        401,
        bearer.kind === 'missing'
          ? 'Falta la llave. Va en el encabezado «Authorization: Bearer obs_live_…».'
          : 'La llave no tiene la forma «obs_live_» seguida de 43 caracteres. Va en el encabezado «Authorization: Bearer obs_live_…».',
        {
          ...anonymous,
          'WWW-Authenticate':
            bearer.kind === 'missing'
              ? 'Bearer realm="api-v1"'
              : 'Bearer realm="api-v1", error="invalid_token"',
        },
      ),
    };
  }
  const keyHash = sha256(bearer.key);

  // Sincrónico de punta a punta: la reserva queda anotada antes del primer `await`.
  const remembered = plans.recall(keyHash, now.getTime());
  let ticket: FailureTicket | null = null;
  if (!remembered) {
    const admission = failures.admit(address, now.getTime());
    if (!admission.ok) return { ok: false, response: tooManyFailures(admission.retryAfter, anonymous) };
    ticket = admission.ticket;
  }
  const perMinute = burstPerMinute(remembered?.planCode, PLANS);
  const burst = admit('api-v1', keyHash, perMinute, MINUTE_MS);
  if (!burst.ok) {
    ticket?.release();
    const known = planByCode(remembered?.planCode);
    return {
      ok: false,
      response: apiError(
        429,
        `Más de ${perMinute} consultas por minuto con esta llave. Conviene espaciarlas.`,
        {
          // El cupo del mes, tal como estaba en la última consulta respondida:
          // un pedido frenado aquí no llega al núcleo y no lo cambia.
          ...(known && remembered ? quotaHeaders(known.apiPorMes, remembered.used, now) : anonymous),
          'Retry-After': String(burst.retryAfter),
        },
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
  const plan = planByCode(verify.account?.planCode);
  const limit = plan?.apiPorMes ?? 0;
  const used = verify.used ?? 0;
  const headers = verify.account ? quotaHeaders(limit, used, now) : anonymous;

  const decision = decideAccess(verify, plan ? limit : null, now);
  // Solo una llave que el núcleo no conoce es un rechazo; un núcleo caído no lo es.
  if (decision.ok || decision.status !== 401) ticket?.release();
  else ticket?.confirm();
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
          ...(decision.status === 401
            ? { 'WWW-Authenticate': 'Bearer realm="api-v1", error="invalid_token"' }
            : {}),
        },
        extra,
      ),
    };
  }

  // `decideAccess` solo deja pasar una cuenta con plan conocido.
  const account = verify.account as VerifiedAccount;
  plans.remember(keyHash, { planCode: account.planCode, used }, Date.now());
  return { ok: true, caller: { account, plan: plan as Plan, used, headers } };
}

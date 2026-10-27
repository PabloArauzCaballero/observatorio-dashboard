import 'server-only';
import { cookies } from 'next/headers';
import { callCore, type CoreResult } from '../admin/core-client';
import type { AdminSession } from '../admin/session';
import { PLANS, type Plan } from '../plans';
import {
  CUENTA_COOKIE,
  CUENTA_TTL_SECONDS,
  deriveCustomerSecret,
  encodeCustomerCookie,
  isSameOrigin,
  planFor,
  readCookieHeader,
  sessionFromAccount,
  verifyCustomerCookie,
  type AccountDetail,
  type AccountSummary,
  type CustomerSession,
  type UsageKind,
} from './puro';

/**
 * La cuenta de cliente del lado del servidor: la cookie, la identidad con que
 * el sitio habla con el núcleo y una función por cada ruta del núcleo.
 *
 * El sitio no guarda cuentas ni contraseñas: las tiene el núcleo. Lo único que
 * queda aquí es una cookie firmada con lo justo para decidir cupos —quién es,
 * qué plan tiene y si estaba vigente al entrar— durante ocho horas.
 */

const SITE_BASE = '/api/v1/site/subscriptions';

/** El sitio ante el núcleo, con el único rol que necesita para las cuentas. */
export function subscriptionsIdentity(): AdminSession {
  return {
    subject: process.env.SITE_TELEMETRY_SUBJECT ?? 'observatorio-dashboard',
    name: 'Sitio público',
    roles: ['SITE_SUBSCRIPTIONS'],
    expiresAt: Math.floor(Date.now() / 1000) + 120,
    csrf: '',
  };
}

/** Si este despliegue puede tener cuentas: hace falta el núcleo y un secreto para la cookie. */
export function accountsAreConfigured(): boolean {
  return Boolean(process.env.CORE_API_URL && process.env.ADMIN_JWT_PRIVATE_KEY && customerSecret());
}

function customerSecret(): string | null {
  return deriveCustomerSecret({
    CUENTA_SESSION_SECRET: process.env.CUENTA_SESSION_SECRET,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  });
}

/* --------------------------------- Cookie -------------------------------- */

/** `secure` cuando la persona llegó por https; por http a la IP cruda el navegador la descartaría. */
function isHttps(request: Request): boolean {
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (proto) return proto === 'https';
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

export function customerCookieOptions(request: Request, maxAge: number = CUENTA_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isHttps(request),
    path: '/',
    maxAge,
  };
}

/** Abre la sesión de una cuenta en la respuesta que se está armando. */
export async function startCustomerSession(request: Request, account: AccountSummary): Promise<boolean> {
  const secret = customerSecret();
  if (!secret) return false;
  const store = await cookies();
  store.set(CUENTA_COOKIE, encodeCustomerCookie(sessionFromAccount(account), secret), customerCookieOptions(request));
  return true;
}

export async function endCustomerSession(request: Request): Promise<void> {
  const store = await cookies();
  store.set(CUENTA_COOKIE, '', customerCookieOptions(request, 0));
}

/**
 * El cliente de la petición en curso, o `null`.
 *
 * Con una `Request` lee su encabezado `Cookie`; sin ella, la cookie de la
 * página o la ruta que se está sirviendo.
 */
export async function currentCustomer(request?: Request): Promise<CustomerSession | null> {
  const secret = customerSecret();
  if (!secret) return null;
  const value = request
    ? readCookieHeader(request.headers.get('cookie'), CUENTA_COOKIE)
    : (await cookies()).get(CUENTA_COOKIE)?.value;
  return verifyCustomerCookie(value, secret);
}

const FRESH_MS = 60_000;
const fresh = new Map<string, { at: number; result: CoreResult<AccountDetail> }>();

/**
 * La cuenta tal como la ve el núcleo ahora, guardada sesenta segundos.
 *
 * La cookie dice quién es; si tiene plan y si está vigente lo dice esto. Una
 * cookie firmada hace horas no sabe que la cuenta se suspendió o que el plan
 * cambió, así que ningún permiso sale de ella. Solo se guardan las respuestas
 * buenas: un núcleo caído se vuelve a preguntar en el pedido siguiente, y
 * mientras tanto rigen los topes del plan gratuito.
 */
export async function freshAccount(accountId: string): Promise<CoreResult<AccountDetail>> {
  const now = Date.now();
  const kept = fresh.get(accountId);
  if (kept && now - kept.at < FRESH_MS) return kept.result;
  const result = await readAccount(accountId);
  if (result.ok) {
    fresh.set(accountId, { at: now, result });
    if (fresh.size > 5_000) {
      for (const [key, entry] of fresh) if (now - entry.at >= FRESH_MS) fresh.delete(key);
    }
  } else {
    fresh.delete(accountId);
  }
  return result;
}

/** Olvida la cuenta guardada: después de un cambio, la lectura siguiente va al núcleo. */
export function forgetAccount(accountId: string): void {
  fresh.delete(accountId);
}

/**
 * El plan de un cliente con la cuenta vigente según el núcleo; `null` para
 * todos los demás, incluida una cuenta que el núcleo no pudo confirmar.
 */
export async function entitledPlan(request: Request): Promise<{ customer: CustomerSession; plan: Plan } | null> {
  const customer = await currentCustomer(request);
  if (!customer) return null;
  const result = await freshAccount(customer.accountId);
  if (!result.ok || !result.body.data.account.entitled) return null;
  const plan = planFor(PLANS, result.body.data.account.planCode);
  return plan ? { customer, plan } : null;
}

/** Si un POST salió de una página de este mismo sitio. */
export function requestIsSameOrigin(request: Request): boolean {
  return isSameOrigin({
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    host: request.headers.get('host'),
    forwardedHost: request.headers.get('x-forwarded-host'),
  });
}

/* ----------------------------- Rutas del núcleo ---------------------------- */

const site = <T>(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<CoreResult<T>> =>
  callCore<T>(`${SITE_BASE}${path}`, subscriptionsIdentity(), { timeoutMs: 8_000, ...init });

export const signIn = (email: string, password: string) =>
  site<{ account: AccountSummary }>('/sessions', { method: 'POST', body: { email, password } });

export const readAccount = (accountId: string) =>
  site<AccountDetail>(`/accounts/${encodeURIComponent(accountId)}`);

export const createApiKey = (accountId: string, label: string, maxActiveKeys: number) =>
  site<{ apiKeyId: string; prefix: string; key: string }>(`/accounts/${encodeURIComponent(accountId)}/api-keys`, {
    method: 'POST',
    body: { label, maxActiveKeys },
  });

export const revokeApiKey = (accountId: string, apiKeyId: string) =>
  site<undefined>(`/accounts/${encodeURIComponent(accountId)}/api-keys/${encodeURIComponent(apiKeyId)}/revoke`, {
    method: 'POST',
  });

export const changePassword = (accountId: string, currentPassword: string, newPassword: string) =>
  site<undefined>(`/accounts/${encodeURIComponent(accountId)}/password`, {
    method: 'POST',
    body: { currentPassword, newPassword },
  });

export const activateAccount = (token: string, password: string, termsVersion: string) =>
  site<{ account: AccountSummary }>('/activations', { method: 'POST', body: { token, password, termsVersion } });

/**
 * Suma consumo a la cuenta, sin esperar ni fallar.
 *
 * Se llama desde la ruta que entrega un archivo o una respuesta del chat: que
 * el núcleo tarde o no conteste no puede retener ni romper esa entrega, así que
 * la llamada tiene un plazo corto y su resultado se descarta. Un consumo que no
 * se anotó es un error a favor del cliente, nunca en su contra.
 */
export function recordUsage(accountId: string, usageKind: UsageKind, amount = 1): void {
  if (!process.env.CORE_API_URL || !process.env.ADMIN_JWT_PRIVATE_KEY) return;
  void site<{ used: number }>('/usage', {
    method: 'POST',
    body: { subscriberAccountId: accountId, usageKind, amount },
    timeoutMs: 2_500,
  }).catch(() => undefined);
}

/** Respuesta JSON de error, siempre con un mensaje genérico y sin caché. */
export function refuse(status: number, code: string, message: string, headers: Record<string, string> = {}): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { 'cache-control': 'no-store', ...headers } },
  );
}

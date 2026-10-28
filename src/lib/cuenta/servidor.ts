import 'server-only';
import { cookies } from 'next/headers';
import { callCore, type CoreResult } from '../admin/core-client';
import type { AdminSession } from '../admin/session';
import { PLANS, type Plan } from '../plans';
import {
  CUENTA_COOKIE,
  CUENTA_TTL_SECONDS,
  accountLinkEmail,
  deriveCustomerSecret,
  encodeCustomerCookie,
  isOwnerSession,
  isSameOrigin,
  planFor,
  readCookieHeader,
  sessionFromAccount,
  sessionIsCurrent,
  siteOrigin,
  verifyCustomerCookie,
  type AccountDetail,
  type AccountSummary,
  type BillingChanges,
  type CustomerSession,
  type LinkPurpose,
  type MemberRecord,
  type MemberSummary,
  type SessionMember,
  type SignedInMember,
  type UsageKind,
} from './puro';

/**
 * La cuenta de cliente del lado del servidor: la cookie, la identidad con que
 * el sitio habla con el núcleo y una función por cada ruta del núcleo.
 *
 * El sitio no guarda cuentas ni contraseñas: las tiene el núcleo. Lo único que
 * queda aquí es una cookie firmada con quién ingresó y con qué versión de
 * sesión, durante ocho horas. Plan, vigencia y validez de la sesión se le
 * preguntan al núcleo (`freshAccount`).
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

/**
 * Abre —o vuelve a emitir— la sesión en la respuesta que se está armando.
 *
 * Sirve para la titular (`member` nulo) y para un miembro. Devuelve `false` sin
 * tocar la cookie si falta el secreto o si el núcleo no mandó una versión de
 * sesión: una cookie sin versión no se podría cerrar desde el núcleo.
 */
export async function startCustomerSession(
  request: Request,
  account: AccountSummary,
  member: SessionMember | null = null,
): Promise<boolean> {
  const secret = customerSecret();
  if (!secret) return false;
  const session = sessionFromAccount(account, member);
  if (!session) return false;
  const store = await cookies();
  store.set(CUENTA_COOKIE, encodeCustomerCookie(session, secret), customerCookieOptions(request));
  return true;
}

export async function endCustomerSession(request: Request): Promise<void> {
  const store = await cookies();
  store.set(CUENTA_COOKIE, '', customerCookieOptions(request, 0));
}

/**
 * La sesión firmada de la petición en curso, o `null`.
 *
 * Solo comprueba la firma y el vencimiento: dice quién dice ser, no si la
 * sesión sigue en pie. Para eso, `freshAccount` o `customerFor`.
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

/* ------------------------- La cuenta según el núcleo ------------------------ */

const FRESH_MS = 60_000;
const CACHE_MAX = 5_000;

interface Kept<T> {
  at: number;
  value: T;
}

type Read<T> = { ok: true; value: T; cached: boolean } | { ok: false; status: number };

const accountCache = new Map<string, Kept<AccountDetail>>();
const memberCache = new Map<string, Kept<MemberRecord>>();
const memberKey = (accountId: string, memberId: string): string => `${accountId}/${memberId}`;

/**
 * Lee algo del núcleo pasando por una memoria de sesenta segundos. Solo se
 * guardan las respuestas buenas y con la forma esperada: un núcleo caído se
 * vuelve a preguntar en el pedido siguiente. `cached` dice si la respuesta
 * salió de la memoria.
 */
async function throughCache<T>(
  cache: Map<string, Kept<T>>,
  key: string,
  read: () => Promise<{ ok: true; value: T | null } | { ok: false; status: number }>,
): Promise<Read<T>> {
  const now = Date.now();
  const kept = cache.get(key);
  if (kept && now - kept.at < FRESH_MS) return { ok: true, value: kept.value, cached: true };
  const result = await read();
  if (!result.ok || result.value === null) {
    cache.delete(key);
    // Un 200 sin la forma pactada es un núcleo que no se puede leer, no una sesión cerrada.
    return { ok: false, status: result.ok ? 503 : result.status };
  }
  cache.set(key, { at: now, value: result.value });
  if (cache.size > CACHE_MAX) {
    for (const [clave, entry] of cache) if (now - entry.at >= FRESH_MS) cache.delete(clave);
  }
  return { ok: true, value: result.value, cached: false };
}

const accountRead = (accountId: string) => async () => {
  const result = await readAccount(accountId);
  if (!result.ok) return result;
  const detail = result.body?.data;
  return { ok: true as const, value: detail?.account ? detail : null };
};

const memberRead = (accountId: string, memberId: string) => async () => {
  const result = await readMember(accountId, memberId);
  if (!result.ok) return result;
  return { ok: true as const, value: result.body?.data?.member ?? null };
};

/** Olvida la cuenta guardada: después de un cambio, la lectura siguiente va al núcleo. */
export function forgetAccount(accountId: string): void {
  accountCache.delete(accountId);
}

/** Olvida un miembro guardado, por la misma razón. */
export function forgetMember(accountId: string, memberId: string): void {
  memberCache.delete(memberKey(accountId, memberId));
}

export type FreshAccount =
  | { ok: true; detail: AccountDetail; member: MemberRecord | null }
  /**
   * `revoked`: la sesión ya no vale (otra versión, un miembro quitado, una
   * cuenta que no existe) y la cookie se borra. Si no, el núcleo no pudo
   * confirmarla y se vuelve a preguntar en el pedido siguiente.
   */
  | { ok: false; revoked: boolean; status: number };

async function checkSession(session: CustomerSession): Promise<FreshAccount & { cached: boolean }> {
  const [cuenta, miembro] = await Promise.all([
    throughCache(accountCache, session.accountId, accountRead(session.accountId)),
    session.mid
      ? throughCache(memberCache, memberKey(session.accountId, session.mid), memberRead(session.accountId, session.mid))
      : Promise.resolve(null),
  ]);
  if (!cuenta.ok) return { ok: false, revoked: cuenta.status === 404, status: cuenta.status, cached: false };
  if (miembro && !miembro.ok) return { ok: false, revoked: miembro.status === 404, status: miembro.status, cached: false };
  const member = miembro?.ok ? miembro.value : null;
  const cached = cuenta.cached || Boolean(miembro?.ok && miembro.cached);
  if (!sessionIsCurrent(session, cuenta.value.account, member)) return { ok: false, revoked: true, status: 401, cached };
  return { ok: true, detail: cuenta.value, member, cached };
}

/**
 * La cuenta tal como la ve el núcleo ahora, guardada sesenta segundos, y si la
 * sesión de la cookie sigue en pie.
 *
 * La cookie dice quién es; si tiene plan, si está vigente y si su sesión no se
 * cerró lo dice esto. Una cookie firmada hace horas no sabe que la cuenta se
 * suspendió, que la contraseña cambió o que su miembro fue quitado, así que
 * ningún permiso sale de ella.
 *
 * Si las versiones no coinciden con datos de la memoria se pregunta una vez
 * más al núcleo: una sesión recién abierta en otro equipo trae una versión más
 * nueva que la guardada y no debe cerrarse por eso.
 */
export async function freshAccount(session: CustomerSession): Promise<FreshAccount> {
  let estado = await checkSession(session);
  if (!estado.ok && estado.revoked && estado.cached) {
    forgetAccount(session.accountId);
    if (session.mid) forgetMember(session.accountId, session.mid);
    estado = await checkSession(session);
  }
  if (estado.ok) return { ok: true, detail: estado.detail, member: estado.member };
  return { ok: false, revoked: estado.revoked, status: estado.status };
}

/** Lo que una ruta de la cuenta sabe de quien la llama, ya confirmado con el núcleo. */
export interface CustomerContext {
  customer: CustomerSession;
  detail: AccountDetail;
  /** El miembro que ingresó; `null` para la titular. */
  member: MemberRecord | null;
  plan: Plan | undefined;
}

/**
 * Quien llama a una ruta de la cuenta, o la respuesta que lo rechaza.
 *
 * `owner` reserva la ruta a la persona titular: llaves, equipo, facturación y
 * cierre de sesiones. La decisión se toma aquí, en el servidor, con la cookie
 * firmada; que la página esconda un botón no protege nada. Una sesión cerrada
 * en el núcleo borra la cookie en la misma respuesta.
 */
export async function customerFor(
  request: Request,
  need: 'any' | 'owner' = 'any',
): Promise<CustomerContext | Response> {
  const customer = await currentCustomer(request);
  if (!customer) return refuse(401, 'UNAUTHORIZED', 'La sesión venció. Volver a ingresar.');
  if (need === 'owner' && !isOwnerSession(customer)) {
    return refuse(403, 'OWNER_ONLY', 'Solo la persona titular de la cuenta puede hacer este cambio.');
  }
  const fresh = await freshAccount(customer);
  if (!fresh.ok) {
    if (fresh.revoked) {
      await endCustomerSession(request);
      return refuse(401, 'UNAUTHORIZED', 'La sesión se cerró. Volver a ingresar.');
    }
    return refuse(503, 'CORE_UNAVAILABLE', 'No se pudo verificar la cuenta. Intentar de nuevo en unos minutos.');
  }
  return { customer, detail: fresh.detail, member: fresh.member, plan: planFor(PLANS, fresh.detail.account.planCode) };
}

/**
 * Vuelve a emitir la cookie de quien está conectado con las versiones de
 * sesión que el núcleo tiene ahora: después de cambiar la contraseña o de
 * cerrar las demás sesiones, la propia queda en pie y las otras no.
 */
export async function reissueCustomerSession(request: Request, customer: CustomerSession): Promise<boolean> {
  forgetAccount(customer.accountId);
  if (customer.mid) forgetMember(customer.accountId, customer.mid);
  const cuenta = await readAccount(customer.accountId);
  const account = cuenta.ok ? cuenta.body?.data?.account : undefined;
  if (!account) return false;
  if (!customer.mid) return startCustomerSession(request, account);
  const leido = await readMember(customer.accountId, customer.mid);
  const member = leido.ok ? leido.body?.data?.member : undefined;
  if (!member || member.status !== 'ACTIVE' || member.memberId !== customer.mid) return false;
  return startCustomerSession(request, account, member);
}

/**
 * El plan de un cliente con la cuenta vigente según el núcleo; `null` para
 * todos los demás, incluida una cuenta que el núcleo no pudo confirmar y una
 * sesión cerrada, cuya cookie se borra de paso.
 */
export async function entitledPlan(request: Request): Promise<{ customer: CustomerSession; plan: Plan } | null> {
  const customer = await currentCustomer(request);
  if (!customer) return null;
  const fresh = await freshAccount(customer);
  if (!fresh.ok) {
    if (fresh.revoked) {
      // Fuera de una ruta que pueda escribir cookies esto falla; la sesión igual cuenta como anónima.
      await endCustomerSession(request).catch(() => undefined);
    }
    return null;
  }
  if (!fresh.detail.account.entitled) return null;
  const plan = planFor(PLANS, fresh.detail.account.planCode);
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

const cuentaPath = (accountId: string): string => `/accounts/${encodeURIComponent(accountId)}`;
const miembroPath = (accountId: string, memberId: string): string =>
  `${cuentaPath(accountId)}/members/${encodeURIComponent(memberId)}`;

/** Titulares y miembros ingresan por la misma ruta; `member` dice cuál de los dos fue. */
export const signIn = (email: string, password: string) =>
  site<{ account: AccountSummary; member?: SignedInMember | null }>('/sessions', {
    method: 'POST',
    body: { email, password },
  });

export const readAccount = (accountId: string) => site<AccountDetail>(cuentaPath(accountId));

export const createApiKey = (accountId: string, label: string, maxActiveKeys: number) =>
  site<{ apiKeyId: string; prefix: string; key: string }>(`${cuentaPath(accountId)}/api-keys`, {
    method: 'POST',
    body: { label, maxActiveKeys },
  });

export const revokeApiKey = (accountId: string, apiKeyId: string) =>
  site<undefined>(`${cuentaPath(accountId)}/api-keys/${encodeURIComponent(apiKeyId)}/revoke`, { method: 'POST' });

export const changePassword = (accountId: string, currentPassword: string, newPassword: string) =>
  site<undefined>(`${cuentaPath(accountId)}/password`, { method: 'POST', body: { currentPassword, newPassword } });

/**
 * Fija la contraseña con un enlace. El núcleo sabe si el enlace era de la
 * titular o de un miembro; `member` lo dice cuando la respuesta lo trae.
 */
export const activateAccount = (token: string, password: string, termsVersion: string) =>
  site<{ account: AccountSummary; member?: SignedInMember | null }>('/activations', {
    method: 'POST',
    body: { token, password, termsVersion },
  });

/** Datos de facturación: `null` borra un campo. */
export const updateBilling = (accountId: string, changes: BillingChanges) =>
  site<{ account: AccountSummary }>(cuentaPath(accountId), { method: 'PATCH', body: changes });

/** Cierra todas las sesiones de la cuenta: sube su versión de sesión. */
export const revokeSessions = (accountId: string) =>
  site<{ account: AccountSummary }>(`${cuentaPath(accountId)}/sessions/revoke`, { method: 'POST' });

/**
 * Pide un enlace de recuperación. 201 con el token si el correo es de una
 * titular o de un miembro; 202 sin nada si no. Quien llama responde lo mismo
 * en los dos casos.
 */
export const requestPasswordReset = (email: string) =>
  site<Partial<{ token: string; expiresAt: string; email: string; fullName: string; memberId: string | null }> | undefined>(
    '/password-resets',
    { method: 'POST', body: { email } },
  );

export const listMembers = (accountId: string) => site<{ items: MemberSummary[] }>(`${cuentaPath(accountId)}/members`);

export const readMember = (accountId: string, memberId: string) =>
  site<{ member: MemberRecord }>(miembroPath(accountId, memberId));

export const inviteMember = (accountId: string, email: string, fullName: string, maxMembers: number) =>
  site<{ member: MemberSummary; activationToken: string; activationExpiresAt: string }>(
    `${cuentaPath(accountId)}/members`,
    { method: 'POST', body: { email, fullName, maxMembers } },
  );

export const removeMember = (accountId: string, memberId: string) =>
  site<undefined>(`${miembroPath(accountId, memberId)}/remove`, { method: 'POST' });

export const changeMemberPassword = (accountId: string, memberId: string, currentPassword: string, newPassword: string) =>
  site<undefined>(`${miembroPath(accountId, memberId)}/password`, {
    method: 'POST',
    body: { currentPassword, newPassword },
  });

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

/* --------------------------------- Correo -------------------------------- */

/** La dirección pública del sitio para los enlaces; nunca sale de la petición. */
export const publicSiteOrigin = (): string => siteOrigin(process.env.NEXT_PUBLIC_SITE_URL);

/** Si este despliegue puede mandar correos: Resend y un remitente. */
export function mailIsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.SERVICIOS_CORREO_REMITENTE?.trim());
}

/**
 * Manda un enlace para fijar la contraseña con la API HTTP de Resend, sin
 * dependencia nueva. Devuelve si salió. Nada del correo llega al registro: ni
 * la dirección ni el enlace, que lleva el token; solo el código de la falla.
 */
export async function mailAccountLink(input: {
  to: string;
  purpose: LinkPurpose;
  fullName: string;
  link: string;
  expiresAt?: string | null;
  accountName?: string | null;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.SERVICIOS_CORREO_REMITENTE?.trim();
  if (!key || !from) return false;
  const { subject, text, html } = accountLinkEmail(input);
  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [input.to], subject, text, html }),
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!respuesta.ok) console.error('[cuenta] Resend rechazó el correo', respuesta.status);
    return respuesta.ok;
  } catch {
    console.error('[cuenta] Resend no respondió');
    return false;
  }
}

/* -------------------------------- Respuestas ------------------------------- */

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * Respuesta JSON de error, siempre con un mensaje genérico y sin caché.
 * `field` dice qué campo del formulario marcar y enfocar.
 */
export function refuse(
  status: number,
  code: string,
  message: string,
  extra: { headers?: Record<string, string>; field?: string } = {},
): Response {
  return Response.json(
    { error: { code, message, ...(extra.field ? { field: extra.field } : {}) } },
    { status, headers: { ...NO_STORE, ...extra.headers } },
  );
}

/** Respuesta JSON buena, sin caché. */
export const answer = (body: unknown, status = 200): Response => Response.json(body, { status, headers: NO_STORE });

/** Un 204 sin caché. */
export const done = (): Response => new Response(null, { status: 204, headers: NO_STORE });

/** El 429 de todos los frenos, con el mismo mensaje. */
export const tooMany = (retryAfter: number): Response =>
  refuse(429, 'RATE_LIMITED', 'Demasiados intentos. Intentar de nuevo en unos minutos.', {
    headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfter))) },
  });

/** El 403 de una petición que no salió de este sitio. */
export const foreignOrigin = (): Response => refuse(403, 'ORIGIN_REJECTED', 'La petición no salió de este sitio.');

/** Lee el cuerpo JSON de una petición; `null` si no lo es. */
export const readJson = async <T>(request: Request): Promise<Partial<T> | null> =>
  (await request.json().catch(() => null)) as Partial<T> | null;

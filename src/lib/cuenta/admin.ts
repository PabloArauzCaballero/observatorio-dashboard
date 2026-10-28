import 'server-only';
import type { Tone } from '@/components/admin/state-badge';
import { callCore, type CoreResult } from '../admin/core-client';
import { currentSession, mutationIsAuthentic, type AdminSession } from '../admin/session';
import { linkMail } from './avisos-puro';
import { mailIsConfigured, sendMail } from './correo';
import {
  activationLink,
  type AccountSummary,
  type BillingPeriod,
  type EffectiveStatus,
  type PaidPlanCode,
  type UsageRow,
} from './puro';

/**
 * Las cuentas de cliente vistas desde el portal. Cada llamada viaja con la
 * identidad del operador (su rol `SUBSCRIPTION_ADMIN`), como los pedidos: si
 * puede o no crear una cuenta lo decide el núcleo, no esta capa.
 */

const ADMIN_BASE = '/api/v1/admin/subscriptions';

/**
 * La cuenta como la lista el portal. `lockedUntil` y `sessionVersion` llegan
 * del núcleo desde la migración 0109; se declaran aquí, opcionales, para que la
 * pantalla funcione también contra un núcleo anterior.
 */
export type AdminAccount = AccountSummary & {
  lockedUntil?: string | null;
  sessionVersion?: number;
  /** El consumo del mes, cuando el listado lo trae. */
  usage?: UsageRow[];
};

export interface AccountPage {
  items: AdminAccount[];
  nextCursor: string | null;
}

/** Un pago tal como lo devuelve el núcleo: el monto viaja como texto (columna `numeric`). */
export interface Payment {
  subscriberPaymentId: string;
  amountBob: string;
  /** `YYYY-MM-DD`: el último día que cubre, en La Paz. */
  coversUntil: string;
  reference: string | null;
  /** El operador que lo registró. */
  recordedBy: string;
  recordedAt: string;
}

/** Una persona más de la cuenta (planes con varios usuarios). */
export interface Member {
  memberId: string;
  email: string;
  fullName: string;
  status: 'ACTIVE' | 'REMOVED';
  createdAt: string;
  /** Si ya fijó su contraseña. */
  activated: boolean;
}

export interface NewAccountInput {
  email: string;
  fullName: string;
  organization?: string;
  planCode: PaidPlanCode;
  billingPeriod: BillingPeriod;
  trialDays?: number;
  serviceInquiryId?: string;
}

/**
 * Los estados que un operador fija a mano. `PENDING` lo pone el núcleo al
 * crear la cuenta sin prueba; `GRACE` y `EXPIRED` los calcula a partir de la
 * vigencia. El esquema del núcleo rechaza cualquier otro.
 */
export const OPERATOR_STATUSES = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'] as const;

/** Los estados guardados por los que el núcleo deja filtrar el listado. */
export const STORED_STATUSES = ['PENDING', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'] as const;

/** El estado efectivo en una palabra, como se lee en el portal. */
export const ADMIN_STATUS_WORDS: Record<EffectiveStatus, string> = {
  TRIAL: 'Prueba',
  ACTIVE: 'Activa',
  GRACE: 'En gracia',
  EXPIRED: 'Vencida',
  SUSPENDED: 'Suspendida',
  PENDING: 'Pendiente',
  CANCELLED: 'Cancelada',
};

export function statusTone(status: EffectiveStatus): Tone {
  if (status === 'TRIAL' || status === 'ACTIVE') return 'ok';
  if (status === 'GRACE' || status === 'PENDING') return 'warn';
  return 'bad';
}

/** Si el ingreso de la cuenta está bloqueado ahora por intentos fallidos. */
export function isLocked(account: Pick<AdminAccount, 'lockedUntil'>, nowMs: number = Date.now()): boolean {
  if (!account.lockedUntil) return false;
  const until = new Date(account.lockedUntil).getTime();
  return Number.isFinite(until) && until > nowMs;
}

/**
 * El núcleo lista cada cuenta como `{ account, usage }`; el portal la quiere
 * plana. Se aplana aquí para que la página no dependa de la forma del núcleo.
 */
export async function listAccounts(session: AdminSession, search: URLSearchParams) {
  const result = await callCore<{
    items: Array<AdminAccount | { account: AdminAccount; usage?: UsageRow[] }>;
    nextCursor: string | null;
  }>(`${ADMIN_BASE}/accounts`, session, { search });
  if (!result.ok) return result;
  const items: AdminAccount[] = (result.body.data?.items ?? []).map((item) =>
    'account' in item ? { ...item.account, ...(item.usage ? { usage: item.usage } : {}) } : item,
  );
  const page: AccountPage = { items, nextCursor: result.body.data?.nextCursor ?? null };
  return { ...result, body: { ...result.body, data: page } };
}

const accountPath = (id: string): string => `${ADMIN_BASE}/accounts/${encodeURIComponent(id)}`;

export const createAccount = (session: AdminSession, input: NewAccountInput) =>
  callCore<{ account: AccountSummary; activationToken: string; activationExpiresAt: string }>(
    `${ADMIN_BASE}/accounts`,
    session,
    { method: 'POST', body: input },
  );

export const updateAccount = (session: AdminSession, id: string, changes: Record<string, unknown>) =>
  callCore<{ account: AdminAccount }>(accountPath(id), session, { method: 'PATCH', body: changes });

export const registerPayment = (
  session: AdminSession,
  id: string,
  payment: { amountBob: number; coversUntil: string; reference?: string },
) =>
  callCore<{ payment: Payment; account: AdminAccount }>(`${accountPath(id)}/payments`, session, {
    method: 'POST',
    body: payment,
  });

export const listPayments = (session: AdminSession, id: string) =>
  callCore<{ items: Payment[] }>(`${accountPath(id)}/payments`, session, { timeoutMs: 8_000 });

export const listMembers = (session: AdminSession, id: string) =>
  callCore<{ items: Member[] }>(`${accountPath(id)}/members`, session, { timeoutMs: 8_000 });

/** Cierra todas las sesiones abiertas de la cuenta y de sus miembros. */
export const revokeSessions = (session: AdminSession, id: string) =>
  callCore<{ account: AdminAccount }>(`${accountPath(id)}/sessions/revoke`, session, { method: 'POST' });

export const issueToken = (session: AdminSession, id: string, purpose: 'ACTIVATE' | 'RESET') =>
  callCore<{ token: string; expiresAt: string }>(`${accountPath(id)}/tokens`, session, {
    method: 'POST',
    body: { purpose },
  });

/**
 * La dirección pública del sitio, para armar el enlace de activación.
 *
 * `NEXT_PUBLIC_SITE_URL` si está; si no, el host por el que llegó el operador.
 * El portal puede vivir en otro dominio, y un enlace al dominio del portal
 * llevaría al cliente al formulario de los operadores.
 */
export function publicOrigin(request: Request): string {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configurada) return configurada.replace(/\/+$/u, '');
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'datosbolivia.com')
    .split(',')[0]
    ?.trim();
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'https';
  return `${proto}://${host}`;
}

export function linkFor(request: Request, token: string): string {
  return activationLink(publicOrigin(request), token);
}

export { mailIsConfigured };

/**
 * Manda el enlace por correo. Devuelve si salió; un fallo no rompe nada,
 * porque el enlace igual se muestra en pantalla para copiarlo.
 */
export async function mailLink(
  to: string,
  fullName: string,
  link: string,
  purpose: 'ACTIVATE' | 'RESET',
): Promise<boolean> {
  const { sent } = await sendMail({ to, ...linkMail(fullName, link, purpose) });
  return sent;
}

/* ------------------------------- Respuestas ------------------------------- */

const noStore = { 'cache-control': 'no-store' };

export function adminError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: noStore });
}

export function adminOk(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: noStore });
}

const unauthorized = (): Response => adminError(401, 'UNAUTHORIZED', 'La sesión venció. Volver a ingresar al portal.');

/** La sesión del operador para una mutación, o la respuesta que la rechaza; igual que en «Pedidos». */
export async function operatorFor(request: Request): Promise<AdminSession | Response> {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!mutationIsAuthentic(session, request.headers, undefined)) {
    return adminError(403, 'CSRF_REJECTED', 'La petición no pasó la verificación de origen. Recargar la página.');
  }
  return session;
}

/** La sesión del operador para una lectura: sin token CSRF, porque no cambia nada. */
export async function operatorForRead(): Promise<AdminSession | Response> {
  return (await currentSession()) ?? unauthorized();
}

/**
 * La respuesta del portal a un rechazo del núcleo, con un mensaje propio.
 *
 * El mensaje del núcleo no se reenvía: está en inglés, puede describir el
 * esquema o repetir un dato de la cuenta. El registro lleva la acción, el
 * código HTTP y el código del núcleo, nunca el cuerpo.
 */
export function coreRefusal(
  action: string,
  result: Extract<CoreResult<unknown>, { ok: false }>,
  conflict = 'La acción choca con el estado actual de la cuenta. Recargar la página.',
): Response {
  console.error('[clientes] el núcleo rechazó', action, result.status, result.code);
  switch (result.status) {
    case 400:
    case 422:
      return adminError(400, 'VALIDATION_ERROR', 'El núcleo no aceptó los datos. Revisarlos y volver a intentar.');
    case 401:
    case 403:
      return adminError(403, 'FORBIDDEN', 'El operador no tiene permiso para esta acción.');
    case 404:
      return adminError(404, 'NOT_FOUND', 'La cuenta no existe o ya no está disponible.');
    case 409:
      return adminError(409, 'CONFLICT', conflict);
    case 503:
      return adminError(503, 'CORE_UNAVAILABLE', 'El núcleo no respondió. Volver a intentar en unos minutos.');
    default:
      return adminError(502, 'CORE_ERROR', 'No se pudo completar la acción. Volver a intentar en unos minutos.');
  }
}

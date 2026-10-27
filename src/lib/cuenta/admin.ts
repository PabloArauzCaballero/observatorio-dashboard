import 'server-only';
import { callCore } from '../admin/core-client';
import { currentSession, mutationIsAuthentic, type AdminSession } from '../admin/session';
import { activationLink, type AccountSummary, type BillingPeriod, type PaidPlanCode, type UsageRow } from './puro';

/**
 * Las cuentas de cliente vistas desde el portal. Cada llamada viaja con la
 * identidad del operador (su rol `SUBSCRIPTION_ADMIN`), como los pedidos: si
 * puede o no crear una cuenta lo decide el núcleo, no esta capa.
 */

const ADMIN_BASE = '/api/v1/admin/subscriptions';

export interface AdminAccount extends AccountSummary {
  /** El consumo del mes, cuando el listado lo trae. */
  usage?: UsageRow[];
}

export interface AccountPage {
  items: AdminAccount[];
  nextCursor: string | null;
}

export interface Payment {
  subscriberPaymentId?: string;
  amountBob: number;
  coversUntil: string;
  reference: string | null;
  createdAt?: string;
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

export const listAccounts = (session: AdminSession, search: URLSearchParams) =>
  callCore<AccountPage>(`${ADMIN_BASE}/accounts`, session, { search });

export const createAccount = (session: AdminSession, input: NewAccountInput) =>
  callCore<{ account: AccountSummary; activationToken: string; activationExpiresAt: string }>(
    `${ADMIN_BASE}/accounts`,
    session,
    { method: 'POST', body: input },
  );

export const updateAccount = (session: AdminSession, id: string, changes: Record<string, unknown>) =>
  callCore<{ account: AccountSummary } | AccountSummary>(`${ADMIN_BASE}/accounts/${encodeURIComponent(id)}`, session, {
    method: 'PATCH',
    body: changes,
  });

export const registerPayment = (
  session: AdminSession,
  id: string,
  payment: { amountBob: number; coversUntil: string; reference?: string },
) =>
  callCore<unknown>(`${ADMIN_BASE}/accounts/${encodeURIComponent(id)}/payments`, session, {
    method: 'POST',
    body: payment,
  });

export const listPayments = (session: AdminSession, id: string) =>
  callCore<{ items: Payment[] } | Payment[]>(`${ADMIN_BASE}/accounts/${encodeURIComponent(id)}/payments`, session);

export const issueToken = (session: AdminSession, id: string, purpose: 'ACTIVATE' | 'RESET') =>
  callCore<{ token: string; expiresAt: string }>(`${ADMIN_BASE}/accounts/${encodeURIComponent(id)}/tokens`, session, {
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

/** Si este despliegue puede mandar correos: Resend y un remitente. */
export function mailIsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.SERVICIOS_CORREO_REMITENTE);
}

/**
 * Manda el enlace por correo con la API HTTP de Resend, sin dependencia nueva.
 * Devuelve si salió; un fallo no rompe nada, porque el enlace igual se muestra
 * en pantalla para copiarlo. El detalle del fallo no se registra: llevaría el
 * correo del cliente.
 */
export async function mailLink(
  to: string,
  fullName: string,
  link: string,
  purpose: 'ACTIVATE' | 'RESET',
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.SERVICIOS_CORREO_REMITENTE;
  if (!key || !from) return false;
  const asunto =
    purpose === 'ACTIVATE' ? 'Activar la cuenta de DatosBolivia.com' : 'Nueva contraseña para DatosBolivia.com';
  const intro =
    purpose === 'ACTIVATE'
      ? 'La cuenta de DatosBolivia.com está lista. Para entrar hace falta fijar una contraseña en este enlace:'
      : 'Se pidió una contraseña nueva para la cuenta de DatosBolivia.com. Para fijarla, abrir este enlace:';
  const texto = `${fullName}:\n\n${intro}\n\n${link}\n\nEl enlace sirve una sola vez y vence en unos días. Si no se esperaba este correo, se puede ignorar.\n\nDatosBolivia.com`;
  const escapar = (valor: string): string =>
    valor.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');
  const html = `<p>${escapar(fullName)}:</p><p>${escapar(intro)}</p><p><a href="${escapar(link)}">${escapar(link)}</a></p><p>El enlace sirve una sola vez y vence en unos días. Si no se esperaba este correo, se puede ignorar.</p><p>DatosBolivia.com</p>`;
  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: asunto, text: texto, html }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!respuesta.ok) console.error('[cuenta] Resend rechazó el correo', respuesta.status);
    return respuesta.ok;
  } catch {
    console.error('[cuenta] Resend no respondió');
    return false;
  }
}

const noStore = { 'cache-control': 'no-store' };

/** La sesión del operador para una mutación, o la respuesta que la rechaza; igual que en «Pedidos». */
export async function operatorFor(request: Request): Promise<AdminSession | Response> {
  const session = await currentSession();
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'La sesión no es válida' } },
      { status: 401, headers: noStore },
    );
  }
  if (!mutationIsAuthentic(session, request.headers, undefined)) {
    return Response.json(
      { error: { code: 'CSRF_REJECTED', message: 'La petición no pasó la verificación de origen' } },
      { status: 403, headers: noStore },
    );
  }
  return session;
}

export function adminError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: noStore });
}

export function adminOk(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: noStore });
}

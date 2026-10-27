import 'server-only';
import { callCore, type CoreResult } from './admin/core-client';
import type { AdminSession } from './admin/session';
import type { InquiryInput } from './inquiry';

/**
 * Los pedidos del formulario de Servicios viajan al núcleo, que es quien escribe.
 *
 * La base que lee el tablero es de solo lectura, y así sigue: el sitio público
 * se presenta ante el núcleo con un rol propio, `SITE_INQUIRY`, que puede dejar
 * un pedido y nada más. Si el sitio se viera comprometido, lo peor que alguien
 * haría con esa identidad es llenar la bandeja de pedidos falsos, no tocar una
 * cifra ni leer los pedidos de otros.
 */
function siteIdentity(): AdminSession {
  return {
    subject: process.env.SITE_TELEMETRY_SUBJECT ?? 'observatorio-dashboard',
    name: 'Sitio público',
    roles: ['SITE_INQUIRY'],
    expiresAt: Math.floor(Date.now() / 1000) + 120,
    csrf: '',
  };
}

/** Si este despliegue puede guardar pedidos: sin núcleo no hay dónde. */
export function inquiriesAreConfigured(): boolean {
  return Boolean(process.env.CORE_API_URL && process.env.ADMIN_JWT_PRIVATE_KEY);
}

export function recordInquiry(
  input: InquiryInput,
): Promise<CoreResult<{ serviceInquiryId: string; status: 'NEW'; duplicate: boolean }>> {
  return callCore('/api/v1/admin/inquiries', siteIdentity(), {
    method: 'POST',
    body: input,
    timeoutMs: 8_000,
  });
}

/** WhatsApp y correo de ventas: vienen de la configuración y no del código. */
export function salesContacts(): { whatsapp: string | null; correo: string | null } {
  const whatsapp = (process.env.SERVICIOS_WHATSAPP ?? '').replace(/\D/gu, '');
  const correo = (process.env.SERVICIOS_CORREO ?? '').trim();
  return {
    whatsapp: whatsapp.length >= 8 ? whatsapp : null,
    correo: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(correo) ? correo : null,
  };
}

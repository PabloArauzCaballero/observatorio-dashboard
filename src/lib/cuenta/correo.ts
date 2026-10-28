import 'server-only';

/**
 * El único remitente de correo del sitio: la API HTTP de Resend, con `fetch` y
 * sin dependencia nueva.
 *
 * Sin `RESEND_API_KEY` o sin `SERVICIOS_CORREO_REMITENTE` no se intenta nada y
 * se devuelve `{ sent: false }`: quien llama decide qué hacer en su lugar
 * (mostrar el enlace para copiarlo, no reclamar un aviso). Un fallo tampoco
 * lanza: el registro dice solo el código HTTP, nunca el destinatario ni el
 * cuerpo, que llevan el correo de una persona y a veces un enlace de un uso.
 */

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 8_000;

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Si este despliegue puede mandar correos: una llave de Resend y un remitente. */
export function mailIsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.SERVICIOS_CORREO_REMITENTE?.trim());
}

export async function sendMail({ to, subject, text, html }: MailMessage): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.SERVICIOS_CORREO_REMITENTE?.trim();
  if (!key || !from || !to) return { sent: false };
  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) console.error('[correo] Resend rechazó el envío', response.status);
    return { sent: response.ok };
  } catch {
    console.error('[correo] Resend no respondió');
    return { sent: false };
  }
}

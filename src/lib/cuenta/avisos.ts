import 'server-only';
import { callCore, coreIsConfigured, type CoreResult } from '../admin/core-client';
import type { AdminSession } from '../admin/session';
import { PLANS } from '../plans';
import { decideNotices, noticeMail, type NoticeCandidate, type NoticeKind } from './avisos-puro';
import { mailIsConfigured, sendMail } from './correo';

/**
 * La corrida de avisos: lee las cuentas candidatas del núcleo, decide qué
 * aviso le toca a cada una, lo reclama y solo si el reclamo es nuevo manda el
 * correo. La llama una tarea programada cada hora (`POST /api/servicios/avisos`).
 *
 * Reclamar antes de mandar hace que dos corridas a la vez nunca dupliquen un
 * correo. El costo es el contrario: si Resend falla después del reclamo, ese
 * aviso no se reintenta. Un aviso perdido es preferible a uno repetido cada
 * hora, y la cuenta igual muestra su consumo y su vigencia en `/cuenta`.
 */

const SITE_BASE = '/api/v1/site/subscriptions';
/** Resend admite dos envíos por segundo por omisión; con este espacio no se roza el límite. */
const SEND_SPACING_MS = 600;
const CORE_TIMEOUT_MS = 8_000;

/**
 * El sitio ante el núcleo, con el único rol que necesitan los avisos. Es la
 * misma identidad que usa `/cuenta`, armada aquí para no depender de aquel
 * módulo.
 */
function noticesIdentity(): AdminSession {
  return {
    subject: process.env.SITE_TELEMETRY_SUBJECT ?? 'observatorio-dashboard',
    name: 'Sitio público',
    roles: ['SITE_SUBSCRIPTIONS'],
    expiresAt: Math.floor(Date.now() / 1000) + 120,
    csrf: '',
  };
}

const site = <T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<CoreResult<T>> =>
  callCore<T>(`${SITE_BASE}${path}`, noticesIdentity(), { timeoutMs: CORE_TIMEOUT_MS, ...init });

/** El secreto de la tarea, o `null` si este despliegue no la tiene. */
export function noticesSecret(): string | null {
  const secret = process.env.AVISOS_SECRET?.trim();
  return secret ? secret : null;
}

/** Lo que se puede correr: núcleo y correo. Sin uno de los dos, la corrida no reclama nada. */
export function noticesAreConfigured(): { core: boolean; mail: boolean } {
  return { core: coreIsConfigured(), mail: mailIsConfigured() };
}

/**
 * La dirección pública del sitio para los enlaces del correo: la corrida llega
 * por `localhost` y no sirve el host de la petición.
 *
 * `AVISOS_SITIO_URL` se lee al correr. `NEXT_PUBLIC_SITE_URL` queda como
 * respaldo, pero Next la fija al construir la imagen: si no estaba entonces,
 * cambiarla en Coolify no alcanza.
 */
function siteOrigin(): string {
  const configured = process.env.AVISOS_SITIO_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configured || 'https://datosbolivia.com').replace(/\/+$/u, '');
}

type Counts = Record<NoticeKind, number>;
const zero = (): Counts => ({ USAGE_80: 0, EXPIRY_5D: 0, GRACE: 0 });

/** El resumen de una corrida: solo cifras, ningún correo ni identificador. */
export interface NoticesSummary {
  candidates: number;
  due: Counts;
  /** El núcleo ya tenía ese aviso para ese periodo. */
  alreadySent: Counts;
  sent: Counts;
  /** Reclamados pero el correo no salió: no se reintentan. */
  mailFailed: Counts;
  /** El reclamo no llegó al núcleo: se reintentan en la corrida siguiente. */
  claimFailed: Counts;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** `null` si el núcleo no entregó las candidatas; si no, el resumen de la corrida. */
export async function runNotices(now: Date = new Date()): Promise<NoticesSummary | null> {
  const listed = await site<{ items: NoticeCandidate[] }>('/notices/candidates');
  if (!listed.ok) return null;
  const candidates = (listed.body.data?.items ?? []).filter(
    (item): item is NoticeCandidate =>
      Boolean(item?.account?.subscriberAccountId && item.account.email && Array.isArray(item.usage)),
  );

  const summary: NoticesSummary = {
    candidates: candidates.length,
    due: zero(),
    alreadySent: zero(),
    sent: zero(),
    mailFailed: zero(),
    claimFailed: zero(),
  };
  const origin = siteOrigin();
  let lastSend = 0;

  for (const candidate of candidates) {
    for (const decision of decideNotices(candidate, PLANS, now)) {
      summary.due[decision.kind] += 1;
      const claim = await site<{ claimed: boolean }>('/notices/claim', {
        method: 'POST',
        body: {
          subscriberAccountId: candidate.account.subscriberAccountId,
          kind: decision.kind,
          periodKey: decision.periodKey,
        },
      });
      if (!claim.ok) {
        summary.claimFailed[decision.kind] += 1;
        continue;
      }
      if (claim.body.data?.claimed !== true) {
        summary.alreadySent[decision.kind] += 1;
        continue;
      }
      const wait = lastSend + SEND_SPACING_MS - Date.now();
      if (wait > 0) await sleep(wait);
      const { sent } = await sendMail({
        to: candidate.account.email,
        ...noticeMail(decision, candidate.account, PLANS, origin),
      });
      lastSend = Date.now();
      summary[sent ? 'sent' : 'mailFailed'][decision.kind] += 1;
    }
  }
  return summary;
}

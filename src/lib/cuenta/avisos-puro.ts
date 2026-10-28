/**
 * Los correos a clientes, sin red: qué aviso le toca a cada cuenta y qué dice.
 *
 * Tres avisos, cada uno una vez por periodo (el núcleo guarda cuál ya salió):
 *
 * - `USAGE_80`: algún consumo del mes llegó al 80 % del cupo mensual del plan.
 * - `EXPIRY_5D`: la vigencia pagada termina dentro de cinco días.
 * - `GRACE`: la vigencia terminó y la cuenta está en los días de gracia.
 *
 * Puro —ni Next ni `fetch`, solo `node:crypto`— para probarlo con `node --test`
 * y fechas fijas; por eso los planes llegan como argumento y de otros módulos
 * solo se importan tipos. También están aquí el correo con el enlace de
 * activación o de contraseña —para que todos los textos que recibe un cliente
 * se lean juntos— y la comprobación del secreto de la tarea programada.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type { Plan } from '../plans';
import type { EffectiveStatus, UsageKind, UsageRow } from './puro';

export type NoticeKind = 'USAGE_80' | 'EXPIRY_5D' | 'GRACE';
export const NOTICE_KINDS = ['USAGE_80', 'EXPIRY_5D', 'GRACE'] as const satisfies readonly NoticeKind[];

/** La fracción del cupo mensual que dispara el aviso de consumo. */
export const USAGE_ALERT_SHARE = 0.8;
/** Cuántos días antes del vencimiento sale el aviso. */
export const EXPIRY_WINDOW_DAYS = 5;
/** Los días de gracia del núcleo (`GRACE_DAYS` en `subscription-account-row.ts`). */
export const GRACE_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Bolivia está en UTC−4 todo el año, sin horario de verano: el desfase fijo es exacto. */
const LA_PAZ_OFFSET_MS = -4 * 60 * 60 * 1000;

/** Lo que el aviso necesita de una cuenta, tal como llega en `notices/candidates`. */
export interface NoticeAccount {
  subscriberAccountId: string;
  email: string;
  fullName: string;
  planCode: string;
  effectiveStatus: EffectiveStatus;
  entitled: boolean;
  paidUntil: string | null;
}

export interface NoticeCandidate {
  account: NoticeAccount;
  usage: readonly UsageRow[];
  members?: number;
}

export interface UsageAlertLine {
  kind: UsageKind;
  used: number;
  quota: number;
  /** `used / quota`, sin recortar: puede pasar de 1. */
  share: number;
}

export type NoticeDecision =
  | { kind: 'USAGE_80'; periodKey: string; lines: UsageAlertLine[]; renewsOn: string }
  | { kind: 'EXPIRY_5D'; periodKey: string; endsOn: string; trial: boolean }
  | { kind: 'GRACE'; periodKey: string; endedOn: string; graceEndsOn: string };

/* ------------------------------ Autorización ------------------------------ */

/**
 * Si el encabezado `Authorization` trae `Bearer <secreto>`.
 *
 * Se comparan los resúmenes SHA-256 y no los textos: `timingSafeEqual` exige
 * el mismo largo, y comparar largos primero diría cuánto mide el secreto.
 */
export function bearerMatches(header: string | null | undefined, secret: string): boolean {
  if (!secret) return false;
  const given = /^Bearer\s+(\S+)$/iu.exec(header?.trim() ?? '')?.[1] ?? '';
  const a = createHash('sha256').update(given, 'utf8').digest();
  const b = createHash('sha256').update(secret, 'utf8').digest();
  return timingSafeEqual(a, b) && given.length > 0;
}

/* --------------------------------- Fechas --------------------------------- */

/** `YYYY-MM` del instante, en UTC: la misma llave del contador mensual del núcleo. */
export function monthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

/** El primer día del mes siguiente, `YYYY-MM-DD` en UTC: cuando el contador vuelve a cero. */
export function nextMonthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

/**
 * El día calendario de La Paz de un instante, `YYYY-MM-DD`.
 *
 * Un pago que «cubre hasta el 30 de noviembre» se guarda como las 23:59:59 de
 * ese día en La Paz, que en UTC ya es el 1 de diciembre. El día que se nombra
 * en el correo y en la llave del aviso es el de La Paz.
 */
export function laPazDate(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const instante = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instante.getTime())) return null;
  return new Date(instante.getTime() + LA_PAZ_OFFSET_MS).toISOString().slice(0, 10);
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

/**
 * «30 de noviembre de 2026» a partir de `YYYY-MM-DD`. Es `longDate` de
 * `./puro`, repetida: este módulo no puede importar valores de otro archivo
 * `.ts` sin romper `node --test`.
 */
export function proseDate(day: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(day);
  if (!partes) return day;
  return `${Number(partes[3])} de ${MESES[Number(partes[2]) - 1] ?? ''} de ${partes[1]}`;
}

/* -------------------------------- Decisión -------------------------------- */

/**
 * Los cupos mensuales del plan que se pueden comparar con el contador del mes.
 *
 * Solo la API tiene uno (`apiPorMes`). El asistente se cuenta por día y las
 * descargas por tamaño de archivo; un «80 %» de esos contadores no tendría un
 * tope con que compararse.
 */
export function monthlyQuotas(plan: Plan): Partial<Record<UsageKind, number>> {
  return plan.apiPorMes > 0 ? { API: plan.apiPorMes } : {};
}

/**
 * Los avisos que le corresponden a una cuenta en este instante.
 *
 * Decide sin saber cuáles ya salieron: eso lo resuelve el reclamo en el
 * núcleo, por cuenta, tipo y periodo. Por eso la llave de periodo es estable
 * —el mes del consumo o el día del vencimiento— y una corrida por hora no
 * repite el correo.
 */
export function decideNotices(
  candidate: NoticeCandidate,
  plans: readonly Plan[],
  now: Date,
): NoticeDecision[] {
  const { account } = candidate;
  const decisions: NoticeDecision[] = [];
  const plan = plans.find((entry) => entry.code === account.planCode);
  const paidUntilMs = account.paidUntil ? new Date(account.paidUntil).getTime() : Number.NaN;
  const paidOn = laPazDate(account.paidUntil);

  // Consumo: solo con derecho al plan; a una cuenta vencida o suspendida el cupo no le aplica.
  if (plan && account.entitled) {
    const quotas = monthlyQuotas(plan);
    const lines: UsageAlertLine[] = [];
    for (const [kind, quota] of Object.entries(quotas) as Array<[UsageKind, number]>) {
      const used = candidate.usage
        .filter((row) => row.usageKind === kind)
        .reduce((total, row) => total + (Number(row.used) || 0), 0);
      if (quota > 0 && used >= quota * USAGE_ALERT_SHARE) lines.push({ kind, used, quota, share: used / quota });
    }
    if (lines.length > 0) {
      decisions.push({ kind: 'USAGE_80', periodKey: monthKey(now), lines, renewsOn: nextMonthStart(now) });
    }
  }

  // Vencimiento cercano: la vigencia todavía no terminó y termina dentro de la ventana.
  if (account.entitled && paidOn && Number.isFinite(paidUntilMs)) {
    const remaining = paidUntilMs - now.getTime();
    if (remaining >= 0 && remaining <= EXPIRY_WINDOW_DAYS * DAY_MS && account.effectiveStatus !== 'GRACE') {
      decisions.push({
        kind: 'EXPIRY_5D',
        periodKey: paidOn,
        endsOn: paidOn,
        trial: account.effectiveStatus === 'TRIAL',
      });
    }
  }

  // Gracia: la decide el núcleo; aquí solo se nombra cuándo termina.
  if (account.effectiveStatus === 'GRACE' && paidOn && Number.isFinite(paidUntilMs)) {
    decisions.push({
      kind: 'GRACE',
      periodKey: paidOn,
      endedOn: paidOn,
      graceEndsOn: laPazDate(new Date(paidUntilMs + GRACE_DAYS * DAY_MS)) ?? paidOn,
    });
  }

  return decisions;
}

/* --------------------------------- Correos -------------------------------- */

/** Un párrafo: texto corrido y, donde haga falta, un enlace con su dirección visible. */
type Part = string | { href: string };

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

/** Texto seguro dentro de HTML, también en un atributo entre comillas. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

/** Un nombre para el saludo: una sola línea, sin caracteres de control. */
const greetingName = (value: string): string =>
  value.replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 160);

function compose(subject: string, fullName: string, paragraphs: ReadonlyArray<readonly Part[]>): MailContent {
  const nombre = greetingName(fullName);
  const cuerpo = [...(nombre ? [[`${nombre}:`]] : []), ...paragraphs, ['DatosBolivia.com']] as ReadonlyArray<
    readonly Part[]
  >;
  const text = cuerpo.map((parts) => parts.map((part) => (typeof part === 'string' ? part : part.href)).join('')).join('\n\n');
  const html = cuerpo
    .map(
      (parts) =>
        `<p>${parts
          .map((part) =>
            typeof part === 'string'
              ? escapeHtml(part)
              : `<a href="${escapeHtml(part.href)}">${escapeHtml(part.href)}</a>`,
          )
          .join('')}</p>`,
    )
    .join('');
  return { subject, text, html };
}

const miles = (valor: number): string => String(Math.round(valor)).replace(/\B(?=(\d{3})+(?!\d))/gu, '.');
const porcentaje = (share: number): string => `${Math.floor(share * 100)} %`;

const USAGE_PHRASE: Record<UsageKind, string> = {
  API: 'consultas a la API',
  DOWNLOAD: 'descargas de archivos',
  CHAT: 'preguntas al asistente',
  MAP: 'descargas del mapa de lugares',
};

/** El correo de un aviso. `origin` es la dirección pública del sitio, sin barra final. */
export function noticeMail(
  decision: NoticeDecision,
  account: Pick<NoticeAccount, 'fullName' | 'planCode'>,
  plans: readonly Plan[],
  origin: string,
): MailContent {
  const base = origin.replace(/\/+$/u, '');
  const cuenta = { href: `${base}/cuenta` };
  const servicios = { href: `${base}/servicios` };
  const plan = plans.find((entry) => entry.code === account.planCode)?.nombre ?? account.planCode;

  if (decision.kind === 'USAGE_80') {
    const detalle = decision.lines
      .map((line) => `${porcentaje(line.share)} de las ${USAGE_PHRASE[line.kind]} del mes (${miles(line.used)} de ${miles(line.quota)})`)
      .join('; ');
    const agotado = decision.lines.some((line) => line.share >= 1);
    return compose(`DatosBolivia.com: consumo del mes al ${porcentaje(Math.max(...decision.lines.map((l) => l.share)))}`, account.fullName, [
      [`La cuenta del plan ${plan} usó el ${detalle}. El cupo vuelve a cero el ${proseDate(decision.renewsOn)}.`],
      [
        agotado
          ? 'El cupo ya se agotó: hasta esa fecha, la API responde con el código 429.'
          : 'Al llegar al tope, la API responde con el código 429 hasta esa fecha.',
      ],
      ['El consumo del mes se consulta en ', cuenta, '. Los planes con un cupo mayor están en ', servicios, '.'],
    ]);
  }

  if (decision.kind === 'EXPIRY_5D') {
    const fecha = proseDate(decision.endsOn);
    return compose(
      decision.trial ? `DatosBolivia.com: la prueba termina el ${fecha}` : `DatosBolivia.com: el plan vence el ${fecha}`,
      account.fullName,
      [
        [
          decision.trial
            ? `La prueba del plan ${plan} termina el ${fecha}.`
            : `El plan ${plan} está pagado hasta el ${fecha}.`,
        ],
        [
          `Para seguir sin interrupción, el pago debe registrarse antes de esa fecha. Pasado el vencimiento, la cuenta conserva el plan ${GRACE_DAYS} días más y después pasa a los topes del acceso gratuito.`,
        ],
        ['Los planes y las formas de pago están en ', servicios, '. La vigencia de la cuenta se consulta en ', cuenta, '.'],
        ['Si el pago ya se hizo, este aviso puede ignorarse: la vigencia se actualiza cuando el pago se registra.'],
      ],
    );
  }

  const fin = proseDate(decision.graceEndsOn);
  return compose(`DatosBolivia.com: el plan venció, el acceso sigue hasta el ${fin}`, account.fullName, [
    [
      `El plan ${plan} venció el ${proseDate(decision.endedOn)}. La cuenta está en periodo de gracia: las descargas, la API y el asistente mantienen los cupos del plan hasta el ${fin}.`,
    ],
    ['Después de esa fecha, la cuenta pasa a los topes del acceso gratuito y la API responde con el código 402 (plan vencido).'],
    ['Para renovar, los planes y las formas de pago están en ', servicios, '. La vigencia de la cuenta se consulta en ', cuenta, '.'],
    ['Si el pago ya se hizo, este aviso puede ignorarse: la vigencia se actualiza cuando el pago se registra.'],
  ]);
}

/** El correo con el enlace de un solo uso para activar la cuenta o fijar una contraseña nueva. */
export function linkMail(fullName: string, link: string, purpose: 'ACTIVATE' | 'RESET'): MailContent {
  return compose(
    purpose === 'ACTIVATE' ? 'Activar la cuenta de DatosBolivia.com' : 'Nueva contraseña para DatosBolivia.com',
    fullName,
    [
      [
        purpose === 'ACTIVATE'
          ? 'La cuenta de DatosBolivia.com está lista. Para entrar hace falta fijar una contraseña en este enlace:'
          : 'Se pidió una contraseña nueva para la cuenta de DatosBolivia.com. Para fijarla, abrir este enlace:',
      ],
      [{ href: link }],
      ['El enlace sirve una sola vez y vence en unos días. Si no se esperaba este correo, puede ignorarse.'],
    ],
  );
}

/**
 * Las piezas de la cuenta de cliente que no dependen de Next ni del núcleo.
 *
 * La cookie firmada, las validaciones de los formularios, el origen de una
 * petición y la lectura del consumo frente al cupo del plan. Puro —solo
 * `node:crypto`— para probarlo con `node --test`; por la misma razón los
 * planes llegan como argumento y de `./plans` solo se importan tipos.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Plan, PlanCode } from '../plans';

export const CUENTA_COOKIE = 'obs_cuenta';

/**
 * Ocho horas: una jornada de trabajo sin volver a escribir la contraseña. Los
 * permisos no salen de aquí sino del núcleo (ver `freshAccount`), así que una
 * cookie vieja no alarga un plan vencido.
 */
export const CUENTA_TTL_SECONDS = 8 * 60 * 60;

/** La versión de `/terminos` que se acepta al activar la cuenta. */
export const TERMS_VERSION = '2026-10-27';

export type PaidPlanCode = Exclude<PlanCode, 'gratis'>;
export type BillingPeriod = 'MONTHLY' | 'ANNUAL';
export type EffectiveStatus =
  | 'PENDING'
  | 'TRIAL'
  | 'ACTIVE'
  | 'GRACE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'CANCELLED';
export type UsageKind = 'API' | 'DOWNLOAD' | 'CHAT' | 'MAP';

export const PAID_PLAN_CODES = ['analista', 'profesional', 'institucional'] as const satisfies readonly PaidPlanCode[];
export const BILLING_PERIODS = ['MONTHLY', 'ANNUAL'] as const satisfies readonly BillingPeriod[];
export const USAGE_KINDS = ['API', 'DOWNLOAD', 'CHAT', 'MAP'] as const satisfies readonly UsageKind[];
/** Los estados que un operador puede fijar a mano; los demás los calcula el núcleo. */
export const SETTABLE_STATUSES = ['TRIAL', 'ACTIVE', 'GRACE', 'SUSPENDED', 'CANCELLED'] as const;

/** La cuenta tal como la devuelve el núcleo. */
export interface AccountSummary {
  subscriberAccountId: string;
  email: string;
  fullName: string;
  organization: string | null;
  legalName: string | null;
  taxId: string | null;
  planCode: PaidPlanCode;
  billingPeriod: BillingPeriod;
  status: string;
  effectiveStatus: EffectiveStatus;
  entitled: boolean;
  paidUntil: string | null;
  createdAt: string;
  /**
   * Sube cada vez que el núcleo cierra las sesiones de la cuenta: un cambio de
   * contraseña, un enlace usado o un cierre pedido. Una cookie con otra versión
   * ya no vale.
   */
  sessionVersion: number;
  /** Hasta cuándo el ingreso está bloqueado por intentos fallidos. */
  lockedUntil: string | null;
}

export type MemberStatus = 'ACTIVE' | 'REMOVED';

/** Una persona que la titular sumó a su cuenta, tal como la lista el núcleo. */
export interface MemberSummary {
  memberId: string;
  email: string;
  fullName: string;
  status: MemberStatus;
  createdAt: string;
  /** Si ya fijó su contraseña con el enlace. */
  activated: boolean;
}

/** Un miembro leído uno por uno: trae su propia versión de sesión. */
export interface MemberRecord extends MemberSummary {
  sessionVersion: number;
}

/** El miembro que acaba de ingresar, como lo devuelve `POST /sessions`. */
export interface SignedInMember {
  memberId: string;
  email: string;
  fullName: string;
  sessionVersion: number;
}

export interface UsageRow {
  usageKind: UsageKind;
  used: number;
}

export interface ApiKeySummary {
  apiKeyId: string;
  prefix: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface AccountDetail {
  account: AccountSummary;
  usage: UsageRow[];
  apiKeys: ApiKeySummary[];
}

/**
 * Lo que guarda la cookie: quién es y con qué versión de sesión entró.
 *
 * La titular lleva solo `sv`; un miembro lleva además `mid` y `msv`. Ningún
 * permiso sale de aquí: `freshAccount` compara las versiones con las del
 * núcleo y lee el plan y la vigencia de él.
 */
export interface CustomerSession {
  accountId: string;
  /** El correo de quien ingresó: el de la titular o el del miembro. */
  email: string;
  planCode: PaidPlanCode;
  entitled: boolean;
  /** La versión de sesión de la cuenta al ingresar. */
  sv: number;
  /** El miembro que ingresó; ausente para la titular. */
  mid?: string;
  /** La versión de sesión del miembro al ingresar. */
  msv?: number;
  /** Segundos desde la época: cuándo se emitió. */
  iat?: number;
  /** Segundos desde la época. */
  exp: number;
}

/** Si quien ingresó es la persona titular, la única que administra llaves, equipo y facturación. */
export const isOwnerSession = (session: Pick<CustomerSession, 'mid'>): boolean => session.mid === undefined;

const isVersion = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;

const firmar = (payload: string, secret: string | Buffer): string =>
  createHmac('sha256', secret).update(payload).digest('base64url');

/**
 * El secreto de la cookie de cliente.
 *
 * `CUENTA_SESSION_SECRET` si existe; si no, uno derivado del secreto del portal
 * con una etiqueta propia. Derivado y no el mismo: una cookie de cliente nunca
 * puede pasar por una de operador, ni al revés, aunque las dos salgan de la
 * misma variable. `null` es «este despliegue no tiene cuentas».
 */
export function deriveCustomerSecret(env: {
  CUENTA_SESSION_SECRET?: string | undefined;
  ADMIN_SESSION_SECRET?: string | undefined;
}): string | null {
  const propio = env.CUENTA_SESSION_SECRET?.trim();
  if (propio && propio.length >= 32) return propio;
  const admin = env.ADMIN_SESSION_SECRET;
  if (!admin || admin.length < 32) return null;
  return createHmac('sha256', admin).update('datosbolivia-cuenta-v1').digest('base64url');
}

export function encodeCustomerCookie(session: CustomerSession, secret: string | Buffer): string {
  const payload = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  return `${payload}.${firmar(payload, secret)}`;
}

const isPaidPlan = (value: unknown): value is PaidPlanCode =>
  (PAID_PLAN_CODES as readonly unknown[]).includes(value);

/**
 * La sesión de una cookie solo si la firmó este servidor y no venció.
 *
 * Cualquier falla devuelve `null` y nunca una excepción: una cookie vencida o
 * alterada lleva al formulario de ingreso, no a una página de error que diga
 * cuál de las dos cosas era.
 */
export function verifyCustomerCookie(
  value: string | undefined | null,
  secret: string | Buffer | null,
  nowMs: number = Date.now(),
): CustomerSession | null {
  if (!value || !secret) return null;
  const separador = value.lastIndexOf('.');
  if (separador <= 0) return null;
  const payload = value.slice(0, separador);
  const firma = value.slice(separador + 1);
  const esperada = firmar(payload, secret);
  if (firma.length !== esperada.length || !timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) {
    return null;
  }
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<CustomerSession>;
    if (
      typeof s.accountId !== 'string' ||
      typeof s.email !== 'string' ||
      !isPaidPlan(s.planCode) ||
      typeof s.entitled !== 'boolean' ||
      !isVersion(s.sv) ||
      typeof s.exp !== 'number' ||
      s.exp * 1000 <= nowMs
    ) {
      return null;
    }
    // Un miembro lleva las dos marcas o ninguna: una sola es una cookie que no salió de aquí.
    const esMiembro = s.mid !== undefined || s.msv !== undefined;
    if (esMiembro && (!isUuid(s.mid) || !isVersion(s.msv))) return null;
    return {
      accountId: s.accountId,
      email: s.email,
      planCode: s.planCode,
      entitled: s.entitled,
      sv: s.sv,
      ...(esMiembro ? { mid: s.mid, msv: s.msv } : {}),
      ...(typeof s.iat === 'number' ? { iat: s.iat } : {}),
      exp: s.exp,
    };
  } catch {
    return null;
  }
}

/** El miembro de una sesión, con lo justo que pide la cookie. */
export type SessionMember = Pick<SignedInMember, 'memberId' | 'email' | 'sessionVersion'>;

/**
 * La sesión que abre una cuenta, o la de uno de sus miembros.
 *
 * `null` cuando el núcleo no mandó una versión de sesión válida: una cookie sin
 * versión no se podría cerrar nunca desde el núcleo, así que no se emite.
 */
export function sessionFromAccount(
  account: AccountSummary,
  member: SessionMember | null = null,
  nowMs: number = Date.now(),
): CustomerSession | null {
  if (!isVersion(account.sessionVersion)) return null;
  if (member && (!isUuid(member.memberId) || !isVersion(member.sessionVersion))) return null;
  const iat = Math.floor(nowMs / 1000);
  return {
    accountId: account.subscriberAccountId,
    email: member ? member.email : account.email,
    planCode: account.planCode,
    entitled: account.entitled,
    sv: account.sessionVersion,
    ...(member ? { mid: member.memberId, msv: member.sessionVersion } : {}),
    iat,
    exp: iat + CUENTA_TTL_SECONDS,
  };
}

/**
 * Si la sesión de una cookie sigue en pie frente a lo que dice el núcleo.
 *
 * La versión de la cuenta se compara siempre, también en la cookie de un
 * miembro: un cierre de sesiones de la cuenta alcanza a todo el equipo. Un
 * miembro además tiene que seguir activo y con su propia versión.
 */
export function sessionIsCurrent(
  session: Pick<CustomerSession, 'accountId' | 'sv' | 'mid' | 'msv'>,
  account: Pick<AccountSummary, 'subscriberAccountId' | 'sessionVersion'>,
  member: Pick<MemberRecord, 'memberId' | 'status' | 'sessionVersion'> | null,
): boolean {
  if (account.subscriberAccountId !== session.accountId) return false;
  if (!isVersion(account.sessionVersion) || account.sessionVersion !== session.sv) return false;
  if (session.mid === undefined) return true;
  return (
    member !== null &&
    member.memberId === session.mid &&
    member.status === 'ACTIVE' &&
    isVersion(member.sessionVersion) &&
    member.sessionVersion === session.msv
  );
}

/** Lee una cookie de un encabezado `Cookie` crudo. */
export function readCookieHeader(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const parte of header.split(';')) {
    const igual = parte.indexOf('=');
    if (igual < 0) continue;
    if (parte.slice(0, igual).trim() === name) {
      const crudo = parte.slice(igual + 1).trim();
      try {
        return decodeURIComponent(crudo);
      } catch {
        return crudo;
      }
    }
  }
  return undefined;
}

/* ------------------------------ Validaciones ------------------------------ */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const correo = value.trim().toLowerCase();
  return correo.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(correo) ? correo : null;
}

/** `null` si sirve; si no, la frase que se le muestra a quien la escribió. */
export function passwordProblem(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  }
  if (value.length > PASSWORD_MAX) return `La contraseña puede tener hasta ${PASSWORD_MAX} caracteres.`;
  if (value.trim().length === 0) return 'La contraseña no puede ser solo espacios.';
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** Una etiqueta de llave: texto corto, sin saltos de línea. */
export function cleanLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const limpia = value.replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return limpia.length >= 1 && limpia.length <= 60 ? limpia : null;
}

/** Un token de activación tal como viaja en el enlace. */
export const isActivationToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_.~-]{16,512}$/u.test(value);

/**
 * A dónde volver después de ingresar. Solo rutas propias bajo `/cuenta`: un
 * `volver=https://otro.sitio` convertiría el formulario en un trampolín.
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string') return '/cuenta';
  if (!/^\/cuenta(\/[A-Za-z0-9/_-]*)?(\?[A-Za-z0-9=&_%-]*)?$/u.test(value)) return '/cuenta';
  if (/^\/cuenta\/(ingresar|activar|recuperar)/u.test(value)) return '/cuenta';
  return value;
}

/** Un texto corto de una línea: sin caracteres de control ni espacios de más. */
function oneLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim();
}

export type Validated<T> = { ok: true; value: T } | { ok: false; field: string; message: string };

/** El nombre de una persona: de 2 a 120 caracteres. */
export function cleanPersonName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const limpio = oneLine(value);
  return limpio.length >= 2 && limpio.length <= 120 ? limpio : null;
}

/** Lo que la titular escribe para sumar a alguien a su cuenta. */
export function memberInvite(body: unknown): Validated<{ email: string; fullName: string }> {
  const datos = (body ?? {}) as { email?: unknown; fullName?: unknown };
  const fullName = cleanPersonName(datos.fullName);
  if (!fullName) return { ok: false, field: 'fullName', message: 'Escribir el nombre de la persona, de 2 a 120 caracteres.' };
  const email = normalizeEmail(datos.email);
  if (!email) return { ok: false, field: 'email', message: 'Escribir un correo válido.' };
  return { ok: true, value: { email, fullName } };
}

export interface BillingChanges {
  organization: string | null;
  legalName: string | null;
  taxId: string | null;
}

export const BILLING_LIMITS = { organization: 120, legalName: 200, taxId: 20 } as const;

/** El NIT: cifras, letras o guiones, sin espacios; algunos llevan complemento. */
export const TAX_ID_PATTERN = /^[0-9A-Za-z-]{3,20}$/u;

/**
 * Los datos de facturación del formulario, listos para el núcleo.
 *
 * El formulario manda los tres campos siempre; uno en blanco se borra (`null`),
 * que es como el núcleo entiende «quitar este dato». El NIT admite cifras,
 * letras y guiones, porque algunos llevan complemento.
 */
export function billingChanges(body: unknown): Validated<BillingChanges> {
  const datos = (body ?? {}) as Record<string, unknown>;
  const texto = (campo: keyof BillingChanges): string | null | undefined => {
    const valor = datos[campo];
    if (valor === undefined || valor === null) return null;
    if (typeof valor !== 'string') return undefined;
    const limpio = oneLine(valor);
    return limpio === '' ? null : limpio;
  };
  const organization = texto('organization');
  if (organization === undefined || (organization && organization.length > BILLING_LIMITS.organization)) {
    return { ok: false, field: 'organization', message: `La organización puede tener hasta ${BILLING_LIMITS.organization} caracteres.` };
  }
  const legalName = texto('legalName');
  if (legalName === undefined || (legalName && legalName.length > BILLING_LIMITS.legalName)) {
    return { ok: false, field: 'legalName', message: `La razón social puede tener hasta ${BILLING_LIMITS.legalName} caracteres.` };
  }
  const taxId = texto('taxId');
  if (taxId === undefined || (taxId !== null && !TAX_ID_PATTERN.test(taxId))) {
    return { ok: false, field: 'taxId', message: 'El NIT lleva de 3 a 20 cifras, letras o guiones, sin espacios.' };
  }
  return { ok: true, value: { organization, legalName, taxId } };
}

/**
 * La dirección pública del sitio, para los enlaces que viajan por correo.
 *
 * Sale de la configuración y nunca de la petición: un `Host` alterado haría que
 * el enlace de recuperación de otra persona apuntara a un sitio ajeno y le
 * entregara el token.
 */
export function siteOrigin(configured: string | undefined): string {
  const valor = configured?.trim();
  if (valor) {
    try {
      const url = new URL(valor);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
    } catch {
      // Una variable mal escrita cae en el dominio de producción.
    }
  }
  return 'https://datosbolivia.com';
}

/**
 * Si una petición que escribe salió de una página de este mismo sitio.
 *
 * El navegador manda `Origin` en todo POST hecho con `fetch`; si falta se mira
 * `Referer`, y si faltan los dos se rechaza. El host se compara con el que
 * escribió la persona (`x-forwarded-host` detrás del proxy), no con el del
 * contenedor.
 */
export function isSameOrigin(headers: {
  origin: string | null;
  referer: string | null;
  host: string | null;
  forwardedHost: string | null;
}): boolean {
  const esperado = (headers.forwardedHost ?? headers.host ?? '').split(',')[0]?.trim().toLowerCase();
  if (!esperado) return false;
  const fuente = headers.origin && headers.origin !== 'null' ? headers.origin : headers.referer;
  if (!fuente) return false;
  try {
    return new URL(fuente).host.toLowerCase() === esperado;
  } catch {
    return false;
  }
}

/* --------------------------- Plan, estado, cupos -------------------------- */

export function planFor(plans: readonly Plan[], code: string): Plan | undefined {
  return plans.find((plan) => plan.code === code);
}

export const STATUS_WORDS: Record<EffectiveStatus, string> = {
  PENDING: 'Pendiente de activación',
  TRIAL: 'En prueba',
  ACTIVE: 'Vigente',
  GRACE: 'En periodo de gracia',
  EXPIRED: 'Vencida',
  SUSPENDED: 'Suspendida',
  CANCELLED: 'Cancelada',
};

export const PERIOD_WORDS: Record<BillingPeriod, string> = {
  MONTHLY: 'mensual',
  ANNUAL: 'anual',
};

export const USAGE_WORDS: Record<UsageKind, string> = {
  API: 'Consultas a la API',
  DOWNLOAD: 'Descargas de archivos',
  CHAT: 'Preguntas al asistente',
  MAP: 'Descargas del mapa de lugares',
};

/** «14 de octubre de 2026», como pide el libro de estilo para la prosa. */
export function longDate(value: string | null | undefined): string {
  if (!value) return '—';
  const fecha = /^\d{4}-\d{2}-\d{2}$/u.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(fecha.getTime())) return '—';
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${fecha.getUTCDate()} de ${meses[fecha.getUTCMonth()]} de ${fecha.getUTCFullYear()}`;
}

export interface UsageLine {
  kind: UsageKind;
  label: string;
  used: number;
  /** Tope mensual comparable con `used`, cuando el plan tiene uno. */
  monthlyQuota: number | null;
  /** Cómo se lee el cupo del plan para este tipo, en palabras. */
  quotaText: string;
}

const miles = (valor: number): string => String(Math.round(valor)).replace(/\B(?=(\d{3})+(?!\d))/gu, '.');

/**
 * El consumo del mes frente a lo que el plan permite.
 *
 * Solo la API tiene un cupo mensual que se pueda comparar con el contador; el
 * chat se cuenta por día y los archivos por tamaño, así que para ellos se dice
 * la regla y se muestra cuánto se usó, sin inventar un porcentaje.
 */
export function usageLines(usage: readonly UsageRow[], plan: Plan | undefined): UsageLine[] {
  const usado = (kind: UsageKind): number =>
    usage.filter((row) => row.usageKind === kind).reduce((total, row) => total + (Number(row.used) || 0), 0);
  return USAGE_KINDS.map((kind) => {
    let monthlyQuota: number | null = null;
    let quotaText = '—';
    if (plan) {
      if (kind === 'API') {
        monthlyQuota = plan.apiPorMes;
        quotaText = `de ${miles(plan.apiPorMes)} al mes`;
      } else if (kind === 'CHAT') {
        quotaText = `hasta ${miles(plan.chatPorDia)} por día`;
      } else if (kind === 'DOWNLOAD') {
        quotaText = plan.filasPorArchivo === null ? 'sin tope de filas por archivo' : `hasta ${miles(plan.filasPorArchivo)} filas por archivo`;
      } else {
        quotaText =
          plan.lugaresPorDescarga === null ? 'mapa completo' : `hasta ${miles(plan.lugaresPorDescarga)} lugares por descarga`;
      }
    }
    return { kind, label: USAGE_WORDS[kind], used: usado(kind), monthlyQuota, quotaText };
  });
}

/** La fracción usada de un cupo, entre 0 y 1; `null` si no hay cupo comparable. */
export function usedShare(used: number, quota: number | null): number | null {
  if (quota === null || quota <= 0) return null;
  return Math.min(1, Math.max(0, used / quota));
}

/** Cuántas llaves activas tiene una cuenta, para saber si puede crear otra. */
export const activeKeys = (keys: readonly ApiKeySummary[]): number => keys.filter((key) => !key.revokedAt).length;

/** Cuántos miembros siguen en la cuenta, para saber si se puede sumar otro. */
export const activeMembers = (members: readonly Pick<MemberSummary, 'status'>[]): number =>
  members.filter((member) => member.status === 'ACTIVE').length;

/** El enlace de activación que el operador copia o que viaja por correo. */
export function activationLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/u, '')}/cuenta/activar?token=${encodeURIComponent(token)}`;
}

/**
 * «27 de octubre de 2026, 18:30 (hora de Bolivia)». Bolivia está en UTC−4 todo
 * el año, así que no hace falta una tabla de zonas.
 */
export function longDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return '—';
  const local = new Date(fecha.getTime() - 4 * 60 * 60 * 1000);
  const hora = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
  return `${longDate(local.toISOString())}, ${hora} (hora de Bolivia)`;
}

export type LinkPurpose = 'RESET' | 'INVITE';

export interface LinkEmail {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (valor: string): string =>
  valor.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;');

/**
 * El correo con un enlace para fijar la contraseña: el de recuperación que pide
 * la persona y el de bienvenida que manda la titular al sumar a alguien.
 */
export function accountLinkEmail(input: {
  purpose: LinkPurpose;
  fullName: string;
  link: string;
  expiresAt?: string | null;
  /** Para la invitación: el nombre de la organización o de la titular. */
  accountName?: string | null;
}): LinkEmail {
  const subject =
    input.purpose === 'RESET' ? 'Nueva contraseña para DatosBolivia.com' : 'Acceso a la cuenta de DatosBolivia.com';
  const intro =
    input.purpose === 'RESET'
      ? 'Se pidió una contraseña nueva para la cuenta de DatosBolivia.com. Para fijarla, abrir este enlace:'
      : `Se abrió un acceso a la cuenta de DatosBolivia.com${input.accountName ? ` de ${oneLine(input.accountName)}` : ''}. Para entrar hace falta fijar una contraseña en este enlace:`;
  const vence = input.expiresAt && longDateTime(input.expiresAt) !== '—' ? ` y vence el ${longDateTime(input.expiresAt)}` : '';
  const cierre =
    input.purpose === 'RESET'
      ? `El enlace sirve una sola vez${vence}. Si no se pidió, se puede ignorar este correo: la contraseña actual sigue igual.`
      : `El enlace sirve una sola vez${vence}. Si no se esperaba este correo, se puede ignorar.`;
  const nombre = oneLine(input.fullName);
  const text = `${nombre}:\n\n${intro}\n\n${input.link}\n\n${cierre}\n\nDatosBolivia.com`;
  const html = [
    `<p>${escapeHtml(nombre)}:</p>`,
    `<p>${escapeHtml(intro)}</p>`,
    `<p><a href="${escapeHtml(input.link)}">${escapeHtml(input.link)}</a></p>`,
    `<p>${escapeHtml(cierre)}</p>`,
    '<p>DatosBolivia.com</p>',
  ].join('');
  return { subject, text, html };
}

/** Una fecha `YYYY-MM-DD` que existe. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const fecha = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === value;
}

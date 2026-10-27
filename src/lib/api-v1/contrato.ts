/**
 * Las reglas de `/api/v1` que no necesitan servidor: la forma de una llave, los
 * encabezados de cupo, el cursor, el CSV y los parámetros.
 *
 * Puro —sin `server-only`, sin base, sin importar valores de otros módulos—
 * para probarlo con `node --test`. Lo que decide una ruta vive aquí; lo que
 * habla con el núcleo y con la base vive en `auth.ts` y `responder.ts`.
 */

/** «obs_live_» y 43 caracteres base64url: 32 bytes al azar. */
export const API_KEY_PATTERN = /^obs_live_[A-Za-z0-9_-]{43}$/u;

export const DEFAULT_PAGE_SIZE = 1_000;
export const MAX_PAGE_SIZE = 5_000;

/** Pedidos por minuto y por llave, antes de preguntar al núcleo. */
export const BURST_PER_MINUTE = 60;

/** Lo que el núcleo dice de una llave que conoce. */
export interface VerifiedAccount {
  subscriberAccountId: string;
  email?: string;
  planCode: string;
  effectiveStatus: string;
  entitled: boolean;
  paidUntil: string | null;
}

/**
 * La llave tal como viene en `Authorization`, o `null` si falta o no tiene la
 * forma. Una llave mal escrita no viaja al núcleo: se sabe aquí que no existe.
 */
export function parseBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/iu.exec(header.trim());
  const key = match?.[1];
  return key && API_KEY_PATTERN.test(key) ? key : null;
}

/** El primer día del mes siguiente, a medianoche UTC: cuando el cupo vuelve a cero. */
export function nextQuotaReset(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** Segundos enteros hasta el reinicio del cupo, nunca menos de uno. */
export function secondsToReset(now: Date): number {
  return Math.max(1, Math.ceil((nextQuotaReset(now).getTime() - now.getTime()) / 1000));
}

/** Los tres encabezados de cupo que lleva toda respuesta. */
export function quotaHeaders(limit: number, used: number, now: Date): Record<string, string> {
  return {
    'X-Cupo-Limite': String(Math.max(0, limit)),
    'X-Cupo-Restante': String(Math.max(0, limit - used)),
    'X-Cupo-Reinicio': nextQuotaReset(now).toISOString().slice(0, 10),
  };
}

export type AccessDecision =
  | { ok: true }
  | { ok: false; status: 401 | 402 | 429 | 503; error: string; retryAfter?: number };

/**
 * Qué contesta la API según lo que respondió el núcleo.
 *
 * `verify` llega como el estado HTTP y, si fue 200, la cuenta y el uso ya
 * contado. Un 404 es una llave desconocida o revocada; cualquier otro fallo del
 * núcleo es un servicio que no respondió, no una llave mala.
 */
export function decideAccess(
  verify:
    | { status: 200; account: VerifiedAccount; used: number }
    | { status: number; account?: undefined; used?: undefined },
  monthlyLimit: number | null,
  now: Date,
): AccessDecision {
  if (verify.status === 404) {
    return { ok: false, status: 401, error: 'Llave inválida o revocada.' };
  }
  if (verify.status !== 200 || !verify.account) {
    return {
      ok: false,
      status: 503,
      error: 'El servicio de cuentas no respondió. Conviene reintentar en unos segundos.',
      retryAfter: 30,
    };
  }
  if (!verify.account.entitled || monthlyLimit === null || monthlyLimit <= 0) {
    return {
      ok: false,
      status: 402,
      error: 'El plan de esta llave no está vigente o no incluye la API.',
    };
  }
  if (verify.used > monthlyLimit) {
    return {
      ok: false,
      status: 429,
      error: 'Se agotó el cupo mensual de consultas del plan.',
      retryAfter: secondsToReset(now),
    };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ cursor */

export interface Cursor {
  /** Fila desde la que sigue la página. */
  o: number;
}

function toBase64Url(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64url');
}

export function encodeCursor(cursor: Cursor): string {
  return toBase64Url(JSON.stringify(cursor));
}

/** El cursor leído, o `null` si no es uno de los que da esta API. */
export function decodeCursor(raw: string): Cursor | null {
  if (!/^[A-Za-z0-9_-]{1,200}$/u.test(raw)) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (typeof value !== 'object' || value === null) return null;
    const offset = (value as { o?: unknown }).o;
    return typeof offset === 'number' && Number.isSafeInteger(offset) && offset >= 0
      ? { o: offset }
      : null;
  } catch {
    return null;
  }
}

/** Una página de filas ya leídas, con el cursor de la siguiente o `null` al final. */
export function paginate<T>(
  rows: readonly T[],
  offset: number,
  pageSize: number,
): { data: T[]; siguiente: string | null } {
  const data = rows.slice(offset, offset + pageSize);
  const end = offset + data.length;
  return { data, siguiente: end < rows.length ? encodeCursor({ o: end }) : null };
}

/* --------------------------------------------------------------------- CSV */

export type CsvValue = string | number | boolean | null | undefined;

function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

/**
 * Filas a CSV con la marca de orden de bytes UTF-8 delante, para que Excel lea
 * «Ñuflo» y «Cochabamba» sin preguntar. Las columnas son las de la unión de
 * todas las filas, en el orden en que aparecen.
 */
export function toCsv(rows: ReadonlyArray<Record<string, CsvValue>>): string {
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  if (headers.length === 0) return '﻿';
  const lines = [headers.map((header) => csvField(header)).join(',')];
  for (const row of rows) lines.push(headers.map((header) => csvField(row[header])).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/* -------------------------------------------------------------- parámetros */

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parsePageSize(raw: string | null): Parsed<number> {
  if (raw === null || raw === '') return { ok: true, value: DEFAULT_PAGE_SIZE };
  if (!/^\d{1,6}$/u.test(raw)) return { ok: false, error: 'pageSize tiene que ser un número entero.' };
  const value = Number(raw);
  if (value < 1 || value > MAX_PAGE_SIZE) {
    return { ok: false, error: `pageSize va de 1 a ${MAX_PAGE_SIZE}.` };
  }
  return { ok: true, value };
}

export function parseFormat(raw: string | null): Parsed<'json' | 'csv'> {
  if (raw === null || raw === '' || raw === 'json') return { ok: true, value: 'json' };
  if (raw === 'csv') return { ok: true, value: 'csv' };
  return { ok: false, error: 'formato es json o csv.' };
}

export function parseCursorParam(raw: string | null): Parsed<number> {
  if (raw === null || raw === '') return { ok: true, value: 0 };
  const cursor = decodeCursor(raw);
  return cursor ? { ok: true, value: cursor.o } : { ok: false, error: 'El cursor no es válido.' };
}

/** «2024», «2024-07» o «2024-07-15»; vacío es «sin límite». */
export function parseDateParam(name: string, raw: string | null): Parsed<string | undefined> {
  if (raw === null || raw.trim() === '') return { ok: true, value: undefined };
  const value = raw.trim();
  if (!/^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/u.test(value)) {
    return { ok: false, error: `${name} va como AAAA, AAAA-MM o AAAA-MM-DD.` };
  }
  return { ok: true, value };
}

/** Valores separados por coma, sin repetidos ni vacíos, con tope de cantidad y de largo. */
export function parseList(raw: string | null, limit: number, maxLength = 120): string[] {
  if (!raw) return [];
  const values = raw
    .split(',')
    .map((one) => one.trim().slice(0, maxLength))
    .filter((one) => one.length > 0);
  return [...new Set(values)].slice(0, limit);
}

/**
 * Si una fecha o un periodo cae dentro de `desde`/`hasta`, los dos inclusive.
 *
 * Los periodos se comparan con la misma precisión que el límite: «hasta=2024»
 * incluye 2024-12-31, y un periodo anual «2023» entra en «desde=2023-06».
 */
export function withinRange(period: string, from?: string, until?: string): boolean {
  if (from !== undefined) {
    const width = Math.min(period.length, from.length);
    if (period.slice(0, width) < from.slice(0, width)) return false;
  }
  if (until !== undefined) {
    const width = Math.min(period.length, until.length);
    if (period.slice(0, width) > until.slice(0, width)) return false;
  }
  return true;
}

/**
 * El código público de una serie: la fuente, un punto y la clave de la fuente
 * («diario.FX_OFFICIAL_USD_BOB», «macro.GDP_GROWTH», «bcb.123»). La clave puede
 * llevar puntos —los códigos del Banco Mundial los llevan—, así que se corta
 * por el primero.
 */
export const SERIES_SOURCES = ['diario', 'macro', 'panel', 'bcb'] as const;
export type SeriesSource = (typeof SERIES_SOURCES)[number];

export function parseSeriesCode(raw: string): { fuente: SeriesSource; clave: string } | null {
  const at = raw.indexOf('.');
  if (at <= 0 || at === raw.length - 1 || raw.length > 200) return null;
  const fuente = raw.slice(0, at);
  const clave = raw.slice(at + 1);
  return (SERIES_SOURCES as readonly string[]).includes(fuente)
    ? { fuente: fuente as SeriesSource, clave }
    : null;
}

/** La línea de registro de una respuesta servida: sin la llave, con el prefijo de la cuenta. */
export function usageLogLine(route: string, accountId: string, rows: number): string {
  return JSON.stringify({
    evento: 'api_v1',
    ruta: route,
    cuenta: accountId.slice(0, 8),
    filas: rows,
  });
}

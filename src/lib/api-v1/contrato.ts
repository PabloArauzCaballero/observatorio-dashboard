/**
 * Las reglas de `/api/v1` que no necesitan servidor: la forma de una llave, el
 * freno por minuto, los encabezados de cupo, el cursor, el CSV y los parámetros.
 *
 * Puro —sin `server-only`, sin base, sin importar valores de otros módulos—
 * para probarlo con `node --test`. Lo que decide una ruta vive aquí; lo que
 * habla con el núcleo y con la base vive en `auth.ts`, `responder.ts`,
 * `series.ts` y `bcb.ts`.
 */

/** «obs_live_» y 43 caracteres base64url: 32 bytes al azar. */
export const API_KEY_PATTERN = /^obs_live_[A-Za-z0-9_-]{43}$/u;

export const DEFAULT_PAGE_SIZE = 1_000;
export const MAX_PAGE_SIZE = 5_000;

/** Los textos libres (`buscar`) se cortan aquí: más largo no es una búsqueda. */
export const MAX_TEXT_LENGTH = 120;

/* ----------------------------------------------------------------- la llave */

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
 * Qué trae `Authorization`: nada, algo que no es una llave de esta API, o una
 * llave con la forma correcta. Una llave mal escrita no viaja al núcleo: se
 * sabe aquí que no existe, y se le dice a quien llama por qué.
 */
export type BearerReading =
  | { kind: 'missing' }
  | { kind: 'malformed' }
  | { kind: 'key'; key: string };

export function readBearer(header: string | null | undefined): BearerReading {
  if (!header || header.trim() === '') return { kind: 'missing' };
  const match = /^Bearer\s+(\S+)\s*$/iu.exec(header.trim());
  const key = match?.[1];
  return key && API_KEY_PATTERN.test(key) ? { kind: 'key', key } : { kind: 'malformed' };
}

/** La llave tal como viene en `Authorization`, o `null` si falta o no tiene la forma. */
export function parseBearer(header: string | null | undefined): string | null {
  const reading = readBearer(header);
  return reading.kind === 'key' ? reading.key : null;
}

/* ------------------------------------------------------- el freno por minuto */

/** Pedidos por minuto de una llave cuyo plan todavía no se conoce. */
export const DEFAULT_BURST_PER_MINUTE = 60;

/** Cuánto se recuerda el plan de una llave después de que el núcleo la verificó. */
export const PLAN_MEMORY_MS = 60_000;

/** Lo único que el freno necesita saber de un plan. */
export interface BurstPlan {
  code: string;
  apiPorMinuto: number;
}

/**
 * Pedidos por minuto que admite una llave del plan `planCode`.
 *
 * El freno corre antes de preguntar al núcleo, así que no puede esperar su
 * respuesta: usa el plan que el núcleo dio la última vez. Una llave que no se
 * recuerda —la primera consulta, o una que nadie verificó— va con el ritmo por
 * omisión. Un plan sin API (ritmo cero) también: si el freno cerrara la puerta,
 * quien llama recibiría un 429 en lugar del 402 que le dice qué pasa.
 */
export function burstPerMinute(
  planCode: string | undefined,
  plans: ReadonlyArray<BurstPlan>,
): number {
  const plan = planCode === undefined ? undefined : plans.find((one) => one.code === planCode);
  return plan && plan.apiPorMinuto > 0 ? plan.apiPorMinuto : DEFAULT_BURST_PER_MINUTE;
}

/** Lo que se recuerda de una llave verificada: su plan y el uso del mes a esa hora. */
export interface RememberedPlan {
  planCode: string;
  used: number;
}

/**
 * El plan de cada llave, por su huella, durante `ttlMs`.
 *
 * En memoria del proceso, como los demás frenos del sitio. Se borra solo: lo
 * vencido se descarta al leerlo y, si el mapa pasa de `maxEntries`, de una vez.
 */
export class PlanMemory {
  private readonly entries = new Map<string, RememberedPlan & { at: number }>();
  // Campos escritos a mano y no como propiedades del constructor: `node --test`
  // lee este archivo quitando los tipos, y esa forma no es solo un tipo.
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number = PLAN_MEMORY_MS, maxEntries = 10_000) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  remember(keyHash: string, value: RememberedPlan, now: number): void {
    this.entries.delete(keyHash);
    this.entries.set(keyHash, { ...value, at: now });
    if (this.entries.size > this.maxEntries) {
      for (const [hash, entry] of this.entries) {
        if (now - entry.at >= this.ttlMs) this.entries.delete(hash);
      }
      // Si todas siguen vigentes, se va la más vieja: el mapa no crece sin fin.
      while (this.entries.size > this.maxEntries) {
        const oldest = this.entries.keys().next().value;
        if (oldest === undefined) break;
        this.entries.delete(oldest);
      }
    }
  }

  recall(keyHash: string, now: number): RememberedPlan | undefined {
    const entry = this.entries.get(keyHash);
    if (!entry) return undefined;
    if (now - entry.at >= this.ttlMs) {
      this.entries.delete(keyHash);
      return undefined;
    }
    return { planCode: entry.planCode, used: entry.used };
  }

  get size(): number {
    return this.entries.size;
  }
}

/* ------------------------------------------------ llaves fallidas por dirección */

/** Llaves rechazadas (mal escritas, desconocidas o revocadas) que admite una dirección… */
export const FAILED_KEYS_PER_WINDOW = 20;
/** …en esta ventana. */
export const FAILED_KEYS_WINDOW_MS = 10 * 60_000;

/** Un lugar reservado en la cuenta de fallos: se confirma si la llave falló, se libera si no. */
export interface FailureTicket {
  confirm(): void;
  release(): void;
}

export type FailureAdmission = { ok: true; ticket: FailureTicket } | { ok: false; retryAfter: number };

/**
 * Cuántas llaves rechazadas lleva cada dirección, para que nadie pruebe llaves
 * al azar contra el núcleo.
 *
 * El freno por minuto va por llave, y quien inventa una llave nueva en cada
 * pedido no lo toca nunca. Este va por dirección y cuenta solo los rechazos.
 * Como la respuesta del núcleo llega después de esperar, el lugar se reserva
 * antes (`admit`, sincrónico) y se confirma o se libera al saber: así veinte
 * pedidos simultáneos no ven todos la cuenta en cero.
 *
 * Un pedido rechazado aquí no cuenta. Si la puerta está cerrada solo por
 * reservas aún sin resolver, la espera es de un segundo: se resuelven en lo que
 * tarda el núcleo.
 */
/**
 * La clave con que se cuenta una dirección. Una IPv6 se agrupa por su /64,
 * que es lo que recibe una sola conexión: contar cada dirección dejaría a una
 * persona inventar miles.
 */
export function ledgerKey(address: string): string {
  if (!address.includes(':') || address.includes('.')) return address;
  const [cabeza = '', cola = ''] = address.toLowerCase().split('::');
  const izquierda = cabeza ? cabeza.split(':') : [];
  const derecha = address.includes('::') && cola ? cola.split(':') : [];
  const relleno = address.includes('::') ? Array(Math.max(0, 8 - izquierda.length - derecha.length)).fill('0') : [];
  const grupos = [...izquierda, ...relleno, ...derecha];
  return `${grupos.slice(0, 4).map((g) => g.replace(/^0+(?=.)/u, '')).join(':')}::/64`;
}

/** Donde cuentan juntas las direcciones nuevas cuando el registro está lleno. */
export const LEDGER_OVERFLOW = '*desborde*';

export class FailureLedger {
  private readonly entries = new Map<string, Array<{ at: number; pending: boolean }>>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxAddresses: number;
  private lastSweep = Number.NEGATIVE_INFINITY;

  constructor(limit = FAILED_KEYS_PER_WINDOW, windowMs = FAILED_KEYS_WINDOW_MS, maxAddresses = 10_000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxAddresses = maxAddresses;
  }

  private live(address: string, now: number): Array<{ at: number; pending: boolean }> {
    const kept = (this.entries.get(address) ?? []).filter((entry) => now - entry.at < this.windowMs);
    if (kept.length) this.entries.set(address, kept);
    else this.entries.delete(address);
    return kept;
  }

  admit(direccion: string, now: number): FailureAdmission {
    let address = ledgerKey(direccion);
    /*
     * Con el registro lleno no se descarta a nadie: borrar una dirección con
     * fallos vivos le devolvería su cupo. Se barre lo vencido (a lo sumo una vez
     * por segundo) y, si sigue lleno, la dirección nueva cuenta en un cupo
     * común: falla cerrado para quien inunde, sin crecer la memoria.
     */
    if (!this.entries.has(address) && this.entries.size >= this.maxAddresses) {
      if (now - this.lastSweep >= 1_000) {
        this.lastSweep = now;
        for (const key of [...this.entries.keys()]) this.live(key, now);
      }
      if (this.entries.size >= this.maxAddresses) address = LEDGER_OVERFLOW;
    }
    const kept = this.live(address, now);
    if (kept.length >= this.limit) {
      const confirmed = kept.filter((entry) => !entry.pending);
      const oldest = confirmed[0];
      const retryAfter =
        confirmed.length >= this.limit && oldest
          ? Math.max(1, Math.ceil((this.windowMs - (now - oldest.at)) / 1000))
          : 1;
      return { ok: false, retryAfter };
    }
    const entry = { at: now, pending: true };
    kept.push(entry);
    this.entries.set(address, kept);
    let settled = false;
    return {
      ok: true,
      ticket: {
        confirm: () => {
          if (settled) return;
          settled = true;
          entry.pending = false;
        },
        release: () => {
          if (settled) return;
          settled = true;
          const list = this.entries.get(address);
          const at = list ? list.indexOf(entry) : -1;
          if (list && at >= 0) list.splice(at, 1);
          if (list && list.length === 0) this.entries.delete(address);
        },
      },
    };
  }

  /** Fallos confirmados y reservas vigentes de una dirección. */
  count(address: string, now: number): number {
    return this.live(ledgerKey(address), now).length;
  }

  get addresses(): number {
    return this.entries.size;
  }
}

/* --------------------------------------------------------------------- cupo */

/** El primer día del mes siguiente, a medianoche UTC: cuando el cupo vuelve a cero. */
export function nextQuotaReset(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** Segundos enteros hasta el reinicio del cupo, nunca menos de uno. */
export function secondsToReset(now: Date): number {
  return Math.max(1, Math.ceil((nextQuotaReset(now).getTime() - now.getTime()) / 1000));
}

/**
 * Los tres encabezados de cupo que lleva toda respuesta.
 *
 * `used` ya incluye la consulta que se está contestando, así que lo restante es
 * lo que queda después de ella.
 */
export function quotaHeaders(limit: number, used: number, now: Date): Record<string, string> {
  const ceiling = Math.max(0, limit);
  return {
    'X-Cupo-Limite': String(ceiling),
    'X-Cupo-Restante': String(Math.max(0, ceiling - Math.max(0, used))),
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

/**
 * Una página de filas ya leídas, con el cursor de la siguiente o `null` al final.
 *
 * Con `cap`, la consulta entera no pasa de esas filas aunque se recorra por
 * cursor: la página que llega al tope trae `siguiente` en `null` y `capped`
 * dice que el tope dejó filas fuera.
 */
export function paginate<T>(
  rows: readonly T[],
  offset: number,
  pageSize: number,
  cap: number | null = null,
): { data: T[]; siguiente: string | null; capped: boolean } {
  const reachable = cap === null ? rows.length : Math.min(rows.length, Math.max(0, cap));
  const start = Math.min(offset, reachable);
  const data = rows.slice(start, Math.min(offset + pageSize, reachable));
  const end = start + data.length;
  return {
    data,
    siguiente: end < reachable ? encodeCursor({ o: end }) : null,
    capped: reachable < rows.length,
  };
}

/**
 * Las filas con un orden total: dentro de cada tramo de filas consecutivas que
 * `sameRun` considera iguales, por `idOf`.
 *
 * La base ordena por columnas que pueden repetirse (dos «Farmacia Central» en el
 * mismo barrio); sin desempate, dos pedidos de la misma consulta pueden traer
 * esas filas en otro orden, y una paginación por posición repetiría una y
 * saltaría la otra. El orden de la base se respeta: solo se ordenan los empates.
 */
export function breakTies<T>(
  rows: readonly T[],
  sameRun: (left: T, right: T) => boolean,
  idOf: (row: T) => string,
): T[] {
  const out: T[] = [];
  let run: T[] = [];
  const flush = () => {
    if (run.length > 1) run.sort((a, b) => (idOf(a) < idOf(b) ? -1 : idOf(a) > idOf(b) ? 1 : 0));
    out.push(...run);
    run = [];
  };
  for (const row of rows) {
    const previous = run[run.length - 1];
    if (previous !== undefined && !sameRun(previous, row)) flush();
    run.push(row);
  }
  flush();
  return out;
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

/** El nombre del archivo CSV de una ruta: «series/diario.X» → «datosbolivia-series-diario-x.csv». */
export function csvFileName(route: string): string {
  const slug = route
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 80)
    .replace(/-$/u, '');
  return `datosbolivia-${slug || 'datos'}.csv`;
}

/* -------------------------------------------------------------- parámetros */

/**
 * Un parámetro leído, o el motivo por el que no se acepta.
 *
 * Todos los 400 se escriben con `paramError`, así que todos dicen lo mismo de
 * la misma manera: qué parámetro y qué se espera de él.
 */
export type Parsed<T> = { ok: true; value: T } | { ok: false; param: string; error: string };

/** «El parámetro «pageSize» no es válido: va de 1 a 5000.» */
export function paramError(param: string, rule: string): string {
  return `El parámetro «${param}» no es válido: ${rule}.`;
}

/** «Falta el parámetro «ciudad»: una o varias, separadas por coma.» */
export function missingParam(param: string, rule: string): string {
  return `Falta el parámetro «${param}»: ${rule}.`;
}

function invalid(param: string, rule: string): { ok: false; param: string; error: string } {
  return { ok: false, param, error: paramError(param, rule) };
}

export function parsePageSize(raw: string | null): Parsed<number> {
  if (raw === null || raw === '') return { ok: true, value: DEFAULT_PAGE_SIZE };
  if (!/^\d{1,6}$/u.test(raw)) return invalid('pageSize', `es un número entero de 1 a ${MAX_PAGE_SIZE}`);
  const value = Number(raw);
  if (value < 1 || value > MAX_PAGE_SIZE) {
    return invalid('pageSize', `es un número entero de 1 a ${MAX_PAGE_SIZE}`);
  }
  return { ok: true, value };
}

export function parseFormat(raw: string | null): Parsed<'json' | 'csv'> {
  if (raw === null || raw === '' || raw === 'json') return { ok: true, value: 'json' };
  if (raw === 'csv') return { ok: true, value: 'csv' };
  return invalid('formato', 'es «json» o «csv»');
}

export function parseCursorParam(raw: string | null): Parsed<number> {
  if (raw === null || raw === '') return { ok: true, value: 0 };
  const cursor = decodeCursor(raw);
  return cursor
    ? { ok: true, value: cursor.o }
    : invalid('cursor', 'tiene que ser el valor de «siguiente» de la página anterior');
}

/** «2024», «2024-07» o «2024-07-15»; vacío es «sin límite». */
export function parseDateParam(name: string, raw: string | null): Parsed<string | undefined> {
  if (raw === null || raw.trim() === '') return { ok: true, value: undefined };
  const value = raw.trim();
  if (!/^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/u.test(value)) {
    return invalid(name, 'va como AAAA, AAAA-MM o AAAA-MM-DD');
  }
  return { ok: true, value };
}

/** Un año de cuatro cifras entre `min` y `max`; vacío es «sin límite». */
export function parseYearParam(
  name: string,
  raw: string | null,
  min: number,
  max: number,
): Parsed<number | undefined> {
  if (raw === null || raw.trim() === '') return { ok: true, value: undefined };
  const value = raw.trim();
  if (!/^\d{4}$/u.test(value) || Number(value) < min || Number(value) > max) {
    return invalid(name, `es un año de ${min} a ${max} (AAAA)`);
  }
  return { ok: true, value: Number(value) };
}

/** «1-7»: de enero a julio de cada año. Vacío es el año entero. */
export function parseMonthRange(name: string, raw: string | null): Parsed<string | undefined> {
  if (raw === null || raw.trim() === '') return { ok: true, value: undefined };
  const match = /^(\d{1,2})-(\d{1,2})$/u.exec(raw.trim());
  const first = Number(match?.[1]);
  const last = Number(match?.[2]);
  if (!match || first < 1 || last > 12 || first > last) {
    return invalid(name, 'es un tramo de meses como 1-7, del 1 al 12');
  }
  return { ok: true, value: `${first}-${last}` };
}

/** Un texto libre de hasta `max` caracteres; vacío es «sin filtro». */
export function parseTextParam(
  name: string,
  raw: string | null,
  max = MAX_TEXT_LENGTH,
): Parsed<string> {
  const value = (raw ?? '').trim();
  if (value.length > max) return invalid(name, `admite hasta ${max} caracteres`);
  return { ok: true, value };
}

/** Valores separados por coma, sin repetidos ni vacíos, con tope de cantidad y de largo. */
export function parseList(raw: string | null, limit: number, maxLength = MAX_TEXT_LENGTH): string[] {
  if (!raw) return [];
  const values = raw
    .split(',')
    .map((one) => one.trim().slice(0, maxLength))
    .filter((one) => one.length > 0);
  return [...new Set(values)].slice(0, limit);
}

/**
 * Como `parseList`, pero lo que no cabe es un 400 y no se recorta en silencio:
 * una ciudad de más o un código mal escrito que se descartara daría una
 * respuesta que parece completa y no lo es.
 */
export function parseListParam(
  name: string,
  raw: string | null,
  options: { limit: number; maxLength?: number; pattern?: RegExp; what?: string },
): Parsed<string[]> {
  const maxLength = options.maxLength ?? MAX_TEXT_LENGTH;
  const values = [
    ...new Set(
      (raw ?? '')
        .split(',')
        .map((one) => one.trim())
        .filter((one) => one.length > 0),
    ),
  ];
  if (values.length > options.limit) {
    return invalid(name, `admite hasta ${options.limit} valores separados por coma`);
  }
  const tooLong = values.find((one) => one.length > maxLength);
  if (tooLong !== undefined) return invalid(name, `cada valor admite hasta ${maxLength} caracteres`);
  if (options.pattern) {
    const pattern = options.pattern;
    const wrong = values.find((one) => !pattern.test(one));
    if (wrong !== undefined) {
      return invalid(name, `«${wrong.slice(0, 40)}» no es ${options.what ?? 'un valor admitido'}`);
    }
  }
  return { ok: true, value: values };
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

/* ------------------------------------------------------------- actualizado */

/**
 * Un instante de la base en ISO 8601, o el texto tal cual si no es un instante.
 *
 * Postgres escribe `timestamptz::text` como «2026-09-01 12:00:00+00»; un
 * cliente que lee la API espera «2026-09-01T12:00:00.000Z». Una fecha sola
 * («2026-09-01») o un periodo («2025», «2026-08») ya son lo que dicen.
 */
export function toIsoInstant(text: string | null | undefined): string | null {
  if (text === null || text === undefined || text.trim() === '') return null;
  const value = text.trim();
  if (/^\d{4}(-\d{2}(-\d{2})?)?$/u.test(value)) return value;
  const normalized = value.replace(' ', 'T').replace(/([+-]\d{2})$/u, '$1:00');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

/** El más reciente de varios instantes, fechas o periodos en forma ISO; `null` si no hay ninguno. */
export function latestOf(values: ReadonlyArray<string | null | undefined>): string | null {
  let latest: string | null = null;
  for (const value of values) {
    if (value && (latest === null || value > latest)) latest = value;
  }
  return latest;
}

/* ------------------------------------------------------------------ series */

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

/**
 * El nombre que el sitio da a cada serie diaria.
 *
 * Las series diarias no traen un nombre publicado; estos son los del propio
 * tablero, los mismos de la página de Fuentes (`NAMES` en
 * `components/sources-explorer.tsx`; una prueba unitaria comprueba que no se
 * separen). Una serie diaria que no está aquí toma el nombre que trae su
 * registro de fuentes.
 */
export const DAILY_SERIES_NAMES: Readonly<Record<string, string>> = {
  FX_OFFICIAL_USD_BOB: 'Tipo de cambio oficial',
  FX_PARALLEL_USD_BOB: 'Dólar paralelo',
  UFV_BOB: 'Unidad de Fomento de Vivienda',
  BTC_USD: 'Bitcoin',
  USDT_USD: 'Fichas estables USDT y USDC',
  XAU_USD: 'Oro (PAX Gold)',
  GOLD_USD_OZT: 'Oro, cotización oficial del BCB',
};

/** La unidad con que el sitio publica cada serie diaria (la misma de `/api/export`). */
const DAILY_UNITS: Readonly<Record<string, string>> = {
  FX_OFFICIAL_USD_BOB: 'BOB/USD',
  FX_PARALLEL_USD_BOB: 'BOB/USD',
  UFV_BOB: 'BOB/UFV',
  BTC_USD: 'USD',
  USDT_USD: 'USD',
  XAU_USD: 'USD',
};

/** Quién responde por la cifra cuando el registro de fuentes no basta para decirlo. */
const DAILY_EDITORS: Readonly<Record<string, string>> = {
  FX_OFFICIAL_USD_BOB: 'Banco Central de Bolivia',
  UFV_BOB: 'Banco Central de Bolivia',
  GOLD_USD_OZT: 'Banco Central de Bolivia',
};

/** El paralelo es la mediana de varias plazas: la cifra es un cálculo propio. */
const PARALLEL_EDITOR = 'DatosBolivia.com, a partir de cotizaciones publicadas';

/** El paralelo por ficha: «FX_PARALLEL_USDT_BOB» es el dólar paralelo pagado en USDT. */
const PARALLEL_BY_TOKEN = /^FX_PARALLEL_([A-Z0-9]+)_BOB$/u;

const SIDE_LABELS: Readonly<Record<string, string>> = {
  BUY: 'compra',
  SELL: 'venta',
  OFFICIAL: 'tasa publicada',
};

/** Lo que el registro de fuentes dice de un indicador diario. */
export interface DailyRegistryEntry {
  name: string | null;
  unit: string | null;
  publishers: readonly string[];
}

export interface DailyLabel {
  nombre: string;
  unidad: string | null;
  editor: string;
  rubro: string;
}

/**
 * Nombre, unidad, editor y rubro de una serie diaria por su clave
 * («FX_PARALLEL_USDT_BOB:SELL»): el indicador con el nombre del sitio y, si la
 * clave lleva lado, el lado en castellano.
 *
 * El orden del nombre: el que el sitio le da (`DAILY_SERIES_NAMES`); el del
 * paralelo por ficha, con la ficha escrita como la escribe el tablero
 * (`tokenLabels`, el recuento de fichas estables); el que trae el registro de
 * fuentes; y por último la clave misma.
 */
export function dailySeriesLabel(
  key: string,
  registry: ReadonlyMap<string, DailyRegistryEntry>,
  tokenLabels: Readonly<Record<string, { label: string }>> = {},
): DailyLabel {
  const [indicator = key, side] = key.split(':');
  const entry = registry.get(indicator);
  const token = PARALLEL_BY_TOKEN.exec(indicator)?.[1];
  const parallel = indicator.startsWith('FX_PARALLEL_');
  const base =
    DAILY_SERIES_NAMES[indicator] ??
    (token && token !== 'USD' ? `Dólar paralelo en ${tokenLabels[token]?.label ?? token}` : null) ??
    entry?.name ??
    indicator;
  const sideLabel = side ? (SIDE_LABELS[side] ?? side.toLowerCase()) : null;
  return {
    nombre: sideLabel ? `${base}, ${sideLabel}` : base,
    unidad: DAILY_UNITS[indicator] ?? entry?.unit ?? (parallel ? 'BOB/USD' : null),
    editor:
      DAILY_EDITORS[indicator] ??
      (parallel ? PARALLEL_EDITOR : null) ??
      (entry && entry.publishers.length > 0 ? entry.publishers.join('; ') : 'DatosBolivia.com'),
    rubro: indicator.startsWith('FX_') || indicator === 'UFV_BOB' ? 'TIPO_DE_CAMBIO' : 'MERCADOS',
  };
}

/* ---------------------------------------------------------------- BCB */

/**
 * Las columnas que el lector del cuaderno del BCB tomó por series y son el eje
 * («Mes», «Fecha», «Año»…). Es la misma condición que aplica `lib/bcb.ts` al
 * catálogo del tablero; una prueba unitaria comprueba que no se separen.
 */
export const BCB_NOT_AN_INDICATOR =
  "name !~* '^(mes|meses|fecha|fechas|a[nñ]o|a[nñ]os|per[ií]odo|trimestre|semana|d[ií]a|gesti[oó]n|n|no|n[°º]|[ií]tem|c[oó]digo|columna [a-z]{1,2})( \\(\\d+\\))?$'";

/** `%` y `_` del texto buscado son texto, no comodines. */
const likeLiteral = (text: string): string => text.replace(/[\\%_]/gu, (char) => `\\${char}`);

/**
 * El `WHERE` del catálogo del BCB para la API, con los valores como parámetros:
 * la familia por igualdad y cada palabra buscada en el nombre, la hoja o el
 * informe, como en el explorador del tablero.
 */
export function bcbCatalogueWhere(filter: { family: string; text: string }): {
  where: string;
  values: string[];
} {
  const conditions = [BCB_NOT_AN_INDICATOR];
  const values: string[] = [];
  if (filter.family) {
    values.push(filter.family);
    conditions.push(`family = $${values.length}`);
  }
  for (const word of filter.text.trim().split(/\s+/u).filter(Boolean).slice(0, 5)) {
    values.push(`%${likeLiteral(word)}%`);
    const at = values.length;
    conditions.push(`(name ILIKE $${at} OR sheet ILIKE $${at} OR workbook ILIKE $${at})`);
  }
  return { where: `WHERE ${conditions.join(' AND ')}`, values };
}

/* ----------------------------------------------------------------- registro */

/** La línea de registro de una respuesta servida: sin la llave, con el prefijo de la cuenta. */
export function usageLogLine(route: string, accountId: string, rows: number): string {
  return JSON.stringify({
    evento: 'api_v1',
    ruta: route,
    cuenta: accountId.slice(0, 8),
    filas: rows,
  });
}

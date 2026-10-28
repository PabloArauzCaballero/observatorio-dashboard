import 'server-only';
import { jsonResponse } from '@/lib/respond';
import { CORS_HEADERS, apiError, authorize, type ApiCaller } from './auth';
import {
  csvFileName,
  missingParam,
  paramError,
  parseCursorParam,
  parseFormat,
  parsePageSize,
  toCsv,
  usageLogLine,
  type CsvValue,
  type Parsed,
} from './contrato';

/**
 * El recorrido común de toda ruta de `/api/v1`: autorizar, leer los parámetros
 * de página y formato, pedirle las filas a la ruta y servirlas en JSON o CSV con
 * los encabezados de cupo.
 *
 * La ruta solo dice qué filas son y de dónde salen; el contrato —la forma
 * `{data, siguiente, fuente, actualizado}`, los errores, el registro— se
 * escribe una vez.
 */

export type ApiRow = Record<string, CsvValue>;

export interface PageRequest {
  caller: ApiCaller;
  params: URLSearchParams;
  offset: number;
  pageSize: number;
}

export interface ApiPage {
  data: ApiRow[];
  siguiente: string | null;
  fuente: string;
  /**
   * Hasta cuándo está al día la fuente que respondió: el instante en que llegó
   * su último dato (ISO 8601) o la fecha o el periodo de ese dato; `null`
   * cuando la fuente no lo registra.
   */
  actualizado: string | null;
  /** Encabezados propios de la ruta (p. ej. `X-Tope-Lugares`). */
  headers?: Record<string, string>;
}

/**
 * Un parámetro que la ruta no acepta: se contesta 400 con el nombre del
 * parámetro y la frase, escrita siempre con `paramError` o `missingParam`.
 */
export class BadParam extends Error {
  readonly param: string;

  constructor(param: string, message: string) {
    super(message);
    this.name = 'BadParam';
    this.param = param;
  }

  /** «El parámetro «x» no es válido: …». */
  static invalid(param: string, rule: string): BadParam {
    return new BadParam(param, paramError(param, rule));
  }

  /** «Falta el parámetro «x»: …». */
  static missing(param: string, rule: string): BadParam {
    return new BadParam(param, missingParam(param, rule));
  }
}

/** El valor de un parámetro ya leído, o el 400 que corresponde. */
export function accept<T>(parsed: Parsed<T>): T {
  if (!parsed.ok) throw new BadParam(parsed.param, parsed.error);
  return parsed.value;
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function badRequest(error: BadParam, headers: Record<string, string>): Response {
  return apiError(400, error.message, headers, { parametro: error.param });
}

export async function serve(
  request: Request,
  route: string,
  produce: (page: PageRequest) => Promise<ApiPage>,
): Promise<Response> {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const { caller } = auth;

  let page: ApiPage;
  let format: 'json' | 'csv';
  try {
    const params = new URL(request.url).searchParams;
    format = accept(parseFormat(params.get('formato')));
    const pageSize = accept(parsePageSize(params.get('pageSize')));
    const offset = accept(parseCursorParam(params.get('cursor')));
    page = await produce({ caller, params, offset, pageSize });
  } catch (error) {
    if (error instanceof BadParam) return badRequest(error, caller.headers);
    // El detalle va al registro: un mensaje de conexión puede llevar el host.
    console.error(`[observatorio] api-v1 ${route}: lectura fallida`, error);
    return apiError(503, 'No fue posible leer los datos. Conviene reintentar en unos minutos.', {
      ...caller.headers,
      'Retry-After': '60',
    });
  }

  console.info(usageLogLine(route, caller.account.subscriberAccountId, page.data.length));

  const { headers: own = {}, ...body } = page;
  const headers = { ...CORS_HEADERS, ...caller.headers, ...own, 'Cache-Control': 'no-store' };
  if (format === 'csv') {
    return new Response(toCsv(body.data), {
      headers: {
        ...headers,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csvFileName(route)}"`,
        ...(body.siguiente ? { 'X-Siguiente': body.siguiente } : {}),
      },
    });
  }
  return jsonResponse(request, body, { headers });
}

/** Una respuesta de un solo objeto (`/uso`): sin página ni CSV. */
export async function serveObject(
  request: Request,
  route: string,
  produce: (caller: ApiCaller) => Record<string, unknown>,
): Promise<Response> {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const body = produce(auth.caller);
  console.info(usageLogLine(route, auth.caller.account.subscriberAccountId, 1));
  return Response.json(body, {
    headers: { ...CORS_HEADERS, ...auth.caller.headers, 'Cache-Control': 'no-store' },
  });
}

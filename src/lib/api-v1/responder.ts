import 'server-only';
import { jsonResponse } from '@/lib/respond';
import { CORS_HEADERS, apiError, authorize, type ApiCaller } from './auth';
import {
  parseCursorParam,
  parseFormat,
  parsePageSize,
  toCsv,
  usageLogLine,
  type CsvValue,
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
  actualizado: string | null;
}

/** Un parámetro que la ruta no acepta: se contesta 400 con la frase. */
export class BadParam extends Error {}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function serve(
  request: Request,
  route: string,
  produce: (page: PageRequest) => Promise<ApiPage>,
): Promise<Response> {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const { caller } = auth;

  const params = new URL(request.url).searchParams;
  const format = parseFormat(params.get('formato'));
  const pageSize = parsePageSize(params.get('pageSize'));
  const offset = parseCursorParam(params.get('cursor'));
  for (const parsed of [format, pageSize, offset]) {
    if (!parsed.ok) return apiError(400, parsed.error, caller.headers);
  }
  if (!format.ok || !pageSize.ok || !offset.ok) return apiError(400, 'Parámetros inválidos.', caller.headers);

  let page: ApiPage;
  try {
    page = await produce({ caller, params, offset: offset.value, pageSize: pageSize.value });
  } catch (error) {
    if (error instanceof BadParam) return apiError(400, error.message, caller.headers);
    // El detalle va al registro: un mensaje de conexión puede llevar el host.
    console.error(`[observatorio] api-v1 ${route}: lectura fallida`, error);
    return apiError(503, 'No fue posible leer los datos. Conviene reintentar en unos minutos.', {
      ...caller.headers,
      'Retry-After': '60',
    });
  }

  console.info(usageLogLine(route, caller.account.subscriberAccountId, page.data.length));

  const headers = { ...CORS_HEADERS, ...caller.headers, 'Cache-Control': 'no-store' };
  if (format.value === 'csv') {
    return new Response(toCsv(page.data), {
      headers: {
        ...headers,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="datosbolivia-${route.replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '')}.csv"`,
        ...(page.siguiente ? { 'X-Siguiente': page.siguiente } : {}),
      },
    });
  }
  return jsonResponse(request, page, { headers });
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

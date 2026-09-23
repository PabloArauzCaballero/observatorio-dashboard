import 'server-only';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

/**
 * Una respuesta JSON comprimida por el propio proceso.
 *
 * Next comprime las páginas y los estáticos, **no** lo que devuelve un route
 * handler: medido el 2026-09-23, la portada salía en gzip y cada `/api/*` en
 * `identity`, con el mismo servidor y la misma petición. En Contabo no se
 * notaba porque el proxy de delante comprime; en pablo-h310, detrás del Funnel
 * de Tailscale, viajaban en crudo —2,5 MB `/api/panel`, 1,8 MB `/api/temas`,
 * 1,5 MB los lugares de Santa Cruz— lo que en gzip son 680, 120 y 313 KB.
 *
 * Brotli si el navegador lo acepta, que en JSON pesa un quinto menos que gzip, y
 * a calidad 5 y no a la 11 de fábrica: la 11 tarda segundos con un par de megas
 * y esto se hace en cada petición. Con `Content-Encoding` ya puesto, un proxy
 * que comprime —el de Contabo— lo deja pasar tal cual en vez de hacerlo dos
 * veces.
 *
 * Los cuerpos pequeños van sin comprimir: por debajo de un kilobyte la cabecera
 * de brotli y el trabajo cuestan más de lo que ahorran.
 */
const MIN_BYTES = 1024;

export function jsonResponse(
  request: Request,
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const raw = Buffer.from(JSON.stringify(body), 'utf8');
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.append('Vary', 'Accept-Encoding');

  const accepts = request.headers.get('accept-encoding') ?? '';
  let payload: Buffer = raw;
  if (raw.length >= MIN_BYTES && /\bbr\b/.test(accepts)) {
    payload = brotliCompressSync(raw, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 5,
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
        [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
      },
    });
    headers.set('Content-Encoding', 'br');
  } else if (raw.length >= MIN_BYTES && /\bgzip\b/.test(accepts)) {
    payload = gzipSync(raw, { level: 6 });
    headers.set('Content-Encoding', 'gzip');
  }
  headers.set('Content-Length', String(payload.length));

  return new Response(new Uint8Array(payload), { status: init.status ?? 200, headers });
}

#!/usr/bin/env node
/**
 * Sondeo de latencia del tablero: cuándo llega cada trozo, no cuánto tarda el total.
 *
 * `curl -w %{time_total}` dice 16 s y no dice por qué. Lo que lo dijo el
 * 2026-09-22 fue fechar CADA trozo que llega: cabecera al segundo 1, después
 * nada hasta el 16, y luego un megabyte en dos segundos. Una conexión muda no
 * es una conexión lenta, y el total las confunde. Este sondeo es ese
 * cronómetro, escrito una vez para no volver a improvisarlo en un scratchpad.
 *
 * Para cada dirección mide, en milisegundos desde el inicio de la petición:
 *
 *   ttfb   — la cabecera HTTP (el servidor decidió qué contestar).
 *   body   — el primer byte de cuerpo descomprimido.
 *   marcas — la primera aparición de cada cadena pedida con `--marca`
 *            (p. ej. «Datos al» dice cuándo el observatorio contestó; «Brecha
 *            cambiaria» cuándo llegó el resumen detrás del `Suspense`).
 *   total  — el último byte.
 *   bytes  — en la red (comprimidos) y descomprimidos, con la codificación y
 *            el `Cache-Control` que el servidor puso.
 *
 * FRÍO Y CALIENTE NO SE DISTINGUEN SOLOS. `src/lib/hold.ts` sostiene cada
 * lectura cinco minutos, así que la segunda medición dentro de ese plazo mide
 * la memoria y no la consulta. Para medir en frío hay que dejar el tablero sin
 * tocar cinco minutos, o correr `--rondas 2` y leer la primera como frío y la
 * segunda como caliente. Desde la 0083 el servidor renueva lo sostenido por
 * detrás, así que «frío» sólo existe en los primeros segundos tras arrancar el
 * proceso; ese arranque se ve con `startedAt` en `/api/version`.
 *
 * Uso:
 *
 *   node scripts/latency-probe.mjs https://test.datosbolivia.com
 *   node scripts/latency-probe.mjs https://pablo-h310.taila8f993.ts.net:10000 --inseguro
 *   node scripts/latency-probe.mjs <base> --rondas 2 --ruta / --ruta /api/panel
 *   node scripts/latency-probe.mjs <base> --chunks     # pesa el JavaScript de la portada
 *
 * Sin `--ruta` mide la portada y todas las rutas públicas de `src/app/api/*`
 * que una pestaña pide al abrirse. `--inseguro` acepta el certificado del
 * Funnel de Tailscale cuando Node no lo reconoce. Imprime un cuadro Markdown
 * listo para pegar en un informe.
 */
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';

/** Lo que una pestaña pide al abrirse, con la portada delante. */
const RUTAS_POR_DEFECTO = [
  '/',
  '/api/version',
  '/api/panel',
  '/api/medidas',
  '/api/empresas',
  '/api/exportadoras',
  '/api/familias',
  '/api/lugares?ciudad=Santa%20Cruz',
  '/api/departamentos',
  '/api/temas',
  '/api/archivo',
  '/api/prensa?tema=ECONOMICOS',
  '/api/fuentes',
  '/api/energia',
  '/api/recursos',
  '/api/ambiente',
  '/api/mundo',
];

/** Cadenas cuya primera aparición en la portada fecha cada etapa del flujo. */
const MARCAS_PORTADA = ['Datos al', 'Brecha cambiaria', 'Armando el resumen', '</html>'];

function leerArgumentos(argv) {
  const opciones = { rutas: [], marcas: [], rondas: 1, inseguro: false, chunks: false, base: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--ruta') opciones.rutas.push(argv[++i]);
    else if (arg === '--marca') opciones.marcas.push(argv[++i]);
    else if (arg === '--rondas') opciones.rondas = Number(argv[++i]) || 1;
    else if (arg === '--inseguro') opciones.inseguro = true;
    else if (arg === '--chunks') opciones.chunks = true;
    else if (!opciones.base) opciones.base = arg.replace(/\/$/, '');
  }
  if (!opciones.base) {
    console.error('Uso: node scripts/latency-probe.mjs <base-url> [--ruta /x]... [--rondas n] [--inseguro] [--chunks]');
    process.exit(2);
  }
  if (opciones.rutas.length === 0) opciones.rutas = RUTAS_POR_DEFECTO;
  return opciones;
}

/** El descompresor que corresponde a lo que el servidor dijo mandar. */
function descompresor(codificacion) {
  if (codificacion === 'gzip') return createGunzip();
  if (codificacion === 'br') return createBrotliDecompress();
  if (codificacion === 'deflate') return createInflate();
  return null;
}

/**
 * Una petición, fechada trozo a trozo.
 *
 * Devuelve los hitos en ms desde el inicio y los pesos. `marcas` se buscan en
 * el cuerpo descomprimido a medida que llega; sólo se anota la primera vez.
 */
export function sondear(url, { marcas = [], inseguro = false } = {}) {
  return new Promise((resolve) => {
    const inicio = process.hrtime.bigint();
    const ms = () => Number(process.hrtime.bigint() - inicio) / 1e6;
    const parsed = new URL(url);
    const pedir = parsed.protocol === 'http:' ? httpRequest : httpsRequest;
    const resultado = {
      url: parsed.pathname + parsed.search,
      status: 0,
      ttfb: null,
      body: null,
      total: null,
      bytesRed: 0,
      bytesClaro: 0,
      codificacion: '-',
      cacheControl: '-',
      marcas: Object.fromEntries(marcas.map((m) => [m, null])),
      error: null,
    };
    let cola = '';
    const pendientes = new Set(marcas);

    const req = pedir(
      parsed,
      {
        method: 'GET',
        rejectUnauthorized: !inseguro,
        headers: {
          'accept-encoding': 'br, gzip, deflate',
          accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          'user-agent': 'observatorio-latency-probe/1',
        },
      },
      (res) => {
        resultado.status = res.statusCode ?? 0;
        resultado.ttfb = ms();
        resultado.codificacion = res.headers['content-encoding'] ?? 'identity';
        resultado.cacheControl = res.headers['cache-control'] ?? '-';
        const inflar = descompresor(resultado.codificacion);
        const claro = inflar ? res.pipe(inflar) : res;

        res.on('data', (chunk) => {
          resultado.bytesRed += chunk.length;
        });
        claro.on('data', (chunk) => {
          if (resultado.body === null) resultado.body = ms();
          resultado.bytesClaro += chunk.length;
          if (pendientes.size > 0) {
            // Una marca puede partirse entre dos trozos: se conserva una cola.
            cola = (cola + chunk.toString('utf8')).slice(-4096 - chunk.length);
            for (const marca of [...pendientes]) {
              if (cola.includes(marca)) {
                resultado.marcas[marca] = ms();
                pendientes.delete(marca);
              }
            }
            cola = cola.slice(-256);
          }
        });
        claro.on('end', () => {
          resultado.total = ms();
          resolve(resultado);
        });
        claro.on('error', (error) => {
          resultado.error = String(error.message ?? error);
          resultado.total = ms();
          resolve(resultado);
        });
      },
    );
    req.on('error', (error) => {
      resultado.error = String(error.message ?? error);
      resultado.total = ms();
      resolve(resultado);
    });
    req.setTimeout(120_000, () => {
      resultado.error = 'plazo de 120 s agotado';
      req.destroy();
    });
    req.end();
  });
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const seg = (v) => (v === null || v === undefined ? '—' : `${(v / 1000).toFixed(2)} s`);

function fila(r, ronda) {
  const marcas = Object.entries(r.marcas)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k.replace('</html>', 'fin')} ${seg(v)}`)
    .join(' · ');
  return `| ${r.url} | ${ronda} | ${r.status}${r.error ? ` (${r.error})` : ''} | ${seg(r.ttfb)} | ${seg(r.body)} | ${seg(r.total)} | ${kb(r.bytesRed)} / ${kb(r.bytesClaro)} | ${r.codificacion} | ${r.cacheControl} | ${marcas} |`;
}

/** Los chunks de JavaScript que la portada carga, con su peso en red. */
async function pesarChunks(base, inseguro) {
  const portada = await new Promise((resolve, reject) => {
    const parsed = new URL(`${base}/`);
    const pedir = parsed.protocol === 'http:' ? httpRequest : httpsRequest;
    const req = pedir(parsed, { rejectUnauthorized: !inseguro, headers: { 'accept-encoding': 'gzip' } }, (res) => {
      const inflar = descompresor(res.headers['content-encoding'] ?? 'identity');
      const claro = inflar ? res.pipe(inflar) : res;
      const trozos = [];
      claro.on('data', (c) => trozos.push(c));
      claro.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
      claro.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
  const rutas = [...new Set([...portada.matchAll(/\/_next\/static\/(?:chunks|css)\/[^"'\s]+\.(?:js|css)/g)].map((m) => m[0]))];
  const filas = [];
  let red = 0;
  let claro = 0;
  for (const ruta of rutas) {
    const r = await sondear(`${base}${ruta}`, { inseguro });
    red += r.bytesRed;
    claro += r.bytesClaro;
    filas.push(`| ${ruta.replace('/_next/static/', '')} | ${kb(r.bytesRed)} | ${kb(r.bytesClaro)} | ${r.codificacion} | ${seg(r.total)} |`);
  }
  console.log(`\n### JavaScript y CSS que carga la portada (${rutas.length} ficheros)\n`);
  console.log('| fichero | red | claro | codificación | total |');
  console.log('|---|---|---|---|---|');
  for (const f of filas) console.log(f);
  console.log(`| **suma** | **${kb(red)}** | **${kb(claro)}** | | |`);
}

async function main() {
  const opciones = leerArgumentos(process.argv.slice(2));
  console.log(`\n### ${opciones.base} — ${new Date().toISOString()}\n`);
  console.log('| ruta | ronda | estado | TTFB | 1.er byte | total | red / claro | codif. | Cache-Control | marcas |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (let ronda = 1; ronda <= opciones.rondas; ronda += 1) {
    for (const ruta of opciones.rutas) {
      const marcas = ruta === '/' ? [...MARCAS_PORTADA, ...opciones.marcas] : opciones.marcas;
      const r = await sondear(`${opciones.base}${ruta}`, { marcas, inseguro: opciones.inseguro });
      console.log(fila(r, ronda));
    }
  }
  if (opciones.chunks) await pesarChunks(opciones.base, opciones.inseguro);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

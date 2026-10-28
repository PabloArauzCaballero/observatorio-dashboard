#!/usr/bin/env node
/*
 * Verificación de la fase 3 del plan de monetización: recorre `/api/v1` con una
 * llave de prueba y comprueba el contrato desplegado.
 *
 *   node scripts/probar-api-v1.mjs --base https://test.datosbolivia.com --llave obs_live_…
 *   API_V1_LLAVE=obs_live_… node scripts/probar-api-v1.mjs --base https://test.datosbolivia.com
 *   node scripts/probar-api-v1.mjs --base https://test.datosbolivia.com --solo-publico
 *
 * Opciones:
 *   --base URL        el sitio (por omisión https://test.datosbolivia.com)
 *   --llave LLAVE     la llave (o la variable API_V1_LLAVE, que no queda en el historial)
 *   --ciudad NOMBRE   la ciudad para /lugares (por omisión «La Paz»)
 *   --rafaga          además, pasa el ritmo por minuto del plan y espera el 429
 *                     (gasta tantas consultas del cupo como admite el plan por minuto)
 *   --solo-publico    sin llave: solo OpenAPI, CORS y los 401
 *
 * Comprueba:
 *   - cada ruta en JSON y en CSV, siguiendo `siguiente` (o `X-Siguiente`) dos veces;
 *   - los encabezados de cupo en toda respuesta de la API, también en las de error;
 *   - 401 sin llave, con una llave mal escrita y con una llave bien escrita que no existe;
 *   - un 400 con `parametro`;
 *   - CORS en OPTIONS de cada ruta;
 *   - el tope de lugares del plan (`siguiente` en null al llegar, `X-Tope-Lugares`);
 *   - que `/uso` descuente lo consultado.
 *
 * Imprime una tabla PASS/FAIL/SKIP y sale con 1 si algo falló (2 si los
 * argumentos no sirven). La llave nunca se imprime: toda salida pasa por
 * `redact`, que borra cualquier cosa con forma de llave.
 */
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const ROUTES = [
  '/api/v1/uso',
  '/api/v1/series',
  '/api/v1/series/{codigo}',
  '/api/v1/lugares',
  '/api/v1/prensa',
  '/api/v1/empresas',
  '/api/v1/aduana',
];

export const QUOTA_HEADERS = ['x-cupo-limite', 'x-cupo-restante', 'x-cupo-reinicio'];

const KEY_SHAPE = /obs_live_[A-Za-z0-9_-]{43}/gu;
const TIMEOUT_MS = 90_000;
const BOM = '﻿';

/* ------------------------------------------------------------ piezas puras */

/** Los argumentos de la línea de órdenes, o un error con el motivo. */
export function parseArgs(argv, env = {}) {
  const options = {
    base: 'https://test.datosbolivia.com',
    key: env.API_V1_LLAVE ?? null,
    city: 'La Paz',
    burst: false,
    publicOnly: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) throw new Error(`${arg} necesita un valor`);
      i += 1;
      return next;
    };
    if (arg === '--base') options.base = value();
    else if (arg === '--llave') options.key = value();
    else if (arg === '--ciudad') options.city = value();
    else if (arg === '--rafaga') options.burst = true;
    else if (arg === '--solo-publico') options.publicOnly = true;
    else throw new Error(`opción desconocida: ${arg}`);
  }
  if (!/^https?:\/\/[^/\s]+/u.test(options.base)) throw new Error('--base tiene que ser una URL http(s)');
  options.base = options.base.replace(/\/+$/u, '');
  if (!options.publicOnly) {
    if (!options.key) throw new Error('falta --llave (o API_V1_LLAVE), o --solo-publico');
    if (!/^obs_live_[A-Za-z0-9_-]{43}$/u.test(options.key)) {
      throw new Error('la llave no tiene la forma obs_live_ más 43 caracteres');
    }
  }
  return options;
}

/** Borra la llave —y cualquier cosa con su forma— de un texto que se va a imprimir. */
export function redact(text, key) {
  let out = String(text);
  if (key) out = out.split(key).join('obs_live_[oculta]');
  return out.replace(KEY_SHAPE, 'obs_live_[oculta]');
}

/** Lo que falta o no cuadra en los encabezados de cupo de una respuesta. */
export function quotaProblems(headers) {
  const problems = [];
  for (const name of QUOTA_HEADERS) {
    if (headers[name] === undefined) problems.push(`falta ${name}`);
  }
  const limit = Number(headers['x-cupo-limite']);
  const left = Number(headers['x-cupo-restante']);
  if (headers['x-cupo-limite'] !== undefined && !(Number.isInteger(limit) && limit >= 0)) {
    problems.push('x-cupo-limite no es un entero ≥ 0');
  }
  if (headers['x-cupo-restante'] !== undefined && !(Number.isInteger(left) && left >= 0)) {
    problems.push('x-cupo-restante no es un entero ≥ 0');
  }
  if (Number.isInteger(limit) && Number.isInteger(left) && left > limit) {
    problems.push('x-cupo-restante pasa de x-cupo-limite');
  }
  const reset = headers['x-cupo-reinicio'];
  if (reset !== undefined && !/^\d{4}-\d{2}-01$/u.test(reset)) {
    problems.push('x-cupo-reinicio no es el primer día de un mes (AAAA-MM-01)');
  }
  return problems;
}

/** Lo que falta en la respuesta a un OPTIONS para que un navegador pueda llamar con la llave. */
export function corsProblems(status, headers) {
  const problems = [];
  if (status !== 204 && status !== 200) problems.push(`estado ${status}`);
  if (headers['access-control-allow-origin'] !== '*') problems.push('allow-origin no es *');
  if (!/\bGET\b/u.test(headers['access-control-allow-methods'] ?? '')) problems.push('allow-methods sin GET');
  if (!/\bauthorization\b/iu.test(headers['access-control-allow-headers'] ?? '')) {
    problems.push('allow-headers sin Authorization');
  }
  const exposed = (headers['access-control-expose-headers'] ?? '').toLowerCase();
  for (const name of QUOTA_HEADERS) if (!exposed.includes(name)) problems.push(`no expone ${name}`);
  return problems;
}

/** Lo que no cuadra en la forma `{data, siguiente, fuente, actualizado}` de una página. */
export function pageProblems(body) {
  if (typeof body !== 'object' || body === null) return ['el cuerpo no es un objeto JSON'];
  const problems = [];
  if (!Array.isArray(body.data)) problems.push('data no es una lista');
  if (!(body.siguiente === null || typeof body.siguiente === 'string')) problems.push('siguiente no es texto ni null');
  if (typeof body.fuente !== 'string' || body.fuente === '') problems.push('falta fuente');
  if (!('actualizado' in body) || !(body.actualizado === null || typeof body.actualizado === 'string')) {
    problems.push('actualizado no es texto ni null');
  }
  return problems;
}

/** Lo que no cuadra en una página CSV. */
export function csvProblems(contentType, text) {
  const problems = [];
  if (!/^text\/csv\b/iu.test(contentType ?? '')) problems.push(`content-type ${contentType ?? 'ausente'}`);
  if (!text.startsWith(BOM)) problems.push('sin BOM UTF-8');
  return problems;
}

/** Cuántas filas de datos tiene un CSV de la API (sin la cabecera). */
export function csvRowCount(text) {
  const body = text.startsWith(BOM) ? text.slice(1) : text;
  if (body.trim() === '') return 0;
  // Sin campos con saltos de línea adentro la cuenta es exacta; con ellos, una cota.
  let rows = 0;
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === '"') quoted = !quoted;
    else if (char === '\n' && !quoted) rows += 1;
  }
  return Math.max(0, rows - 1);
}

/**
 * Si `/uso` descontó lo consultado entre dos lecturas: `usadas` sube y
 * `restantes` baja al menos en las consultas hechas entre medio más la segunda
 * lectura (otro cliente con la misma llave puede sumar más, nunca menos).
 */
export function usageProblems(before, after, callsBetween) {
  const problems = [];
  const expected = callsBetween + 1;
  if (!(after.usadas - before.usadas >= expected)) {
    problems.push(`usadas pasó de ${before.usadas} a ${after.usadas}; se esperaba al menos +${expected}`);
  }
  if (!(before.restantes - after.restantes >= Math.min(expected, before.restantes))) {
    problems.push(`restantes pasó de ${before.restantes} a ${after.restantes}`);
  }
  return problems;
}

/** La tabla final, en texto plano de ancho fijo. */
export function renderTable(results) {
  const rows = results.map((result, index) => [String(index + 1), result.verdict, result.name, result.detail ?? '']);
  const head = ['#', 'Resultado', 'Comprobación', 'Detalle'];
  const widths = head.map((title, column) =>
    Math.min(column === 3 ? 90 : 60, Math.max(title.length, ...rows.map((row) => row[column].length))),
  );
  const line = (cells) => cells.map((cell, column) => cell.slice(0, widths[column]).padEnd(widths[column])).join(' | ');
  return [line(head), widths.map((width) => '-'.repeat(width)).join('-+-'), ...rows.map(line)].join('\n');
}

/* ----------------------------------------------------------------- la red */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function headerMap(response) {
  const out = {};
  response.headers.forEach((value, name) => {
    out[name.toLowerCase()] = value;
  });
  return out;
}

class Probe {
  constructor(options) {
    this.options = options;
    this.results = [];
    /** Cada respuesta de la API (no OpenAPI ni OPTIONS), para revisar el cupo en todas. */
    this.apiResponses = [];
    /** Consultas con la llave que llegaron al núcleo (todo lo que no fue 401/429 por ritmo/503). */
    this.counted = 0;
  }

  record(name, verdict, detail = '') {
    this.results.push({ name, verdict, detail: redact(detail, this.options.key) });
  }

  check(name, problems, okDetail = '') {
    this.record(name, problems.length === 0 ? 'PASS' : 'FAIL', problems.length ? problems.join('; ') : okDetail);
    return problems.length === 0;
  }

  async raw(path, { key = this.options.key, method = 'GET', api = true } = {}) {
    const headers = { 'accept-encoding': 'gzip, br' };
    if (key) headers.authorization = `Bearer ${key}`;
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(this.options.base + path, {
        method,
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // Por bytes y no con `response.text()`, que se come la marca BOM que se quiere comprobar.
      const text = method === 'OPTIONS' ? '' : Buffer.from(await response.arrayBuffer()).toString('utf8');
      const result = { path, status: response.status, headers: headerMap(response), text };
      if (text && /json/iu.test(result.headers['content-type'] ?? '')) {
        try {
          result.json = JSON.parse(text);
        } catch {
          result.json = undefined;
        }
      }
      if (api) this.apiResponses.push(result);
      // Un 429 por ritmo se espera y se reintenta una vez: no es lo que se prueba aquí.
      const wait = Number(result.headers['retry-after']);
      const byRate = result.status === 429 && /por minuto/u.test(result.json?.error ?? '');
      if (byRate && attempt === 0 && wait > 0 && wait <= 65) {
        await sleep(wait * 1000);
        continue;
      }
      if (key === this.options.key && key && ![401, 429, 503].includes(result.status)) this.counted += 1;
      return result;
    }
  }

  /** Una ruta en JSON: la primera página y dos más siguiendo `siguiente`. */
  async walkJson(label, path, { maxRows } = {}) {
    const pages = [];
    let next = path;
    for (let hop = 0; hop < 3 && next; hop += 1) {
      const result = await this.raw(next);
      if (result.status !== 200) {
        this.record(`${label} (JSON, página ${hop + 1})`, 'FAIL', `estado ${result.status}: ${result.json?.error ?? result.text.slice(0, 160)}`);
        return pages;
      }
      const problems = pageProblems(result.json);
      if (maxRows !== undefined && Array.isArray(result.json?.data) && result.json.data.length > maxRows) {
        problems.push(`${result.json.data.length} filas con pageSize=${maxRows}`);
      }
      if (hop > 0 && pages.length && JSON.stringify(result.json?.data?.[0]) === JSON.stringify(pages.at(-1)?.data?.[0])) {
        problems.push('la página siguiente repite la anterior');
      }
      pages.push(result.json ?? {});
      this.check(
        `${label} (JSON, página ${hop + 1})`,
        problems,
        `${result.json.data.length} filas; siguiente ${result.json.siguiente ? 'sí' : 'null'}; actualizado ${result.json.actualizado ?? 'null'}`,
      );
      const cursor = result.json?.siguiente;
      next = cursor ? `${path}${path.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(cursor)}` : null;
    }
    if (pages.length === 1 && !pages[0].siguiente) {
      this.record(`${label} (JSON, siguiente)`, 'SKIP', 'una sola página: no hay cursor que seguir');
    }
    return pages;
  }

  /** Una ruta en CSV: la primera página y dos más siguiendo `X-Siguiente`. */
  async walkCsv(label, path) {
    const base = `${path}${path.includes('?') ? '&' : '?'}formato=csv`;
    let next = base;
    for (let hop = 0; hop < 3 && next; hop += 1) {
      const result = await this.raw(next);
      if (result.status !== 200) {
        this.record(`${label} (CSV, página ${hop + 1})`, 'FAIL', `estado ${result.status}`);
        return;
      }
      const cursor = result.headers['x-siguiente'];
      this.check(
        `${label} (CSV, página ${hop + 1})`,
        csvProblems(result.headers['content-type'], result.text),
        `${csvRowCount(result.text)} filas; X-Siguiente ${cursor ? 'sí' : 'no'}`,
      );
      next = cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : null;
    }
  }

  async run() {
    const { options } = this;

    // OpenAPI: público, y nombra todas las rutas.
    const openapi = await this.raw('/api/v1/openapi.json', { key: null, api: false });
    const paths = Object.keys(openapi.json?.paths ?? {});
    this.check(
      'OpenAPI: 200 y todas las rutas',
      [
        ...(openapi.status === 200 ? [] : [`estado ${openapi.status}`]),
        ...ROUTES.filter((route) => !paths.includes(route)).map((route) => `falta ${route}`),
      ],
      `${paths.length} rutas`,
    );

    // CORS en el preflight de cada ruta.
    for (const route of ROUTES) {
      const path = route.replace('{codigo}', 'diario.UFV_BOB');
      const result = await this.raw(path, { key: null, method: 'OPTIONS', api: false });
      this.check(`CORS OPTIONS ${route}`, corsProblems(result.status, result.headers));
    }

    // 401: sin llave, mal escrita y bien escrita pero desconocida.
    const unknownKey = `obs_live_${randomBytes(32).toString('base64url')}`;
    for (const [label, key] of [
      ['sin llave', null],
      ['llave mal escrita', 'obs_live_corta'],
      ['llave desconocida', unknownKey],
    ]) {
      const result = await this.raw('/api/v1/uso', { key });
      this.check(`401 ${label}`, [
        ...(result.status === 401 ? [] : [`estado ${result.status}`]),
        ...(typeof result.json?.error === 'string' ? [] : ['sin campo error']),
        ...(/^Bearer\b/u.test(result.headers['www-authenticate'] ?? '') ? [] : ['sin WWW-Authenticate']),
        ...quotaProblems(result.headers),
      ]);
    }

    if (options.publicOnly) {
      this.record('Rutas con llave', 'SKIP', '--solo-publico');
      return this.finish();
    }

    // El uso antes de recorrer.
    const usoBefore = await this.raw('/api/v1/uso');
    const before = usoBefore.json?.data;
    const usoOk = this.check(
      '/uso responde con el plan',
      [
        ...(usoBefore.status === 200 ? [] : [`estado ${usoBefore.status}: ${usoBefore.json?.error ?? ''}`]),
        ...(before && Number.isInteger(before.usadas) && Number.isInteger(before.restantes) ? [] : ['sin usadas/restantes']),
      ],
      before ? `plan ${before.plan}; usadas ${before.usadas}; restantes ${before.restantes}; por minuto ${before.por_minuto ?? '?'}` : '',
    );
    if (!usoOk) return this.finish();
    const countedAtStart = this.counted;

    // Series: el catálogo, el BCB con pageSize chico, y una serie de cada clase.
    const catalogue = await this.walkJson('/series', '/api/v1/series?pageSize=50');
    await this.walkCsv('/series', '/api/v1/series?pageSize=50');
    const bcb = await this.walkJson('/series?fuente=bcb (pageSize=5)', '/api/v1/series?fuente=bcb&pageSize=5', { maxRows: 5 });
    const codes = catalogue.flatMap((one) => one.data ?? []).map((row) => row.codigo);
    const daily = codes.includes('diario.FX_OFFICIAL_USD_BOB') ? 'diario.FX_OFFICIAL_USD_BOB' : codes.find((code) => code?.startsWith('diario.'));
    const bcbCode = bcb[0]?.data?.[0]?.codigo;
    for (const code of [daily, bcbCode]) {
      if (!code) {
        this.record('/series/{codigo}', 'SKIP', 'el catálogo no trajo un código de esa clase');
        continue;
      }
      const path = `/api/v1/series/${encodeURIComponent(code)}?pageSize=200`;
      await this.walkJson(`/series/${code}`, path);
      await this.walkCsv(`/series/${code}`, path);
    }

    // Los demás conjuntos.
    const city = encodeURIComponent(options.city);
    for (const [label, path] of [
      ['/lugares', `/api/v1/lugares?ciudad=${city}&pageSize=200`],
      ['/prensa', '/api/v1/prensa?pageSize=50'],
      ['/empresas', '/api/v1/empresas?pageSize=200'],
      ['/aduana por año', '/api/v1/aduana?por=year&pageSize=5'],
      ['/aduana por país', '/api/v1/aduana?por=country&pageSize=20'],
    ]) {
      await this.walkJson(label, path);
      await this.walkCsv(label, path);
    }

    // Un 400 con el nombre del parámetro.
    const bad = await this.raw('/api/v1/series?pageSize=0');
    this.check('400 con parametro (pageSize=0)', [
      ...(bad.status === 400 ? [] : [`estado ${bad.status}`]),
      ...(bad.json?.parametro === 'pageSize' ? [] : ['parametro no es «pageSize»']),
      ...quotaProblems(bad.headers),
    ]);

    // El tope de lugares del plan.
    const cap = before.lugares_por_consulta;
    if (cap === null || cap === undefined) {
      this.record('Tope de lugares del plan', 'SKIP', cap === null ? 'el plan no tiene tope' : '/uso no dice el tope');
    } else {
      const result = await this.raw(`/api/v1/lugares?ciudad=${city}&pageSize=${Math.min(cap, 5000)}`);
      const rows = result.json?.data?.length ?? 0;
      const header = result.headers['x-tope-lugares'];
      const problems = result.status === 200 ? [] : [`estado ${result.status}`];
      if (header !== undefined && Number(header) !== cap) problems.push(`X-Tope-Lugares ${header}, el plan dice ${cap}`);
      if (rows === cap && result.json?.siguiente !== null) problems.push('siguiente no es null al llegar al tope');
      if (rows > cap) problems.push(`${rows} lugares pasan del tope ${cap}`);
      this.check(
        'Tope de lugares del plan',
        problems,
        header !== undefined ? `${rows} lugares, recortados al tope ${cap}` : `${rows} lugares; la ciudad no llega al tope ${cap}`,
      );
    }

    // `/uso` tiene que haber descontado lo recorrido.
    const between = this.counted - countedAtStart;
    const usoAfter = await this.raw('/api/v1/uso');
    const after = usoAfter.json?.data;
    this.check(
      '/uso descuenta lo consultado',
      usoAfter.status === 200 && after ? usageProblems(before, after, between) : [`estado ${usoAfter.status}`],
      after ? `usadas ${before.usadas} → ${after.usadas} (${between} consultas entre medio + esta)` : '',
    );

    if (options.burst) await this.burst(before.por_minuto);
    return this.finish();
  }

  /** Pasa el ritmo por minuto del plan y espera un 429 con `Retry-After` y cupo. */
  async burst(perMinute) {
    if (!Number.isInteger(perMinute) || perMinute <= 0) {
      this.record('Ritmo por minuto (--rafaga)', 'SKIP', '/uso no dice el ritmo del plan');
      return;
    }
    const total = perMinute + 5;
    const statuses = [];
    let throttled = null;
    for (let sent = 0; sent < total; sent += 25) {
      const batch = Array.from({ length: Math.min(25, total - sent) }, () =>
        fetch(`${this.options.base}/api/v1/uso`, {
          headers: { authorization: `Bearer ${this.options.key}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }).then(async (response) => ({ status: response.status, headers: headerMap(response), json: await response.json().catch(() => ({})) })),
      );
      for (const result of await Promise.all(batch)) {
        statuses.push(result.status);
        if (result.status === 429 && !throttled) throttled = result;
      }
    }
    const problems = [];
    if (!throttled) problems.push(`ningún 429 en ${total} consultas`);
    else {
      if (!/por minuto/u.test(throttled.json?.error ?? '')) problems.push('el 429 no es el del ritmo');
      if (!(Number(throttled.headers['retry-after']) >= 1)) problems.push('sin Retry-After');
      problems.push(...quotaProblems(throttled.headers));
    }
    this.check(
      'Ritmo por minuto (--rafaga)',
      problems,
      `${statuses.filter((status) => status === 200).length} × 200, ${statuses.filter((status) => status === 429).length} × 429 con ${perMinute} por minuto`,
    );
  }

  finish() {
    const missing = this.apiResponses.filter((result) => quotaProblems(result.headers).length > 0);
    this.check(
      `Encabezados de cupo en todas las respuestas de la API (${this.apiResponses.length})`,
      missing.slice(0, 5).map((result) => `${result.path.split('?')[0]} ${result.status}: ${quotaProblems(result.headers).join(', ')}`),
    );
    return this.results;
  }
}

/* --------------------------------------------------------------- principal */

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2), process.env);
  } catch (error) {
    console.error(`probar-api-v1: ${redact(error.message, null)}`);
    console.error('Uso: node scripts/probar-api-v1.mjs --base https://test.datosbolivia.com --llave obs_live_…');
    process.exit(2);
  }
  console.log(`Probando ${options.base}/api/v1${options.publicOnly ? ' (solo lo público)' : ''}…\n`);
  const probe = new Probe(options);
  let results;
  try {
    results = await probe.run();
  } catch (error) {
    probe.record('El recorrido terminó', 'FAIL', `se cortó: ${error?.message ?? error}`);
    results = probe.finish();
  }
  console.log(redact(renderTable(results), options.key));
  const failed = results.filter((result) => result.verdict === 'FAIL').length;
  const passed = results.filter((result) => result.verdict === 'PASS').length;
  const skipped = results.filter((result) => result.verdict === 'SKIP').length;
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}: ${passed} bien, ${failed} mal, ${skipped} sin correr.`);
  process.exit(failed === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

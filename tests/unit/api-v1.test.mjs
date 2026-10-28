/*
 * El contrato de /api/v1: llaves, cupo, cursor, CSV y parámetros.
 *
 * Correr con: node --test tests/unit/api-v1.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readFileSync } from 'node:fs';

import {
  API_KEY_PATTERN,
  BCB_NOT_AN_INDICATOR,
  DAILY_SERIES_NAMES,
  DEFAULT_BURST_PER_MINUTE,
  DEFAULT_PAGE_SIZE,
  FAILED_KEYS_PER_WINDOW,
  FAILED_KEYS_WINDOW_MS,
  FailureLedger,
  MAX_PAGE_SIZE,
  PLAN_MEMORY_MS,
  PlanMemory,
  bcbCatalogueWhere,
  breakTies,
  burstPerMinute,
  csvFileName,
  dailySeriesLabel,
  decideAccess,
  decodeCursor,
  encodeCursor,
  latestOf,
  missingParam,
  nextQuotaReset,
  paginate,
  paramError,
  parseBearer,
  parseCursorParam,
  parseDateParam,
  parseFormat,
  parseList,
  parseListParam,
  parseMonthRange,
  parsePageSize,
  parseSeriesCode,
  parseTextParam,
  parseYearParam,
  quotaHeaders,
  readBearer,
  secondsToReset,
  toCsv,
  toIsoInstant,
  usageLogLine,
  withinRange,
} from '../../src/lib/api-v1/contrato.ts';
import { PLANS } from '../../src/lib/plans.ts';
import { STABLECOIN_MARKET_SURVEY } from '../../src/lib/stablecoin-market-survey.ts';
import {
  ROUTES,
  corsProblems,
  csvProblems,
  csvRowCount,
  pageProblems,
  parseArgs,
  quotaProblems,
  redact,
  renderTable,
  usageProblems,
} from '../../scripts/probar-api-v1.mjs';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const KEY = `obs_live_${'A'.repeat(40)}b-_`;
const account = (over = {}) => ({
  subscriberAccountId: '7f0c2a1e-1111-2222-3333-444455556666',
  email: 'x@y.bo',
  planCode: 'analista',
  effectiveStatus: 'ACTIVE',
  entitled: true,
  paidUntil: '2026-11-30',
  ...over,
});

test('la llave: 43 caracteres base64url detrás de obs_live_', () => {
  assert.equal(KEY.length, 'obs_live_'.length + 43);
  assert.ok(API_KEY_PATTERN.test(KEY));
  assert.equal(parseBearer(`Bearer ${KEY}`), KEY);
  assert.equal(parseBearer(`bearer   ${KEY}  `), KEY);
  assert.equal(parseBearer(null), null);
  assert.equal(parseBearer(''), null);
  assert.equal(parseBearer(KEY), null, 'sin «Bearer»');
  assert.equal(parseBearer(`Bearer ${KEY}x`), null, 'un carácter de más');
  assert.equal(parseBearer(`Bearer obs_test_${'A'.repeat(43)}`), null);
  assert.equal(parseBearer(`Bearer obs_live_${'A'.repeat(42)}=`), null);
});

test('el cupo se reinicia el primer día del mes siguiente, en UTC', () => {
  const now = new Date('2026-10-27T18:30:00Z');
  assert.equal(nextQuotaReset(now).toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(nextQuotaReset(new Date('2026-12-31T23:59:59Z')).toISOString(), '2027-01-01T00:00:00.000Z');
  assert.equal(secondsToReset(new Date('2026-10-31T23:59:30Z')), 30);
  assert.equal(secondsToReset(new Date('2026-10-31T23:59:59.900Z')), 1);
});

test('los encabezados de cupo nunca bajan de cero', () => {
  const now = new Date('2026-10-27T00:00:00Z');
  assert.deepEqual(quotaHeaders(10_000, 25, now), {
    'X-Cupo-Limite': '10000',
    'X-Cupo-Restante': '9975',
    'X-Cupo-Reinicio': '2026-11-01',
  });
  assert.equal(quotaHeaders(10_000, 10_005, now)['X-Cupo-Restante'], '0');
});

test('decideAccess: 404 es 401, sin plan 402, cupo pasado 429, núcleo caído 503', () => {
  const now = new Date('2026-10-27T00:00:00Z');
  assert.deepEqual(decideAccess({ status: 200, account: account(), used: 10 }, 10_000, now), { ok: true });
  assert.deepEqual(decideAccess({ status: 200, account: account(), used: 10_000 }, 10_000, now), { ok: true });

  const unknown = decideAccess({ status: 404 }, null, now);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.status, 401);
  assert.match(unknown.error, /Llave inválida o revocada/u);

  const lapsed = decideAccess({ status: 200, account: account({ entitled: false }), used: 0 }, 10_000, now);
  assert.equal(lapsed.status, 402);

  const free = decideAccess({ status: 200, account: account({ planCode: 'gratis' }), used: 1 }, 0, now);
  assert.equal(free.status, 402);

  const over = decideAccess({ status: 200, account: account(), used: 10_001 }, 10_000, now);
  assert.equal(over.status, 429);
  assert.equal(over.retryAfter, secondsToReset(now));

  assert.equal(decideAccess({ status: 503 }, null, now).status, 503);
  assert.equal(decideAccess({ status: 500 }, null, now).status, 503);
  assert.equal(decideAccess({ status: 403 }, null, now).status, 503);
});

test('el cursor va y vuelve, y uno ajeno no se acepta', () => {
  const raw = encodeCursor({ o: 2000 });
  assert.match(raw, /^[A-Za-z0-9_-]+$/u);
  assert.deepEqual(decodeCursor(raw), { o: 2000 });
  assert.equal(decodeCursor('no es base64!'), null);
  assert.equal(decodeCursor(Buffer.from('{"o":-1}').toString('base64url')), null);
  assert.equal(decodeCursor(Buffer.from('{"o":1.5}').toString('base64url')), null);
  assert.equal(decodeCursor(Buffer.from('[1]').toString('base64url')), null);
  assert.equal(decodeCursor(Buffer.from('basura').toString('base64url')), null);
  assert.deepEqual(parseCursorParam(null), { ok: true, value: 0 });
  assert.deepEqual(parseCursorParam(raw), { ok: true, value: 2000 });
  assert.equal(parseCursorParam('%%').ok, false);
});

test('paginate da el cursor de la siguiente página y null en la última', () => {
  const rows = Array.from({ length: 5 }, (_, i) => i);
  const first = paginate(rows, 0, 2);
  assert.deepEqual(first.data, [0, 1]);
  assert.deepEqual(decodeCursor(first.siguiente), { o: 2 });
  const last = paginate(rows, 4, 2);
  assert.deepEqual(last.data, [4]);
  assert.equal(last.siguiente, null);
  assert.deepEqual(paginate(rows, 10, 2), { data: [], siguiente: null, capped: false });
});

test('el CSV lleva BOM, comillas donde hacen falta y la unión de columnas', () => {
  const csv = toCsv([
    { ciudad: 'La Paz', nombre: 'Café "El Ñuflo", centro', valor: 1.5 },
    { ciudad: 'El Alto', nombre: 'Línea\nnueva', valor: null, extra: true },
  ]);
  assert.ok(csv.startsWith('﻿'));
  assert.equal(
    csv,
    '﻿ciudad,nombre,valor,extra\r\nLa Paz,"Café ""El Ñuflo"", centro",1.5,\r\nEl Alto,"Línea\nnueva",,true\r\n',
  );
  assert.equal(toCsv([]), '﻿');
});

test('pageSize: 1000 por omisión, de 1 a 5000', () => {
  assert.deepEqual(parsePageSize(null), { ok: true, value: DEFAULT_PAGE_SIZE });
  assert.deepEqual(parsePageSize('5000'), { ok: true, value: MAX_PAGE_SIZE });
  assert.equal(parsePageSize('5001').ok, false);
  assert.equal(parsePageSize('0').ok, false);
  assert.equal(parsePageSize('-3').ok, false);
  assert.equal(parsePageSize('10.5').ok, false);
  assert.deepEqual(parsePageSize('0'), {
    ok: false,
    param: 'pageSize',
    error: 'El parámetro «pageSize» no es válido: es un número entero de 1 a 5000.',
  });
});

test('formato, fechas y listas', () => {
  assert.deepEqual(parseFormat(null), { ok: true, value: 'json' });
  assert.deepEqual(parseFormat('csv'), { ok: true, value: 'csv' });
  assert.equal(parseFormat('xlsx').ok, false);
  assert.deepEqual(parseDateParam('desde', '2024'), { ok: true, value: '2024' });
  assert.deepEqual(parseDateParam('desde', '2024-07-15'), { ok: true, value: '2024-07-15' });
  assert.deepEqual(parseDateParam('desde', ''), { ok: true, value: undefined });
  assert.equal(parseDateParam('desde', '2024-13').ok, false);
  assert.equal(parseDateParam('desde', '2024 drop').ok, false);
  assert.deepEqual(parseList(' La Paz, El Alto,,La Paz ', 12), ['La Paz', 'El Alto']);
  assert.deepEqual(parseList(null, 12), []);
  assert.equal(parseList('a,b,c,d', 2).length, 2);
});

test('withinRange compara con la precisión del límite', () => {
  assert.ok(withinRange('2024-12-31', undefined, '2024'));
  assert.ok(!withinRange('2025-01-01', undefined, '2024'));
  assert.ok(withinRange('2023', '2023-06'));
  assert.ok(!withinRange('2022', '2023-06'));
  assert.ok(withinRange('2024-07-15', '2024-07', '2024-07'));
});

test('el código de una serie se corta por el primer punto', () => {
  assert.deepEqual(parseSeriesCode('panel.NY.GDP.MKTP.CD'), { fuente: 'panel', clave: 'NY.GDP.MKTP.CD' });
  assert.deepEqual(parseSeriesCode('diario.FX_PARALLEL_USD_BOB:BUY'), {
    fuente: 'diario',
    clave: 'FX_PARALLEL_USD_BOB:BUY',
  });
  assert.equal(parseSeriesCode('otra.X'), null);
  assert.equal(parseSeriesCode('macro.'), null);
  assert.equal(parseSeriesCode('macro'), null);
});

test('la línea de uso no lleva la llave y recorta la cuenta', () => {
  const line = usageLogLine('lugares', '7f0c2a1e-1111-2222', 1000);
  assert.deepEqual(JSON.parse(line), { evento: 'api_v1', ruta: 'lugares', cuenta: '7f0c2a1e', filas: 1000 });
  assert.ok(!line.includes('obs_live_'));
});

/* ------------------------------------------------- freno por minuto por plan */

test('el freno por minuto es el del plan; sin plan conocido, 60', () => {
  const byCode = Object.fromEntries(PLANS.map((plan) => [plan.code, plan.apiPorMinuto]));
  assert.equal(burstPerMinute('analista', PLANS), byCode.analista);
  assert.equal(burstPerMinute('profesional', PLANS), byCode.profesional);
  assert.equal(burstPerMinute('institucional', PLANS), byCode.institucional);
  assert.deepEqual(
    [burstPerMinute('analista', PLANS), burstPerMinute('profesional', PLANS), burstPerMinute('institucional', PLANS)],
    [60, 300, 1000],
  );
  assert.equal(DEFAULT_BURST_PER_MINUTE, 60);
  assert.equal(burstPerMinute(undefined, PLANS), 60, 'llave sin verificar');
  assert.equal(burstPerMinute('desconocido', PLANS), 60);
  // Un plan sin API no cierra la puerta por ritmo: el núcleo tiene que poder decir 402.
  assert.equal(burstPerMinute('gratis', PLANS), 60);
});

test('el plan de una llave se recuerda un minuto y se renueva con cada verificación', () => {
  const memory = new PlanMemory();
  assert.equal(PLAN_MEMORY_MS, 60_000);
  assert.equal(memory.recall('h1', 0), undefined);
  memory.remember('h1', { planCode: 'profesional', used: 7 }, 1_000);
  assert.deepEqual(memory.recall('h1', 1_000 + 59_999), { planCode: 'profesional', used: 7 });
  assert.equal(memory.recall('h1', 1_000 + 60_000), undefined, 'a los 60 s se olvida');
  assert.equal(memory.size, 0, 'lo vencido se borra al leerlo');

  memory.remember('h2', { planCode: 'analista', used: 1 }, 0);
  memory.remember('h2', { planCode: 'analista', used: 2 }, 50_000);
  assert.deepEqual(memory.recall('h2', 100_000), { planCode: 'analista', used: 2 });
});

test('la memoria de planes no crece sin fin', () => {
  const memory = new PlanMemory(60_000, 3);
  memory.remember('viejo', { planCode: 'analista', used: 0 }, 0);
  for (const [i, hash] of ['a', 'b', 'c'].entries()) {
    memory.remember(hash, { planCode: 'analista', used: i }, 70_000);
  }
  assert.equal(memory.size, 3, 'lo vencido se fue al pasar el máximo');
  assert.equal(memory.recall('viejo', 70_000), undefined);
  memory.remember('d', { planCode: 'analista', used: 9 }, 70_001);
  assert.equal(memory.size, 3, 'con todo vigente, se va el más viejo');
  assert.equal(memory.recall('a', 70_001), undefined);
  assert.deepEqual(memory.recall('d', 70_001), { planCode: 'analista', used: 9 });
});

/* ---------------------------------------------- llaves rechazadas por dirección */

test('veinte llaves rechazadas por dirección en diez minutos; la 21 es 429 sin núcleo', () => {
  assert.equal(FAILED_KEYS_PER_WINDOW, 20);
  assert.equal(FAILED_KEYS_WINDOW_MS, 600_000);
  const ledger = new FailureLedger();
  for (let i = 0; i < 20; i += 1) {
    const admission = ledger.admit('1.2.3.4', 1_000 + i);
    assert.equal(admission.ok, true, `intento ${i + 1}`);
    admission.ticket.confirm();
  }
  const refused = ledger.admit('1.2.3.4', 2_000);
  assert.equal(refused.ok, false);
  // El primer rechazo fue en t=1000: se libera a los 600 s de él.
  assert.equal(refused.retryAfter, Math.ceil((600_000 - 1_000) / 1000));
  assert.equal(ledger.count('1.2.3.4', 2_000), 20, 'un pedido rechazado no cuenta');
  assert.equal(ledger.admit('5.6.7.8', 2_000).ok, true, 'otra dirección no se ve afectada');
  assert.equal(ledger.admit('1.2.3.4', 1_000 + 600_000).ok, true, 'pasada la ventana, vuelve a admitir');
});

test('la reserva se toma antes de esperar y se libera si la llave era buena', () => {
  const ledger = new FailureLedger(3, 60_000);
  const tickets = [0, 1, 2].map(() => ledger.admit('ip', 0));
  assert.ok(tickets.every((one) => one.ok));
  // Tres pedidos simultáneos aún sin respuesta ocupan los tres lugares.
  const fourth = ledger.admit('ip', 10);
  assert.deepEqual(fourth, { ok: false, retryAfter: 1 }, 'cerrada por reservas: se reintenta en un segundo');
  tickets[0].ticket.release();
  tickets[1].ticket.release();
  tickets[1].ticket.confirm();
  assert.equal(ledger.count('ip', 20), 1, 'liberar dos veces o confirmar después no cambia nada');
  tickets[2].ticket.confirm();
  assert.equal(ledger.admit('ip', 30).ok, true);
});

test('la cuenta de fallos no crece sin fin', () => {
  const ledger = new FailureLedger(20, 1_000, 2);
  ledger.admit('a', 0).ticket.confirm();
  ledger.admit('b', 0).ticket.confirm();
  ledger.admit('c', 5_000).ticket.confirm();
  assert.equal(ledger.addresses, 1, 'lo vencido se descarta al pasar el máximo');
});

test('con todas las direcciones vivas, el registro igual respeta su tope', () => {
  const ledger = new FailureLedger(20, 60_000, 10);
  for (let i = 0; i < 50; i += 1) ledger.admit(`ip-${i}`, i).ticket.confirm();
  assert.ok(ledger.addresses <= 10, `quedaron ${ledger.addresses}`);
  // La dirección que acaba de pedir no se descarta en el mismo paso.
  const ultima = ledger.admit('ip-49', 100);
  assert.equal(ultima.ok, true);
});

/* --------------------------------------------------------- cupo y encabezados */

test('X-Cupo-Restante descuenta la consulta actual y nunca baja de cero', () => {
  const now = new Date('2026-10-27T18:30:00Z');
  // `used` ya cuenta la consulta que se contesta: la última del mes deja cero.
  assert.equal(quotaHeaders(10_000, 1, now)['X-Cupo-Restante'], '9999');
  assert.equal(quotaHeaders(10_000, 10_000, now)['X-Cupo-Restante'], '0');
  assert.equal(quotaHeaders(10_000, -5, now)['X-Cupo-Restante'], '10000');
  assert.deepEqual(quotaHeaders(0, 0, now), {
    'X-Cupo-Limite': '0',
    'X-Cupo-Restante': '0',
    'X-Cupo-Reinicio': '2026-11-01',
  });
  assert.equal(quotaHeaders(-1, 0, now)['X-Cupo-Limite'], '0');
  assert.equal(quotaHeaders(1, 0, new Date('2026-12-15T00:00:00Z'))['X-Cupo-Reinicio'], '2027-01-01');
});

test('readBearer distingue la llave que falta de la mal escrita', () => {
  assert.deepEqual(readBearer(null), { kind: 'missing' });
  assert.deepEqual(readBearer('   '), { kind: 'missing' });
  assert.deepEqual(readBearer('Bearer obs_live_corta'), { kind: 'malformed' });
  assert.deepEqual(readBearer('Basic dXNlcjpwYXNz'), { kind: 'malformed' });
  assert.deepEqual(readBearer(`Bearer ${KEY}`), { kind: 'key', key: KEY });
});

/* ------------------------------------------------------- tope de lugares */

test('paginate con tope: la página que llega al tope trae siguiente en null', () => {
  const rows = Array.from({ length: 12 }, (_, i) => i);
  const first = paginate(rows, 0, 4, 10);
  assert.deepEqual(first.data, [0, 1, 2, 3]);
  assert.deepEqual(decodeCursor(first.siguiente), { o: 4 });
  assert.equal(first.capped, true);
  const last = paginate(rows, 8, 4, 10);
  assert.deepEqual(last.data, [8, 9], 'no pasa del tope aunque haya filas');
  assert.equal(last.siguiente, null);
  assert.equal(last.capped, true);
  const exact = paginate(rows, 0, 10, 10);
  assert.equal(exact.data.length, 10);
  assert.equal(exact.siguiente, null, 'una página del tamaño del tope es la última');
  assert.deepEqual(paginate(rows, 10, 4, 10), { data: [], siguiente: null, capped: true });
  assert.deepEqual(paginate(rows, 50, 4, 10), { data: [], siguiente: null, capped: true });
  // Sin tope, o con un tope que no se alcanza, nada cambia.
  assert.deepEqual(paginate(rows, 8, 4, null), { data: [8, 9, 10, 11], siguiente: null, capped: false });
  assert.deepEqual(paginate(rows, 8, 4, 5_000), { data: [8, 9, 10, 11], siguiente: null, capped: false });
  assert.equal(paginate(rows, 0, 12, 12).capped, false, 'exactamente el tope no recorta');
});

test('el tope de lugares de cada plan, recorrido entero por cursor', () => {
  const places = Array.from({ length: 12_345 }, (_, i) => i);
  for (const plan of PLANS.filter((one) => one.apiPorMes > 0)) {
    let offset = 0;
    let served = 0;
    let pages = 0;
    for (;;) {
      const page = paginate(places, offset, 1_000, plan.lugaresPorDescarga);
      served += page.data.length;
      pages += 1;
      if (!page.siguiente) break;
      offset = decodeCursor(page.siguiente).o;
    }
    assert.equal(served, plan.lugaresPorDescarga ?? places.length, plan.code);
    assert.equal(pages, Math.ceil((plan.lugaresPorDescarga ?? places.length) / 1_000));
  }
});

test('breakTies ordena solo los empates, por identificador', () => {
  const rows = [
    { k: 'a', id: '3' },
    { k: 'a', id: '1' },
    { k: 'b', id: '0' },
    { k: 'a', id: '2' },
  ];
  const out = breakTies(rows, (l, r) => l.k === r.k, (row) => row.id);
  assert.deepEqual(out.map((row) => `${row.k}${row.id}`), ['a1', 'a3', 'b0', 'a2']);
  assert.deepEqual(breakTies([], () => true, String), []);
});

/* ------------------------------------------------------------- parámetros */

test('todos los 400 dicen el parámetro y lo que se espera, con la misma forma', () => {
  assert.equal(paramError('formato', 'es «json» o «csv»'), 'El parámetro «formato» no es válido: es «json» o «csv».');
  assert.equal(missingParam('ciudad', 'una o varias'), 'Falta el parámetro «ciudad»: una o varias.');
  const failures = [
    parseFormat('xlsx'),
    parsePageSize('abc'),
    parseCursorParam('%%'),
    parseDateParam('desde', '2024-13'),
    parseYearParam('hasta', '20', 1990, 2100),
    parseMonthRange('meses', '7-1'),
    parseTextParam('buscar', 'x'.repeat(121)),
    parseListParam('ciudad', 'a,b,c', { limit: 2 }),
  ];
  const params = failures.map((one) => one.param);
  assert.deepEqual(params, ['formato', 'pageSize', 'cursor', 'desde', 'hasta', 'meses', 'buscar', 'ciudad']);
  for (const one of failures) {
    assert.equal(one.ok, false);
    assert.match(one.error, /^El parámetro «[a-zA-Z]+» no es válido: .+\.$/u);
  }
});

test('parseListParam no recorta en silencio', () => {
  assert.deepEqual(parseListParam('ciudad', ' La Paz, El Alto,,La Paz ', { limit: 12 }), {
    ok: true,
    value: ['La Paz', 'El Alto'],
  });
  assert.deepEqual(parseListParam('ciudad', null, { limit: 12 }), { ok: true, value: [] });
  const thirteen = Array.from({ length: 13 }, (_, i) => `c${i}`).join(',');
  assert.equal(parseListParam('ciudad', thirteen, { limit: 12 }).ok, false);
  assert.equal(parseListParam('ciudad', 'x'.repeat(61), { limit: 12, maxLength: 60 }).ok, false);
  const wrong = parseListParam('anio', '2024,20x5', { limit: 50, pattern: /^\d{4}$/u, what: 'un año' });
  assert.equal(wrong.ok, false);
  assert.match(wrong.error, /«20x5» no es un año/u);
});

test('años, tramos de meses y textos', () => {
  assert.deepEqual(parseYearParam('desde', '2020', 1990, 2100), { ok: true, value: 2020 });
  assert.deepEqual(parseYearParam('desde', '', 1990, 2100), { ok: true, value: undefined });
  assert.equal(parseYearParam('desde', '1989', 1990, 2100).ok, false);
  assert.equal(parseYearParam('desde', '2020.5', 1990, 2100).ok, false);
  assert.deepEqual(parseMonthRange('meses', '01-07'), { ok: true, value: '1-7' });
  assert.deepEqual(parseMonthRange('meses', null), { ok: true, value: undefined });
  assert.equal(parseMonthRange('meses', '0-7').ok, false);
  assert.equal(parseMonthRange('meses', '1-13').ok, false);
  assert.deepEqual(parseTextParam('buscar', '  oro  '), { ok: true, value: 'oro' });
  assert.deepEqual(parseTextParam('buscar', null), { ok: true, value: '' });
});

/* ------------------------------------------------------------- actualizado */

test('toIsoInstant pasa el texto de Postgres a ISO y deja fechas y periodos', () => {
  assert.equal(toIsoInstant('2026-09-01 12:00:00+00'), '2026-09-01T12:00:00.000Z');
  assert.equal(toIsoInstant('2026-09-01 08:00:00.5-04'), '2026-09-01T12:00:00.500Z');
  assert.equal(toIsoInstant('2026-09-01'), '2026-09-01');
  assert.equal(toIsoInstant('2026-08'), '2026-08');
  assert.equal(toIsoInstant('2025'), '2025');
  assert.equal(toIsoInstant(null), null);
  assert.equal(toIsoInstant(' '), null);
  assert.equal(toIsoInstant('no es fecha'), 'no es fecha');
});

test('latestOf elige el más reciente entre instantes, fechas y periodos', () => {
  assert.equal(latestOf(['2024', '2025', null, undefined]), '2025');
  assert.equal(latestOf(['2026-10-27T12:00:00.000Z', '2026', '2025-12']), '2026-10-27T12:00:00.000Z');
  assert.equal(latestOf([]), null);
  assert.equal(latestOf([null]), null);
});

/* ------------------------------------------------------------------ series */

test('el nombre de cada serie diaria: el del sitio, el lado en castellano, la ficha', () => {
  const registry = new Map([
    ['NEW_DAILY', { name: 'Serie nueva', unit: 'X', publishers: ['UNO', 'DOS'] }],
    ['FX_PARALLEL_USDT_BOB', { name: null, unit: 'BOB/USD', publishers: ['BINANCE P2P', 'CRIPTOYA'] }],
  ]);
  const label = (key) => dailySeriesLabel(key, registry, STABLECOIN_MARKET_SURVEY);
  assert.deepEqual(label('FX_OFFICIAL_USD_BOB'), {
    nombre: 'Tipo de cambio oficial',
    unidad: 'BOB/USD',
    editor: 'Banco Central de Bolivia',
    rubro: 'TIPO_DE_CAMBIO',
  });
  assert.equal(label('FX_OFFICIAL_USD_BOB:OFFICIAL').nombre, 'Tipo de cambio oficial, tasa publicada');
  assert.equal(label('FX_PARALLEL_USD_BOB:SELL').nombre, 'Dólar paralelo, venta');
  assert.equal(label('FX_PARALLEL_USD_BOB:BUY').editor, 'DatosBolivia.com, a partir de cotizaciones publicadas');
  assert.equal(label('FX_PARALLEL_USDT_BOB:BUY').nombre, 'Dólar paralelo en USDT, compra');
  assert.equal(label('FX_PARALLEL_USDE_BOB:SELL').nombre, 'Dólar paralelo en USDe, venta');
  assert.equal(label('FX_PARALLEL_FDUSD_BOB:SELL').unidad, 'BOB/USD');
  assert.equal(label('UFV_BOB').nombre, 'Unidad de Fomento de Vivienda');
  assert.equal(label('GOLD_USD_OZT').nombre, 'Oro, cotización oficial del BCB');
  assert.equal(label('BTC_USD').rubro, 'MERCADOS');
  assert.deepEqual(label('NEW_DAILY'), { nombre: 'Serie nueva', unidad: 'X', editor: 'UNO; DOS', rubro: 'MERCADOS' });
  assert.deepEqual(label('NADA'), { nombre: 'NADA', unidad: null, editor: 'DatosBolivia.com', rubro: 'MERCADOS' });
});

test('los nombres diarios son los mismos de la página de Fuentes', () => {
  const text = source('src/components/sources-explorer.tsx');
  const block = /const NAMES: Record<string, string> = \{([\s\S]*?)\};/u.exec(text)?.[1];
  assert.ok(block, 'sources-explorer.tsx ya no tiene NAMES: actualizar DAILY_SERIES_NAMES y esta prueba');
  const names = Object.fromEntries(
    [...block.matchAll(/^\s*([A-Z0-9_]+): '([^']*)',?\r?$/gmu)].map((match) => [match[1], match[2]]),
  );
  assert.deepEqual(DAILY_SERIES_NAMES, names);
});

test('el catálogo del BCB filtra los nombres como el tablero', () => {
  assert.ok(
    source('src/lib/bcb.ts').includes(BCB_NOT_AN_INDICATOR.replace(/\\/gu, '\\\\')),
    'la condición de lib/bcb.ts cambió: copiarla a BCB_NOT_AN_INDICATOR',
  );
  assert.deepEqual(bcbCatalogueWhere({ family: '', text: '' }), {
    where: `WHERE ${BCB_NOT_AN_INDICATOR}`,
    values: [],
  });
  const filtered = bcbCatalogueWhere({ family: 'sector-externo', text: ' reservas  100%_oro ' });
  assert.deepEqual(filtered.values, ['sector-externo', '%reservas%', '%100\\%\\_oro%']);
  assert.match(filtered.where, /family = \$1 AND \(name ILIKE \$2 OR sheet ILIKE \$2 OR workbook ILIKE \$2\)/u);
  assert.equal(bcbCatalogueWhere({ family: '', text: 'a b c d e f g' }).values.length, 5);
});

test('el nombre del CSV no lleva lo que escribió quien llama', () => {
  assert.equal(csvFileName('lugares'), 'datosbolivia-lugares.csv');
  assert.equal(
    csvFileName('series/diario.FX_PARALLEL_USD_BOB:SELL'),
    'datosbolivia-series-diario-fx-parallel-usd-bob-sell.csv',
  );
  assert.equal(csvFileName('series/"; rm -rf'), 'datosbolivia-series-rm-rf.csv');
  assert.ok(csvFileName(`series/${'x'.repeat(500)}`).length <= 'datosbolivia-.csv'.length + 80);
  assert.equal(csvFileName('***'), 'datosbolivia-datos.csv');
});

/* ------------------------------------------------- scripts/probar-api-v1.mjs */

test('el script de prueba lee sus argumentos y exige una llave bien escrita', () => {
  const ok = parseArgs(['--base', 'https://test.datosbolivia.com/', '--llave', KEY]);
  assert.equal(ok.base, 'https://test.datosbolivia.com');
  assert.equal(ok.key, KEY);
  assert.equal(ok.city, 'La Paz');
  assert.equal(parseArgs(['--solo-publico']).publicOnly, true);
  assert.equal(parseArgs([], { API_V1_LLAVE: KEY }).key, KEY);
  assert.throws(() => parseArgs([]), /falta --llave/u);
  assert.throws(() => parseArgs(['--llave', 'obs_live_corta']), /forma/u);
  assert.throws(() => parseArgs(['--base', 'ftp://x', '--llave', KEY]), /URL/u);
  assert.throws(() => parseArgs(['--llave']), /necesita un valor/u);
  assert.throws(() => parseArgs(['--otra']), /desconocida/u);
});

test('el script nunca imprime la llave', () => {
  const other = `obs_live_${'Z'.repeat(43)}`;
  const out = redact(`Bearer ${KEY} y ${other}`, KEY);
  assert.ok(!out.includes(KEY));
  assert.ok(!out.includes(other));
  assert.equal(out, 'Bearer obs_live_[oculta] y obs_live_[oculta]');
});

test('el script revisa cupo, CORS, páginas, CSV y el descuento de /uso', () => {
  assert.equal(ROUTES.length, 7);
  const quota = { 'x-cupo-limite': '10000', 'x-cupo-restante': '9000', 'x-cupo-reinicio': '2026-11-01' };
  assert.deepEqual(quotaProblems(quota), []);
  assert.deepEqual(quotaProblems({}), ['falta x-cupo-limite', 'falta x-cupo-restante', 'falta x-cupo-reinicio']);
  assert.ok(quotaProblems({ ...quota, 'x-cupo-restante': '10001' }).includes('x-cupo-restante pasa de x-cupo-limite'));
  assert.equal(quotaProblems({ ...quota, 'x-cupo-reinicio': '2026-11-15' }).length, 1);

  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Authorization',
    'access-control-expose-headers': 'X-Cupo-Limite, X-Cupo-Restante, X-Cupo-Reinicio, Retry-After',
  };
  assert.deepEqual(corsProblems(204, cors), []);
  assert.deepEqual(corsProblems(405, { ...cors, 'access-control-allow-headers': 'Content-Type' }), [
    'estado 405',
    'allow-headers sin Authorization',
  ]);

  assert.deepEqual(pageProblems({ data: [], siguiente: null, fuente: 'x', actualizado: null }), []);
  assert.deepEqual(pageProblems({ data: {}, siguiente: 3, fuente: '' }), [
    'data no es una lista',
    'siguiente no es texto ni null',
    'falta fuente',
    'actualizado no es texto ni null',
  ]);

  const csv = toCsv([
    { a: 'x\ny', b: 1 },
    { a: 'z', b: 2 },
  ]);
  assert.deepEqual(csvProblems('text/csv; charset=utf-8', csv), []);
  assert.deepEqual(csvProblems('application/json', 'a,b'), ['content-type application/json', 'sin BOM UTF-8']);
  assert.equal(csvRowCount(csv), 2);
  assert.equal(csvRowCount('﻿'), 0);

  assert.deepEqual(usageProblems({ usadas: 10, restantes: 90 }, { usadas: 16, restantes: 84 }, 5), []);
  assert.equal(usageProblems({ usadas: 10, restantes: 90 }, { usadas: 10, restantes: 90 }, 5).length, 2);

  const table = renderTable([
    { name: 'uno', verdict: 'PASS', detail: '' },
    { name: 'dos', verdict: 'FAIL', detail: 'x' },
  ]);
  assert.match(table, /^# \| Resultado \| Comprobación \| Detalle/u);
  assert.match(table, /2 \| FAIL      \| dos/u);
});

/*
 * El contrato de /api/v1: llaves, cupo, cursor, CSV y parámetros.
 *
 * Correr con: node --test tests/unit/api-v1.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  API_KEY_PATTERN,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  decideAccess,
  decodeCursor,
  encodeCursor,
  nextQuotaReset,
  paginate,
  parseBearer,
  parseCursorParam,
  parseDateParam,
  parseFormat,
  parseList,
  parsePageSize,
  parseSeriesCode,
  quotaHeaders,
  secondsToReset,
  toCsv,
  usageLogLine,
  withinRange,
} from '../../src/lib/api-v1/contrato.ts';

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
  assert.deepEqual(paginate(rows, 10, 2), { data: [], siguiente: null });
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

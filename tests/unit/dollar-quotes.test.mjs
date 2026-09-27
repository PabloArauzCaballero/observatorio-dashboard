/*
 * La tarjeta de cotización del dólar: una función pura, sin base.
 *
 * Correr con: node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDollarQuotes } from '../../src/lib/dollar-quotes.ts';

const token = (name, rows) => ({
  token: name,
  sidesResolved: true,
  points: rows.map(([date, mid, bid, ask, venues = 3]) => ({
    date,
    mid,
    bid,
    ask,
    venues,
    venueSpread: null,
    changePercent: null,
  })),
});

const daily = (rows) =>
  rows.map(([date, value]) => ({
    date,
    side: 'OFFICIAL',
    aggregation: 'POINT_IN_TIME',
    value,
    spread: null,
    venues: null,
    changePercent: null,
  }));

const stablecoins = [
  token('USD', [['2026-09-22', 11.9, null, null]]),
  token('USDT', [
    ['2026-09-21', 12.0, 11.95, 12.05, 7],
    ['2026-09-22', 12.05, 12.1, 11.98, 7], // lados rotulados al revés
  ]),
  token('USDC', [['2026-09-22', 12.2, 12.05, 12.37, 3]]),
];
const official = daily([
  ['2026-09-19', 10.01],
  ['2026-09-20', 11.0],
]);

test('las tres cotizaciones, en el orden USDT, USDC, Oficial', () => {
  const data = buildDollarQuotes({ stablecoins, official, today: '2026-09-23' });
  assert.deepEqual(
    data.quotes.map((quote) => quote.key),
    ['USDT', 'USDC', 'OFICIAL'],
  );
  assert.equal(data.latestDate, '2026-09-22');
  assert.equal(data.ageDays, 1);
});

test('compra es el lado menor y venta el mayor, aunque la fuente los rotule al revés', () => {
  const usdt = buildDollarQuotes({ stablecoins, official, today: '2026-09-22' }).quotes[0];
  assert.equal(usdt.buy, 11.98);
  assert.equal(usdt.sell, 12.1);
  assert.equal(usdt.venues, 7);
});

test('el cambio se mide contra la jornada anterior; sin ella no se inventa', () => {
  const [usdt, usdc, oficial] = buildDollarQuotes({ stablecoins, official, today: '2026-09-22' })
    .quotes;
  assert.ok(Math.abs(usdt.change - 0.05) < 1e-9);
  assert.equal(usdt.previousDate, '2026-09-21');
  assert.equal(usdc.change, null);
  assert.ok(Math.abs(oficial.change - 0.99) < 1e-9);
});

test('USDT sobre el oficial usa el oficial vigente ese día, no uno posterior', () => {
  const later = daily([
    ['2026-09-20', 11.0],
    ['2026-09-25', 13.0],
  ]);
  const data = buildDollarQuotes({ stablecoins, official: later, today: '2026-09-25' });
  assert.ok(Math.abs(data.usdtOverOfficial - (12.05 / 11 - 1) * 100) < 1e-9);
});

test('la edad del dato se publica cuando el recolector se detiene', () => {
  const data = buildDollarQuotes({ stablecoins, official, today: '2026-09-27' });
  assert.equal(data.ageDays, 5);
});

test('el oficial lleva compra y venta sólo si ambas son del mismo día', () => {
  const sides = {
    buy: daily([['2026-09-20', 10.9]]),
    sell: daily([['2026-09-19', 11.1]]),
  };
  const oficial = buildDollarQuotes({
    stablecoins,
    official,
    officialSides: sides,
    today: '2026-09-22',
  }).quotes[2];
  assert.equal(oficial.buy, null);
  assert.equal(oficial.sell, null);
});

test('sin datos, no hay tarjetas ni fecha', () => {
  const data = buildDollarQuotes({ stablecoins: [], official: [], today: '2026-09-22' });
  assert.equal(data.quotes.length, 0);
  assert.equal(data.latestDate, null);
  assert.equal(data.ageDays, null);
  assert.equal(data.usdtOverOfficial, null);
});

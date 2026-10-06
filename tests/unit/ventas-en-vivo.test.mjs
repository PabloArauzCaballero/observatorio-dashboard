/*
 * «Empresas › Ventas en vivo» sin base: que los filtros se crucen, que las tasas
 * salgan de sumar conteos del recorte (no de promediar tasas), que la tendencia
 * se normalice por lo observado y que un producto con pocos precios no se muestre.
 *
 * Correr con: node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  NO_FILTERS,
  byRubro,
  filterRooms,
  optionsFor,
  priceTable,
  weekOf,
  weekly,
} from '../../src/lib/live-commerce-board.ts';

const room = (overrides) => ({
  key: 'a',
  date: '2026-10-05',
  week: weekOf('2026-10-05'),
  hour: 21,
  weekday: 1,
  status: 'VENTA',
  rubro: 'CALZADO',
  product: 'zapatilla',
  city: 'SCZ',
  size: 'CHICO',
  minutes: 20,
  viewersPeak: 60,
  viewersMedian: 40,
  messages: 100,
  authors: 30,
  buyers: 5,
  signals: { COMPRA: 10, PRECIO: 20 },
  payments: { QR: 2 },
  destinations: { LPZ: 1 },
  emotions: { joy: 5, apt: 20 },
  polarity: {},
  gifts: 0,
  follows: 0,
  speechSegments: 40,
  screenReads: 10,
  ...overrides,
});

const rooms = [
  room({ key: 'a' }),
  room({ key: 'b', rubro: 'COSMETICOS', city: 'LPZ', messages: 900, signals: { COMPRA: 9 }, minutes: 60 }),
  room({ key: 'c', status: 'SIN_VENTA', rubro: 'SIN_IDENTIFICAR' }),
  room({ key: 'd', date: '2026-10-13', week: weekOf('2026-10-13'), city: 'LPZ', minutes: 40, messages: 200, signals: { COMPRA: 2 } }),
];

test('la semana empieza el lunes', () => {
  assert.equal(weekOf('2026-10-05'), '2026-10-05');
  assert.equal(weekOf('2026-10-11'), '2026-10-05');
  assert.equal(weekOf('2026-10-13'), '2026-10-12');
});

test('por defecto solo cuentan los lives con venta', () => {
  assert.equal(filterRooms(rooms, NO_FILTERS).length, 3);
  assert.equal(filterRooms(rooms, { ...NO_FILTERS, commerceOnly: false }).length, 4);
});

test('los filtros se cruzan: una opción cuenta con los OTROS filtros puestos', () => {
  const lpz = { ...NO_FILTERS, city: new Set(['LPZ']) };
  const rubros = Object.fromEntries(optionsFor(rooms, lpz, 'rubro').map((option) => [option.value, option.count]));
  // SIN_IDENTIFICAR existe en otro live: aparece con 0 y el riel la apaga.
  assert.deepEqual(rubros, { CALZADO: 1, COSMETICOS: 1, SIN_IDENTIFICAR: 0 });
  const cities = Object.fromEntries(optionsFor(rooms, lpz, 'city').map((option) => [option.value, option.count]));
  assert.deepEqual(cities, { LPZ: 2, SCZ: 1 });
});

test('las tasas salen de sumar conteos, no de promediar tasas', () => {
  const calzado = byRubro(filterRooms(rooms, NO_FILTERS)).find((row) => row.rubro === 'CALZADO');
  // (10 + 2) pedidos sobre (100 + 200) mensajes = 40 por mil; el promedio de tasas daría 55.
  assert.equal(calzado.buyPerThousand, 40);
  assert.equal(calzado.offerShare, 50);
});

test('la tendencia se normaliza por lo observado en cada semana', () => {
  const rows = weekly(filterRooms(rooms, NO_FILTERS));
  assert.deepEqual(
    rows.map((row) => [row.week, row.lives, row.buyPerThousand, row.messagesPerHour]),
    [
      ['2026-10-05', 2, 19, 750],
      ['2026-10-12', 1, 10, 300],
    ],
  );
});

test('un producto con menos precios que el mínimo no se muestra', () => {
  const prices = [
    { room: 'a', date: '2026-10-05', rubro: 'CALZADO', product: 'zapatilla', priceBs: 100, currency: 'BOB', source: 'SPEECH', unit: null },
    { room: 'a', date: '2026-10-05', rubro: 'CALZADO', product: 'zapatilla', priceBs: 140, currency: 'BOB', source: 'SPEECH', unit: null },
    { room: 'd', date: '2026-10-13', rubro: 'CALZADO', product: 'zapatilla', priceBs: 120, currency: 'BOB', source: 'SCREEN', unit: null },
    { room: 'b', date: '2026-10-05', rubro: 'COSMETICOS', product: 'labial', priceBs: 25, currency: 'BOB', source: 'SPEECH', unit: null },
    { room: 'c', date: '2026-10-05', rubro: 'CALZADO', product: 'zapatilla', priceBs: 9000, currency: 'BOB', source: 'SPEECH', unit: null },
  ];
  const visible = new Set(filterRooms(rooms, NO_FILTERS).map((one) => one.key));
  const table = priceTable(prices, visible, 3);
  assert.deepEqual(table, [{ product: 'zapatilla', rubro: 'CALZADO', n: 3, median: 120, p25: 110, p75: 130 }]);
});

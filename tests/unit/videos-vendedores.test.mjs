/*
 * «Empresas › Videos de vendedores» sin base: filtros cruzados por cuenta, serie diaria, qué se vendía
 * por año, precios con mínimo de muestra y cuánta interacción logra cada marca de venta.
 *
 * Correr con: node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  NO_VIDEO_FILTERS,
  daily,
  filterVideos,
  formats,
  rubroByYear,
  tactics,
  videoOptions,
  videoPrices,
} from '../../src/lib/tiktok-videos-board.ts';

const video = (overrides) => ({
  key: 'v',
  seller: 'a',
  kind: 'VENTA',
  date: '2026-10-01',
  hour: 20,
  weekday: 4,
  rubro: 'CALZADO',
  product: 'zapatilla',
  prices: [],
  plays: 1000,
  likes: 50,
  comments: 1,
  shares: 1,
  duration: 20,
  photo: false,
  tactics: [],
  ...overrides,
});

const board = {
  analyzedAt: null,
  rubros: {},
  departments: {},
  terms: [],
  coverage: null,
  accounts: [
    { seller: 'a', origin: 'LIVE', kind: 'VENTA', rubro: 'CALZADO', city: 'SCZ', followers: 10, videosRead: 3, firstVideo: null, lastVideo: null },
    { seller: 'b', origin: 'SIMILAR', kind: 'GASTRONOMIA', rubro: 'GASTRONOMIA', city: 'LPZ', followers: 10, videosRead: 2, firstVideo: null, lastVideo: null },
  ],
  videos: [
    video({ key: '1', date: '2021-08-10', prices: [100], tactics: ['PRECIO'], likes: 100 }),
    video({ key: '2', date: '2026-10-01', prices: [120], tactics: ['PRECIO', 'ENVIO'] }),
    video({ key: '3', date: '2026-10-01', prices: [140], photo: true }),
    video({ key: '4', seller: 'b', kind: 'GASTRONOMIA', rubro: 'GASTRONOMIA', product: 'saltena', date: '2026-10-02', tactics: ['ENVIO'] }),
  ],
};

test('los filtros se cruzan a través de la cuenta (origen y departamento)', () => {
  const lpz = { ...NO_VIDEO_FILTERS, city: new Set(['LPZ']) };
  assert.equal(filterVideos(board, lpz).length, 1);
  assert.deepEqual(
    Object.fromEntries(videoOptions(board, lpz, 'origin').map((option) => [option.value, option.count])),
    { SIMILAR: 1, LIVE: 0 },
  );
});

test('día a día por clase de cuenta, y qué se vendía por año', () => {
  const days = daily(board.videos);
  // todos los días del rango, con cero donde no hubo videos
  assert.equal(days[0].date, '2021-08-10');
  assert.equal(days[1].date, '2021-08-11');
  assert.equal(days[1].VENTA, 0);
  assert.deepEqual(days.slice(-2).map((row) => [row.date, row.VENTA, row.GASTRONOMIA]), [['2026-10-01', 2, 0], ['2026-10-02', 0, 1]]);
  assert.equal(days.length, 1880);
  assert.deepEqual(rubroByYear(board.videos), [
    { year: '2021', CALZADO: 1 },
    { year: '2026', CALZADO: 2, GASTRONOMIA: 1 },
  ]);
});

test('precio con mínimo de muestra, y la interacción de cada marca contra la de todos', () => {
  assert.deepEqual(videoPrices(board.videos, 3), [{ product: 'zapatilla', rubro: 'CALZADO', n: 3, median: 120, p25: 110, p75: 130 }]);
  const precio = tactics(board.videos).find((row) => row.tactic === 'PRECIO');
  assert.equal(precio.share, 50);
  assert.equal(precio.likesPerThousand, 75);
  assert.equal(precio.baseline, 50);
});

test('formato: fotos aparte y videos por duración', () => {
  assert.deepEqual(
    formats(board.videos).map((row) => [row.band, row.videos]),
    [['Foto o carrusel', 1], ['15 a 30 s', 3]],
  );
});

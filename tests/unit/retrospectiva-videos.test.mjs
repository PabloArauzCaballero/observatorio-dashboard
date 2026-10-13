/*
 * «Empresas › Videos de vendedores › Retrospectiva» sin base: filtros cruzados (rubro y rango de meses), meses
 * con poca muestra que se cuentan y no se pintan, mapa de calor, hashtags nuevos y precios por año con el dólar.
 *
 * Correr con: node --test tests/unit/retrospectiva-videos.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  NO_RETRO_FILTERS,
  filterMonths,
  heatCells,
  monthOptions,
  monthlyAverage,
  newTagsByMonth,
  priceByYear,
  productChoices,
  rubroOptions,
  sampleSplit,
  yearsInRange,
} from '../../src/lib/tiktok-retrospective.ts';

const month = (rubro, m, n, extra = {}) => ({
  rubro,
  month: m,
  n,
  accounts: Math.min(n, 3),
  median: n >= 5 ? 100 : null,
  p95: n >= 5 ? 900 * n : null,
  trendN: n >= 5 ? 1 : null,
  shareRatio: n >= 5 ? 0.01 : null,
  priced: 0,
  priceMedian: null,
  products: [],
  newTags: [],
  baseline: false,
  tactics: [],
  ...extra,
});

const trends = {
  minN: 5,
  trendShare: 0.05,
  months: [
    month('CALZADO', '2022-03', 8),
    month('CALZADO', '2022-04', 1),
    month('HOGAR', '2022-03', 6, { newTags: [{ tag: 'ollas', n: 3 }] }),
    month('HOGAR', '2023-01', 12, { newTags: [{ tag: 'sartenes', n: 4 }, { tag: 'ollas2', n: 2 }] }),
  ],
  products: [
    { year: '2022', rubro: 'CALZADO', product: 'zapato', n: 9, prices: 5, p25: 90, median: 100, p75: 120 },
    { year: '2023', rubro: 'CALZADO', product: 'zapato', n: 4, prices: 2, p25: null, median: null, p75: null },
    { year: '2023', rubro: 'HOGAR', product: 'olla', n: 7, prices: 4, p25: 40, median: 50, p75: 60 },
  ],
};

test('el filtro de rubro y el de rango se cruzan: cada uno recorta las opciones del otro', () => {
  const hogar = { ...NO_RETRO_FILTERS, rubro: new Set(['HOGAR']) };
  assert.deepEqual(monthOptions(trends, hogar), ['2022-03', '2023-01']);
  assert.deepEqual(monthOptions(trends, NO_RETRO_FILTERS), ['2022-03', '2022-04', '2023-01']);
  const desde2023 = { ...NO_RETRO_FILTERS, from: '2023-01' };
  assert.deepEqual(rubroOptions(trends, desde2023), [
    { value: 'HOGAR', count: 12 },
    { value: 'CALZADO', count: 0 },
  ]);
  assert.equal(filterMonths(trends, { ...hogar, to: '2022-12' }).length, 1);
});

test('un mes con menos videos que el mínimo se cuenta y no se pinta', () => {
  const split = sampleSplit(trends.months, trends.minN);
  assert.deepEqual(split, { withStat: 3, countOnly: 1, videosCountOnly: 1 });
  const heat = heatCells(trends.months, (r) => r);
  assert.equal(heat.cells.length, 3);
  assert.ok(!heat.cells.some((c) => c.column === '2022-04'));
  assert.deepEqual(heat.columns, ['2022-03', '2023-01']);
  assert.equal(heat.rows[0], 'HOGAR'); // el rubro con más videos con estadística, primero
});

test('los hashtags nuevos se agrupan por mes y los más usados van primero', () => {
  const rows = newTagsByMonth(trends.months);
  assert.deepEqual(rows.map((r) => [r.month, r.count]), [['2022-03', 1], ['2023-01', 2]]);
  assert.equal(rows[1].tags[0].tag, 'sartenes');
});

test('el precio de un producto sale año por año con el dólar promedio del año al lado', () => {
  const dollar = monthlyAverage([
    { date: '2022-03-01', value: 6.9 },
    { date: '2022-03-02', value: 7.1 },
    { date: '2022-04-01', value: 7.5 },
    { date: '2023-01-05', value: 11 },
  ]);
  assert.deepEqual(dollar, { '2022-03': 7, '2022-04': 7.5, '2023-01': 11 });
  const rows = priceByYear(trends.products, 'zapato', NO_RETRO_FILTERS, dollar);
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].year, rows[0].median, rows[0].dollar, rows[0].medianUsd], ['2022', 100, 7.25, 13.79]);
  assert.equal(rows[1].median, null); // dos precios: no se resume
  assert.equal(rows[1].medianUsd, null);
});

test('los productos elegibles respetan el rubro y el rango de años', () => {
  assert.deepEqual(productChoices(trends.products, NO_RETRO_FILTERS).map((p) => p.product), ['zapato', 'olla']);
  const hogar = { ...NO_RETRO_FILTERS, rubro: new Set(['HOGAR']) };
  assert.deepEqual(productChoices(trends.products, hogar).map((p) => p.product), ['olla']);
  assert.deepEqual(productChoices(trends.products, { ...NO_RETRO_FILTERS, to: '2022-12' }).map((p) => p.product), ['zapato']);
});

test('el rango de meses recorta los años de la cobertura', () => {
  const all = ['2021', '2022', '2023', '2024'];
  assert.deepEqual(yearsInRange({ ...NO_RETRO_FILTERS, from: '2022-06', to: '2023-02' }, all), ['2022', '2023']);
  assert.deepEqual(yearsInRange(NO_RETRO_FILTERS, all), all);
});

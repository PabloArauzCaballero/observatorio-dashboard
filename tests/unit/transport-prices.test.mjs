import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comparableModelYears, priceRangeCurrency, vehicleCoverage } from '../../src/lib/vehicle-price-analysis.ts';

const read = name => JSON.parse(readFileSync(new URL(`../../src/data/${name}.json`, import.meta.url), 'utf8'));

test('las ofertas de autos son versiones observadas, sin precios nulos ni duplicados', () => {
  const rows = read('vehicle-prices');
  assert.ok(rows.length >= 30);
  assert.deepEqual([...new Set(rows.map(row => row.brand))].sort(), ['JAC', 'Nissan', 'Renault']);
  assert.ok(rows.every(row => row.type && row.model && row.version && row.modelYear && row.price > 0 && row.currency === 'USD' && row.source.startsWith('https://')));
  const keys = rows.map(row => [row.brand, row.model, row.version, row.modelYear].join('|'));
  assert.equal(new Set(keys).size, keys.length);
});

test('la cobertura es un recuento de la muestra, sin interpretar cuotas de mercado', () => {
  const rows = read('vehicle-prices');
  const coverage = vehicleCoverage(rows);
  assert.equal(coverage.reduce((sum, group) => sum + group.versions, 0), rows.length);
  assert.deepEqual(coverage.map(group => group.type), ['Camioneta', 'Sedán', 'SUV / vagoneta', 'Urbano / hatchback']);
  assert.equal(coverage.find(group => group.type === 'SUV / vagoneta')?.versions, 18);
});

test('la comparación de años modelo sólo une ofertas compatibles del mismo día', () => {
  const base = { type: 'Camioneta', brand: 'Marca', model: 'Modelo', version: 'Base', modelYear: 2026, price: 100, currency: 'USD', priceType: 'Lista', observedAt: '2026-10-03' };
  const rows = [
    base,
    { ...base, modelYear: 2027, price: 110 },
    { ...base, version: 'Otra', modelYear: 2027, price: 130 },
    { ...base, currency: 'BOB', modelYear: 2027, price: 800 },
    { ...base, priceType: 'Promoción', modelYear: 2027, price: 90 },
    { ...base, observedAt: '2026-10-04', modelYear: 2027, price: 120 },
  ];
  const pairs = comparableModelYears(rows);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].difference, 10);
  assert.equal(pairs[0].before.modelYear, 2026);
  assert.equal(pairs[0].after.modelYear, 2027);
  assert.equal(comparableModelYears(read('vehicle-prices')).length, 6);
});

test('el rango numérico exige una sola moneda', () => {
  const rows = read('vehicle-prices');
  assert.equal(priceRangeCurrency(rows, new Set()), 'USD');
  const mixed = [...rows, { ...rows[0], currency: 'BOB' }];
  assert.equal(priceRangeCurrency(mixed, new Set()), null);
  assert.equal(priceRangeCurrency(mixed, new Set(['USD'])), 'USD');
  assert.equal(priceRangeCurrency(mixed, new Set(['USD', 'BOB'])), null);
});

test('los cortes de ANH mantienen producto, régimen y unidad originales', () => {
  const rows = read('fuel-prices');
  assert.equal(new Set(rows.filter(row => row.market === 'Mercado interno').map(row => row.product)).size, 17);
  assert.equal(new Set(rows.filter(row => row.market === 'Precio internacional').map(row => row.product)).size, 5);
  assert.ok(rows.every(row => row.price > 0 && ['Bs/l', 'Bs/kg', 'Bs/m³'].includes(row.unit)));
  assert.ok(rows.some(row => row.date === '2010-12-31'));
  assert.ok(rows.some(row => row.date === '2026-08-31'));
  const keys = rows.map(row => [row.market, row.product, row.date].join('|'));
  assert.equal(new Set(keys).size, keys.length);
});

test('las tarifas ATT distinguen bandas, máximos y DUA', () => {
  const rows = read('passenger-fares');
  assert.deepEqual([...new Set(rows.map(row => row.mode))].sort(), ['Aéreo', 'Ferroviario', 'Terrestre']);
  assert.ok(rows.every(row => row.maximum > 0 && row.origin && row.destination && row.reference));
  assert.ok(rows.filter(row => row.mode === 'Terrestre').every(row => (row.minimum === null || row.minimum > 0 && row.minimum <= row.maximum) && row.dua === 0));
  assert.ok(rows.filter(row => row.mode === 'Aéreo').every(row => row.minimum === null && row.dua === 15));
  assert.ok(rows.filter(row => row.mode === 'Ferroviario').every(row => row.minimum === null && row.dua === 0));
  assert.ok(rows.every(row => row.period && row.validity));
  const lapazOruro = rows.filter(row => row.mode === 'Terrestre' && row.origin === 'La Paz' && row.destination === 'Oruro' && row.service === 'Normal');
  assert.deepEqual(lapazOruro.map(row => row.period).sort(), ['2016', '2026']);
  const air2026 = rows.filter(row => row.mode === 'Aéreo' && row.period === '2026');
  assert.ok(air2026.every(row => row.validity === '2026-01-26 a 2026-07-24'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { measured, summarize } from '../../src/lib/exogenous-board.ts';

const series = (frequency, points) => ({ frequency, points });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test('cambio mensual exige el mes calendario anterior y mantiene la comparación interanual exacta', () => {
  const summary = summarize(series('MONTHLY', [['2025-03', 100], ['2026-01', 120], ['2026-03', 150]]));
  assert.equal(summary.change, null);
  near(summary.yearChange, 50);
});

test('cambio anual no salta años ausentes', () => {
  const summary = summarize(series('ANNUAL', [['2023', 100], ['2025', 150]]));
  assert.equal(summary.change, null);
  assert.equal(summary.yearChange, null);
});

test('el mes anterior a enero es diciembre del año previo', () => {
  near(summarize(series('MONTHLY', [['2025-12', 100], ['2026-01', 110]])).change, 10);
});

const sixtyMonths = Array.from({ length: 60 }, (_, index) => {
  const date = new Date(Date.UTC(2021, 5 + index, 1));
  return [date.toISOString().slice(0, 7), 100];
});

test('promedio mensual usa exactamente junio 2021 a mayo 2026 antes de junio 2026', () => {
  const points = [['2021-01', 10000], ['2021-05', 10000], ...sixtyMonths, ['2026-06', 200]];
  near(summarize(series('MONTHLY', points)).versusFiveYears, 100);
});

test('un mes ausente invalida los cinco años aunque haya otras 60 observaciones', () => {
  const incomplete = sixtyMonths.filter(([period]) => period !== '2023-11');
  const points = [['2021-04', 100], ['2021-05', 100], ...incomplete, ['2026-06', 200]];
  assert.equal(summarize(series('MONTHLY', points)).versusFiveYears, null);
});

test('promedio anual exige los cinco años inmediatamente anteriores y excluye otros', () => {
  const points = [['2020', 10000], ['2021', 100], ['2022', 100], ['2023', 100], ['2024', 100], ['2025', 100], ['2026', 200]];
  near(summarize(series('ANNUAL', points)).versusFiveYears, 100);
  assert.equal(summarize(series('ANNUAL', points.filter(([period]) => period !== '2023'))).versusFiveYears, null);
});

test('ratios de resumen e interanual no dividen por precios cero o negativos', () => {
  for (const value of [0, -100]) {
    const points = [['2025', value], ['2026', 50]];
    const summary = summarize(series('ANNUAL', points));
    assert.equal(summary.change, null);
    assert.equal(summary.yearChange, null);
    assert.deepEqual(measured(points, 'YOY', 2026, 2026), []);
    const full = ['2021', '2022', '2023', '2024', '2025'].map((period) => [period, value]);
    assert.equal(summarize(series('ANNUAL', [...full, ['2026', 50]])).versusFiveYears, null);
  }
});

test('índice usa el primer punto visible positivo; nunca adelanta la base sobre un cero o negativo', () => {
  for (const value of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(measured([['2025', value], ['2026', 20]], 'INDEX', 2025, 2026), []);
  }
  assert.deepEqual(measured([['2024', -10], ['2025', 20], ['2026', 30]], 'INDEX', 2025, 2026), [['2025', 100], ['2026', 150]]);
});

test('cobertura vacía o valores no finitos no producen resúmenes porcentuales', () => {
  assert.deepEqual(summarize(series('MONTHLY', [])), { last: null, change: null, yearChange: null, versusFiveYears: null });
  const incomplete = sixtyMonths.map(([period, value]) => [period, period === '2023-11' ? Number.NaN : value]);
  assert.equal(summarize(series('MONTHLY', [...incomplete, ['2026-06', 200]])).versusFiveYears, null);
  assert.equal(summarize(series('ANNUAL', [['2025', 100], ['2026', Number.POSITIVE_INFINITY]])).change, null);
});

test('nivel conserva precios negativos observados y el interanual positivo conserva su cálculo', () => {
  const points = [['2025', 100], ['2026', -20]];
  assert.deepEqual(measured(points, 'LEVEL', 2025, 2026), points);
  assert.deepEqual(measured(points, 'YOY', 2026, 2026), [['2026', -120]]);
});

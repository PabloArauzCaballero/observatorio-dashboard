import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFamilyTables,
  familyCsvRows,
} from '../../src/lib/exogenous-factor-table.ts';

const item = (code, frequency, points, unit = 'US$/t') => ({
  series: { code, name: `Serie ${code}`, unit, frequency, sourceUrl: 'https://fuente.test' },
  points: points.map(([period, value]) => ({ period, value, status: 'OBSERVED', sourceUrl: '' })),
});

test('una tabla por frecuencia, una columna por serie y filas del más reciente al más antiguo', () => {
  const groups = buildFamilyTables([
    item('A', 'ANNUAL', [['2023', 1], ['2024', 2]]),
    item('B', 'MONTHLY', [['2024-01', 10], ['2024-02', 20]]),
    item('C', 'MONTHLY', [['2024-02', 5]]),
  ]);
  assert.deepEqual(groups.map((group) => group.frequency), ['MONTHLY', 'ANNUAL']);
  const monthly = groups[0];
  assert.deepEqual(monthly.columns.map((column) => column.code), ['B', 'C']);
  assert.deepEqual(monthly.rows, [
    { period: '2024-02', values: [20, 5] },
    { period: '2024-01', values: [10, null] },
  ]);
  assert.deepEqual(groups[1].rows.map((row) => row.period), ['2024', '2023']);
});

test('una serie sin observaciones sigue teniendo su columna y no se rellena', () => {
  const [group] = buildFamilyTables([
    item('A', 'ANNUAL', [['2024', 2]]),
    item('B', 'ANNUAL', []),
  ]);
  assert.equal(group.columns.length, 2);
  assert.deepEqual(group.rows, [{ period: '2024', values: [2, null] }]);
});

test('el CSV trae todas las observaciones de todas las series, una por fila', () => {
  const rows = familyCsvRows([
    item('A', 'ANNUAL', [['2023', 1], ['2024', null]]),
    item('B', 'MONTHLY', [['2024-01', 10]]),
  ]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], ['A', 'Serie A', 'US$/t', 'ANNUAL', '2023', 1, 'OBSERVED', 'https://fuente.test']);
  assert.equal(rows[1][5], null);
});

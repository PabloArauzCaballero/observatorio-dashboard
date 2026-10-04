import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareFactorSeries,
  FactorComparisonError,
} from '../../src/lib/exogenous-factor-comparison.ts';

const series = (overrides = {}) => ({
  code: 'EXF_TEST',
  measureType: 'PRICE',
  unit: 'USD/t',
  frequency: 'MONTHLY',
  observationStatus: 'OBSERVED',
  ...overrides,
});
const point = (period, value, status = 'OBSERVED') => ({ period, value, status });
const input = (overrides = {}) => ({
  leftSeries: series(),
  rightSeries: series({ code: 'EXF_OTHER' }),
  leftPoints: [point('2024-01', 10), point('2024-02', 12)],
  rightPoints: [point('2024-01', 20), point('2024-02', 24)],
  mode: 'LEVEL',
  ...overrides,
});

test('niveles alinean la unión de períodos y preservan huecos sin rellenar', () => {
  const source = input({
    leftPoints: [point('2024-03', 9), point('2024-01', 0)],
    rightPoints: [point('2024-02', 12), point('2024-03', 99, 'SUPPRESSED')],
  });
  const original = structuredClone(source);
  const result = compareFactorSeries(source);
  assert.deepEqual(result.points, [
    { period: '2024-01', left: 0, right: null },
    { period: '2024-02', left: null, right: 12 },
    { period: '2024-03', left: 9, right: null },
  ]);
  assert.deepEqual(source, original);
  assert.equal(result.basePeriod, null);
  assert.ok(result.warnings.some((message) => message.includes('nulos')));
  assert.ok(result.warnings.includes('Una comparación descriptiva no demuestra causalidad'));
});

test('base 100 selecciona el primer período común positivo y excluye lo anterior', () => {
  const result = compareFactorSeries(
    input({
      mode: 'BASE100',
      leftPoints: [
        point('2024-01', 0),
        point('2024-02', -5),
        point('2024-03', 10),
        point('2024-05', 20),
      ],
      rightPoints: [
        point('2024-01', 20),
        point('2024-02', 30),
        point('2024-03', 40),
        point('2024-04', null, 'MISSING'),
        point('2024-05', 20),
      ],
    }),
  );
  assert.equal(result.basePeriod, '2024-03');
  assert.equal(result.leftBaseValue, 10);
  assert.equal(result.rightBaseValue, 40);
  assert.deepEqual(result.points, [
    { period: '2024-03', left: 100, right: 100 },
    { period: '2024-04', left: null, right: null },
    { period: '2024-05', left: 200, right: 50 },
  ]);
  assert.match(result.description, /anteriores.*excluyen/);
  assert.match(result.description, /2024-03/);
});

test('base 100 usa el mismo período aunque las series comiencen en fechas distintas', () => {
  const result = compareFactorSeries(
    input({
      mode: 'BASE100',
      rightSeries: series({ unit: 'toneladas', measureType: 'QUANTITY' }),
      rightPoints: [point('2024-02', 30), point('2024-03', 60)],
    }),
  );
  assert.equal(result.basePeriod, '2024-02');
  assert.deepEqual(result.points[0], { period: '2024-02', left: 100, right: 100 });
  assert.deepEqual(result.points[1], { period: '2024-03', left: null, right: 200 });
});

test('no inventa base común cuando sólo existen faltantes, ceros o negativos', () => {
  for (const rightPoints of [
    [point('2024-03', 10)],
    [point('2024-01', 0)],
    [point('2024-01', -1)],
    [point('2024-01', null, 'MISSING')],
  ]) {
    assert.throws(
      () => compareFactorSeries(input({ mode: 'BASE100', rightPoints })),
      FactorComparisonError,
    );
  }
});

test('rechaza frecuencias distintas en los tres modos y unidades incompatibles en niveles/cambios', () => {
  for (const mode of ['LEVEL', 'BASE100', 'CHANGE']) {
    assert.throws(
      () => compareFactorSeries(input({ mode, rightSeries: series({ frequency: 'ANNUAL' }) })),
      /frecuencias distintas/,
    );
  }
  assert.throws(
    () => compareFactorSeries(input({ rightSeries: series({ unit: 'BOB/t' }) })),
    /misma unidad/,
  );
  assert.throws(
    () => compareFactorSeries(input({ rightSeries: series({ measureType: 'STOCK' }) })),
    /tipo de medida/,
  );
  assert.throws(
    () =>
      compareFactorSeries(
        input({
          mode: 'CHANGE',
          leftSeries: series({ measureType: 'RATE', unit: '%' }),
          rightSeries: series({ measureType: 'RATE', unit: 'decimal' }),
        }),
      ),
    /misma unidad/,
  );
});

test('anomalías como ONI rechazan base 100 incluso cuando existe una base positiva', () => {
  for (const side of ['leftSeries', 'rightSeries']) {
    assert.throws(
      () =>
        compareFactorSeries(
          input({
            mode: 'BASE100',
            [side]: series({
              measureType: 'INDEX',
              unit: '°C anomalía',
              transformationType: 'ANOMALY',
            }),
          }),
        ),
      /anomalías.*ONI/i,
    );
  }
});

test('tasas y proporciones no se rebajan a base 100', () => {
  for (const measureType of ['RATE', 'PROPORTION']) {
    assert.throws(
      () =>
        compareFactorSeries(
          input({
            mode: 'BASE100',
            leftSeries: series({ measureType }),
            rightSeries: series({ measureType }),
          }),
        ),
      /tasas o proporciones/,
    );
  }
  assert.throws(() => compareFactorSeries(input({ mode: 'CHANGE' })), /tasas o proporciones/);
});

test('cambios absolutos admiten base cero y negativa sin inferir puntos porcentuales', () => {
  const result = compareFactorSeries(
    input({
      mode: 'CHANGE',
      leftSeries: series({ measureType: 'RATE', unit: '% anual' }),
      rightSeries: series({ measureType: 'PROPORTION', unit: '% anual' }),
      leftPoints: [point('2024-01', 0), point('2024-02', -2)],
      rightPoints: [point('2024-01', -1), point('2024-02', 3)],
    }),
  );
  assert.equal(result.basePeriod, '2024-01');
  assert.deepEqual(result.points, [
    { period: '2024-01', left: 0, right: 0 },
    { period: '2024-02', left: -2, right: 4 },
  ]);
  assert.equal(result.unit, 'diferencia en % anual');
  assert.doesNotMatch(result.description, /puntos porcentuales/);
});

test('no mezcla pronósticos con realizaciones y permite dos pronósticos etiquetados', () => {
  assert.throws(
    () => compareFactorSeries(input({ leftSeries: series({ observationStatus: 'FORECAST' }) })),
    /pronóstico/,
  );
  const result = compareFactorSeries(
    input({
      leftSeries: series({ observationStatus: 'FORECAST' }),
      rightSeries: series({ observationStatus: 'FORECAST' }),
    }),
  );
  assert.ok(result.warnings.some((message) => message.includes('Ambas series son pronósticos')));
});

test('valores no finitos conservan faltantes y no se elige una revisión arbitraria', () => {
  const result = compareFactorSeries(
    input({ leftPoints: [point('2024-01', Infinity), point('2024-02', NaN)] }),
  );
  assert.ok(result.points.every((entry) => entry.left === null));
  assert.throws(
    () => compareFactorSeries(input({ leftPoints: [point('2024-01', 1), point('2024-01', 2)] })),
    /revisión/,
  );
});

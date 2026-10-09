import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  catalogueQuery,
  filterFamilies,
  historyQuery,
  selectKnownPoints,
  factorCsv,
  supportsSnapshotFallback,
  factorPageMetadata,
  FactorHistoryCompatibilityError,
} from '../../src/lib/exogenous-factor-query.ts';
import { isKnownLegacyPeriod, legacyFactor } from '../../src/lib/exogenous-factor-legacy.ts';

const catalogue = JSON.parse(
  readFileSync(new URL('../../src/data/exogenous-catalogue.json', import.meta.url), 'utf8'),
);

test('el fallback admite fallos de infraestructura pero nunca una denegación de permisos', () => {
  for (const code of ['42P01', 'ECONNREFUSED', 'ETIMEDOUT'])
    assert.equal(supportsSnapshotFallback({ code }), true);
  for (const error of [{ code: '42501' }, { code: '42601' }, new Error('unknown'), null])
    assert.equal(supportsSnapshotFallback(error), false);
});

test('los metadatos corresponden a la última fila entregada y no a la fila adicional', () => {
  const base = { unit: '%', frequency: 'MONTHLY', measureType: 'RATE', geography: 'Bolivia' };
  const rows = [
    { ...base, name: 'Primera fila', latestPeriod: '2024-01' },
    { ...base, name: 'Última entregada', latestPeriod: '2024-02' },
    { ...base, name: 'Fila adicional', latestPeriod: '2024-03' },
  ];
  assert.equal(factorPageMetadata(rows, 2).name, 'Última entregada');
  assert.equal(factorPageMetadata(rows, 2, true).name, 'Fila adicional');
  assert.equal(factorPageMetadata([], 2), undefined);
});

test('el histórico rechaza dimensiones incompatibles incluso en el límite de una página', () => {
  const base = { unit: '%', frequency: 'MONTHLY', measureType: 'RATE', geography: 'Bolivia' };
  for (const change of [
    { unit: 'USD' },
    { frequency: 'ANNUAL' },
    { measureType: 'PRICE' },
    { geography: 'Brasil' },
  ]) {
    assert.throws(
      () => factorPageMetadata([base, { ...base, ...change }], 1),
      FactorHistoryCompatibilityError,
    );
    assert.throws(
      () => factorPageMetadata([base, { ...base, ...change }], 100, true),
      FactorHistoryCompatibilityError,
    );
  }
});

test('el legado valida fechas gregorianas y no acepta períodos futuros de ninguna frecuencia', () => {
  const acquired = '2024-03-02T12:00:00Z';
  for (const period of ['2024-02-29', '2024-03', '2024'])
    assert.equal(isKnownLegacyPeriod(period, acquired), true, period);
  for (const period of ['2023-02-29', '2024-02-30', '2024-03-03', '2024-04', '2025'])
    assert.equal(isKnownLegacyPeriod(period, acquired), false, period);
});
test('el catálogo conserva las 287 familias y cubre todos los sectores sin simular mediciones', () => {
  assert.equal(catalogue.families.length, 287);
  assert.equal(new Set(catalogue.families.map((f) => f.id)).size, 287);
  assert.equal(catalogue.sectors.length, 21);
  for (const sector of catalogue.sectors)
    assert.ok(
      catalogue.families.some((f) => f.sectorIds.includes(sector.id)),
      sector.id,
    );
  assert.ok(
    catalogue.families.every(
      (f) => f.seriesCount === 0 && f.definition && f.channel && f.lagHypothesis,
    ),
  );
});
test('la búsqueda combina acentos, sector, rol y disponibilidad real', () => {
  const families = catalogue.families.map((f) => ({
    ...f,
    seriesCount: f.id === 'ST_053' ? 2 : 0,
  }));
  const query = catalogueQuery(new URLSearchParams('q=matricula&sector=P&availability=available'));
  assert.deepEqual(
    filterFamilies(families, query).map((f) => f.id),
    ['ST_053'],
  );
  assert.equal(
    filterFamilies(families, catalogueQuery(new URLSearchParams('availability=available&sector=B')))
      .length,
    0,
  );
});
test('el contrato de consulta rechaza rangos, fechas y paginaciones inválidas', () => {
  for (const input of [
    'page=0',
    'pageSize=1001',
    'sector=ZZ',
    'priority=P3',
    'availability=simulated',
  ])
    assert.throws(() => catalogueQuery(new URLSearchParams(input)));
  const now = new Date('2026-10-04T15:00:00Z');
  for (const input of [
    'series=EXF_A&from=2026&to=2020',
    'series=EXF_A&asOf=2026-02-30',
    'series=EXF_A&asOf=2026-10-05',
    'series=DROP%20TABLE',
    'series=EXF_A&pageSize=90000',
  ])
    assert.throws(() => historyQuery(new URLSearchParams(input), now));
  assert.equal(
    historyQuery(new URLSearchParams('series=EXF_A&asOf=2026-10-04'), now).asOf,
    now.toISOString(),
  );
});
const point = (value, availableAt, retrievedAt = availableAt) => ({
  period: '2026-01',
  value,
  status: 'OBSERVED',
  publishedAt: null,
  availableAt,
  retrievedAt,
  sourceUrl: 'https://example.org/source',
  evidenceSha256: 'a'.repeat(64),
});
test('las revisiones A B A respetan la fecha de conocimiento y no la del período', () => {
  const points = [
    point(10, '2026-02-01T00:00:00Z'),
    point(20, '2026-03-01T00:00:00Z'),
    point(10, '2026-04-01T00:00:00Z'),
  ];
  assert.deepEqual(selectKnownPoints(points, '2026-01-31T23:59:59Z'), []);
  assert.equal(selectKnownPoints(points, '2026-03-15T00:00:00Z')[0].value, 20);
  assert.equal(selectKnownPoints(points, '2026-04-15T00:00:00Z')[0].value, 10);
});
test('un faltante revisado no recupera el valor anterior ni se convierte en cero', () => {
  const points = [
    point(0, '2026-02-01T00:00:00Z'),
    { ...point(null, '2026-03-01T00:00:00Z'), status: 'SUPPRESSED' },
  ];
  assert.equal(selectKnownPoints(points, '2026-02-15T00:00:00Z')[0].value, 0);
  assert.equal(selectKnownPoints(points, '2026-03-15T00:00:00Z')[0].value, null);
});
test('la descarga conserva evidencias, valores negativos y protege fórmulas', () => {
  const series = {
    code: 'EXF_A',
    name: '=HYPERLINK("x")',
    unit: '%',
    frequency: 'MONTHLY',
    geography: 'Bolivia',
    economicRole: 'OUTCOME',
    observationStatus: 'ESTIMATED',
    measurementStatus: 'PROXY',
    transformationType: 'ANOMALY',
    targetScope: 'Demanda nacional',
    note: 'Media móvil de tres meses',
    sourceSeriesKey: 'NOAA:ONI',
  };
  const csv = factorCsv(
    series,
    [
      point(-2, '2026-02-01T00:00:00Z'),
      { ...point(null, '2026-03-01T00:00:00Z'), status: 'MISSING' },
    ],
    '2026-10-04T00:00:00Z',
    ['Copia de datos incluida'],
  );
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('"-2"'));
  assert.ok(csv.includes('"MISSING"'));
  assert.ok(csv.includes('a'.repeat(64)));
  for (const field of ['ESTIMATED', 'PROXY', 'ANOMALY', 'NOAA:ONI', 'Copia de datos incluida'])
    assert.ok(csv.includes(`"${field}"`));
});
test('la integración no confunde fletes con demoras ni cotizaciones BOB con cruces USD', () => {
  const freight = legacyFactor(
    {
      indicatorCode: 'EXO_FREIGHT_FBX',
      product: 'CONTAINER',
      group: 'FREIGHT',
      frequency: 'MONTHLY',
    },
    '',
    '2026-01-01',
  );
  assert.deepEqual(freight.familyIds, []);
  assert.deepEqual(freight.sectorIds, ['H', 'G']);
  const fx = legacyFactor(
    { indicatorCode: 'EXO_FX_BRL', product: 'BRL', group: 'CURRENCY', frequency: 'DAILY' },
    '',
    '2026-01-01',
  );
  assert.ok(!fx.familyIds.includes('MF_BRLUSD'));
});

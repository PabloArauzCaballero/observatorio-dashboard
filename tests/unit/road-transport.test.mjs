import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';

async function loadModule(path) {
  const source = await readFile(path, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  Function('module', 'exports', 'require', js)(module, module.exports, () => ({}));
  return module.exports;
}

test('road transport board preserves the historical endpoints and operational detail', async () => {
  const { buildRoadTransportBoard } = await loadModule(
    new URL('../../src/lib/road-transport-board.ts', import.meta.url),
  );
  const source = {
    sourceKey: 'INE',
    publisher: 'INE',
    sourceTitle: 'Parque automotor',
    sourceUrl: 'https://ine.test',
    evidenceSha256: 'a'.repeat(64),
  };
  const fleet = [
    {
      ...source,
      dimension: 'DEPARTMENT_SERVICE',
      department: 'BOLIVIA',
      service: 'TOTAL',
      vehicleClass: null,
      capacityBand: null,
      period: '2003',
      value: 443888,
      preliminary: false,
    },
    {
      ...source,
      dimension: 'DEPARTMENT_SERVICE',
      department: 'BOLIVIA',
      service: 'TOTAL',
      vehicleClass: null,
      capacityBand: null,
      period: '2025',
      value: 2672176,
      preliminary: true,
    },
    {
      ...source,
      dimension: 'SERVICE_CLASS',
      department: null,
      service: 'PUBLICO',
      vehicleClass: 'TOTAL',
      capacityBand: null,
      period: '2025',
      value: 152000,
      preliminary: true,
    },
    ...[
      ['BUS', 5176],
      ['MICROBUS', 6457],
      ['MINIBUS', 24441],
    ].map(([vehicleClass, value]) => ({
      ...source,
      dimension: 'SERVICE_CLASS',
      department: null,
      service: 'PUBLICO',
      vehicleClass,
      capacityBand: null,
      period: '2025',
      value,
      preliminary: true,
    })),
  ];
  const gnv = [
    {
      ...source,
      metric: 'CONVERSION',
      dimension: 'DEPARTMENT_CLASS',
      department: 'BOLIVIA',
      vehicleClass: 'TOTAL',
      period: '2025',
      value: 14871,
      preliminary: true,
    },
    {
      ...source,
      metric: 'CYLINDER_REQUALIFICATION',
      dimension: 'DEPARTMENT_CLASS',
      department: 'BOLIVIA',
      vehicleClass: 'TOTAL',
      period: '2025',
      value: 21729,
      preliminary: true,
    },
  ];
  const board = buildRoadTransportBoard({ fleet, gnv, fares: [] });
  assert.equal(board.summary.firstFleet, 443888);
  assert.equal(board.summary.latestFleet, 2672176);
  assert.equal(board.summary.publicPassengerFleet, 36074);
  assert.equal(board.summary.gnvConversions, 14871);
  assert.equal(board.summary.gnvRequalifications, 21729);
  assert.equal(Math.round(board.summary.growthPercent), 502);
  assert.equal(board.sources.length, 1);
});

test('bundled road transport fallback carries the complete official snapshot', async () => {
  const seed = JSON.parse(
    await readFile(
      new URL('../../src/data/road-transport.json', import.meta.url),
      'utf8',
    ),
  );
  const { roadTransportFromSeed } = await loadModule(
    new URL('../../src/lib/road-transport-fallback.ts', import.meta.url),
  );
  const data = roadTransportFromSeed(seed);

  assert.equal(data.fleet.length, 10_969);
  assert.equal(data.gnv.length, 2_137);
  assert.equal(data.fares.length, 60);
  assert.equal(
    data.fleet.find(
      (point) =>
        point.dimension === 'DEPARTMENT_SERVICE' &&
        point.department === 'BOLIVIA' &&
        point.service === 'TOTAL' &&
        point.period === '2025',
    )?.value,
    2_672_176,
  );
  assert.ok(data.fares.some((fare) => fare.regulation === 'ATT_0032_2025'));
  assert.ok(data.fleet.every((point) => point.sourceUrl.startsWith('https://')));
  assert.ok(data.gnv.every((point) => point.evidenceSha256.length === 64));
});

test('database readings win while an empty category is filled from the bundled snapshot', async () => {
  const { fillRoadTransportGaps } = await loadModule(
    new URL('../../src/lib/road-transport-fallback.ts', import.meta.url),
  );
  const database = { fleet: [{ period: 'db' }], gnv: [], fares: [] };
  const fallback = {
    fleet: [{ period: 'fallback' }],
    gnv: [{ period: 'gnv-fallback' }],
    fares: [{ regulation: 'ATT_0032_2025' }],
  };

  assert.deepEqual(fillRoadTransportGaps(database, fallback), {
    fleet: database.fleet,
    gnv: fallback.gnv,
    fares: fallback.fares,
  });
});

test('panorama gives every headline metric its responsive stat card', async () => {
  const source = await readFile(
    new URL('../../src/components/road-transport-explorer.tsx', import.meta.url),
    'utf8',
  );
  const panorama = source.slice(
    source.indexOf('function Panorama'),
    source.indexOf('function Departments'),
  );

  assert.equal((panorama.match(/<div className="stat">/gu) ?? []).length, 6);
});

test('pasajes es una página principal de transporte con ambos tarifarios oficiales', async () => {
  const transport = await readFile(
    new URL('../../src/components/transport-section.tsx', import.meta.url),
    'utf8',
  );
  const road = await readFile(
    new URL('../../src/components/road-transport-explorer.tsx', import.meta.url),
    'utf8',
  );
  const fares = await readFile(
    new URL('../../src/components/fares-explorer.tsx', import.meta.url),
    'utf8',
  );

  assert.match(transport, /labels=\{\['Automotor', 'Pasajes', 'Carreteras'/u);
  assert.match(transport, /<FaresSection \/>/u);
  assert.doesNotMatch(road, /'Pasajes'/u);
  assert.match(fares, /ATT_0032_2025/u);
  assert.match(fares, /ATT_0178_2013/u);
  assert.match(fares, /Pasajes interdepartamentales por ruta/u);
});

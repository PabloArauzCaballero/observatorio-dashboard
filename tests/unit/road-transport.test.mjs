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
      vehicleClass: null,
      period: '2025',
      value: 14871,
      preliminary: true,
    },
    {
      ...source,
      metric: 'CYLINDER_REQUALIFICATION',
      dimension: 'DEPARTMENT_CLASS',
      department: 'BOLIVIA',
      vehicleClass: null,
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

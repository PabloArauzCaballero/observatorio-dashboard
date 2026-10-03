/*
 * La lectura profunda del callejero: los indicadores, recortes y filas que se
 * descargan deben salir de los mismos registros que ve la tabla.
 *
 * Correr con: node --test tests/unit/street-analysis.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const analysis = await import('../../src/lib/street-analysis.ts').catch(() => ({}));

const rows = [
  {
    id: 'sol@El Alto',
    key: 'calle sol',
    name: 'Calle Sol',
    properName: 'Sol',
    type: 'Calle',
    departments: ['LA_PAZ'],
    departmentKm: { LA_PAZ: 2 },
    departmentPavedKm: { LA_PAZ: 1 },
    departmentWays: { LA_PAZ: 3 },
    routes: [],
    km: 2,
    paved: 1,
    sections: 3,
    city: 'El Alto',
    bounds: [-68.2, -16.6, -68.1, -16.5],
    scope: 'URBANA',
  },
  {
    id: 'sol@Sucre',
    key: 'calle sol',
    name: 'Calle Sol',
    properName: 'Sol',
    type: 'Calle',
    departments: ['CHUQUISACA'],
    departmentKm: { CHUQUISACA: 1 },
    departmentPavedKm: { CHUQUISACA: 1 },
    departmentWays: { CHUQUISACA: 2 },
    routes: [],
    km: 1,
    paved: 1,
    sections: 2,
    city: 'Sucre',
    bounds: [-65.3, -19.1, -65.2, -19.0],
    scope: 'URBANA',
  },
  {
    id: 'avenida-panamericana',
    key: 'avenida panamericana',
    name: 'Avenida Panamericana',
    properName: 'Panamericana',
    type: 'Avenida',
    departments: ['COCHABAMBA'],
    departmentKm: { COCHABAMBA: 3 },
    departmentPavedKm: { COCHABAMBA: 2.5 },
    departmentWays: { COCHABAMBA: 1 },
    routes: ['F-4'],
    km: 3,
    paved: 2.5,
    sections: 1,
    city: null,
    bounds: null,
    scope: 'RED_NACIONAL',
  },
];

test('resume diversidad, extensión y cobertura sin contar dos veces los nombres repetidos', () => {
  assert.equal(typeof analysis.summarizeStreetRows, 'function');
  assert.deepEqual(analysis.summarizeStreetRows(rows), {
    records: 3,
    uniqueNames: 2,
    repeatedNames: 1,
    cities: 2,
    departments: 3,
    ways: 6,
    urbanRecords: 2,
    nationalRecords: 1,
    typedRecords: 3,
    missingDepartmentRecords: 0,
    totalKm: 6,
    pavedKm: 4.5,
    remainderKm: 1.5,
    pavedShare: 75,
    medianKm: 2,
    longestKm: 3,
  });
});

test('combina filtros de ámbito, tipo, pavimento y longitud', () => {
  assert.equal(typeof analysis.filterStreetRows, 'function');
  assert.deepEqual(
    analysis
      .filterStreetRows(rows, {
        scope: 'URBANA',
        type: 'Calle',
        pavement: 'PARCIAL',
        length: 'LARGA',
      })
      .map((row) => row.id),
    ['sol@El Alto'],
  );
});

test('arma distribuciones por ciudad y por estado del pavimento', () => {
  assert.equal(typeof analysis.streetBreakdown, 'function');
  assert.deepEqual(analysis.streetBreakdown(rows, 'city'), [
    { key: 'El Alto', records: 1, km: 2, pavedKm: 1, ways: 3 },
    { key: 'Sucre', records: 1, km: 1, pavedKm: 1, ways: 2 },
    { key: 'Sin ciudad', records: 1, km: 3, pavedKm: 2.5, ways: 1 },
  ]);
  assert.deepEqual(analysis.streetBreakdown(rows, 'pavement'), [
    { key: 'Parcial', records: 2, km: 5, pavedKm: 3.5, ways: 4 },
    { key: 'Completa', records: 1, km: 1, pavedKm: 1, ways: 2 },
  ]);
});

test('reparte una calle interdepartamental con sus kilómetros reales', () => {
  assert.deepEqual(
    analysis.streetBreakdown([
      {
        ...rows[2],
        id: 'ruta-interdepartamental',
        departments: ['LA_PAZ', 'ORURO'],
        departmentKm: { LA_PAZ: 6, ORURO: 4 },
        departmentPavedKm: { LA_PAZ: 2, ORURO: 2 },
        departmentWays: { LA_PAZ: 3, ORURO: 2 },
        km: 10,
        paved: 4,
        sections: 5,
      },
    ], 'department'),
    [
      { key: 'LA_PAZ', records: 1, km: 6, pavedKm: 2, ways: 3 },
      { key: 'ORURO', records: 1, km: 4, pavedKm: 2, ways: 2 },
    ],
  );
});

test('la descarga incluye detalle territorial, geométrico y metodológico', () => {
  assert.equal(typeof analysis.streetRowsForDownload, 'function');
  const exported = analysis.streetRowsForDownload([rows[0]], (slug) => (slug === 'LA_PAZ' ? 'La Paz' : slug));
  assert.deepEqual(exported, [
    {
      nombre: 'Calle Sol',
      nombre_propio: 'Sol',
      tipo_via: 'Calle',
      ambito: 'Calle urbana',
      ciudad: 'El Alto',
      departamentos: 'La Paz',
      rutas: '',
      kilometros_totales: 2,
      kilometros_pavimentados_registrados: 1,
      kilometros_sin_desglose_de_superficie: 1,
      porcentaje_pavimentado_registrado: 50,
      estado_del_registro_de_pavimento: 'Parcial',
      categoria_de_longitud: 'Larga (1 a menos de 5 km)',
      tramos_o_vias: 3,
      longitud_minima: -68.2,
      latitud_minima: -16.6,
      longitud_maxima: -68.1,
      latitud_maxima: -16.5,
      fuente: 'OpenStreetMap contributors',
      licencia: 'ODbL 1.0',
    },
  ]);
});

test('el CSV conserva tildes en Excel y neutraliza fórmulas', () => {
  assert.equal(typeof analysis.streetCsv, 'function');
  assert.equal(
    analysis.streetCsv([{ nombre: '=1+1', ciudad: 'La Paz, Bolivia', kilometros: 1.25 }]),
    '\ufeffnombre,ciudad,kilometros\n\'=1+1,"La Paz, Bolivia",1.25\n',
  );
});

test('la descarga espera el índice urbano y declara si sólo queda la red nacional', () => {
  assert.equal(typeof analysis.streetExportAvailability, 'function');
  assert.deepEqual(analysis.streetExportAvailability('loading'), {
    enabled: false,
    completeness: 'CARGANDO',
  });
  assert.deepEqual(analysis.streetExportAvailability('ready'), {
    enabled: true,
    completeness: 'COMPLETA',
  });
  assert.deepEqual(analysis.streetExportAvailability('failed'), {
    enabled: true,
    completeness: 'SOLO_RED_NACIONAL',
  });
});

/*
 * Las reglas de la base aduanera que no necesitan base: qué grano contesta
 * cada vista, qué combinaciones no tienen respuesta y cómo cada vista suelta
 * su propio filtro sin soltar los niveles de arriba del árbol de producto.
 *
 * Correr con: node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { grainFor, parseQuery, withoutOwn } from '../../src/lib/trade-records-query.ts';
import { aggregateSql } from '../../src/lib/trade-records-sql.ts';
import { COUNTRY_ISO3, countryMap, sameOutline } from '../../src/lib/trade-countries.ts';
import { WORLD_POINTS, WORLD_SHAPES } from '../../src/lib/world-map.ts';

const query = (text) => parseQuery(new URLSearchParams(text));

test('las exportaciones se cruzan en cualquier combinación', () => {
  const q = query('flow=X&country=215&department=7&product=2608');
  for (const by of ['year', 'month', 'country', 'department', 'nandina', 'traditionalGroup']) {
    assert.deepEqual(grainFor(withoutOwn(q, by), by), { grain: 'X_DETAIL' });
  }
  assert.ok('unavailable' in grainFor(q, 'use'));
});

test('importaciones: país y departamento a la vez no tienen respuesta', () => {
  const q = query('flow=M&country=215&department=7');
  assert.ok('unavailable' in grainFor(withoutOwn(q, 'country'), 'country'));
  assert.ok('unavailable' in grainFor(withoutOwn(q, 'department'), 'department'));
  assert.deepEqual(grainFor(query('flow=M&country=215'), 'year'), { grain: 'M_DETAIL' });
  assert.deepEqual(grainFor(query('flow=M&department=7'), 'month'), { grain: 'M_MONTHLY' });
  // Un capítulo sirve en los dos granos; una partida más fina sólo en el anual.
  assert.deepEqual(grainFor(query('flow=M&product=27&department=7'), 'year'), { grain: 'M_MONTHLY' });
  assert.ok('unavailable' in grainFor(query('flow=M&product=2710&department=7'), 'year'));
});

test('el árbol de producto conserva los niveles de arriba', () => {
  const q = query('flow=X&product=26,2608&section=5');
  assert.deepEqual(withoutOwn(q, 'heading').filters.product, ['26']);
  assert.deepEqual(withoutOwn(q, 'heading').filters.section, ['5']);
  assert.deepEqual(withoutOwn(q, 'chapter').filters.product, []);
  assert.deepEqual(withoutOwn(q, 'section').filters.section, []);
  assert.deepEqual(withoutOwn(q, 'country').filters.product, ['26', '2608']);
});

test('la entrada del lector nunca entra al texto del SQL', () => {
  const q = query("flow=X&country=215';DROP TABLE x;--,105&product=26%25&from=2016&to=2025");
  assert.deepEqual(q.filters.country, ['105']);
  assert.deepEqual(q.filters.product, []);
  const sql = aggregateSql(q, 'country', 'X_DETAIL', 25);
  assert.ok(!sql.text.includes('105'));
  assert.ok(sql.values.some((value) => Array.isArray(value) && value.includes('105')));
});

test('un ránking de un solo año lee también el anterior, para la variación', () => {
  const sql = aggregateSql(query('flow=X&from=2025&to=2025'), 'country', 'X_DETAIL', 25);
  assert.ok(sql.values.includes(2024));
});

test('cada país del INE apunta a un contorno que el mapa sí dibuja', () => {
  const drawn = new Set([...WORLD_SHAPES, ...WORLD_POINTS].map((shape) => shape.iso3));
  const missing = Object.entries(COUNTRY_ISO3).filter(([, iso3]) => !drawn.has(iso3));
  assert.deepEqual(missing, []);
});

test('el mapa suma los códigos que comparten contorno y no pierde lo que no dibuja', () => {
  const item = (key, label, usd, kg = 0) => ({ key, label, usd, kg });
  const { rows, unplaced } = countryMap(
    [
      item('47', 'Antillas Holandesas', 60_000_000),
      item('570', 'Curazao', 5_000_000),
      item('190', 'Corea (Sur), República de', 9_000_000_000),
      item('990', 'Zona Franca de Bolivia', 184_000_000),
      item('215', 'Sin valor', 0),
    ],
    'usd',
  );
  const curacao = rows.find((row) => row.iso3 === 'CUW');
  assert.deepEqual(curacao?.members.sort(), ['47', '570']);
  assert.equal(curacao?.token, '47');
  assert.equal(curacao?.value, 65);
  assert.equal(rows.find((row) => row.iso3 === 'KOR')?.value, 9000);
  assert.deepEqual(unplaced.map((row) => row.label), ['Zona Franca de Bolivia']);
  assert.ok(!rows.some((row) => row.members.includes('215')));
  assert.deepEqual(sameOutline('570').sort(), ['47', '570']);
  assert.deepEqual(sameOutline('999'), ['999']);
});

test('el mapa en peso usa miles de toneladas', () => {
  const { rows } = countryMap([{ key: '190', label: 'Corea', usd: 1, kg: 2_500_000 }], 'kg');
  assert.equal(rows[0]?.value, 2.5);
});

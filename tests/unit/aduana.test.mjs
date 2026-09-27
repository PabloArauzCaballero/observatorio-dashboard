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

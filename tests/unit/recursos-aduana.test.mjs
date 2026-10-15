/*
 * Los recursos naturales de la base aduanera: qué partida es de qué recurso y
 * que cualquier elección cabe en el filtro de producto de la API.
 *
 * Correr con: node --test tests/unit/recursos-aduana.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  RESOURCES,
  byResource,
  growth,
  productFilter,
  resourceOf,
} from '../../src/lib/resources-customs.ts';
import { parseQuery } from '../../src/lib/trade-records-query.ts';

test('cada partida conocida cae en su recurso', () => {
  assert.equal(resourceOf('2608000000')?.id, 'zinc');
  assert.equal(resourceOf('2616100000')?.id, 'plata');
  assert.equal(resourceOf('2616901000')?.id, 'oro');
  assert.equal(resourceOf('7108120000')?.id, 'oro');
  assert.equal(resourceOf('8001100000')?.id, 'estano');
  assert.equal(resourceOf('2836910000')?.id, 'litio');
  assert.equal(resourceOf('2711210000')?.id, 'gas');
  assert.equal(resourceOf('2711190010')?.id, 'petroleo');
  assert.equal(resourceOf('2528001010')?.id, 'boratos');
  // Lo que el capítulo 26 trae sin recurso propio no se pierde.
  assert.equal(resourceOf('2604000000')?.id, 'otros');
  // La soya no es del subsuelo.
  assert.equal(resourceOf('1201900000'), undefined);
});

test('ningún código de un recurso es prefijo de otro recurso', () => {
  const all = RESOURCES.flatMap((resource) => resource.codes.map((code) => [resource.id, code]));
  for (const [id, code] of all) {
    for (const [other, longer] of all) {
      if (id !== other) assert.ok(!longer.startsWith(code), `${code} (${id}) tapa ${longer}`);
    }
  }
});

test('cualquier elección cabe en el tope de 40 códigos y la API la acepta entera', () => {
  const ids = RESOURCES.map((resource) => resource.id);
  for (let mask = 0; mask < 1 << ids.length; mask += 1) {
    const chosen = ids.filter((_, index) => mask & (1 << index));
    const codes = productFilter(chosen);
    assert.ok(codes.length <= 40, `${chosen.join(',')}: ${codes.length} códigos`);
    const parsed = parseQuery(new URLSearchParams({ product: codes.join(',') }));
    assert.deepEqual(parsed.filters.product, codes);
  }
});

test('todos los minerales juntos piden el capítulo 26 entero', () => {
  const codes = productFilter([]);
  assert.ok(codes.includes('26'));
  assert.ok(!codes.some((code) => code.startsWith('26') && code !== '26'));
  assert.ok(codes.includes('283691'));
  assert.deepEqual(productFilter(['litio']), ['283691', '282739']);
});

test('las partidas se suman por recurso y la variación no divide por cero', () => {
  const rows = [
    { key: '2608000000', usd: 10, kg: 5 },
    { key: '7901110000', usd: 2, kg: 1 },
    { key: '2836910000', usd: 3, kg: 1 },
    { key: null, usd: 9, kg: 9 },
  ];
  const totals = byResource(rows);
  assert.equal(totals[0]?.resource.id, 'zinc');
  assert.equal(totals[0]?.usd, 12);
  assert.equal(totals.length, 2);
  assert.equal(growth(110, 100)?.toFixed(1), '10.0');
  assert.equal(growth(5, 0), null);
});

/*
 * «Comparativos»: los pares con sentido existen en el tablero, y las cifras de un par —cambio,
 * correlación de variaciones, rezago— dicen lo que miden.
 *
 * Correr con: node --test tests/unit/exogenous-pairs.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PAIRS, availablePairs, readPair, sayTogether } from '../../src/lib/exogenous-pairs.ts';

test('cada par compara dos lecturas distintas y no se repite', () => {
  const keys = new Set();
  for (const pair of PAIRS) {
    assert.notEqual(pair.left, pair.right, pair.key);
    assert.ok(!keys.has(pair.key), pair.key);
    keys.add(pair.key);
    assert.match(pair.question, /\?$/u, pair.key);
  }
});

test('un par con una lectura que el tablero no tiene no se ofrece', () => {
  const codes = new Set(['EXO_CRUDE_BRENT', 'EXO_CRUDE_WTI', 'EXO_GOLD']);
  assert.deepEqual(
    availablePairs(codes).map((pair) => pair.key),
    ['crudos'],
  );
});

const month = (i) => `${2015 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

test('el cambio va del primer al último período con las dos lecturas', () => {
  const points = [
    { period: '2020', left: null, right: 50 },
    { period: '2021', left: 100, right: 100 },
    { period: '2022', left: 150, right: 90 },
    { period: '2023', left: 200, right: 80 },
  ];
  const read = readPair(points, 0);
  assert.equal(read.first, '2021');
  assert.equal(read.last, '2023');
  assert.equal(Math.round(read.leftChange), 100);
  assert.equal(Math.round(read.rightChange), -20);
});

test('se correlacionan variaciones, no niveles: dos tendencias sin relación dan casi nada', () => {
  // Las dos suben 1 % al mes, pero sus vaivenes son independientes.
  const noiseA = [3, -2, 1, -1, 2, -3, 1, 0, -1, 2, -2, 1];
  const noiseB = [1, 1, -2, 2, -1, -1, 3, -2, 0, -1, 2, -1];
  const points = Array.from({ length: 60 }, (_, i) => ({
    period: month(i),
    left: 100 * 1.01 ** i * (1 + noiseA[i % 12] / 100),
    right: 100 * 1.01 ** i * (1 + noiseB[(i * 5) % 12] / 100),
  }));
  const read = readPair(points, 6);
  assert.ok(read.together !== null && Math.abs(read.together) < 0.4, String(read.together));
});

test('una lectura que copia a la otra con tres meses de rezago se encuentra', () => {
  const shocks = Array.from(
    { length: 80 },
    (_, i) => Math.sin(i * 1.7) * 0.05 + Math.cos(i * 0.9) * 0.03,
  );
  const right = [100];
  for (let i = 1; i < 80; i += 1) right.push(right[i - 1] * Math.exp(shocks[i]));
  const points = right.map((value, i) => ({
    period: month(i),
    right: value,
    left: i >= 3 ? right[i - 3] * 2 : null,
  }));
  const read = readPair(points, 6);
  assert.equal(read.lag?.periods, 3);
  assert.ok(read.lag.correlation > 0.99);
});

test('la correlación en palabras', () => {
  assert.equal(sayTogether(0.82), 'relación fuerte');
  assert.equal(sayTogether(0.5), 'relación moderada');
  assert.equal(sayTogether(0.05), 'relación casi nula');
  assert.equal(sayTogether(-0.6), 'relación moderada, en sentido contrario');
  assert.equal(sayTogether(null), 'sin variaciones suficientes para medirlo');
});

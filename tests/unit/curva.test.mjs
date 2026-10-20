import test from 'node:test';
import assert from 'node:assert/strict';
import { trazoMonotono } from '../../src/lib/curva.ts';

/** Los puntos de control y de paso de un trazo «M … C … C …». */
const numeros = (d) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

/** Evalúa cada tramo cúbico en muchos puntos y devuelve las y alcanzadas por tramo. */
function tramos(d) {
  const v = numeros(d);
  const salida = [];
  let [x0, y0] = [v[0], v[1]];
  for (let i = 2; i + 5 < v.length + 0; i += 6) {
    const [ax, ay, bx, by, x1, y1] = v.slice(i, i + 6);
    const ys = [];
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const u = 1 - t;
      ys.push(u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y1);
    }
    salida.push({ desde: y0, hasta: y1, ys, ax, bx });
    [x0, y0] = [x1, y1];
  }
  return salida;
}

test('pasa por cada punto', () => {
  const puntos = [
    [0, 10],
    [10, 30],
    [20, 5],
    [30, 25],
    [40, 25],
  ];
  const d = trazoMonotono(puntos);
  assert.match(d, /^M0,10 C/);
  for (const [x, y] of puntos.slice(1)) assert.ok(d.includes(` ${x},${y}`), `falta ${x},${y}`);
});

test('entre dos datos nunca supera al mayor ni baja del menor', () => {
  const puntos = [
    [0, 1],
    [1, 9],
    [2, 2],
    [3, 8],
    [4, 8],
    [5, 3],
    [6, 7],
  ];
  for (const tramo of tramos(trazoMonotono(puntos))) {
    const alto = Math.max(tramo.desde, tramo.hasta) + 1e-6;
    const bajo = Math.min(tramo.desde, tramo.hasta) - 1e-6;
    for (const y of tramo.ys) assert.ok(y <= alto && y >= bajo, `${y} fuera de [${bajo}, ${alto}]`);
  }
});

test('un tramo plano queda plano', () => {
  const d = trazoMonotono([
    [0, 5],
    [1, 5],
    [2, 5],
  ]);
  for (const tramo of tramos(d))
    for (const y of tramo.ys) assert.equal(Math.round(y * 1e6) / 1e6, 5);
});

test('con uno o dos puntos no hay curva que trazar', () => {
  assert.equal(trazoMonotono([]), '');
  assert.equal(trazoMonotono([[1, 2]]), 'M1,2');
  assert.equal(
    trazoMonotono([
      [0, 0],
      [10, 4],
    ]),
    'M0,0 L10,4',
  );
});

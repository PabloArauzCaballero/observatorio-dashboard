/*
 * El eje vertical de los gráficos: marcas redondas y datos siempre dentro.
 *
 * Correr con: node --test tests/unit/chart-axis.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fittedDomain } from '../../src/lib/chart-axis.ts';

/** Las cinco marcas que Recharts dibuja: cuatro intervalos iguales entre los extremos. */
const marcas = ([bajo, alto]) =>
  Array.from({ length: 5 }, (_, i) => bajo + ((alto - bajo) * i) / 4);

/** ¿Es un número que una persona diría en voz alta? 1, 2, 2,5 o 5 por una potencia de diez. */
function esRedondo(n) {
  if (n === 0) return true;
  const mantisa = Math.abs(n) / 10 ** Math.floor(Math.log10(Math.abs(n)));
  return [1, 2, 2.5, 5, 10].some((m) => Math.abs(mantisa - m) < 1e-9);
}

const casos = {
  'la brecha, de −6 % a 157 %': [-6.1, 0, 12, 156.87],
  'el tipo de cambio, de 6,96 a 12,3': [6.96, 12.3, 9.2],
  'el nivel de una UFV': [3.1, 3.35229],
  'un conteo que arranca en cero': [0, 14, 2, 29],
  'una serie casi plana': [11.89, 11.9, 11.9, 11.91],
  'valores negativos': [-8.4, -2.1, -5],
  'una escala enorme': [1_200_000, 98_000_000],
};

for (const [nombre, valores] of Object.entries(casos)) {
  test(`fittedDomain: ${nombre}`, () => {
    const dominio = fittedDomain(valores);
    const [bajo, alto] = dominio;
    assert.ok(bajo <= Math.min(...valores), 'el mínimo cabe');
    assert.ok(alto >= Math.max(...valores), 'el máximo cabe');
    const paso = (alto - bajo) / 4;
    assert.ok(esRedondo(paso), `el paso ${paso} es redondo`);
    for (const marca of marcas(dominio)) {
      assert.ok(
        Math.abs(marca / paso - Math.round(marca / paso)) < 1e-6,
        `${marca} es múltiplo del paso`,
      );
    }
  });
}

test('fittedDomain: una serie que no baja de cero no dibuja marcas negativas', () => {
  const [bajo] = fittedDomain([0.2, 5, 9]);
  assert.equal(bajo, 0);
});

test('fittedDomain: una serie con el cero en medio lo muestra como marca', () => {
  const dominio = fittedDomain([-6.1, 0, 156.87]);
  assert.ok(
    marcas(dominio).some((m) => Math.abs(m) < 1e-9),
    'el cero es una marca',
  );
});

test('fittedDomain: el margen es poco; no inventa un espacio vacío enorme', () => {
  const [bajo, alto] = fittedDomain([6.96, 12.3]);
  // Un paso de 2 cubre 6–14; uno mayor desperdiciaría media escala.
  assert.ok(alto - bajo <= 10, `el dominio ${bajo}–${alto} no es más ancho de lo necesario`);
});

test('fittedDomain: sin datos o con una constante, no se rompe', () => {
  assert.deepEqual(fittedDomain([]), [0, 1]);
  assert.deepEqual(fittedDomain([Number.NaN]), [0, 1]);
  const [bajo, alto] = fittedDomain([7, 7, 7]);
  assert.ok(bajo < 7 && alto > 7);
});

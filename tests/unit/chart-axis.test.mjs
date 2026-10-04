/*
 * El eje vertical de los gráficos: marcas redondas y datos siempre dentro.
 *
 * Correr con: node --test tests/unit/chart-axis.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { axisDecimals, fittedDomain, tickCountOf } from '../../src/lib/chart-axis.ts';

/** Las marcas que Recharts dibuja: `tickCount` repartidas por igual entre los extremos. */
const marcas = (dominio) => {
  const n = tickCountOf(dominio) - 1;
  const [bajo, alto] = dominio;
  return Array.from({ length: n + 1 }, (_, i) => bajo + ((alto - bajo) * i) / n);
};

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
    const intervalos = tickCountOf(dominio) - 1;
    assert.ok(intervalos >= 4 && intervalos <= 5, `entre 4 y 5 intervalos, no ${intervalos}`);
    const paso = (alto - bajo) / intervalos;
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

test('fittedDomain: la brecha de −6 a 157 usa −50…200 y no un dominio que desperdicie la mitad', () => {
  const dominio = fittedDomain([-6.1, 156.87]);
  assert.deepEqual(dominio, [-50, 200]);
  assert.equal(tickCountOf(dominio), 6);
  assert.deepEqual(marcas(dominio), [-50, 0, 50, 100, 150, 200]);
});

test('fittedDomain: el margen es poco; no inventa un espacio vacío enorme', () => {
  const [bajo, alto] = fittedDomain([6.96, 12.3]);
  assert.ok(alto - bajo <= 10, `el dominio ${bajo}–${alto} no es más ancho de lo necesario`);
});

test('fittedDomain: sin datos o con una constante, no se rompe', () => {
  assert.deepEqual(fittedDomain([]), [0, 1]);
  assert.deepEqual(fittedDomain([Number.NaN]), [0, 1]);
  const [bajo, alto] = fittedDomain([7, 7, 7]);
  assert.ok(bajo < 7 && alto > 7);
});

test('fittedDomain: datos de 0 a 80 usan 0–100 y no un dominio que se estire hacia lo negativo', () => {
  assert.deepEqual(fittedDomain([0, 80]), [0, 100]);
  assert.deepEqual(fittedDomain([0.0001, 79]), [0, 100]);
});

test('tickCountOf: un dominio que no salió de fittedDomain usa las cinco marcas de siempre', () => {
  assert.equal(tickCountOf([0, 100]), 5);
  assert.equal(tickCountOf(undefined), 5);
});

test('axisDecimals: un paso de 0,05 pide dos decimales para que dos marcas no se lean igual', () => {
  // Los bancos: de 12,2 a 12,4, con una etiqueta de un decimal imprimía «12,3 · 12,3 · 12,2 · 12,2».
  const dominio = fittedDomain([12.2, 12.2, 12.3, 12.31]);
  assert.ok(axisDecimals(dominio, 1) >= 2, `decimales: ${axisDecimals(dominio, 1)}`);
  // Una escala holgada no sube los decimales que el gráfico ya pedía.
  assert.equal(axisDecimals(fittedDomain([0, 80]), 1), 1);
  assert.equal(axisDecimals(fittedDomain([0, 80]), 0), 0);
  // Fuera de fittedDomain se respeta lo pedido.
  assert.equal(axisDecimals([0, 100], 2), 2);
});

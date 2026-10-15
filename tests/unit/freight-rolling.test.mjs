/*
 * El flete implícito de la aduana en doce meses móviles: la razón de las sumas, no el promedio de
 * las razones, y sin puntos donde la ventana no tiene carga suficiente.
 *
 * Correr con: node --test tests/unit/freight-rolling.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rollingFreight } from '../../src/lib/freight-rolling.ts';

const year = (y, perMonth) =>
  Array.from({ length: 12 }, (_, i) => ({ year: y, month: i + 1, ...perMonth(i + 1) }));

test('un mes liviano y caro no dispara la línea', () => {
  // Once meses de 100 t a 100 US$/t y un mes de 0,2 t a 20.000 US$/t.
  const months = year(2020, (m) =>
    m === 6 ? { freightUsd: 4000, kg: 200 } : { freightUsd: 10000, kg: 100000 },
  );
  const out = rollingFreight(months);
  assert.equal(out.length, 1);
  assert.equal(out[0][0], '2020-12');
  // (110.000 + 4.000) / 1.100,2 t = 103,6 US$/t, no 20.000.
  assert.ok(out[0][1] > 100 && out[0][1] < 105, String(out[0][1]));
});

test('la ventana es de calendario y se corre mes a mes', () => {
  const months = [
    ...year(2020, () => ({ freightUsd: 10000, kg: 100000 })),
    ...year(2021, () => ({ freightUsd: 20000, kg: 100000 })),
  ];
  const out = rollingFreight(months);
  assert.equal(out.length, 13);
  assert.deepEqual(out[0], ['2020-12', 100]);
  assert.deepEqual(out.at(-1), ['2021-12', 200]);
  assert.deepEqual(out[6], ['2021-06', 150]);
});

test('sin carga suficiente o con huecos no hay punto', () => {
  // 12 meses de 5 t: 60 t en la ventana, por debajo del mínimo.
  assert.deepEqual(rollingFreight(year(2020, () => ({ freightUsd: 500, kg: 5000 }))), []);
  // Sólo 6 meses con datos en la ventana.
  const sparse = year(2020, () => ({ freightUsd: 10000, kg: 100000 })).filter((m) => m.month % 2);
  assert.deepEqual(rollingFreight(sparse), []);
});

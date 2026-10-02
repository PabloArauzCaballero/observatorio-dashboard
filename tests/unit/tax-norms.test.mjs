/*
 * Las cuentas de las calculadoras tributarias, hechas a mano.
 *
 * Los números de abajo se calcularon con lápiz a partir de la norma —13 % de IVA sobre el
 * precio con IVA incluido, 3 % de IT en cada venta— y no con la función: una calculadora
 * que se prueba contra sí misma solo prueba que no cambió.
 *
 * Correr con: node --test tests/unit/tax-norms.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  IVA_ON_NET,
  NORMS,
  TARIFF_SHIFT,
  domesticSale,
  importedGood,
  payroll,
} from '../../src/lib/tax-norms.ts';

test('el IVA de 13 % sobre el precio final equivale a 14,94 % del precio sin IVA', () => {
  assert.equal(Math.round(IVA_ON_NET * 10_000) / 100, 14.94);
});

test('una venta directa al consumidor: 13 de IVA y 3 de IT sobre 100', () => {
  const sale = domesticSale(100, 1);
  assert.equal(sale.taxTotal, 16);
  assert.equal(sale.kept, 84);
  assert.equal(sale.taxShare, 16);
});

test('el IT se acumula en cascada y el IVA no: tres ventas parejas, 100 al final', () => {
  const sale = domesticSale(100, 3);
  // Ventas de 33,33, 66,67 y 100: 200 en total, 3 % = 6.
  assert.equal(sale.taxes.find((slice) => slice.key === 'it')?.value, 6);
  assert.equal(sale.taxes.find((slice) => slice.key === 'iva')?.value, 13);
  assert.equal(sale.taxShare, 19);
});

test('un arancel de 10 % sobre CIF 100 paga 26,44 en la frontera', () => {
  const entry = importedGood(100, 10);
  assert.equal(entry.taxes.find((slice) => slice.key === 'ga')?.value, 10);
  // IVA: 13/87 de 110 = 16,4368…
  assert.equal(entry.taxes.find((slice) => slice.key === 'iva-imp')?.value, 16.44);
  assert.equal(entry.taxTotal, 26.44);
  assert.equal(entry.total, 126.44);
  assert.equal(entry.taxShare, 20.91);
});

test('con arancel 0 solo queda el IVA de importación', () => {
  const entry = importedGood(100, 0);
  assert.equal(entry.taxTotal, 14.94);
});

test('un sueldo de 10.000: aportes del trabajador, del empleador y costo total', () => {
  const pay = payroll(10_000);
  assert.equal(pay.workerPension, 1271);
  assert.equal(pay.solidarity, 0);
  assert.equal(pay.net, 8729);
  assert.equal(pay.employerPension, 721);
  assert.equal(pay.employerHealth, 1000);
  assert.equal(pay.employerCost, 11_721);
  assert.equal(pay.wedge, 25.53);
});

test('el aporte solidario escalonado cobra solo sobre lo que pasa de cada tope', () => {
  // (25.000 - 13.000) × 1,15 % = 138 y (30.000 - 25.000) × 5,74 % = 287.
  assert.equal(payroll(30_000).solidarity, 425);
  assert.equal(payroll(13_000).solidarity, 0);
});

test('la escala arancelaria baja cinco puntos en cada tramo', () => {
  for (const step of TARIFF_SHIFT) assert.equal(step.before - step.now, 5);
});

test('cada norma dice cómo se confirmó y de dónde sale', () => {
  const ids = new Set();
  for (const norm of NORMS) {
    assert.ok(!ids.has(norm.id), `${norm.id} está dos veces`);
    ids.add(norm.id);
    assert.ok(['primaria', 'secundaria', 'pendiente'].includes(norm.confirmation));
    assert.match(norm.source, /^https:\/\//u);
    assert.ok(norm.norm.length > 3 || norm.norm === '—');
  }
});

/*
 * Los planes, el tope gratuito y el formulario de Servicios.
 *
 * Correr con: node --test tests/unit/plans.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FREE_ROW_CAP,
  INQUIRY_PLANS,
  PLANS,
  bolivianos,
  cutOrder,
  freeCut,
  freeCutNote,
  miles,
} from '../../src/lib/plans.ts';
import { INQUIRY_PLAN_CODES, MIN_FILL_MS, checkInquiry } from '../../src/lib/inquiry.ts';

test('los precios se escriben de tres en tres, también con cuatro cifras', () => {
  assert.equal(miles(350), '350');
  assert.equal(miles(1400), '1.400');
  assert.equal(miles(14000), '14.000');
  assert.equal(miles(1000000), '1.000.000');
  assert.equal(bolivianos(1400), 'Bs 1.400');
});

test('el anual vale diez meses en los planes con precio fijo', () => {
  for (const plan of PLANS) {
    if (plan.mensual && plan.anual) assert.equal(plan.anual, plan.mensual * 10, plan.code);
  }
});

test('cada plan pagado da más que el anterior', () => {
  const pagos = PLANS.filter((plan) => plan.code !== 'gratis');
  for (let i = 1; i < pagos.length; i += 1) {
    assert.ok(pagos[i].apiPorMes > pagos[i - 1].apiPorMes, pagos[i].code);
    assert.ok(pagos[i].chatPorDia > pagos[i - 1].chatPorDia, pagos[i].code);
  }
});

test('freeCut no toca lo que cabe', () => {
  const filas = [1, 2, 3];
  assert.deepEqual(freeCut(filas), { filas: [1, 2, 3], total: 3, recortado: false });
});

test('freeCut corta por la cabeza o por la cola', () => {
  const filas = Array.from({ length: FREE_ROW_CAP + 20 }, (_, i) => i);
  const cabeza = freeCut(filas);
  assert.equal(cabeza.filas.length, FREE_ROW_CAP);
  assert.equal(cabeza.filas[0], 0);
  assert.equal(cabeza.total, FREE_ROW_CAP + 20);
  assert.equal(cabeza.recortado, true);
  const cola = freeCut(filas, 'cola');
  assert.equal(cola.filas[0], 20);
  assert.equal(cola.filas.at(-1), FREE_ROW_CAP + 19);
});

test('una serie fechada de vieja a nueva se corta por la cola', () => {
  assert.equal(cutOrder([['2004-01-01', 1], ['2026-10-01', 2]]), 'cola');
  assert.equal(cutOrder([[2004, 1], [2026, 2]]), 'cola');
  // Ya ordenada de nueva a vieja, lo reciente está en la cabeza.
  assert.equal(cutOrder([['2026-10-01', 2], ['2004-01-01', 1]]), 'cabeza');
  // Una tabla por importancia: la cabeza.
  assert.equal(cutOrder([['YPFB', 10], ['Tigo', 5]]), 'cabeza');
  assert.equal(cutOrder([]), 'cabeza');
});

test('el aviso de un archivo recortado dice cuánto y dónde está el resto', () => {
  const nota = freeCutNote(72124);
  assert.match(nota, /500 de 72\.124 filas/);
  assert.match(nota, /datosbolivia\.com\/servicios/);
});

test('el formulario y los planes ofrecen los mismos pedidos', () => {
  assert.deepEqual([...INQUIRY_PLAN_CODES], INQUIRY_PLANS.map((plan) => plan.code));
});

const AHORA = 1_800_000_000_000;
const bueno = {
  requestId: '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b',
  abierto: AHORA - 20_000,
  sitio_web: '',
  fullName: '  Ana Quispe ',
  email: 'Ana@Ejemplo.BO',
  organization: '',
  phone: '+591 70000000',
  planCode: 'profesional',
  message: 'Necesitamos las series del dólar por API para un reporte semanal.',
  sourceRoute: '/servicios?plan=profesional',
};

test('un pedido correcto sale limpio', () => {
  const check = checkInquiry(bueno, AHORA);
  assert.equal(check.ok, true);
  assert.equal(check.value.fullName, 'Ana Quispe');
  assert.equal(check.value.email, 'ana@ejemplo.bo');
  assert.equal(check.value.organization, null);
  assert.equal(check.value.planCode, 'profesional');
});

test('la trampa y el envío instantáneo se tratan como robot', () => {
  assert.equal(checkInquiry({ ...bueno, sitio_web: 'http://spam' }, AHORA).spam, true);
  assert.equal(checkInquiry({ ...bueno, abierto: AHORA - MIN_FILL_MS + 1 }, AHORA).spam, true);
  assert.equal(checkInquiry({ ...bueno, abierto: undefined }, AHORA).spam, true);
});

test('cada campo inválido señala su campo', () => {
  const campo = (cambio) => checkInquiry({ ...bueno, ...cambio }, AHORA);
  assert.equal(campo({ fullName: 'A' }).field, 'fullName');
  assert.equal(campo({ email: 'no-es-correo' }).field, 'email');
  assert.equal(campo({ planCode: 'premium' }).field, 'planCode');
  assert.equal(campo({ message: 'corto' }).field, 'message');
  assert.equal(campo({ phone: '1'.repeat(41) }).field, 'phone');
  assert.equal(campo({ requestId: 'no-uuid' }).ok, false);
  assert.equal(checkInquiry(null, AHORA).ok, false);
});

test('una ruta de origen ajena no se acepta tal cual', () => {
  assert.equal(checkInquiry({ ...bueno, sourceRoute: 'https://otro.sitio' }, AHORA).value.sourceRoute, '/servicios');
});

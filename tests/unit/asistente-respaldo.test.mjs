/*
 * El respaldo del asistente: la cadena de proveedores, el corte de los caídos,
 * el estado del saldo y la respuesta sin IA.
 *
 * Correr con: node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GEMINI_URL, Interruptor, OPENROUTER_URL, armarCadena, clasificarSaldo, pausaPorFallo } from '../../src/lib/asistente/cadena.ts';
import { hechos, respuestaSinIa } from '../../src/lib/asistente/sin-ia.ts';

test('la cadena lleva solo los proveedores con clave, en orden', () => {
  assert.deepEqual(armarCadena({}), [], 'sin claves no hay cadena');
  const todo = armarCadena({ OPENROUTER_API_KEY: 'or', GEMINI_API_KEY: 'g', ASISTENTE_MODELO_GRATIS: 'algo/modelo:free' });
  assert.deepEqual(todo.map((e) => e.nombre), ['openrouter', 'gemini', 'openrouter-gratis']);
  assert.equal(todo[0].url, OPENROUTER_URL);
  assert.equal(todo[0].modelo, 'google/gemini-3.1-flash-lite-preview');
  assert.equal(todo[1].url, GEMINI_URL);
  assert.equal(todo[1].modelo, 'gemini-3.1-flash-lite-preview', 'Gemini directo usa el id sin «google/»');
  assert.equal(todo[1].clave, 'g');
  assert.deepEqual(todo[2].extra, {}, 'el gratuito no recibe opciones de Gemini');
  assert.deepEqual(armarCadena({ GEMINI_API_KEY: 'g' }).map((e) => e.nombre), ['gemini'], 'Gemini solo también sirve');
  assert.deepEqual(armarCadena({ ASISTENTE_MODELO_GRATIS: 'x:free' }), [], 'el gratuito necesita la clave de OpenRouter');
  assert.equal(armarCadena({ GEMINI_API_KEY: 'g', ASISTENTE_MODELO_GEMINI: 'gemini-otro' })[0].modelo, 'gemini-otro');
});

test('un proveedor sin crédito se saltea diez minutos; un error suelto no castiga', () => {
  assert.equal(pausaPorFallo(402), 600_000);
  assert.equal(pausaPorFallo(401), 600_000);
  assert.equal(pausaPorFallo(429), 60_000);
  assert.equal(pausaPorFallo(500), 0);
  assert.equal(pausaPorFallo(null), 0);

  const cadena = armarCadena({ OPENROUTER_API_KEY: 'or', GEMINI_API_KEY: 'g' });
  const i = new Interruptor();
  i.fallo('openrouter', 402, 0);
  assert.deepEqual(i.aProbar(cadena, 1_000).map((e) => e.nombre), ['gemini']);
  assert.deepEqual(i.aProbar(cadena, 600_001).map((e) => e.nombre), ['openrouter', 'gemini'], 'pasada la pausa vuelve');
  i.fallo('gemini', 429, 0);
  assert.equal(i.aProbar(cadena, 1_000).length, 2, 'si todos están en pausa se prueban igual');
  i.exito('openrouter');
  assert.equal(i.saltear('openrouter', 1_000), false);
});

test('el saldo se dice como estado, nunca como monto', () => {
  assert.equal(clasificarSaldo(null, 2), 'desconocido');
  assert.equal(clasificarSaldo(-0.19, 2), 'agotado', 'la cuenta del 27-sep: nunca tuvo crédito');
  assert.equal(clasificarSaldo(0, 2), 'agotado');
  assert.equal(clasificarSaldo(1.5, 2), 'bajo');
  assert.equal(clasificarSaldo(9.8, 2), 'ok');
});

const DOLAR = [
  'Datos al 2026-09-26 (se recogen tres veces al día).',
  '- Dólar oficial (BCB): 12,05 Bs por dólar, el 2026-09-26.',
  '- Dólar paralelo, punto medio entre compra y venta: 11,92 Bs por dólar, el 2026-09-26.',
  '  · tramo fijo del 2024-07-01 al 2026-06-27 (706 días), de 6,96 a 6,96',
  '- Brecha cambiaria (paralelo sobre oficial): -1,04 % el 2026-09-26.',
].join('\n');

test('sin IA se muestran los hechos de los paquetes, no sus notas', () => {
  assert.deepEqual(hechos(DOLAR).length, 3, 'solo las líneas «- », sin la cabecera ni las sublíneas');
  assert.equal(hechos('- Inflación [vigilar]: sube. Cifra: 15,8 % (UFV). Regla: más de 10 % es adverso')[0], '- Inflación [vigilar]: sube. Cifra: 15,8 % (UFV).');
  const r = respuestaSinIa([{ id: 'DOLAR', texto: DOLAR, leido: true }, { id: 'MACRO', texto: 'x', leido: false }], 'fallo');
  assert.match(r, /no puedo redactar la respuesta con IA/);
  assert.match(r, /\*\*Dólar\*\*/);
  assert.match(r, /12,05 Bs por dólar/);
  assert.doesNotMatch(r, /Indicadores anuales/, 'un paquete sin leer no aparece');
  assert.match(respuestaSinIa([], 'presupuesto'), /No encontré cifras/);
  assert.match(respuestaSinIa([{ id: 'DOLAR', texto: DOLAR, leido: true }], 'presupuesto'), /límite de uso de IA por hoy/);
});

test('sin IA la respuesta no se hace interminable', () => {
  const largo = Array.from({ length: 30 }, (_, i) => `- hecho ${i}`).join('\n');
  const r = respuestaSinIa(['HOY', 'DOLAR', 'MACRO', 'PRENSA'].map((id) => ({ id, texto: largo, leido: true })), 'fallo');
  assert.equal(r.split('\n').filter((l) => l.startsWith('- ')).length, 12);
});

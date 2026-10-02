/*
 * La clave con que se busca y se agrupa una calle: sin tildes, sin mayúsculas y
 * sin signos, y separando el tipo de vía del nombre propio.
 *
 * Correr con: node --test tests/unit/street-names.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { foldName, splitStreetType, streetKey } from '../../src/lib/street-names.ts';

test('foldName ignora tildes, mayúsculas y signos', () => {
  assert.equal(foldName('Avenida Circunvalación'), 'avenida circunvalacion');
  assert.equal(foldName('  Calle  6 DE Agosto. '), 'calle 6 de agosto');
  assert.equal(foldName("Calle O'Higgins"), 'calle o higgins');
});

test('quien escribe sin tildes encuentra el nombre con tildes', () => {
  assert.ok(foldName('Avenida Circunvalación').includes(foldName('circunvalacion')));
  assert.ok(foldName('Calle Potosí').includes(foldName('POTOSI')));
});

test('splitStreetType separa el tipo del nombre propio', () => {
  assert.deepEqual(splitStreetType('Avenida Blanco Galindo'), { type: 'Avenida', proper: 'Blanco Galindo' });
  assert.deepEqual(splitStreetType('Callejón Los Pinos'), { type: 'Callejón', proper: 'Los Pinos' });
  assert.deepEqual(splitStreetType('Circunvalación'), { type: null, proper: 'Circunvalación' });
  assert.deepEqual(splitStreetType('Avenida'), { type: null, proper: 'Avenida' });
  assert.deepEqual(splitStreetType('RN10: Guabirá-Colonia Pirai'), { type: null, proper: 'RN10: Guabirá-Colonia Pirai' });
});

test('streetKey agrupa las vías de una misma calle y deja fuera las sin nombre', () => {
  assert.equal(streetKey('Avenida Panamericana'), streetKey('AVENIDA PANAMERICANA'));
  assert.equal(streetKey(null), null);
  assert.equal(streetKey('  '), null);
});

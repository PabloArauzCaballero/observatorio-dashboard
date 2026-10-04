/*
 * El mapa del tablero: sus anclas y el destino de una dirección.
 *
 * Correr con: node --test tests/unit/site-map.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { slug as slugDeEnlaces } from '../../src/lib/enlace-tablero.ts';
import { SITE, destinoDe, idDePagina, idDeSeccion, slug } from '../../src/lib/site-map.ts';

test('el nombre de un ancla es el mismo que el de la dirección', () => {
  for (const seccion of SITE) {
    assert.equal(slug(seccion.label), slugDeEnlaces(seccion.label));
    for (const pagina of seccion.pages)
      assert.equal(slug(pagina.label), slugDeEnlaces(pagina.label));
  }
});

test('las anclas son únicas y no chocan entre secciones y páginas', () => {
  const ids = SITE.flatMap((s) => [
    idDeSeccion(s.label),
    ...s.pages.map((p) => idDePagina(s.label, p.label)),
  ]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(idDeSeccion('Tipo de cambio'), 'tipo-de-cambio');
  assert.equal(
    idDePagina('Macroeconomía', 'Detalle aduanero (INE)'),
    'macroeconomia--detalle-aduanero-ine',
  );
});

test('el tablero enumera las secciones en el mismo orden que la vista', () => {
  assert.deepEqual(
    SITE.map((s) => s.label),
    [
      'Hoy',
      'Tipo de cambio',
      'Macroeconomía',
      'Empresas',
      'Personalidades',
      'Ciudades',
      'Transporte',
      'Prensa',
      'Método',
    ],
  );
});

test('una dirección ?pestana=&pagina= lleva a la página, a la sección o a ninguna parte', () => {
  assert.deepEqual(destinoDe('macroeconomia', 'variables-exogenas'), {
    id: 'macroeconomia--variables-exogenas',
    seccion: 'Macroeconomía',
    pagina: 'Variables exógenas',
  });
  assert.deepEqual(destinoDe('Transporte', null), { id: 'transporte', seccion: 'Transporte' });
  // Una página que la sección no tiene se ignora y se va a la sección.
  assert.deepEqual(destinoDe('prensa', 'inventada'), { id: 'prensa', seccion: 'Prensa' });
  assert.equal(destinoDe('inventada', null), null);
  assert.equal(destinoDe(null, 'cobertura'), null);
});

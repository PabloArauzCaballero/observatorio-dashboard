/*
 * Los enlaces y las tablas de las respuestas del asistente.
 *
 * Correr con: node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { DESTINO_DE_PAQUETE, PESTANAS, enlacesPara } from '../../src/lib/asistente/guia.ts';
import { MAX_FILAS, aCsv, aMarkdown, nombreDeArchivo, tabla } from '../../src/lib/asistente/tabla.ts';
import { hrefDe, indicePorSlug, slug } from '../../src/lib/enlace-tablero.ts';

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('el nombre en la dirección sale del rótulo, sin tildes ni signos', () => {
  assert.equal(slug('Macroeconomía'), 'macroeconomia');
  assert.equal(slug('Bolsa de valores (BBV)'), 'bolsa-de-valores-bbv');
  assert.equal(slug('Variables exógenas'), 'variables-exogenas');
  assert.equal(hrefDe({ pestana: 'Macroeconomía', pagina: 'Variables exógenas' }), '/?pestana=macroeconomia&pagina=variables-exogenas');
  assert.equal(hrefDe({ pestana: 'Tipo de cambio' }), '/?pestana=tipo-de-cambio');
});

test('una dirección escrita a mano también encuentra su pestaña', () => {
  const rotulos = ['Hoy', 'Tipo de cambio', 'Macroeconomía'];
  assert.equal(indicePorSlug(rotulos, 'macroeconomia'), 2);
  assert.equal(indicePorSlug(rotulos, 'Macroeconomía'), 2);
  assert.equal(indicePorSlug(rotulos, 'TIPO-DE-CAMBIO'), 1);
  assert.equal(indicePorSlug(rotulos, 'inventada'), -1);
  assert.equal(indicePorSlug(rotulos, null), -1);
});

test('cada destino del asistente nombra una pestaña y una página que existen en el tablero', () => {
  const pagina = leer('src/app/page.tsx');
  const secciones = ['src/components/macro-section.tsx', 'src/components/filings-section.tsx', 'src/components/press-section.tsx'].map(leer).join('\n');
  for (const p of PESTANAS) assert.ok(pagina.includes(`'${p}'`), `la pestaña «${p}» está en page.tsx`);
  for (const [paquete, destino] of Object.entries(DESTINO_DE_PAQUETE)) {
    assert.ok(PESTANAS.includes(destino.pestana), paquete);
    if (destino.pagina) assert.ok(secciones.includes(`'${destino.pagina}'`), `la página «${destino.pagina}» de ${paquete} existe`);
  }
  // Solo las barras de primer nivel siguen la dirección; la anidada de Comercio exterior no.
  assert.match(leer('src/components/macro-section.tsx'), /<SubTabs enlace/);
  assert.doesNotMatch(leer('src/components/trade-explorer.tsx'), /<SubTabs enlace/);
});

test('los enlaces no se repiten y siguen el orden del tablero', () => {
  const enlaces = enlacesPara(['PRENSA', 'MACRO', 'ENERGIA', 'DOLAR', 'EXOGENAS']);
  assert.deepEqual(enlaces.map((e) => e.etiqueta), ['Tipo de cambio', 'Macroeconomía › Series de Bolivia', 'Macroeconomía › Variables exógenas']);
  assert.deepEqual(enlacesPara(['GUIA']), []);
});

test('la tabla recorta, completa celdas y dice el recorte en el título', () => {
  assert.equal(tabla('x', 'Vacía', ['a'], [[null], ['']], 'F'), undefined, 'sin filas con datos no hay tabla');
  const t = tabla('x', 'Larga', ['a', 'b'], Array.from({ length: MAX_FILAS + 5 }, (_, i) => [i]), 'F');
  assert.equal(t.filas.length, MAX_FILAS);
  assert.match(t.titulo, new RegExp(`primeras ${MAX_FILAS} de ${MAX_FILAS + 5}`));
  assert.deepEqual(t.filas[0], [0, null], 'la celda que falta queda vacía');
});

test('el CSV se abre bien en Excel y no ejecuta fórmulas', () => {
  const t = tabla('dolar', 'Dólar', ['Fecha', 'Titular', 'Valor'], [['2026-09-27', '=HYPERLINK("x")', -1.5], ['2026-09-26', 'Sube, dice "La Razón"', 9.85]], 'BCB');
  const csv = aCsv(t, '2026-09-27');
  assert.ok(csv.startsWith('\uFEFF'), 'marca UTF-8 para Excel');
  const lineas = csv.slice(1).trim().split('\n');
  assert.equal(lineas[0], 'Fecha,Titular,Valor,fuente,consultado');
  assert.equal(lineas[1], `2026-09-27,"'=HYPERLINK(""x"")",-1.5,BCB,2026-09-27`);
  assert.equal(lineas[2], '2026-09-26,"Sube, dice ""La Razón""",9.85,BCB,2026-09-27');
  assert.match(aMarkdown(t), /\| Fecha \| Titular \| Valor \|/);
  assert.equal(nombreDeArchivo('depto-SANTA_CRUZ', '2026-09-27', 'csv'), 'observatorio-depto-santa-cruz-2026-09-27.csv');
});

test('la vista previa alinea decimales por columna y no pone punto en los años', async () => {
  const { celdaLegible, decimalesPorColumna } = await import('../../src/lib/asistente/tabla.ts');
  const t = tabla('d', 'D', ['Fecha', 'Oficial', 'Año', 'Kilómetros'], [['2026-09-19', 11, 2023, 12345], ['2026-09-18', 10.01, 2024, 980]], 'F');
  const d = decimalesPorColumna(t);
  assert.deepEqual(d, [0, 2, 0, 0]);
  assert.equal(celdaLegible(11, d[1]), '11,00');
  assert.equal(celdaLegible(10.01, d[1]), '10,01');
  assert.equal(celdaLegible(2023, d[2]), '2023');
  assert.equal(celdaLegible(12345, d[3]), '12.345');
  assert.equal(celdaLegible(null, 0), '—');
  assert.equal(celdaLegible('texto', 0), 'texto');
});

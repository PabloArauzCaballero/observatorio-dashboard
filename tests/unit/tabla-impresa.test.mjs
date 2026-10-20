import test from 'node:test';
import assert from 'node:assert/strict';
import {
  celdaImpresa,
  cifra,
  columnaNumerica,
  direccionCorta,
  fecha,
  pideFichas,
  tablaImpresa,
} from '../../src/lib/export/tabla-impresa.ts';

test('las cifras se redondean para leer, sin perder lo que importa', () => {
  assert.equal(cifra(11.8135), '11,81');
  assert.equal(cifra(-0.0065), '-0,0065');
  assert.equal(cifra(1.0012), '1,001');
  assert.equal(cifra(81716.89), '81.717');
  assert.equal(cifra(2485), (2485).toLocaleString('es-BO'));
  assert.equal(cifra(7), '7');
});

test('las fechas de máquina pasan a letra', () => {
  assert.equal(fecha('2026-10-19'), '19-oct-2026');
  assert.equal(fecha('2020-01-01'), '1-ene-2020');
  assert.equal(fecha('2025'), '2025');
  assert.equal(fecha('al 2026-10-19'), 'al 2026-10-19');
});

test('una dirección larga queda en sitio y último tramo, con el enlace entero', () => {
  const url = 'https://api.worldbank.org/v2/country/BOL/indicator/FP.CPI.TOTL.ZG?format=json';
  assert.equal(direccionCorta(url), 'api.worldbank.org/…/FP.CPI.TOTL.ZG');
  assert.equal(direccionCorta('https://www.bcb.gob.bo/'), 'bcb.gob.bo');
  const html = celdaImpresa(url);
  assert.match(html, /^<a href="https:\/\/api\.worldbank\.org\/v2\/country/);
  assert.match(html, />api\.worldbank\.org\/…\/FP\.CPI\.TOTL\.ZG<\/a>$/);
});

test('una columna es de cifras aunque las cifras vengan escritas o falte alguna', () => {
  const filas = [
    ['Oficial', '11,69', 'Bs/USD'],
    ['Brecha', '+1,18 %', '—'],
    ['Máximo', null, '—'],
  ];
  assert.equal(columnaNumerica(filas, 1), true);
  assert.equal(columnaNumerica(filas, 0), false);
  assert.equal(columnaNumerica(filas, 2), false);
});

test('la tabla alinea a la derecha encabezado y celdas de las columnas de cifras', () => {
  const html = tablaImpresa(undefined, ['Cotización', 'Valor (Bs por USD)'], [['USDT', 11.8135]]);
  assert.match(html, /<th class="num">Valor \(Bs por USD\)<\/th>/);
  assert.match(html, /<td class="num">11,81<\/td>/);
  assert.match(html, /class="datos corta"/);
});

test('muchas columnas con prosa pasan a una ficha por fila', () => {
  const columnas = [
    'Lectura',
    'Veredicto',
    'Cifra',
    'Unidad',
    'Qué mide',
    'Periodo',
    'Regla aplicada',
  ];
  const regla = 'Umbrales: hasta 2 % favorable, hasta 10 % vigilar, por encima adverso. '.repeat(2);
  const filas = [['Situación del dólar', 'Favorable', 1.18, '%', 'Brecha', '2026-10-19', regla]];
  assert.equal(pideFichas(columnas, filas), true);
  const html = tablaImpresa(undefined, columnas, filas);
  assert.match(html, /<article class="ficha"><h4>Situación del dólar<\/h4>/);
  assert.match(html, /<div class="par ancho"><dt>Regla aplicada<\/dt>/);
  assert.ok(html.includes('<dd><span class="nw">19-oct-2026</span></dd>'));
  assert.equal(pideFichas(columnas.slice(0, 5), filas), false);
});

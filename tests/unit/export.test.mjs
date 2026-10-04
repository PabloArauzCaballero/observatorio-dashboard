/*
 * El motor de descargas: CSV, zip y libro de Excel, sin navegador ni servidor.
 *
 * Correr con: node --test tests/unit/export.test.mjs
 */
import assert from 'node:assert/strict';
import { crc32 as crcDeNode } from 'node:zlib';
import { test } from 'node:test';

import { aCsv, campoCsv, filasDeSeries, nombreDeArchivo } from '../../src/lib/export/datos.ts';
import {
  aXlsx,
  columnaExcel,
  crc32,
  nombreDeHoja,
  zipStore,
} from '../../src/lib/export/xlsx.ts';

const datos = {
  id: 'dolar-paralelo',
  titulo: 'Dólar paralelo (Bs por USD)',
  unidad: 'Bs por USD',
  columnas: ['Fecha', 'Paralelo', 'Oficial'],
  filas: [
    ['2026-10-01', 11.95, 6.96],
    ['2026-10-02', 12.02, null],
    ['2026-10-03', 12.1, 6.96],
  ],
  fuente: 'BCB · Binance P2P',
};

/** Lee un zip de `store` por su directorio central, como lo haría Excel. */
function leerZip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fin = bytes.length - 22;
  assert.equal(v.getUint32(fin, true), 0x06054b50, 'firma del fin de directorio');
  const n = v.getUint16(fin + 10, true);
  let cursor = v.getUint32(fin + 16, true);
  const archivos = {};
  for (let i = 0; i < n; i += 1) {
    assert.equal(v.getUint32(cursor, true), 0x02014b50, 'firma de entrada central');
    const crc = v.getUint32(cursor + 16, true);
    const tamano = v.getUint32(cursor + 24, true);
    const largoNombre = v.getUint16(cursor + 28, true);
    const local = v.getUint32(cursor + 42, true);
    const nombre = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + largoNombre));
    assert.equal(v.getUint32(local, true), 0x04034b50, 'firma de entrada local');
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const contenido = bytes.subarray(inicio, inicio + tamano);
    assert.equal(crcDeNode(contenido), crc, `CRC de ${nombre}`);
    archivos[nombre] = new TextDecoder().decode(contenido);
    cursor += 46 + largoNombre;
  }
  return archivos;
}

test('el CRC-32 coincide con el de Node en entradas de todo tipo', () => {
  const enc = new TextEncoder();
  for (const texto of ['', 'a', '123456789', 'Dólar paralelo', 'x'.repeat(70_000)]) {
    const bytes = enc.encode(texto);
    assert.equal(crc32(bytes), crcDeNode(bytes), JSON.stringify(texto.slice(0, 12)));
  }
});

test('zipStore deja un zip que se lee entero, con nombres en UTF-8', () => {
  const enc = new TextEncoder();
  const zip = zipStore(
    [
      { nombre: 'a.txt', datos: enc.encode('hola') },
      { nombre: 'carpeta/ñandú.xml', datos: enc.encode('<x/>') },
    ],
    new Date('2026-10-03T12:00:00Z'),
  );
  const leidos = leerZip(zip);
  assert.deepEqual(Object.keys(leidos), ['a.txt', 'carpeta/ñandú.xml']);
  assert.equal(leidos['a.txt'], 'hola');
});

test('el libro lleva Datos y Fuente, con números como números y cabecera en negrita', () => {
  const zip = aXlsx(datos, { consultado: '2026-10-03', ahora: new Date('2026-10-03T12:00:00Z') });
  const f = leerZip(zip);
  for (const parte of [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
    'xl/worksheets/sheet1.xml',
    'xl/worksheets/sheet2.xml',
  ]) {
    assert.ok(f[parte], `falta ${parte}`);
  }
  assert.match(f['xl/workbook.xml'], /name="Datos"[\s\S]*name="Fuente"/);

  const hoja = f['xl/worksheets/sheet1.xml'];
  assert.match(hoja, /<c r="B2"><v>11\.95<\/v><\/c>/, 'un número se guarda como número');
  assert.match(hoja, /<c r="A1" s="1" t="inlineStr">/, 'la cabecera lleva el estilo en negrita');
  assert.ok(!hoja.includes('r="C3"'), 'un dato que falta queda vacío, no en cero');
  assert.match(hoja, /state="frozen"/, 'la cabecera queda fija');

  const fuente = f['xl/worksheets/sheet2.xml'];
  assert.match(fuente, /BCB · Binance P2P/);
  assert.match(fuente, /2026-10-03/);
  assert.match(fuente, /Bs por USD/);
});

test('el libro escapa XML y descarta caracteres de control', () => {
  const zip = aXlsx(
    { ...datos, filas: [['a & <b>', 1, 2], ['bell\u0007', 3, 4]] },
    { consultado: '2026-10-03' },
  );
  const hoja = leerZip(zip)['xl/worksheets/sheet1.xml'];
  assert.match(hoja, /a &amp; &lt;b&gt;/);
  assert.ok(!hoja.includes('\u0007'));
});

test('columnaExcel y nombreDeHoja siguen las reglas de Excel', () => {
  assert.deepEqual([0, 25, 26, 27, 701, 702].map(columnaExcel), ['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  assert.equal(nombreDeHoja('a/b:c*d?'), 'a b c d');
  assert.equal(nombreDeHoja('x'.repeat(40)).length, 31);
  assert.equal(nombreDeHoja('///'), 'Hoja');
});

test('aCsv: BOM, cabecera con fuente y consulta, y vacío donde no hay dato', () => {
  const csv = aCsv(datos, '2026-10-03');
  assert.ok(csv.startsWith('﻿Fecha,Paralelo,Oficial,fuente,consultado\r\n'));
  const lineas = csv.trimEnd().split('\r\n');
  assert.equal(lineas.length, 4);
  assert.equal(lineas[2], '2026-10-02,12.02,,BCB · Binance P2P,2026-10-03');
});

test('campoCsv entrecomilla lo que lo pide y neutraliza fórmulas', () => {
  assert.equal(campoCsv('a,b'), '"a,b"');
  assert.equal(campoCsv('dice "hola"'), '"dice ""hola"""');
  assert.equal(campoCsv('línea\nnueva'), '"línea\nnueva"');
  assert.equal(campoCsv('=SUMA(A1:A9)'), "'=SUMA(A1:A9)");
  assert.equal(campoCsv('@usuario'), "'@usuario");
  // Un número negativo no es una fórmula.
  assert.equal(campoCsv(-4.5), '-4.5');
  assert.equal(campoCsv('-4.5'), '-4.5');
  assert.equal(campoCsv(null), '');
});

test('nombreDeArchivo: sin espacios ni tildes, con fecha y extensión', () => {
  assert.equal(
    nombreDeArchivo('Dólar paralelo (Bs por USD)', '2026-10-03', 'csv'),
    'observatorio-dolar-paralelo-bs-por-usd-2026-10-03.csv',
  );
  assert.equal(nombreDeArchivo('///', '2026-10-03', 'xlsx'), 'observatorio-datos-2026-10-03.xlsx');
});

test('filasDeSeries usa los nombres legibles y no inventa ceros', () => {
  const { columnas, filas } = filasDeSeries(
    [
      { date: '2026-10-01', p: 11.9, o: 6.96 },
      { date: '2026-10-02', p: 12 },
      { date: '2026-10-03', p: Number.NaN, o: 6.96 },
    ],
    { key: 'date', label: 'Fecha' },
    [
      { key: 'p', label: 'Paralelo' },
      { key: 'o', label: 'Oficial' },
    ],
  );
  assert.deepEqual(columnas, ['Fecha', 'Paralelo', 'Oficial']);
  assert.deepEqual(filas, [
    ['2026-10-01', 11.9, 6.96],
    ['2026-10-02', 12, null],
    ['2026-10-03', null, 6.96],
  ]);
});


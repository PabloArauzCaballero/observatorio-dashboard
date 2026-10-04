/**
 * Un libro de Excel (.xlsx) escrito a mano, sin dependencias.
 *
 * Un .xlsx es un zip de archivos XML. Aquí se escribe el zip sin comprimir
 * («store») con su CRC-32, y el mínimo de SpreadsheetML que Excel, LibreOffice y
 * Google Sheets abren sin avisos: una hoja «Datos» con la cabecera en negrita y
 * fija, los números como números, y una hoja «Fuente» que dice de dónde salen.
 * El proyecto ya escribe su propio PDF por el mismo motivo —una librería entera
 * para un formato de tablas planas pesa más que el formato—.
 *
 * Puro: devuelve bytes. No toca el navegador ni el servidor.
 */
import type { Celda, Dataset } from './datos';

const encoder = new TextEncoder();

// --- zip ---------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ArchivoZip {
  nombre: string;
  datos: Uint8Array;
}

/** Fecha y hora de DOS, que es lo que guarda el zip. */
function fechaDos(fecha: Date): { dia: number; hora: number } {
  const year = Math.max(fecha.getUTCFullYear(), 1980);
  return {
    dia: ((year - 1980) << 9) | ((fecha.getUTCMonth() + 1) << 5) | fecha.getUTCDate(),
    hora: (fecha.getUTCHours() << 11) | (fecha.getUTCMinutes() << 5) | (fecha.getUTCSeconds() >> 1),
  };
}

/** Un zip sin comprimir. Los nombres van en UTF-8 (bit 11). */
export function zipStore(archivos: ReadonlyArray<ArchivoZip>, ahora: Date = new Date()): Uint8Array {
  const { dia, hora } = fechaDos(ahora);
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const archivo of archivos) {
    const nombre = encoder.encode(archivo.nombre);
    const crc = crc32(archivo.datos);
    const tamano = archivo.datos.length;

    const local = new Uint8Array(30 + nombre.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true); // versión necesaria
    l.setUint16(6, 0x0800, true); // nombres en UTF-8
    l.setUint16(8, 0, true); // sin compresión
    l.setUint16(10, hora, true);
    l.setUint16(12, dia, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, tamano, true);
    l.setUint32(22, tamano, true);
    l.setUint16(26, nombre.length, true);
    l.setUint16(28, 0, true);
    local.set(nombre, 30);
    locales.push(local, archivo.datos);

    const central = new Uint8Array(46 + nombre.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true); // versión que lo hizo
    c.setUint16(6, 20, true); // versión necesaria
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, dia, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, tamano, true);
    c.setUint32(24, tamano, true);
    c.setUint16(28, nombre.length, true);
    c.setUint32(42, desplazamiento, true);
    central.set(nombre, 46);
    centrales.push(central);

    desplazamiento += local.length + tamano;
  }

  const tamanoCentral = centrales.reduce((suma, parte) => suma + parte.length, 0);
  const fin = new Uint8Array(22);
  const f = new DataView(fin.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, archivos.length, true);
  f.setUint16(10, archivos.length, true);
  f.setUint32(12, tamanoCentral, true);
  f.setUint32(16, desplazamiento, true);

  const partes = [...locales, ...centrales, fin];
  const salida = new Uint8Array(partes.reduce((suma, parte) => suma + parte.length, 0));
  let cursor = 0;
  for (const parte of partes) {
    salida.set(parte, cursor);
    cursor += parte.length;
  }
  return salida;
}

// --- hojas -------------------------------------------------------------------

const escapar = (texto: string): string =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Los caracteres de control que XML 1.0 no admite harían que Excel reparase el archivo.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** A, B, … Z, AA, AB… */
export function columnaExcel(indice: number): string {
  let n = indice + 1;
  let letras = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    n = Math.floor((n - 1) / 26);
  }
  return letras;
}

/** Excel limita el nombre de una hoja a 31 caracteres y le prohíbe `[]:*?/\`. */
export function nombreDeHoja(nombre: string): string {
  const limpio = nombre.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31);
  return limpio || 'Hoja';
}

function celda(referencia: string, valor: Celda, estilo?: number): string {
  const s = estilo ? ` s="${estilo}"` : '';
  if (valor === null) return '';
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? `<c r="${referencia}"${s}><v>${valor}</v></c>` : '';
  }
  return `<c r="${referencia}"${s} t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`;
}

/** El ancho de cada columna sale de lo más largo que lleva, con tope. */
function anchos(columnas: string[], filas: Celda[][]): number[] {
  return columnas.map((nombre, j) => {
    let max = nombre.length;
    for (const fila of filas.slice(0, 200)) {
      const v = fila[j];
      if (v !== null && v !== undefined) max = Math.max(max, String(v).length);
    }
    return Math.min(Math.max(max + 2, 8), 60);
  });
}

function hojaDatos(columnas: string[], filas: Celda[][]): string {
  const cabecera = columnas.map((c, j) => celda(`${columnaExcel(j)}1`, c, 1)).join('');
  const cuerpo = filas
    .map((fila, i) => {
      const celdas = columnas.map((_, j) => celda(`${columnaExcel(j)}${i + 2}`, fila[j] ?? null)).join('');
      return `<row r="${i + 2}">${celdas}</row>`;
    })
    .join('');
  const cols = anchos(columnas, filas)
    .map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols>` +
    `<sheetData><row r="1">${cabecera}</row>${cuerpo}</sheetData></worksheet>`
  );
}

function hojaFuente(pares: ReadonlyArray<[string, string]>): string {
  const filas = pares
    .map(
      ([clave, valor], i) =>
        `<row r="${i + 1}">${celda(`A${i + 1}`, clave, 1)}${celda(`B${i + 1}`, valor)}</row>`,
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<cols><col min="1" max="1" width="16" customWidth="1"/><col min="2" max="2" width="90" customWidth="1"/></cols>' +
    `<sheetData>${filas}</sheetData></worksheet>`
  );
}

const ESTILOS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left/><right/><top/><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

export interface OpcionesXlsx {
  /** Fecha de la consulta, «2026-10-03». */
  consultado: string;
  /** Cuándo se generó el archivo; solo se usa para la fecha interna del zip. */
  ahora?: Date;
}

/** El libro de un panel: «Datos» y «Fuente». */
export function aXlsx(datos: Dataset, { consultado, ahora }: OpcionesXlsx): Uint8Array {
  const pares: Array<[string, string]> = [['Panel', datos.titulo]];
  if (datos.unidad) pares.push(['Unidad', datos.unidad]);
  pares.push(['Fuente', datos.fuente], ['Consultado', consultado]);
  if (datos.nota) pares.push(['Nota', datos.nota]);
  pares.push(['Publica', 'Observatorio Económico de Bolivia · datosbolivia.com']);

  const xml = (parte: string): Uint8Array => encoder.encode(parte);
  const cabecera = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const archivos: ArchivoZip[] = [
    {
      nombre: '[Content_Types].xml',
      datos: xml(
        `${cabecera}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          '</Types>',
      ),
    },
    {
      nombre: '_rels/.rels',
      datos: xml(
        `${cabecera}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>',
      ),
    },
    {
      nombre: 'xl/workbook.xml',
      datos: xml(
        `${cabecera}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets><sheet name="${nombreDeHoja('Datos')}" sheetId="1" r:id="rId1"/><sheet name="${nombreDeHoja('Fuente')}" sheetId="2" r:id="rId2"/></sheets></workbook>`,
      ),
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      datos: xml(
        `${cabecera}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
          '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          '</Relationships>',
      ),
    },
    { nombre: 'xl/styles.xml', datos: xml(ESTILOS) },
    { nombre: 'xl/worksheets/sheet1.xml', datos: xml(hojaDatos(datos.columnas, datos.filas)) },
    { nombre: 'xl/worksheets/sheet2.xml', datos: xml(hojaFuente(pares)) },
  ];
  return zipStore(archivos, ahora);
}

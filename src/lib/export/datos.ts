/**
 * Los datos de un panel, como tabla, y los formatos de texto en que se bajan.
 *
 * Todo panel que se descarga produce un `Dataset`: las mismas cifras que dibuja,
 * con los filtros que tiene puestos. El CSV y el Excel salen de ahí y de ningún
 * otro sitio, así que el archivo no puede contar otra cosa que la figura.
 *
 * Puro —ni servidor ni navegador— para usarlo en los dos lados y probarlo con
 * `node --test`. Por eso no importa nada de este proyecto salvo tipos.
 */

export type Celda = string | number | null;

export interface Dataset {
  /** Clave estable del panel; da nombre al archivo. */
  id: string;
  /** El título del panel, con su unidad: «Dólar paralelo (Bs por USD)». */
  titulo: string;
  /** La unidad suelta, cuando el título no basta para una hoja de cálculo. */
  unidad?: string | undefined;
  columnas: string[];
  filas: Celda[][];
  /** Quién publica las cifras; el archivo lo dice sin la página al lado. */
  fuente: string;
  /** Una advertencia de lectura que no cabe en una columna. */
  nota?: string | undefined;
}

/** Una celda de CSV entre comillas solo cuando lo pide. Sin fórmulas inyectadas. */
export function campoCsv(valor: Celda): string {
  if (valor === null) return '';
  const texto = String(valor);
  // Una celda que empieza con = + - @ la ejecuta una planilla como fórmula.
  const seguro = /^[=+\-@]/.test(texto) && !/^-?\d/.test(texto) ? `'${texto}` : texto;
  return /[",\n\r;]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/**
 * CSV que se explica solo: la fuente y la fecha de consulta van como columnas,
 * igual que en `/api/export`, y no como comentarios arriba, que Excel lee como
 * filas. Los números van con punto decimal y sin separador de miles: es un
 * archivo para máquinas, y quien lo abre en una planilla la ajusta a su región.
 */
export function aCsv(datos: Dataset, consultado: string): string {
  const lineas = [
    [...datos.columnas, 'fuente', 'consultado'].map(campoCsv).join(','),
    ...datos.filas.map((fila) =>
      [...datos.columnas.map((_, i) => fila[i] ?? null), datos.fuente, consultado]
        .map(campoCsv)
        .join(','),
    ),
  ];
  // La marca de orden de bytes hace que Excel lea las tildes como UTF-8.
  return `﻿${lineas.join('\r\n')}\r\n`;
}

/** Un nombre de archivo sin espacios ni tildes: «observatorio-dolar-paralelo-2026-10-03.csv». */
export function nombreDeArchivo(id: string, fecha: string, extension: string): string {
  const base = id
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `observatorio-${base || 'datos'}-${fecha}.${extension}`;
}

export interface SerieAncha {
  key: string;
  label: string;
}

/**
 * Los renglones de un gráfico de series «anchas» —`{ date, a, b }`— con los
 * nombres de columna que lee una persona (`label`) y no los del código (`key`).
 * La primera columna es el eje X; una serie sin dato en una fecha queda vacía,
 * no en cero: un cero inventado es una cifra que nadie publicó.
 */
export function filasDeSeries(
  datos: ReadonlyArray<Record<string, unknown>>,
  ejeX: { key: string; label: string },
  series: ReadonlyArray<SerieAncha>,
): Pick<Dataset, 'columnas' | 'filas'> {
  const numero = (v: unknown): Celda =>
    typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' ? v : null;
  return {
    columnas: [ejeX.label, ...series.map((s) => s.label)],
    filas: datos.map((punto) => [numero(punto[ejeX.key]), ...series.map((s) => numero(punto[s.key]))]),
  };
}

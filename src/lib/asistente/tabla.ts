/**
 * Los datos con que se contestó, como tabla.
 *
 * Cada paquete que el asistente lee devuelve, además del texto para el modelo,
 * una tabla con las mismas cifras: es la vista previa de la respuesta y lo que
 * se baja en CSV. No es otra lectura sino la misma, así que el archivo y la
 * respuesta no pueden contar cosas distintas.
 *
 * Puro —sin servidor ni navegador— para usarlo en los dos lados y probarlo.
 */

export type Celda = string | number | null;

export interface Tabla {
  /** De qué paquete sale; sirve de clave y de nombre del archivo. */
  id: string;
  titulo: string;
  columnas: string[];
  filas: Celda[][];
  /** Quién publica las cifras, para que el archivo lo diga sin el chat al lado. */
  fuente: string;
  /** La descarga completa en `/api/export`, cuando la tabla es un recorte de algo más grande. */
  completa?: { href: string; etiqueta: string } | undefined;
}

/** Filas de sobra no ayudan a leer ni a bajar: el recorte se dice en el título. */
export const MAX_FILAS = 60;

export function tabla(
  id: string,
  titulo: string,
  columnas: string[],
  filas: Celda[][],
  fuente: string,
  completa?: Tabla['completa'],
): Tabla | undefined {
  const limpias = filas.filter((f) => f.some((c) => c !== null && c !== ''));
  if (limpias.length === 0) return undefined;
  return {
    id,
    titulo: limpias.length > MAX_FILAS ? `${titulo} (primeras ${MAX_FILAS} de ${limpias.length})` : titulo,
    columnas,
    filas: limpias.slice(0, MAX_FILAS).map((f) => columnas.map((_, i) => f[i] ?? null)),
    fuente,
    ...(completa ? { completa } : {}),
  };
}

function campoCsv(valor: Celda): string {
  if (valor === null) return '';
  const texto = String(valor);
  // Una celda que empieza con = + - @ la ejecuta una planilla como fórmula.
  const seguro = /^[=+\-@]/.test(texto) && !/^-?\d/.test(texto) ? `'${texto}` : texto;
  return /[",\n;]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/**
 * CSV que se explica solo: la fuente y la fecha van como columnas, igual que en
 * `/api/export`, y no como comentarios arriba, que Excel lee como filas.
 */
export function aCsv(t: Tabla, fecha: string): string {
  const lineas = [
    [...t.columnas, 'fuente', 'consultado'].map(campoCsv).join(','),
    ...t.filas.map((f) => [...f, t.fuente, fecha].map(campoCsv).join(',')),
  ];
  // La marca de orden de bytes hace que Excel lea las tildes como UTF-8.
  return `﻿${lineas.join('\n')}\n`;
}

function celdaMd(valor: Celda): string {
  return valor === null ? '' : String(valor).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function aMarkdown(t: Tabla): string {
  return [
    `**${t.titulo}** — ${t.fuente}`,
    '',
    `| ${t.columnas.map(celdaMd).join(' | ')} |`,
    `| ${t.columnas.map(() => '---').join(' | ')} |`,
    ...t.filas.map((f) => `| ${f.map(celdaMd).join(' | ')} |`),
  ].join('\n');
}

/** Un nombre de archivo sin espacios ni tildes: «observatorio-dolar-2026-09-27.csv». */
export function nombreDeArchivo(id: string, fecha: string, extension: string): string {
  const base = id.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
  return `observatorio-${base}-${fecha}.${extension}`;
}

/**
 * Cuántos decimales lleva cada columna en la vista previa: los mismos para
 * toda la columna, así «11» y «11,89» se leen «11,00» y «11,89» y los números
 * quedan alineados. Tope de cuatro.
 */
export function decimalesPorColumna(t: Tabla): number[] {
  return t.columnas.map((_, j) =>
    Math.min(
      4,
      Math.max(0, ...t.filas.map((f) => {
        const v = f[j];
        return typeof v === 'number' && !Number.isInteger(v) ? (String(v).split('.')[1]?.length ?? 0) : 0;
      })),
    ),
  );
}

/**
 * Una celda como se lee en Bolivia: coma decimal y punto de miles, pero sin
 * punto en los números de cuatro cifras, que casi siempre son años («2023»,
 * no «2.023»).
 */
export function celdaLegible(valor: Celda, decimales: number): string {
  if (valor === null) return '—';
  if (typeof valor !== 'number') return valor;
  return valor.toLocaleString('es-BO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: Math.abs(valor) >= 10_000,
  });
}

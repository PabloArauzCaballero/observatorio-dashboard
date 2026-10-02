/**
 * Lo que el lector está mirando, como CSV, sin pasar por el servidor.
 *
 * Las páginas de «Empresas» se recortan con filtros que se cruzan, y lo que un
 * analista quiere bajar es **ese recorte**, no el corpus entero: el CSV se arma
 * en el navegador con las mismas filas que la tabla dibuja. Punto y coma y coma
 * decimal, que es como lo abre una planilla configurada en castellano.
 */
export function downloadCsv(
  filename: string,
  header: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null>>,
): void {
  const cell = (value: string | number | null): string => {
    if (value === null) return '';
    const text = typeof value === 'number' ? String(value).replace('.', ',') : value;
    return /[;"\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
  };
  const body = [header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n');
  const blob = new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

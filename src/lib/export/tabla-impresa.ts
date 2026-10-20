/**
 * Una tabla de cifras puesta en papel, para el informe PDF de una pestaña.
 *
 * El CSV y el Excel llevan el dato crudo (11,8135; 2026-10-19; la dirección entera de la
 * fuente). En papel eso se lee mal: decimales que nadie pidió, fechas de máquina y
 * direcciones de cien caracteres que se comen el ancho de las demás columnas. Aquí se
 * redondea para leer, la fecha va en letra, la dirección se acorta (el enlace completo
 * sigue en el PDF) y una tabla muy ancha con texto largo pasa a una ficha por fila.
 *
 * Puro —sin DOM— para probarlo con `node --test`. Solo `import type`.
 */
import type { Celda } from './datos';

/** Primeras filas que entran en el papel; el archivo completo se baja del panel. */
export const MAX_FILAS = 40;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const escapar = (texto: string): string =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Una cifra para leer: enteros tal cual; con decimales, cuatro cifras significativas. */
export function cifra(valor: number): string {
  if (!Number.isFinite(valor)) return '—';
  if (Number.isInteger(valor)) return valor.toLocaleString('es-BO');
  if (Math.abs(valor) >= 1000) return valor.toLocaleString('es-BO', { maximumFractionDigits: 0 });
  return valor.toLocaleString('es-BO', { maximumSignificantDigits: 4 });
}

/** «2026-10-19» → «19-oct-2026», como el resto del sitio. Lo que no es una fecha, igual. */
export function fecha(texto: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return texto;
  const mes = MESES[Number(m[2]) - 1];
  return mes ? `${Number(m[3])}-${mes}-${m[1]}` : texto;
}

/** Una dirección web corta: el sitio y el último tramo de la ruta. */
export function direccionCorta(url: string): string {
  try {
    const u = new URL(url);
    const sitio = u.hostname.replace(/^www\./, '');
    const tramos = u.pathname.split('/').filter(Boolean);
    const ultimo = tramos.at(-1);
    if (!ultimo) return sitio;
    const corto = ultimo.length > 28 ? `${ultimo.slice(0, 27)}…` : ultimo;
    return `${sitio}/${tramos.length > 1 ? '…/' : ''}${corto}`;
  } catch {
    return url;
  }
}

const ES_URL = /^https?:\/\/\S+$/;
/** «11,69», «+1,18 %», «-0,04», «81.716,89 USD»: una cifra escrita como texto. */
const ES_CIFRA = /^[+\-−]?\d[\d.\s ]*(,\d+)?\s*(%|[a-zA-Z$€/]{1,8})?$/;

/** Una celda en HTML para el papel. */
export function celdaImpresa(valor: Celda): string {
  if (valor === null || valor === '') return '—';
  if (typeof valor === 'number') return cifra(valor);
  const texto = valor.trim();
  if (ES_URL.test(texto))
    return `<a href="${escapar(texto)}">${escapar(direccionCorta(texto))}</a>`;
  const enLetra = fecha(texto);
  return enLetra === texto ? escapar(texto) : `<span class="nw">${enLetra}</span>`;
}

/** ¿La columna es de cifras? Todas sus celdas con valor lo son (y hay al menos una). */
export function columnaNumerica(filas: ReadonlyArray<ReadonlyArray<Celda>>, j: number): boolean {
  let alguna = false;
  for (const fila of filas) {
    const v = fila[j] ?? null;
    if (v === null || v === '' || v === '—') continue;
    if (typeof v === 'number' || ES_CIFRA.test(v.trim())) alguna = true;
    else return false;
  }
  return alguna;
}

const largo = (v: Celda): number => (v === null ? 0 : String(v).length);

/**
 * ¿Va mejor como fichas que como tabla? Cuando tiene muchas columnas y alguna lleva prosa:
 * en una tabla de diez columnas, un párrafo queda en una tira de tres palabras por renglón.
 */
export function pideFichas(
  columnas: ReadonlyArray<string>,
  filas: ReadonlyArray<ReadonlyArray<Celda>>,
): boolean {
  if (columnas.length < 7 || filas.length === 0) return false;
  return columnas.some((_, j) => {
    const medio = filas.reduce((s, f) => s + largo(f[j] ?? null), 0) / filas.length;
    return medio > 60;
  });
}

function recorte(total: number): string {
  return total > MAX_FILAS
    ? `<p class="recorte">Primeras ${MAX_FILAS} de ${total.toLocaleString('es-BO')} filas; el archivo completo se baja desde el panel.</p>`
    : '';
}

/** Una ficha por fila: la primera columna de encabezado y el resto como pares rótulo–valor. */
function fichasHtml(
  columnas: ReadonlyArray<string>,
  filas: ReadonlyArray<ReadonlyArray<Celda>>,
): string {
  return (
    '<div class="fichas">' +
    filas
      .slice(0, MAX_FILAS)
      .map((fila) => {
        const pares = columnas
          .slice(1)
          .map((c, k) => {
            const v = fila[k + 1] ?? null;
            if (v === null || v === '' || v === '—') return '';
            const ancha = largo(v) > 48 && !(typeof v === 'string' && ES_URL.test(v.trim()));
            return `<div class="par${ancha ? ' ancho' : ''}"><dt>${escapar(c)}</dt><dd>${celdaImpresa(v)}</dd></div>`;
          })
          .join('');
        return `<article class="ficha"><h4>${celdaImpresa(fila[0] ?? null)}</h4><dl>${pares}</dl></article>`;
      })
      .join('') +
    '</div>' +
    recorte(filas.length)
  );
}

/** La tabla (o las fichas) en HTML para el informe. */
export function tablaImpresa(
  etiqueta: string | undefined,
  columnas: ReadonlyArray<string>,
  filas: ReadonlyArray<ReadonlyArray<Celda>>,
): string {
  const titulo = etiqueta ? `<p class="etiqueta">${escapar(etiqueta)}</p>` : '';
  if (pideFichas(columnas, filas)) return titulo + fichasHtml(columnas, filas);
  const numericas = columnas.map((_, j) => columnaNumerica(filas, j));
  const clase = (j: number): string => (numericas[j] ? ' class="num"' : '');
  return (
    titulo +
    `<table class="datos${filas.length <= 12 ? ' corta' : ''}"><thead><tr>` +
    columnas.map((c, j) => `<th${clase(j)}>${escapar(c)}</th>`).join('') +
    '</tr></thead><tbody>' +
    filas
      .slice(0, MAX_FILAS)
      .map(
        (fila) =>
          '<tr>' +
          columnas.map((_, j) => `<td${clase(j)}>${celdaImpresa(fila[j] ?? null)}</td>`).join('') +
          '</tr>',
      )
      .join('') +
    '</tbody></table>' +
    recorte(filas.length)
  );
}

/**
 * Las direcciones de las pestañas y sus páginas.
 *
 * `/?pestana=macroeconomia&pagina=variables-exogenas` abre «Macroeconomía» en
 * su página «Variables exógenas». Así una respuesta del asistente puede llevar
 * un enlace que se copia, se abre en otra ventana o se manda por mensaje, y
 * quien lo recibe llega al mismo lugar.
 *
 * El nombre en la dirección sale del rótulo del botón, sin tildes ni signos:
 * no hay una tabla aparte que se desincronice cuando una pestaña cambia de
 * nombre. Puro, sin React ni `window`, para usarlo en el servidor y probarlo.
 */

export const PARAM_PESTANA = 'pestana';
export const PARAM_PAGINA = 'pagina';

/** El evento con que se pide ir a un lugar del tablero sin recargar la página. */
export const EVENTO_ENLACE = 'observatorio:enlace';

export interface Destino {
  pestana: string;
  pagina?: string | undefined;
}

/** «Bolsa de valores (BBV)» → «bolsa-de-valores-bbv». */
export function slug(rotulo: string): string {
  return rotulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** La dirección relativa de un destino: sirve igual en dev, en test y en el dominio. */
export function hrefDe(destino: Destino): string {
  const parametros = new URLSearchParams({ [PARAM_PESTANA]: slug(destino.pestana) });
  if (destino.pagina) parametros.set(PARAM_PAGINA, slug(destino.pagina));
  return `/?${parametros.toString()}`;
}

/** Qué rótulo de la lista nombra la dirección, o -1. */
export function indicePorSlug(rotulos: readonly string[], valor: string | null): number {
  if (!valor) return -1;
  const buscado = slug(valor);
  return rotulos.findIndex((r) => slug(r) === buscado);
}

/* ------------------------------------------------ solo en el navegador */

/**
 * Anota en la dirección lo que el lector eligió, sin sumar una entrada al
 * historial por cada clic: «atrás» tiene que sacarlo del tablero, no deshacer
 * pestañas una por una. `null` borra el parámetro.
 */
export function anotar(cambios: Record<string, string | null>): void {
  const url = new URL(window.location.href);
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor === null) url.searchParams.delete(clave);
    else url.searchParams.set(clave, valor);
  }
  window.history.replaceState(null, '', url);
}

/**
 * Lleva el tablero a un destino sin recargar. Esta sí suma una entrada al
 * historial, para que «atrás» vuelva a donde estaba el lector antes del salto.
 * Las pestañas y las páginas escuchan `EVENTO_ENLACE` y leen la dirección.
 * El estado va en `null` en las dos funciones: así Next pone el suyo y su
 * router sigue el cambio sin navegar.
 */
export function navegar(destino: Destino): void {
  window.history.pushState(null, '', hrefDe(destino));
  window.dispatchEvent(new CustomEvent(EVENTO_ENLACE));
}

/** Lo que dice la dirección actual, para la pestaña o la página que se monta. */
export function leerParametro(nombre: string): string | null {
  return new URLSearchParams(window.location.search).get(nombre);
}

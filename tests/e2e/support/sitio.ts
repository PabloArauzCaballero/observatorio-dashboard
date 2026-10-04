import { expect, type Locator, type Page } from '@playwright/test';
import { SITE, idDePagina, idDeSeccion } from '../../../src/lib/site-map';

/**
 * El tablero público es una sola página larga con un índice fijo: no hay pestañas que pulsar.
 * Estos ayudantes llegan a cada sección y a cada página como lo hace el lector —por el índice— y
 * esperan a que lo suyo esté montado y leído.
 *
 * El índice es una columna fija desde 1100 px; por debajo es un cajón que abre «Secciones».
 */

/** Cada lugar que se revisa: una sección sin páginas, o cada página de una con páginas. */
export interface Lugar {
  seccion: string;
  pagina?: string;
  /** El ancla del bloque que lo contiene. */
  id: string;
  /** «Macroeconomía › Series de Bolivia». */
  nombre: string;
}

export const LUGARES: readonly Lugar[] = SITE.flatMap((seccion): Lugar[] =>
  seccion.pages.length === 0
    ? [{ seccion: seccion.label, id: idDeSeccion(seccion.label), nombre: seccion.label }]
    : seccion.pages.map((pagina) => ({
        seccion: seccion.label,
        pagina: pagina.label,
        id: idDePagina(seccion.label, pagina.label),
        nombre: `${seccion.label} › ${pagina.label}`,
      })),
);

export const SECCIONES = SITE.map((seccion) => seccion.label);

export function bloque(page: Page, id: string): Locator {
  return page.locator(`[data-site-id="${id}"]`);
}

async function abrirCajonSiHaceFalta(page: Page): Promise<void> {
  const barra = page.locator('.site-bar');
  if (await barra.isVisible()) {
    const boton = barra.locator('.site-bar-btn');
    if ((await boton.getAttribute('aria-expanded')) !== 'true') await boton.click();
  }
}

/** Una página lista: montada y sin avisos de «Cargando» ni de «Armando». */
export async function esperarLista(page: Page, id: string): Promise<void> {
  const destino = bloque(page, id);
  await expect(destino).toHaveAttribute('data-montado', 'si', { timeout: 60_000 });
  await expect(destino.locator('.loading-note')).toHaveCount(0, { timeout: 120_000 });
  await expect(destino.locator('.callout').filter({ hasText: /^Armando / })).toHaveCount(0, {
    timeout: 120_000,
  });
}

/** Va a una sección o a una página por el índice y espera a que esté lista. */
export async function irA(page: Page, seccion: string, pagina?: string): Promise<string> {
  const id = pagina ? idDePagina(seccion, pagina) : idDeSeccion(seccion);
  await abrirCajonSiHaceFalta(page);
  await page
    .locator('nav.site-index .site-link')
    .filter({ hasText: new RegExp(`^\\s*${seccion.replace(/[()]/g, '\\$&')}\\s*$`) })
    .click();
  if (pagina) {
    await abrirCajonSiHaceFalta(page);
    await page
      .locator('nav.site-index .site-page')
      .filter({ hasText: new RegExp(`^\\s*${pagina.replace(/[()]/g, '\\$&')}\\s*$`) })
      .click();
  }
  await esperarLista(page, id);
  return id;
}

export function irALugar(page: Page, lugar: Lugar): Promise<string> {
  return irA(page, lugar.seccion, lugar.pagina);
}

export async function abrirTablero(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('nav.site-index, .site-bar').first()).toBeAttached();
  await esperarLista(page, idDeSeccion(SITE[0]?.label ?? 'Hoy'));
}

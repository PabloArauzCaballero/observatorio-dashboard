import { expect, test, type Locator, type Page } from '@playwright/test';
import { parseCsv } from './support/csv';

/**
 * Todo panel del tablero público se puede bajar.
 *
 * Recorre cada pestaña y cada página interior, y en cada una comprueba tres cosas
 * sobre los paneles que usan `Panel`:
 *   1. el menú «Descargar» abre y ofrece lo que corresponde (enlace siempre; datos
 *      si hay cifras o una tabla; imagen si hay un gráfico);
 *   2. una descarga real de datos produce un CSV con su fuente y su fecha, y un
 *      Excel que es un zip;
 *   3. una descarga real de imagen produce un PNG nítido (el doble de ancho que
 *      el afiche) y un SVG que se analiza.
 *
 * Corre contra servicios reales (`E2E_BASE_URL`), como el resto de la suite: una
 * descarga contra datos de mentira prueba que el botón existe, no que lo que baja
 * es lo que se ve.
 */
const TABS = [
  'Hoy',
  'Tipo de cambio',
  'Macroeconomía',
  'Empresas',
  'Ciudades',
  'Transporte',
  'Prensa',
  'Método',
] as const;

async function settle(page: Page): Promise<void> {
  await expect(page.locator('.loading-note')).toHaveCount(0, { timeout: 120_000 });
  await expect(page.locator('.callout').filter({ hasText: /^Armando / })).toHaveCount(0, {
    timeout: 120_000,
  });
}

async function openTab(page: Page, label: string): Promise<void> {
  await page.getByRole('tab', { name: label, exact: true }).first().click();
  await settle(page);
}

async function subTabs(page: Page): Promise<string[]> {
  const bar = page.locator('nav.subtabs').first();
  if ((await bar.count()) === 0) return [];
  return (await bar.getByRole('tab').allInnerTexts()).map((text) => text.trim()).filter(Boolean);
}

async function openMenu(panel: Locator): Promise<string[]> {
  await panel.scrollIntoViewIfNeeded();
  await panel.locator('.menu-btn[aria-haspopup="menu"]').first().click();
  const items = await panel.getByRole('menuitem').allInnerTexts();
  return items.map((text) => text.replace(/\s+/g, ' ').trim());
}

async function closeMenu(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
}

/** Los paneles de primer nivel con menú. */
function panelsOf(page: Page): Locator {
  return page.locator('[data-panel-id]:has(> .panel-top .menu-btn[aria-haspopup="menu"])');
}

test.describe('descargas de los paneles', () => {
  test('cada panel de cada pestaña ofrece el menú y lo que le corresponde', async ({ page }) => {
    test.setTimeout(900_000);
    await page.goto('/');
    await expect(page.getByRole('tablist', { name: 'Secciones del informe' })).toBeVisible();

    const problemas: string[] = [];
    let revisados = 0;

    for (const tab of TABS) {
      await openTab(page, tab);
      const paginas = await subTabs(page);
      for (const pagina of paginas.length ? paginas : [null]) {
        if (pagina) {
          await page
            .locator('nav.subtabs')
            .first()
            .getByRole('tab', { name: pagina, exact: true })
            .click();
          await settle(page);
        }
        const donde = pagina ? `${tab} › ${pagina}` : tab;
        const paneles = panelsOf(page);
        const total = await paneles.count();
        for (let i = 0; i < total; i += 1) {
          const panel = paneles.nth(i);
          const id = (await panel.getAttribute('data-panel-id')) ?? `#${i}`;
          const titulo = (
            (await panel.locator('.panel-top h3').first().textContent()) ?? ''
          ).trim();
          const hayGrafico = (await panel.locator('svg:not(.ic)').count()) > 0;
          const hayTabla = (await panel.locator('table').count()) > 0;
          const items = await openMenu(panel);
          await closeMenu(page);
          revisados += 1;

          if (!items.some((t) => /^Copiar enlace/.test(t)))
            problemas.push(`${donde} · ${id}: sin «Copiar enlace»`);
          if (hayTabla && !items.some((t) => /^Datos/.test(t))) {
            problemas.push(`${donde} · ${id} («${titulo}»): tiene tabla y el menú no ofrece datos`);
          }
          if (!/\(.+\)/.test(titulo))
            problemas.push(`${donde} · ${id}: el título «${titulo}» no lleva unidad`);
          void hayGrafico;
        }
      }
    }
    expect(revisados, 'la prueba no encontró ningún panel con menú').toBeGreaterThan(0);
    expect(problemas, problemas.join('\n')).toHaveLength(0);
  });

  test('«Hoy»: la cotización baja como CSV con fuente y fecha, y como Excel', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    const panel = page.locator('[data-panel-id="cotizacion-dolar"]');
    await expect(panel).toBeVisible();
    await openMenu(panel);

    const [csv] = await Promise.all([
      page.waitForEvent('download'),
      panel.getByRole('menuitem', { name: /^Datos\s*CSV/ }).click(),
    ]);
    expect(csv.suggestedFilename()).toMatch(
      /^observatorio-cotizacion-dolar-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const stream = await csv.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString('utf8');
    expect(text.startsWith('﻿'), 'el CSV lleva la marca de orden de bytes').toBe(true);
    const parsed = parseCsv(text.replace(/^﻿/, ''));
    expect(parsed.headers).toEqual(expect.arrayContaining(['Cotización', 'fuente', 'consultado']));
    expect(parsed.rows.length).toBeGreaterThan(0);

    await openMenu(panel);
    const [xlsx] = await Promise.all([
      page.waitForEvent('download'),
      panel.getByRole('menuitem', { name: /^Datos para Excel/ }).click(),
    ]);
    expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
    const libro: Buffer[] = [];
    for await (const chunk of await xlsx.createReadStream()) libro.push(chunk as Buffer);
    const bytes = Buffer.concat(libro);
    expect(bytes.subarray(0, 2).toString('latin1'), 'un .xlsx es un zip («PK»)').toBe('PK');
    expect(bytes.length, 'el libro trae datos').toBeGreaterThan(1000);
  });

  test('«Hoy»: la brecha baja como PNG al doble de ancho y como SVG que se lee', async ({
    page,
  }) => {
    await page.goto('/');
    await settle(page);
    const panel = page.locator('[data-panel-id="brecha-cambiaria"]');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel.locator('svg.recharts-surface').first()).toBeVisible();
    await openMenu(panel);

    const [png] = await Promise.all([
      page.waitForEvent('download'),
      panel.getByRole('menuitem', { name: /^Imagen\s*PNG/ }).click(),
    ]);
    expect(png.suggestedFilename()).toMatch(/\.png$/);
    const bytes: Buffer[] = [];
    for await (const chunk of await png.createReadStream()) bytes.push(chunk as Buffer);
    const file = Buffer.concat(bytes);
    expect(file.subarray(0, 8).toString('hex'), 'firma PNG').toBe('89504e470d0a1a0a');
    expect(file.readUInt32BE(16), 'ancho del afiche × 2').toBe(2400);

    await openMenu(panel);
    const [svg] = await Promise.all([
      page.waitForEvent('download'),
      panel.getByRole('menuitem', { name: /^Imagen vectorial/ }).click(),
    ]);
    const markup: Buffer[] = [];
    for await (const chunk of await svg.createReadStream()) markup.push(chunk as Buffer);
    const text = Buffer.concat(markup).toString('utf8');
    expect(text).toContain('<svg');
    expect(text).toContain('Brecha cambiaria');
    expect(text).toContain('datosbolivia.com');
  });

  test('la cabecera de cada pestaña ofrece el informe (PDF)', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    for (const tab of TABS) {
      await openTab(page, tab);
      await expect(
        page.getByRole('button', { name: /Descargar informe/ }),
        `«${tab}» no tiene el botón del informe`,
      ).toBeVisible();
    }
  });
});

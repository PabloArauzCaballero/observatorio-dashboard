import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { LUGARES, SECCIONES, abrirTablero, irALugar, irA } from './support/sitio';
import { SITE } from '../../src/lib/site-map';

/**
 * The public counterpart of UI-02/UI-03.
 *
 * `admin-visual.spec.ts` already walks every admin screen at this same set of
 * widths; the report the public reads — one long page with a fixed index, eight
 * sections and, inside four of them, their own pages — had no equivalent. Each
 * place is reached through the index, as a reader does, but the two checks that
 * matter are identical: nothing pushes the document wider than its own
 * viewport, and nothing fails a serious or critical WCAG 2 A/AA rule.
 *
 * The places come from the site map, not from a list written here: a list
 * written by hand ages with every new chapter.
 */
const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
] as const;

const nombreDeArchivo = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

test('UI-00 · comercio exterior y detalle aduanero pertenecen a Macroeconomía', async ({
  page,
}) => {
  await abrirTablero(page);
  const paginasDe = (seccion: string) =>
    SITE.find((s) => s.label === seccion)?.pages.map((p) => p.label) ?? [];
  expect(paginasDe('Macroeconomía')).toEqual(
    expect.arrayContaining(['Comercio exterior', 'Detalle aduanero (INE)']),
  );
  expect(paginasDe('Empresas')).not.toEqual(expect.arrayContaining(['Comercio exterior']));

  // Y el índice lo muestra: abierta una sección, enseña las páginas de esa y no las de otra.
  if (await page.locator('.site-bar').isVisible()) await page.locator('.site-bar-btn').click();
  await page.locator('nav.site-index .site-link', { hasText: 'Macroeconomía' }).click();
  const paginas = page.locator('nav.site-index .site-page');
  await expect(paginas.filter({ hasText: 'Comercio exterior' })).toHaveCount(1);
  await expect(paginas.filter({ hasText: 'Detalle aduanero (INE)' })).toHaveCount(1);
  if (await page.locator('.site-bar').isVisible()) await page.locator('.site-bar-btn').click();
  await page.locator('nav.site-index .site-link', { hasText: 'Empresas' }).click();
  await expect(
    page.locator('nav.site-index .site-page', { hasText: 'Comercio exterior' }),
  ).toHaveCount(0);
});

function overflowOf(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('sitio público · revisión visual y de accesibilidad', () => {
  for (const viewport of VIEWPORTS) {
    test(`UI-02 · ${viewport.name}: ningún lugar del informe desborda el documento`, async ({
      page,
    }) => {
      test.setTimeout(900_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await abrirTablero(page);

      for (const lugar of LUGARES) {
        await irALugar(page, lugar);
        await page.screenshot({
          path: `artifacts/e2e/screenshots/${viewport.name}-publico-${nombreDeArchivo(lugar.nombre)}.png`,
        });
        const overflow = await overflowOf(page);
        expect(
          overflow,
          `«${lugar.nombre}» desborda ${overflow}px en ${viewport.name}`,
        ).toBeLessThanOrEqual(1);
      }
    });
  }

  test('UI-02 · el zoom al 200 % no rompe la disposición del sitio público', async ({ page }) => {
    test.setTimeout(900_000);
    // Emulated by halving the viewport, which is what a 200 % zoom does to the
    // CSS pixel budget a layout has to fit in — same technique as the admin spec.
    await page.setViewportSize({ width: 720, height: 450 });
    await abrirTablero(page);
    for (const seccion of SECCIONES) {
      await irA(page, seccion);
      const overflow = await overflowOf(page);
      expect(overflow, `sección «${seccion}» desborda al 200 %`).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: 'artifacts/e2e/screenshots/zoom-200-publico-resumen.png' });
  });

  test('UI-03 · ningún lugar tiene incumplimientos serios de accesibilidad', async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await abrirTablero(page);
    const failures: string[] = [];
    for (const lugar of LUGARES) {
      const id = await irALugar(page, lugar);
      const result = await new AxeBuilder({ page })
        .include(`[data-site-id="${id}"]`)
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      for (const violation of result.violations) {
        if (violation.impact === 'critical' || violation.impact === 'serious') {
          failures.push(`${lugar.nombre}: ${violation.id} — ${violation.help}`);
        }
      }
    }
    expect(failures, failures.join('\n')).toHaveLength(0);
  });

  test('un enlace profundo ?pestana=&pagina= abre solo esa página, y el índice la marca', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?pestana=macroeconomia&pagina=variables-exogenas');
    const destino = page.locator('[data-site-id="macroeconomia--variables-exogenas"]');
    await expect(destino).toBeVisible({ timeout: 60_000 });
    // Una sola página a la vez: ninguna otra de la sección está en el documento.
    await expect(page.locator('[data-site-kind="pagina"]')).toHaveCount(1);
    await expect(page).toHaveURL(/pestana=macroeconomia&pagina=variables-exogenas/);
    await expect(page.locator('nav.site-index [aria-current="page"]')).toHaveText(
      'Variables exógenas',
    );
  });

  test('«Factores externos» abre por enlace profundo, ofrece Gráfico y Tabla, y no desborda en móvil', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?pestana=macroeconomia&pagina=factores-externos');
    const destino = page.locator('[data-site-id="macroeconomia--factores-externos"]');
    await expect(destino).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-site-kind="pagina"]')).toHaveCount(1);
    // Abre en las familias con series: ninguna tarjeta «en investigación».
    await expect(destino.getByText('Explorar series').first()).toBeVisible({ timeout: 60_000 });
    await expect(destino.getByText('Consultar propuesta y brechas')).toHaveCount(0);
    await destino.getByText('Explorar series').first().click();
    await expect(destino.getByRole('button', { name: 'Gráfico' }).first()).toBeVisible({
      timeout: 60_000,
    });
    await destino.getByRole('button', { name: 'Tabla', exact: true }).first().click();
    await expect(destino.locator('table tbody tr').first()).toBeVisible();
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde).toBeLessThanOrEqual(0);
  });

  test('elegir otra página del índice cambia la página y la dirección sin recargar', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?pestana=macroeconomia&pagina=series-de-bolivia');
    await expect(page.locator('[data-site-id="macroeconomia--series-de-bolivia"]')).toBeVisible({
      timeout: 60_000,
    });
    await page.evaluate(() => {
      (window as unknown as { __marca: string }).__marca = 'sin-recarga';
    });
    await page.locator('nav.site-index .site-page', { hasText: 'Social Info' }).click();
    await expect(page.locator('[data-site-id="macroeconomia--social-info"]')).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator('[data-site-id="macroeconomia--series-de-bolivia"]')).toHaveCount(0);
    await expect(page).toHaveURL(/pagina=social-info/);
    expect(await page.evaluate(() => (window as unknown as { __marca?: string }).__marca)).toBe(
      'sin-recarga',
    );
    await page.goBack();
    await expect(page.locator('[data-site-id="macroeconomia--series-de-bolivia"]')).toBeVisible();
  });
});

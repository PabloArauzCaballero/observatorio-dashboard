import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The public counterpart of UI-02/UI-03.
 *
 * `admin-visual.spec.ts` already walks every admin screen at this same set of
 * widths; the report the public reads — seven tabs, two of them with their own
 * sub-tabs — had no equivalent. It is a single URL rather than nine routes, so
 * each screen here is reached by activating a tab instead of navigating to a
 * path, but the two checks that matter are identical: nothing pushes the
 * document wider than its own viewport, and nothing fails a serious or
 * critical WCAG 2 A/AA rule.
 */
const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
] as const;

const TABS = [
  { label: 'Resumen', slug: 'resumen' },
  { label: 'Tipo de cambio', slug: 'tipo-de-cambio' },
  { label: 'Macroeconomía', slug: 'macroeconomia' },
  { label: 'Empresas', slug: 'empresas' },
  { label: 'Ciudades', slug: 'ciudades' },
  { label: 'Prensa', slug: 'prensa' },
  { label: 'Método', slug: 'metodo' },
] as const;

// The two chapters that split again into their own tablist once open.
const SUBTABS: Partial<Record<(typeof TABS)[number]['label'], string[]>> = {
  Macroeconomía: ['Series de Bolivia', 'Economía mundial'],
  Prensa: ['Cobertura', 'Temas'],
};

/**
 * Una pestaña abierta no esta lista hasta que su aviso desaparece.
 *
 * Desde que la portada dejo de leer las siete pestañas, seis piden lo suyo al
 * montarse y la septima —el tipo de cambio— llega por el flujo detras de un
 * `Suspense`. Medir el desbordamiento o pasar axe sobre el aviso de «Cargando»
 * comprueba la disposicion de un parrafo, no la del capitulo, y ese es
 * justamente el caso que UI-02 existe para atrapar.
 */
async function settle(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('.callout').filter({ hasText: /^(Cargando|Armando) / })).toHaveCount(
    0,
    { timeout: 120_000 },
  );
}

async function openTab(page: import('@playwright/test').Page, label: string): Promise<void> {
  await page.getByRole('tab', { name: label, exact: true }).click();
  await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await settle(page);
}

function overflowOf(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('sitio público · revisión visual y de accesibilidad', () => {
  for (const viewport of VIEWPORTS) {
    test(`UI-02 · ${viewport.name}: ninguna pestaña desborda el documento`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect(page.getByRole('tablist', { name: 'Secciones del informe' })).toBeVisible();

      for (const tab of TABS) {
        await openTab(page, tab.label);
        await page.screenshot({
          path: `artifacts/e2e/screenshots/${viewport.name}-publico-${tab.slug}.png`,
          fullPage: true,
        });
        const overflow = await overflowOf(page);
        expect(overflow, `pestaña «${tab.label}» desborda ${overflow}px en ${viewport.name}`).toBeLessThanOrEqual(1);

        for (const subLabel of SUBTABS[tab.label] ?? []) {
          await page.getByRole('tab', { name: subLabel, exact: true }).click();
          await expect(page.getByRole('tab', { name: subLabel, exact: true })).toHaveAttribute(
            'aria-selected',
            'true',
          );
          await settle(page);
          const subOverflow = await overflowOf(page);
          expect(
            subOverflow,
            `«${tab.label} → ${subLabel}» desborda ${subOverflow}px en ${viewport.name}`,
          ).toBeLessThanOrEqual(1);
        }
      }
    });
  }

  test('UI-02 · el zoom al 200 % no rompe la disposición del sitio público', async ({ page }) => {
    // Emulated by halving the viewport, which is what a 200 % zoom does to the
    // CSS pixel budget a layout has to fit in — same technique as the admin spec.
    await page.setViewportSize({ width: 720, height: 450 });
    await page.goto('/');
    await expect(page.getByRole('tablist', { name: 'Secciones del informe' })).toBeVisible();
    for (const tab of TABS) {
      await openTab(page, tab.label);
      const overflow = await overflowOf(page);
      expect(overflow, `pestaña «${tab.label}» desborda al 200 %`).toBeLessThanOrEqual(1);
    }
    await page.screenshot({
      path: 'artifacts/e2e/screenshots/zoom-200-publico-resumen.png',
      fullPage: true,
    });
  });

  test('UI-03 · ninguna pestaña tiene incumplimientos serios de accesibilidad', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('tablist', { name: 'Secciones del informe' })).toBeVisible();
    const failures: string[] = [];
    for (const tab of TABS) {
      await openTab(page, tab.label);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      for (const violation of result.violations) {
        if (violation.impact === 'critical' || violation.impact === 'serious') {
          failures.push(`${tab.label}: ${violation.id} — ${violation.help}`);
        }
      }
    }
    expect(failures, failures.join('\n')).toHaveLength(0);
  });
});

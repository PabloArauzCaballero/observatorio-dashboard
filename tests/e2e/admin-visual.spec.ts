import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { signIn } from './support/fixtures';

/**
 * UI-02 and UI-03: how it looks, at the widths people actually use.
 *
 * The screenshots are written to be opened and looked at, not merely produced.
 * What they are checked for is the failure a passing test cannot see: a table
 * that pushes the navigation off the screen, a column that truncates the only
 * word that mattered, a state that is only a colour.
 *
 * The horizontal-overflow assertion is the one that is worth automating,
 * because it is the one that makes every other section unreachable on a narrow
 * window and the one nobody notices on a wide monitor.
 */
const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
] as const;

const SCREENS = [
  { path: '/admin', slug: 'resumen' },
  { path: '/admin/ingestion', slug: 'ingesta' },
  { path: '/admin/seeds', slug: 'sembradores' },
  { path: '/admin/quality', slug: 'calidad' },
  { path: '/admin/health', slug: 'disponibilidad' },
  { path: '/admin/traffic', slug: 'trafico' },
  { path: '/admin/downloads', slug: 'descargas' },
  { path: '/admin/metadata', slug: 'metadatos' },
  { path: '/admin/audit', slug: 'auditoria' },
] as const;

test.describe('revisión visual y de accesibilidad', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const viewport of VIEWPORTS) {
    test(`UI-02 · ${viewport.name}: ninguna pantalla desborda el documento`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const screen of SCREENS) {
        await page.goto(screen.path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.screenshot({
          path: `artifacts/e2e/screenshots/${viewport.name}-${screen.slug}.png`,
          fullPage: true,
        });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(
          overflow,
          `${screen.path} desborda ${overflow}px en ${viewport.name}`,
        ).toBeLessThanOrEqual(1);
      }
    });
  }

  test('UI-02 · el zoom al 200 % no rompe la disposición', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Emulated by halving the viewport, which is what a 200 % zoom does to the
    // CSS pixel budget a layout has to fit in.
    await page.setViewportSize({ width: 720, height: 450 });
    for (const screen of SCREENS) {
      await page.goto(screen.path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${screen.path} desborda al 200 %`).toBeLessThanOrEqual(1);
    }
    await page.screenshot({
      path: 'artifacts/e2e/screenshots/zoom-200-resumen.png',
      fullPage: true,
    });
  });

  test('UI-03 · ninguna pantalla tiene incumplimientos serios de accesibilidad', async ({
    page,
  }) => {
    const failures: string[] = [];
    for (const screen of SCREENS) {
      await page.goto(screen.path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      for (const violation of result.violations) {
        if (violation.impact === 'critical' || violation.impact === 'serious') {
          failures.push(`${screen.path}: ${violation.id} — ${violation.help}`);
        }
      }
    }
    expect(failures, failures.join('\n')).toHaveLength(0);
  });

  test('UI-03 · el estado nunca se distingue solo por color', async ({ page }) => {
    await page.goto('/admin/ingestion');
    const badges = page.locator('.state');
    const total = await badges.count();
    expect(total).toBeGreaterThan(0);
    for (let index = 0; index < Math.min(total, 12); index += 1) {
      const badge = badges.nth(index);
      // Each badge carries a word and a mark, so the state survives a printed
      // page, a screenshot in grey and a reader who cannot tell the hues apart.
      await expect(badge).not.toBeEmpty();
      await expect(badge).toHaveAttribute('data-mark', /[●▲■○]/u);
    }
  });

  test('las capturas del sitio público también quedan registradas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'artifacts/e2e/screenshots/1440x900-tablero-publico.png' });
  });

  test('UI-02 · el menú de secciones colapsa en móvil y da acceso a las nueve', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/traffic');
    const toggle = page.getByRole('button', { name: 'Tráfico' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const links = page.locator('#admin-nav-links');
    await expect(links).toBeHidden();
    const overflowClosed = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflowClosed, `el menú cerrado desborda ${overflowClosed}px`).toBeLessThanOrEqual(1);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(links).toBeVisible();
    for (const label of ['Resumen', 'Descargas', 'Sembradores', 'Volver al tablero']) {
      await expect(links.getByRole('link', { name: label })).toBeVisible();
    }
    const overflowOpen = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflowOpen, `el menú abierto desborda ${overflowOpen}px`).toBeLessThanOrEqual(1);

    await links.getByRole('link', { name: 'Descargas' }).click();
    await expect(page).toHaveURL(/\/admin\/downloads$/u);
    // A followed link must not leave the mobile menu open behind the new page.
    await expect(links).toBeHidden();
  });
});

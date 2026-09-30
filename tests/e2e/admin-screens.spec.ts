import { expect, test, type Page } from '@playwright/test';
import { queryOne } from './support/environment';
import { signIn } from './support/fixtures';

/**
 * UI-01 to UI-05: every screen, every control, and what the numbers agree with.
 *
 * The rule each case applies is the same: a figure on screen has to be one the
 * database can reproduce, and a control has to do what its label says. An empty
 * table says it is empty in words, because a blank area and a loading area look
 * identical and a reader will assume the friendlier of the two.
 */
const SECTIONS: ReadonlyArray<{ path: string; heading: string }> = [
  { path: '/admin', heading: 'Resumen operativo' },
  { path: '/admin/traffic', heading: 'Tráfico' },
  { path: '/admin/downloads', heading: 'Descargas' },
  { path: '/admin/health', heading: 'Disponibilidad' },
  { path: '/admin/ingestion', heading: 'Ingesta' },
  { path: '/admin/quality', heading: 'Calidad' },
  { path: '/admin/metadata', heading: 'Metadatos' },
  { path: '/admin/seeds', heading: 'Sembradores' },
  { path: '/admin/audit', heading: 'Auditoría' },
];

async function consoleProblems(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return problems;
}

test.describe('las pantallas del portal', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('UI-01 · cada sección responde, tiene título y se alcanza desde la navegación', async ({
    page,
  }) => {
    for (const section of SECTIONS) {
      await page.goto(section.path);
      await expect(
        page.getByRole('heading', { name: section.heading, level: 1 }),
        `la sección ${section.path} debe abrir`,
      ).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Secciones del portal' })).toBeVisible();
    }
  });

  test('UI-04 · ninguna sección deja errores en consola', async ({ page }) => {
    const problems = await consoleProblems(page);
    for (const section of SECTIONS) {
      await page.goto(section.path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    const unexpected = problems.filter(
      (message) => !message.includes('favicon') && !message.includes('Download the React DevTools'),
    );
    expect(unexpected, unexpected.join('\n')).toHaveLength(0);
  });

  test('UI-05 · un filtro sobrevive a la recarga y el enlace profundo lo conserva', async ({
    page,
  }) => {
    await page.goto('/admin/ingestion');
    await page.getByLabel('Estado').selectOption('FAILED');
    await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
    await page.waitForURL(/status=FAILED/u);
    await page.reload();
    await expect(page.getByLabel('Estado')).toHaveValue('FAILED');

    // The same address opened fresh shows the same selection.
    await page.goto('/admin/ingestion?status=FAILED');
    await expect(page.getByLabel('Estado')).toHaveValue('FAILED');
  });

  test('ING-04 y ING-05 · el estado de cada fuente sale del calendario que declara', async ({
    page,
  }) => {
    await page.goto('/admin/ingestion');
    const declared = await queryOne<{ total: string }>(
      'SELECT count(*)::text AS total FROM provenance.source',
    );
    const caption = page.locator('caption').first();
    await expect(caption).toContainText(`${declared?.total} fuentes`);

    // A source with no declared calendar reports «sin evidencia», never «al día».
    const withoutSchedule = await queryOne<{ total: string }>(
      `SELECT count(*)::text AS total FROM provenance.source source
        WHERE NOT EXISTS (
          SELECT 1 FROM operations.source_expectation expectation
           WHERE expectation.source_id = source.source_id)`,
    );
    if (Number(withoutSchedule?.total) > 0) {
      await expect(page.getByText('Sin evidencia').first()).toBeVisible();
    }
  });

  test('QLT-02 · la cobertura de reglas se muestra con su denominador', async ({ page }) => {
    await page.goto('/admin/quality');
    await expect(page.getByRole('heading', { name: 'Cobertura de reglas' })).toBeVisible();
    const declared = await queryOne<{ total: string }>(
      'SELECT count(*)::text AS total FROM quality_lineage.quality_rule',
    );
    await expect(page.locator('.admin-dl').first()).toContainText(declared?.total ?? '0');
  });

  test('META-02 · el catálogo en pantalla coincide con la base y marca lo referenciado', async ({
    page,
  }) => {
    await page.goto('/admin/metadata?catalog=frequencies');
    const stored = await queryOne<{ total: string }>(
      'SELECT count(*)::text AS total FROM semantic.frequency',
    );
    await expect(page.locator('caption')).toContainText(`${stored?.total} entradas`);

    await page.goto('/admin/metadata?catalog=sources');
    const sources = await queryOne<{ total: string }>(
      'SELECT count(*)::text AS total FROM provenance.source',
    );
    await expect(page.locator('caption')).toContainText(`${sources?.total} entradas`);
    // An entry something else points at is shown as protected rather than editable.
    await expect(page.getByText('Protegida').first()).toBeVisible();
  });

  test('HLT-03 · sin telemetría el sitio se reporta como desconocido, no como en pie', async ({
    page,
  }) => {
    await page.goto('/admin/health');
    const probes = await queryOne<{ total: string }>(
      'SELECT count(*)::text AS total FROM operations.health_probe',
    );
    if (Number(probes?.total) === 0) {
      await expect(page.getByText('Sin telemetría de disponibilidad')).toBeVisible();
      await page.goto('/admin');
      await expect(page.getByText('Sin telemetría')).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: 'Comprobaciones' })).toBeVisible();
    }
  });

  test('HLT-05 · una copia guardada sin construir se declara como tal', async ({ page }) => {
    await page.goto('/admin/health');
    const unbuilt = await queryOne<{ total: string }>(
      `SELECT count(*)::text AS total FROM pg_catalog.pg_class class
         JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
        WHERE namespace.nspname = 'read_models' AND class.relkind = 'm'
          AND NOT class.relispopulated`,
    );
    const label = Number(unbuilt?.total) > 0 ? 'Nunca construida' : 'Construida';
    await expect(page.getByText(label).first()).toBeVisible();
  });

  test('UI-03 · la navegación se recorre con el teclado y marca la página actual', async ({
    page,
  }) => {
    await page.goto('/admin/quality');
    const current = page.getByRole('link', { name: 'Calidad' });
    await expect(current).toHaveAttribute('aria-current', 'page');

    await page.goto('/admin');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent ?? '');
    expect(focused.length).toBeGreaterThan(0);
  });
});

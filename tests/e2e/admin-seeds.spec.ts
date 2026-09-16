import { expect, test } from '@playwright/test';
import { queryAll, queryOne } from './support/environment';
import { expectEventually, signIn } from './support/fixtures';

/**
 * The five layers a sensible action has to prove, on the one action that writes.
 *
 * A person clicks a real control; a real request leaves the browser; the core
 * authorises and validates it; the database holds the exact effect; and a
 * reload shows the same state. A test that stops at the first two proves that a
 * button is a button.
 */
const PACKAGE = 'core-catalogues';

interface LedgerRow extends Record<string, unknown> {
  package_code: string;
  package_version: string;
  checksum: string;
}

interface RunRow extends Record<string, unknown> {
  seed_run_id: string;
  status: string;
  operation: string;
  package_code: string;
}

/**
 * Waits until no reconciliation of the package is in flight.
 *
 * An identical request made while one is running is deliberately collapsed into
 * it — that is the idempotency SEED-03 requires — so a test that starts its own
 * reconciliation has to begin from a quiet register, or it will be watching the
 * previous test's run and drawing conclusions from it.
 */
async function waitForQuietPackage(code: string): Promise<void> {
  await expectEventually(
    () =>
      queryOne<{ total: string }>(
        `SELECT count(*)::text AS total FROM operations.seed_run
          WHERE package_code = $1 AND operation = 'RECONCILIATION'
            AND status IN ('QUEUED', 'RUNNING')`,
        [code],
      ),
    (row) => Number(row?.total) === 0,
    `quedó una reconciliación de ${code} en vuelo`,
  );
}

test.describe('consola de sembradores', () => {
  test.beforeEach(async ({ page }) => {
    await waitForQuietPackage(PACKAGE);
    await signIn(page);
  });

  test('SEED-01 · valida, muestra la diferencia, aplica y el registro lo confirma', async ({
    page,
  }) => {
    await page.goto('/admin/seeds');
    await expect(page.getByRole('heading', { name: 'Sembradores' })).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: PACKAGE });
    await expect(row).toBeVisible();

    // 1 and 2: a person clicks a real control and a real request goes out.
    const validation = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/admin/seeds/validations'),
    );
    await row.getByRole('button', { name: 'Validar', exact: true }).click();
    const validationResponse = await validation;
    expect(validationResponse.status()).toBe(200);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Checksum');

    const before = await queryOne<{ total: string }>(
      'SELECT count(*)::text AS total FROM operations.seed_run WHERE operation = $1',
      ['RECONCILIATION'],
    );

    // 3: the core authorises and validates the reconciliation itself.
    const accepted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/admin/seeds/reconciliations'),
    );
    await dialog.getByLabel('Motivo de la reconciliación').fill('prueba de extremo a extremo');
    await dialog.getByRole('button', { name: 'Aplicar esta diferencia', exact: true }).click();
    const acceptedResponse = await accepted;
    expect(acceptedResponse.status()).toBe(202);
    const body = (await acceptedResponse.json()) as {
      data: { seedRunId: string; accepted: boolean };
    };
    // `accepted: false` would mean this request attached to a run somebody else
    // started, and every assertion below would be about that run instead.
    expect(body.data.accepted).toBe(true);
    const seedRunId = body.data.seedRunId;
    expect(seedRunId).toMatch(/^[0-9a-f-]{36}$/u);

    // The screen does not claim the data is applied while the run is open.
    await expect(dialog).toContainText('esto no es una confirmación');

    // 4: the database holds the exact effect, and only one new run exists.
    const settled = await expectEventually(
      () =>
        queryOne<RunRow>(
          'SELECT seed_run_id, status, operation, package_code FROM operations.seed_run WHERE seed_run_id = $1',
          [seedRunId],
        ),
      (run) => Boolean(run && !['QUEUED', 'RUNNING'].includes(run.status)),
      'la ejecución de siembra no alcanzó un estado terminal',
    );
    expect(['SUCCEEDED', 'PARTIAL']).toContain(settled?.status);

    const after = await queryOne<{ total: string }>(
      'SELECT count(*)::text AS total FROM operations.seed_run WHERE operation = $1',
      ['RECONCILIATION'],
    );
    expect(Number(after?.total)).toBe(Number(before?.total) + 1);

    const ledger = await queryAll<LedgerRow>(
      'SELECT package_code, package_version, checksum FROM operations.seed_application WHERE package_code = $1',
      [PACKAGE],
    );
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.checksum).toMatch(/^[a-f0-9]{64}$/u);

    // And the catalogue the package owns really is in the database.
    const frequencies = await queryOne<{ total: string }>(
      'SELECT count(*)::text AS total FROM semantic.frequency',
    );
    expect(Number(frequencies?.total)).toBeGreaterThan(0);

    // 5: a reload shows the same state, read from the register.
    await page.goto(`/admin/seeds/runs/${seedRunId}`);
    await expect(page.getByRole('heading', { name: 'Ejecución de siembra' })).toBeVisible();
    await expect(page.locator('.admin-dl')).toContainText(PACKAGE);
    await page.reload();
    await expect(page.locator('.admin-dl')).toContainText(PACKAGE);
  });

  test('SEED-08 · una fila editada a mano aparece como modificada y no se sobrescribe al validar', async ({
    page,
  }) => {
    await queryOne(`UPDATE semantic.frequency SET name = 'Editada en la prueba' WHERE code = 'A'`);

    await page.goto('/admin/seeds');
    const row = page.getByRole('row').filter({ hasText: PACKAGE });
    const validation = page.waitForResponse((response) =>
      response.url().includes('/api/admin/seeds/validations'),
    );
    await row.getByRole('button', { name: 'Validar', exact: true }).click();
    await validation;

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('modificados');
    await expect(dialog.getByText('Frecuencias: campos que difieren')).toBeVisible();

    // Validation never writes: the hand edit is still there afterwards.
    const stored = await queryOne<{ name: string }>(
      `SELECT name FROM semantic.frequency WHERE code = 'A'`,
    );
    expect(stored?.name).toBe('Editada en la prueba');

    // Applying repairs it, because this package owns that field.
    await dialog.getByLabel('Motivo de la reconciliación').fill('reparar la edición de prueba');
    const accepted = page.waitForResponse((response) =>
      response.url().includes('/api/admin/seeds/reconciliations'),
    );
    await dialog.getByRole('button', { name: 'Aplicar esta diferencia', exact: true }).click();
    const response = await accepted;
    const body = (await response.json()) as {
      data: { seedRunId: string; accepted: boolean };
    };
    expect(body.data.accepted).toBe(true);

    await expectEventually(
      () =>
        queryOne<RunRow>('SELECT status FROM operations.seed_run WHERE seed_run_id = $1', [
          body.data.seedRunId,
        ]),
      (run) => Boolean(run && !['QUEUED', 'RUNNING'].includes(run.status)),
      'la reparación no terminó',
    );
    const repaired = await queryOne<{ name: string }>(
      `SELECT name FROM semantic.frequency WHERE code = 'A'`,
    );
    expect(repaired?.name).not.toBe('Editada en la prueba');
  });

  test('SEED-07 · el paquete de demostración se rechaza y no escribe nada', async ({ page }) => {
    await page.goto('/admin/seeds');
    const row = page.getByRole('row').filter({ hasText: 'observatory-demo' });
    await expect(row).toBeVisible();
    // The console does not offer an action the deployment would refuse.
    await expect(row.getByRole('button', { name: 'Validar', exact: true })).toBeDisabled();

    const applied = await queryOne<{ total: string }>(
      `SELECT count(*)::text AS total FROM operations.seed_application WHERE package_code = 'observatory-demo'`,
    );
    expect(applied?.total).toBe('0');
  });

  test('el diálogo devuelve el foco y se cierra con Escape', async ({ page }) => {
    await page.goto('/admin/seeds');
    const row = page.getByRole('row').filter({ hasText: PACKAGE });
    const opener = row.getByRole('button', { name: 'Validar', exact: true });
    const validation = page.waitForResponse((response) =>
      response.url().includes('/api/admin/seeds/validations'),
    );
    await opener.click();
    await validation;

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });
});

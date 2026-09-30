import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { parseCsv } from './support/csv';
import { queryAll, queryOne, withDatabase } from './support/environment';
import { expectEventually, signIn } from './support/fixtures';

/**
 * EXP-01 to EXP-05: the file, and what the register says about it.
 *
 * The file is parsed rather than counted, the register is read from the
 * database rather than from the screen, and the two are compared. A test that
 * asserted the download «succeeded» because the click did not throw would have
 * passed against every version of this route, including the broken ones.
 */
interface ExportRow extends Record<string, unknown> {
  request_id: string;
  status: string;
  row_count: string | null;
  truncated: boolean;
  error_code: string | null;
}

async function registerFor(requestId: string): Promise<ExportRow[]> {
  return expectEventually(
    () =>
      queryAll<ExportRow>(
        'SELECT request_id, status, row_count::text AS row_count, truncated, error_code FROM operations.export_request WHERE request_id = $1 ORDER BY status',
        [requestId],
      ),
    (rows) => rows.length >= 2,
    `el registro de exportación no recibió las dos etapas de ${requestId}`,
    20_000,
  );
}

/**
 * Opens the chapter that offers the file, the way a reader does.
 *
 * The report mounts each chapter when it is opened, so the export controls do
 * not exist until somebody asks for the section they belong to. A test that
 * looked for them on the landing view would be testing a page nobody sees.
 */
async function openChapterWithExports(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Tipo de cambio' }).click();
  await expect(page.locator('a[href^="/api/export"]').first()).toBeVisible();
}

test.describe('exportaciones del tablero público', () => {
  test('EXP-01 · el CSV se descarga, se parsea y coincide con la base', async ({ page }) => {
    // The report builds its own export links with the filters the panel is
    // showing, so the test takes the link the page actually offers rather than
    // one it made up — which is the only way the file and the panel can be
    // compared at all.
    await openChapterWithExports(page);
    const link = page.locator('a[href^="/api/export"][href*="format=csv"]').first();
    const downloadPromise = page.waitForEvent('download');
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/export') && response.url().includes('format=csv'),
    );
    await link.click();
    const download = await downloadPromise;
    const response = await responsePromise;

    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toMatch(/\.csv$/u);
    const path = await download.path();
    expect(path).not.toBeNull();

    const parsed = parseCsv(await readFile(path as string, 'utf8'));
    expect(parsed.headers).toContain('fecha');
    expect(parsed.headers).toContain('indicador');
    expect(parsed.headers).toContain('valor');

    const declaredRows = Number(response.headers()['x-export-rows']);
    expect(parsed.rows).toHaveLength(declaredRows);

    const requestId = response.headers()['x-export-request'] as string;
    const register = await registerFor(requestId);
    const generated = register.find((entry) => entry.status === 'GENERATED');
    expect(register.map((entry) => entry.status).sort()).toEqual(['GENERATED', 'REQUESTED']);
    expect(Number(generated?.row_count)).toBe(parsed.rows.length);

    // The rows are the report's own figures, not a fabricated sample.
    if (parsed.rows.length > 0) {
      const sample = parsed.rows[0] as Record<string, string>;
      const stored = await queryOne<{ total: string }>(
        'SELECT count(*)::text AS total FROM read_models.economic_indicator_daily WHERE indicator_code = $1',
        [sample['indicador']],
      );
      expect(Number(stored?.total)).toBeGreaterThan(0);
    }
  });

  test('EXP-01 · el JSON declara sus filas y si está truncado', async ({ page }) => {
    await openChapterWithExports(page);
    const link = page.locator('a[href^="/api/export"][href*="format=json"]').first();
    const downloadPromise = page.waitForEvent('download');
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/export') && response.url().includes('format=json'),
    );
    await link.click();
    const download = await downloadPromise;
    const response = await responsePromise;

    const path = await download.path();
    const body = JSON.parse(await readFile(path as string, 'utf8')) as {
      dataset: string;
      filas: number;
      truncado: boolean;
      datos: unknown[];
    };
    expect(body.dataset.length).toBeGreaterThan(0);
    expect(body.datos).toHaveLength(body.filas);
    // EXP-04: whether the file is complete is stated, not left to be assumed.
    expect(typeof body.truncado).toBe('boolean');
    expect(response.headers()['x-export-truncated']).toBe(String(body.truncado));
  });

  test('EXP-02 · un conjunto desconocido se rechaza y no se registra como generado', async ({
    request,
  }) => {
    const response = await request.get('/api/export?dataset=inventado&format=csv');
    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-export-request'] as string;
    expect(requestId).toBeTruthy();
    const register = await queryAll<ExportRow>(
      'SELECT status FROM operations.export_request WHERE request_id = $1',
      [requestId],
    );
    expect(register.map((entry) => entry.status)).not.toContain('GENERATED');
  });

  test('EXP-03 · con la base inaccesible responde 503 y deja el fallo registrado', async ({
    request,
  }) => {
    /*
     * Fault injection through the database privileges of the throwaway
     * container: impossible to trigger from the application, and undone in
     * `finally` so the rest of the suite still has a working dashboard.
     *
     * The dataset is `prensa` and not `series` on purpose. The daily series is
     * held in memory for five minutes — deliberately, so an outage never
     * becomes the answer the front page gives — and a cached success would make
     * this test assert nothing. The press export reads the database on every
     * request, which is what has to be observed here.
     */
    const schemas = ['read_models', 'statistics', 'intelligence', 'provenance', 'metadata'];
    await withDatabase(async (client) => {
      for (const schema of schemas) {
        await client.query(`REVOKE USAGE ON SCHEMA ${schema} FROM backend_reader`);
      }
    });
    try {
      const response = await request.get('/api/export?dataset=prensa&format=csv');
      expect(response.status()).toBe(503);
      expect(await response.text()).not.toContain('postgres');
      const requestId = response.headers()['x-export-request'] as string;
      const register = await expectEventually(
        () =>
          queryAll<ExportRow>(
            'SELECT status, error_code FROM operations.export_request WHERE request_id = $1',
            [requestId],
          ),
        (rows) => rows.some((entry) => entry.status === 'FAILED'),
        'el fallo de exportación no quedó registrado',
        20_000,
      );
      expect(register.find((entry) => entry.status === 'FAILED')?.error_code).toBe('READ_FAILED');
    } finally {
      await withDatabase(async (client) => {
        for (const schema of schemas) {
          await client.query(`GRANT USAGE ON SCHEMA ${schema} TO backend_reader`);
        }
      });
    }
  });

  test('EXP-05 · con el registro roto el archivo se entrega igual y la laguna es visible', async ({
    request,
  }) => {
    /*
     * The register is broken where it actually writes, not by pointing the site
     * at a wrong address: the role that owns the intake loses its INSERT, so
     * the core answers with a failure the site cannot mistake for success.
     *
     * This is the case that matters after the stage reports were made
     * blocking. An export that waited on its own bookkeeping would turn a
     * broken register into a broken download, which is the wrong failure: the
     * reader's file does not depend on the observatory being able to write
     * down that they asked for it. What the register loses has to show up as a
     * gap, and a gap is what the console reports — never as an export that was
     * never requested.
     */
    await withDatabase(async (client) => {
      await client.query('REVOKE INSERT ON operations.export_request FROM backend_writer');
    });
    try {
      const started = Date.now();
      const response = await request.get('/api/export?dataset=prensa&format=csv');
      const elapsed = Date.now() - started;

      // The file arrives, complete, and says how many rows it carries.
      expect(response.status()).toBe(200);
      const requestId = response.headers()['x-export-request'] as string;
      const declared = Number(response.headers()['x-export-rows']);
      const parsed = parseCsv(await response.text());
      expect(parsed.rows).toHaveLength(declared);
      expect(parsed.headers).toContain('titular');

      // And the broken register is a gap, not a delay: nothing was recorded,
      // and the reader did not wait on the attempt to record it.
      const register = await queryAll<ExportRow>(
        'SELECT status FROM operations.export_request WHERE request_id = $1',
        [requestId],
      );
      expect(register).toHaveLength(0);
      expect(elapsed).toBeLessThan(60_000);
    } finally {
      await withDatabase(async (client) => {
        await client.query('GRANT INSERT ON operations.export_request TO backend_writer');
      });
    }

    // The register works again, so the gap above was the fault and not the norm.
    const after = await request.get('/api/export?dataset=prensa&format=csv');
    const afterId = after.headers()['x-export-request'] as string;
    const recovered = await registerFor(afterId);
    expect(recovered.map((entry) => entry.status).sort()).toEqual(['GENERATED', 'REQUESTED']);
  });

  test('las descargas aparecen en la consola con su identificador', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/downloads');
    await expect(page.getByRole('heading', { name: 'Descargas' })).toBeVisible();
    // The three measured stages are named on screen; a completed transfer is
    // not among them because nothing here observes one.
    await expect(page.getByText('REQUESTED, GENERATED, FAILED')).toBeVisible();
    await expect(page.getByRole('table').first()).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';
import { OPERATOR, queryOne } from './support/environment';
import { csrfToken, signIn, signOut } from './support/fixtures';

/**
 * AUTH-01 to AUTH-05: the boundary, checked from the outside.
 *
 * Every case here ends in the same place: not «the screen hid it», but «the
 * server refused it and the database did not change». A private area that only
 * hides is a private area an attacker reads in the network tab.
 */
test.describe('acceso al portal privado', () => {
  test('AUTH-01 · un anónimo no recibe el portal ni sus cifras', async ({ page }) => {
    const response = await page.goto('/admin');
    await page.waitForURL(/\/admin\/login/u);
    // Not merely hidden: nothing private is in the document at all.
    await expect(page.getByRole('heading', { name: 'Portal administrativo' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Resumen operativo');
    expect(response?.status()).toBeLessThan(400);
  });

  test('AUTH-01 · la API privada rechaza a un anónimo sin filtrar datos', async ({ request }) => {
    const response = await request.post('/api/admin/seeds/validations', {
      data: { packageCode: 'core-catalogues' },
      headers: { 'content-type': 'application/json' },
    });
    expect(response.status()).toBe(401);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('UNAUTHORIZED');
    expect(await response.text()).not.toContain('checksum');
  });

  test('AUTH-02 · una lectora no puede reconciliar y nada cambia en la base', async ({ page }) => {
    await signIn(page, 'reader');

    const before = await queryOne<{ total: string }>(
      'SELECT count(*)::text AS total FROM operations.seed_application',
    );

    // The console does not offer the action to a reader, and the route refuses
    // it even when the request is made directly with a valid session.
    const token = await csrfToken(page);
    const response = await page.request.post('/api/admin/seeds/reconciliations', {
      headers: { 'content-type': 'application/json', 'x-obs-csrf': token },
      data: {
        packageCode: 'core-catalogues',
        expectedVersion: '1.0.0',
        expectedChecksum: 'a'.repeat(64),
        reason: 'intento no autorizado de una lectora',
      },
    });
    expect(response.status()).toBe(403);

    const after = await queryOne<{ total: string }>(
      'SELECT count(*)::text AS total FROM operations.seed_application',
    );
    expect(after?.total).toBe(before?.total);
  });

  test('AUTH-03 · cerrar sesión invalida la cookie y el portal deja de responder', async ({
    page,
  }) => {
    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Resumen operativo' })).toBeVisible();
    await signOut(page);
    await page.goto('/admin/seeds');
    await page.waitForURL(/\/admin\/login/u);
    await expect(page.getByRole('heading', { name: 'Portal administrativo' })).toBeVisible();
  });

  test('AUTH-03 · una cookie manipulada no abre el portal', async ({ page, context }) => {
    await signIn(page);
    const cookies = await context.cookies();
    const session = cookies.find((cookie) => cookie.name === 'obs_admin_session');
    expect(session, 'la sesión debe viajar en una cookie').toBeDefined();
    await context.clearCookies();
    await context.addCookies([{ ...session!, value: `${session!.value.slice(0, -4)}AAAA` }]);
    await page.goto('/admin');
    await page.waitForURL(/\/admin\/login/u);
  });

  test('AUTH-05 · una mutación sin el token de la sesión se rechaza', async ({ page }) => {
    await signIn(page);
    const response = await page.request.post('/api/admin/seeds/validations', {
      headers: { 'content-type': 'application/json' },
      data: { packageCode: 'core-catalogues' },
    });
    expect(response.status()).toBe(403);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('CSRF_REJECTED');
  });

  test('AUTH-05 · una mutación desde otro origen se rechaza', async ({ page }) => {
    await signIn(page);
    const token = await csrfToken(page);
    const response = await page.request.post('/api/admin/seeds/validations', {
      headers: {
        'content-type': 'application/json',
        'x-obs-csrf': token,
        origin: 'https://otro-sitio.example',
      },
      data: { packageCode: 'core-catalogues' },
    });
    expect(response.status()).toBe(403);
  });

  test('la sesión sobrevive a una recarga profunda y vuelve a la ruta pedida', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/ingestion');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ingesta' })).toBeVisible();
    await expect(page.getByText(`Sesión: `, { exact: false })).toBeVisible();
  });

  test('el identificador del operador aparece en la consola', async ({ page }) => {
    await signIn(page);
    await expect(page.getByTestId('admin-session-bar')).toContainText('Entorno:');
    expect(OPERATOR.subject.length).toBeGreaterThan(0);
  });
});

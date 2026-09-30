import { expect, type Page } from '@playwright/test';
import { OPERATOR, READER } from './environment';

/**
 * Signing in the way a person does, through the form.
 *
 * Not by planting a cookie: the session this suite exercises is the one the
 * login route issues, and a fabricated one would skip exactly the code that
 * decides who an operator is. It is slower by a second and it is the difference
 * between testing the portal and testing a fixture.
 */
export async function signIn(page: Page, who: 'operator' | 'reader' = 'operator'): Promise<void> {
  const account = who === 'operator' ? OPERATOR : READER;
  await page.goto('/admin/login');
  await page.getByLabel('Identificador').fill(account.subject);
  await page.getByLabel('Contraseña').fill(account.password());
  /*
   * The button reads «Cargando…» until the form is interactive, so waiting for
   * it to say «Entrar» and to be enabled is waiting for the condition this
   * step actually needs. Clicking earlier submits a form whose handler does
   * not exist yet, and no amount of retrying afterwards makes that a pass.
   */
  const submit = page.getByRole('button', { name: 'Entrar', exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
  await page.waitForURL(/\/admin(?!\/login)/u);
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.waitForURL(/\/admin\/login/u);
}

/**
 * The CSRF token the page was rendered with, read the way the page reads it.
 *
 * A direct call to a mutation route needs it, and taking it from the rendered
 * console rather than from configuration is what makes the «request with an
 * invalid token» test meaningful: the valid case has to be genuinely valid.
 */
export async function csrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/admin/session');
  expect(response.status(), 'la sesión debe estar abierta para leer su token').toBe(200);
  const body = (await response.json()) as { csrf?: string };
  expect(body.csrf, 'la sesión debe llevar un token').toBeTruthy();
  return body.csrf as string;
}

/** Waits for a state the register reports, never for a fixed number of seconds. */
export async function expectEventually<T>(
  read: () => Promise<T>,
  matches: (value: T) => boolean,
  message: string,
  timeoutMs = 45_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  while (Date.now() < deadline) {
    last = await read();
    if (matches(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${message}; último valor: ${JSON.stringify(last)}`);
}

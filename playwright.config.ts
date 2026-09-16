import { defineConfig, devices } from '@playwright/test';

/**
 * The suite runs against real services or it does not run.
 *
 * `E2E_BASE_URL` points at a dashboard that is talking to a real core and a
 * real PostgreSQL. Nothing in `tests/e2e/integration` is allowed to intercept a
 * request and answer it itself: a screenshot of a mocked screen proves that a
 * component renders, which was never the thing in doubt.
 *
 * `retries: 0` on purpose. A test that passes on the second attempt is a race
 * nobody has looked at, and this is a portal whose whole subject is telling
 * «it worked» apart from «it looked like it worked».
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Serial: the suite mutates one database, and two workers reconciling the
  // same package would be testing the lock rather than the screen.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/e2e/report', open: 'never' }],
    ['json', { outputFile: 'artifacts/e2e/results.json' }],
  ],
  outputDir: 'artifacts/e2e/output',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3211',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      // The second engine covers the journeys a rendering difference would
      // break — login, navigation, filters, modal, download — and not the whole
      // operational matrix, which would double the run for no new information.
      testMatch: /(admin-auth|admin-exports)\.spec\.ts/u,
    },
  ],
});

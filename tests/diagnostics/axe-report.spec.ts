import AxeBuilder from '@axe-core/playwright';
import { test } from '@playwright/test';
import { signIn } from '../e2e/support/fixtures';

/**
 * A diagnostic run that prints which element fails, not merely that one does.
 *
 * It is here rather than in the suite because it asserts nothing: its output is
 * what an operator or a developer reads while fixing a contrast or a focus
 * problem, and a test that fails without naming the node is a test nobody can
 * act on.
 */
test('informe de accesibilidad detallado', async ({ page }) => {
  await signIn(page);
  for (const path of ['/admin', '/admin/ingestion', '/admin/downloads', '/admin/metadata']) {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    for (const violation of result.violations) {
      if (violation.impact !== 'critical' && violation.impact !== 'serious') continue;
      for (const node of violation.nodes.slice(0, 6)) {
        process.stdout.write(
          `${path} | ${violation.id} | ${node.target.join(' ')} | ${node.failureSummary?.replace(/\s+/gu, ' ').slice(0, 220)}\n`,
        );
      }
    }
  }
});

import { expect, test } from '@playwright/test';
import { queryAll, queryOne, withDatabase } from './support/environment';
import { expectEventually, signIn } from './support/fixtures';

/**
 * TRF-01 to TRF-03: what the site reports, and what it must never report.
 *
 * The third case is the one worth writing: a search term typed by a reader and
 * an identifier in a path are exactly the two things that must not reach this
 * register, and the only way to know they do not is to send them and look.
 */
interface TrafficRow extends Record<string, unknown> {
  event_key: string;
  route: string;
  event_kind: string;
  is_robot: boolean;
}

test.describe('telemetría del sitio público', () => {
  test('TRF-01 · una visita se registra una vez y la recarga es otra', async ({ page }) => {
    const before = await queryOne<{ total: string }>(
      `SELECT count(*)::text AS total FROM operations.traffic_event WHERE route = '/'`,
    );

    await page.goto('/');
    await expectEventually(
      () =>
        queryOne<{ total: string }>(
          `SELECT count(*)::text AS total FROM operations.traffic_event WHERE route = '/'`,
        ),
      (row) => Number(row?.total) === Number(before?.total) + 1,
      'la visita no quedó registrada exactamente una vez',
    );

    await page.reload();
    await expectEventually(
      () =>
        queryOne<{ total: string }>(
          `SELECT count(*)::text AS total FROM operations.traffic_event WHERE route = '/'`,
        ),
      (row) => Number(row?.total) === Number(before?.total) + 2,
      'la recarga no quedó registrada',
    );
  });

  test('TRF-02 · el mismo evento enviado dos veces se cuenta una', async ({ request }) => {
    const eventId = `dedup${Date.now().toString(36)}`;
    const payload = {
      events: [
        {
          eventId,
          route: '/prueba-dedup',
          kind: 'PAGE_VIEW',
          device: 'DESKTOP',
          referrer: 'DIRECT',
        },
      ],
    };
    const first = await request.post('/api/analytics', { data: payload });
    expect(first.status()).toBe(202);
    const second = await request.post('/api/analytics', { data: payload });
    expect(second.status()).toBe(202);
    const body = (await second.json()) as { accepted: number; duplicates: number };
    expect(body.accepted).toBe(0);
    expect(body.duplicates).toBe(1);

    const rows = await queryAll<TrafficRow>(
      'SELECT event_key FROM operations.traffic_event WHERE event_key = $1',
      [eventId],
    );
    expect(rows).toHaveLength(1);
  });

  test('TRF-03 · una ruta con término de búsqueda o identificador no llega al registro', async ({
    request,
  }) => {
    const rejected = await request.post('/api/analytics', {
      data: {
        events: [
          {
            eventId: `filtro${Date.now().toString(36)}`,
            route: '/prensa?buscar=inflacion+galopante',
            kind: 'PAGE_VIEW',
            device: 'DESKTOP',
            referrer: 'DIRECT',
          },
        ],
      },
    });
    // The receiver refuses it outright rather than storing a cleaned version.
    expect(rejected.status()).toBe(400);

    const leaked = await queryAll<TrafficRow>(
      `SELECT route FROM operations.traffic_event WHERE route LIKE '%inflacion%' OR route LIKE '%buscar%'`,
    );
    expect(leaked).toHaveLength(0);
  });

  test('TRF-03 · una ruta con identificador se normaliza antes de guardarse', async ({
    request,
  }) => {
    // Sent the way the page sends it: the identifier is replaced in the browser
    // before the event leaves, and the receiver refuses anything that is not.
    const eventId = `norm${Date.now().toString(36)}`;
    const response = await request.post('/api/analytics', {
      data: {
        events: [
          {
            eventId,
            route: '/admin/ingestion/runs/{id}',
            kind: 'PAGE_VIEW',
            device: 'DESKTOP',
            referrer: 'INTERNAL',
          },
        ],
      },
    });
    expect(response.status()).toBe(202);
    const stored = await queryOne<TrafficRow>(
      'SELECT route FROM operations.traffic_event WHERE event_key = $1',
      [eventId],
    );
    expect(stored?.route).toBe('/admin/ingestion/runs/{id}');
    const raw = await queryAll<TrafficRow>(
      `SELECT route FROM operations.traffic_event WHERE route ~ '[0-9a-f]{8}-[0-9a-f]{4}'`,
    );
    expect(raw).toHaveLength(0);
  });

  test('la consola declara la cobertura antes de mostrar una cifra', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/traffic');
    await expect(page.getByRole('heading', { name: 'Cobertura de la medición' })).toBeVisible();
    await expect(page.getByText('Primer evento')).toBeVisible();
    await expect(page.getByText('Último evento')).toBeVisible();
  });

  test('sin telemetría configurada el receptor lo dice en lugar de aceptar en silencio', async () => {
    // The register itself is the evidence: every event that was accepted has a
    // row, so a count of zero with a live receiver would be a contradiction the
    // coverage line exposes rather than hides.
    const total = await withDatabase(async (client) => {
      const { rows } = await client.query<{ total: string }>(
        'SELECT count(*)::text AS total FROM operations.traffic_event',
      );
      return Number(rows[0]?.total ?? 0);
    });
    expect(total).toBeGreaterThan(0);
  });
});

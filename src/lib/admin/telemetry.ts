import 'server-only';
import { callCore } from './core-client';
import type { AdminSession } from './session';

/**
 * The identity the site reports on itself with.
 *
 * It is a session in shape only: nobody logs in as it, it carries one role, and
 * that role can write a page view and nothing else. Reporting telemetry under
 * the collector role would have been shorter and would have meant a compromised
 * web tier could submit economic observations.
 */
function siteIdentity(): AdminSession {
  return {
    subject: process.env.SITE_TELEMETRY_SUBJECT ?? 'observatorio-dashboard',
    name: 'Sitio público',
    roles: ['SITE_TELEMETRY'],
    expiresAt: Math.floor(Date.now() / 1000) + 120,
    csrf: '',
  };
}

export interface TrafficEvent {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly route: string;
  readonly kind: 'PAGE_VIEW' | 'DOWNLOAD_INTENT';
  readonly device: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN';
  readonly referrer: 'DIRECT' | 'SEARCH' | 'SOCIAL' | 'EXTERNAL' | 'INTERNAL';
  readonly visitorBucket: string;
  readonly isRobot: boolean;
}

export interface ExportEvent {
  readonly requestId: string;
  readonly datasetCode: string;
  readonly format: 'csv' | 'json';
  readonly status: 'REQUESTED' | 'GENERATED' | 'FAILED';
  readonly filters: Record<string, string>;
  readonly rowCount?: number;
  readonly byteCount?: number;
  readonly durationMs?: number;
  readonly truncated?: boolean;
  readonly errorCode?: string;
}

/**
 * How long a stage report may hold the export path before it is given up on.
 *
 * The call is to a service on the same deployment and normally answers in
 * milliseconds. The ceiling exists for the case where it does not: a reader's
 * download must not wait on a register, and a register must not be the reason a
 * file never arrives.
 */
const REPORT_CEILING_MS = 2_000;

/**
 * Reports an export stage without ever being able to fail the export.
 *
 * A file the reader asked for must not be withheld because a register did not
 * answer, so every failure here is swallowed and shows up as a gap in coverage
 * — which the traffic screen states rather than hides.
 *
 * The caller awaits this, under the ceiling above, rather than leaving it to
 * run after the response. Post-response work is not guaranteed to happen: left
 * floating it was lost every time, and handed to `after` it was still lost
 * under a burst. A register that drops stages is worse than one that costs a
 * few milliseconds, because the gaps read as exports nobody asked for.
 */
export async function reportExport(event: ExportEvent): Promise<void> {
  if (!process.env.CORE_API_URL || !process.env.ADMIN_JWT_PRIVATE_KEY) return;
  const result = await callCore('/api/v1/admin/analytics/exports', siteIdentity(), {
    method: 'POST',
    body: { truncated: false, ...event },
    timeoutMs: REPORT_CEILING_MS,
  });
  if (!result.ok) {
    console.warn('[observatorio] no se registró la exportación', result.code);
  }
}

export async function reportTraffic(
  events: readonly TrafficEvent[],
): Promise<{ accepted: number; duplicates: number } | null> {
  if (!process.env.CORE_API_URL || !process.env.ADMIN_JWT_PRIVATE_KEY) return null;
  const result = await callCore<{ accepted: number; duplicates: number }>(
    '/api/v1/admin/analytics/traffic',
    siteIdentity(),
    { method: 'POST', body: { events } },
  );
  return result.ok ? result.body.data : null;
}

export function telemetryIsConfigured(): boolean {
  return Boolean(process.env.CORE_API_URL && process.env.ADMIN_JWT_PRIVATE_KEY);
}

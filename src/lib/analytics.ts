/**
 * What the page reports about itself, and how little it is.
 *
 * Three rules this file exists to keep. The route is normalised before it
 * leaves the browser, so an identifier in a path never becomes a thousand
 * distinct rows and a search term never travels at all. Every event carries an
 * identifier, so a retry after a flaky send is counted once. And the send never
 * blocks anything: it uses `sendBeacon` where the browser has it, and a
 * best-effort `fetch` where it does not, and a failure is simply a visit that
 * was not recorded — which the traffic screen reports as coverage rather than
 * as a zero.
 */

export type TrafficKind = 'PAGE_VIEW' | 'DOWNLOAD_INTENT';

export interface ReportedEvent {
  readonly eventId: string;
  readonly route: string;
  readonly kind: TrafficKind;
  readonly device: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN';
  readonly referrer: 'DIRECT' | 'SEARCH' | 'SOCIAL' | 'EXTERNAL' | 'INTERNAL';
}

const SEARCH_HOSTS = /(google|bing|duckduckgo|yahoo|ecosia|brave|yandex)\./iu;
const SOCIAL_HOSTS = /(facebook|twitter|x\.com|instagram|linkedin|t\.co|whatsapp|telegram)/iu;

/**
 * Reduces a path to something an aggregate can be grouped by.
 *
 * A numeric or hexadecimal segment becomes a placeholder, the query string is
 * dropped entirely, and anything longer than a sensible path is truncated. The
 * result is a route, not a URL.
 */
export function normalizeRoute(pathname: string): string {
  const withoutQuery = pathname.split('?')[0] ?? '';
  const segments = (withoutQuery.split('#')[0] ?? '')
    .split('/')
    .filter(Boolean)
    .map((segment) =>
      /^[0-9]+$/u.test(segment) || /^[0-9a-f-]{16,}$/iu.test(segment) ? '{id}' : segment,
    )
    .map((segment) => segment.replace(/[^A-Za-z0-9\-_{}]/gu, '').slice(0, 40))
    .filter(Boolean);
  const route = `/${segments.join('/')}`;
  return route.length > 120 ? `${route.slice(0, 118)}/…`.replace('…', '') : route;
}

export function classifyDevice(width: number, coarsePointer: boolean): ReportedEvent['device'] {
  if (!coarsePointer) return 'DESKTOP';
  return width >= 768 ? 'TABLET' : 'MOBILE';
}

/** Where the visit came from, as a family — never the referring URL itself. */
export function classifyReferrer(referrer: string, ownHost: string): ReportedEvent['referrer'] {
  if (!referrer) return 'DIRECT';
  try {
    const { hostname } = new URL(referrer);
    if (hostname === ownHost) return 'INTERNAL';
    if (SEARCH_HOSTS.test(hostname)) return 'SEARCH';
    if (SOCIAL_HOSTS.test(hostname)) return 'SOCIAL';
    return 'EXTERNAL';
  } catch {
    return 'DIRECT';
  }
}

function newEventId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return random.replace(/-/gu, '').slice(0, 32);
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Builds the event for the page currently on screen. */
export function describeVisit(kind: TrafficKind = 'PAGE_VIEW'): ReportedEvent | null {
  if (typeof window === 'undefined') return null;
  return {
    eventId: newEventId(),
    route: normalizeRoute(window.location.pathname),
    kind,
    device: classifyDevice(
      window.innerWidth,
      window.matchMedia?.('(pointer: coarse)').matches ?? false,
    ),
    referrer: classifyReferrer(document.referrer, window.location.hostname),
  };
}

/**
 * Sends without holding anything up, and without caring whether it arrived.
 *
 * `sendBeacon` survives the page being closed, which is exactly when a download
 * intent is reported. When it is missing or refuses, a keepalive `fetch` is the
 * fallback, and when that fails too the event is simply lost.
 */
export function report(event: ReportedEvent | null): void {
  if (!event || typeof window === 'undefined') return;
  const payload = JSON.stringify({ events: [event] });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon('/api/analytics', blob)) return;
    }
    void fetch('/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Measurement must never break the page it is measuring.
  }
}

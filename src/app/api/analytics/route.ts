import { reportTraffic, telemetryIsConfigured, type TrafficEvent } from '@/lib/admin/telemetry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What the public page is allowed to say about a visit, and nothing more.
 *
 * The shape is closed and every field is checked here, on the server, because
 * the browser is not a trusted narrator: a route that arrived with a search
 * term in it would put a reader's words into a register that was never meant
 * to hold them, and an identifier left in a path would make every aggregate
 * unusable by exploding its cardinality.
 *
 * Three things this route never receives and therefore never stores: the
 * address of the visitor, the query string of the page, and anything that
 * identifies a person across days. The visitor bucket is derived on the server
 * from the day and a secret, so two visits a day apart cannot be joined.
 */
const ROUTE = /^\/[A-Za-z0-9\-_/{}]{0,120}$/u;
const EVENT_ID = /^[A-Za-z0-9_-]{8,64}$/u;
const KINDS = new Set(['PAGE_VIEW', 'DOWNLOAD_INTENT']);
const DEVICES = new Set(['DESKTOP', 'MOBILE', 'TABLET', 'UNKNOWN']);
const REFERRERS = new Set(['DIRECT', 'SEARCH', 'SOCIAL', 'EXTERNAL', 'INTERNAL']);
const MAX_EVENTS = 20;

interface Incoming {
  eventId?: unknown;
  route?: unknown;
  kind?: unknown;
  device?: unknown;
  referrer?: unknown;
}

const ROBOT = /bot|crawler|spider|crawling|headlesschrome|lighthouse|playwright/iu;

export async function POST(request: Request): Promise<Response> {
  if (!telemetryIsConfigured()) {
    // Saying so plainly is the point: a receiver that quietly accepts and
    // discards produces a screen that reports zero visits and looks healthy.
    return Response.json(
      { accepted: 0, reason: 'La telemetría no está configurada en este despliegue' },
      { status: 202, headers: { 'cache-control': 'no-store' } },
    );
  }
  let body: { events?: unknown };
  try {
    body = (await request.json()) as { events?: unknown };
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return Response.json({ error: 'No se recibió ningún evento' }, { status: 400 });
  }

  const userAgent = request.headers.get('user-agent') ?? '';
  const isRobot = ROBOT.test(userAgent);
  const bucket = await visitorBucket(request);
  const occurredAt = new Date().toISOString();

  const events: TrafficEvent[] = [];
  for (const raw of body.events.slice(0, MAX_EVENTS)) {
    const event = raw as Incoming;
    if (typeof event.eventId !== 'string' || !EVENT_ID.test(event.eventId)) continue;
    if (typeof event.route !== 'string' || !ROUTE.test(event.route)) continue;
    if (typeof event.kind !== 'string' || !KINDS.has(event.kind)) continue;
    const device =
      typeof event.device === 'string' && DEVICES.has(event.device) ? event.device : 'UNKNOWN';
    const referrer =
      typeof event.referrer === 'string' && REFERRERS.has(event.referrer)
        ? event.referrer
        : 'DIRECT';
    events.push({
      eventId: event.eventId,
      // The instant is the server's, not the browser's: a clock that is wrong
      // by a month would put a visit in a window nobody can reconcile.
      occurredAt,
      route: event.route,
      kind: event.kind as TrafficEvent['kind'],
      device: device as TrafficEvent['device'],
      referrer: referrer as TrafficEvent['referrer'],
      visitorBucket: bucket,
      isRobot,
    });
  }
  if (events.length === 0) {
    return Response.json({ error: 'Ningún evento pasó la validación' }, { status: 400 });
  }

  const result = await reportTraffic(events);
  return Response.json(result ?? { accepted: 0, duplicates: 0 }, {
    status: 202,
    headers: { 'cache-control': 'no-store' },
  });
}

/**
 * A short-lived bucket that lets sessions be estimated and people not be identified.
 *
 * It mixes the day, a server secret and the coarse client hints, and it is
 * truncated to sixteen hexadecimal characters. It rotates daily by
 * construction, so it cannot be used to follow somebody from one day to the
 * next, and without the secret it cannot be reversed into what produced it.
 */
async function visitorBucket(request: Request): Promise<string> {
  const { createHash } = await import('node:crypto');
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.ANALYTICS_SALT ?? 'observatorio';
  const agent = (request.headers.get('user-agent') ?? '').slice(0, 120);
  const language = (request.headers.get('accept-language') ?? '').slice(0, 40);
  return createHash('sha256')
    .update(`${day}|${salt}|${agent}|${language}`)
    .digest('hex')
    .slice(0, 16);
}

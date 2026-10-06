import 'server-only';
import { pool } from './db';
import { held } from './hold';
import {
  EMPTY_LIVE_BOARD,
  weekOf,
  type Counts,
  type LiveCommerceBoard,
  type LiveRoom,
} from './live-commerce-board';

/**
 * Las ventas en vivo de TikTok, leídas de las vistas `read_models.live_commerce_*`
 * (migración `read-the-live-commerce` del núcleo, ADR 0030).
 *
 * Cientos de lives por mes, cada uno con sus conteos: se sostienen en memoria
 * como el resto de lo que se pide al abrirse y se recortan en el navegador.
 */

export function readLiveCommerce(): Promise<LiveCommerceBoard> {
  return held('live-commerce', buildBoard);
}

const ROOM_COLUMNS = `room_key, to_char(live_date, 'YYYY-MM-DD') AS live_date, live_hour, weekday, live_status,
  rubro, product, city, audience_size, minutes, viewers_peak, viewers_median, messages, authors, buyers, signals,
  payments, destinations, emotions, polarity, gifts, follows, shares, likes, speech_segments, screen_reads`;

/**
 * Las filas de cada live. La curva de espectadores y las menciones del dólar llegaron con la migración
 * `read-the-live-videos`: si la base todavía no la tiene (42703), se leen sin ellas y la página dice que
 * esos dos paneles aún no tienen datos, en vez de quedarse vacía entera.
 */
async function readRooms(): Promise<{ rows: RoomRow[] }> {
  try {
    return await pool().query<RoomRow>(
      `SELECT ${ROOM_COLUMNS}, viewer_curve, dollar_talk FROM read_models.live_commerce_room`,
    );
  } catch (error) {
    if ((error as { code?: string }).code !== '42703') throw error;
    return pool().query<RoomRow>(`SELECT ${ROOM_COLUMNS} FROM read_models.live_commerce_room`);
  }
}

interface RoomRow {
  room_key: string;
  live_date: string;
  live_hour: number;
  weekday: number;
  live_status: LiveRoom['status'];
  rubro: string;
  product: string | null;
  city: string | null;
  audience_size: string;
  minutes: number;
  viewers_peak: number | null;
  viewers_median: number | null;
  messages: number;
  authors: number;
  buyers: number;
  signals: Counts | null;
  payments: Counts | null;
  destinations: Counts | null;
  emotions: Counts | null;
  polarity: Counts | null;
  gifts: number;
  follows: number;
  shares: number;
  likes: number;
  viewer_curve?: [number, number][] | null;
  dollar_talk?: number | null;
  speech_segments: number;
  screen_reads: number;
}

const numberOr = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
};

const firstLiveDate = (rows: readonly RoomRow[]): string =>
  rows.reduce((first, row) => (row.live_date < first ? row.live_date : first), '9999-12-31');

/**
 * La UFV desde dos meses antes del primer live (la última publicada puede ser anterior): con ella se lee si el precio en los lives sube más o
 * menos que los precios del país. Sale de la misma lectura diaria que ya sostiene «Tipo de cambio»; si
 * no está, el panel lo dice y el resto de la página no cambia.
 */
async function readUfvSince(first: string): Promise<{ date: string; value: number }[]> {
  const since = new Date(new Date(`${first}T12:00:00Z`).getTime() - 60 * 86_400_000).toISOString().slice(0, 10);
  try {
    // Solo la UFV y solo desde esa fecha: la lectura diaria completa excede el tiempo de la base
    // cuando el servidor está cargado (57014), y aquí no hace falta nada más.
    const { rows } = await pool().query<{ event_date: string; value_median: string }>(
      `SELECT event_date::text AS event_date, value_median::text AS value_median
       FROM read_models.economic_indicator_daily
       WHERE indicator_code = 'UFV_BOB' AND event_date >= $1::date
       ORDER BY event_date`,
      [since],
    );
    return rows
      .map((row) => ({ date: row.event_date, value: Number(row.value_median) }))
      .filter((point) => Number.isFinite(point.value));
  } catch (error) {
    console.warn('[observatorio] UFV ilegible para ventas en vivo', error);
    return [];
  }
}

async function buildBoard(): Promise<LiveCommerceBoard> {
  try {
    const [rooms, prices, phrases, terms, coverage, snapshot] = await Promise.all([
      readRooms(),
      pool().query<{
        room_key: string;
        price_date: string;
        rubro: string;
        product: string | null;
        price_bs: string | null;
        currency: string;
        price_source: string;
        price_unit: string | null;
      }>(
        `SELECT room_key, to_char(price_date, 'YYYY-MM-DD') AS price_date, rubro, product, price_bs::text,
                currency, price_source, price_unit
         FROM read_models.live_commerce_price`,
      ),
      pool().query<{
        phrase: string;
        people: number;
        lives: number;
        rubro: string;
        emotion: string | null;
        signal: string | null;
      }>('SELECT phrase, people, lives, rubro, emotion, signal FROM read_models.live_commerce_phrase'),
      pool().query<{ rubro: string; scope: 'AUDIENCE' | 'SELLER'; term: string; mentions: number }>(
        'SELECT rubro, scope, term, mentions FROM read_models.live_commerce_term',
      ),
      pool().query<Record<string, unknown>>(
        `SELECT to_char(run_date, 'YYYY-MM-DD') AS run, candidates_seen, rooms_opened, rooms_blocked,
                rooms_commerce, rooms_no_commerce, rooms_foreign, rooms_unidentified, messages,
                messages_with_signal, messages_apt, speech_segments, screen_reads, prices, minutes
         FROM read_models.live_commerce_coverage ORDER BY run_date`,
      ),
      pool().query<{
        provenance: { lexiconVersion?: string; usdRate?: number | null } | null;
        rubros: { code: string; label: string }[] | null;
        departments: { code: string; label: string }[] | null;
        analyzed_at: Date | null;
      }>('SELECT provenance, rubros, departments, analyzed_at FROM read_models.live_commerce_snapshot'),
    ]);
    const meta = snapshot.rows[0];
    return {
      analyzedAt: meta?.analyzed_at ? meta.analyzed_at.toISOString() : null,
      lexiconVersion: meta?.provenance?.lexiconVersion ?? null,
      usdRate: meta?.provenance?.usdRate ?? null,
      rubros: Object.fromEntries((meta?.rubros ?? []).map((row) => [row.code, row.label])),
      departments: Object.fromEntries((meta?.departments ?? []).map((row) => [row.code, row.label])),
      rooms: rooms.rows.map((row) => ({
        key: row.room_key,
        date: row.live_date,
        week: weekOf(row.live_date),
        hour: numberOr(row.live_hour),
        weekday: numberOr(row.weekday),
        status: row.live_status,
        rubro: row.rubro,
        product: row.product,
        city: row.city,
        size: row.audience_size,
        minutes: numberOr(row.minutes),
        viewersPeak: row.viewers_peak === null ? null : numberOr(row.viewers_peak),
        viewersMedian: row.viewers_median === null ? null : numberOr(row.viewers_median),
        messages: numberOr(row.messages),
        authors: numberOr(row.authors),
        buyers: numberOr(row.buyers),
        signals: row.signals ?? {},
        payments: row.payments ?? {},
        destinations: row.destinations ?? {},
        emotions: row.emotions ?? {},
        polarity: row.polarity ?? {},
        gifts: numberOr(row.gifts),
        follows: numberOr(row.follows),
        shares: numberOr(row.shares),
        likes: numberOr(row.likes),
        curve: (row.viewer_curve ?? []).map(([minute, viewers]) => [numberOr(minute), numberOr(viewers)] as const),
        dollarTalk: numberOr(row.dollar_talk),
        speechSegments: numberOr(row.speech_segments),
        screenReads: numberOr(row.screen_reads),
      })),
      prices: prices.rows.map((row) => ({
        room: row.room_key,
        date: row.price_date,
        rubro: row.rubro,
        product: row.product,
        priceBs: row.price_bs === null ? null : Number(row.price_bs),
        currency: row.currency,
        source: row.price_source,
        unit: row.price_unit,
      })),
      phrases: phrases.rows,
      terms: terms.rows,
      coverage: coverage.rows.map((row) => ({
        run: String(row.run),
        candidatesSeen: numberOr(row.candidates_seen),
        roomsOpened: numberOr(row.rooms_opened),
        roomsBlocked: numberOr(row.rooms_blocked),
        roomsCommerce: numberOr(row.rooms_commerce),
        roomsNoCommerce: numberOr(row.rooms_no_commerce),
        roomsForeign: numberOr(row.rooms_foreign),
        roomsUnidentified: numberOr(row.rooms_unidentified),
        messages: numberOr(row.messages),
        messagesWithSignal: numberOr(row.messages_with_signal),
        messagesApt: numberOr(row.messages_apt),
        speechSegments: numberOr(row.speech_segments),
        screenReads: numberOr(row.screen_reads),
        prices: numberOr(row.prices),
        minutes: numberOr(row.minutes),
      })),
      ufv: await readUfvSince(firstLiveDate(rooms.rows)),
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    // El tablero puede desplegarse antes que la migración del núcleo: sin las
    // vistas, la página dice que todavía no hay lectura en vez de caerse.
    if (code === '42P01' || code === '42501' || code === '42703') {
      console.warn(`[observatorio] modelo ilegible: read_models.live_commerce_* (${code})`);
      return EMPTY_LIVE_BOARD;
    }
    throw error;
  }
}

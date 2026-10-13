import 'server-only';
import { pool } from './db';
import { held } from './hold';
import { readGap } from './series';
import { monthlyAverage, type VideoTrends } from './tiktok-retrospective';
import { EMPTY_VIDEO_BOARD, type SellerVideo, type VideoAccount, type VideoBoard } from './tiktok-videos-board';

/**
 * Los videos de los vendedores de TikTok, leídos de `read_models.tiktok_video*` (migración
 * `read-the-live-videos` del núcleo, ADR 0031). Unos miles de filas que cambian una vez por semana: se
 * sostienen en memoria y se recortan en el navegador.
 */

export function readTiktokVideos(): Promise<VideoBoard> {
  return held('tiktok-videos', buildBoard);
}

const numberOr = (value: unknown): number | null => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
};

async function buildBoard(): Promise<VideoBoard> {
  try {
    const [accounts, videos, snapshotRows] = await Promise.all([
      pool().query<Record<string, unknown>>(
        `SELECT seller_id, origin, kind, rubro, city, followers::text, videos_read,
                to_char(first_video, 'YYYY-MM-DD') AS first_video, to_char(last_video, 'YYYY-MM-DD') AS last_video
         FROM read_models.tiktok_video_account`,
      ),
      pool().query<Record<string, unknown>>(
        `SELECT video_key, seller_id, kind, to_char(published_on, 'YYYY-MM-DD') AS published_on, published_hour,
                weekday, rubro, product, prices_bs, plays::text, likes::text, comments::text, shares::text,
                duration_seconds, photo_post, tactics
         FROM read_models.tiktok_video`,
      ),
      snapshot(),
    ]);
    const meta = snapshotRows.rows[0];
    const dollar = await parallelDollarByMonth();
    return {
      analyzedAt: meta?.analyzed_at ? meta.analyzed_at.toISOString() : null,
      rubros: Object.fromEntries((meta?.rubros ?? []).map((row) => [row.code, row.label])),
      departments: Object.fromEntries((meta?.departments ?? []).map((row) => [row.code, row.label])),
      terms: meta?.terms ?? [],
      coverage: meta?.coverage ?? null,
      trends: meta?.trends ?? null,
      dollar,
      accounts: accounts.rows.map(
        (row): VideoAccount => ({
          seller: String(row.seller_id),
          origin: row.origin === 'SIMILAR' ? 'SIMILAR' : 'LIVE',
          kind: row.kind as VideoAccount['kind'],
          rubro: String(row.rubro),
          city: typeof row.city === 'string' ? row.city : null,
          followers: numberOr(row.followers),
          videosRead: numberOr(row.videos_read) ?? 0,
          firstVideo: typeof row.first_video === 'string' ? row.first_video : null,
          lastVideo: typeof row.last_video === 'string' ? row.last_video : null,
        }),
      ),
      videos: videos.rows.map(
        (row): SellerVideo => ({
          key: String(row.video_key),
          seller: String(row.seller_id),
          kind: row.kind as SellerVideo['kind'],
          date: String(row.published_on),
          hour: numberOr(row.published_hour) ?? 0,
          weekday: numberOr(row.weekday) ?? 1,
          rubro: String(row.rubro),
          product: typeof row.product === 'string' ? row.product : null,
          prices: Array.isArray(row.prices_bs) ? row.prices_bs.map(Number).filter(Number.isFinite) : [],
          plays: numberOr(row.plays),
          likes: numberOr(row.likes),
          comments: numberOr(row.comments),
          shares: numberOr(row.shares),
          duration: numberOr(row.duration_seconds),
          photo: row.photo_post === true,
          tactics: Array.isArray(row.tactics) ? row.tactics.map(String) : [],
        }),
      ),
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    // El tablero puede desplegarse antes que la migración del núcleo: la página dice que no hay lectura.
    if (code === '42P01' || code === '42501' || code === '42703') {
      console.warn(`[observatorio] modelo ilegible: read_models.tiktok_video* (${code})`);
      return EMPTY_VIDEO_BOARD;
    }
    throw error;
  }
}

interface SnapshotRow {
  rubros: { code: string; label: string }[] | null;
  departments: { code: string; label: string }[] | null;
  terms: { rubro: string; term: string; count: number }[] | null;
  coverage: VideoBoard['coverage'];
  trends: VideoTrends | null;
  analyzed_at: Date | null;
}

/**
 * La última lectura. La columna `trends` la agrega la migración 0106 del núcleo: si el tablero se despliega
 * antes (`42703`, columna inexistente), se lee sin ella y la pestaña «Retrospectiva» dice que aún no hay.
 */
async function snapshot() {
  try {
    return await pool().query<SnapshotRow>(
      'SELECT rubros, departments, terms, coverage, trends, analyzed_at FROM read_models.tiktok_video_snapshot',
    );
  } catch (error) {
    if ((error as { code?: string }).code !== '42703') throw error;
    const rows = await pool().query<Omit<SnapshotRow, 'trends'>>(
      'SELECT rubros, departments, terms, coverage, analyzed_at FROM read_models.tiktok_video_snapshot',
    );
    return { ...rows, rows: rows.rows.map((row) => ({ ...row, trends: null })) };
  }
}

/** El dólar paralelo promedio de cada mes. Sin serie (la lectura falla), la pestaña sigue sin esa columna. */
async function parallelDollarByMonth(): Promise<Record<string, number>> {
  try {
    return monthlyAverage((await readGap()).map((point) => ({ date: point.date, value: point.parallelMid })));
  } catch {
    return {};
  }
}

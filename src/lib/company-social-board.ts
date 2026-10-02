/**
 * Las cuentas oficiales de las empresas en redes sociales, armadas para la
 * página «Redes sociales» de Empresas (ADR 0027 del núcleo).
 *
 * Puro: recibe las filas de las tres vistas y el ránking Merco, y devuelve el
 * panel. Lo que una red no dejó leer viaja con su estado y sin cifras; nunca
 * como cero. Los términos viajan recortados por empresa porque el lector los
 * suma en el navegador sobre las empresas que filtró.
 */

export const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
};

export type ReadStatus = 'OK' | 'RESTRICTED' | 'BLOCKED' | 'NOT_FOUND' | 'ERROR';

export interface CommentSentiment {
  analyzed: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  ironyPct: number | null;
  netScore: number;
  topEmotion: string | null;
  /** Reparto de emociones (% de los comentarios clasificados); el resto es «otras». */
  emotionPct?: Record<string, number> | null;
}

export interface SocialProfileRow {
  slug: string;
  platform: string;
  reading_date: string;
  account_url: string;
  handle: string;
  read_status: string;
  status_note: string | null;
  followers: string | null;
  post_count: string | null;
  likes_total: string | null;
  talking_about: string | null;
  posts_read: number;
  posts_per_week: string | null;
  engagement_pct: string | null;
  comments_read: number;
  comment_sentiment: CommentSentiment | null;
}

export interface SocialPostRow {
  slug: string;
  platform: string;
  post_id: string;
  post_url: string;
  published_at: string | null;
  likes: string | null;
  comments: string | null;
  shares: string | null;
  views: string | null;
  interactions: string | null;
  discovery: string;
  post_format: string | null;
  published_hour: number | null;
  post_text: string;
  comment_sentiment: CommentSentiment | null;
}

export interface SocialTermRow {
  slug: string;
  scope: string;
  kind: string;
  term: string;
  mentions: number;
}

export interface SocialAccount {
  platform: SocialPlatform;
  status: ReadStatus;
  note: string | null;
  url: string;
  handle: string;
  date: string;
  followers: number | null;
  postCount: number | null;
  likesTotal: number | null;
  talkingAbout: number | null;
  postsRead: number;
  postsPerWeek: number | null;
  engagementPct: number | null;
  commentsRead: number;
  sentiment: CommentSentiment | null;
}

export interface SocialCompany {
  slug: string;
  name: string;
  sector: string | null;
  mercoRank: number | null;
  mercoYear: number | null;
  accounts: SocialAccount[];
}

export interface SocialPost {
  slug: string;
  platform: SocialPlatform;
  url: string;
  date: string | null;
  text: string;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;
  interactions: number | null;
  discovery: 'PROFILE' | 'SEARCH';
  format: string | null;
  hour: number | null;
  sentiment: CommentSentiment | null;
}

/** Cuántos posts de cada formato y a qué hora, por empresa y red: todos los leídos, no sólo los que viajan. */
export interface PostShape {
  slug: string;
  platform: SocialPlatform;
  format: string | null;
  hour: number | null;
  interactions: number | null;
}

/** [slug, ámbito, clase, término, menciones]: en tuplas, porque son decenas de miles. */
export type SocialTerm = [string, 'COMPANY' | 'AUDIENCE', 'WORD' | 'BIGRAM' | 'HASHTAG' | 'EMOJI', string, number];

export interface CompanySocialBoard {
  readingDate: string | null;
  companies: SocialCompany[];
  posts: SocialPost[];
  shapes: PostShape[];
  terms: SocialTerm[];
}

export const EMPTY_SOCIAL_BOARD: CompanySocialBoard = { readingDate: null, companies: [], posts: [], shapes: [], terms: [] };

export interface MercoSeat {
  slug: string;
  name: string;
  rank: number;
  year: number;
  sector: string | null;
}

const POSTS_PER_ACCOUNT = 6;
const TERMS_PER_KIND: Record<string, number> = { WORD: 25, BIGRAM: 10, HASHTAG: 10, EMOJI: 8 };

const num = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isPlatform = (value: string): value is SocialPlatform =>
  (SOCIAL_PLATFORMS as readonly string[]).includes(value);

export function buildCompanySocialBoard(
  profiles: readonly SocialProfileRow[],
  posts: readonly SocialPostRow[],
  terms: readonly SocialTermRow[],
  general: readonly MercoSeat[],
  sectors: readonly MercoSeat[],
): CompanySocialBoard {
  // La última lectura de cada cuenta: las vistas guardan una fila por día.
  const latest = new Map<string, SocialProfileRow>();
  for (const row of profiles) {
    const key = `${row.slug}|${row.platform}`;
    const seen = latest.get(key);
    if (!seen || row.reading_date > seen.reading_date) latest.set(key, row);
  }

  const lastSeat = new Map<string, MercoSeat>();
  for (const seat of general) {
    const seen = lastSeat.get(seat.slug);
    if (!seen || seat.year > seen.year) lastSeat.set(seat.slug, seat);
  }
  const sectorOf = new Map<string, { sector: string; year: number }>();
  for (const seat of sectors) {
    const seen = sectorOf.get(seat.slug);
    if (seat.sector && (!seen || seat.year > seen.year)) sectorOf.set(seat.slug, { sector: seat.sector, year: seat.year });
  }
  const names = new Map<string, string>();
  for (const seat of [...general, ...sectors]) if (!names.has(seat.slug)) names.set(seat.slug, seat.name);

  const companies = new Map<string, SocialCompany>();
  for (const row of latest.values()) {
    if (!isPlatform(row.platform)) continue;
    const seat = lastSeat.get(row.slug);
    const company = companies.get(row.slug) ?? {
      slug: row.slug,
      name: names.get(row.slug) ?? row.slug,
      sector: sectorOf.get(row.slug)?.sector ?? null,
      mercoRank: seat?.rank ?? null,
      mercoYear: seat?.year ?? null,
      accounts: [],
    };
    const ok = row.read_status === 'OK';
    company.accounts.push({
      platform: row.platform,
      status: row.read_status as ReadStatus,
      note: row.status_note,
      url: row.account_url,
      handle: row.handle,
      date: row.reading_date,
      followers: ok ? num(row.followers) : null,
      postCount: ok ? num(row.post_count) : null,
      likesTotal: ok ? num(row.likes_total) : null,
      talkingAbout: ok ? num(row.talking_about) : null,
      postsRead: row.posts_read,
      postsPerWeek: num(row.posts_per_week),
      engagementPct: num(row.engagement_pct),
      commentsRead: row.comments_read,
      sentiment: row.comment_sentiment,
    });
    companies.set(row.slug, company);
  }
  for (const company of companies.values()) {
    company.accounts.sort((left, right) => SOCIAL_PLATFORMS.indexOf(left.platform) - SOCIAL_PLATFORMS.indexOf(right.platform));
  }

  const perAccount = new Map<string, SocialPost[]>();
  for (const row of posts) {
    if (!isPlatform(row.platform)) continue;
    const key = `${row.slug}|${row.platform}`;
    const list = perAccount.get(key) ?? [];
    list.push({
      slug: row.slug,
      platform: row.platform,
      url: row.post_url,
      date: row.published_at,
      text: row.post_text.slice(0, 220),
      likes: num(row.likes),
      comments: num(row.comments),
      shares: num(row.shares),
      views: num(row.views),
      interactions: num(row.interactions),
      discovery: row.discovery === 'SEARCH' ? 'SEARCH' : 'PROFILE',
      format: row.post_format,
      hour: row.published_hour,
      sentiment: row.comment_sentiment,
    });
    perAccount.set(key, list);
  }
  const keptPosts = [...perAccount.values()].flatMap((list) =>
    list.sort((left, right) => (right.interactions ?? -1) - (left.interactions ?? -1)).slice(0, POSTS_PER_ACCOUNT),
  );

  const termCount = new Map<string, number>();
  const keptTerms: SocialTerm[] = [];
  for (const row of [...terms].sort((left, right) => right.mentions - left.mentions)) {
    const key = `${row.slug}|${row.scope}|${row.kind}`;
    const used = termCount.get(key) ?? 0;
    if (used >= (TERMS_PER_KIND[row.kind] ?? 0)) continue;
    termCount.set(key, used + 1);
    keptTerms.push([row.slug, row.scope as SocialTerm[1], row.kind as SocialTerm[2], row.term, row.mentions]);
  }

  const dates = [...latest.values()].map((row) => row.reading_date).sort();
  return {
    readingDate: dates[dates.length - 1] ?? null,
    companies: [...companies.values()].sort(
      (left, right) => (left.mercoRank ?? 999) - (right.mercoRank ?? 999) || left.name.localeCompare(right.name, 'es'),
    ),
    posts: keptPosts,
    shapes: [...perAccount.values()].flat().map(({ slug, platform, format, hour, interactions }) => ({
      slug,
      platform,
      format,
      hour,
      interactions,
    })),
    terms: keptTerms,
  };
}

/** La suma de seguidores declarados de las cuentas leídas; `null` si ninguna se leyó. */
export function followersOf(company: SocialCompany, platforms?: ReadonlySet<string>): number | null {
  const counted = company.accounts.filter(
    (account) => account.followers !== null && (!platforms || platforms.size === 0 || platforms.has(account.platform)),
  );
  return counted.length ? counted.reduce((sum, account) => sum + (account.followers ?? 0), 0) : null;
}

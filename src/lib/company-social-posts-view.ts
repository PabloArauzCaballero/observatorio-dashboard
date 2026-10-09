import type { CommentSentiment, SocialPlatform } from './company-social-board';

/**
 * Los posts leídos de las redes de las empresas, uno por uno, para recorrerlos con filtros.
 *
 * El tablero de «Redes sociales» sólo viaja con los seis mejores de cada cuenta. Con la segunda
 * pasada de profundidad (ADR 0027) cada canal trae decenas de videos con vistas, fecha y cifras;
 * este módulo los filtra, los ordena y los suma por mes sin cargarlos todos en el navegador.
 */

export interface PostRecord {
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
  format: string | null;
  sentiment: CommentSentiment | null;
}

export type PostSort = 'interactions' | 'date' | 'views' | 'comments' | 'analyzed';
export type CommentTone = 'all' | 'analyzed' | 'positive' | 'negative';

export interface PostQuery {
  /** Una selección sin empresas es distinta de «todas las empresas». */
  emptySelection: boolean;
  /** Vacío = todas las empresas. */
  slugs: readonly string[];
  /** Vacío = todas las redes. */
  platforms: readonly string[];
  from: string | null;
  to: string | null;
  format: string | null;
  text: string;
  commentTone: CommentTone;
  sort: PostSort;
  offset: number;
  limit: number;
}

export interface MonthPoint {
  month: string;
  posts: number;
  interactions: number;
  views: number;
}

export interface PostPage {
  total: number;
  rows: PostRecord[];
  series: MonthPoint[];
  formats: Array<{ format: string; posts: number }>;
  dates: { min: string | null; max: string | null };
  summary: {
    measured: number;
    medianInteractions: number | null;
    topFiveShare: number | null;
    analyzed: number;
    net: number | null;
  };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;
const SORTS: readonly PostSort[] = ['interactions', 'date', 'views', 'comments', 'analyzed'];
const TONES: readonly CommentTone[] = ['all', 'analyzed', 'positive', 'negative'];
export const MAX_PAGE = 60;

const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase();

/** Lo que el cuerpo de la petición dice, ya acotado: nada de lo que llega se usa sin pasar por aquí. */
export function parseQuery(body: unknown): PostQuery {
  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const strings = (value: unknown, max: number): string[] =>
    Array.isArray(value)
      ? value.filter((one): one is string => typeof one === 'string' && /^[\w.-]{1,80}$/u.test(one)).slice(0, max)
      : [];
  const day = (value: unknown): string | null =>
    typeof value === 'string' && ISO_DAY.test(value) ? value : null;
  const sort = SORTS.find((one) => one === input.sort) ?? 'interactions';
  const whole = (value: unknown, fallback: number, max: number): number => {
    const parsed = typeof value === 'number' ? Math.trunc(value) : fallback;
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), max) : fallback;
  };
  return {
    emptySelection: input.emptySelection === true,
    slugs: strings(input.slugs, 400),
    platforms: strings(input.platforms, 5),
    from: day(input.from),
    to: day(input.to),
    format: typeof input.format === 'string' && (input.format === 'SIN DATO' || /^[A-Z]{3,8}$/u.test(input.format)) ? input.format : null,
    text: typeof input.text === 'string' ? input.text.trim().slice(0, 80) : '',
    commentTone: TONES.find((one) => one === input.commentTone) ?? 'all',
    sort,
    offset: whole(input.offset, 0, 100_000),
    limit: Math.max(1, whole(input.limit, 25, MAX_PAGE)),
  };
}

const key = (post: PostRecord, sort: PostSort): number => {
  if (sort === 'date') return post.date ? Date.parse(post.date) : Number.NEGATIVE_INFINITY;
  if (sort === 'analyzed') return post.sentiment?.analyzed ?? Number.NEGATIVE_INFINITY;
  const value = sort === 'views' ? post.views : sort === 'comments' ? post.comments : post.interactions;
  return value ?? Number.NEGATIVE_INFINITY;
};

export function queryPosts(all: readonly PostRecord[], query: PostQuery): PostPage {
  const slugs = query.slugs.length ? new Set(query.slugs) : null;
  const platforms = query.platforms.length ? new Set(query.platforms) : null;
  const needle = query.text ? fold(query.text) : '';
  // Las fechas y el formato recortan los gráficos y la lista; el formato no recorta su propio reparto.
  const inScope = all.filter(
    (post) =>
      !query.emptySelection &&
      (!slugs || slugs.has(post.slug)) &&
      (!platforms || platforms.has(post.platform)) &&
      (!query.from || (post.date !== null && post.date >= query.from)) &&
      (!query.to || (post.date !== null && post.date <= query.to)) &&
      (!needle || fold(post.text).includes(needle)) &&
      (query.commentTone === 'all' ||
        (post.sentiment !== null && post.sentiment.analyzed > 0 &&
          (query.commentTone === 'analyzed' ||
            (query.commentTone === 'positive' && post.sentiment.netScore > 0) ||
            (query.commentTone === 'negative' && post.sentiment.netScore < 0)))),
  );
  const matching = query.format ? inScope.filter((post) => (post.format ?? 'SIN DATO') === query.format) : inScope;

  const months = new Map<string, MonthPoint>();
  for (const post of matching) {
    if (!post.date) continue;
    const month = post.date.slice(0, 7);
    const point = months.get(month) ?? { month, posts: 0, interactions: 0, views: 0 };
    point.posts += 1;
    point.interactions += post.interactions ?? 0;
    point.views += post.views ?? 0;
    months.set(month, point);
  }
  const formats = new Map<string, number>();
  for (const post of inScope) formats.set(post.format ?? 'SIN DATO', (formats.get(post.format ?? 'SIN DATO') ?? 0) + 1);
  const dated = matching.filter((post) => post.date).map((post) => post.date as string).sort();

  const sorted = [...matching].sort((left, right) => key(right, query.sort) - key(left, query.sort));
  const measured = matching.flatMap((post) => post.interactions === null ? [] : [post.interactions]).sort((a, b) => a - b);
  const interactions = measured.reduce((sum, value) => sum + value, 0);
  const middle = Math.floor(measured.length / 2);
  const analyzed = matching.reduce((sum, post) => sum + (post.sentiment?.analyzed ?? 0), 0);
  return {
    total: matching.length,
    rows: sorted.slice(query.offset, query.offset + query.limit),
    series: [...months.values()].sort((left, right) => left.month.localeCompare(right.month)),
    formats: [...formats].map(([format, posts]) => ({ format, posts })).sort((left, right) => right.posts - left.posts),
    dates: { min: dated[0] ?? null, max: dated[dated.length - 1] ?? null },
    summary: {
      measured: measured.length,
      medianInteractions: measured.length ? ((measured[middle] ?? 0) + (measured[Math.floor((measured.length - 1) / 2)] ?? 0)) / 2 : null,
      topFiveShare: interactions > 0 ? 100 * measured.slice(-5).reduce((sum, value) => sum + value, 0) / interactions : null,
      analyzed,
      net: analyzed ? matching.reduce((sum, post) => sum + (post.sentiment ? post.sentiment.netScore * post.sentiment.analyzed : 0), 0) / analyzed : null,
    },
  };
}

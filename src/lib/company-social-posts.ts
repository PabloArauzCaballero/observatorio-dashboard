import 'server-only';
import { pool } from './db';
import { held } from './hold';
import { SOCIAL_PLATFORMS, type CommentSentiment, type SocialPlatform } from './company-social-board';
import { queryPosts, type PostPage, type PostQuery, type PostRecord } from './company-social-posts-view';

/**
 * Todos los posts leídos de las redes de las empresas, de la vista `read_models.company_social_post`
 * (migración 0094 del núcleo), sostenidos en memoria como el resto de las lecturas semanales: decenas
 * de miles de filas que sólo cambian cuando el recolector publica. Cada petición filtra y ordena en
 * memoria, sin volver a la base.
 */

interface Row {
  slug: string;
  platform: string;
  post_url: string;
  published_at: string | null;
  likes: string | null;
  comments: string | null;
  shares: string | null;
  views: string | null;
  interactions: string | null;
  post_format: string | null;
  post_text: string;
  comment_sentiment: CommentSentiment | null;
}

const number = (value: string | null): number | null => {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isPlatform = (value: string): value is SocialPlatform => (SOCIAL_PLATFORMS as readonly string[]).includes(value);

async function readAll(): Promise<PostRecord[]> {
  try {
    const result = await pool().query<Row>(
      `SELECT slug, platform, post_url, to_char(published_at, 'YYYY-MM-DD') AS published_at,
              likes::text, comments::text, shares::text, views::text, interactions::text,
              post_format, post_text, comment_sentiment
       FROM read_models.company_social_post`,
    );
    return result.rows
      .filter((row) => isPlatform(row.platform))
      .map((row) => ({
        slug: row.slug,
        platform: row.platform as SocialPlatform,
        url: row.post_url,
        date: row.published_at,
        text: row.post_text,
        likes: number(row.likes),
        comments: number(row.comments),
        shares: number(row.shares),
        views: number(row.views),
        interactions: number(row.interactions),
        format: row.post_format,
        sentiment: row.comment_sentiment,
      }));
  } catch (error) {
    const code = (error as { code?: string }).code;
    // Igual que el tablero: sin las vistas de la migración 0094 no hay posts, no hay caída.
    if (code === '42P01' || code === '42501' || code === '42703') return [];
    throw error;
  }
}

export async function readCompanyPosts(query: PostQuery): Promise<PostPage> {
  return queryPosts(await held('company-social-posts', readAll), query);
}

import 'server-only';
import { pool } from './db';
import { held } from './hold';
import { buildExportersBoard } from './exporters-board';
import { readMacroAnnual } from './series';
import {
  buildCompanySocialBoard,
  EMPTY_SOCIAL_BOARD,
  type CompanySocialBoard,
  type SocialPostRow,
  type SocialProfileRow,
  type SocialTermRow,
} from './company-social-board';

/**
 * Las cuentas oficiales de las empresas en redes sociales, leídas de las vistas
 * `read_models.company_social_*` (migración 0094 del núcleo).
 *
 * Unos pocos miles de filas que cambian una vez por semana: se sostienen en
 * memoria como el resto de lo que se pide al abrirse. El nombre, el sector y el
 * puesto Merco salen de la lectura anual que ya está en memoria por
 * «Macroeconomía», así que cruzar con el ránking no cuesta otra consulta.
 */

export function readCompanySocial(): Promise<CompanySocialBoard> {
  return held('company-social', buildBoard);
}

async function buildBoard(): Promise<CompanySocialBoard> {
  try {
    const [profiles, posts, terms, macro] = await Promise.all([
      pool().query<SocialProfileRow>(
        `SELECT slug, platform, to_char(reading_date, 'YYYY-MM-DD') AS reading_date, account_url, handle,
                read_status, status_note, followers::text, post_count::text, likes_total::text,
                talking_about::text, posts_read, posts_per_week::text, engagement_pct::text,
                comments_read, comment_sentiment
         FROM read_models.company_social_profile`,
      ),
      pool().query<SocialPostRow>(
        `SELECT slug, platform, post_id, post_url, to_char(published_at, 'YYYY-MM-DD') AS published_at,
                likes::text, comments::text, shares::text, views::text, interactions::text,
                discovery, post_format, published_hour, post_text, comment_sentiment
         FROM read_models.company_social_post`,
      ),
      pool().query<SocialTermRow>(
        `SELECT slug, scope, kind, term, mentions FROM read_models.company_social_term`,
      ),
      readMacroAnnual(),
    ]);
    const merco = buildExportersBoard(macro.filter((point) => point.sector === 'EMPRESARIAL'));
    return buildCompanySocialBoard(profiles.rows, posts.rows, terms.rows, merco.general, merco.sectors);
  } catch (error) {
    const code = (error as { code?: string }).code;
    // El tablero se despliega a veces antes que la migración 0094 del núcleo:
    // sin las vistas, el panel dice que todavía no hay lectura en vez de caerse.
    if (code === '42P01' || code === '42501' || code === '42703') {
      console.warn(`[observatorio] modelo ilegible: read_models.company_social_* (${code})`);
      return EMPTY_SOCIAL_BOARD;
    }
    throw error;
  }
}

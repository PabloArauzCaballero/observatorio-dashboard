import {
  followersOf,
  PLATFORM_LABEL,
  SOCIAL_PLATFORMS,
  type CompanySocialBoard,
  type PostShape,
  type SocialAccount,
  type SocialCompany,
  type SocialPost,
  type SocialTerm,
} from './company-social-board';
import type { Choice } from './choice';

/**
 * Lo que la página de redes muestra con los filtros puestos. Puro, para que los
 * cruces se prueben sin navegador.
 *
 * Los filtros se cruzan como en el resto del informe: cada lista del carril
 * cuenta lo que queda con los OTROS filtros puestos, y no con el suyo, para que
 * elegir una opción no deje a las demás en cero.
 */

export interface SocialFilters {
  platforms: Choice;
  sectors: Choice;
  query: string;
  topOnly: boolean;
  tone: 'all' | 'positive' | 'negative' | 'heard';
}

export const MIN_COMMENTS = 10;

export function plain(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Las cuentas de una empresa que cuentan con el filtro de red puesto. */
export function accountsIn(company: SocialCompany, platforms: Choice): SocialAccount[] {
  return company.accounts.filter((account) => platforms.size === 0 || platforms.has(account.platform));
}

/** El sentimiento de una empresa: los comentarios de sus cuentas, ponderados por cuántos son. */
export function companySentiment(company: SocialCompany, platforms: Choice): { net: number; analyzed: number; irony: number | null } | null {
  let analyzed = 0;
  let net = 0;
  let ironic = 0;
  let ironyBase = 0;
  for (const account of accountsIn(company, platforms)) {
    const sentiment = account.sentiment;
    if (!sentiment) continue;
    analyzed += sentiment.analyzed;
    net += sentiment.netScore * sentiment.analyzed;
    if (sentiment.ironyPct !== null) {
      ironic += sentiment.ironyPct * sentiment.analyzed;
      ironyBase += sentiment.analyzed;
    }
  }
  if (!analyzed) return null;
  return { net: net / analyzed, analyzed, irony: ironyBase ? ironic / ironyBase : null };
}

/** La mediana de interacción por post de las cuentas leídas (% de seguidores). */
export function companyEngagement(company: SocialCompany, platforms: Choice): number | null {
  const values = accountsIn(company, platforms)
    .map((account) => account.engagementPct)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? (values[middle] ?? null) : ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2;
}

export function companyPace(company: SocialCompany, platforms: Choice): number | null {
  const values = accountsIn(company, platforms)
    .map((account) => account.postsPerWeek)
    .filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function passes(company: SocialCompany, filters: SocialFilters, skip: 'sector' | 'none'): boolean {
  const needle = plain(filters.query.trim());
  if (needle && !plain(company.name).includes(needle)) return false;
  if (filters.topOnly && (company.mercoRank === null || company.mercoRank > 50)) return false;
  if (skip !== 'sector' && filters.sectors.size && !filters.sectors.has(company.sector ?? '')) return false;
  if (filters.platforms.size && !accountsIn(company, filters.platforms).length) return false;
  if (filters.tone !== 'all') {
    const sentiment = companySentiment(company, filters.platforms);
    if (!sentiment || sentiment.analyzed < MIN_COMMENTS) return false;
    if (filters.tone === 'positive' && sentiment.net <= 0) return false;
    if (filters.tone === 'negative' && sentiment.net >= 0) return false;
  }
  return true;
}

export function filterCompanies(board: CompanySocialBoard, filters: SocialFilters): SocialCompany[] {
  return board.companies.filter((company) => passes(company, filters, 'none'));
}

export function sectorChoices(board: CompanySocialBoard, filters: SocialFilters) {
  const counts = new Map<string, number>();
  for (const company of board.companies) {
    if (!company.sector) continue;
    counts.set(company.sector, (counts.get(company.sector) ?? 0) + (passes(company, filters, 'sector') ? 1 : 0));
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => left.value.localeCompare(right.value, 'es'));
}

export interface PlatformCoverage {
  platform: string;
  label: string;
  read: number;
  restricted: number;
  blocked: number;
  missing: number;
  followers: number;
}

/** Cuántas cuentas de cada red se leyeron y cuántas no, entre las empresas filtradas. */
export function coverage(companies: readonly SocialCompany[]): PlatformCoverage[] {
  return SOCIAL_PLATFORMS.map((platform) => {
    const accounts = companies.flatMap((company) => company.accounts.filter((account) => account.platform === platform));
    return {
      platform,
      label: PLATFORM_LABEL[platform],
      read: accounts.filter((account) => account.status === 'OK').length,
      restricted: accounts.filter((account) => account.status === 'RESTRICTED').length,
      blocked: accounts.filter((account) => account.status === 'BLOCKED' || account.status === 'ERROR').length,
      missing: accounts.filter((account) => account.status === 'NOT_FOUND').length,
      followers: accounts.reduce((sum, account) => sum + (account.followers ?? 0), 0),
    };
  });
}

export type TermKind = SocialTerm[2];

/** Los términos de las empresas filtradas, sumados, de un ámbito y una clase. */
export function sumTerms(
  terms: readonly SocialTerm[],
  slugs: ReadonlySet<string>,
  scope: SocialTerm[1],
  kind: TermKind,
  limit = 30,
): Array<{ term: string; count: number; companies: number }> {
  const totals = new Map<string, { count: number; companies: Set<string> }>();
  for (const [slug, termScope, termKind, term, count] of terms) {
    if (termScope !== scope || termKind !== kind || !slugs.has(slug)) continue;
    const entry = totals.get(term) ?? { count: 0, companies: new Set<string>() };
    entry.count += count;
    entry.companies.add(slug);
    totals.set(term, entry);
  }
  return [...totals.entries()]
    .map(([term, entry]) => ({ term, count: entry.count, companies: entry.companies.size }))
    .sort((left, right) => right.count - left.count || left.term.localeCompare(right.term, 'es'))
    .slice(0, limit);
}

/** Los posts con más interacciones de las empresas y redes filtradas. */
export function topPosts(posts: readonly SocialPost[], slugs: ReadonlySet<string>, platforms: Choice, limit = 12): SocialPost[] {
  return posts
    .filter((post) => slugs.has(post.slug) && (platforms.size === 0 || platforms.has(post.platform)))
    .filter((post) => post.interactions !== null)
    .sort((left, right) => (right.interactions ?? 0) - (left.interactions ?? 0))
    .slice(0, limit);
}

const FORMAT_LABEL: Record<string, string> = {
  POST: 'Post de Instagram',
  REEL: 'Reel',
  VIDEO: 'Video',
  PHOTO: 'Foto',
  TEXT: 'Texto o enlace',
};

const shapesIn = (shapes: readonly PostShape[], slugs: ReadonlySet<string>, platforms: Choice) =>
  shapes.filter((shape) => slugs.has(shape.slug) && (platforms.size === 0 || platforms.has(shape.platform)));

/** Qué forma tienen los posts y cuánto rinde cada una (interacciones medianas por post). */
export function formatMix(shapes: readonly PostShape[], slugs: ReadonlySet<string>, platforms: Choice) {
  const groups = new Map<string, number[]>();
  for (const shape of shapesIn(shapes, slugs, platforms)) {
    if (!shape.format) continue;
    const list = groups.get(shape.format) ?? [];
    list.push(shape.interactions ?? 0);
    groups.set(shape.format, list);
  }
  const total = [...groups.values()].reduce((sum, list) => sum + list.length, 0);
  return [...groups.entries()]
    .map(([format, list]) => {
      const sorted = [...list].sort((left, right) => left - right);
      return {
        name: FORMAT_LABEL[format] ?? format,
        value: total ? (100 * list.length) / total : 0,
        posts: list.length,
        median: sorted[Math.floor(sorted.length / 2)] ?? 0,
      };
    })
    .sort((left, right) => right.value - left.value);
}

/** A qué hora de La Paz se publica (sólo los posts cuya red da el instante). */
export function hourMix(shapes: readonly PostShape[], slugs: ReadonlySet<string>, platforms: Choice) {
  const counts = new Array<number>(24).fill(0);
  for (const shape of shapesIn(shapes, slugs, platforms)) if (shape.hour !== null) counts[shape.hour] = (counts[shape.hour] ?? 0) + 1;
  const total = counts.reduce((sum, value) => sum + value, 0);
  return { total, rows: counts.map((value, hour) => ({ hour, value: total ? (100 * value) / total : 0, posts: value })) };
}

const EMOTION_LABEL: Record<string, string> = {
  joy: 'Alegría',
  sadness: 'Tristeza',
  anger: 'Enojo',
  surprise: 'Sorpresa',
  disgust: 'Asco',
  fear: 'Miedo',
};

/** El reparto de emociones de los comentarios, ponderado por cuántos clasificó cada cuenta. */
export function emotionMix(companies: readonly SocialCompany[], platforms: Choice) {
  const sums = new Map<string, number>();
  let analyzed = 0;
  for (const company of companies) {
    for (const account of accountsIn(company, platforms)) {
      const mix = account.sentiment?.emotionPct;
      if (!mix || !account.sentiment) continue;
      analyzed += account.sentiment.analyzed;
      for (const [emotion, pct] of Object.entries(mix)) {
        sums.set(emotion, (sums.get(emotion) ?? 0) + pct * account.sentiment.analyzed);
      }
    }
  }
  return {
    analyzed,
    rows: [...sums.entries()]
      .map(([emotion, total]) => ({ name: EMOTION_LABEL[emotion] ?? emotion, value: analyzed ? total / analyzed : 0 }))
      .sort((left, right) => right.value - left.value),
  };
}

export { followersOf };

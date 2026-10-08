/**
 * Las cuentas de «Personalidades», sin React.
 *
 * Todo lo que se calcula —el aporte de cada fuente al índice, qué falta y por qué, los
 * filtros, las medianas por sector, la cobertura— vive aquí y no en los componentes, para
 * que se pruebe con `node --test` y para que el gráfico y la tabla de un mismo panel salgan
 * de las mismas cifras. Solo `import type`: Node no resuelve los módulos propios sin extensión.
 */
import type { PersonRow, SectorKey, Weights } from '@/lib/people-types';

/* ---------------------------------------------------------------- rótulos */

/** Los sectores en el orden en que se leen: de lo que más tiene datos a lo que menos. */
export const SECTORS: ReadonlyArray<{ key: SectorKey; label: string }> = [
  { key: 'POLITICS', label: 'Política' },
  { key: 'BUSINESS', label: 'Empresas' },
  { key: 'SPORTS', label: 'Deporte' },
  { key: 'MEDIA', label: 'Medios y creadores' },
  { key: 'CULTURE', label: 'Cultura' },
  { key: 'CIVIC', label: 'Sociedad civil' },
  { key: 'SCIENCE', label: 'Ciencia' },
  { key: 'UNCLASSIFIED', label: 'Por clasificar' },
];

export const sectorLabel = (key: string): string =>
  SECTORS.find((sector) => sector.key === key)?.label ?? 'Por clasificar';

export const SOURCES: Record<string, string> = {
  MERCO_LEADERS_2025_26: 'Merco Líderes 2025/26',
  OEP_ELECTION_2025: 'Órgano Electoral 2025',
  IPDRS_CREATOR_STUDY_2024: 'Estudio IPDRS 2024',
  IPSOS_IMPACT_2025: 'Ipsos CIESMORI, impacto 2025',
  WIKIDATA_DISCOVERY: 'Wikidata',
  UCB_MARIE_CURIE: 'UCB, Premio Marie Curie',
  UMSA_SCIENCE_2025: 'UMSA, ciencia 2025',
  UCB_SCIENCE_2025: 'UCB, ciencia 2025',
  HAFI_TIKTOK_BOLIVIA: 'Hafi, TikTok Bolivia (directorio)',
  HYPEAUDITOR_INSTAGRAM_BOLIVIA: 'HypeAuditor, Instagram Bolivia (directorio)',
};

export const PLATFORMS: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

export const VERIFICATION: Record<string, string> = {
  WIKIDATA_DECLARED: 'cuenta oficial según Wikidata',
  PLATFORM_VERIFIED: 'verificada por la plataforma',
  HANDLE_MATCHES_WIKIDATA: 'mismo usuario que su cuenta oficial en Wikidata',
  SOURCE_LINKED: 'enlazada por una fuente oficial o de prensa',
  HANDLE_UNCONFIRMED_SMALL: 'mismo usuario que su cuenta oficial, pero muy pequeña y sin verificar',
  IMPLAUSIBLY_SMALL: 'demasiado pequeña para esta figura: probable cuenta abandonada o ajena',
  NAME_MISMATCH: 'el nombre mostrado no coincide',
  NAME_MATCH: 'coincide solo por nombre',
};

/* ---------------------------------------------------------------- formato */

const es = 'es-BO';
export const num = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'sin dato' : value.toLocaleString(es);
export const dec = (value: number, digits = 1): string =>
  value.toLocaleString(es, { minimumFractionDigits: 0, maximumFractionDigits: digits });
export const pct = (value: number, digits = 1): string => `${dec(value, digits)} %`;
/** «+21,0» / «−54,1»: el signo es parte de la cifra, no solo el color. */
export const signed = (value: number, digits = 1): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${dec(Math.abs(value), digits)}`;

/** Quita tildes y mayúsculas para buscar «añez» escribiendo «anez». */
export const folded = (value: string): string =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Las iniciales para el monograma: «Samuel Doria Medina» → «SM»; una palabra → su inicial. */
export function initials(name: string): string {
  const words = name
    .replace(/[‘’'"“”()]/g, '')
    .split(/\s+/u)
    .filter((word) => word.length > 0 && !/^(de|del|la|las|los|y|da|do|van|von)$/iu.test(word));
  if (words.length === 0) return '?';
  if (words.length === 1) return (words[0] ?? '?').slice(0, 1).toUpperCase();
  const first = words[0] ?? '';
  const last = words[words.length - 1] ?? '';
  return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase();
}

/* ------------------------------------------------------------------ índice */

export type ComponentKey = 'views' | 'social' | 'merco';

export const COMPONENT_LABEL: Record<ComponentKey, string> = {
  views: 'Visitas a Wikipedia',
  social: 'Audiencia verificada',
  merco: 'Puesto en Merco',
};

export interface Contribution {
  key: ComponentKey;
  /** Puntos que aporta al índice (0 hasta su peso × 100). */
  points: number;
  /** Lo máximo que podría aportar: el peso × 100. */
  ceiling: number;
  /** Hay dato de esta fuente. Sin dato aporta 0, pero no es «poco»: es «no hay». */
  present: boolean;
  /** El percentil entre las personas medidas, 0–1; `null` si no hay dato. */
  percentile: number | null;
}

const rawOf = (row: PersonRow, key: ComponentKey): number | null =>
  key === 'views'
    ? row.components.wikipediaViews12m
    : key === 'social'
      ? row.components.verifiedFollowers
      : row.components.mercoRank;

/**
 * Cuánto de su índice debe cada persona a cada fuente.
 *
 * El índice es `100·(0,55·pv + 0,25·ps + 0,20·pm)` con los percentiles que ya trae la
 * respuesta: coincide con el que publica el núcleo en las 273 personas medidas, así que el
 * desglose no se inventa, se reparte.
 */
export function contributions(row: PersonRow, weights: Weights): Contribution[] {
  const pcts = row.components.percentiles;
  return (['views', 'social', 'merco'] as const).map((key) => {
    const present = rawOf(row, key) !== null;
    const percentile = present ? (pcts?.[key] ?? 0) : null;
    return {
      key,
      points: present ? weights[key] * (percentile ?? 0) * 100 : 0,
      ceiling: weights[key] * 100,
      present,
      percentile,
    };
  });
}

/** Por qué una fuente no tiene dato, en una frase que se puede leer en voz alta. */
export function missingReason(row: PersonRow, key: ComponentKey): string {
  if (key === 'views') return 'no tiene artículo en Wikipedia';
  if (key === 'social')
    return row.unverified > 0
      ? 'sus cuentas halladas no tienen identidad respaldada, así que no suman'
      : 'no se encontró una cuenta con identidad respaldada';
  return 'no figura en Merco Líderes 2025/26';
}

export const sinDatoMotivo = (row: PersonRow): string =>
  'No tiene artículo en Wikipedia, cuenta verificada ni puesto en Merco: ninguna de las fuentes abiertas que mide el índice lo registra.' +
  (row.unverified > 0
    ? ` Hay ${row.unverified} cuenta(s) hallada(s) que no suman por falta de identidad respaldada.`
    : '');

/* ----------------------------------------------------------- conversación */

export type TalkState = 'publishable' | 'insufficient' | 'none';

export function talkState(row: PersonRow): TalkState {
  if (!row.talk) return 'none';
  return row.talk.sentiment ? 'publishable' : 'insufficient';
}

/** Positivos menos negativos, en puntos porcentuales. */
export const netOf = (row: PersonRow): number | null => {
  const s = row.talk?.sentiment;
  if (!s) return null;
  return s.netScore ?? s.positivePct - s.negativePct;
};

/* ------------------------------------------------------------------ filtros */

export type Only = 'views' | 'social' | 'merco' | 'talk';
export type SortKey = 'score' | 'views' | 'social' | 'merco' | 'name';

export interface Filters {
  sectors: SectorKey[];
  /** El índice mínimo y máximo, 0–100. */
  min: number;
  max: number;
  only: Only[];
  query: string;
  sort: SortKey;
}

export const NO_FILTERS: Filters = {
  sectors: [],
  min: 0,
  max: 100,
  only: [],
  query: '',
  sort: 'score',
};

export const isFiltered = (f: Filters): boolean =>
  f.sectors.length > 0 || f.min > 0 || f.max < 100 || f.only.length > 0 || f.query !== '';

const hasOnly = (row: PersonRow, only: Only): boolean =>
  only === 'talk' ? talkState(row) === 'publishable' : rawOf(row, only) !== null;

/** Quién pasa los filtros. Las personas sin medición no entran si se pide un rango de índice. */
export function applyFilters(rows: readonly PersonRow[], f: Filters): PersonRow[] {
  const needle = folded(f.query.trim());
  const ranged = f.min > 0 || f.max < 100;
  return rows.filter(
    (row) =>
      (f.sectors.length === 0 || f.sectors.includes(row.sector)) &&
      (!ranged || (row.measured && row.score >= f.min && row.score <= f.max)) &&
      f.only.every((only) => hasOnly(row, only)) &&
      (needle === '' || folded(row.name).includes(needle)),
  );
}

const sortValue = (row: PersonRow, sort: Exclude<SortKey, 'name'>): number => {
  if (sort === 'score') return row.measured ? row.score : -1;
  if (sort === 'views') return row.components.wikipediaViews12m ?? -1;
  if (sort === 'social') return row.components.verifiedFollowers ?? -1;
  // En Merco manda el puesto más bajo: se invierte para que «mayor» siga siendo «mejor».
  const place = row.components.mercoRank;
  return place === null ? -1 : 1000 - place;
};

export function sortRows(rows: readonly PersonRow[], sort: SortKey): PersonRow[] {
  const copy = [...rows];
  if (sort === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return copy.sort((a, b) => sortValue(b, sort) - sortValue(a, sort) || a.rank - b.rank);
}

/* ------------------------------------------------- estado en la dirección */

const SECTOR_KEYS = new Set<string>(SECTORS.map((s) => s.key));
const ONLY_KEYS = new Set<string>(['views', 'social', 'merco', 'talk']);
const SORT_KEYS = new Set<string>(['score', 'views', 'social', 'merco', 'name']);

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

/** Los filtros como parámetros de dirección; lo que está en su valor por defecto no se escribe. */
export function filtersToParams(f: Filters): Record<string, string | null> {
  return {
    sector: f.sectors.length ? f.sectors.join(',') : null,
    desde: f.min > 0 ? String(f.min) : null,
    hasta: f.max < 100 ? String(f.max) : null,
    con: f.only.length ? f.only.join(',') : null,
    q: f.query ? f.query : null,
    orden: f.sort !== 'score' ? f.sort : null,
  };
}

/** Lo inverso, tolerante: un valor inventado en la dirección se ignora, no rompe la página. */
export function filtersFromParams(get: (name: string) => string | null): Filters {
  const list = (name: string, allowed: Set<string>): string[] =>
    (get(name) ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => allowed.has(part));
  const number = (name: string, fallback: number): number => {
    const parsed = Number(get(name));
    return get(name) !== null && Number.isFinite(parsed) ? clamp(parsed, 0, 100) : fallback;
  };
  const sort = get('orden') ?? 'score';
  const min = number('desde', 0);
  const max = number('hasta', 100);
  return {
    sectors: list('sector', SECTOR_KEYS) as SectorKey[],
    min: Math.min(min, max),
    max: Math.max(min, max),
    only: list('con', ONLY_KEYS) as Only[],
    query: (get('q') ?? '').slice(0, 80),
    sort: (SORT_KEYS.has(sort) ? sort : 'score') as SortKey,
  };
}

/* ----------------------------------------------------------- estadísticas */

export const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] ?? null)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

export interface SectorStat {
  key: SectorKey;
  label: string;
  n: number;
  measured: number;
  /** Mediana del índice entre las personas medidas; `null` si ninguna lo está. */
  median: number | null;
}

export function sectorStats(rows: readonly PersonRow[]): SectorStat[] {
  return SECTORS.map(({ key, label }) => {
    const inSector = rows.filter((row) => row.sector === key);
    const measured = inSector.filter((row) => row.measured);
    return {
      key,
      label,
      n: inSector.length,
      measured: measured.length,
      median: median(measured.map((row) => row.score)),
    };
  }).filter((stat) => stat.n > 0);
}

export interface CoverageRow {
  key: SectorKey;
  label: string;
  n: number;
  /** Cuántas personas del sector tienen dato en cada fuente. */
  views: number;
  social: number;
  merco: number;
  talk: number;
}

export function coverageBySector(rows: readonly PersonRow[]): CoverageRow[] {
  return SECTORS.map(({ key, label }) => {
    const inSector = rows.filter((row) => row.sector === key);
    return {
      key,
      label,
      n: inSector.length,
      views: inSector.filter((row) => hasOnly(row, 'views')).length,
      social: inSector.filter((row) => hasOnly(row, 'social')).length,
      merco: inSector.filter((row) => hasOnly(row, 'merco')).length,
      talk: inSector.filter((row) => hasOnly(row, 'talk')).length,
    };
  }).filter((row) => row.n > 0);
}

export interface Bin {
  from: number;
  to: number;
  count: number;
}

/** Cuántas personas medidas caen en cada tramo de `width` puntos del índice. */
export function histogram(rows: readonly PersonRow[], width = 10): Bin[] {
  const bins: Bin[] = [];
  for (let from = 0; from < 100; from += width) bins.push({ from, to: from + width, count: 0 });
  for (const row of rows) {
    if (!row.measured) continue;
    const bin = bins[Math.min(bins.length - 1, Math.floor(row.score / width))];
    if (bin) bin.count += 1;
  }
  return bins;
}

/** Quien tiene dato de Wikipedia y de audiencia a la vez: los puntos de la dispersión. */
export function scatterPoints(
  rows: readonly PersonRow[],
): Array<{ slug: string; name: string; views: number; followers: number; sector: SectorKey }> {
  return rows.flatMap((row) => {
    const views = row.components.wikipediaViews12m;
    const followers = row.components.verifiedFollowers;
    return views && followers && views > 0 && followers > 0
      ? [{ slug: row.slug, name: row.name, views, followers, sector: row.sector }]
      : [];
  });
}

/* ----------------------------------------------------------- dos lentes */

export interface LensRow {
  slug: string;
  name: string;
  ipsosRank: number;
  ipsosShare: number;
  indexRank: number | null;
  /** Por qué el índice la pone donde la pone, cuando la distancia es grande. */
  why: string | null;
}

/**
 * Las figuras de Ipsos frente al puesto que ocupan en el índice de atención.
 *
 * La explicación sale de lo que le falta a la persona, no de una frase escrita a mano por
 * caso: quien no tiene artículo en Wikipedia pierde el 55 % del índice antes de empezar.
 */
export function lensRows(
  ranking: ReadonlyArray<{ rank: number; slug: string; name: string; impactSharePercent: number }>,
  rows: readonly PersonRow[],
  total: number,
): LensRow[] {
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  return ranking.map((entry) => {
    const row = bySlug.get(entry.slug);
    const place = row?.rank ?? null;
    const gap = place === null ? 0 : place - entry.rank;
    const missing = row
      ? (['views', 'social', 'merco'] as const).filter((key) => rawOf(row, key) === null)
      : [];
    let why: string | null = null;
    if (row && gap > Math.max(10, total * 0.1)) {
      why = missing.includes('views')
        ? 'No tiene artículo en Wikipedia: pierde el 55 % del índice.'
        : missing.length
          ? `Sin dato de ${missing.map((key) => COMPONENT_LABEL[key].toLowerCase()).join(' ni de ')}.`
          : null;
    }
    return {
      slug: entry.slug,
      name: entry.name,
      ipsosRank: entry.rank,
      ipsosShare: entry.impactSharePercent,
      indexRank: place,
      why,
    };
  });
}

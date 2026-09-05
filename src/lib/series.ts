import 'server-only';
import { pool } from './db';

/**
 * Corpus-wide aggregates, computed once and held for a while.
 *
 * The cross-tabulation and the pulse describe the whole archive and do not
 * depend on who is asking, but they are read from a view that reassembles every
 * claim from its evidence — at thirty-eight thousand articles that is seconds
 * of work, repeated on every page load, and it pushed the landing page past the
 * statement timeout.
 *
 * The corpus only changes when the collectors run and the seeds are loaded, so
 * a few minutes of staleness costs nothing and the figures stay exact. The
 * promise itself is cached rather than its result, so ten simultaneous readers
 * wait on one query instead of starting ten.
 */
const HELD = new Map<string, { at: number; value: Promise<unknown> }>();
const HOLD_MS = 5 * 60 * 1000;

function held<T>(key: string, build: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = HELD.get(key);
  if (entry && now - entry.at < HOLD_MS) return entry.value as Promise<T>;
  const value = build().catch((error: unknown) => {
    // A failed read must not be remembered as the answer for five minutes.
    HELD.delete(key);
    throw error;
  });
  HELD.set(key, { at: now, value });
  return value;
}

/**
 * Reads the observatory's daily series and shapes them for reporting.
 *
 * The press panels read `press_article_snapshot` rather than the view it
 * copies. The view is the definition — the thing to read to know how a note was
 * filed — but it reassembles every claim from its evidence and applies the
 * whole lexicon on each query, which at thirty-eight thousand notes is nine
 * seconds. The snapshot is that same output, indexed, rebuilt when a collection
 * or a seed load ends. See ADR 0020.
 *
 * Every figure the dashboard shows comes from `read_models`, the contract the
 * core publishes for analysis. Nothing is recomputed here that the database
 * already decides — the median across venues, the day-over-day change and the
 * gap are the core's, not this page's, so two consumers cannot disagree about
 * what the parallel rate was on a given day.
 */

/** How a day was reduced to a single number. */
export type Aggregation = 'POINT_IN_TIME' | 'DAILY_AVERAGE';

export interface DailyPoint {
  date: string;
  side: 'OFFICIAL' | 'BUY' | 'SELL' | null;
  aggregation: Aggregation;
  value: number;
  spread: number | null;
  venues: number | null;
  changePercent: number | null;
}

export interface IndicatorSeries {
  code: string;
  points: DailyPoint[];
}

export interface Observatory {
  /** Every daily point, keyed by indicator code. */
  series: Map<string, DailyPoint[]>;
  /** Most recent calendar date with any reading at all. */
  latestDate: string | null;
  /** When the most recent reading reached the database. */
  lastReceivedAt: string | null;
  /** How many individual readings back the whole picture. */
  readingCount: number;
}

interface DailyRow {
  indicator_code: string;
  price_side: string | null;
  aggregation: string;
  event_date: string;
  value_median: string;
  value_spread: string | null;
  venue_count: number | null;
  change_percent: string | null;
  last_received_at: Date | null;
}

const numberOrNull = (value: string | null): number | null =>
  value === null ? null : Number(value);

/**
 * Prefers the reading taken at a moment over the day averaged after the fact.
 *
 * A day covered by both statistics yields two rows by design. Charting both as
 * one line would splice different measurements together, so the observed one
 * wins and the archived one is kept only where nothing observed it.
 */
function preferObserved(points: DailyPoint[]): DailyPoint[] {
  const byDate = new Map<string, DailyPoint>();
  for (const point of points) {
    const current = byDate.get(point.date);
    if (
      !current ||
      (current.aggregation !== 'POINT_IN_TIME' && point.aggregation === 'POINT_IN_TIME')
    ) {
      byDate.set(point.date, point);
    }
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

export async function readObservatory(): Promise<Observatory> {
  const { rows } = await pool().query<DailyRow>(
    `SELECT indicator_code, price_side, aggregation, event_date::text AS event_date,
            value_median::text AS value_median, value_spread::text AS value_spread,
            venue_count, change_percent::text AS change_percent, last_received_at
     FROM read_models.economic_indicator_daily
     ORDER BY event_date`,
  );

  const series = new Map<string, DailyPoint[]>();
  let lastReceivedAt: Date | null = null;

  for (const row of rows) {
    const key = row.price_side ? `${row.indicator_code}:${row.price_side}` : row.indicator_code;
    const point: DailyPoint = {
      date: row.event_date,
      side: (row.price_side ?? null) as DailyPoint['side'],
      aggregation: row.aggregation === 'DAILY_AVERAGE' ? 'DAILY_AVERAGE' : 'POINT_IN_TIME',
      value: Number(row.value_median),
      spread: numberOrNull(row.value_spread),
      venues: row.venue_count,
      changePercent: numberOrNull(row.change_percent),
    };
    series.set(key, [...(series.get(key) ?? []), point]);
    if (row.last_received_at && (!lastReceivedAt || row.last_received_at > lastReceivedAt)) {
      lastReceivedAt = row.last_received_at;
    }
  }

  for (const [key, points] of series) series.set(key, preferObserved(points));

  const dates = [...series.values()].flatMap((points) => points.map((point) => point.date)).sort();

  return {
    series,
    latestDate: dates.at(-1) ?? null,
    lastReceivedAt: lastReceivedAt?.toISOString() ?? null,
    readingCount: rows.length,
  };
}

export interface GapPoint {
  date: string;
  official: number;
  parallelMid: number;
  gapPercent: number;
  officialAggregation: Aggregation;
  parallelAggregation: Aggregation;
}

interface GapRow {
  event_date: string;
  official_rate: string;
  parallel_mid: string | null;
  gap_mid_percent: string | null;
  official_aggregation: string;
  parallel_aggregation: string;
}

/** The gap the core computes, read rather than recalculated. */
export async function readGap(): Promise<GapPoint[]> {
  const { rows } = await pool().query<GapRow>(
    `SELECT event_date::text AS event_date, official_rate::text AS official_rate,
            parallel_mid::text AS parallel_mid, gap_mid_percent::text AS gap_mid_percent,
            official_aggregation, parallel_aggregation
     FROM read_models.exchange_rate_gap
     ORDER BY event_date`,
  );

  return rows
    .filter((row) => row.parallel_mid !== null && row.gap_mid_percent !== null)
    .map((row) => ({
      date: row.event_date,
      official: Number(row.official_rate),
      parallelMid: Number(row.parallel_mid),
      gapPercent: Number(row.gap_mid_percent),
      officialAggregation: row.official_aggregation as Aggregation,
      parallelAggregation: row.parallel_aggregation as Aggregation,
    }));
}

export interface SourceNote {
  publisher: string;
  sourceUrl: string;
  indicator: string;
  /** What the series measures, as its publisher names it. */
  name: string | null;
  unit: string | null;
  frequency: string | null;
  readings: number;
  /** How many distinct documents this series was read from. */
  documents: number;
  firstDay: string;
  lastDay: string;
}

/**
 * Where each series comes from, so a reader can go and check it.
 *
 * One row per series and publisher, not per document. Grouping by the address
 * as well listed the official rate three times — once per capture the collector
 * made — which reads as three different series rather than as one series with
 * three receipts. The receipt count is kept as its own column, because how many
 * documents a series was assembled from is a fact about how much it can be
 * trusted, and the row still links to one of them.
 */
export async function readSources(): Promise<SourceNote[]> {
  const { rows } = await pool().query<{
    publisher: string;
    source_url: string;
    indicator_code: string;
    indicator_name: string | null;
    unit: string | null;
    frequency: string | null;
    readings: string;
    documents: string;
    first_day: string;
    last_day: string;
  }>(
    `SELECT publisher, indicator_code,
            max(indicator_name) AS indicator_name,
            max(unit) AS unit,
            max(frequency) AS frequency,
            count(*)::text AS readings,
            count(DISTINCT source_url)::text AS documents,
            min(source_url) AS source_url,
            min(event_date)::text AS first_day,
            max(event_date)::text AS last_day
     FROM read_models.economic_indicator_reading
     WHERE status = 'PUBLISHED' AND NOT superseded
     GROUP BY publisher, indicator_code
     ORDER BY indicator_code, publisher`,
  );

  return rows.map((row) => ({
    publisher: row.publisher,
    sourceUrl: row.source_url,
    indicator: row.indicator_code,
    name: row.indicator_name,
    unit: row.unit,
    frequency: row.frequency,
    readings: Number(row.readings),
    documents: Number(row.documents),
    firstDay: row.first_day,
    lastDay: row.last_day,
  }));
}

/**
 * The official rate as a single series.
 *
 * The archived series carries both sides as its publisher does, while the
 * collector records the single administered rate the central bank states. The
 * precedence here is deliberately the same one the gap view applies in the
 * database — published rate first, then the selling side — so the line a reader
 * sees and the gap they read underneath it cannot disagree about what the
 * official rate was on a given day.
 */
export function officialSeries(observatory: Observatory): DailyPoint[] {
  const order: Array<DailyPoint['side']> = ['OFFICIAL', 'SELL', 'BUY'];
  const byDate = new Map<string, { point: DailyPoint; rank: number }>();

  for (const [rank, side] of order.entries()) {
    const key = side === null ? 'FX_OFFICIAL_USD_BOB' : `FX_OFFICIAL_USD_BOB:${side}`;
    for (const point of observatory.series.get(key) ?? []) {
      const current = byDate.get(point.date);
      if (!current || rank < current.rank) byDate.set(point.date, { point, rank });
    }
  }

  return [...byDate.values()]
    .map((entry) => entry.point)
    .sort((left, right) => left.date.localeCompare(right.date));
}

export interface MacroPoint {
  indicatorCode: string;
  sector: string;
  name: string | null;
  period: string;
  unit: string;
  value: number;
  previousValue: number | null;
  changePercent: number | null;
  publisher: string | null;
  sourceUrl: string | null;
}

/**
 * The annual series that give the daily rates their context.
 *
 * Read from their own model rather than filtered out of the daily one: a yearly
 * figure and a quoted price are different frequencies, and the database keeps
 * them apart so no consumer has to remember to.
 */
export async function readMacroAnnual(): Promise<MacroPoint[]> {
  const { rows } = await pool().query<{
    indicator_code: string;
    indicator_name: string | null;
    sector: string;
    period: string;
    unit: string;
    value: string;
    previous_value: string | null;
    change_percent: string | null;
    publisher: string | null;
    source_url: string | null;
  }>(
    `SELECT indicator_code, indicator_name, sector, period, unit,
            value::text AS value, previous_value::text AS previous_value,
            change_percent::text AS change_percent, publisher, source_url
     FROM read_models.macro_indicator_annual
     ORDER BY indicator_code, period`,
  );

  return rows.map((row) => ({
    indicatorCode: row.indicator_code,
    name: row.indicator_name,
    sector: row.sector,
    period: row.period,
    unit: row.unit,
    value: Number(row.value),
    previousValue: row.previous_value === null ? null : Number(row.previous_value),
    changePercent: row.change_percent === null ? null : Number(row.change_percent),
    publisher: row.publisher,
    sourceUrl: row.source_url,
  }));
}

export interface CompanyFiling {
  factClaimId: string;
  eventDate: string;
  publishedAt: string | null;
  filer: string;
  /** Short code the exchange assigns the issuer. */
  filerCode: string | null;
  /** Industry derived from the issuer's registered name, not published by the exchange. */
  sector: string;
  /**
   * What the filing is about, read from its subject line.
   *
   * The exchange lets each issuer word its own subject, so the register holds
   * four thousand distinct ones. Migration 0061 files them into eleven
   * categories and a residual.
   */
  category: string;
  subject: string;
  statedInstant: string | null;
  instantStatedInDocument: boolean | null;
  sourceUrl: string | null;
  evidenceSha256: string | null;
  excerpt: string | null;
  /** The filing in prose, pulled out of whatever shape the evidence has. */
  summary: string | null;
  /** Whether that prose is the filing's own page or the register's summary. */
  summaryIsComplete: boolean;
}

/**
 * The readable sentence inside a filing's evidence.
 *
 * Evidence is kept verbatim so a figure can be checked against its source, and
 * for the register that verbatim form is a JSON record — which is correct as
 * evidence and unreadable as copy. The prose lives in its `abstract`; entities
 * survive the round trip through the exchange's own encoder, so they are
 * decoded here rather than shown as `&nbsp;`.
 *
 * Filings captured from their own page carry prose already and pass through.
 */
function isDocumentProse(text: string | null): boolean {
  return Boolean(text && !text.trim().startsWith('{'));
}

function filingSummary(excerpt: string | null): string | null {
  if (!excerpt) return null;
  const trimmed = excerpt.trim();
  if (!trimmed.startsWith('{')) return trimmed || null;
  try {
    const record: unknown = JSON.parse(trimmed);
    const abstract =
      typeof record === 'object' && record !== null && 'abstract' in record
        ? (record as { abstract?: unknown }).abstract
        : null;
    if (typeof abstract !== 'string' || !abstract.trim()) return null;
    return abstract
      .replace(/&nbsp;/gu, ' ')
      .replace(/&amp;/gu, '&')
      .replace(/&quot;/gu, '"')
      .replace(/&#0?39;/gu, "'")
      .replace(/&lt;/gu, '<')
      .replace(/&gt;/gu, '>')
      .replace(/\s+/gu, ' ')
      .trim();
  } catch {
    return null;
  }
}

/**
 * Material events filed with the exchange.
 *
 * Read from their own model: a filing has no value, no unit and no series, so
 * it never belonged with the indicators even though it shares their provenance.
 */
export async function readCompanyFilings(limit = 1_000): Promise<CompanyFiling[]> {
  const { rows } = await pool().query<{
    fact_claim_id: string;
    event_date: string;
    published_at: Date | null;
    filer: string;
    filer_code: string | null;
    sector: string;
    category: string;
    document_text: string | null;
    subject: string;
    stated_instant: string | null;
    instant_stated_in_document: boolean | null;
    source_url: string | null;
    evidence_sha256: string | null;
    excerpt: string | null;
  }>(
    `SELECT fact_claim_id, event_date::text AS event_date, published_at, filer, filer_code,
            sector, category, subject, stated_instant, instant_stated_in_document, source_url,
            evidence_sha256, excerpt, document_text
     FROM read_models.company_filing
     WHERE status = 'PUBLISHED' AND NOT superseded
     ORDER BY published_at DESC NULLS LAST, event_date DESC
     LIMIT $1`,
    [limit],
  );

  return rows.map((row) => ({
    factClaimId: row.fact_claim_id,
    eventDate: row.event_date,
    publishedAt: row.published_at?.toISOString() ?? null,
    filer: row.filer,
    filerCode: row.filer_code,
    sector: row.sector,
    category: row.category,
    subject: row.subject,
    statedInstant: row.stated_instant,
    instantStatedInDocument: row.instant_stated_in_document,
    sourceUrl: row.source_url,
    evidenceSha256: row.evidence_sha256,
    excerpt: row.excerpt,
    // The filing's own page when it was captured; the register's summary when
    // it was not. Never both concatenated, and never the raw evidence record.
    //
    // The model returns the longest evidence on the claim, which falls back to
    // the register record when no page was captured — so the text only counts
    // as complete when it is prose rather than that record.
    summary: filingSummary(row.document_text) ?? filingSummary(row.excerpt),
    summaryIsComplete: isDocumentProse(row.document_text),
  }));
}

export interface PressArticle {
  factClaimId: string;
  eventDate: string;
  publishedAt: string | null;
  outlet: string;
  domain: string;
  section: string;
  headline: string;
  summary: string | null;
  url: string;
  /** Derived from the headline and standfirst, not published by the outlet. */
  topic: string;
  /** Lexicon category the headline matched: alarm, conflict, direction, doubt. */
  tone: string;
  /** Department the story names, or NACIONAL when it names none. */
  region: string;
  /** SYNDICATED_FEED or RENDERED_SECTION: how the listing was obtained. */
  retrievalMethod: string | null;
  evidenceSha256: string | null;
}

/**
 * Press coverage of the economy.
 *
 * Read from its own model, never joined to a series. An outlet reporting that
 * the dollar moved is not a reading of the dollar, and the report keeps the two
 * apart so a reader always knows which they are looking at.
 */
export async function readPressArticles(limit = 1_000): Promise<PressArticle[]> {
  const { rows } = await pool().query<{
    fact_claim_id: string;
    event_date: string;
    published_at: Date | null;
    outlet: string;
    domain: string;
    section: string;
    headline: string;
    summary: string | null;
    article_url: string;
    topic: string;
    tone: string;
    region: string;
    retrieval_method: string | null;
    evidence_sha256: string | null;
  }>(
    `SELECT fact_claim_id, event_date::text AS event_date, published_at, outlet, domain,
            section, headline, summary, article_url, topic, tone, region,
            retrieval_method, evidence_sha256
     FROM read_models.press_article_snapshot
     WHERE status = 'PUBLISHED' AND NOT superseded
     ORDER BY published_at DESC NULLS LAST, event_date DESC
     LIMIT $1`,
    [limit],
  );

  return rows.map((row) => ({
    factClaimId: row.fact_claim_id,
    eventDate: row.event_date,
    publishedAt: row.published_at?.toISOString() ?? null,
    outlet: row.outlet,
    domain: row.domain,
    section: row.section,
    headline: row.headline,
    summary: row.summary,
    url: row.article_url,
    topic: row.topic,
    tone: row.tone,
    region: row.region,
    retrievalMethod: row.retrieval_method,
    evidenceSha256: row.evidence_sha256,
  }));
}

export interface MarketPoint {
  date: string;
  value: number;
}

export interface MarketSeries {
  code: string;
  name: string;
  unit: string;
  latest: number;
  latestDate: string;
  changePercent: number | null;
  /** Change over the whole window held, which is what a two-year series is for. */
  windowPercent: number | null;
  points: MarketPoint[];
}

const MARKET_NAMES: Record<string, string> = {
  BTC_USD: 'Bitcoin',
  USDT_USD: 'Estables USDT/USDC',
  XAU_USD: 'Oro (PAX Gold)',
};

/**
 * The markets that bear on the Bolivian dollar.
 *
 * Read separately from the Bolivian series because they are quoted elsewhere in
 * another currency: putting a dollar price of gold on the same axis as
 * bolivianos per dollar would be a category error, however tempting the shared
 * word "price" makes it.
 */
export async function readMarkets(): Promise<MarketSeries[]> {
  const { rows } = await pool().query<{
    indicator_code: string;
    event_date: string;
    value_median: string;
    unit: string;
  }>(
    `SELECT indicator_code, event_date::text AS event_date, value_median::text, unit
     FROM read_models.economic_indicator_daily
     WHERE indicator_code IN ('BTC_USD', 'USDT_USD', 'XAU_USD')
     ORDER BY indicator_code, event_date`,
  );

  const grouped = new Map<string, { unit: string; points: MarketPoint[] }>();
  for (const row of rows) {
    const entry = grouped.get(row.indicator_code) ?? { unit: row.unit, points: [] };
    entry.points.push({ date: row.event_date, value: Number(row.value_median) });
    grouped.set(row.indicator_code, entry);
  }

  return [...grouped.entries()].map(([code, entry]) => {
    const last = entry.points.at(-1);
    const previous = entry.points.at(-2);
    const first = entry.points.at(0);
    return {
      code,
      name: MARKET_NAMES[code] ?? code,
      unit: entry.unit,
      latest: last?.value ?? 0,
      latestDate: last?.date ?? '',
      changePercent:
        last && previous && previous.value !== 0
          ? ((last.value - previous.value) / previous.value) * 100
          : null,
      windowPercent:
        last && first && first.value !== 0
          ? ((last.value - first.value) / first.value) * 100
          : null,
      points: entry.points,
    };
  });
}

export interface TermMention {
  term: string;
  label: string;
  family: string;
  mentions: number;
  outlets: number;
  /** Share of the watched vocabulary this term accounts for. */
  share: number;
}

/**
 * How often each watched term is being said, and by how many mastheads.
 *
 * A watchlist rather than a word count: ranking every word surfaces "gobierno"
 * and tells a reader nothing. The outlet count matters as much as the total —
 * a term one paper repeats is that paper's campaign, a term six papers use is
 * the country's conversation.
 */
export async function readPressTerms(): Promise<TermMention[]> {
  const { rows } = await pool().query<{
    term: string;
    label: string;
    family: string;
    mentions: string;
    outlets: string;
  }>(
    `SELECT term, label, family, count(*)::text AS mentions,
            count(DISTINCT outlet)::text AS outlets
     FROM read_models.press_term_mention_snapshot
     GROUP BY term, label, family
     ORDER BY count(*) DESC`,
  );

  const total = rows.reduce((sum, row) => sum + Number(row.mentions), 0) || 1;
  return rows.map((row) => ({
    term: row.term,
    label: row.label,
    family: row.family,
    mentions: Number(row.mentions),
    outlets: Number(row.outlets),
    share: Number(row.mentions) / total,
  }));
}

export interface ToneYear {
  year: string;
  tone: string;
  articles: number;
}

export interface RegionCount {
  region: string;
  articles: number;
}

export interface PressPulseData {
  total: number;
  outlets: number;
  firstDay: string | null;
  lastDay: string | null;
  toneByYear: ToneYear[];
  regions: RegionCount[];
  /**
   * What share of coverage the tone lexicon leaves unmarked, split by how much
   * text it had to read. An archived row carries only the headline recovered
   * from its address; a live one carries the standfirst too. The difference is
   * the honest explanation of the unmarked share, and it is measured rather
   * than asserted so it cannot drift away from the corpus.
   */
  unmarked: { archive: number; live: number; archiveLength: number; liveLength: number };
}

/**
 * The shape of the whole corpus, counted where it lives.
 *
 * Twenty thousand articles do not travel to a browser to be tallied there: the
 * database groups them and the page receives the counts. The register below
 * still shows individual stories, but a page of them rather than all of them,
 * because nobody reads twenty thousand cards and sending them costs seconds.
 */
export function readPressPulse(): Promise<PressPulseData> {
  return held('pulse', buildPressPulse);
}

async function buildPressPulse(): Promise<PressPulseData> {
  const [summary, tones, regions, marks] = await Promise.all([
    pool().query<{ total: string; outlets: string; first_day: string; last_day: string }>(
      `SELECT count(*)::text AS total, count(DISTINCT outlet)::text AS outlets,
              min(event_date)::text AS first_day, max(event_date)::text AS last_day
       FROM read_models.press_article_snapshot
       WHERE status = 'PUBLISHED' AND NOT superseded`,
    ),
    pool().query<{ year: string; tone: string; articles: string }>(
      `SELECT left(event_date::text, 4) AS year, tone, count(*)::text AS articles
       FROM read_models.press_article_snapshot
       WHERE status = 'PUBLISHED' AND NOT superseded
       GROUP BY 1, 2
       ORDER BY 1, 3 DESC`,
    ),
    pool().query<{ region: string; articles: string }>(
      `SELECT region, count(*)::text AS articles
       FROM read_models.press_article_snapshot
       WHERE status = 'PUBLISHED' AND NOT superseded
       GROUP BY 1
       ORDER BY 2 DESC`,
    ),
    pool().query<{ archived: boolean; unmarked: string; letters: string }>(
      `SELECT coalesce(retrieval_method, 'WEB_ARCHIVE') = 'WEB_ARCHIVE' AS archived,
              round(100.0 * count(*) FILTER (WHERE tone = 'NEUTRO') / count(*), 0)::text
                AS unmarked,
              round(avg(length(coalesce(headline, '') || coalesce(summary, ''))))::text
                AS letters
       FROM read_models.press_article_snapshot
       WHERE status = 'PUBLISHED' AND NOT superseded
       GROUP BY 1`,
    ),
  ]);

  const archived = marks.rows.find((row) => row.archived);
  const live = marks.rows.find((row) => !row.archived);

  const head = summary.rows[0];
  return {
    total: Number(head?.total ?? 0),
    outlets: Number(head?.outlets ?? 0),
    firstDay: head?.first_day ?? null,
    lastDay: head?.last_day ?? null,
    toneByYear: tones.rows.map((row) => ({
      year: row.year,
      tone: row.tone,
      articles: Number(row.articles),
    })),
    regions: regions.rows.map((row) => ({
      region: row.region,
      articles: Number(row.articles),
    })),
    unmarked: {
      archive: Number(archived?.unmarked ?? 0),
      live: Number(live?.unmarked ?? 0),
      archiveLength: Number(archived?.letters ?? 0),
      liveLength: Number(live?.letters ?? 0),
    },
  };
}

export interface PressCube {
  /** Dictionaries: every cell holds indices into these, never the strings. */
  years: string[];
  tones: string[];
  topics: string[];
  regions: string[];
  outlets: string[];
  terms: Array<{ term: string; label: string; family: string }>;
  /** [year, tone, topic, region, outlet, articles] over the whole corpus. */
  cells: number[][];
  /** [term, year, tone, topic, region, outlet, articles]; one row per article per term. */
  termCells: number[][];
}

/**
 * The whole press corpus, small enough to filter in the browser.
 *
 * Cross-filtering — click a bar and every other visual narrows to it — cannot
 * be done from counts already summed over everything, and doing it from the
 * articles themselves would mean shipping twenty-two thousand rows. So what
 * travels is the cross-tabulation: one row per distinct combination of year,
 * tone, subject, department and masthead. There are about fourteen hundred of
 * them, and any figure any visual needs is a sum over the rows that match the
 * selections belonging to the OTHER visuals.
 *
 * The counts are therefore corpus-wide and exact, not counts of the page of
 * articles that happens to be on screen — which is what a reader assumes a
 * filter's number means.
 */
export function readPressCube(search?: string): Promise<PressCube> {
  const term = search?.trim() ?? '';
  return term ? buildPressCube(search) : held('cube', () => buildPressCube(undefined));
}

async function buildPressCube(search?: string): Promise<PressCube> {
  /*
   * A free-text search cannot be answered from the cross-tabulation — there is
   * no text in it — so when there is one the cube is rebuilt under it. Leaving
   * the search out would leave every count on the panel speaking for the whole
   * corpus while the stories underneath spoke for the search: the figures would
   * simply be wrong, which is worse than being slow.
   *
   * It is done in two scans and never as a join. Joining the vocabulary view to
   * the article view makes the planner materialise both and pair twenty-two
   * thousand rows against eight thousand — that query ran for over ten minutes
   * before it was cancelled. Scanning the articles once yields both the counts
   * and the ids that matched, and the vocabulary is then read for those ids
   * alone, which for a real search is a few hundred of them.
   */
  const term = search?.trim() ? `%${search.trim()}%` : null;

  const facts = await pool().query<{
    fact_claim_id: string;
    year: string;
    tone: string;
    topic: string;
    region: string;
    outlet: string;
  }>(
    `SELECT fact_claim_id, left(event_date::text, 4) AS year, tone, topic, region, outlet
     FROM read_models.press_article_snapshot
     WHERE status = 'PUBLISHED' AND NOT superseded
     ${term ? `AND (headline ILIKE $1 OR coalesce(summary, '') ILIKE $1)` : ''}`,
    term ? [term] : [],
  );

  const mentions = await pool().query<{
    term: string;
    label: string;
    family: string;
    year: string;
    tone: string;
    topic: string;
    region: string;
    outlet: string;
    articles: string;
  }>(
    `SELECT term, label, family, left(event_date::text, 4) AS year, tone, topic, region, outlet,
            count(*)::text AS articles
     FROM read_models.press_term_mention_snapshot
     ${term ? 'WHERE fact_claim_id = ANY($1::uuid[])' : ''}
     GROUP BY 1, 2, 3, 4, 5, 6, 7, 8`,
    term ? [facts.rows.map((row) => row.fact_claim_id)] : [],
  );

  /** Assigns each distinct value an index, in first-seen order. */
  const dictionary = (): { of: (value: string) => number; values: string[] } => {
    const index = new Map<string, number>();
    const values: string[] = [];
    return {
      of(value: string): number {
        const held = index.get(value);
        if (held !== undefined) return held;
        index.set(value, values.length);
        values.push(value);
        return values.length - 1;
      },
      values,
    };
  };

  const years = dictionary();
  const tones = dictionary();
  const topics = dictionary();
  const regions = dictionary();
  const outlets = dictionary();
  const termIndex = new Map<string, number>();
  const terms: Array<{ term: string; label: string; family: string }> = [];

  /** One cell per distinct combination, tallied from the rows just read. */
  const tally = new Map<string, number[]>();
  for (const row of facts.rows) {
    const cell = [
      years.of(row.year),
      tones.of(row.tone),
      topics.of(row.topic),
      regions.of(row.region),
      outlets.of(row.outlet),
    ];
    const key = cell.join(':');
    const held = tally.get(key);
    if (held) held[5] = (held[5] ?? 0) + 1;
    else tally.set(key, [...cell, 1]);
  }
  const cells = [...tally.values()];

  const termCells = mentions.rows.map((row) => {
    let index = termIndex.get(row.term);
    if (index === undefined) {
      index = terms.length;
      termIndex.set(row.term, index);
      terms.push({ term: row.term, label: row.label, family: row.family });
    }
    return [
      index,
      years.of(row.year),
      tones.of(row.tone),
      topics.of(row.topic),
      regions.of(row.region),
      outlets.of(row.outlet),
      Number(row.articles),
    ];
  });

  return {
    years: years.values,
    tones: tones.values,
    topics: topics.values,
    regions: regions.values,
    outlets: outlets.values,
    terms,
    cells,
    termCells,
  };
}

export interface PressQuery {
  year?: string | undefined;
  tone?: string | undefined;
  topic?: string | undefined;
  region?: string | undefined;
  outlet?: string | undefined;
  term?: string | undefined;
  search?: string | undefined;
}

/**
 * The page of articles a selection points at, chosen in the database.
 *
 * The cube says how many; this says which. Both read the same view under the
 * same predicate, so the number on a filter and the stories under it can never
 * disagree — which they would the moment the page filtered a cached first
 * thousand while the counts spoke for the whole corpus.
 */
export async function readPressPage(
  query: PressQuery,
  limit = 60,
  offset = 0,
): Promise<{ articles: PressArticle[]; total: number }> {
  const where: string[] = [`status = 'PUBLISHED'`, 'NOT superseded'];
  const values: unknown[] = [];
  const bind = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.year) where.push(`left(event_date::text, 4) = ${bind(query.year)}`);
  if (query.tone) where.push(`tone = ${bind(query.tone)}`);
  if (query.region) where.push(`region = ${bind(query.region)}`);
  if (query.outlet) where.push(`outlet = ${bind(query.outlet)}`);
  if (query.topic === 'ECONOMICOS') where.push(`topic <> 'OTROS'`);
  else if (query.topic) where.push(`topic = ${bind(query.topic)}`);
  if (query.term) {
    where.push(
      `fact_claim_id IN (SELECT fact_claim_id FROM read_models.press_term_mention_snapshot
                          WHERE term = ${bind(query.term)})`,
    );
  }
  if (query.search) {
    const pattern = bind(`%${query.search}%`);
    where.push(`(headline ILIKE ${pattern} OR coalesce(summary, '') ILIKE ${pattern})`);
  }

  /*
   * The page, and nothing but the page.
   *
   * It used to carry `count(*) OVER ()` so the panel could say how many the
   * selection held. That window function is computed before LIMIT, which means
   * counting every matching claim out of a view that reassembles each one from
   * its evidence: two seconds on every request once the corpus reached
   * thirty-eight thousand. The panel already knows the total — it sums it from
   * the cross-tabulation it holds — so asking the database for it again was
   * paying twice for an answer already in hand.
   */
  const predicate = where.join(' AND ');
  const page = await pool().query<{
    fact_claim_id: string;
    event_date: string;
    published_at: Date | null;
    outlet: string;
    domain: string;
    section: string;
    headline: string;
    summary: string | null;
    article_url: string;
    topic: string;
    tone: string;
    region: string;
    retrieval_method: string | null;
    evidence_sha256: string | null;
  }>(
    `SELECT fact_claim_id, event_date::text AS event_date, published_at, outlet, domain,
            section, headline, summary, article_url, topic, tone, region,
            retrieval_method, evidence_sha256
     FROM read_models.press_article_snapshot
     WHERE ${predicate}
     ORDER BY event_date DESC, published_at DESC NULLS LAST, fact_claim_id
     LIMIT ${bind(limit)} OFFSET ${bind(offset)}`,
    values,
  );

  return {
    articles: page.rows.map((row) => ({
      factClaimId: row.fact_claim_id,
      eventDate: row.event_date,
      publishedAt: row.published_at?.toISOString() ?? null,
      outlet: row.outlet,
      domain: row.domain,
      section: row.section,
      headline: row.headline,
      summary: row.summary,
      url: row.article_url,
      topic: row.topic,
      tone: row.tone,
      region: row.region,
      retrievalMethod: row.retrieval_method,
      evidenceSha256: row.evidence_sha256,
    })),
    // The panel counts the selection from its cross-tabulation; this is only
    // a floor for the callers that have none.
    total: page.rows.length,
  };
}

export interface SocialReading {
  metric: string;
  platform: string;
  subject: string;
  label: string;
  value: number;
  unit: string;
  referencePeriod: string;
  eventDate: string;
  publisher: string;
  publication: string;
  method: string;
  evidenceGrade: string;
  emotionalRegister: string;
  officialCounterpart: string;
  statement: string | null;
  url: string;
}

export interface SocialAudience {
  platform: string;
  metric: string;
  label: string;
  value: number;
  unit: string;
  internetUsers: number | null;
  exceedsInternetUsers: boolean;
}

/**
 * What third parties published about the social platforms.
 *
 * Read from its own model and never mixed into a series. Every other figure on
 * this report is a measurement or a report of one; these are readings of what a
 * country expects and feels, compiled by people who sell the compilation. The
 * evidence grade travels with each row so the panel can show what it rests on
 * instead of averaging a household panel and a platform's ad planner into one
 * voice.
 */
export async function readSocialReadings(): Promise<SocialReading[]> {
  const { rows } = await pool().query<{
    metric: string;
    platform: string;
    subject: string;
    label: string;
    value: string;
    unit: string;
    reference_period: string;
    event_date: string;
    publisher: string;
    publication: string;
    method: string;
    evidence_grade: string;
    emotional_register: string;
    official_counterpart: string;
    statement: string | null;
    reading_url: string;
  }>(
    `SELECT metric, platform, subject, label, value::text AS value, unit,
            reference_period, to_char(event_date, 'YYYY-MM-DD') AS event_date,
            publisher, publication, method, evidence_grade,
            emotional_register, official_counterpart, statement, reading_url
     FROM read_models.social_reading_snapshot
     ORDER BY subject, platform, metric`,
  );

  return rows.map((row) => ({
    metric: row.metric,
    platform: row.platform,
    subject: row.subject,
    label: row.label,
    value: Number(row.value),
    unit: row.unit,
    referencePeriod: row.reference_period,
    eventDate: row.event_date,
    publisher: row.publisher,
    publication: row.publication,
    method: row.method,
    evidenceGrade: row.evidence_grade,
    emotionalRegister: row.emotional_register,
    officialCounterpart: row.official_counterpart,
    statement: row.statement,
    url: row.reading_url,
  }));
}

/**
 * The platform audiences, with the ceiling they have to be read against.
 *
 * `exceedsInternetUsers` is computed in the database rather than here, so a
 * platform added to the catalogue tomorrow inherits the check. It is the whole
 * reason this table is not a ranking: TikTok declares more reachable adults
 * than Bolivia has people online.
 */
export async function readSocialAudience(): Promise<SocialAudience[]> {
  const { rows } = await pool().query<{
    platform: string;
    metric: string;
    label: string;
    value: string;
    unit: string;
    internet_users: string | null;
    reach_exceeds_internet_users: boolean;
  }>(
    // The sort is qualified on purpose. `value` is also the name of the text
    // alias above, and an unqualified ORDER BY binds to the output column
    // first — which sorts the reaches as strings and puts 494.000 above
    // 3.950.000. Qualifying it makes the sort read the numeric column.
    `SELECT platform, metric, label, audience.value::text AS value, unit,
            internet_users::text AS internet_users, reach_exceeds_internet_users
     FROM read_models.social_platform_audience AS audience
     WHERE metric = 'AD_REACH'
     ORDER BY audience.value DESC`,
  );

  return rows.map((row) => ({
    platform: row.platform,
    metric: row.metric,
    label: row.label,
    value: Number(row.value),
    unit: row.unit,
    internetUsers: row.internet_users === null ? null : Number(row.internet_users),
    exceedsInternetUsers: row.reach_exceeds_internet_users,
  }));
}

export interface TradeCoverage {
  businessForm: string;
  marketRegime: string;
  readings: number;
  highGrade: number;
  lowGrade: number;
  compilers: number;
  territories: number;
  settlementsRead: number;
  latestPeriod: string | null;
  unread: boolean;
}

export interface ChannelMix {
  goodsClass: string;
  territory: string;
  referencePeriod: string;
  readings: number;
  formsRead: number;
  oneReadingPerForm: boolean;
  penetrationSum: number | null;
  channelsPerHousehold: number | null;
  informalPenetration: number | null;
  mixedPenetration: number | null;
  formalPenetration: number | null;
  informalShareOfVisits: number | null;
  forms: string[];
}

export interface TradeReading {
  metric: string;
  label: string;
  value: number;
  unit: string;
  referencePeriod: string;
  platform: string;
  businessForm: string;
  marketRegime: string;
  tradeSide: string;
  settlementMeans: string;
  goodsClass: string;
  measureKind: string;
  populationScope: string;
  territory: string;
  publisher: string;
  evidenceGrade: string;
  url: string;
}

export interface TradeGap {
  label: string;
  socialValue: number;
  referencePeriod: string;
  businessForm: string;
  territory: string;
  socialPublisher: string;
  evidenceGrade: string;
  indicatorCode: string;
  measuredValue: number | null;
  measuredPublisher: string | null;
  distancePoints: number | null;
}

/**
 * True when the database has no such relation yet.
 *
 * The trade models arrive with a migration, and this report is deployed from a
 * different repository than the one that migrates. Between the two deploys the
 * views do not exist, and a reader that threw would take the whole briefing
 * down — every tab, not only its own — because the page loads its sections in
 * one `Promise.all`. An absent model is reported as an empty section instead,
 * which is what it is.
 */
function isMissingRelation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === '42P01'
  );
}

/** What the register can and cannot say about each form of doing business. */
export async function readTradeCoverage(): Promise<TradeCoverage[]> {
  try {
    const { rows } = await pool().query<{
      business_form: string;
      market_regime: string;
      readings: string;
      high_grade: string;
      low_grade: string;
      compilers: string;
      territories: string;
      settlements_read: string;
      latest_period: string | null;
      unread: boolean;
    }>(
      `SELECT business_form, market_regime, readings::text, high_grade::text, low_grade::text,
              compilers::text, territories::text, settlements_read::text, latest_period, unread
       FROM read_models.informal_trade_coverage
       ORDER BY readings DESC, business_form`,
    );

    return rows.map((row) => ({
      businessForm: row.business_form,
      marketRegime: row.market_regime,
      readings: Number(row.readings),
      highGrade: Number(row.high_grade),
      lowGrade: Number(row.low_grade),
      compilers: Number(row.compilers),
      territories: Number(row.territories),
      settlementsRead: Number(row.settlements_read),
      latestPeriod: row.latest_period,
      unread: row.unread,
    }));
  } catch (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
}

/**
 * How many channels a household buys through, and how much of that is informal.
 *
 * The quotients arrive null whenever the group holds several readings of one
 * channel, because there is no mix to compute there. The panel keeps the row
 * with its counts rather than dropping it: a group that cannot be summed is
 * still a group somebody measured.
 */
export async function readChannelMix(): Promise<ChannelMix[]> {
  try {
    const { rows } = await pool().query<{
      goods_class: string;
      territory: string;
      reference_period: string;
      readings: string;
      forms_read: string;
      one_reading_per_form: boolean;
      penetration_sum: string | null;
      channels_per_household: string | null;
      informal_penetration: string | null;
      mixed_penetration: string | null;
      formal_penetration: string | null;
      informal_share_of_visits: string | null;
      forms: string[];
    }>(
      `SELECT goods_class, territory, reference_period, readings::text, forms_read::text,
              one_reading_per_form, penetration_sum::text, channels_per_household::text,
              informal_penetration::text, mixed_penetration::text, formal_penetration::text,
              informal_share_of_visits::text, forms
       FROM read_models.informal_trade_channel_mix
       ORDER BY reference_period DESC, goods_class, territory`,
    );

    return rows.map((row) => ({
      goodsClass: row.goods_class,
      territory: row.territory,
      referencePeriod: row.reference_period,
      readings: Number(row.readings),
      formsRead: Number(row.forms_read),
      oneReadingPerForm: row.one_reading_per_form,
      penetrationSum: row.penetration_sum === null ? null : Number(row.penetration_sum),
      channelsPerHousehold:
        row.channels_per_household === null ? null : Number(row.channels_per_household),
      informalPenetration:
        row.informal_penetration === null ? null : Number(row.informal_penetration),
      mixedPenetration: row.mixed_penetration === null ? null : Number(row.mixed_penetration),
      formalPenetration: row.formal_penetration === null ? null : Number(row.formal_penetration),
      informalShareOfVisits:
        row.informal_share_of_visits === null ? null : Number(row.informal_share_of_visits),
      forms: row.forms,
    }));
  } catch (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
}

/** Every commerce reading, filed by the way the trade is actually done. */
export async function readTradeReadings(): Promise<TradeReading[]> {
  try {
    const { rows } = await pool().query<{
      metric: string;
      label: string;
      value: string;
      unit: string;
      reference_period: string;
      platform: string;
      business_form: string;
      market_regime: string;
      trade_side: string;
      settlement_means: string;
      goods_class: string;
      measure_kind: string;
      population_scope: string;
      territory: string;
      publisher: string;
      evidence_grade: string;
      reading_url: string;
    }>(
      `SELECT metric, label, commerce.value::text AS value, unit, reference_period, platform,
              business_form, market_regime, trade_side, settlement_means, goods_class,
              measure_kind, population_scope, territory, publisher, evidence_grade, reading_url
       FROM read_models.social_commerce AS commerce
       WHERE status = 'PUBLISHED' AND NOT superseded
       ORDER BY business_form, reference_period DESC, label`,
    );

    return rows.map((row) => ({
      metric: row.metric,
      label: row.label,
      value: Number(row.value),
      unit: row.unit,
      referencePeriod: row.reference_period,
      platform: row.platform,
      businessForm: row.business_form,
      marketRegime: row.market_regime,
      tradeSide: row.trade_side,
      settlementMeans: row.settlement_means,
      goodsClass: row.goods_class,
      measureKind: row.measure_kind,
      populationScope: row.population_scope,
      territory: row.territory,
      publisher: row.publisher,
      evidenceGrade: row.evidence_grade,
      url: row.reading_url,
    }));
  } catch (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
}

/**
 * The distance between a social reading and the measured series for its year.
 *
 * Two measurements of one economy by different houses with different methods.
 * The distance is never an error term, and the panel that draws it says so.
 */
export async function readTradeGap(): Promise<TradeGap[]> {
  try {
    const { rows } = await pool().query<{
      label: string;
      social_value: string;
      reference_period: string;
      business_form: string;
      territory: string;
      social_publisher: string;
      evidence_grade: string;
      indicator_code: string;
      measured_value: string | null;
      measured_publisher: string | null;
      distance_points: string | null;
    }>(
      `SELECT label, social_value::text AS social_value, reference_period, business_form,
              territory, social_publisher, evidence_grade, indicator_code,
              round(measured_value, 2)::text AS measured_value, measured_publisher,
              distance_points::text
       FROM read_models.informal_trade_gap
       WHERE measured_value IS NOT NULL
       ORDER BY reference_period DESC, label`,
    );

    return rows.map((row) => ({
      label: row.label,
      socialValue: Number(row.social_value),
      referencePeriod: row.reference_period,
      businessForm: row.business_form,
      territory: row.territory,
      socialPublisher: row.social_publisher,
      evidenceGrade: row.evidence_grade,
      indicatorCode: row.indicator_code,
      measuredValue: row.measured_value === null ? null : Number(row.measured_value),
      measuredPublisher: row.measured_publisher,
      distancePoints: row.distance_points === null ? null : Number(row.distance_points),
    }));
  } catch (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
}

export interface TermMonth {
  term: string;
  label: string;
  family: string;
  month: string;
  mentions: number;
  outlets: number;
  alarma: number;
  deterioro: number;
  conflicto: number;
  incertidumbre: number;
  mejora: number;
  medida: number;
  neutro: number;
  adverseShare: number | null;
}

export interface TermTotal {
  term: string;
  label: string;
  family: string;
  mentions: number;
  months: number;
  outlets: number;
  firstMonth: string;
  lastMonth: string;
  peakMonth: string;
  peakMentions: number;
  adverseShare: number | null;
}

/**
 * Every watched subject, month by month, since the corpus begins.
 *
 * The whole series is read in one query rather than one per subject. Two
 * hundred subjects across eighty months is a few thousand rows — smaller than
 * one page of articles — and a reader who clicks between subjects expects the
 * next chart immediately, not a round trip. The panel slices what it needs.
 *
 * An absent model is reported as an empty section: the report is deployed from
 * a different repository than the one that migrates, and between the two
 * deploys this view does not exist. Throwing would take every tab down, because
 * the page loads its sections in one `Promise.all`.
 */
export async function readTermMonths(): Promise<TermMonth[]> {
  try {
    const { rows } = await pool().query<{
      term: string;
      label: string;
      family: string;
      month: string;
      mentions: string;
      outlets: string;
      alarma: string;
      deterioro: string;
      conflicto: string;
      incertidumbre: string;
      mejora: string;
      medida: string;
      neutro: string;
      adverse_share: string | null;
    }>(
      `SELECT term, label, family, month, mentions::text, outlets::text,
              alarma::text, deterioro::text, conflicto::text, incertidumbre::text,
              mejora::text, medida::text, neutro::text, adverse_share::text
       FROM read_models.press_term_month
       ORDER BY term, month`,
    );

    return rows.map((row) => ({
      term: row.term,
      label: row.label,
      family: row.family,
      month: row.month,
      mentions: Number(row.mentions),
      outlets: Number(row.outlets),
      alarma: Number(row.alarma),
      deterioro: Number(row.deterioro),
      conflicto: Number(row.conflicto),
      incertidumbre: Number(row.incertidumbre),
      mejora: Number(row.mejora),
      medida: Number(row.medida),
      neutro: Number(row.neutro),
      adverseShare: row.adverse_share === null ? null : Number(row.adverse_share),
    }));
  } catch (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
}

/**
 * The same subjects as one row each, with the month each one peaked in.
 *
 * Computed in the database rather than folded from the monthly rows in the
 * browser: the peak needs an ordering over every month of every subject, and
 * doing that client-side on each render is work the database already did once.
 */
export async function readTermTotals(): Promise<TermTotal[]> {
  try {
    const { rows } = await pool().query<{
      term: string;
      label: string;
      family: string;
      mentions: string;
      months: string;
      outlets: string;
      first_month: string;
      last_month: string;
      peak_month: string;
      peak_mentions: string;
      adverse_share: string | null;
    }>(
      `WITH ranked AS (
         SELECT term, month, mentions,
                row_number() OVER (PARTITION BY term ORDER BY mentions DESC, month DESC) AS place
         FROM read_models.press_term_month
       )
       SELECT month.term,
              max(month.label)                    AS label,
              max(month.family)                   AS family,
              sum(month.mentions)::text           AS mentions,
              count(*)::text                      AS months,
              max(month.outlets)::text            AS outlets,
              min(month.month)                    AS first_month,
              max(month.month)                    AS last_month,
              max(ranked.month) FILTER (WHERE ranked.place = 1)    AS peak_month,
              max(ranked.mentions) FILTER (WHERE ranked.place = 1)::text AS peak_mentions,
              round(
                100.0 * sum(month.alarma + month.deterioro + month.conflicto + month.incertidumbre)
                  / nullif(sum(month.mentions), 0), 1)::text       AS adverse_share
       FROM read_models.press_term_month AS month
       JOIN ranked ON ranked.term = month.term AND ranked.month = month.month
       GROUP BY month.term
       ORDER BY sum(month.mentions) DESC`,
    );

    return rows.map((row) => ({
      term: row.term,
      label: row.label,
      family: row.family,
      mentions: Number(row.mentions),
      months: Number(row.months),
      outlets: Number(row.outlets),
      firstMonth: row.first_month,
      lastMonth: row.last_month,
      peakMonth: row.peak_month,
      peakMentions: Number(row.peak_mentions),
      adverseShare: row.adverse_share === null ? null : Number(row.adverse_share),
    }));
  } catch (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
}

export interface PanelIndicator {
  code: string;
  name: string;
  observations: number;
  countries: number;
  boliviaYears: number;
  firstYear: number;
  lastYear: number;
}

export interface PanelPoint {
  country: string;
  year: number;
  value: number;
}

/**
 * The catalogue of indicators the panel holds, as the chooser needs it.
 *
 * Only the series that actually say something about Bolivia. The corpus carries
 * every country the World Bank publishes for, and an indicator with sixty years
 * of Peruvian data and none for Bolivia belongs in the corpus but not in a
 * chooser on a Bolivian observatory: it would be a row a reader opens once,
 * finds empty, and learns to distrust the list for.
 *
 * Read from the materialised catalogue rather than grouped on demand. Grouping
 * a million observations per page view is the failure the press models already
 * learned; the catalogue is fifteen hundred rows and is rebuilt by the load.
 */
export async function readPanelCatalogue(): Promise<PanelIndicator[]> {
  try {
    const { rows } = await pool().query<{
      indicator_code: string;
      indicator_name: string;
      observations: string;
      countries: string;
      bolivia_years: string;
      first_year: string;
      last_year: string;
    }>(
      `SELECT indicator_code, indicator_name, observations::text, countries::text,
              bolivia_years::text, first_year::text, last_year::text
       FROM read_models.world_panel_catalogue
       WHERE bolivia_years > 0
       ORDER BY bolivia_years DESC, indicator_name`,
    );

    return rows.map((row) => ({
      code: row.indicator_code,
      name: row.indicator_name,
      observations: Number(row.observations),
      countries: Number(row.countries),
      boliviaYears: Number(row.bolivia_years),
      firstYear: Number(row.first_year),
      lastYear: Number(row.last_year),
    }));
  } catch (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
}

/**
 * One indicator's whole history, for every country the panel holds it for.
 *
 * Fetched per indicator rather than shipped with the page: fifteen hundred
 * series at sixty years apiece is a million points, and a reader looks at one
 * of them at a time.
 */
export async function readPanelSeries(indicatorCode: string): Promise<PanelPoint[]> {
  try {
    const { rows } = await pool().query<{ country: string; period: string; value: string }>(
      `SELECT country, period::text, value::text
       FROM read_models.world_panel_reading
       WHERE indicator_code = $1 AND status = 'PUBLISHED' AND NOT superseded
       ORDER BY period, country`,
      [indicatorCode.slice(0, 60)],
    );

    return rows.map((row) => ({
      country: row.country,
      year: Number(row.period),
      value: Number(row.value),
    }));
  } catch (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
}

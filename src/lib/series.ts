import 'server-only';
import { pool } from './db';

/**
 * Reads the observatory's daily series and shapes them for reporting.
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
  readings: number;
  firstDay: string;
  lastDay: string;
}

/** Where each series comes from, so a reader can go and check it. */
export async function readSources(): Promise<SourceNote[]> {
  const { rows } = await pool().query<{
    publisher: string;
    source_url: string;
    indicator_code: string;
    readings: string;
    first_day: string;
    last_day: string;
  }>(
    `SELECT publisher, source_url, indicator_code,
            count(*)::text AS readings,
            min(event_date)::text AS first_day,
            max(event_date)::text AS last_day
     FROM read_models.economic_indicator_reading
     WHERE status = 'PUBLISHED' AND NOT superseded
     GROUP BY publisher, source_url, indicator_code
     ORDER BY indicator_code, publisher`,
  );

  return rows.map((row) => ({
    publisher: row.publisher,
    sourceUrl: row.source_url,
    indicator: row.indicator_code,
    readings: Number(row.readings),
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
    period: string;
    unit: string;
    value: string;
    previous_value: string | null;
    change_percent: string | null;
    publisher: string | null;
    source_url: string | null;
  }>(
    `SELECT indicator_code, indicator_name, period, unit,
            value::text AS value, previous_value::text AS previous_value,
            change_percent::text AS change_percent, publisher, source_url
     FROM read_models.macro_indicator_annual
     ORDER BY indicator_code, period`,
  );

  return rows.map((row) => ({
    indicatorCode: row.indicator_code,
    name: row.indicator_name,
    period: row.period,
    unit: row.unit,
    value: Number(row.value),
    previousValue: row.previous_value === null ? null : Number(row.previous_value),
    changePercent: row.change_percent === null ? null : Number(row.change_percent),
    publisher: row.publisher,
    sourceUrl: row.source_url,
  }));
}

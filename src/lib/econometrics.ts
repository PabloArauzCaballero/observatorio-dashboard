/**
 * The statistics an analyst would compute themselves before trusting a level.
 *
 * A price series answers what a dollar cost. These answer how violently it got
 * there, how fat the tail of that movement is, and whether the administered
 * rate moved with the market or against it — the questions that separate a
 * chart from an analysis.
 *
 * Everything here is a pure function over the observations the report already
 * shows, so a reader can reproduce any of it from the CSV the same page serves.
 */

export interface Observation {
  date: string;
  value: number;
  /** How the day was reduced to one number, which changes what volatility means. */
  aggregation: 'POINT_IN_TIME' | 'DAILY_AVERAGE';
}

export interface ReturnPoint {
  date: string;
  /** Continuously compounded return, in percent. */
  ret: number;
  aggregation: Observation['aggregation'];
}

/**
 * Continuously compounded returns.
 *
 * Log rather than simple returns because they add across time, which is what
 * makes a rolling standard deviation of them meaningful, and because a series
 * that has risen 20% in eight months is better described by a quantity whose
 * sum is the total move.
 */
export function logReturns(series: Observation[]): ReturnPoint[] {
  const out: ReturnPoint[] = [];
  for (let index = 1; index < series.length; index += 1) {
    const current = series[index];
    const previous = series[index - 1];
    if (!current || !previous || previous.value <= 0 || current.value <= 0) continue;
    out.push({
      date: current.date,
      ret: Math.log(current.value / previous.value) * 100,
      aggregation: current.aggregation,
    });
  }
  return out;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export interface RollingPoint {
  date: string;
  value: number;
}

/**
 * Realised volatility over a moving window, annualised.
 *
 * The series is observed every calendar day, weekends included, so the
 * annualisation factor is the square root of 365 rather than of a trading year.
 * Using 252 here would overstate volatility by about a fifth.
 */
export function rollingVolatility(returns: ReturnPoint[], window: number): RollingPoint[] {
  const out: RollingPoint[] = [];
  const factor = Math.sqrt(365);
  for (let index = window - 1; index < returns.length; index += 1) {
    const slice = returns.slice(index - window + 1, index + 1).map((point) => point.ret);
    const date = returns[index]?.date;
    if (!date) continue;
    out.push({ date, value: standardDeviation(slice) * factor });
  }
  return out;
}

/**
 * Pearson correlation between two return series over a moving window.
 *
 * Answers whether the administered rate was being moved with the market or
 * against it. A correlation near zero over a stretch where the market moved a
 * lot is the signature of a pegged rate.
 */
export function rollingCorrelation(
  left: ReturnPoint[],
  right: ReturnPoint[],
  window: number,
): RollingPoint[] {
  const rightByDate = new Map(right.map((point) => [point.date, point.ret]));
  const paired = left
    .filter((point) => rightByDate.has(point.date))
    .map((point) => ({ date: point.date, a: point.ret, b: rightByDate.get(point.date) ?? 0 }));

  const out: RollingPoint[] = [];
  for (let index = window - 1; index < paired.length; index += 1) {
    const slice = paired.slice(index - window + 1, index + 1);
    const a = slice.map((point) => point.a);
    const b = slice.map((point) => point.b);
    const meanA = mean(a);
    const meanB = mean(b);
    let covariance = 0;
    for (let k = 0; k < slice.length; k += 1) {
      covariance += ((a[k] ?? 0) - meanA) * ((b[k] ?? 0) - meanB);
    }
    const denominator = standardDeviation(a) * standardDeviation(b) * (slice.length - 1);
    const date = paired[index]?.date;
    if (!date || denominator === 0) continue;
    out.push({ date, value: covariance / denominator });
  }
  return out;
}

export interface DrawdownPoint {
  date: string;
  /** Distance below the running maximum, in percent and never positive. */
  value: number;
}

/**
 * Distance below the highest level reached so far.
 *
 * On an exchange rate this reads as how much of a depreciation has been given
 * back, and it makes the shape of a reversal visible in a way a level chart
 * does not: a line still near its peak and a line that has retraced a third of
 * it look alike until this is drawn.
 */
export function drawdown(series: Observation[]): DrawdownPoint[] {
  let peak = -Infinity;
  const out: DrawdownPoint[] = [];
  for (const point of series) {
    peak = Math.max(peak, point.value);
    if (peak <= 0) continue;
    out.push({ date: point.date, value: (point.value / peak - 1) * 100 });
  }
  return out;
}

export interface Bucket {
  /** Mid-point of the bucket, used as its label. */
  bin: string;
  count: number;
  /** True where the bucket sits below the 5th percentile of the sample. */
  tail: boolean;
}

/**
 * Distribution of returns.
 *
 * Drawn because the mean and the standard deviation of an exchange rate under
 * stress describe it badly: what matters is whether the tail is fat, and only
 * the shape shows that.
 */
export function histogram(returns: ReturnPoint[], bins = 31): Bucket[] {
  const values = returns.map((point) => point.ret).sort((a, b) => a - b);
  const min = values[0];
  const max = values.at(-1);
  if (min === undefined || max === undefined || min === max) return [];

  const cutoff = percentile(values, 0.05);
  const width = (max - min) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const value of values) {
    const index = Math.min(bins - 1, Math.floor((value - min) / width));
    counts[index] = (counts[index] ?? 0) + 1;
  }

  return counts.map((count, index) => {
    const centre = min + width * (index + 0.5);
    return {
      bin: centre.toFixed(2),
      count,
      tail: centre <= cutoff,
    };
  });
}

/** Linear-interpolated quantile of an already sorted sample. */
export function percentile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] ?? 0;
  const high = sorted[upper] ?? low;
  return low + (high - low) * (position - lower);
}

export interface Moments {
  observations: number;
  meanDaily: number;
  volatilityAnnual: number;
  skewness: number;
  excessKurtosis: number;
  /** Loss not exceeded on 95% of days, stated as a positive magnitude. */
  valueAtRisk95: number;
  worstDay: { date: string; ret: number } | null;
  bestDay: { date: string; ret: number } | null;
}

/**
 * The four moments plus the tail an analyst asks for first.
 *
 * Excess kurtosis is reported rather than raw kurtosis so that zero means
 * normal: a positive figure is the fat tail, and on an exchange rate under
 * pressure it is usually large.
 */
export function moments(returns: ReturnPoint[]): Moments {
  const values = returns.map((point) => point.ret);
  const observations = values.length;
  if (observations < 3) {
    return {
      observations,
      meanDaily: 0,
      volatilityAnnual: 0,
      skewness: 0,
      excessKurtosis: 0,
      valueAtRisk95: 0,
      worstDay: null,
      bestDay: null,
    };
  }

  const average = mean(values);
  const deviation = standardDeviation(values);
  const central = (power: number): number =>
    values.reduce((sum, value) => sum + ((value - average) / deviation) ** power, 0) / observations;

  const sorted = [...values].sort((a, b) => a - b);
  const worst = returns.reduce((low, point) => (point.ret < low.ret ? point : low), returns[0]!);
  const best = returns.reduce((high, point) => (point.ret > high.ret ? point : high), returns[0]!);

  return {
    observations,
    meanDaily: average,
    volatilityAnnual: deviation * Math.sqrt(365),
    skewness: central(3),
    excessKurtosis: central(4) - 3,
    valueAtRisk95: Math.abs(percentile(sorted, 0.05)),
    worstDay: { date: worst.date, ret: worst.ret },
    bestDay: { date: best.date, ret: best.ret },
  };
}

/**
 * The day the measurement method changes.
 *
 * Volatility computed on daily averages is lower than the same series measured
 * at a moment, because averaging smooths within the day. Marking the boundary
 * keeps a reader from reading that artefact as a calming market.
 */
export function aggregationBoundary(series: Observation[]): string | null {
  for (let index = 1; index < series.length; index += 1) {
    const current = series[index];
    const previous = series[index - 1];
    if (current && previous && current.aggregation !== previous.aggregation) return current.date;
  }
  return null;
}

/**
 * The formal tests behind the exchange-rate reading.
 *
 * The macro reading (`fx-macro.ts`) says what the level is, against which
 * base and under which regime. What it does not say is whether any of that
 * would survive a referee: whether the parallel rate is a random walk or
 * reverts, whether the gap closes on its own and how fast, whether the
 * administered rate now follows the market or leads it, where the series
 * actually breaks, whether the volatility a reader sees is clustered, and how
 * much of a depreciation ends up in prices. Those are the questions an
 * econometrician asks, and each has a named test with a critical value that
 * can be looked up.
 *
 * Everything here is a pure function over the daily points the report already
 * serves as CSV. Windows are explicit: nothing that crosses the regime change
 * is pooled unless the test is *about* the change. The results carry the
 * statistic, the sample size and the critical value or p-value, never only a
 * verdict, so a reader who disagrees with the significance level can re-read
 * them at their own.
 */

import type { GapReading, MacroPoint, RegimeSegment } from './fx-macro';
import {
  autocorrelationAt,
  chiSquareTail,
  fTail,
  mean,
  nelderMead,
  ols,
  tTwoSided,
  variance,
} from './stats-distributions';

export interface Span {
  from: string;
  to: string;
  n: number;
}

export interface CriticalValues {
  p1: number;
  p5: number;
  p10: number;
}

export type Significance = '1%' | '5%' | '10%' | null;

/* ------------------------------------------------------------- unit roots */

export interface AdfResult {
  statistic: number;
  lags: number;
  n: number;
  critical: CriticalValues;
  /** The tightest level at which a unit root is rejected. */
  rejects: Significance;
  deterministic: 'constant' | 'trend' | 'none';
}

type CriticalKind = 'constant' | 'trend' | 'none' | 'cointegration2';

/**
 * MacKinnon's response-surface critical values, at the sample size in hand.
 *
 * Tabulated asymptotic values overstate what a few hundred observations can
 * reject; the response surface gives the finite-sample value for the T used.
 * `cointegration2` is the residual-based test for two variables, whose
 * distribution is not the Dickey–Fuller one because the residual was fitted.
 */
function mackinnon(kind: CriticalKind, size: number): CriticalValues {
  const table: Record<CriticalKind, Record<keyof CriticalValues, [number, number, number]>> = {
    constant: {
      p1: [-3.4336, -5.999, -29.25],
      p5: [-2.8621, -2.738, -8.36],
      p10: [-2.5671, -1.438, -4.48],
    },
    trend: {
      p1: [-3.9638, -8.353, -47.44],
      p5: [-3.4126, -4.039, -17.83],
      p10: [-3.1279, -2.418, -7.58],
    },
    none: {
      p1: [-2.5658, -1.96, -10.04],
      p5: [-1.9393, -0.398, 0],
      p10: [-1.6156, -0.181, 0],
    },
    cointegration2: {
      p1: [-3.9001, -10.534, -30.03],
      p5: [-3.3377, -5.967, -8.98],
      p10: [-3.0462, -4.069, -5.73],
    },
  };
  const at = (row: [number, number, number]): number =>
    row[0] + row[1] / size + row[2] / (size * size);
  const rows = table[kind];
  return { p1: at(rows.p1), p5: at(rows.p5), p10: at(rows.p10) };
}

const significance = (statistic: number, critical: CriticalValues): Significance =>
  statistic < critical.p1
    ? '1%'
    : statistic < critical.p5
      ? '5%'
      : statistic < critical.p10
        ? '10%'
        : null;

/**
 * Augmented Dickey–Fuller test on a series.
 *
 * Lag length chosen by the Schwarz criterion over a common sample, then the
 * chosen model is re-estimated on the longest sample that lag allows. The
 * ceiling on lags is Schwert's rule, so a long daily series is not asked to
 * carry forty lags nobody looks at.
 */
export function adf(
  series: readonly number[],
  deterministic: AdfResult['deterministic'] = 'constant',
  criticalKind: CriticalKind = deterministic,
): AdfResult | null {
  const size = series.length;
  if (size < 20) return null;
  const dy = series.slice(1).map((value, i) => value - (series[i] ?? 0));
  const maxLags = Math.max(
    0,
    Math.min(Math.floor(12 * (size / 100) ** 0.25), Math.floor((size - 1) / 4)),
  );

  const design = (lags: number, start: number) => {
    const y: number[] = [];
    const X: number[][] = [];
    for (let t = start; t < size; t += 1) {
      const row: number[] = [];
      if (deterministic !== 'none') row.push(1);
      row.push(series[t - 1] ?? 0);
      for (let i = 1; i <= lags; i += 1) row.push(dy[t - 1 - i] ?? 0);
      if (deterministic === 'trend') row.push(t);
      X.push(row);
      y.push(dy[t - 1] ?? 0);
    }
    return { y, X };
  };

  let chosen = 0;
  let bestBic = Infinity;
  for (let lags = 0; lags <= maxLags; lags += 1) {
    const { y, X } = design(lags, maxLags + 1);
    const fit = ols(y, X);
    if (!fit) continue;
    const bic = fit.n * Math.log(fit.rss / fit.n) + fit.k * Math.log(fit.n);
    if (bic < bestBic) {
      bestBic = bic;
      chosen = lags;
    }
  }
  const { y, X } = design(chosen, chosen + 1);
  const fit = ols(y, X);
  if (!fit) return null;
  const position = deterministic === 'none' ? 0 : 1;
  const statistic = fit.tStats[position] ?? 0;
  const critical = mackinnon(criticalKind, fit.n);
  return {
    statistic,
    lags: chosen,
    n: fit.n,
    critical,
    rejects: significance(statistic, critical),
    deterministic,
  };
}

/* ---------------------------------------------------------- persistence */

export interface Persistence {
  rho: number;
  standardError: number;
  /** Days for a disturbance to lose half its size; null when it does not decay. */
  halfLifeDays: number | null;
  n: number;
}

/** First-order autoregression: how much of yesterday survives into today. */
export function persistence(series: readonly number[]): Persistence | null {
  if (series.length < 20) return null;
  const y = series.slice(1);
  const X = series.slice(0, -1).map((lagged) => [1, lagged]);
  const fit = ols(y, X);
  if (!fit) return null;
  const rho = fit.beta[1] ?? 0;
  return {
    rho,
    standardError: fit.standardErrors[1] ?? 0,
    halfLifeDays: rho > 0 && rho < 1 ? Math.log(0.5) / Math.log(rho) : null,
    n: fit.n,
  };
}

/* -------------------------------------------------------- cointegration */

export interface Adjustment {
  /** Fraction of yesterday's deviation corrected today; negative means it corrects. */
  lambda: number;
  tStat: number;
  pValue: number;
  halfLifeDays: number | null;
}

export interface Cointegration {
  /** Long-run elasticity of the official rate to the parallel one. */
  beta: number;
  betaStandardError: number;
  residualTest: AdfResult;
  cointegrated: Significance;
  official: Adjustment;
  parallel: Adjustment;
  /** The deviation from the long-run relation, in percent of the official rate. */
  deviation: MacroPoint[];
  n: number;
}

function adjustment(fit: { beta: number[]; tStats: number[]; n: number; k: number }): Adjustment {
  const lambda = fit.beta[1] ?? 0;
  const tStat = fit.tStats[1] ?? 0;
  return {
    lambda,
    tStat,
    pValue: tTwoSided(tStat, fit.n - fit.k),
    halfLifeDays: lambda < 0 && lambda > -1 ? Math.log(0.5) / Math.log(1 + lambda) : null,
  };
}

/**
 * Engle–Granger two-step, official on parallel, both in logs.
 *
 * Step one asks whether the two rates share a long-run relation at all; step
 * two asks which of them does the adjusting when they drift apart. A rate that
 * is being managed towards the market shows a negative, significant loading
 * on the deviation in *its own* equation and none in the market's.
 */
export function cointegration(
  official: readonly MacroPoint[],
  parallel: readonly MacroPoint[],
): Cointegration | null {
  const parallelByDate = new Map(parallel.map((point) => [point.date, point.value]));
  const paired = official
    .filter((point) => parallelByDate.has(point.date) && point.value > 0)
    .map((point) => ({
      date: point.date,
      official: Math.log(point.value),
      parallel: Math.log(parallelByDate.get(point.date) ?? 1),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (paired.length < 40) return null;

  const levels = ols(
    paired.map((row) => row.official),
    paired.map((row) => [1, row.parallel]),
  );
  if (!levels) return null;
  const residualTest = adf(levels.residuals, 'none', 'cointegration2');
  if (!residualTest) return null;

  const dOfficial = paired.slice(1).map((row, i) => row.official - (paired[i]?.official ?? 0));
  const dParallel = paired.slice(1).map((row, i) => row.parallel - (paired[i]?.parallel ?? 0));
  const errorRows = (target: readonly number[]) => {
    const y: number[] = [];
    const X: number[][] = [];
    for (let t = 1; t < target.length; t += 1) {
      y.push(target[t] ?? 0);
      X.push([1, levels.residuals[t] ?? 0, dOfficial[t - 1] ?? 0, dParallel[t - 1] ?? 0]);
    }
    return ols(y, X);
  };
  const officialFit = errorRows(dOfficial);
  const parallelFit = errorRows(dParallel);
  if (!officialFit || !parallelFit) return null;

  return {
    beta: levels.beta[1] ?? 0,
    betaStandardError: levels.standardErrors[1] ?? 0,
    residualTest,
    cointegrated: residualTest.rejects,
    official: adjustment(officialFit),
    parallel: adjustment(parallelFit),
    deviation: paired.map((row, i) => ({
      date: row.date,
      value: (levels.residuals[i] ?? 0) * 100,
    })),
    n: paired.length,
  };
}

/* ------------------------------------------------------------- causality */

export interface GrangerResult {
  fStat: number;
  pValue: number;
  lags: number;
  n: number;
}

/**
 * Whether the past of `cause` helps predict `effect` beyond its own past.
 *
 * The lag length is chosen by the Schwarz criterion on the unrestricted
 * equation, and the same lag is used for both directions so the two answers
 * are read on equal terms.
 */
export function granger(
  cause: readonly number[],
  effect: readonly number[],
  maxLags = 5,
): GrangerResult | null {
  const n = Math.min(cause.length, effect.length);
  if (n < 30) return null;
  const build = (lags: number, restricted: boolean) => {
    const y: number[] = [];
    const X: number[][] = [];
    for (let t = maxLags; t < n; t += 1) {
      const row = [1];
      for (let i = 1; i <= lags; i += 1) row.push(effect[t - i] ?? 0);
      if (!restricted) for (let i = 1; i <= lags; i += 1) row.push(cause[t - i] ?? 0);
      X.push(row);
      y.push(effect[t] ?? 0);
    }
    return ols(y, X);
  };
  let lags = 1;
  let bestBic = Infinity;
  for (let candidate = 1; candidate <= maxLags; candidate += 1) {
    const fit = build(candidate, false);
    if (!fit) continue;
    const bic = fit.n * Math.log(fit.rss / fit.n) + fit.k * Math.log(fit.n);
    if (bic < bestBic) {
      bestBic = bic;
      lags = candidate;
    }
  }
  const unrestricted = build(lags, false);
  const restricted = build(lags, true);
  if (!unrestricted || !restricted || unrestricted.rss <= 0) return null;
  const df2 = unrestricted.n - unrestricted.k;
  const fStat = (restricted.rss - unrestricted.rss) / lags / (unrestricted.rss / df2);
  return { fStat, pValue: fTail(fStat, lags, df2), lags, n: unrestricted.n };
}

/* ---------------------------------------------------------------- breaks */

export interface BreakSearch {
  /** The largest F over the candidate dates, and where it falls. */
  supF: number;
  date: string | null;
  /** Andrews (2003) asymptotic values for one restriction and 15 % trimming. */
  critical: CriticalValues;
  rejects: Significance;
  /** The F statistic at every candidate date, for the chart. */
  path: MacroPoint[];
  n: number;
}

/** F for a shift in the mean of `values` at position `at`. */
function meanShiftF(values: readonly number[], at: number): number {
  const n = values.length;
  const before = values.slice(0, at);
  const after = values.slice(at);
  const total = mean(values);
  const rss0 = values.reduce((sum, value) => sum + (value - total) ** 2, 0);
  const meanBefore = mean(before);
  const meanAfter = mean(after);
  const rss1 =
    before.reduce((sum, value) => sum + (value - meanBefore) ** 2, 0) +
    after.reduce((sum, value) => sum + (value - meanAfter) ** 2, 0);
  return rss1 > 0 ? (rss0 - rss1) / (rss1 / (n - 2)) : 0;
}

/**
 * Quandt–Andrews search for an unknown break in the mean of a series.
 *
 * Run on daily returns rather than on the level, because a level that trends
 * "breaks" everywhere. The trimming keeps the search away from the ends, where
 * a handful of days can produce any statistic.
 */
export function breakSearch(points: readonly MacroPoint[], trim = 0.15): BreakSearch | null {
  const n = points.length;
  if (n < 40) return null;
  const values = points.map((point) => point.value);
  const first = Math.max(2, Math.floor(n * trim));
  const last = Math.min(n - 2, Math.ceil(n * (1 - trim)));
  const path: MacroPoint[] = [];
  let supF = -Infinity;
  let date: string | null = null;
  for (let at = first; at <= last; at += 1) {
    const f = meanShiftF(values, at);
    path.push({ date: points[at]?.date ?? '', value: f });
    if (f > supF) {
      supF = f;
      date = points[at]?.date ?? null;
    }
  }
  const critical = { p1: 12.16, p5: 8.85, p10: 7.17 };
  const rejects: Significance =
    supF > critical.p1 ? '1%' : supF > critical.p5 ? '5%' : supF > critical.p10 ? '10%' : null;
  return { supF, date, critical, rejects, path, n };
}

export interface KnownBreak {
  date: string;
  /** Chow F for a shift in mean at the date. */
  fStat: number;
  pValue: number;
  /** Ratio of the variance after to the variance before, and its F test. */
  varianceRatio: number;
  varianceP: number;
  volBeforeAnnual: number;
  volAfterAnnual: number;
  nBefore: number;
  nAfter: number;
}

/** Chow test and variance-ratio test at a date the reader already knows. */
export function knownBreak(points: readonly MacroPoint[], date: string): KnownBreak | null {
  const at = points.findIndex((point) => point.date >= date);
  if (at < 10 || points.length - at < 10) return null;
  const values = points.map((point) => point.value);
  const before = values.slice(0, at);
  const after = values.slice(at);
  const fStat = meanShiftF(values, at);
  const varBefore = variance(before);
  const varAfter = variance(after);
  const ratio = varBefore > 0 ? varAfter / varBefore : 0;
  const tail = fTail(ratio, after.length - 1, before.length - 1);
  return {
    date,
    fStat,
    pValue: fTail(fStat, 1, values.length - 2),
    varianceRatio: ratio,
    varianceP: Math.min(1, 2 * Math.min(tail, 1 - tail)),
    volBeforeAnnual: Math.sqrt(varBefore * 365),
    volAfterAnnual: Math.sqrt(varAfter * 365),
    nBefore: before.length,
    nAfter: after.length,
  };
}

/* ------------------------------------------------------------ volatility */

export interface PortmanteauTest {
  statistic: number;
  lags: number;
  pValue: number;
}

/** Ljung–Box Q: is there autocorrelation anywhere in the first `lags` lags. */
export function ljungBox(values: readonly number[], lags = 10): PortmanteauTest {
  const n = values.length;
  let q = 0;
  for (let k = 1; k <= lags; k += 1) {
    const rho = autocorrelationAt(values, k);
    q += (rho * rho) / (n - k);
  }
  const statistic = n * (n + 2) * q;
  return { statistic, lags, pValue: chiSquareTail(statistic, lags) };
}

/** Engle's ARCH-LM: do squared shocks predict squared shocks. */
export function archLm(residuals: readonly number[], lags = 5): PortmanteauTest | null {
  const squared = residuals.map((value) => value * value);
  const y: number[] = [];
  const X: number[][] = [];
  for (let t = lags; t < squared.length; t += 1) {
    const row = [1];
    for (let i = 1; i <= lags; i += 1) row.push(squared[t - i] ?? 0);
    X.push(row);
    y.push(squared[t] ?? 0);
  }
  const fit = ols(y, X);
  if (!fit) return null;
  const statistic = fit.n * fit.r2;
  return { statistic, lags, pValue: chiSquareTail(statistic, lags) };
}

export interface Garch {
  omega: number;
  alpha: number;
  beta: number;
  persistence: number;
  /** Long-run volatility the model settles to, annualised, in percent. */
  unconditionalVolAnnual: number | null;
  /** Volatility the model assigns to the latest day, annualised, in percent. */
  currentVolAnnual: number;
  /** Days for a volatility shock to halve. */
  volHalfLifeDays: number | null;
  /**
   * Whether α + β sits at the boundary, where the model has no long-run level.
   *
   * A sample that pools a fixed and a moving regime often lands here: the
   * likelihood prefers to remember every shock forever. The conditional path
   * is still informative; the unconditional level is not, and is withheld.
   */
  integrated: boolean;
  /** RiskMetrics exponentially weighted volatility (λ = 0,94), annualised: the model-free reading. */
  ewmaVolAnnual: number;
  /** Conditional volatility on every day, annualised, for the chart. */
  series: MacroPoint[];
  logLikelihood: number;
  converged: boolean;
  n: number;
}

/** The sample is too close to the unit circle to name a long-run level. */
const INTEGRATED_ABOVE = 0.995;

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/**
 * GARCH(1,1) by maximum likelihood.
 *
 * Parametrised on persistence and its split rather than on α and β directly,
 * so the constraint α + β < 1 is built into the search instead of enforced by
 * a penalty. The simplex then walks a smooth surface. Returns are in percent
 * and observed every calendar day, so the annualisation is √365.
 */
export function garch11(returns: readonly MacroPoint[]): Garch | null {
  const n = returns.length;
  if (n < 60) return null;
  const values = returns.map((point) => point.value);
  const centre = mean(values);
  const shocks = values.map((value) => value - centre);
  const sample = variance(shocks);
  if (!(sample > 0)) return null;

  const unpack = (point: readonly number[]) => {
    const persist = 0.9999 * sigmoid(point[1] ?? 0);
    const share = sigmoid(point[2] ?? 0);
    return { omega: Math.exp(point[0] ?? 0), alpha: persist * share, beta: persist * (1 - share) };
  };
  const negativeLogLikelihood = (point: readonly number[]): number => {
    const { omega, alpha, beta } = unpack(point);
    let sigma2 = sample;
    let total = 0;
    for (let t = 0; t < n; t += 1) {
      if (t > 0) sigma2 = omega + alpha * (shocks[t - 1] ?? 0) ** 2 + beta * sigma2;
      if (!(sigma2 > 0)) return 1e12;
      total += Math.log(sigma2) + (shocks[t] ?? 0) ** 2 / sigma2;
    }
    return 0.5 * total;
  };
  const start = [Math.log(sample * 0.1), Math.log(0.9 / 0.1), Math.log(0.1 / 0.9)];
  const best = nelderMead(negativeLogLikelihood, start, { iterations: 900 });
  const { omega, alpha, beta } = unpack(best.point);
  const persist = alpha + beta;

  const series: MacroPoint[] = [];
  let sigma2 = sample;
  let ewma = sample;
  for (let t = 0; t < n; t += 1) {
    if (t > 0) {
      sigma2 = omega + alpha * (shocks[t - 1] ?? 0) ** 2 + beta * sigma2;
      ewma = 0.94 * ewma + 0.06 * (shocks[t - 1] ?? 0) ** 2;
    }
    series.push({ date: returns[t]?.date ?? '', value: Math.sqrt(sigma2 * 365) });
  }
  const integrated = persist >= INTEGRATED_ABOVE;
  return {
    omega,
    alpha,
    beta,
    persistence: persist,
    unconditionalVolAnnual: integrated ? null : Math.sqrt((omega / (1 - persist)) * 365),
    currentVolAnnual: series.at(-1)?.value ?? 0,
    volHalfLifeDays: integrated || persist <= 0 ? null : Math.log(0.5) / Math.log(persist),
    integrated,
    ewmaVolAnnual: Math.sqrt(ewma * 365),
    series,
    logLikelihood: -best.value,
    converged: best.converged,
    n,
  };
}

/* ---------------------------------------------------------- pass-through */

export interface PassThrough {
  /** Coefficient on the depreciation of the same month and each lag. */
  coefficients: number[];
  standardErrors: number[];
  /** Cumulative pass-through after 0, 1, 2, 3 months, with its standard error. */
  cumulative: Array<{ months: number; value: number; standardError: number }>;
  r2: number;
  n: number;
  from: string;
  to: string;
}

/** The last reading of every calendar month, keyed by `YYYY-MM`. */
function monthEnds(points: readonly MacroPoint[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const point of [...points].sort((left, right) => left.date.localeCompare(right.date))) {
    out.set(point.date.slice(0, 7), point.value);
  }
  return out;
}

/**
 * How much of a month's depreciation reaches prices, and how soon.
 *
 * Monthly inflation read off the UFV regressed on the same month's
 * depreciation of the parallel rate and three lags of it. The sum of the
 * coefficients is the pass-through after that many months. The sample is as
 * long as the parallel series and no longer, which is short; the standard
 * errors say how short.
 */
export function passThrough(
  parallel: readonly MacroPoint[],
  priceIndex: readonly MacroPoint[],
  lags = 3,
): PassThrough | null {
  const rates = monthEnds(parallel);
  const prices = monthEnds(priceIndex);
  const months = [...rates.keys()].filter((month) => prices.has(month)).sort();
  if (months.length < lags + 10) return null;
  const depreciation = months.slice(1).map((month, i) => {
    const now = rates.get(month) ?? 0;
    const before = rates.get(months[i] ?? '') ?? 0;
    return now > 0 && before > 0 ? Math.log(now / before) * 100 : 0;
  });
  const inflation = months.slice(1).map((month, i) => {
    const now = prices.get(month) ?? 0;
    const before = prices.get(months[i] ?? '') ?? 0;
    return now > 0 && before > 0 ? Math.log(now / before) * 100 : 0;
  });
  const y: number[] = [];
  const X: number[][] = [];
  for (let t = lags; t < inflation.length; t += 1) {
    const row = [1];
    for (let i = 0; i <= lags; i += 1) row.push(depreciation[t - i] ?? 0);
    X.push(row);
    y.push(inflation[t] ?? 0);
  }
  const fit = ols(y, X);
  if (!fit) return null;
  const coefficients = fit.beta.slice(1);
  const cumulative = coefficients.map((_, horizon) => {
    let value = 0;
    let varianceSum = 0;
    for (let a = 0; a <= horizon; a += 1) {
      value += coefficients[a] ?? 0;
      for (let b = 0; b <= horizon; b += 1) varianceSum += fit.covariance[a + 1]?.[b + 1] ?? 0;
    }
    return { months: horizon, value, standardError: Math.sqrt(Math.max(varianceSum, 0)) };
  });
  return {
    coefficients,
    standardErrors: fit.standardErrors.slice(1),
    cumulative,
    r2: fit.r2,
    n: fit.n,
    from: months[lags + 1] ?? '',
    to: months.at(-1) ?? '',
  };
}

/* ------------------------------------------------------- regime moments */

export interface RegimeMoments {
  regime: RegimeSegment['regime'];
  from: string;
  to: string;
  n: number;
  meanDaily: number;
  volAnnual: number;
  /** Loss not exceeded on 95 % of days, as a positive magnitude. */
  valueAtRisk95: number;
  worstDay: MacroPoint | null;
}

/** Log returns in percent, dated on the later day. */
export function logReturnsOf(points: readonly MacroPoint[]): MacroPoint[] {
  const ordered = [...points].sort((left, right) => left.date.localeCompare(right.date));
  const out: MacroPoint[] = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const now = ordered[i];
    const before = ordered[i - 1];
    if (!now || !before || now.value <= 0 || before.value <= 0) continue;
    out.push({ date: now.date, value: Math.log(now.value / before.value) * 100 });
  }
  return out;
}

/** The moments of a return series inside each regime, never across one. */
export function regimeMoments(
  returns: readonly MacroPoint[],
  regimes: readonly RegimeSegment[],
): RegimeMoments[] {
  return regimes.flatMap((segment) => {
    const inside = returns.filter(
      (point) => point.date >= segment.from && point.date <= segment.to,
    );
    if (inside.length < 10) return [];
    const values = inside.map((point) => point.value);
    const sorted = [...values].sort((left, right) => left - right);
    const position = (sorted.length - 1) * 0.05;
    const low = sorted[Math.floor(position)] ?? 0;
    const high = sorted[Math.ceil(position)] ?? low;
    const var95 = Math.abs(low + (high - low) * (position - Math.floor(position)));
    return [
      {
        regime: segment.regime,
        from: segment.from,
        to: segment.to,
        n: inside.length,
        meanDaily: mean(values),
        volAnnual: Math.sqrt(variance(values) * 365),
        valueAtRisk95: var95,
        worstDay: inside.reduce((worst, point) => (point.value < worst.value ? point : worst)),
      },
    ];
  });
}

/* ---------------------------------------------------------------- input */

export interface FxEconometricsInput {
  official: readonly MacroPoint[];
  parallelMid: readonly MacroPoint[];
  ufv: readonly MacroPoint[];
  gap: readonly GapReading[];
  regimes: readonly RegimeSegment[];
  /** The parallel in real terms, base 100, already deflated by the UFV. */
  realParallel: readonly MacroPoint[];
}

export interface FxEconometrics {
  asOf: string | null;
  full: Span | null;
  /** The stretch since the official rate started moving, when long enough to test. */
  moving: Span | null;
  unitRoot: {
    parallelLevel: AdfResult | null;
    parallelReturns: AdfResult | null;
    realParallel: AdfResult | null;
    gap: AdfResult | null;
    gapMoving: AdfResult | null;
  };
  gapPersistence: { full: Persistence | null; moving: Persistence | null };
  cointegration: Cointegration | null;
  granger: { parallelToOfficial: GrangerResult | null; officialToParallel: GrangerResult | null };
  breaks: {
    search: BreakSearch | null;
    atRegimeChange: KnownBreak | null;
    /** The day the gap peaked, which is where a break in the market's mean would be expected. */
    gapPeak: GapReading | null;
  };
  volatility: {
    garch: Garch | null;
    ljungBoxReturns: PortmanteauTest | null;
    ljungBoxSquares: PortmanteauTest | null;
    archLm: PortmanteauTest | null;
  };
  passThrough: PassThrough | null;
  regimeMoments: { parallel: RegimeMoments[]; official: RegimeMoments[] };
}

const span = (points: readonly MacroPoint[]): Span | null =>
  points.length
    ? { from: points[0]?.date ?? '', to: points.at(-1)?.date ?? '', n: points.length }
    : null;

const sorted = (points: readonly MacroPoint[]): MacroPoint[] =>
  [...points].sort((left, right) => left.date.localeCompare(right.date));

/** The whole battery, computed once from the series the chapter already holds. */
export function fxEconometrics(input: FxEconometricsInput): FxEconometrics {
  const parallel = sorted(input.parallelMid);
  const official = sorted(input.official);
  const gap = [...input.gap].sort((left, right) => left.date.localeCompare(right.date));
  const parallelReturns = logReturnsOf(parallel);
  const officialReturns = logReturnsOf(official);

  const movingFrom = input.regimes.find((segment) => segment.regime === 'EN_MOVIMIENTO')?.from;
  const movingParallel = movingFrom ? parallel.filter((point) => point.date >= movingFrom) : [];
  const movingOfficial = movingFrom ? official.filter((point) => point.date >= movingFrom) : [];
  const movingGap = movingFrom ? gap.filter((point) => point.date >= movingFrom) : [];
  const longEnough = movingParallel.length >= 40;

  const officialByDate = new Map(officialReturns.map((point) => [point.date, point.value]));
  const pairedReturns = parallelReturns
    .filter((point) => officialByDate.has(point.date) && (!movingFrom || point.date >= movingFrom))
    .map((point) => ({ parallel: point.value, official: officialByDate.get(point.date) ?? 0 }));

  const garch = garch11(parallelReturns);
  const returnValues = parallelReturns.map((point) => point.value);
  const centred = returnValues.map((value) => value - mean(returnValues));

  return {
    asOf: parallel.at(-1)?.date ?? null,
    full: span(parallel),
    moving: longEnough ? span(movingParallel) : null,
    unitRoot: {
      parallelLevel: adf(
        parallel.map((point) => Math.log(point.value)),
        'constant',
      ),
      parallelReturns: adf(returnValues, 'constant'),
      realParallel: adf(
        input.realParallel.filter((point) => point.value > 0).map((point) => Math.log(point.value)),
        'constant',
      ),
      gap: adf(
        gap.map((point) => point.gapPercent),
        'constant',
      ),
      gapMoving: longEnough
        ? adf(
            movingGap.map((point) => point.gapPercent),
            'constant',
          )
        : null,
    },
    gapPersistence: {
      full: persistence(gap.map((point) => point.gapPercent)),
      moving: longEnough ? persistence(movingGap.map((point) => point.gapPercent)) : null,
    },
    cointegration: longEnough ? cointegration(movingOfficial, movingParallel) : null,
    granger: {
      parallelToOfficial: longEnough
        ? granger(
            pairedReturns.map((row) => row.parallel),
            pairedReturns.map((row) => row.official),
          )
        : null,
      officialToParallel: longEnough
        ? granger(
            pairedReturns.map((row) => row.official),
            pairedReturns.map((row) => row.parallel),
          )
        : null,
    },
    breaks: {
      search: breakSearch(parallelReturns),
      atRegimeChange: movingFrom ? knownBreak(parallelReturns, movingFrom) : null,
      gapPeak: gap.length
        ? gap.reduce((best, point) => (point.gapPercent > best.gapPercent ? point : best))
        : null,
    },
    volatility: {
      garch,
      ljungBoxReturns: returnValues.length >= 30 ? ljungBox(centred) : null,
      ljungBoxSquares:
        returnValues.length >= 30 ? ljungBox(centred.map((value) => value * value)) : null,
      archLm: returnValues.length >= 30 ? archLm(centred) : null,
    },
    passThrough: passThrough(parallel, input.ufv),
    regimeMoments: {
      parallel: regimeMoments(parallelReturns, input.regimes),
      official: regimeMoments(officialReturns, input.regimes),
    },
  };
}

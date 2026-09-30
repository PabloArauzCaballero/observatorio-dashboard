/**
 * The numerical floor the econometric tests stand on.
 *
 * Least squares, the three distributions a test statistic is read against
 * and a derivative-free minimiser. Written here rather than imported because
 * the report ships no numerical library and every figure it publishes has to
 * be reproducible from the CSV the same page serves: a reader with a
 * spreadsheet can check any of these by hand, and none of them hides a
 * choice a reader would want to see.
 *
 * Nothing in this file knows what an exchange rate is.
 */

export interface Ols {
  beta: number[];
  standardErrors: number[];
  tStats: number[];
  residuals: number[];
  fitted: number[];
  rss: number;
  r2: number;
  n: number;
  k: number;
  /** Residual variance, RSS divided by the degrees of freedom. */
  sigma2: number;
  /** (X'X)⁻¹ scaled by the residual variance: the covariance of the estimates. */
  covariance: number[][];
}

/** Solves a symmetric positive system by Gaussian elimination with pivoting. */
function solve(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i] ?? 0]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row]?.[col] ?? 0) > Math.abs(a[pivot]?.[col] ?? 0)) pivot = row;
    }
    const pivotRow = a[pivot];
    const colRow = a[col];
    if (!pivotRow || !colRow || Math.abs(pivotRow[col] ?? 0) < 1e-12) return null;
    a[pivot] = colRow;
    a[col] = pivotRow;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const target = a[row];
      if (!target) continue;
      const factor = (target[col] ?? 0) / (pivotRow[col] ?? 1);
      for (let k = col; k <= n; k += 1) target[k] = (target[k] ?? 0) - factor * (pivotRow[k] ?? 0);
    }
  }
  return a.map((row, i) => (row[n] ?? 0) / (row[i] ?? 1));
}

/** Inverse of a small symmetric matrix, column by column through `solve`. */
function invert(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const columns: number[][] = [];
  for (let j = 0; j < n; j += 1) {
    const unit = new Array<number>(n).fill(0);
    unit[j] = 1;
    const column = solve(matrix, unit);
    if (!column) return null;
    columns.push(column);
  }
  return columns[0]!.map((_, i) => columns.map((column) => column[i] ?? 0));
}

/**
 * Ordinary least squares of `y` on the rows of `X`.
 *
 * The caller adds the constant column when it wants one; a regression through
 * the origin is a real choice (the residual test of a cointegrating regression
 * demands it) and a helper that always intercepts would silently forbid it.
 */
export function ols(y: readonly number[], X: readonly (readonly number[])[]): Ols | null {
  const n = y.length;
  const k = X[0]?.length ?? 0;
  if (n === 0 || k === 0 || n <= k) return null;
  const xtx: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const xty = new Array<number>(k).fill(0);
  for (let i = 0; i < n; i += 1) {
    const row = X[i];
    if (!row) return null;
    for (let a = 0; a < k; a += 1) {
      xty[a] = (xty[a] ?? 0) + (row[a] ?? 0) * (y[i] ?? 0);
      const line = xtx[a];
      if (!line) continue;
      for (let b = 0; b < k; b += 1) line[b] = (line[b] ?? 0) + (row[a] ?? 0) * (row[b] ?? 0);
    }
  }
  const beta = solve(xtx, xty);
  const inverse = invert(xtx);
  if (!beta || !inverse) return null;
  const fitted = X.map((row) => row.reduce((sum, value, j) => sum + value * (beta[j] ?? 0), 0));
  const residuals = y.map((value, i) => value - (fitted[i] ?? 0));
  const rss = residuals.reduce((sum, e) => sum + e * e, 0);
  const mean = y.reduce((sum, value) => sum + value, 0) / n;
  const tss = y.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const sigma2 = rss / (n - k);
  const covariance = inverse.map((row) => row.map((value) => value * sigma2));
  const standardErrors = covariance.map((row, i) => Math.sqrt(Math.max(row[i] ?? 0, 0)));
  return {
    beta,
    standardErrors,
    tStats: beta.map((b, i) => ((standardErrors[i] ?? 0) > 0 ? b / (standardErrors[i] ?? 1) : 0)),
    residuals,
    fitted,
    rss,
    r2: tss > 0 ? 1 - rss / tss : 0,
    n,
    k,
    sigma2,
    covariance,
  };
}

/* ------------------------------------------------------------ distributions */

function logGamma(x: number): number {
  // Lanczos approximation, good to about 1e-15 for x > 0.
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const shifted = x - 1;
  let sum = 0.99999999999980993;
  for (let i = 0; i < coefficients.length; i += 1) {
    sum += (coefficients[i] ?? 0) / (shifted + i + 1);
  }
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(sum);
}

/** Regularised lower incomplete gamma P(a, x). */
function regularisedGamma(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < 500; n += 1) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  // Continued fraction for the upper tail (Lentz).
  let b = x + 1 - a;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Regularised incomplete beta I_x(a, b), by Lentz's continued fraction. */
function regularisedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  const continued = (xx: number, aa: number, bb: number): number => {
    let c = 1;
    let d = 1 - ((aa + bb) * xx) / (aa + 1);
    if (Math.abs(d) < 1e-300) d = 1e-300;
    d = 1 / d;
    let h = d;
    for (let m = 1; m < 300; m += 1) {
      const m2 = 2 * m;
      let numerator = (m * (bb - m) * xx) / ((aa + m2 - 1) * (aa + m2));
      d = 1 + numerator * d;
      if (Math.abs(d) < 1e-300) d = 1e-300;
      c = 1 + numerator / c;
      if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      h *= d * c;
      numerator = (-(aa + m) * (aa + bb + m) * xx) / ((aa + m2) * (aa + m2 + 1));
      d = 1 + numerator * d;
      if (Math.abs(d) < 1e-300) d = 1e-300;
      c = 1 + numerator / c;
      if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-14) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2)
    ? (front * continued(x, a, b)) / a
    : 1 - (front * continued(1 - x, b, a)) / b;
}

/** Upper-tail probability of a chi-square variable with `df` degrees of freedom. */
export function chiSquareTail(statistic: number, df: number): number {
  if (!(statistic > 0) || df <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - regularisedGamma(df / 2, statistic / 2)));
}

/** Upper-tail probability of an F variable with `df1` and `df2` degrees of freedom. */
export function fTail(statistic: number, df1: number, df2: number): number {
  if (!(statistic > 0) || df1 <= 0 || df2 <= 0) return 1;
  const x = df2 / (df2 + df1 * statistic);
  return Math.min(1, Math.max(0, regularisedBeta(x, df2 / 2, df1 / 2)));
}

/** Two-sided probability of a Student t variable, |t| and beyond. */
export function tTwoSided(statistic: number, df: number): number {
  if (df <= 0) return 1;
  const x = df / (df + statistic * statistic);
  return Math.min(1, Math.max(0, regularisedBeta(x, df / 2, 0.5)));
}

/* ---------------------------------------------------------------- minimiser */

/**
 * Nelder–Mead on a small parameter vector.
 *
 * Chosen over a gradient method because the likelihood it will be pointed at
 * has a constraint on the sum of two parameters, and a simplex walks around a
 * wall a gradient step would try to cross. Three parameters and a few hundred
 * evaluations of an O(n) function: cheap enough to run on every page view.
 */
export function nelderMead(
  objective: (point: readonly number[]) => number,
  start: readonly number[],
  options: { step?: number; iterations?: number; tolerance?: number } = {},
): { point: number[]; value: number; converged: boolean } {
  const step = options.step ?? 0.5;
  const iterations = options.iterations ?? 600;
  const tolerance = options.tolerance ?? 1e-9;
  const dimension = start.length;
  let simplex: Array<{ point: number[]; value: number }> = [
    { point: [...start], value: objective(start) },
  ];
  for (let i = 0; i < dimension; i += 1) {
    const point = [...start];
    point[i] = (point[i] ?? 0) + step;
    simplex.push({ point, value: objective(point) });
  }
  let converged = false;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    simplex.sort((left, right) => left.value - right.value);
    const best = simplex[0]!;
    const worst = simplex[dimension]!;
    if (Math.abs(worst.value - best.value) < tolerance * (1 + Math.abs(best.value))) {
      converged = true;
      break;
    }
    const centroid = new Array<number>(dimension).fill(0);
    for (let i = 0; i < dimension; i += 1) {
      for (let d = 0; d < dimension; d += 1) {
        centroid[d] = (centroid[d] ?? 0) + (simplex[i]!.point[d] ?? 0) / dimension;
      }
    }
    const along = (factor: number): number[] =>
      centroid.map((c, d) => c + factor * ((worst.point[d] ?? 0) - c));
    const reflected = along(-1);
    const reflectedValue = objective(reflected);
    if (reflectedValue < best.value) {
      const expanded = along(-2);
      const expandedValue = objective(expanded);
      simplex[dimension] =
        expandedValue < reflectedValue
          ? { point: expanded, value: expandedValue }
          : { point: reflected, value: reflectedValue };
      continue;
    }
    if (reflectedValue < simplex[dimension - 1]!.value) {
      simplex[dimension] = { point: reflected, value: reflectedValue };
      continue;
    }
    const contracted = along(0.5);
    const contractedValue = objective(contracted);
    if (contractedValue < worst.value) {
      simplex[dimension] = { point: contracted, value: contractedValue };
      continue;
    }
    simplex = simplex.map((vertex, i) =>
      i === 0
        ? vertex
        : {
            point: vertex.point.map(
              (v, d) => (best.point[d] ?? 0) + 0.5 * (v - (best.point[d] ?? 0)),
            ),
            value: 0,
          },
    );
    for (let i = 1; i <= dimension; i += 1) simplex[i]!.value = objective(simplex[i]!.point);
  }
  simplex.sort((left, right) => left.value - right.value);
  return { point: simplex[0]!.point, value: simplex[0]!.value, converged };
}

/* ------------------------------------------------------------------ helpers */

export const mean = (values: readonly number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const variance = (values: readonly number[]): number => {
  if (values.length < 2) return 0;
  const average = mean(values);
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
};

/** Autocorrelation of a series at lag `k`, centred on its own mean. */
export function autocorrelationAt(values: readonly number[], k: number): number {
  const n = values.length;
  if (k >= n || k < 1) return 0;
  const average = mean(values);
  let numerator = 0;
  let denominator = 0;
  for (let t = 0; t < n; t += 1) {
    const centred = (values[t] ?? 0) - average;
    denominator += centred * centred;
    if (t >= k) numerator += centred * ((values[t - k] ?? 0) - average);
  }
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Cada prueba como una fila, para leer las frases contra su número.
 *
 * Vivía en el panel de pantalla (`fx-econometrics-panel.tsx`, retirado el
 * 2026-09-23 cuando la batería pasó a entregarse como informe impreso). Se
 * conserva aparte del informe porque es la estructura de la batería y no su
 * maquetación: qué prueba, sobre qué serie, en qué ventana, con qué
 * estadístico, contra qué referencia y qué decide. El informe agrupa estas
 * filas por familia de prueba y las dibuja; nada aquí sabe de papel.
 *
 * Lo mismo que en `fx-econometrics-reading.ts`: ninguna celda se escribe a
 * mano. Cada una sale del resultado y cambia cuando él cambia.
 */

import type { FxEconometrics, RegimeMoments, Significance } from './fx-econometrics';

const number = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const signed = (value: number, decimals = 2): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value), decimals)}`;
/** El p-valor con su signo: «p < 0,001» y no «p = < 0,001», que era como salía en el panel. */
const pValue = (p: number): string => (p < 0.001 ? 'p < 0,001' : `p = ${number(p, 3)}`);

const shortDate = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
export const sayDay = (value: string): string => shortDate.format(new Date(`${value}T12:00:00Z`));

export const REGIME_LABEL: Record<RegimeMoments['regime'], string> = {
  FIJO: 'oficial fijo',
  EN_MOVIMIENTO: 'oficial en movimiento',
};

/** Las familias de prueba, en el orden en que llegan las preguntas. */
export type TestFamily =
  | 'raiz-unitaria'
  | 'persistencia'
  | 'cointegracion'
  | 'causalidad'
  | 'quiebre'
  | 'volatilidad'
  | 'traspaso';

export const FAMILY_LABEL: Record<TestFamily, string> = {
  'raiz-unitaria': 'Raíz unitaria (Dickey–Fuller aumentado)',
  persistencia: 'Persistencia de la brecha (autorregresión de primer orden)',
  cointegracion: 'Cointegración y corrección de errores (Engle–Granger)',
  causalidad: 'Causalidad de Granger',
  quiebre: 'Quiebre estructural (Quandt–Andrews y Chow)',
  volatilidad: 'Volatilidad (Ljung–Box, ARCH-LM y GARCH)',
  traspaso: 'Traspaso a precios',
};

export interface TestRow {
  key: string;
  family: TestFamily;
  test: string;
  series: string;
  window: string;
  n: number;
  statistic: string;
  reference: string;
  verdict: string;
}

const rejectsAt = (rejects: Significance, what: string): string =>
  rejects ? `${what} rechazada al ${rejects.replace('%', ' %')}` : `${what} no rechazada`;

/** Toda la batería, una prueba por fila. */
export function tabulate(result: FxEconometrics): TestRow[] {
  const rows: TestRow[] = [];
  const full = result.full ? `${sayDay(result.full.from)} – ${sayDay(result.full.to)}` : '';
  const moving = result.moving ? `desde ${sayDay(result.moving.from)}` : '';
  const adfRow = (
    key: string,
    series: string,
    window: string,
    test: FxEconometrics['unitRoot']['parallelLevel'],
  ) => {
    if (!test) return;
    rows.push({
      key,
      family: 'raiz-unitaria',
      test: `Dickey–Fuller aumentado (${test.lags} rezago${test.lags === 1 ? '' : 's'})`,
      series,
      window,
      n: test.n,
      statistic: `t = ${number(test.statistic)}`,
      reference: `crítico 5 %: ${number(test.critical.p5)} · 1 %: ${number(test.critical.p1)}`,
      verdict: rejectsAt(test.rejects, 'raíz unitaria'),
    });
  };
  adfRow('adf-level', 'paralelo, log del nivel', full, result.unitRoot.parallelLevel);
  adfRow('adf-returns', 'paralelo, variación diaria', full, result.unitRoot.parallelReturns);
  adfRow('adf-real', 'paralelo real (UFV), log', full, result.unitRoot.realParallel);
  adfRow('adf-gap', 'brecha, %', full, result.unitRoot.gap);
  adfRow('adf-gap-moving', 'brecha, %', moving, result.unitRoot.gapMoving);

  const persistenceRow = (
    key: string,
    window: string,
    p: FxEconometrics['gapPersistence']['full'],
  ) => {
    if (!p) return;
    rows.push({
      key,
      family: 'persistencia',
      test: 'Autorregresión AR(1)',
      series: 'brecha, %',
      window,
      n: p.n,
      statistic: `ρ = ${number(p.rho, 3)} ± ${number(p.standardError, 3)}`,
      reference: 'vida media = ln 0,5 / ln ρ',
      verdict:
        p.halfLifeDays !== null ? `vida media ${number(p.halfLifeDays, 1)} días` : 'sin reversión',
    });
  };
  persistenceRow('ar1-gap', full, result.gapPersistence.full);
  persistenceRow('ar1-gap-moving', moving, result.gapPersistence.moving);

  const c = result.cointegration;
  if (c) {
    rows.push({
      key: 'eg',
      family: 'cointegracion',
      test: 'Engle–Granger, residuo',
      series: 'log oficial sobre log paralelo',
      window: moving,
      n: c.n,
      statistic: `β = ${number(c.beta)} · t = ${number(c.residualTest.statistic)}`,
      reference: `crítico 5 %: ${number(c.residualTest.critical.p5)} · 1 %: ${number(c.residualTest.critical.p1)}`,
      verdict: rejectsAt(c.cointegrated, 'no cointegración'),
    });
    rows.push({
      key: 'ecm-official',
      family: 'cointegracion',
      test: 'Corrección de errores, oficial',
      series: 'Δ log oficial',
      window: moving,
      n: c.n - 1,
      statistic: `λ = ${number(c.official.lambda, 3)} · t = ${number(c.official.tStat)}`,
      reference: `${pValue(c.official.pValue)}`,
      verdict:
        c.official.halfLifeDays !== null && c.official.pValue < 0.05
          ? `corrige, vida media ${number(c.official.halfLifeDays, 1)} días`
          : 'no corrige',
    });
    rows.push({
      key: 'ecm-parallel',
      family: 'cointegracion',
      test: 'Corrección de errores, paralelo',
      series: 'Δ log paralelo',
      window: moving,
      n: c.n - 1,
      statistic: `λ = ${number(c.parallel.lambda, 3)} · t = ${number(c.parallel.tStat)}`,
      reference: `${pValue(c.parallel.pValue)}`,
      verdict:
        c.parallel.halfLifeDays !== null && c.parallel.pValue < 0.05
          ? `corrige, vida media ${number(c.parallel.halfLifeDays, 1)} días`
          : 'no corrige',
    });
  }

  const grangerRow = (
    key: string,
    label: string,
    g: FxEconometrics['granger']['parallelToOfficial'],
  ) => {
    if (!g) return;
    rows.push({
      key,
      family: 'causalidad',
      test: `Granger (${g.lags} rezago${g.lags === 1 ? '' : 's'})`,
      series: label,
      window: moving,
      n: g.n,
      statistic: `F = ${number(g.fStat)}`,
      reference: `${pValue(g.pValue)}`,
      verdict: g.pValue < 0.05 ? 'anticipa' : 'no anticipa',
    });
  };
  grangerRow('granger-po', 'paralelo → oficial', result.granger.parallelToOfficial);
  grangerRow('granger-op', 'oficial → paralelo', result.granger.officialToParallel);

  const s = result.breaks.search;
  if (s && s.date) {
    rows.push({
      key: 'supf',
      family: 'quiebre',
      test: 'Quandt–Andrews, sup F',
      series: 'paralelo, variación diaria',
      window: full,
      n: s.n,
      statistic: `F = ${number(s.supF)} el ${sayDay(s.date)}`,
      reference: `crítico 10 %: ${number(s.critical.p10)} · 5 %: ${number(s.critical.p5)} · 1 %: ${number(s.critical.p1)}`,
      verdict: rejectsAt(s.rejects, 'ausencia de quiebre'),
    });
  }
  const k = result.breaks.atRegimeChange;
  if (k) {
    rows.push({
      key: 'chow',
      family: 'quiebre',
      test: `Chow en ${sayDay(k.date)}`,
      series: 'paralelo, variación diaria',
      window: full,
      n: k.nBefore + k.nAfter,
      statistic: `F = ${number(k.fStat)}`,
      reference: `${pValue(k.pValue)}`,
      verdict: k.pValue < 0.05 ? 'la media cambia' : 'la media no cambia',
    });
    rows.push({
      key: 'variance-ratio',
      family: 'quiebre',
      test: `Razón de varianzas en ${sayDay(k.date)}`,
      series: 'paralelo, variación diaria',
      window: `${k.nBefore} antes · ${k.nAfter} después`,
      n: k.nBefore + k.nAfter,
      statistic: `F = ${number(k.varianceRatio)}`,
      reference: `${pValue(k.varianceP)} · vol. ${number(k.volBeforeAnnual, 1)} % → ${number(k.volAfterAnnual, 1)} %`,
      verdict: k.varianceP < 0.05 ? 'la varianza cambia' : 'la varianza no cambia',
    });
  }

  const v = result.volatility;
  if (v.ljungBoxReturns) {
    rows.push({
      key: 'lb',
      family: 'volatilidad',
      test: `Ljung–Box (${v.ljungBoxReturns.lags} rezagos)`,
      series: 'paralelo, variación diaria',
      window: full,
      n: result.full?.n ?? 0,
      statistic: `Q = ${number(v.ljungBoxReturns.statistic, 1)}`,
      reference: `${pValue(v.ljungBoxReturns.pValue)}`,
      verdict: v.ljungBoxReturns.pValue < 0.05 ? 'hay autocorrelación' : 'sin autocorrelación',
    });
  }
  if (v.archLm) {
    rows.push({
      key: 'arch',
      family: 'volatilidad',
      test: `ARCH-LM (${v.archLm.lags} rezagos)`,
      series: 'paralelo, variación diaria',
      window: full,
      n: result.full?.n ?? 0,
      statistic: `LM = ${number(v.archLm.statistic, 1)}`,
      reference: `${pValue(v.archLm.pValue)}`,
      verdict: v.archLm.pValue < 0.05 ? 'volatilidad en rachas' : 'sin rachas',
    });
  }
  if (v.garch) {
    rows.push({
      key: 'garch',
      family: 'volatilidad',
      test: 'GARCH(1,1), máxima verosimilitud',
      series: 'paralelo, variación diaria',
      window: full,
      n: v.garch.n,
      statistic: `α = ${number(v.garch.alpha)} · β = ${number(v.garch.beta)}`,
      reference: `persistencia ${number(v.garch.persistence, 3)}${v.garch.converged ? '' : ' (sin converger)'}`,
      verdict: v.garch.integrated
        ? 'integrada: sin nivel de largo plazo'
        : v.garch.volHalfLifeDays !== null
          ? `un choque de volatilidad se reduce a la mitad en ${number(v.garch.volHalfLifeDays, 1)} días`
          : 'sin persistencia',
    });
  }
  const p = result.passThrough;
  if (p) {
    const last = p.cumulative.at(-1);
    rows.push({
      key: 'pass',
      family: 'traspaso',
      test: `Traspaso a precios (${p.coefficients.length - 1} rezagos)`,
      series: 'inflación mensual UFV sobre depreciación mensual',
      window: `${p.from} – ${p.to}`,
      n: p.n,
      statistic: last ? `acumulado ${signed(last.value)} ± ${number(last.standardError)}` : '',
      reference: `R² = ${number(p.r2)}`,
      verdict:
        last && last.value > 0 && last.value > 2 * last.standardError
          ? 'traspaso positivo'
          : 'sin traspaso positivo medible',
    });
  }
  return rows;
}

/** Los momentos de cada régimen, una fila por tramo, ya formateados. */
export function regimeRows(rows: readonly RegimeMoments[]): string[][] {
  return rows.map((row) => [
    REGIME_LABEL[row.regime],
    `${sayDay(row.from)} – ${sayDay(row.to)}`,
    number(row.n, 0),
    `${signed(row.meanDaily, 3)} %`,
    `${number(row.volAnnual, 1)} %`,
    `${number(row.valueAtRisk95, 2)} %`,
    row.worstDay ? `${signed(row.worstDay.value)} % el ${sayDay(row.worstDay.date)}` : '—',
  ]);
}

export { number, signed };

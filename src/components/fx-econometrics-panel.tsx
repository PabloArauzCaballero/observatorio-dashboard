'use client';

import { SeriesChart } from './charts';
import { DerivedReading } from './derived-reading';
import type { IconName } from './icons';
import type { FxEconometrics, RegimeMoments, Significance } from '@/lib/fx-econometrics';
import type { FxConclusion } from '@/lib/fx-snapshot';

/**
 * The formal tests, read first and shown whole.
 *
 * The macro reading above says what the rate did; this says what a referee
 * would accept about it. Sentences first, because a table of t-statistics
 * asks the reader to know what each one is for; then the table itself, with
 * the statistic, the sample and the critical value on every row, so the
 * sentence can be checked against the number it came from; then the three
 * pictures the tests draw — the conditional volatility, the search for the
 * break, the distance from the long-run relation.
 *
 * Nothing here is written by hand. `econometricConclusions` derives every
 * sentence from the same result object this panel tabulates.
 */

const number = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const signed = (value: number, decimals = 2): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value), decimals)}`;
const pValue = (p: number): string => (p < 0.001 ? '< 0,001' : number(p, 3));

const CONCLUSION_ICON: Record<string, IconName> = {
  raiz: 'linea',
  'brecha-vida-media': 'balanza',
  cointegracion: 'capas',
  causalidad: 'tendencia',
  quiebre: 'rayo',
  garch: 'pulso',
  traspaso: 'etiqueta',
};

const REGIME_LABEL: Record<RegimeMoments['regime'], string> = {
  FIJO: 'oficial fijo',
  EN_MOVIMIENTO: 'oficial en movimiento',
};

const shortDate = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const sayDay = (value: string): string => shortDate.format(new Date(`${value}T12:00:00Z`));

interface TestRow {
  key: string;
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

/** Every test as one row, so the sentences above can be checked line by line. */
function tabulate(result: FxEconometrics): TestRow[] {
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
      test: 'Corrección de errores, oficial',
      series: 'Δ log oficial',
      window: moving,
      n: c.n - 1,
      statistic: `λ = ${number(c.official.lambda, 3)} · t = ${number(c.official.tStat)}`,
      reference: `p = ${pValue(c.official.pValue)}`,
      verdict:
        c.official.halfLifeDays !== null && c.official.pValue < 0.05
          ? `corrige, vida media ${number(c.official.halfLifeDays, 1)} días`
          : 'no corrige',
    });
    rows.push({
      key: 'ecm-parallel',
      test: 'Corrección de errores, paralelo',
      series: 'Δ log paralelo',
      window: moving,
      n: c.n - 1,
      statistic: `λ = ${number(c.parallel.lambda, 3)} · t = ${number(c.parallel.tStat)}`,
      reference: `p = ${pValue(c.parallel.pValue)}`,
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
      test: `Granger (${g.lags} rezago${g.lags === 1 ? '' : 's'})`,
      series: label,
      window: moving,
      n: g.n,
      statistic: `F = ${number(g.fStat)}`,
      reference: `p = ${pValue(g.pValue)}`,
      verdict: g.pValue < 0.05 ? 'anticipa' : 'no anticipa',
    });
  };
  grangerRow('granger-po', 'paralelo → oficial', result.granger.parallelToOfficial);
  grangerRow('granger-op', 'oficial → paralelo', result.granger.officialToParallel);

  const s = result.breaks.search;
  if (s && s.date) {
    rows.push({
      key: 'supf',
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
      test: `Chow en ${sayDay(k.date)}`,
      series: 'paralelo, variación diaria',
      window: full,
      n: k.nBefore + k.nAfter,
      statistic: `F = ${number(k.fStat)}`,
      reference: `p = ${pValue(k.pValue)}`,
      verdict: k.pValue < 0.05 ? 'la media cambia' : 'la media no cambia',
    });
    rows.push({
      key: 'variance-ratio',
      test: `Razón de varianzas en ${sayDay(k.date)}`,
      series: 'paralelo, variación diaria',
      window: `${k.nBefore} antes · ${k.nAfter} después`,
      n: k.nBefore + k.nAfter,
      statistic: `F = ${number(k.varianceRatio)}`,
      reference: `p = ${pValue(k.varianceP)} · vol. ${number(k.volBeforeAnnual, 1)} % → ${number(k.volAfterAnnual, 1)} %`,
      verdict: k.varianceP < 0.05 ? 'la varianza cambia' : 'la varianza no cambia',
    });
  }

  const v = result.volatility;
  if (v.ljungBoxReturns) {
    rows.push({
      key: 'lb',
      test: `Ljung–Box (${v.ljungBoxReturns.lags} rezagos)`,
      series: 'paralelo, variación diaria',
      window: full,
      n: result.full?.n ?? 0,
      statistic: `Q = ${number(v.ljungBoxReturns.statistic, 1)}`,
      reference: `p = ${pValue(v.ljungBoxReturns.pValue)}`,
      verdict: v.ljungBoxReturns.pValue < 0.05 ? 'hay autocorrelación' : 'sin autocorrelación',
    });
  }
  if (v.archLm) {
    rows.push({
      key: 'arch',
      test: `ARCH-LM (${v.archLm.lags} rezagos)`,
      series: 'paralelo, variación diaria',
      window: full,
      n: result.full?.n ?? 0,
      statistic: `LM = ${number(v.archLm.statistic, 1)}`,
      reference: `p = ${pValue(v.archLm.pValue)}`,
      verdict: v.archLm.pValue < 0.05 ? 'volatilidad en rachas' : 'sin rachas',
    });
  }
  if (v.garch) {
    rows.push({
      key: 'garch',
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

function RegimeTable({ rows, label }: { rows: readonly RegimeMoments[]; label: string }) {
  if (!rows.length) return null;
  return (
    <div className="table-wrap">
      <table className="grid-table">
        <thead>
          <tr>
            <th>{label}</th>
            <th>Tramo</th>
            <th>Jornadas</th>
            <th>Retorno medio diario</th>
            <th>Volatilidad anualizada</th>
            <th>VaR 95 % diario</th>
            <th>Peor jornada</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.regime}-${row.from}`}>
              <td>{REGIME_LABEL[row.regime]}</td>
              <td>
                {sayDay(row.from)} – {sayDay(row.to)}
              </td>
              <td>{number(row.n, 0)}</td>
              <td>{signed(row.meanDaily, 3)} %</td>
              <td>{number(row.volAnnual, 1)} %</td>
              <td>{number(row.valueAtRisk95, 2)} %</td>
              <td>
                {row.worstDay
                  ? `${signed(row.worstDay.value)} % el ${sayDay(row.worstDay.date)}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FxEconometricsPanel({
  result,
  conclusions,
}: {
  result: FxEconometrics;
  conclusions: readonly FxConclusion[];
}) {
  const rows = tabulate(result);
  const garch = result.volatility.garch;
  const search = result.breaks.search;
  const cointegration = result.cointegration;

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Análisis econométrico del tipo de cambio</h2>
          <p className="panel-sub">
            Las preguntas que la lectura de arriba deja abiertas, sometidas a prueba: si el paralelo
            revierte o acumula, si la brecha se cierra sola y a qué velocidad, si el oficial sigue
            al mercado o lo lidera, dónde se quiebra la serie, si la volatilidad viene en rachas y
            cuánto de una depreciación llega a los precios. Ninguna prueba cruza el cambio de
            régimen salvo la que lo mide: las que hablan de la relación oficial–paralelo usan solo
            el tramo en que el oficial se mueve.
          </p>
        </div>
        <DerivedReading
          title="Qué dicen las pruebas"
          note="Cada frase sale de una prueba con nombre, un estadístico y un valor crítico, y todos están en la tabla de abajo. Se dice qué se rechaza y a qué nivel; no se dice por qué pasó ni qué va a pasar."
          conclusions={conclusions}
          icons={CONCLUSION_ICON}
          unit="prueba"
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Las pruebas, una por fila</h2>
          <p className="panel-sub">
            Estadístico, muestra y referencia de cada prueba, para leer las frases contra su número.
            Los valores críticos de Dickey–Fuller y de Engle–Granger son los de MacKinnon para el
            tamaño de muestra usado; los del quiebre, los de Andrews para una restricción y recorte
            del 15 %.
          </p>
        </div>
        <div className="table-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Prueba</th>
                <th>Serie</th>
                <th>Ventana</th>
                <th>n</th>
                <th>Estadístico</th>
                <th>Referencia</th>
                <th>Lectura</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.test}</td>
                  <td>{row.series}</td>
                  <td>{row.window}</td>
                  <td>{number(row.n, 0)}</td>
                  <td>{row.statistic}</td>
                  <td>{row.reference}</td>
                  <td>{row.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Cada régimen con su estadística</h2>
          <p className="panel-sub">
            Los momentos de las variaciones diarias, calculados dentro de cada tramo y nunca a
            través del cambio: un promedio que cruza la fecha en que el oficial se soltó describe un
            mercado que no existió.
          </p>
        </div>
        <RegimeTable rows={result.regimeMoments.parallel} label="Paralelo" />
        <div style={{ height: 'var(--s2)' }} />
        <RegimeTable rows={result.regimeMoments.official} label="Oficial" />
      </div>

      <div className="grid-two">
        {garch ? (
          <div className="panel">
            <div className="panel-head">
              <h2>Volatilidad condicional</h2>
              <p className="panel-sub">
                La desviación típica que el GARCH(1,1) asigna a cada jornada, anualizada. Sube el
                día después de un salto y decae mientras no llegue otro; la lectura sin modelo
                (RiskMetrics) para hoy es {number(garch.ewmaVolAnnual, 1)} %.
              </p>
            </div>
            <SeriesChart
              data={garch.series}
              kind="area"
              tone="var(--gap)"
              unit="%"
              decimals={1}
              domain={[0, Math.ceil(Math.max(...garch.series.map((point) => point.value)) * 1.05)]}
            />
          </div>
        ) : null}
        {search && search.date ? (
          <div className="panel">
            <div className="panel-head">
              <h2>Dónde se quiebra la serie</h2>
              <p className="panel-sub">
                El estadístico F de un cambio de media en cada fecha candidata. El máximo es el
                quiebre y cae el {sayDay(search.date)}. Por encima de {number(search.critical.p5)}{' '}
                se rechaza al 5 %; de {number(search.critical.p10)}, al 10 %.
              </p>
            </div>
            <SeriesChart
              data={search.path}
              kind="line"
              tone="var(--official)"
              unit=""
              decimals={2}
            />
          </div>
        ) : null}
      </div>

      {cointegration ? (
        <div className="panel">
          <div className="panel-head">
            <h2>Distancia a la relación de largo plazo</h2>
            <p className="panel-sub">
              El residuo de la regresión de largo plazo entre el oficial y el paralelo, en por
              ciento del oficial. Por debajo de cero el oficial está más bajo de lo que su relación
              con el paralelo implica; el modelo de corrección de errores mide cuánto de esa
              distancia se cierra cada día y en cuál de los dos precios.
            </p>
          </div>
          <SeriesChart
            data={cointegration.deviation}
            kind="line"
            tone="var(--parallel)"
            unit="%"
            decimals={1}
            zeroLine
          />
        </div>
      ) : null}
    </>
  );
}

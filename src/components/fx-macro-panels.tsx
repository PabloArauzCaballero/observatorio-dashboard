'use client';

import { DatedLines, SeriesChart } from './charts';
import type { DatedBand, DatedLinePoint, DatedLineSeries } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { MacroPoint, RegimeSegment } from '@/lib/fx-macro';
import type { FxConclusion, FxSnapshot, StablecoinReading } from '@/lib/fx-snapshot';

/**
 * The macroeconomic reading of the exchange rate: the answers, then the charts.
 *
 * Deliberately placed before the statistical machinery rather than after it.
 * The old section opened on an annualised volatility and a value at risk, which
 * asks a reader to work out for themselves what the figures are for; this opens
 * on what the figures say, in sentences, with the number that carries each one.
 *
 * None of the prose here is written. Every sentence arrives from
 * `fxSnapshot`, derived from the same series the charts draw, so a reader can
 * check any claim against the plot beside it and neither can go stale while the
 * other updates.
 */

const number = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const signed = (value: number, decimals = 2): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value), decimals)}`;

/** The icon each conclusion carries, chosen for what the figure is about. */
const CONCLUSION_ICON: Record<string, IconName> = {
  brecha: 'balanza',
  regimen: 'banco',
  real: 'monedas',
  ancla: 'diana',
  inflacion: 'etiqueta',
  riel: 'chip',
};

/**
 * Maps a conclusion's direction onto the report's two-colour convention.
 *
 * The existing marks are named `up` and `down` after a movement, but what they
 * actually encode is adverse and favourable — `--up` is the red used for "above
 * the reference, adverse". Translating here rather than renaming the tokens
 * keeps this panel inside the palette that was validated for contrast instead of
 * introducing a third colour that was not.
 */
const toneClass = (tone: FxConclusion['tone']): string =>
  tone === 'adverse' ? 'up' : tone === 'favourable' ? 'down' : 'flat';

export function FxConclusions({ conclusions }: { conclusions: readonly FxConclusion[] }) {
  if (!conclusions.length) return null;
  return (
    <div className="analysis">
      <div className="tile-head">
        <Icon name="sigma" size={17} />
        <h2>Qué dicen estos datos</h2>
        <span className="tile-hint">derivado, no redactado</span>
      </div>
      <p className="analysis-note">
        Cada frase sale de las series de esta misma sección y se recalcula con cada carga. Dice qué
        nivel hay, contra qué referencia y bajo qué régimen; no dice por qué ni qué va a pasar.
      </p>
      <ul className="bullets">
        {conclusions.map((conclusion) => (
          <li className="bullet" key={conclusion.key}>
            <span className={`bullet-mark bullet-mark-${toneClass(conclusion.tone)}`}>
              <Icon name={CONCLUSION_ICON[conclusion.key] ?? 'info'} size={16} />
            </span>
            <div className="bullet-body">
              <div className="bullet-line">
                <b className="bullet-label">{conclusion.claim}</b>
                <span className={`bullet-value bullet-value-${toneClass(conclusion.tone)}`}>
                  {conclusion.figure}
                </span>
              </div>
              <p className="bullet-detail">{conclusion.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The regime stretches, shaded behind whichever series is drawn over them. */
function regimeBands(regimes: readonly RegimeSegment[]): DatedBand[] {
  return regimes
    .filter((segment) => segment.regime === 'FIJO' && segment.days > 60)
    .map((segment) => ({ from: segment.from, to: segment.to, label: 'oficial fijo' }));
}

/** Joins two dated series into the rows the multi-line chart takes. */
function pair(
  left: readonly MacroPoint[],
  right: readonly MacroPoint[],
  leftKey: string,
  rightKey: string,
): DatedLinePoint[] {
  const rightByDate = new Map(right.map((point) => [point.date, point.value]));
  const dates = [...new Set([...left.map((p) => p.date), ...right.map((p) => p.date)])].sort();
  const leftByDate = new Map(left.map((point) => [point.date, point.value]));
  return dates.map((date) => ({
    date,
    [leftKey]: leftByDate.get(date) ?? null,
    [rightKey]: rightByDate.get(date) ?? null,
  }));
}

export interface FxMacroPanelsProps {
  snapshot: FxSnapshot;
  /** Real indices, base 100 at the first day both series and the UFV exist. */
  realParallel: readonly MacroPoint[];
  realOfficial: readonly MacroPoint[];
  /** Annualised inflation implied by the UFV, over the trailing year. */
  inflation: readonly MacroPoint[];
  /** One entry per token, with the mid-point series each one has so far. */
  tokens: ReadonlyArray<{ token: string; points: readonly MacroPoint[] }>;
}

const REAL_SERIES: readonly DatedLineSeries[] = [
  { key: 'paralelo', label: 'Paralelo, real', tone: 'var(--parallel)', emphasis: true },
  { key: 'oficial', label: 'Oficial, real', tone: 'var(--official)' },
];

/**
 * Colour for the token lines.
 *
 * Only the first three slots of the palette survive the pairwise separation
 * check, so the two tokens take the second and third rather than a new hue
 * invented for them. The parallel's own orange goes to USDT because USDT *is*
 * what most of the parallel series has been quoting all along.
 */
/**
 * Days a token needs before its line is drawn rather than tabulated.
 *
 * Two readings produce two flat segments and a vertical axis that prints the
 * same tick twice, which reads as a broken chart rather than as a series that
 * has just started. Until there is a fortnight the figures are given as
 * numbers, which is all they are.
 */
const TOKEN_CHART_MINIMUM = 14;

const TOKEN_TONE: Record<string, string> = {
  USDT: 'var(--parallel)',
  USDC: 'var(--gap)',
  USD: 'var(--series-rest)',
};

export function FxMacroPanels({
  snapshot,
  realParallel,
  realOfficial,
  inflation,
  tokens,
}: FxMacroPanelsProps) {
  const bands = regimeBands(snapshot.regimes);
  const realRows = pair(realParallel, realOfficial, 'paralelo', 'oficial');

  const tokenSeries: DatedLineSeries[] = tokens.map((entry) => ({
    key: entry.token,
    label: entry.token,
    tone: TOKEN_TONE[entry.token] ?? 'var(--series-rest)',
    emphasis: entry.token === 'USDT',
  }));
  const tokenDates = [
    ...new Set(tokens.flatMap((entry) => entry.points.map((point) => point.date))),
  ].sort();
  const tokenRows: DatedLinePoint[] = tokenDates.map((date) => {
    const row: DatedLinePoint = { date };
    for (const entry of tokens) {
      row[entry.token] = entry.points.find((point) => point.date === date)?.value ?? null;
    }
    return row;
  });

  return (
    <>
      <FxConclusions conclusions={snapshot.conclusions} />

      <div className="panel">
        <div className="panel-head">
          <h2>Nivel real del tipo de cambio</h2>
          <p className="panel-sub">
            Cada serie sobre <b>su propio</b> nivel del {sayShort(snapshot.real?.base)} = 100,
            deflactada por la UFV. Por encima de 100 el dólar se encareció de verdad; por debajo, su
            subida nominal no alcanzó a los precios y cuesta menos en poder de compra que al
            empezar. Los dos números <b>no se comparan entre sí</b> —cada uno mide su propia serie
            contra su propio arranque—; lo que se lee es la dirección y el cruce de 100. La franja
            sombreada es el tramo en que el oficial estuvo fijo.
          </p>
        </div>
        {realRows.length > 1 ? (
          <DatedLines
            data={realRows}
            series={REAL_SERIES}
            unit="índice"
            decimals={1}
            referenceLine={100}
            referenceLabel="nivel del inicio"
            bands={bands}
            height="tall"
          />
        ) : (
          <div className="callout">
            Hace falta que el tipo de cambio y la UFV coincidan en al menos dos jornadas.
          </div>
        )}
      </div>

      <div className="grid-two">
        <div className="panel">
          <div className="panel-head">
            <h2>Inflación a frecuencia diaria</h2>
            <p className="panel-sub">
              Variación de la UFV en los últimos doce meses, anualizada. La UFV es la unidad a la
              que se indexan contratos y créditos y el Banco Central la publica{' '}
              <b>todos los días</b> desde 2001, así que es la única medida de precios que este
              informe puede leer sin esperar al cierre del año.
            </p>
          </div>
          {inflation.length > 1 ? (
            <SeriesChart
              data={inflation.map((point) => ({ date: point.date, value: point.value }))}
              kind="area"
              tone="var(--gap)"
              unit="%"
              decimals={1}
            />
          ) : (
            <div className="callout">Sin suficientes lecturas de la UFV para estimarla.</div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>El dólar por cada riel</h2>
            <p className="panel-sub">
              Punto medio en bolivianos por dólar de cada ficha estable, que es la vía por la que se
              compran dólares cuando el mercado formal no los da. Las dos están ancladas al mismo
              dólar, de modo que la diferencia entre ellas es el costo del riel y no otro precio.
            </p>
          </div>
          {tokenRows.length >= TOKEN_CHART_MINIMUM ? (
            <DatedLines data={tokenRows} series={tokenSeries} unit="Bs/USD" decimals={3} />
          ) : (
            <StablecoinTable readings={snapshot.stablecoins} />
          )}
        </div>
      </div>
    </>
  );
}

/**
 * The tokens as a table, for while the series is too short to plot.
 *
 * A one-point line is not a chart, and drawing it anyway would suggest a history
 * that does not exist: the per-token split begins where the collector began
 * naming the instrument, not where the parallel series begins.
 */
export function StablecoinTable({ readings }: { readings: readonly StablecoinReading[] }) {
  if (!readings.length) {
    return (
      <div className="callout">
        Todavía no hay lecturas por ficha. La serie por moneda empieza cuando el recolector nuevo
        publica su primera jornada; antes de eso la fuente no distinguía el instrumento.
      </div>
    );
  }
  return (
    <div className="stat-strip">
      {readings.map((reading) => (
        <div className="stat" key={reading.token}>
          <span className="stat-label">
            <Icon name="chip" size={12} />
            {reading.token}
          </span>
          <span className="stat-value">{number(reading.mid, 3)}</span>
          <span className="stat-hint">
            {reading.bid !== null && reading.ask !== null
              ? `compra ${number(reading.bid, 2)} · venta ${number(reading.ask, 2)}`
              : 'punto medio entre plazas'}
            {reading.spreadPercent !== null
              ? ` · ida y vuelta ${number(reading.spreadPercent)} %`
              : ''}
            {reading.premiumAskPercent !== null
              ? ` · comprar aquí cuesta ${signed(reading.premiumAskPercent)} %`
              : ''}
            {` · ${reading.venues} plaza${reading.venues === 1 ? '' : 's'}`}
          </span>
        </div>
      ))}
    </div>
  );
}

const shortDate = new Intl.DateTimeFormat('es-BO', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const sayShort = (value: string | undefined): string =>
  value ? shortDate.format(new Date(`${value}T12:00:00Z`)) : 'inicio de la serie';

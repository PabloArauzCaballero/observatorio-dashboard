'use client';

import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

/**
 * One chart language for the whole report.
 *
 * Every series shares an axis treatment, a tooltip, a stroke weight and a draw
 * animation, so moving between sections never feels like moving between
 * products. Colour is spent only where it carries meaning: one hue for the
 * administered rate, one for the market, one for the distance between them.
 *
 * Rate axes are fitted rather than zeroed — a move from 9.6 to 11.6 is large in
 * economic terms and a zero baseline would flatten it into a straight line. The
 * gap axis keeps its zero, because there parity is a real reference.
 */

/**
 * The shape Recharts hands a custom tooltip, parameterised with the library's
 * own generics: pinning it tighter makes the renderer unassignable to `content`.
 */
type TooltipRender = TooltipContentProps<ValueType, NameType>;

/** Shared so a redesign happens in one place, not in six. */
const MOTION = { duration: 900, easing: 'ease-out' } as const;
const AXIS = {
  stroke: 'var(--ink-faint)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;
const GRID = { stroke: 'var(--rule-soft)', vertical: false } as const;

export interface RatePoint {
  date: string;
  parallelBuy?: number | null;
  parallelSell?: number | null;
  official?: number | null;
  archived?: boolean;
}

export interface GapChartPoint {
  date: string;
  gapPercent: number;
}

export interface SpreadPoint {
  date: string;
  spread: number;
  venues: number | null;
}

export interface MacroSeriesPoint {
  period: string;
  value: number;
}

const dayMonth = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});
const longDate = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const asDate = (value: string): Date => new Date(`${value}T12:00:00Z`);
/**
 * A day on the axis, and the year whenever the axis crosses into one.
 *
 * These series run for years, and "16-ene" on its own leaves the reader to
 * work out which January they are looking at from the ticks either side of it.
 * A January tick therefore carries the year instead of the day — the same
 * convention a price chart uses, and it costs nothing on a series short enough
 * never to reach one.
 */
const shortLabel = (value: string): string => {
  const date = asDate(value);
  if (date.getUTCMonth() === 0) return `ene ’${String(date.getUTCFullYear()).slice(2)}`;
  return dayMonth.format(date);
};
const number = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** Padding that keeps a line off the frame without inventing headroom. */
function fittedDomain(values: number[]): [number, number] {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return [0, 1];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const pad = Math.max((max - min) * 0.12, Math.abs(max) * 0.01, 0.02);
  return [Number((min - pad).toFixed(4)), Number((max + pad).toFixed(4))];
}

function Frame({ children, tall }: { children: React.ReactElement; tall?: boolean }) {
  return (
    <div className={tall ? 'chart-frame chart-frame-tall' : 'chart-frame'}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function TooltipShell({
  label,
  rows,
  note,
}: {
  label: string;
  rows: Array<{ name: string; value: string }>;
  note?: string;
}) {
  return (
    <div className="tooltip">
      <div className="t-date">{label}</div>
      {rows.map((row) => (
        <div className="t-row" key={row.name}>
          <span>{row.name}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
      {note ? <div className="t-note">{note}</div> : null}
    </div>
  );
}

/**
 * A rate against time, with the market's two published sides and, where it
 * exists, the administered rate.
 */
export function RateChart({ data, tall }: { data: RatePoint[]; tall?: boolean }) {
  const domain = fittedDomain(
    data.flatMap((point) =>
      [point.parallelBuy, point.parallelSell, point.official].filter(
        (value): value is number => typeof value === 'number',
      ),
    ),
  );

  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length || typeof label !== 'string') return null;
    const point = payload[0]?.payload as RatePoint | undefined;
    const rows = [
      { name: 'Paralelo buy', value: point?.parallelBuy },
      { name: 'Paralelo sell', value: point?.parallelSell },
      { name: 'Oficial', value: point?.official },
    ]
      .filter((row): row is { name: string; value: number } => typeof row.value === 'number')
      .map((row) => ({ name: row.name, value: `${number(row.value, 4)} Bs/USD` }));

    return (
      <TooltipShell
        label={longDate.format(asDate(label))}
        rows={rows}
        {...(point?.archived ? { note: 'Incluye serie de promedio diario' } : {})}
      />
    );
  };

  return (
    <Frame {...(tall ? { tall: true } : {})}>
      <ComposedChart data={data} margin={{ top: 10, right: 14, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="fillOfficial" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--official)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--official)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="date" tickFormatter={shortLabel} minTickGap={52} {...AXIS} />
        <YAxis domain={domain} width={54} tickFormatter={(value) => number(value, 2)} {...AXIS} />
        <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--rule)', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="official"
          name="Oficial"
          stroke="var(--official)"
          strokeWidth={2}
          fill="url(#fillOfficial)"
          dot={false}
          connectNulls
          animationDuration={MOTION.duration}
          animationEasing={MOTION.easing}
        />
        <Line
          type="monotone"
          dataKey="parallelBuy"
          name="Paralelo buy"
          stroke="var(--parallel)"
          strokeWidth={2}
          dot={false}
          connectNulls
          animationDuration={MOTION.duration}
          animationEasing={MOTION.easing}
        />
        <Line
          type="monotone"
          dataKey="parallelSell"
          name="Paralelo sell"
          stroke="var(--parallel)"
          strokeWidth={1.1}
          strokeDasharray="4 3"
          dot={false}
          connectNulls
          animationDuration={MOTION.duration}
          animationEasing={MOTION.easing}
        />
      </ComposedChart>
    </Frame>
  );
}

export function GapChart({ data, tall }: { data: GapChartPoint[]; tall?: boolean }) {
  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length || typeof label !== 'string') return null;
    const point = payload[0]?.payload as GapChartPoint | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={longDate.format(asDate(label))}
        rows={[{ name: 'Brecha', value: `${number(point.gapPercent)} %` }]}
      />
    );
  };

  return (
    <Frame {...(tall ? { tall: true } : {})}>
      <ComposedChart data={data} margin={{ top: 10, right: 14, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="fillGap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gap)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--gap)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="date" tickFormatter={shortLabel} minTickGap={52} {...AXIS} />
        <YAxis width={54} tickFormatter={(value) => `${number(value, 0)}%`} {...AXIS} />
        <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--rule)', strokeWidth: 1 }} />
        {/* Parity is a real reference here, unlike on a rate axis. */}
        <ReferenceLine y={0} stroke="var(--ink-faint)" strokeDasharray="3 3" />
        <Area
          type="monotone"
          dataKey="gapPercent"
          name="Brecha"
          stroke="var(--gap)"
          fill="url(#fillGap)"
          strokeWidth={2}
          dot={false}
          animationDuration={MOTION.duration}
          animationEasing={MOTION.easing}
        />
      </ComposedChart>
    </Frame>
  );
}

export function SpreadChart({ data }: { data: SpreadPoint[] }) {
  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length || typeof label !== 'string') return null;
    const point = payload[0]?.payload as SpreadPoint | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={longDate.format(asDate(label))}
        rows={[{ name: 'Dispersión', value: `${number(point.spread, 4)} Bs` }]}
        {...(point.venues ? { note: `${point.venues} plazas cotizando` } : {})}
      />
    );
  };

  return (
    <Frame>
      <ComposedChart data={data} margin={{ top: 10, right: 14, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="fillSpread" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--parallel)" stopOpacity={0.24} />
            <stop offset="100%" stopColor="var(--parallel)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="date" tickFormatter={shortLabel} minTickGap={52} {...AXIS} />
        <YAxis width={54} tickFormatter={(value) => number(value, 2)} {...AXIS} />
        <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--rule)', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="spread"
          name="Dispersión"
          stroke="var(--parallel)"
          fill="url(#fillSpread)"
          strokeWidth={1.8}
          dot={false}
          animationDuration={MOTION.duration}
          animationEasing={MOTION.easing}
        />
      </ComposedChart>
    </Frame>
  );
}

/**
 * An annual series on its own axis.
 *
 * Small enough to sit in a grid of its peers, because a macroeconomic reading
 * is understood against its own history, not against another indicator's scale.
 */
export function MacroChart({
  data,
  unit,
  tone,
}: {
  data: MacroSeriesPoint[];
  unit: string;
  tone: string;
}) {
  const domain = fittedDomain(data.map((point) => point.value));
  const compact = (value: number): string =>
    unit === 'USD'
      ? Math.abs(value) >= 1_000_000_000
        ? `${number(value / 1_000_000_000, 1)} MM`
        : `${number(value / 1_000_000, 0)} M`
      : number(value, 1);

  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length || typeof label !== 'string') return null;
    const point = payload[0]?.payload as MacroSeriesPoint | undefined;
    if (!point) return null;
    return <TooltipShell label={label} rows={[{ name: 'Valor', value: compact(point.value) }]} />;
  };

  return (
    <div className="chart-frame chart-frame-small">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="period" minTickGap={34} {...AXIS} />
          <YAxis domain={domain} width={46} tickFormatter={compact} {...AXIS} />
          <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--rule)', strokeWidth: 1 }} />
          {domain[0] < 0 ? (
            <ReferenceLine y={0} stroke="var(--ink-faint)" strokeDasharray="3 3" />
          ) : null}
          <Line
            type="monotone"
            dataKey="value"
            stroke={tone}
            strokeWidth={1.9}
            dot={false}
            animationDuration={MOTION.duration}
            animationEasing={MOTION.easing}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * The shape of a series behind its headline figure.
 *
 * No axes and no labels: it answers "which way has this been going", which is
 * the only question a number on a card leaves open.
 */
export function Sparkline({ data, tone }: { data: number[]; tone: string }) {
  const points = data.map((value, index) => ({ index, value }));
  return (
    <div className="sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <YAxis domain={fittedDomain(data)} hide />
          <Line
            type="monotone"
            dataKey="value"
            stroke={tone}
            strokeWidth={1.6}
            dot={false}
            animationDuration={MOTION.duration}
            animationEasing={MOTION.easing}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Econometric views ------------------------------------------------------ */

export interface SeriesPoint {
  date: string;
  value: number;
}

/**
 * One series against time, in whichever mark suits what it measures.
 *
 * A single component rather than four, so a rolling correlation and a rolling
 * volatility cannot drift apart in axis treatment, tooltip or timing. The mark
 * changes; the language does not.
 */
export function SeriesChart({
  data,
  kind,
  tone,
  unit,
  decimals = 2,
  zeroLine,
  boundary,
  domain,
  height,
}: {
  data: SeriesPoint[];
  kind: 'line' | 'area' | 'bar';
  tone: string;
  unit: string;
  decimals?: number;
  /** Draw the zero reference, where crossing it means something. */
  zeroLine?: boolean;
  /** Day the measurement method changes, marked so it is not read as a signal. */
  boundary?: string | null;
  domain?: [number, number];
  height?: 'small' | 'normal' | 'tall';
}) {
  const gradientId = `grad-${tone.replace(/[^a-z]/gu, '')}-${kind}`;
  const values = data.map((point) => point.value);
  const axisDomain = domain ?? fittedDomain(values);

  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length || typeof label !== 'string') return null;
    const point = payload[0]?.payload as SeriesPoint | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={longDate.format(asDate(label))}
        rows={[{ name: 'Valor', value: `${number(point.value, decimals)} ${unit}` }]}
      />
    );
  };

  const frameClass =
    height === 'tall'
      ? 'chart-frame chart-frame-tall'
      : height === 'small'
        ? 'chart-frame chart-frame-small'
        : 'chart-frame';

  return (
    <div className={frameClass}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 14, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity={0.3} />
              <stop offset="100%" stopColor={tone} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="date" tickFormatter={shortLabel} minTickGap={52} {...AXIS} />
          <YAxis
            domain={axisDomain}
            width={54}
            tickFormatter={(value) => number(value, decimals === 0 ? 0 : 1)}
            {...AXIS}
          />
          <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--rule)', strokeWidth: 1 }} />
          {zeroLine ? (
            <ReferenceLine y={0} stroke="var(--ink-faint)" strokeDasharray="3 3" />
          ) : null}
          {boundary ? (
            <ReferenceLine
              x={boundary}
              stroke="var(--ink-faint)"
              strokeDasharray="2 4"
              label={{
                value: 'cambio de método',
                position: 'insideTopLeft',
                fontSize: 10,
                fill: 'var(--ink-faint)',
              }}
            />
          ) : null}
          {kind === 'bar' ? (
            <Bar
              dataKey="value"
              fill={tone}
              fillOpacity={0.75}
              isAnimationActive
              animationDuration={MOTION.duration}
              animationEasing={MOTION.easing}
            />
          ) : kind === 'area' ? (
            <Area
              type="monotone"
              dataKey="value"
              stroke={tone}
              strokeWidth={1.9}
              fill={`url(#${gradientId})`}
              dot={false}
              animationDuration={MOTION.duration}
              animationEasing={MOTION.easing}
            />
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              stroke={tone}
              strokeWidth={1.9}
              dot={false}
              animationDuration={MOTION.duration}
              animationEasing={MOTION.easing}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface HistogramBucket {
  bin: string;
  count: number;
  tail: boolean;
}

/**
 * The distribution of daily returns.
 *
 * The buckets below the fifth percentile are drawn apart, because the tail is
 * the part of this shape an analyst is looking for and reading it off a uniform
 * bar chart means counting.
 */
export function Histogram({ data }: { data: HistogramBucket[] }) {
  const renderTooltip = ({ active, payload }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as HistogramBucket | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={`${point.bin} %`}
        rows={[{ name: 'Días', value: String(point.count) }]}
        {...(point.tail ? { note: 'Cola inferior (5 %)' } : {})}
      />
    );
  };

  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 14, bottom: 4, left: 4 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="bin" minTickGap={26} {...AXIS} />
          <YAxis width={44} allowDecimals={false} {...AXIS} />
          <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
          <Bar dataKey="count" animationDuration={MOTION.duration} animationEasing={MOTION.easing}>
            {data.map((bucket) => (
              <Cell
                key={bucket.bin}
                fill={bucket.tail ? 'var(--up)' : 'var(--official)'}
                fillOpacity={bucket.tail ? 0.85 : 0.6}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface CandlePoint {
  period: string;
  open: number;
  close: number;
}

/**
 * Year-on-year change as candles.
 *
 * Each candle spans from the previous year's level to this one's, so its body
 * IS the annual change: tall means the series moved a lot, and the colour says
 * which way. A line answers "what was the level"; this answers "what did the
 * year do", which is the question an annual series is usually asked.
 *
 * Drawn rather than composed from a chart library's OHLC series, because what
 * is wanted here is two numbers a year and not a trading instrument.
 */
export function YearCandles({ data, unit }: { data: CandlePoint[]; unit: string }) {
  if (data.length < 2) {
    return <div className="callout">Se necesitan al menos dos años para comparar.</div>;
  }

  const width = 100;
  const height = 132;
  const values = data.flatMap((point) => [point.open, point.close]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const pad = 10;
  const scale = (value: number): number =>
    height - pad - ((value - low) / span) * (height - pad * 2);

  const step = width / data.length;
  const body = Math.max(step * 0.55, 0.6);

  return (
    <div className="candles">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img">
        <line x1="0" y1={height - pad} x2={width} y2={height - pad} className="candle-axis" />
        {data.map((point, index) => {
          const centre = step * (index + 0.5);
          const top = scale(Math.max(point.open, point.close));
          const bottom = scale(Math.min(point.open, point.close));
          const rising = point.close >= point.open;
          return (
            <g key={point.period} className={rising ? 'candle candle-up' : 'candle candle-down'}>
              <line x1={centre} y1={top} x2={centre} y2={bottom} className="candle-wick" />
              <rect
                x={centre - body / 2}
                y={top}
                width={body}
                height={Math.max(bottom - top, 0.8)}
                rx={0.4}
              />
            </g>
          );
        })}
      </svg>
      <div className="candle-foot">
        <span>{data[0]?.period}</span>
        <span className="candle-scale">
          {low.toLocaleString('es-BO', { maximumFractionDigits: 2 })} –{' '}
          {high.toLocaleString('es-BO', { maximumFractionDigits: 2 })} {unit}
        </span>
        <span>{data.at(-1)?.period}</span>
      </div>
    </div>
  );
}

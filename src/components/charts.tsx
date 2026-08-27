'use client';

import { useState } from 'react';
import { Icon } from './icons';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
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
  // Only the tick that opens a January carries the year. Marking every January
  // tick printed «ene '26» three times in a row on a zoomed axis, which reads
  // as a broken chart rather than as a year boundary.
  if (date.getUTCMonth() === 0 && date.getUTCDate() <= 10) {
    return `ene ’${String(date.getUTCFullYear()).slice(2)}`;
  }
  return dayMonth.format(date);
};
const number = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/**
 * Drag across a chart to zoom into those dates.
 *
 * Press anywhere on the plot and a line marks where you started; keep the
 * button down and it opens into a band that follows the pointer; let go and the
 * chart redraws to that stretch alone. It is the gesture a reader already knows
 * from every trading terminal, and it answers the question a fixed period
 * control cannot: "what happened between those two weeks in particular".
 *
 * The right button works as well as the left, because that is the one people
 * reach for, and the context menu is suppressed only while a drag is in
 * progress — a reader who right-clicks without dragging still gets their menu.
 *
 * A drag that covers fewer than two readings is treated as a click and clears
 * the zoom instead of setting one: pinching the chart to a single day would
 * leave nothing to look at and no obvious way back.
 */
export interface RangeZoom {
  /** The rows the chart should draw: the whole series, or the chosen stretch. */
  visible: <T>(rows: readonly T[]) => T[];
  /** Whether a stretch is currently chosen. */
  zoomed: boolean;
  /** The band being dragged right now, if any. */
  marking: { from: string; to: string } | null;
  /** The labels bounding the chosen stretch, for the caption. */
  bounds: { from: string; to: string } | null;
  begin: (label?: unknown) => void;
  drag: (label?: unknown) => void;
  finish: () => void;
  reset: () => void;
}

export function useRangeZoom(labels: readonly string[]): RangeZoom {
  const [anchor, setAnchor] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);

  const at = (label: string): number => labels.indexOf(label);

  return {
    zoomed: range !== null,
    bounds:
      range && labels[range[0]] && labels[range[1]]
        ? { from: labels[range[0]] as string, to: labels[range[1]] as string }
        : null,
    marking: anchor && cursor && anchor !== cursor ? { from: anchor, to: cursor } : null,
    visible: <T,>(rows: readonly T[]): T[] =>
      range ? rows.slice(range[0], range[1] + 1) : [...rows],
    begin: (label?: unknown) => {
      // The axis holds dates, but Recharts types the active label as a string
      // or a number; anything that is not one of our labels is ignored.
      if (typeof label !== 'string') return;
      setAnchor(label);
      setCursor(label);
    },
    drag: (label?: unknown) => {
      if (anchor && typeof label === 'string') setCursor(label);
    },
    finish: () => {
      if (anchor && cursor) {
        const edges = [at(anchor), at(cursor)].sort((left, right) => left - right);
        const low = edges[0] ?? -1;
        const high = edges[1] ?? -1;
        if (low >= 0 && high - low >= 2) {
          // Indices are into the labels of what is on screen, so a zoom inside
          // a zoom composes with the one already applied.
          setRange((held) => (held ? [held[0] + low, held[0] + high] : [low, high]));
        }
      }
      setAnchor(null);
      setCursor(null);
    },
    reset: () => setRange(null),
  };
}

/** The band a drag is painting, drawn over the series it is selecting. */
export function ZoomBand({ zoom }: { zoom: RangeZoom }) {
  if (!zoom.marking) return null;
  return (
    <ReferenceArea
      x1={zoom.marking.from}
      x2={zoom.marking.to}
      strokeOpacity={0.9}
      stroke="var(--ink-faint)"
      fill="var(--ink)"
      fillOpacity={0.08}
    />
  );
}

/** The way back out, shown only once there is somewhere to go back to. */
export function ZoomExit({
  zoom,
  format,
}: {
  zoom: RangeZoom;
  format?: (label: string) => string;
}) {
  if (!zoom.zoomed || !zoom.bounds) return null;
  const say = format ?? ((label: string) => label);
  return (
    <button type="button" className="zoom-exit" onClick={zoom.reset}>
      <Icon name="refrescar" size={13} />
      {say(zoom.bounds.from)} → {say(zoom.bounds.to)} · ver todo
    </button>
  );
}

/** Padding that keeps a line off the frame without inventing headroom. */
function fittedDomain(values: number[]): [number, number] {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return [0, 1];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const pad = Math.max((max - min) * 0.12, Math.abs(max) * 0.01, 0.02);
  return [Number((min - pad).toFixed(4)), Number((max + pad).toFixed(4))];
}

/**
 * The box a chart is drawn in, and the one place the context menu is refused.
 *
 * Readers reach for the right button to drag a range — it is what a trading
 * terminal trains them to do — and the browser answers with its own menu
 * instead. Suppressing it here, over the plot and nowhere else, lets either
 * button paint the band. Everywhere else on the page the menu still works,
 * including on the text and links inside these panels.
 */
function Frame({ children, tall }: { children: React.ReactElement; tall?: boolean }) {
  return (
    <div
      className={tall ? 'chart-frame chart-frame-tall' : 'chart-frame'}
      onContextMenu={(event) => event.preventDefault()}
    >
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
  const zoom = useRangeZoom(data.map((point) => point.date));
  const shown = zoom.visible(data);
  const domain = fittedDomain(
    shown.flatMap((point) =>
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
    <>
      <ZoomExit zoom={zoom} format={(label) => longDate.format(asDate(label))} />
      <Frame {...(tall ? { tall: true } : {})}>
        <ComposedChart
          data={shown}
          margin={{ top: 10, right: 14, bottom: 4, left: 4 }}
          onMouseDown={(event) => zoom.begin(event?.activeLabel)}
          onMouseMove={(event) => zoom.drag(event?.activeLabel)}
          onMouseUp={zoom.finish}
          onMouseLeave={zoom.finish}
        >
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
          <ZoomBand zoom={zoom} />
        </ComposedChart>
      </Frame>
    </>
  );
}

export function GapChart({ data, tall }: { data: GapChartPoint[]; tall?: boolean }) {
  const zoom = useRangeZoom(data.map((point) => point.date));
  const shown = zoom.visible(data);
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
    <>
      <ZoomExit zoom={zoom} format={(label) => longDate.format(asDate(label))} />
      <Frame {...(tall ? { tall: true } : {})}>
        <ComposedChart
          data={shown}
          margin={{ top: 10, right: 14, bottom: 4, left: 4 }}
          onMouseDown={(event) => zoom.begin(event?.activeLabel)}
          onMouseMove={(event) => zoom.drag(event?.activeLabel)}
          onMouseUp={zoom.finish}
          onMouseLeave={zoom.finish}
        >
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
          <ZoomBand zoom={zoom} />
        </ComposedChart>
      </Frame>
    </>
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
  const zoom = useRangeZoom(data.map((point) => point.period));
  const shown = zoom.visible(data);
  const domain = fittedDomain(shown.map((point) => point.value));
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
    <>
      <ZoomExit zoom={zoom} />
      <div
        className="chart-frame chart-frame-small"
        onContextMenu={(event) => event.preventDefault()}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={shown}
            margin={{ top: 8, right: 6, bottom: 0, left: 0 }}
            onMouseDown={(event) => zoom.begin(event?.activeLabel)}
            onMouseMove={(event) => zoom.drag(event?.activeLabel)}
            onMouseUp={zoom.finish}
            onMouseLeave={zoom.finish}
          >
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
            <ZoomBand zoom={zoom} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
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
  const zoom = useRangeZoom(data.map((point) => point.date));
  const shown = zoom.visible(data);
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
    <>
      <ZoomExit zoom={zoom} format={(label) => longDate.format(asDate(label))} />
      <div className={frameClass} onContextMenu={(event) => event.preventDefault()}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={shown}
            margin={{ top: 10, right: 14, bottom: 4, left: 4 }}
            onMouseDown={(event) => zoom.begin(event?.activeLabel)}
            onMouseMove={(event) => zoom.drag(event?.activeLabel)}
            onMouseUp={zoom.finish}
            onMouseLeave={zoom.finish}
          >
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
            <ZoomBand zoom={zoom} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
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
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) {
    return <div className="callout">Se necesitan al menos dos años para comparar.</div>;
  }

  const width = 1000;
  const height = 132;
  const values = data.flatMap((point) => [point.open, point.close]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const pad = 10;
  const scale = (value: number): number =>
    height - pad - ((value - low) / span) * (height - pad * 2);

  const step = width / data.length;
  const body = Math.min(step * 0.6, 20);
  const shown = hover === null ? null : data[hover];
  /*
   * The change the candle draws, stated as the reader reads it. A body is only
   * a length until it says how much: the percentage is what an economist quotes
   * and the points are what the axis shows, so the label carries both.
   */
  const move =
    shown && shown.open !== 0 ? ((shown.close - shown.open) / Math.abs(shown.open)) * 100 : null;

  return (
    <div className="candles">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        onMouseLeave={() => setHover(null)}
      >
        <line x1="0" y1={height - pad} x2={width} y2={height - pad} className="candle-axis" />
        {data.map((point, index) => {
          const centre = step * (index + 0.5);
          const top = scale(Math.max(point.open, point.close));
          const bottom = scale(Math.min(point.open, point.close));
          const rising = point.close >= point.open;
          return (
            <g
              key={point.period}
              className={rising ? 'candle candle-up' : 'candle candle-down'}
              onMouseEnter={() => setHover(index)}
            >
              {/* A full-height target: a two-pixel body is not something a
                  pointer can be expected to find. */}
              <rect
                x={centre - step / 2}
                y={0}
                width={step}
                height={height}
                className="candle-hit"
              />
              <line x1={centre} y1={top} x2={centre} y2={bottom} className="candle-wick" />
              <rect
                x={centre - body / 2}
                y={top}
                width={body}
                height={Math.max(bottom - top, 1.2)}
              />
              {hover === index ? (
                <rect
                  x={centre - step / 2}
                  y={0}
                  width={step}
                  height={height}
                  className="candle-lit"
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      {shown ? (
        <div className="candle-tip">
          <b>{shown.period}</b>
          <span className={move !== null && move >= 0 ? 'delta-up' : 'delta-down'}>
            {move === null
              ? '—'
              : `${move > 0 ? '+' : ''}${move.toLocaleString('es-BO', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })} %`}
          </span>
          <span className="candle-tip-detail">
            {number(shown.open, 2)} → {number(shown.close, 2)} {unit}
          </span>
        </div>
      ) : (
        <div className="candle-foot">
          <span>{data[0]?.period}</span>
          <span className="candle-scale">
            {low.toLocaleString('es-BO', { maximumFractionDigits: 2 })} –{' '}
            {high.toLocaleString('es-BO', { maximumFractionDigits: 2 })} {unit}
          </span>
          <span>{data.at(-1)?.period}</span>
        </div>
      )}
    </div>
  );
}

export interface DayCandle {
  date: string;
  /** Where the day started: the previous session's mid-point. */
  open: number;
  /** Where it ended: this session's mid-point. */
  close: number;
  /** The two sides the source published that day. */
  high: number;
  low: number;
}

/**
 * The parallel dollar as one candle per session.
 *
 * Built from exactly what the source publishes and nothing more. It quotes two
 * prices a day — the two sides it labels `buy` and `sell` — so the day's range
 * is those two, and the body runs from yesterday's mid-point to today's. That
 * is a real high, a real low and a real change, which is what a candle is for.
 *
 * It is NOT an intraday candle and the caption says so. A true one would need
 * the ticks inside the session and the observatory holds one reading a day;
 * drawing four numbers from a single quote and calling it OHLC would be an
 * invention dressed as a market chart.
 *
 * The wick is the published spread, so a day where the two sides diverged shows
 * a long wick — which is exactly when the parallel market is under strain.
 */
export function DayCandles({ data, unit }: { data: DayCandle[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) {
    return <div className="callout">Se necesitan al menos dos jornadas para comparar.</div>;
  }

  /*
   * A fixed drawing space, and a body that cannot become a slab.
   *
   * The box is stretched to whatever width the panel takes, so its own width
   * decides how much every horizontal length is magnified. Sizing it per candle
   * made that factor depend on how many there were: thirteen weekly candles
   * across a wide screen came out as hundred-pixel slabs wider than they were
   * tall, which is not a candle. A thousand units is close to the panel's real
   * width, so the stretch stays near 1:1, and the body is capped so a short
   * selection draws candles rather than blocks.
   */
  const width = 1000;
  const height = 260;
  const values = data.flatMap((point) => [point.high, point.low, point.open, point.close]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const pad = 14;
  const scale = (value: number): number =>
    height - pad - ((value - low) / span) * (height - pad * 2);

  const step = width / data.length;
  /** Square, like a real candle body: a rounded one is a pill at this size. */
  const body = step * 0.62;
  const shown = hover === null ? null : data[hover];
  const move = shown && shown.open !== 0 ? ((shown.close - shown.open) / shown.open) * 100 : null;

  return (
    <div className="candles">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        onMouseLeave={() => setHover(null)}
      >
        {data.map((point, index) => {
          const centre = step * (index + 0.5);
          const top = scale(Math.max(point.open, point.close));
          const bottom = scale(Math.min(point.open, point.close));
          const rising = point.close >= point.open;
          return (
            <g
              key={point.date}
              className={rising ? 'candle candle-up' : 'candle candle-down'}
              onMouseEnter={() => setHover(index)}
            >
              <rect
                x={centre - step / 2}
                y={0}
                width={step}
                height={height}
                className="candle-hit"
              />
              <line
                x1={centre}
                y1={scale(point.high)}
                x2={centre}
                y2={scale(point.low)}
                className="candle-wick"
              />
              <rect
                x={centre - body / 2}
                y={top}
                width={body}
                height={Math.max(bottom - top, 1.2)}
              />
              {hover === index ? (
                <rect
                  x={centre - step / 2}
                  y={0}
                  width={step}
                  height={height}
                  className="candle-lit"
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      {shown ? (
        <div className="candle-tip">
          <b>{shown.date}</b>
          <span className={move !== null && move >= 0 ? 'delta-up' : 'delta-down'}>
            {move === null
              ? '—'
              : `${move > 0 ? '+' : ''}${move.toLocaleString('es-BO', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} %`}
          </span>
          <span className="candle-tip-detail">
            apertura {number(shown.open, 4)} · cierre {number(shown.close, 4)} · rango{' '}
            {number(shown.low, 4)}/{number(shown.high, 4)} {unit}
          </span>
        </div>
      ) : (
        <div className="candle-foot">
          <span>{data[0]?.date}</span>
          <span className="candle-scale">
            {low.toLocaleString('es-BO', { maximumFractionDigits: 2 })} –{' '}
            {high.toLocaleString('es-BO', { maximumFractionDigits: 2 })} {unit}
          </span>
          <span>{data.at(-1)?.date}</span>
        </div>
      )}
    </div>
  );
}

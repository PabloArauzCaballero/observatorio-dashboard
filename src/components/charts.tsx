'use client';

import {
  Area,
  CartesianGrid,
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
 * The shape Recharts hands a custom tooltip.
 *
 * Parameterised with the library's own generics rather than narrowed to
 * `number`: the component accepts any value type, and pinning it tighter than
 * the library does makes the renderer unassignable to the `content` prop.
 */
type TooltipRender = TooltipContentProps<ValueType, NameType>;

/**
 * Charts for an analytical reader.
 *
 * Axes never start at zero for an exchange rate: a rate that moves from 9.6 to
 * 11.6 is a large move, and a zero baseline would flatten it into a straight
 * line. The rate scale is therefore fitted to the data and labelled as such.
 * The gap chart does keep its zero, because there parity is a real reference.
 */

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

const dayMonth = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short' });
const longDate = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const asDate = (value: string): Date => new Date(`${value}T12:00:00Z`);
const shortLabel = (value: string): string => dayMonth.format(asDate(value));
const number = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Padding that keeps the line off the frame without inventing headroom. */
function fittedDomain(values: number[]): [number, number] {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return [0, 1];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const pad = Math.max((max - min) * 0.12, 0.02);
  return [Number((min - pad).toFixed(2)), Number((max + pad).toFixed(2))];
}

const axis = {
  stroke: 'var(--ink-faint)',
  fontSize: 11,
  tickLine: false,
} as const;

function Frame({ children }: { children: React.ReactElement }) {
  return (
    <div className="chart-frame">
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
      <div className="t-date">{longDate.format(asDate(label))}</div>
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

export function RateChart({ data }: { data: RatePoint[] }) {
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
      { name: 'Paralelo compra', value: point?.parallelBuy },
      { name: 'Paralelo venta', value: point?.parallelSell },
      { name: 'Oficial', value: point?.official },
    ]
      .filter((row): row is { name: string; value: number } => typeof row.value === 'number')
      .map((row) => ({ name: row.name, value: `${number(row.value, 4)} Bs/USD` }));

    return (
      <TooltipShell
        label={label}
        rows={rows}
        {...(point?.archived ? { note: 'Promedio diario de archivo' } : {})}
      />
    );
  };

  return (
    <Frame>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="var(--rule-soft)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortLabel} minTickGap={44} {...axis} />
        <YAxis domain={domain} width={52} tickFormatter={(value) => number(value, 2)} {...axis} />
        <Tooltip content={renderTooltip} />
        <Line
          type="monotone"
          dataKey="parallelBuy"
          name="Paralelo compra"
          stroke="var(--parallel)"
          strokeWidth={1.9}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="parallelSell"
          name="Paralelo venta"
          stroke="var(--parallel)"
          strokeWidth={1.1}
          strokeDasharray="4 3"
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="official"
          name="Oficial"
          stroke="var(--official)"
          strokeWidth={1.9}
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </Frame>
  );
}

export function GapChart({ data }: { data: GapChartPoint[] }) {
  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length || typeof label !== 'string') return null;
    const point = payload[0]?.payload as GapChartPoint | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={label}
        rows={[{ name: 'Brecha', value: `${number(point.gapPercent, 2)} %` }]}
      />
    );
  };

  return (
    <Frame>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="var(--rule-soft)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortLabel} minTickGap={44} {...axis} />
        <YAxis width={52} tickFormatter={(value) => `${number(value, 1)}%`} {...axis} />
        <Tooltip content={renderTooltip} />
        {/* Parity is a real reference here, unlike on a rate axis. */}
        <ReferenceLine y={0} stroke="var(--ink-faint)" strokeDasharray="3 3" />
        <Area
          type="monotone"
          dataKey="gapPercent"
          name="Brecha"
          stroke="var(--gap)"
          fill="var(--gap)"
          fillOpacity={0.14}
          strokeWidth={1.9}
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
        label={label}
        rows={[{ name: 'Dispersión', value: `${number(point.spread, 4)} Bs` }]}
        {...(point.venues ? { note: `${point.venues} plazas cotizando` } : {})}
      />
    );
  };

  return (
    <Frame>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="var(--rule-soft)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortLabel} minTickGap={44} {...axis} />
        <YAxis width={52} tickFormatter={(value) => number(value, 2)} {...axis} />
        <Tooltip content={renderTooltip} />
        <Area
          type="monotone"
          dataKey="spread"
          name="Dispersión"
          stroke="var(--parallel)"
          fill="var(--parallel)"
          fillOpacity={0.12}
          strokeWidth={1.6}
        />
      </ComposedChart>
    </Frame>
  );
}

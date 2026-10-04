'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AXIS,
  BAR_CAP,
  ChartLegend,
  GRID,
  MOTION,
  STACK_GAP,
  TooltipShell,
  framed,
  type TooltipRender,
} from './charts';
import type { LegendItem } from './charts';
import { celda, useDatosDeFigura } from '@/components/ui/panel-data';

/**
 * Barras apiladas por año, con las partes que el lector eligió.
 *
 * Las otras barras del informe tienen tres partes fijas con nombre propio; aquí las partes
 * son series que cambian con el filtro —los impuestos, los rubros del gasto, los acreedores—,
 * así que cada una trae su clave, su nombre y su color. Apilado y no líneas porque la
 * pregunta es de composición: cuánto del total es cada parte, y cómo cambia el reparto.
 *
 * Un año incompleto lleva su marca en el rótulo del eje (`2026*`): el año en curso suma
 * siete meses, y una barra más baja que las otras sin decirlo se lee como una caída.
 */

export interface StackSeries {
  key: string;
  label: string;
  tone: string;
}

export interface StackRow {
  label: string;
  [key: string]: string | number | null;
}

export function StackedYearBars({
  data,
  series,
  format,
  tick,
  unit,
  height = 260,
  note,
}: {
  data: StackRow[];
  series: readonly StackSeries[];
  format: (value: number) => string;
  tick: (value: number) => string;
  /** La unidad en que están las barras, para el título de cada columna que se baja. */
  unit: string;
  height?: number;
  /** Una línea bajo el gráfico: qué significa la marca `*` u otra salvedad. */
  note?: string | undefined;
}) {
  useDatosDeFigura(
    () => ({
      unidad: unit,
      columnas: ['Periodo', ...series.map((one) => `${one.label} (${unit})`)],
      filas: data.map((row) => [row.label, ...series.map((one) => celda(row[one.key]))]),
      ...(note ? { nota: note } : {}),
    }),
    [data, series, unit, note],
  );
  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as StackRow | undefined;
    if (!point) return null;
    const rows = series
      .map((one) => ({ one, value: point[one.key] }))
      .filter(
        (entry): entry is { one: StackSeries; value: number } => typeof entry.value === 'number',
      );
    const total = rows.reduce((sum, entry) => sum + entry.value, 0);
    return (
      <TooltipShell
        label={String(label)}
        rows={[
          ...rows.map((entry) => ({
            name: entry.one.label,
            value: format(entry.value),
            color: entry.one.tone,
          })),
          { name: 'Total', value: format(total) },
        ]}
      />
    );
  };
  const legend: LegendItem[] = series.map((one) => ({ color: one.tone, label: one.label }));

  return (
    <div className="chart-stack">
      <div className="chart-frame" style={{ height: framed(height) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={14} {...AXIS} />
            <YAxis tickFormatter={tick} width={52} {...AXIS} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
            {series.map((one, position) => (
              <Bar
                key={one.key}
                dataKey={one.key}
                stackId="partes"
                fill={one.tone}
                maxBarSize={BAR_CAP * 2}
                {...(position === series.length - 1
                  ? { radius: [4, 4, 0, 0] as [number, number, number, number] }
                  : {})}
                {...STACK_GAP}
                animationDuration={position === 0 ? MOTION.duration : 0}
                animationEasing={MOTION.easing}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={legend} />
      {note ? <p className="chart-note">{note}</p> : null}
    </div>
  );
}

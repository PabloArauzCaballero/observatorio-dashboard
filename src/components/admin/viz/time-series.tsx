'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { dayShort, hourShort } from '@/components/admin/format';

export interface SeriesPoint {
  /** Instante ISO del balde, ya cortado en La Paz por el núcleo. */
  readonly x: string;
  readonly y: number;
}

export interface Series {
  readonly key: string;
  readonly label: string;
  /** Una variable CSS de serie (`var(--series-1)`), nunca un hex suelto. */
  readonly color: string;
  readonly points: readonly SeriesPoint[];
}

const MARGIN = { top: 10, right: 12, bottom: 26, left: 46 } as const;

const NUMBER = new Intl.NumberFormat('es-BO');
const LONG_DAY = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz',
  dateStyle: 'full',
});
const LONG_HOUR = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz',
  dateStyle: 'medium',
  timeStyle: 'short',
});

/**
 * Un paso «redondo» (1, 2, 5 × 10ⁿ) para que las marcas del eje caigan en cifras
 * que se leen: 0, 10, 20, 30, 40 y no 0, 13, 25, 38, 50.
 */
function niceStep(top: number): number {
  const rough = Math.max(top, 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / magnitude;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return Math.max(step * magnitude, 1);
}

/**
 * Una serie de tiempo, en líneas o en barras apiladas.
 *
 * Decisiones que no son de gusto:
 * - Un solo eje. Dos medidas de escala distinta son dos gráficos.
 * - Marcas finas: línea de 2 px, barras con el extremo redondeado de 4 px y una
 *   rendija de 2 px del color de la superficie entre tramos apilados.
 * - La leyenda está siempre, también con una sola serie: el color y la posición
 *   son los únicos canales que identifican una marca y los dos desaparecen al
 *   imprimir o en una captura recomprimida.
 * - Hay una vista como tabla, para quien no ve el gráfico y para copiar cifras.
 * - El color de cada serie es el de la entidad, no el de su posición: quitar
 *   una serie no repinta las demás.
 */
export function TimeSeries({
  series,
  kind,
  unit,
  granularity,
  title,
  description,
  height = 250,
}: {
  series: readonly Series[];
  kind: 'line' | 'stacked';
  /** Lo que se mide, en plural y minúscula: «vistas», «peticiones». */
  unit: string;
  granularity: 'day' | 'hour';
  title: string;
  description?: string;
  height?: number;
}) {
  const id = useId();
  const frame = useRef<HTMLElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // El SVG se dibuja al ancho real del contenedor: escalado desde un viewBox fijo,
  // los rótulos de 11 px salían de 7 px en un panel a media pantalla.
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const model = useMemo(() => {
    const xs = [...new Set(series.flatMap((entry) => entry.points.map((point) => point.x)))].sort();
    const lookup = series.map((entry) => new Map(entry.points.map((point) => [point.x, point.y])));
    const values = xs.map((x) => series.map((_, index) => lookup[index]?.get(x) ?? 0));
    const top =
      kind === 'stacked'
        ? Math.max(...values.map((row) => row.reduce((sum, value) => sum + value, 0)), 0)
        : Math.max(...values.flat(), 0);
    const step = niceStep(top);
    return { xs, values, step, max: Math.max(Math.ceil(top / step) * step, step) };
  }, [series, kind]);

  const { xs, values, step: tickStep, max } = model;
  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 80);
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const count = xs.length;
  const step = count > 1 ? plotWidth / (count - 1) : plotWidth;
  const bandWidth = plotWidth / Math.max(count, 1);
  const xOf = (index: number): number =>
    kind === 'stacked'
      ? MARGIN.left + bandWidth * index + bandWidth / 2
      : MARGIN.left + (count > 1 ? step * index : plotWidth / 2);
  const yOf = (value: number): number => MARGIN.top + plotHeight - (value / max) * plotHeight;

  const label = (x: string): string => (granularity === 'day' ? dayShort(x) : hourShort(x));
  const long = (x: string): string =>
    granularity === 'day' ? LONG_DAY.format(new Date(x)) : LONG_HOUR.format(new Date(x));

  const ticks = Array.from(
    { length: Math.round(max / tickStep) + 1 },
    (_, index) => index * tickStep,
  );
  const labelEvery = Math.max(1, Math.ceil(count / Math.max(Math.floor(plotWidth / 70), 2)));

  const onMove = (event: React.PointerEvent<SVGRectElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    const index =
      kind === 'stacked'
        ? Math.floor(ratio * count)
        : Math.round(ratio * (count > 1 ? count - 1 : 0));
    setHover(Math.min(Math.max(index, 0), count - 1));
  };

  const total = (row: readonly number[]): number => row.reduce((sum, value) => sum + value, 0);
  const grandTotal = values.reduce((sum, row) => sum + total(row), 0);

  if (count === 0) return null;

  return (
    <figure className="pg-chart" ref={frame} style={{ margin: 0 }}>
      <figcaption>
        <p className="pg-chart-title">{title}</p>
        {description ? <p className="pg-chart-sub">{description}</p> : null}
      </figcaption>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-labelledby={`${id}-t`}
        onPointerLeave={() => setHover(null)}
      >
        <title id={`${id}-t`}>
          {`${title}. ${NUMBER.format(grandTotal)} ${unit} entre ${label(xs[0] ?? '')} y ${label(xs[count - 1] ?? '')}.`}
        </title>

        <g className="pg-grid">
          {ticks.map((tick) => (
            <line
              key={tick}
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={yOf(tick)}
              y2={yOf(tick)}
            />
          ))}
        </g>
        <g className="pg-axis">
          {ticks.map((tick) => (
            <text key={tick} x={MARGIN.left - 8} y={yOf(tick) + 4} textAnchor="end">
              {NUMBER.format(Math.round(tick))}
            </text>
          ))}
          {xs.map((x, index) =>
            index % labelEvery === 0 ? (
              <text key={x} x={xOf(index)} y={height - 7} textAnchor="middle">
                {label(x)}
              </text>
            ) : null,
          )}
        </g>
        <line
          className="pg-axis-rule"
          x1={MARGIN.left}
          x2={width - MARGIN.right}
          y1={yOf(0)}
          y2={yOf(0)}
        />

        {kind === 'line' && count === 1
          ? series.map((entry, seriesIndex) => (
              <circle
                key={entry.key}
                cx={xOf(0)}
                cy={yOf(values[0]?.[seriesIndex] ?? 0)}
                r={5}
                strokeWidth={2}
                style={{ fill: entry.color, stroke: 'var(--chart-surface)' }}
              />
            ))
          : null}
        {kind === 'line' && count > 1
          ? series.map((entry, seriesIndex) => {
              const path = values
                .map(
                  (row, index) =>
                    `${index === 0 ? 'M' : 'L'}${xOf(index).toFixed(1)},${yOf(row[seriesIndex] ?? 0).toFixed(1)}`,
                )
                .join(' ');
              return (
                <path
                  key={entry.key}
                  d={path}
                  fill="none"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  style={{ stroke: entry.color }}
                />
              );
            })
          : null}
        {kind === 'stacked'
          ? values.map((row, index) => {
              const barWidth = Math.min(bandWidth * 0.68, 30);
              let base = 0;
              return (
                <g key={xs[index]}>
                  {row.map((value, seriesIndex) => {
                    if (value <= 0) return null;
                    const y1 = yOf(base + value);
                    const y0 = yOf(base);
                    base += value;
                    const heightPx = Math.max(y0 - y1 - 2, 1);
                    return (
                      <rect
                        key={series[seriesIndex]?.key}
                        x={xOf(index) - barWidth / 2}
                        y={y0 - heightPx - (seriesIndex === 0 ? 0 : 2)}
                        width={barWidth}
                        height={heightPx}
                        rx={3}
                        style={{ fill: series[seriesIndex]?.color }}
                      />
                    );
                  })}
                </g>
              );
            })
          : null}

        {hover !== null && xs[hover] !== undefined ? (
          <g pointerEvents="none">
            <line
              x1={xOf(hover)}
              x2={xOf(hover)}
              y1={MARGIN.top}
              y2={yOf(0)}
              style={{ stroke: 'var(--axis-rule)', strokeWidth: 1 }}
            />
            {kind === 'line'
              ? series.map((entry, seriesIndex) => (
                  <circle
                    key={entry.key}
                    cx={xOf(hover)}
                    cy={yOf(values[hover]?.[seriesIndex] ?? 0)}
                    r={4.5}
                    strokeWidth={2}
                    style={{ fill: entry.color, stroke: 'var(--chart-surface)' }}
                  />
                ))
              : null}
          </g>
        ) : null}

        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
        />
      </svg>

      {hover !== null && xs[hover] !== undefined ? (
        <div
          className="pg-tip"
          role="status"
          style={{
            left: `${Math.min(Math.max((xOf(hover) / width) * 100, 16), 84)}%`,
            top: '3.4rem',
          }}
        >
          <strong>{long(xs[hover])}</strong>
          {series.map((entry, seriesIndex) => (
            <div className="pg-tip-row" key={entry.key}>
              <span>
                <i className="pg-swatch" style={{ ['--swatch' as string]: entry.color }} />
                {entry.label}
              </span>
              <b>{NUMBER.format(values[hover]?.[seriesIndex] ?? 0)}</b>
            </div>
          ))}
          {kind === 'stacked' && series.length > 1 ? (
            <div className="pg-tip-row">
              <span>Total</span>
              <b>{NUMBER.format(total(values[hover] ?? []))}</b>
            </div>
          ) : null}
        </div>
      ) : null}

      <ul className="pg-legend">
        {series.map((entry) => (
          <li key={entry.key}>
            <i
              className="pg-swatch"
              data-line={kind === 'line'}
              style={{ ['--swatch' as string]: entry.color }}
            />
            {entry.label}
          </li>
        ))}
      </ul>

      <details className="pg-table-view">
        <summary>Ver como tabla</summary>
        <div className="admin-scroll" tabIndex={0} role="region" aria-label="Datos del gráfico">
          <table className="admin-table">
            <caption>{`${title} (${unit})`}</caption>
            <thead>
              <tr>
                <th scope="col">{granularity === 'day' ? 'Día' : 'Hora'}</th>
                {series.map((entry) => (
                  <th scope="col" className="num" key={entry.key}>
                    {entry.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...xs].reverse().map((x) => {
                const index = xs.indexOf(x);
                return (
                  <tr key={x}>
                    <td>{long(x)}</td>
                    {series.map((entry, seriesIndex) => (
                      <td className="num" key={entry.key}>
                        {NUMBER.format(values[index]?.[seriesIndex] ?? 0)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

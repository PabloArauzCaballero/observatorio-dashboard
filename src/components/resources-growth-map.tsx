'use client';

import { useState } from 'react';
import { ChartLegend } from './charts';
import type { LegendItem } from './charts';
import { celda, useDatosDeFigura } from '@/components/ui/panel-data';
import { additive } from '@/lib/choice';
import { WORLD_BOX, WORLD_POINTS, WORLD_SHAPES } from '@/lib/world-map';

/**
 * El mundo pintado por cuánto **cambió** lo que Bolivia le vende a cada país.
 *
 * Es el hermano de `WorldTradeMap`, que pinta el nivel con una rampa
 * secuencial. Una variación tiene signo, y una rampa de un solo color la
 * escondería; aquí cada país va en una de dos clases —compró más (o empezó a
 * comprar), compró menos (o dejó de comprar)— con los colores de signo que usan
 * las barras divergentes del informe (`--series-1` positivo, `--series-2`
 * negativo). El destino nuevo no lleva un tercer color: el tercero de la paleta
 * es un rojo, que en este informe se lee como alarma. Son clases y no una rampa a
 * propósito: un mapa de calor de porcentajes lo ganan los países chicos, que
 * pasan de 0,1 a 0,4 millones y «crecen 300 %». La magnitud está en el
 * emergente y en el ránking de crecimiento de al lado, que sólo cuenta los
 * destinos grandes.
 *
 * Mismo dibujo, mismas clases de CSS y mismo gesto que el mapa de nivel: cada
 * país con dato es un botón que entra al filtro de país (Ctrl/⌘ suma).
 */

export interface GrowthRow {
  token: string;
  members: readonly string[];
  iso3: string;
  label: string;
  now: number;
  before: number;
}

type Kind = 'up' | 'down';

const FILL: Record<Kind, string> = {
  up: 'var(--series-1)',
  down: 'var(--series-2)',
};

const NONE = 'var(--rule-soft)';
const DOT_RADIUS = 5;

const insideBox = (point: { y: number }): boolean =>
  point.y >= DOT_RADIUS && point.y <= WORLD_BOX.height - DOT_RADIUS;

const kindOf = (row: GrowthRow): Kind | null => {
  if (row.before > 0) return row.now >= row.before ? 'up' : 'down';
  return row.now > 0 ? 'up' : null;
};

const say = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export function ResourcesGrowthMap({
  rows,
  unit,
  year,
  label,
  picked,
  onPick,
  exact,
}: {
  rows: readonly GrowthRow[];
  unit: string;
  year: number;
  label: string;
  picked: ReadonlySet<string>;
  onPick: (token: string, additive: boolean) => void;
  exact: (value: number) => string;
}) {
  const [hover, setHover] = useState<{ name: string; said: string; x: number; y: number } | null>(
    null,
  );
  const byIso = new Map(
    rows.filter((row) => kindOf(row) !== null).map((row) => [row.iso3, row] as const),
  );

  useDatosDeFigura(
    () => ({
      etiqueta: 'Mapa de crecimiento',
      unidad: unit,
      columnas: [
        'País',
        `${year} (${unit})`,
        `${year - 1} (${unit})`,
        `Variación frente a ${year - 1} (%)`,
      ],
      filas: [...byIso.values()]
        .sort((left, right) => right.now - left.now)
        .map((row) => [
          row.label,
          celda(row.now),
          celda(row.before),
          row.before > 0 ? celda((row.now / row.before - 1) * 100) : null,
        ]),
    }),
    [rows, unit, year],
  );

  const counts = { up: 0, down: 0, fresh: 0 };
  for (const row of byIso.values()) {
    counts[kindOf(row) ?? 'up'] += 1;
    if (!(row.before > 0)) counts.fresh += 1;
  }
  const key: LegendItem[] = [
    {
      color: FILL.up,
      label: `Compró más que en ${year - 1}: ${counts.up} países${
        counts.fresh ? `, ${counts.fresh} de ellos nuevos` : ''
      }`,
    },
    { color: FILL.down, label: `Compró menos o dejó de comprar: ${counts.down} países` },
    { color: NONE, label: `Sin compras ni en ${year - 1} ni en ${year}` },
    { color: 'var(--panel-tint)', label: 'Bolivia (origen)' },
  ];

  const describe = (row: GrowthRow): string => {
    const change =
      row.before > 0
        ? `${row.now >= row.before ? '+' : ''}${say((row.now / row.before - 1) * 100, 1)} %`
        : 'destino nuevo';
    return `${change} (${exact(row.before)} → ${exact(row.now)} ${unit})`;
  };

  const isPicked = (row: GrowthRow): boolean => row.members.some((token) => picked.has(token));

  const handlers = (row: GrowthRow | undefined, name: string) => {
    const said = row ? describe(row) : `sin compras en ${year - 1} ni en ${year}`;
    const move = (event: React.MouseEvent) => {
      const frame = event.currentTarget.closest('.world-map-frame');
      if (!frame) return;
      const box = frame.getBoundingClientRect();
      setHover({
        name: row?.label ?? name,
        said,
        x: event.clientX - box.left,
        y: event.clientY - box.top,
      });
    };
    return {
      onMouseMove: move,
      onMouseLeave: () => setHover(null),
      ...(row
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-pressed': isPicked(row),
            'aria-label': `${row.label}: ${said}`,
            onClick: (event: React.MouseEvent) => onPick(row.token, additive(event)),
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPick(row.token, additive(event));
              }
            },
          }
        : { 'aria-hidden': true }),
    };
  };

  const classOf = (row: GrowthRow | undefined, iso3: string) =>
    [
      'world-country',
      row ? 'world-country-data' : '',
      row && isPicked(row) ? 'world-country-on' : '',
      iso3 === 'BOL' ? 'world-country-home' : '',
    ]
      .filter(Boolean)
      .join(' ');

  const fillOf = (row: GrowthRow | undefined): string => {
    const kind = row ? kindOf(row) : null;
    return kind ? FILL[kind] : NONE;
  };

  return (
    <div className="world-map">
      <div
        className="world-map-frame"
        style={{ aspectRatio: `${WORLD_BOX.width} / ${WORLD_BOX.height}` }}
      >
        <svg
          viewBox={`0 0 ${WORLD_BOX.width} ${WORLD_BOX.height}`}
          className="map-svg"
          role="group"
          aria-label={`Mapa del mundo: ${label}. Al seleccionar un país se añade al filtro.`}
        >
          {WORLD_SHAPES.map((shape) => {
            const row = byIso.get(shape.iso3);
            return (
              <g
                key={shape.iso3}
                className={classOf(row, shape.iso3)}
                {...handlers(row, shape.name)}
              >
                <path d={shape.path} style={{ fill: fillOf(row) }} />
              </g>
            );
          })}
          {WORLD_POINTS.filter((point) => byIso.has(point.iso3) && insideBox(point)).map(
            (point) => {
              const row = byIso.get(point.iso3);
              return (
                <g
                  key={point.iso3}
                  className={classOf(row, point.iso3)}
                  {...handlers(row, point.name)}
                >
                  <circle
                    cx={Math.min(Math.max(point.x, DOT_RADIUS), WORLD_BOX.width - DOT_RADIUS)}
                    cy={point.y}
                    r={DOT_RADIUS}
                    style={{ fill: fillOf(row) }}
                  />
                </g>
              );
            },
          )}
        </svg>
        {hover ? (
          <div
            className="tooltip world-map-tip"
            style={{ left: hover.x, top: hover.y }}
            aria-hidden="true"
          >
            <div className="t-date">{hover.name}</div>
            <div className="t-row">
              <strong>{hover.said}</strong>
            </div>
          </div>
        ) : null}
      </div>
      <ChartLegend items={key} />
    </div>
  );
}

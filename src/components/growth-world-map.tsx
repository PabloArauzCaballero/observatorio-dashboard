'use client';

import { useId, useState } from 'react';
import { ChartLegend } from './charts';
import type { LegendItem } from './charts';
import { celda, useDatosDeFigura } from '@/components/ui/panel-data';
import { additive } from '@/lib/choice';
import { WORLD_BOX, WORLD_POINTS, WORLD_SHAPES } from '@/lib/world-map';

/**
 * El mundo pintado por cuánto **cambió** el comercio de Bolivia con cada país.
 *
 * Es el hermano de `WorldTradeMap`, que pinta el nivel con una rampa
 * secuencial. Una variación tiene signo, y una rampa de un solo color la
 * escondería; aquí cada país va en una de dos clases —creció o cayó— con los
 * colores de signo que usan las barras divergentes del informe (`--series-1`
 * positivo, `--series-2` negativo). Son clases y no una rampa a propósito: un
 * mapa de calor de porcentajes lo ganan los países chicos, que pasan de 0,1 a
 * 0,4 millones y «crecen 300 %». La magnitud está en el emergente y en los
 * ránkings de al lado.
 *
 * El país que **aparece** (nada el año base, algo el año comparado) o que
 * **desaparece** no tiene variación: su porcentaje sería infinito o −100 %, y
 * pintarlo como un crecimiento más mentiría. Va rayado con el color de su signo
 * y con su propio renglón en la leyenda. No lleva un tercer color: el tercero de
 * la paleta es un rojo, que en este informe se lee como alarma.
 *
 * Mismo dibujo, mismas clases de CSS y mismo gesto que el mapa de nivel: cada
 * país con dato es un botón que entra al filtro de país (Ctrl/⌘ suma).
 *
 * Lo usan «Recursos naturales» (lo que se vende) y «Detalle aduanero» (lo que
 * se vende o se compra): cambia el vocabulario, no el dibujo.
 */

export interface GrowthRow {
  token: string;
  members: readonly string[];
  iso3: string;
  label: string;
  now: number;
  before: number;
}

/** Cómo se dice cada clase en el flujo que se dibuja. */
export interface GrowthWords {
  /** «Compró más», «Le vendió más a Bolivia». */
  more: string;
  /** «Compró menos», «Le vendió menos a Bolivia». */
  less: string;
  /** «Destino nuevo», «Origen nuevo». */
  fresh: string;
  /** «Dejó de comprar», «Dejó de venderle a Bolivia». */
  gone: string;
  /** «Sin compras», «Sin comercio declarado». */
  none: string;
}

export const EXPORT_WORDS: GrowthWords = {
  more: 'Compró más',
  less: 'Compró menos',
  fresh: 'Destino nuevo',
  gone: 'Dejó de comprar',
  none: 'Sin compras',
};

export const IMPORT_WORDS: GrowthWords = {
  more: 'Le vendió más a Bolivia',
  less: 'Le vendió menos a Bolivia',
  fresh: 'Origen nuevo',
  gone: 'Dejó de venderle a Bolivia',
  none: 'Sin ventas a Bolivia',
};

type Kind = 'up' | 'down' | 'fresh' | 'gone';

const TONE: Record<Kind, string> = {
  up: 'var(--series-1)',
  down: 'var(--series-2)',
  fresh: 'var(--series-1)',
  gone: 'var(--series-2)',
};

/** Rayado de la leyenda: el mismo que el patrón SVG del mapa. */
const hatch = (tone: string): string =>
  `repeating-linear-gradient(135deg, ${tone} 0 2px, var(--paper) 2px 4px)`;

const NONE = 'var(--rule-soft)';
const DOT_RADIUS = 5;

const insideBox = (point: { y: number }): boolean =>
  point.y >= DOT_RADIUS && point.y <= WORLD_BOX.height - DOT_RADIUS;

export const growthKind = (row: GrowthRow): Kind | null => {
  if (row.before > 0) {
    if (!(row.now > 0)) return 'gone';
    return row.now >= row.before ? 'up' : 'down';
  }
  return row.now > 0 ? 'fresh' : null;
};

const say = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** El mismo país en dos años; un país que sólo está en uno entra con cero en el otro. */
export function growthRows<
  T extends {
    token: string;
    members?: readonly string[];
    iso3: string;
    label: string;
    value: number;
  },
>(now: readonly T[], before: readonly T[]): GrowthRow[] {
  const prior = new Map(before.map((row) => [row.iso3, row]));
  const rows: GrowthRow[] = now.map((row) => ({
    token: row.token,
    members: [
      ...new Set([...(row.members ?? [row.token]), ...(prior.get(row.iso3)?.members ?? [])]),
    ],
    iso3: row.iso3,
    label: row.label,
    now: row.value,
    before: prior.get(row.iso3)?.value ?? 0,
  }));
  const seen = new Set(now.map((row) => row.iso3));
  for (const row of before) {
    if (seen.has(row.iso3)) continue;
    rows.push({
      token: row.token,
      members: row.members ?? [row.token],
      iso3: row.iso3,
      label: row.label,
      now: 0,
      before: row.value,
    });
  }
  return rows;
}

export function GrowthWorldMap({
  rows,
  unit,
  year,
  base,
  label,
  words,
  absent,
  picked,
  onPick,
  exact,
}: {
  rows: readonly GrowthRow[];
  unit: string;
  /** El año que se compara. */
  year: number;
  /** El año contra el que se compara; por defecto, el anterior. */
  base?: number;
  label: string;
  words: GrowthWords;
  /**
   * Qué significa el gris cuando no es «sin comercio»: en Comtrade, que sólo
   * publica los veinte primeros socios, es «fuera de los publicados».
   */
  absent?: string;
  picked: ReadonlySet<string>;
  onPick: (token: string, additive: boolean) => void;
  exact: (value: number) => string;
}) {
  const [hover, setHover] = useState<{
    name: string;
    said: string;
    x: number;
    y: number;
    /** En la mitad derecha el emergente se abre hacia la izquierda: si no, se corta. */
    flip: boolean;
  } | null>(null);
  const from = base ?? year - 1;
  /* Dos mapas en la misma página no pueden compartir el id de su rayado. */
  const hatchId = `rayado${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const byIso = new Map(
    rows.filter((row) => growthKind(row) !== null).map((row) => [row.iso3, row] as const),
  );

  useDatosDeFigura(
    () => ({
      etiqueta: 'Mapa de crecimiento',
      unidad: unit,
      columnas: [
        'País',
        `${year} (${unit})`,
        `${from} (${unit})`,
        `Variación frente a ${from} (%)`,
        'Clase',
      ],
      filas: [...byIso.values()]
        .sort((left, right) => right.now - left.now)
        .map((row) => {
          const kind = growthKind(row);
          return [
            row.label,
            celda(row.now),
            celda(row.before),
            kind === 'up' || kind === 'down' ? celda((row.now / row.before - 1) * 100) : null,
            kind === 'fresh' ? words.fresh : kind === 'gone' ? words.gone : null,
          ];
        }),
    }),
    [rows, unit, year, from, words],
  );

  const counts: Record<Kind, number> = { up: 0, down: 0, fresh: 0, gone: 0 };
  for (const row of byIso.values()) counts[growthKind(row) ?? 'up'] += 1;
  const many = (count: number) => `${count} ${count === 1 ? 'país' : 'países'}`;
  const key: LegendItem[] = [
    { color: TONE.up, label: `${words.more} que en ${from}: ${many(counts.up)}` },
    { color: TONE.down, label: `${words.less} que en ${from}: ${many(counts.down)}` },
    ...(counts.fresh
      ? [
          {
            color: hatch(TONE.fresh),
            label: `${words.fresh} (nada en ${from}): ${many(counts.fresh)}`,
          },
        ]
      : []),
    ...(counts.gone
      ? [
          {
            color: hatch(TONE.gone),
            label: `${words.gone} (nada en ${year}): ${many(counts.gone)}`,
          },
        ]
      : []),
    { color: NONE, label: absent ?? `${words.none} ni en ${from} ni en ${year}` },
    { color: 'var(--panel-tint)', label: 'Bolivia' },
  ];

  const describe = (row: GrowthRow): string => {
    const kind = growthKind(row);
    const change =
      kind === 'fresh'
        ? words.fresh.toLowerCase()
        : kind === 'gone'
          ? words.gone.toLowerCase()
          : `${row.now >= row.before ? '+' : ''}${say((row.now / row.before - 1) * 100, 1)} %`;
    return `${change} (${from}: ${exact(row.before)} → ${year}: ${exact(row.now)} ${unit})`;
  };

  const isPicked = (row: GrowthRow): boolean => row.members.some((token) => picked.has(token));

  const handlers = (row: GrowthRow | undefined, name: string) => {
    const said = row
      ? describe(row)
      : (absent?.toLowerCase() ?? `${words.none.toLowerCase()} en ${from} ni en ${year}`);
    const move = (event: React.MouseEvent) => {
      const frame = event.currentTarget.closest('.world-map-frame');
      if (!frame) return;
      const box = frame.getBoundingClientRect();
      setHover({
        name: row?.label ?? name,
        said,
        x: event.clientX - box.left,
        y: event.clientY - box.top,
        flip: event.clientX - box.left > box.width / 2,
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
    const kind = row ? growthKind(row) : null;
    if (!kind) return NONE;
    if (kind === 'fresh') return `url(#${hatchId}-up)`;
    if (kind === 'gone') return `url(#${hatchId}-down)`;
    return TONE[kind];
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
          <defs>
            {(
              [
                [`${hatchId}-up`, TONE.fresh],
                [`${hatchId}-down`, TONE.gone],
              ] as const
            ).map(([id, tone]) => (
              <pattern
                key={id}
                id={id}
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="4" height="4" style={{ fill: 'var(--paper)' }} />
                <rect width="2" height="4" style={{ fill: tone }} />
              </pattern>
            ))}
          </defs>
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
            style={{
              left: hover.x,
              top: hover.y,
              ...(hover.flip ? { transform: 'translate(calc(-100% - 12px), -110%)' } : {}),
            }}
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

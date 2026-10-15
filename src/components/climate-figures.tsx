'use client';

import { ChartLegend } from './charts';
import type { LegendItem } from './charts';
import { DEPARTMENTS as SHAPES, MAP_BOX, PLACE_POINTS } from '@/lib/bolivia-map';
import { formatNumber, signed, type Polarity } from '@/lib/climate-board';

/**
 * Las dos figuras propias de «Clima y ambiente»: el mapa de diferencias y las
 * rayas de cada año.
 *
 * El mapa departamental del tablero (`DepartmentsMap`) pinta magnitudes con una
 * rampa de un solo tono que arranca en cero. Una diferencia con lo normal no es
 * una magnitud: tiene signo, y el signo es la noticia —más cálido o más frío,
 * más lluvia o menos—. Pintarla con un solo tono hace que «un poco más frío» y
 * «mucho más cálido» se lean como dos grados del mismo azul. Por eso aquí el
 * mapa reutiliza los mismos contornos (`bolivia-map.ts`) y las mismas clases,
 * pero colorea con dos polos: el cálido del informe (`--up`) y el frío
 * (`--down`), en tres pasos opacos cada uno, mezclados con el papel del panel
 * (nunca con transparente: el tono no debe cambiar según lo que tenga debajo).
 *
 * Qué polo toca a un valor positivo lo decide la variable: más temperatura,
 * más fuego o más humo van al cálido; más lluvia, más humedad o más helada, al
 * frío. Es la convención de los mapas de anomalías del clima.
 */

const MAP_MIX = [22, 50, 100] as const;
const STRIPE_MIX = [16, 38, 66, 100] as const;

const pole = (value: number, polarity: Polarity): string =>
  value >= 0 === (polarity === 'warm') ? 'var(--up)' : 'var(--down)';

const mix = (tone: string, share: number): string =>
  share >= 100 ? tone : `color-mix(in srgb, ${tone} ${share}%, var(--panel))`;

/** La sigla de placa de cada departamento, como en el mapa departamental. */
const INITIALS: Record<string, string> = {
  CHUQUISACA: 'CH',
  LA_PAZ: 'LP',
  COCHABAMBA: 'CB',
  ORURO: 'OR',
  POTOSI: 'PT',
  TARIJA: 'TJ',
  SANTA_CRUZ: 'SC',
  BENI: 'BE',
  PANDO: 'PD',
};

const CENTRE = new Map(
  PLACE_POINTS.filter((point) => point.kind === 'departamento').map((point) => [point.code, point]),
);

/** La rampa de magnitud del informe, la misma del mapa departamental. */
const SEQUENTIAL = [
  { fill: 'var(--seq-200)', ink: 'var(--seq-ink-1)' },
  { fill: 'var(--seq-300)', ink: 'var(--seq-ink-2)' },
  { fill: 'var(--seq-400)', ink: 'var(--seq-ink-3)' },
  { fill: 'var(--seq-500)', ink: 'var(--seq-ink-4)' },
  { fill: 'var(--seq-600)', ink: 'var(--seq-ink-5)' },
] as const;

const NONE = { fill: 'var(--rule-soft)', ink: 'var(--ink-soft)' } as const;

const short = (value: number, decimals: number, withSign: boolean): string => {
  const big = Math.abs(value) >= 10_000;
  const text = big ? `${formatNumber(value / 1_000, 0)} mil` : formatNumber(value, decimals);
  if (!withSign) return text;
  if (big) return `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value) / 1_000, 0)} mil`;
  return signed(value, decimals);
};

export interface ClimateReading {
  code: string;
  name: string;
  value: number | null;
}

export function ClimateMap({
  readings,
  label,
  unit,
  decimals,
  diverging,
  polarity,
  chosen,
  onPick,
}: {
  readings: readonly ClimateReading[];
  label: string;
  unit: string;
  decimals: number;
  /** Diferencias con signo (dos polos) o magnitudes (una rampa). */
  diverging: boolean;
  polarity: Polarity;
  chosen: ReadonlySet<string>;
  onPick: (code: string, additive: boolean) => void;
}) {
  const byCode = new Map(readings.map((reading) => [reading.code, reading.value]));
  const values = readings
    .map((reading) => reading.value)
    .filter((value): value is number => value !== null);
  const peak = values.length ? Math.max(...values.map((value) => Math.abs(value))) : 0;
  const high = values.length ? Math.max(...values) : 0;
  const low = values.length ? Math.min(...values) : 0;

  const paint = (value: number | null): { fill: string; ink: string } => {
    if (value === null) return NONE;
    if (diverging) {
      if (peak <= 0) return { fill: mix('var(--up)', MAP_MIX[0]), ink: 'var(--ink)' };
      const ratio = Math.abs(value) / peak;
      const step = ratio <= 1 / 3 ? 0 : ratio <= 2 / 3 ? 1 : 2;
      return {
        fill: mix(pole(value, polarity), MAP_MIX[step]),
        ink: step === 2 ? 'var(--paper)' : 'var(--ink)',
      };
    }
    if (high <= low) return SEQUENTIAL[2];
    const index = Math.floor(((value - low) / (high - low)) * SEQUENTIAL.length);
    return SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.max(0, index))] ?? SEQUENTIAL[0];
  };

  const fmt = (value: number) => short(value, decimals, diverging);
  /* De lo más negativo a lo más positivo, en tercios del mayor apartamiento. */
  const bounds = [-3, -2, -1, 0, 1, 2, 3].map((k) => (k * peak) / 3);
  const key: LegendItem[] = diverging
    ? peak > 0
      ? bounds.slice(0, -1).map((from, index) => {
          const to = bounds[index + 1] ?? from;
          return {
            color: paint((from + to) / 2).fill,
            label: `${fmt(from)} a ${fmt(to)}${index === 5 ? ` ${unit}` : ''}`,
          };
        })
      : [{ color: mix('var(--up)', MAP_MIX[0]), label: `Sin diferencia (0 ${unit})` }]
    : high > low
      ? SEQUENTIAL.map((step, index) => {
          const span = (high - low) / SEQUENTIAL.length;
          return {
            color: step.fill,
            label: `${fmt(low + span * index)} a ${fmt(low + span * (index + 1))} ${unit}`,
          };
        })
      : [{ color: SEQUENTIAL[2].fill, label: `${fmt(high)} ${unit}` }];
  if (values.length < readings.length) key.push({ color: NONE.fill, label: 'Sin dato' });

  return (
    <div className="choro-map">
      <div
        className="map-frame map-frame-compact"
        style={{
          aspectRatio: `${MAP_BOX.width} / ${MAP_BOX.height}`,
          ['--map-aspect' as string]: String(MAP_BOX.width / MAP_BOX.height),
        }}
      >
        <svg
          viewBox={`0 0 ${MAP_BOX.width} ${MAP_BOX.height}`}
          className="map-svg"
          role="group"
          aria-label={`Mapa de Bolivia: ${label} por departamento. Al seleccionar un departamento se filtran los gráficos de abajo.`}
        >
          {SHAPES.map((shape) => {
            const value = byCode.get(shape.code) ?? null;
            const step = paint(value);
            const on = chosen.has(shape.code);
            const said =
              value === null
                ? 'sin dato'
                : `${diverging ? signed(value, decimals) : formatNumber(value, decimals)} ${unit}`;
            return (
              <g
                key={shape.code}
                className={on ? 'choro choro-on' : 'choro'}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={`${shape.name}: ${said}`}
                onClick={(event) =>
                  onPick(shape.code, event.ctrlKey || event.metaKey || event.shiftKey)
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onPick(shape.code, event.ctrlKey || event.metaKey || event.shiftKey);
                  }
                }}
              >
                <path d={shape.path} className="choro-shape" style={{ fill: step.fill }} />
              </g>
            );
          })}
          <g aria-hidden="true">
            {SHAPES.map((shape) => {
              const value = byCode.get(shape.code) ?? null;
              const step = paint(value);
              const centre = CENTRE.get(shape.code);
              if (!centre) return null;
              return (
                <g key={shape.code}>
                  <text
                    className="choro-initials"
                    x={centre.x}
                    y={centre.y - 10}
                    style={{ fill: step.ink }}
                  >
                    {INITIALS[shape.code] ?? shape.name.slice(0, 2).toLocaleUpperCase('es')}
                  </text>
                  <text
                    className="choro-value"
                    x={centre.x}
                    y={centre.y + 20}
                    style={{ fill: step.ink }}
                  >
                    {value === null ? '—' : fmt(value)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <ChartLegend items={key} />
    </div>
  );
}

/**
 * Las rayas del clima: un año por raya, un departamento por fila.
 *
 * Es la figura de Ed Hawkins (las «warming stripes»): sin ejes ni números, cada
 * año pintado por cuánto se apartó de lo normal. Se lee de izquierda a derecha y
 * lo que dice es la deriva: si el rojo se acumula a la derecha, los años
 * recientes son los distintos. Una fila por departamento deja comparar en el
 * mismo golpe de vista el altiplano con los llanos. La cifra de cada raya está en
 * su rótulo emergente y en la descarga.
 */
export interface StripeRow {
  code: string;
  name: string;
  cells: ReadonlyArray<{ year: number; anomaly: number | null }>;
}

export function ClimateStripes({
  rows,
  years,
  unit,
  decimals,
  polarity,
}: {
  rows: readonly StripeRow[];
  years: readonly number[];
  unit: string;
  decimals: number;
  polarity: Polarity;
}) {
  const values = rows.flatMap((row) =>
    row.cells.map((cell) => cell.anomaly).filter((value): value is number => value !== null),
  );
  const peak = values.length ? Math.max(...values.map((value) => Math.abs(value))) : 0;
  const step = (value: number): number => {
    if (peak <= 0) return 0;
    const ratio = Math.abs(value) / peak;
    return Math.min(STRIPE_MIX.length - 1, Math.floor(ratio * STRIPE_MIX.length));
  };
  const fillOf = (value: number | null): string =>
    value === null
      ? 'var(--rule-soft)'
      : mix(pole(value, polarity), STRIPE_MIX[step(value)] ?? 100);

  /* Ocho tramos, de lo más negativo a lo más positivo. */
  const n = STRIPE_MIX.length;
  const bounds = Array.from({ length: 2 * n + 1 }, (_, i) => ((i - n) * peak) / n);
  const key: LegendItem[] =
    peak > 0
      ? bounds.slice(0, -1).map((from, index) => {
          const to = bounds[index + 1] ?? from;
          return {
            color: fillOf((from + to) / 2),
            label: `${signed(from, decimals)} a ${signed(to, decimals)}${index === 2 * n - 1 ? ` ${unit}` : ''}`,
          };
        })
      : [{ color: fillOf(0), label: `Sin diferencia (0 ${unit})` }];
  if (values.length < rows.length * years.length)
    key.push({ color: 'var(--rule-soft)', label: 'Sin dato' });

  const first = years[0];
  const last = years.at(-1);
  const middle = years[Math.floor(years.length / 2)];

  return (
    <div className="clima-stripes">
      {rows.map((row) => (
        <div className="clima-stripes-row" key={row.code}>
          <span className="clima-stripes-name">{row.name}</span>
          <svg
            className="clima-stripes-bar"
            viewBox={`0 0 ${Math.max(1, years.length)} 1`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${row.name}: diferencia de cada año con lo normal, de ${first ?? ''} a ${last ?? ''}`}
          >
            {row.cells.map((cell, index) => (
              <rect
                key={cell.year}
                x={index}
                y={0}
                width={1.02}
                height={1}
                style={{ fill: fillOf(cell.anomaly) }}
              >
                <title>
                  {`${row.name} · ${cell.year}: ${
                    cell.anomaly === null ? 'sin dato' : `${signed(cell.anomaly, decimals)} ${unit}`
                  }`}
                </title>
              </rect>
            ))}
          </svg>
        </div>
      ))}
      <div className="clima-stripes-row clima-stripes-axis" aria-hidden="true">
        <span />
        <span className="clima-stripes-years">
          <span>{first}</span>
          <span>{middle}</span>
          <span>{last}</span>
        </span>
      </div>
      <ChartLegend items={key} />
    </div>
  );
}

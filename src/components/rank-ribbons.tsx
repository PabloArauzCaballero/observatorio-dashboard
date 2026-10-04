'use client';

import { useEffect, useRef, useState } from 'react';
import { ChartLegend } from './charts';
import styles from './rank-ribbons.module.css';

/**
 * El puesto de cada nombre de un ránking, periodo a periodo: una cinta por nombre.
 *
 * Periodos en la horizontal y puesto en la vertical, el primero arriba, para que
 * se lea quién sube, quién cae y quién se sostiene. Pasan por los diez primeros
 * muchos más de diez nombres, así que las cintas van todas en gris y sólo una se
 * pinta —la que se señala o la elegida—: veinte colores no se distinguen entre
 * sí. El nombre va escrito al final de cada cinta que llega al último periodo;
 * el resto se lee al pasar por encima. Un periodo fuera de los primeros corta la
 * cinta: no se une un puesto con el de dos periodos después como si hubiera
 * estado ahí.
 *
 * Los periodos son los publicados, no los del calendario: Merco no tiene
 * edición 2025 y su 2024 sigue a su 2026 sin hueco, porque no faltó nadie.
 */

const ROW = 30;
const TOP_PAD = 14;
const AXIS = 30;
const LEFT = 40;

export interface RibbonPoint {
  period: number;
  rank: number;
}

export interface RibbonSeries {
  key: string;
  name: string;
  points: readonly RibbonPoint[];
}

interface Hover {
  key: string;
  period: number;
  x: number;
  y: number;
}

/**
 * «Yascara Vanessa Zuazo Batchelder» → «Yascara Zuazo»: el nombre y el primer
 * apellido. Algunos registros vienen en mayúsculas y con los apellidos primero
 * («BEDOYA BALLIVIAN RENE FERNANDO»): ahí no se sabe dónde empieza el nombre,
 * así que van los dos apellidos, en minúsculas con inicial.
 */
export function shortPersonName(name: string): string {
  const words = name.trim().split(/\s+/u);
  if (name === name.toLocaleUpperCase('es') && words.length >= 2) {
    return words
      .slice(0, 2)
      .map((word) => word.charAt(0) + word.slice(1).toLocaleLowerCase('es'))
      .join(' ');
  }
  if (words.length >= 4) return `${words[0]} ${words[2]}`;
  if (words.length === 3) return `${words[0]} ${words[1]}`;
  return name;
}

/** Un nombre de empresa que cabe al final de la cinta: sin la forma societaria y recortado. */
export function shortCompanyName(name: string): string {
  const bare = name
    .replace(/\s*\((?:[^)]*)\)\s*$/u, '')
    .replace(
      /[\s,.-]+(S\.?\s?A\.?\s?M\.?|S\.?\s?A\.?|S\.?\s?R\.?\s?L\.?|LTDA\.?|S\.?\s?A\.?\s?C\.?)$/iu,
      '',
    )
    .trim();
  return bare.length > 26 ? `${bare.slice(0, 25).trimEnd()}…` : bare;
}

export function RankRibbons({
  series,
  periods,
  places,
  selected,
  onSelect,
  label = String,
  shorten = (name: string) => name,
  describe,
  subject,
  highlight,
  others,
}: {
  series: readonly RibbonSeries[];
  /** Los periodos publicados, del más viejo al más nuevo. */
  periods: readonly number[];
  /** Cuántos puestos se dibujan. */
  places: number;
  selected: string | null;
  onSelect: (key: string, period: number) => void;
  /** Cómo se escribe un periodo en el eje («2025-26» para Merco). */
  label?: (period: number) => string;
  /** El nombre corto que va al final de la cinta. */
  shorten?: (name: string) => string;
  /** Las líneas de la ficha flotante, debajo de «periodo: puesto». */
  describe?: (key: string, period: number) => ReadonlyArray<string>;
  /** Qué es cada cinta, para el lector de pantalla: «empresa», «empresario». */
  subject: string;
  /** El rótulo de la cinta en color mientras no hay ninguna elegida: «Empresa resaltada». */
  highlight: string;
  /** El rótulo de las cintas grises en la leyenda: «Las demás empresas». */
  others: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const first = periods[0];
  const last = periods.at(-1);
  if (first === undefined || last === undefined) return null;
  const index = new Map(periods.map((period, at) => [period, at]));

  const wide = width >= 640;
  const right = wide ? 200 : 14;
  const height = TOP_PAD + places * ROW + AXIS;
  const x = (period: number): number =>
    LEFT +
    (periods.length === 1
      ? 0
      : ((index.get(period) ?? 0) / (periods.length - 1)) * (width - LEFT - right));
  const y = (rank: number): number => TOP_PAD + (rank - 0.5) * ROW;
  const column = (width - LEFT - right) / Math.max(1, periods.length - 1);
  const step = Math.max(1, Math.ceil(38 / column));
  // Con columnas angostas (el móvil) la cinta de seis píxeles tapaba a la vecina.
  const thin = column < 32;

  const shown = series
    .map((one) => ({
      one,
      points: one.points
        .filter((point) => point.rank <= places && index.has(point.period))
        .sort((a, b) => (index.get(a.period) ?? 0) - (index.get(b.period) ?? 0)),
    }))
    .filter((entry) => entry.points.length > 0);
  const active = hover?.key ?? selected;

  /** Tramos de periodos seguidos dentro de los puestos dibujados: un hueco corta la cinta. */
  const path = (points: readonly RibbonPoint[]): string => {
    let d = '';
    points.forEach((point, at) => {
      const previous = points[at - 1];
      const px = x(point.period);
      const py = y(point.rank);
      if (!previous || (index.get(previous.period) ?? -2) !== (index.get(point.period) ?? 0) - 1) {
        d += `M${px},${py}`;
        return;
      }
      const qx = x(previous.period);
      const qy = y(previous.rank);
      const half = (px - qx) / 2;
      d += `C${qx + half},${qy} ${px - half},${py} ${px},${py}`;
    });
    return d;
  };

  const hovered = hover ? series.find((one) => one.key === hover.key) : undefined;
  const hoveredPoint = hovered?.points.find((point) => point.period === hover?.period);
  const activeSeries = series.find((one) => one.key === active);

  const ribbon = ({ one, points }: (typeof shown)[number]) => {
    const on = one.key === active;
    const d = path(points);
    return (
      <g key={one.key} className={on ? styles.on : styles.off}>
        {on ? <path d={d} className={styles.halo} /> : null}
        <path d={d} className={styles.ribbon} />
        {points.map((point) => (
          <circle
            key={point.period}
            cx={x(point.period)}
            cy={y(point.rank)}
            r={on ? (thin ? 3.5 : 5) : thin ? 2 : 3.5}
            className={styles.dot}
          />
        ))}
        {/* Lo que se toca: más ancho que la cinta, para no tener que apuntar fino. */}
        <path
          d={d}
          className={styles.hit}
          onClick={() => onSelect(one.key, points.at(-1)?.period ?? last)}
        />
        {points.map((point) => (
          <circle
            key={`hit-${point.period}`}
            cx={x(point.period)}
            cy={y(point.rank)}
            r={12}
            className={styles.hitDot}
            onMouseEnter={() =>
              setHover({ key: one.key, period: point.period, x: x(point.period), y: y(point.rank) })
            }
            onClick={() => onSelect(one.key, point.period)}
          />
        ))}
      </g>
    );
  };

  return (
    <div className={thin ? `${styles.wrap} ${styles.thin}` : styles.wrap}>
      <div ref={frame} className={styles.frame} onMouseLeave={() => setHover(null)}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Puesto de cada ${subject} entre los ${places} primeros, ${label(first)}–${label(last)}`}
        >
          {Array.from({ length: places }, (_, at) => at + 1).map((rank) => (
            <g key={rank}>
              <line
                x1={LEFT}
                x2={width - right}
                y1={y(rank)}
                y2={y(rank)}
                className={styles.grid}
              />
              <text x={LEFT - 10} y={y(rank)} className={styles.rank}>
                {rank}.º
              </text>
            </g>
          ))}
          {periods.map((period, at) =>
            at % step === 0 || period === last ? (
              <text key={period} x={x(period)} y={height - 8} className={styles.year}>
                {label(period)}
              </text>
            ) : null,
          )}
          {shown.filter((entry) => entry.one.key !== active).map(ribbon)}
          {shown.filter((entry) => entry.one.key === active).map(ribbon)}
          {wide
            ? shown
                .filter((entry) => entry.points.at(-1)?.period === last)
                .map(({ one, points }) => {
                  const end = points.at(-1);
                  if (!end) return null;
                  return (
                    <text
                      key={`name-${one.key}`}
                      x={x(last) + 12}
                      y={y(end.rank)}
                      className={one.key === active ? styles.nameOn : styles.name}
                      onClick={() => onSelect(one.key, last)}
                    >
                      <title>{one.name}</title>
                      {shorten(one.name)}
                    </text>
                  );
                })
            : null}
        </svg>
        {hover && hovered && hoveredPoint ? (
          <div
            className={styles.tip}
            style={{
              // Cerca del borde derecho la ficha va a la izquierda del punto, para no tapar la cinta.
              left: hover.x + 234 > width ? Math.max(0, hover.x - 224) : hover.x + 14,
              top: Math.max(0, hover.y - 12),
            }}
          >
            <strong>{hovered.name}</strong>
            <span>
              {label(hoveredPoint.period)}: {hoveredPoint.rank}.º
            </span>
            {(describe?.(hovered.key, hoveredPoint.period) ?? []).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        ) : null}
      </div>
      <ChartLegend
        items={[
          {
            color: 'var(--official)',
            label: activeSeries ? `En color: ${activeSeries.name}` : highlight,
            shape: 'line',
          },
          { color: 'var(--ribbon-rest)', label: others, shape: 'line' },
        ]}
      />
    </div>
  );
}

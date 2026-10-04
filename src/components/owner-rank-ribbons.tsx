'use client';

import { useEffect, useRef, useState } from 'react';
import { ChartLegend } from './charts';
import styles from './owner-rank-ribbons.module.css';
import type { OwnerHistory } from '@/lib/business-owners-board';

/**
 * El puesto de cada empresario año a año: una cinta por persona.
 *
 * Años en la horizontal y puesto en la vertical, el primero arriba, para que
 * se lea quién sube, quién cae y quién se sostiene. Son catorce personas, así
 * que las cintas van todas en gris y sólo una se pinta —la que se señala o la
 * elegida—: catorce colores no se distinguen entre sí. El nombre va escrito al
 * final de cada cinta que llega al último año; el resto se lee al pasar por
 * encima. Un año sin estimación, o fuera de los diez primeros, corta la cinta:
 * no se une un puesto con el de dos años después como si hubiera estado ahí.
 */

const ROW = 30;
const TOP_PAD = 14;
const AXIS = 30;
const LEFT = 40;

/**
 * «Yascara Vanessa Zuazo Batchelder» → «Yascara Zuazo»: el nombre y el primer
 * apellido. Algunos registros vienen en mayúsculas y con los apellidos primero
 * («BEDOYA BALLIVIAN RENE FERNANDO»): ahí no se sabe dónde empieza el nombre,
 * así que van los dos apellidos, en minúsculas con inicial.
 */
export function shortName(name: string): string {
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

const usd = (value: number): string =>
  `$us ${value.toLocaleString('es-BO', { maximumFractionDigits: value < 10 ? 1 : 0 })} M`;

interface Hover {
  person: string;
  year: number;
  x: number;
  y: number;
}

export function OwnerRankRibbons({
  histories,
  places,
  selected,
  onSelect,
}: {
  histories: readonly OwnerHistory[];
  /** Cuántos puestos se dibujan: los que el tablero publica por año. */
  places: number;
  selected: string | null;
  onSelect: (person: string, year: number) => void;
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

  const years = [...new Set(histories.flatMap((one) => one.years.map((row) => row.year)))].sort(
    (a, b) => a - b,
  );
  const first = years[0];
  const last = years.at(-1);
  if (first === undefined || last === undefined) return null;
  const span = Array.from({ length: last - first + 1 }, (_, index) => first + index);

  const wide = width >= 640;
  const right = wide ? 150 : 14;
  const height = TOP_PAD + places * ROW + AXIS;
  const x = (year: number): number =>
    LEFT + (span.length === 1 ? 0 : ((year - first) / (span.length - 1)) * (width - LEFT - right));
  const y = (rank: number): number => TOP_PAD + (rank - 0.5) * ROW;
  const column = (width - LEFT - right) / Math.max(1, span.length - 1);
  const step = Math.max(1, Math.ceil(38 / column));
  // Con columnas angostas (el móvil) la cinta de seis píxeles tapaba a la vecina.
  const thin = column < 32;

  const shown = histories
    .map((history) => ({
      history,
      points: history.years.filter((row) => row.rank <= places),
    }))
    .filter((one) => one.points.length > 0);
  const active = hover?.person ?? selected;

  /** Tramos de años seguidos dentro de los puestos dibujados: un hueco corta la cinta. */
  const path = (points: OwnerHistory['years']): string => {
    let d = '';
    points.forEach((point, index) => {
      const previous = points[index - 1];
      const px = x(point.year);
      const py = y(point.rank);
      if (!previous || previous.year !== point.year - 1) {
        d += `M${px},${py}`;
        return;
      }
      const qx = x(previous.year);
      const qy = y(previous.rank);
      const half = (px - qx) / 2;
      d += `C${qx + half},${qy} ${px - half},${py} ${px},${py}`;
    });
    return d;
  };

  const hovered = hover ? histories.find((one) => one.person === hover.person) : undefined;
  const hoveredYear = hovered?.years.find((row) => row.year === hover?.year);
  const activeHistory = histories.find((one) => one.person === active);

  const ribbon = ({ history, points }: (typeof shown)[number]) => {
    const on = history.person === active;
    const d = path(points);
    return (
      <g key={history.person} className={on ? styles.on : styles.off}>
        {on ? <path d={d} className={styles.halo} /> : null}
        <path d={d} className={styles.ribbon} />
        {points.map((point) => (
          <circle
            key={point.year}
            cx={x(point.year)}
            cy={y(point.rank)}
            r={on ? (thin ? 3.5 : 5) : thin ? 2 : 3.5}
            className={styles.dot}
          />
        ))}
        {/* Lo que se toca: más ancho que la cinta, para no tener que apuntar fino. */}
        <path
          d={d}
          className={styles.hit}
          onClick={() => onSelect(history.person, points.at(-1)?.year ?? last)}
        />
        {points.map((point) => (
          <circle
            key={`hit-${point.year}`}
            cx={x(point.year)}
            cy={y(point.rank)}
            r={12}
            className={styles.hitDot}
            onMouseEnter={() =>
              setHover({ person: history.person, year: point.year, x: x(point.year), y: y(point.rank) })
            }
            onClick={() => onSelect(history.person, point.year)}
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
          aria-label={`Puesto de cada empresario entre los ${places} primeros, ${first}–${last}`}
        >
          {Array.from({ length: places }, (_, index) => index + 1).map((rank) => (
            <g key={rank}>
              <line x1={LEFT} x2={width - right} y1={y(rank)} y2={y(rank)} className={styles.grid} />
              <text x={LEFT - 10} y={y(rank)} className={styles.rank}>
                {rank}.º
              </text>
            </g>
          ))}
          {span.map((year, index) =>
            index % step === 0 || year === last ? (
              <text key={year} x={x(year)} y={height - 8} className={styles.year}>
                {year}
              </text>
            ) : null,
          )}
          {shown.filter((one) => one.history.person !== active).map(ribbon)}
          {shown.filter((one) => one.history.person === active).map(ribbon)}
          {wide
            ? shown
                .filter((one) => one.points.at(-1)?.year === last)
                .map(({ history, points }) => {
                  const end = points.at(-1);
                  if (!end) return null;
                  return (
                    <text
                      key={`name-${history.person}`}
                      x={x(last) + 12}
                      y={y(end.rank)}
                      className={history.person === active ? styles.nameOn : styles.name}
                      onClick={() => onSelect(history.person, last)}
                    >
                      {shortName(history.name)}
                    </text>
                  );
                })
            : null}
        </svg>
        {hover && hovered && hoveredYear ? (
          <div
            className={styles.tip}
            style={{
              left: Math.min(hover.x + 14, width - 220),
              top: Math.max(0, hover.y - 12),
            }}
          >
            <strong>{hovered.name}</strong>
            <span>
              {hoveredYear.year}: {hoveredYear.rank}.º de {hoveredYear.population}
            </span>
            <span>Piso contable {usd(hoveredYear.book)}</span>
            <span>Mayor empresa: {hoveredYear.leadingHolding}</span>
          </div>
        ) : null}
      </div>
      <ChartLegend
        items={[
          {
            color: 'var(--official)',
            label: activeHistory ? `${activeHistory.name} (resaltado)` : 'Persona resaltada',
            shape: 'line',
          },
          { color: 'var(--ribbon-rest)', label: 'Las demás personas', shape: 'line' },
        ]}
      />
    </div>
  );
}

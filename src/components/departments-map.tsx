'use client';

import { DEPARTMENTS as SHAPES, MAP_BOX, PLACE_POINTS } from '@/lib/bolivia-map';

/**
 * Los nueve departamentos, pintados por una medida y listos para tocarse.
 *
 * El capítulo departamental elegía el departamento con nueve fichas en fila, y
 * una fila de nombres no contesta lo primero que pregunta quien llega: dónde.
 * Un mapa sí, y de paso enseña la medida entera antes de que nadie elija nada:
 * el reparto del producto se ve de un vistazo, con Santa Cruz oscuro y Pando
 * casi en blanco, que es la lectura que las fichas escondían.
 *
 * Los contornos son los mismos que dibuja el registro de lugares —los publica
 * el geoportal del Estado y `scripts/build-bolivia-map.mjs` los proyecta una
 * vez— así que aquí no se proyecta nada: el mapa es nueve trazados en una caja
 * y un rótulo en el centro de cada uno.
 *
 * **El color es la rampa de magnitud del informe**, en los mismos cinco pasos
 * que la retícula de calor: un solo tono de claro a oscuro, con la tinta del
 * rótulo emparejada paso a paso, que es lo único que aguanta el modo oscuro
 * (ahí la rampa se ancla al revés y «mucho» es claro). Un crecimiento negativo
 * no cabe en una rampa que arranca en cero, así que el suelo baja al mínimo
 * cuando hay valores por debajo de cero y la clave lo dice.
 *
 * **Cada departamento es un botón.** No uno visual: un grupo con `role="button"`,
 * su nombre y su cifra en `aria-label`, foco de teclado y las dos teclas que un
 * botón responde. El foco se pinta sobre el propio contorno, porque una forma
 * sin borde propio no tiene dónde más enseñarlo. Y hay una lista al lado con
 * botones de verdad: el mapa es el atajo, nunca la única puerta.
 */

/** Una lectura por departamento, o `null` si esa medida no lo tiene. */
export interface MapReading {
  code: string;
  value: number | null;
}

/**
 * Los cinco pasos de la rampa, de poco a mucho, con la tinta que le toca a cada
 * uno. La misma lista que `HeatGrid`, por la misma razón: la tinta viaja con el
 * paso y no se deduce de su número.
 */
const STEPS = [
  { fill: 'var(--seq-200)', ink: 'var(--seq-ink-1)' },
  { fill: 'var(--seq-300)', ink: 'var(--seq-ink-2)' },
  { fill: 'var(--seq-400)', ink: 'var(--seq-ink-3)' },
  { fill: 'var(--seq-500)', ink: 'var(--seq-ink-4)' },
  { fill: 'var(--seq-600)', ink: 'var(--seq-ink-5)' },
] as const;

const NONE = { fill: 'var(--rule-soft)', ink: 'var(--ink-soft)' } as const;

const CENTRE = new Map(
  PLACE_POINTS.filter((point) => point.kind === 'departamento').map((point) => [point.code, point]),
);

const number = (value: number, decimals: number): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/**
 * Una cifra grande abreviada para caber dentro de un departamento.
 *
 * «10.830.820» no cabe en Pando ni en Chuquisaca a ningún tamaño de pantalla;
 * «10,8 M» sí. La cifra exacta sigue en el `aria-label`, en la lista de al lado
 * y en la vista completa de abajo.
 */
const short = (value: number, decimals: number): string =>
  Math.abs(value) >= 1_000_000
    ? `${number(value / 1_000_000, 1)} M`
    : Math.abs(value) >= 10_000
      ? `${number(value / 1_000, 0)} mil`
      : number(value, decimals);

export function DepartmentsMap({
  readings,
  label,
  unit,
  decimals,
  chosen,
  onPick,
}: {
  readings: readonly MapReading[];
  /** Qué medida pinta el mapa, para la clave y para el lector de pantalla. */
  label: string;
  unit: string;
  decimals: number;
  chosen: string | null;
  onPick: (code: string) => void;
}) {
  const byCode = new Map(readings.map((reading) => [reading.code, reading.value]));
  const values = readings
    .map((reading) => reading.value)
    .filter((value): value is number => value !== null);
  const high = values.length ? Math.max(...values) : 0;
  const low = values.length ? Math.min(0, ...values) : 0;

  const stepOf = (value: number): (typeof STEPS)[number] => {
    if (high <= low) return STEPS[2];
    const index = Math.floor(((value - low) / (high - low)) * STEPS.length);
    return STEPS[Math.min(STEPS.length - 1, Math.max(0, index))] ?? STEPS[0];
  };

  return (
    <div>
      <div
        className="map-frame"
        style={{
          aspectRatio: `${MAP_BOX.width} / ${MAP_BOX.height}`,
          ['--map-aspect' as string]: String(MAP_BOX.width / MAP_BOX.height),
        }}
      >
        <svg
          viewBox={`0 0 ${MAP_BOX.width} ${MAP_BOX.height}`}
          className="map-svg"
          role="group"
          aria-label={`Mapa de Bolivia: ${label} por departamento. Toca un departamento para abrir su vista completa.`}
        >
          {SHAPES.map((shape) => {
            const value = byCode.get(shape.code) ?? null;
            const step = value === null ? NONE : stepOf(value);
            const said = value === null ? 'sin lectura' : `${number(value, decimals)} ${unit}`;
            const on = shape.code === chosen;
            return (
              <g
                key={shape.code}
                className={on ? 'choro choro-on' : 'choro'}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={`${shape.name}: ${said}`}
                onClick={() => onPick(shape.code)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onPick(shape.code);
                  }
                }}
              >
                <path d={shape.path} className="choro-shape" style={{ fill: step.fill }} />
              </g>
            );
          })}
          {/*
           * Los rótulos van en su propia capa, después de los nueve contornos:
           * dentro de cada grupo, el contorno que se pinta después tapaba el
           * rótulo del anterior, y «Chuquisaca» salía cortado por Potosí.
           */}
          <g aria-hidden="true">
            {SHAPES.map((shape) => {
              const value = byCode.get(shape.code) ?? null;
              const step = value === null ? NONE : stepOf(value);
              const centre = CENTRE.get(shape.code);
              if (!centre) return null;
              return (
                <g key={shape.code}>
                  <text
                    className="choro-name"
                    x={centre.x}
                    y={centre.y - 6}
                    style={{ fill: step.ink }}
                  >
                    {shape.name}
                  </text>
                  <text
                    className="choro-value"
                    x={centre.x}
                    y={centre.y + 26}
                    style={{ fill: step.ink }}
                  >
                    {value === null ? '—' : short(value, decimals)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="heat-scale">
        <span>
          {number(low, decimals)} {unit}
        </span>
        <span className="heat-scale-steps">
          {STEPS.map((step) => (
            <span key={step.fill} style={{ background: step.fill }} />
          ))}
        </span>
        <span>
          {number(high, decimals)} {unit}
        </span>
        <span className="heat-scale-steps" style={{ marginLeft: '0.6rem' }}>
          <span style={{ background: NONE.fill }} />
        </span>
        <span>sin lectura</span>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { additive } from '@/lib/choice';
import { WORLD_BOX, WORLD_POINTS, WORLD_SHAPES } from '@/lib/world-map';

/**
 * El mundo pintado por cuánto comercia Bolivia con cada país.
 *
 * Es un mapa de calor sobre la proyección Equal Earth, que conserva el área:
 * en Mercator Rusia y Canadá se veían tres veces más grandes de lo que son, y
 * en un mapa de compradores eso se lee como que compran más.
 *
 * **La escala es logarítmica.** China compra veinte veces más que España; en
 * una rampa lineal diecinueve de los veinte socios caían en el primer paso y
 * el mapa sólo decía «China». Con logaritmos cada paso multiplica, y la clave
 * lo dice con las cifras de sus extremos.
 *
 * **Gris no es cero.** Comtrade publica, para Bolivia, sólo los veinte socios
 * principales de cada flujo. Un país en gris puede comprar algo; no está entre
 * los veinte, y la clave lo dice así en vez de «sin comercio».
 *
 * **Cada país con dato es un botón**, con su nombre y su cifra en `aria-label`:
 * tocarlo lo pone en el filtro de país del carril —el mismo estado, no una
 * copia— y abre su ficha debajo. Ctrl/⌘ suma, como en el resto del informe.
 * Hong Kong y Singapur no tienen contorno a esta escala y van como punto.
 */

export interface MapTrade {
  /** El token del filtro, p. ej. `CHINA`. */
  token: string;
  iso3: string;
  label: string;
  value: number;
}

const STEPS = [
  { fill: 'var(--seq-200)' },
  { fill: 'var(--seq-300)' },
  { fill: 'var(--seq-400)' },
  { fill: 'var(--seq-500)' },
  { fill: 'var(--seq-600)' },
] as const;

const NONE = 'var(--rule-soft)';

const say = (value: number, decimals = 0): string =>
  value.toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export function WorldTradeMap({
  rows,
  unit,
  label,
  picked,
  onPick,
}: {
  rows: readonly MapTrade[];
  unit: string;
  /** Qué pinta el mapa, para el lector de pantalla. */
  label: string;
  picked: ReadonlySet<string>;
  onPick: (token: string, additive: boolean) => void;
}) {
  const [hover, setHover] = useState<{ name: string; said: string; x: number; y: number } | null>(null);
  const byIso = new Map(rows.filter((row) => row.value > 0).map((row) => [row.iso3, row]));
  const values = [...byIso.values()].map((row) => row.value);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 0;
  const logLow = Math.log(Math.max(low, 1e-9));
  const logHigh = Math.log(Math.max(high, 1e-9));

  const fillOf = (value: number): string => {
    if (logHigh <= logLow) return STEPS[4].fill;
    const index = Math.floor(((Math.log(value) - logLow) / (logHigh - logLow)) * STEPS.length);
    return (STEPS[Math.min(STEPS.length - 1, Math.max(0, index))] ?? STEPS[0]).fill;
  };

  const handlers = (row: MapTrade | undefined, name: string) => {
    const said = row ? `${say(row.value, 1)} ${unit}` : 'fuera de los 20 socios que publica Comtrade';
    const move = (event: React.MouseEvent) => {
      const frame = event.currentTarget.closest('.world-map-frame');
      if (!frame) return;
      const box = frame.getBoundingClientRect();
      setHover({ name: row?.label ?? name, said, x: event.clientX - box.left, y: event.clientY - box.top });
    };
    return {
      onMouseMove: move,
      onMouseLeave: () => setHover(null),
      ...(row
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-pressed': picked.has(row.token),
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

  const classOf = (row: MapTrade | undefined, iso3: string) =>
    [
      'world-country',
      row ? 'world-country-data' : '',
      row && picked.has(row.token) ? 'world-country-on' : '',
      iso3 === 'BOL' ? 'world-country-home' : '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <div className="world-map">
      <div className="world-map-frame" style={{ aspectRatio: `${WORLD_BOX.width} / ${WORLD_BOX.height}` }}>
        <svg
          viewBox={`0 0 ${WORLD_BOX.width} ${WORLD_BOX.height}`}
          className="map-svg"
          role="group"
          aria-label={`Mapa del mundo: ${label}. Toca un país para filtrarlo y ver su ficha.`}
        >
          {WORLD_SHAPES.map((shape) => {
            const row = byIso.get(shape.iso3);
            return (
              <g key={shape.iso3} className={classOf(row, shape.iso3)} {...handlers(row, shape.name)}>
                <path d={shape.path} style={{ fill: row ? fillOf(row.value) : NONE }} />
              </g>
            );
          })}
          {WORLD_POINTS.filter((point) => byIso.has(point.iso3)).map((point) => {
            const row = byIso.get(point.iso3);
            return (
              <g key={point.iso3} className={classOf(row, point.iso3)} {...handlers(row, point.name)}>
                <circle cx={point.x} cy={point.y} r={5} style={{ fill: row ? fillOf(row.value) : NONE }} />
              </g>
            );
          })}
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
      <div className="heat-scale">
        <span>
          {say(low, 0)} {unit}
        </span>
        <span className="heat-scale-steps">
          {STEPS.map((step) => (
            <span key={step.fill} style={{ background: step.fill }} />
          ))}
        </span>
        <span>
          {say(high, 0)} {unit} (escala logarítmica)
        </span>
        <span className="heat-scale-steps" style={{ marginLeft: '0.6rem' }}>
          <span style={{ background: NONE }} />
        </span>
        <span>fuera de los 20 principales</span>
        <span className="heat-scale-steps" style={{ marginLeft: '0.6rem' }}>
          <span className="world-home-key" />
        </span>
        <span>Bolivia</span>
      </div>
    </div>
  );
}

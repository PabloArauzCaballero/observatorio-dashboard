'use client';

import { useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { DEPARTMENTS, MAP_BOX, PLACE_POINTS, projectRoadPoint } from '@/lib/bolivia-map';
import { ChartLegend } from './charts';
import type { LegendItem } from './charts';
import { FULL, MapTools, fitBox, useMapCamera } from './map-camera';
import type { Box } from './map-camera';

/**
 * Una red de líneas y puntos sobre el contorno departamental: el ferrocarril
 * con sus estaciones, los ríos con sus puertos.
 *
 * Es el mapa de «Carreteras» sin escudos de ruta: el mismo contorno, la misma
 * proyección (`projectRoadPoint`) y las mismas clases de estilo, para que las
 * tres capas de la pestaña «Transporte» se lean igual y una vía no aparezca
 * corrida respecto de la otra. Lo que lo hace legible es lo mismo que allí:
 * jerarquía por grosor y capa, nombres de capitales y departamentos,
 * acercamiento al recorte elegido y una ficha al pasar el cursor.
 */

export interface MapLine {
  id: string;
  /** La clave con que el clic aísla la línea (el nombre del río o de la vía). */
  pick: string | null;
  title: string;
  subtitle: string;
  rows: [string, string][];
  color: string;
  width: number;
  layer: number;
  dash?: string | undefined;
  opacity?: number | undefined;
  geometry: [number, number][][];
}

export interface MapPoint {
  id: string;
  title: string;
  subtitle: string;
  lon: number;
  lat: number;
}

export interface MapLegendItem {
  key: string;
  label: string;
  color: string;
  km?: number;
  dash?: string | undefined;
}

const CAPITALS: readonly { name: string; at: [number, number] }[] = [
  { name: 'La Paz', at: [-68.1193, -16.4955] },
  { name: 'Santa Cruz', at: [-63.1812, -17.7834] },
  { name: 'Cochabamba', at: [-66.1568, -17.3895] },
  { name: 'Sucre', at: [-65.2627, -19.0196] },
  { name: 'Oruro', at: [-67.115, -17.9667] },
  { name: 'Potosí', at: [-65.7539, -19.5836] },
  { name: 'Tarija', at: [-64.7296, -21.5355] },
  { name: 'Trinidad', at: [-64.9007, -14.8333] },
  { name: 'Cobija', at: [-68.769, -11.0267] },
];

const inside = (box: Box, [x, y]: [number, number]): boolean =>
  x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

export function NetworkMap({
  lines,
  points,
  matches,
  picked,
  zoomTo,
  frameKey,
  onPick,
  legend,
  pointLabel,
  ariaLabel,
  foot,
}: {
  lines: readonly MapLine[];
  points: readonly MapPoint[];
  /** Si la línea entra en la selección del lector; el resto se atenúa. */
  matches: (line: MapLine) => boolean;
  picked: string | null;
  zoomTo: boolean;
  /** Lo que identifica el encuadre: al cambiar, la cámara del lector se suelta. */
  frameKey: string;
  onPick: (key: string) => void;
  legend: readonly MapLegendItem[];
  /** Qué son los puntos, para la leyenda («Estación», «Puerto o terminal»). */
  pointLabel: string;
  ariaLabel: string;
  foot: string;
}) {
  const [hover, setHover] = useState<{
    kind: 'line' | 'point';
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const drawn = useMemo(
    () =>
      [...lines]
        .sort((left, right) => left.layer - right.layer)
        .map((line) => {
          const projected = line.geometry.map((part) =>
            part.map((point) => projectRoadPoint(point)),
          );
          const d = projected
            .map((part) => `M${part.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}`)
            .join(' ');
          return { line, d, projected };
        }),
    [lines],
  );

  const on = useMemo(() => drawn.filter((one) => matches(one.line)), [drawn, matches]);
  const onIds = useMemo(() => new Set(on.map((one) => one.line.id)), [on]);
  const filtering = on.length !== drawn.length;
  const home = useMemo<Box>(() => {
    if (!zoomTo || !on.length) return FULL;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const one of on) {
      for (const part of one.projected) {
        for (const [x, y] of part) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    return Number.isFinite(minX) ? fitBox(minX, minY, maxX, maxY) : FULL;
  }, [zoomTo, on]);
  const camera = useMapCamera(home, frameKey);
  const { view, zoom } = camera;
  const unit = Math.max(view.width / MAP_BOX.width, view.height / MAP_BOX.height);
  const zoomed = zoom > 1.6;

  const placed = useMemo(
    () => points.map((point) => ({ point, at: projectRoadPoint([point.lon, point.lat]) })),
    [points],
  );

  const track = (
    event: ReactPointerEvent<SVGElement>,
    kind: 'line' | 'point',
    id: string,
  ): void => {
    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!box) return;
    setHover({
      kind,
      id,
      x: event.clientX - box.left,
      y: event.clientY - box.top,
      width: box.width,
      height: box.height,
    });
  };

  /*
   * La leyenda es la de todo gráfico del tablero (`ChartLegend`), y no una propia: así
   * viaja dentro de la imagen que baja el panel. Las vías son trazos —discontinuos donde
   * el mapa los dibuja así— y los puntos y las capitales, marcas llenas.
   */
  const legendItems: LegendItem[] = [
    ...legend.map(
      (entry): LegendItem => ({
        label:
          entry.km !== undefined
            ? `${entry.label} · ${Math.round(entry.km).toLocaleString('es-BO')} km`
            : entry.label,
        color: entry.color,
        shape: 'line',
        ...(entry.dash ? { dashed: true } : {}),
      }),
    ),
    ...(points.length ? [{ label: pointLabel, color: 'var(--ink-soft)' }] : []),
    { label: 'Capital de departamento', color: 'var(--ink)' },
  ];

  const hoveredLine =
    hover?.kind === 'line' ? drawn.find((one) => one.line.id === hover.id) : undefined;
  const hoveredPoint =
    hover?.kind === 'point' ? placed.find((one) => one.point.id === hover.id) : undefined;

  return (
    <figure className="roads-map-wrap">
      <div
        className="roads-map-stage"
        role="group"
        onPointerLeave={() => setHover(null)}
        aria-label={`${ariaLabel}. Teclas más y menos para acercar, flechas para moverse, cero para volver.`}
        {...camera.stageProps}
      >
        <svg
          ref={camera.svgRef}
          viewBox={`${view.x.toFixed(2)} ${view.y.toFixed(2)} ${view.width.toFixed(2)} ${view.height.toFixed(2)}`}
          role="img"
          aria-label={ariaLabel}
          className="roads-map"
          {...camera.svgProps}
          onPointerDown={(event) => {
            if (!(event.target as Element).closest('.roads-map-hits, .network-map-points')) setHover(null);
            camera.svgProps.onPointerDown(event);
          }}
        >
          <g className="roads-map-departments">
            {DEPARTMENTS.map((one) => (
              <path key={one.code} d={one.path} vectorEffect="non-scaling-stroke" />
            ))}
          </g>

          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {drawn.map(({ line, d }) => {
              const chosen = picked !== null && line.pick === picked;
              return (
                <path
                  key={line.id}
                  d={d}
                  stroke={line.color}
                  strokeWidth={chosen ? line.width + 1.6 : line.width}
                  strokeDasharray={line.dash}
                  opacity={filtering && !onIds.has(line.id) ? 0.08 : (line.opacity ?? 0.95)}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {hoveredLine ? (
              <path
                d={hoveredLine.d}
                className="roads-map-hover"
                strokeWidth={hoveredLine.line.width + 2.4}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </g>

          {/* Las zonas sensibles al cursor no se dibujan: fuera de la imagen que baja el panel. */}
          <g className="roads-map-hits" data-export="skip">
            {on.map(({ line, d }) => (
              <path
                key={line.id}
                d={d}
                vectorEffect="non-scaling-stroke"
                onPointerMove={(event) => track(event, 'line', line.id)}
                onPointerDown={(event) => track(event, 'line', line.id)}
                onClick={() => {
                  if (camera.consumeDrag()) return;
                  if (line.pick) onPick(line.pick);
                }}
                style={{ cursor: line.pick ? 'pointer' : 'default' }}
              />
            ))}
          </g>

          {!zoomed ? (
            <g className="roads-map-dept-names" aria-hidden="true">
              {PLACE_POINTS.filter((point) => point.kind === 'departamento').map((point) => (
                <text key={point.code} x={point.x} y={point.y} fontSize={15 * unit}>
                  {point.name.toLocaleUpperCase('es')}
                </text>
              ))}
            </g>
          ) : null}

          <g className="network-map-points">
            {placed
              .filter(({ at }) => inside(view, at))
              .map(({ point, at }) => (
                <rect
                  key={point.id}
                  x={at[0] - 3.2 * unit}
                  y={at[1] - 3.2 * unit}
                  width={6.4 * unit}
                  height={6.4 * unit}
                  transform={`rotate(45 ${at[0]} ${at[1]})`}
                  onPointerMove={(event) => track(event, 'point', point.id)}
                  onPointerDown={(event) => track(event, 'point', point.id)}
                />
              ))}
          </g>

          <g className="roads-map-capitals" aria-hidden="true">
            {CAPITALS.map((capital) => {
              const [x, y] = projectRoadPoint(capital.at);
              if (!inside(view, [x, y])) return null;
              return (
                <g key={capital.name}>
                  <circle cx={x} cy={y} r={4.2 * unit} />
                  <text x={x + 7 * unit} y={y - 6 * unit} fontSize={13 * unit}>
                    {capital.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <MapTools camera={camera} homeLabel={zoomTo && home !== FULL ? 'Encuadre' : 'Todo el país'} />

        {hover && !camera.panning && (hoveredLine || hoveredPoint) ? (
          <div
            className="map-tip roads-map-tip"
            style={{
              left: hover.x > hover.width * 0.6 ? undefined : hover.x + 14,
              right: hover.x > hover.width * 0.6 ? hover.width - hover.x + 14 : undefined,
              top: hover.y < hover.height * 0.55 ? hover.y + 14 : undefined,
              bottom: hover.y < hover.height * 0.55 ? undefined : hover.height - hover.y + 14,
            }}
            role="status"
            aria-live="polite"
          >
            <div className="tooltip">
              <div className="t-date">
                {hoveredLine ? hoveredLine.line.subtitle : hoveredPoint?.point.subtitle}
              </div>
              <b className="map-card-name">
                {hoveredLine ? hoveredLine.line.title : hoveredPoint?.point.title}
              </b>
              {(hoveredLine?.line.rows ?? []).map(([label, value]) => (
                <div className="t-row" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
              {hoveredLine?.line.pick ? <div className="t-note">Clic para aislarla.</div> : null}
            </div>
          </div>
        ) : null}
      </div>

      <ChartLegend items={legendItems} />

      <figcaption className="roads-map-foot">{foot}</figcaption>
    </figure>
  );
}

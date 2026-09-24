'use client';

import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { DEPARTMENTS, MAP_BOX, PLACE_POINTS, projectRoadPoint } from '@/lib/bolivia-map';
import type { RoadSection } from '@/lib/roads';
import { NETWORKS, SURFACE_GROUP, SURFACE_GROUPS, departmentName } from '@/lib/roads-board';

/**
 * La red vial, dibujada sobre el contorno departamental.
 *
 * El contorno es el mismo SVG estático que usa «Ciudades»: nueve `<path>` en
 * el espacio de `MAP_BOX`. La red se proyecta a ese mismo espacio con
 * `projectRoadPoint`, que replica la proyección equirectangular con que se
 * generó el contorno — mismo origen, misma escala — para que un tramo no
 * aparezca corrido respecto al departamento que lo contiene.
 *
 * La primera versión pintaba los 2.561 tramos del mismo grosor y por seis
 * rodaduras a la vez, sin un nombre en todo el plano: una maraña de colores
 * donde no se sabía qué línea era la carretera a Oruro ni dónde estaba Oruro.
 * Lo que la hace legible, en orden de peso:
 *
 * - **Jerarquía.** Por omisión se colorea por red: la Fundamental gruesa y
 *   azul, la Departamental naranja, y lo que no tiene ruta asignada —un tercio
 *   de lo trazado— fino y gris, debajo de todo. La rodadura es la otra lectura,
 *   a un botón, en cuatro grupos y no en seis.
 * - **Nombres.** Las capitales, los departamentos y un escudo con el número de
 *   cada ruta, repartidos para que no se pisen.
 * - **Acercamiento.** Elegir un departamento o una ruta encuadra el mapa en
 *   ella; el trazo no engorda al acercar (`non-scaling-stroke`).
 * - **Ficha.** Pasar el cursor por una vía dice qué es; el clic la aísla.
 */

export type RoadColorBy = 'red' | 'superficie';

const NETWORK_COLOR = Object.fromEntries(NETWORKS.map((one) => [one.network, one.color])) as Record<
  RoadSection['network'],
  string
>;
const GROUP_COLOR = Object.fromEntries(SURFACE_GROUPS.map((one) => [one.group, one.color])) as Record<
  string,
  string
>;
const GROUP_LABEL = Object.fromEntries(SURFACE_GROUPS.map((one) => [one.group, one.label])) as Record<
  string,
  string
>;

/** Grosor en píxeles de pantalla, no del plano: no cambia al acercar. */
const WIDTH: Record<RoadSection['network'], number> = {
  FUNDAMENTAL: 2.6,
  DEPARTAMENTAL: 1.8,
  SIN_REFERENCIA: 1,
};
/* Debajo lo menor: la Fundamental se dibuja al final para quedar encima. */
const LAYER: Record<RoadSection['network'], number> = {
  SIN_REFERENCIA: 0,
  DEPARTAMENTAL: 1,
  FUNDAMENTAL: 2,
};

/** Las diez capitales, en `[longitud, latitud]`. */
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

const km = (value: number): string =>
  value.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

interface Drawn {
  section: RoadSection;
  d: string;
  points: [number, number][][];
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const FULL: Box = { x: 0, y: 0, width: MAP_BOX.width, height: MAP_BOX.height };

/** El rectángulo que encierra unos tramos, con aire alrededor y un mínimo de tamaño. */
function boxOf(drawn: readonly Drawn[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const one of drawn) {
    for (const line of one.points) {
      for (const [x, y] of line) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!Number.isFinite(minX)) return FULL;
  // Un mínimo de 160 unidades: una ruta corta encuadrada al milímetro no deja ver dónde está.
  const width = Math.max(160, maxX - minX);
  const height = Math.max(160, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const pad = 0.08;
  return {
    x: cx - (width * (1 + pad * 2)) / 2,
    y: cy - (height * (1 + pad * 2)) / 2,
    width: width * (1 + pad * 2),
    height: height * (1 + pad * 2),
  };
}

const inside = (box: Box, [x, y]: [number, number]): boolean =>
  x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

/** El punto medio, a lo largo, de la línea más larga del tramo: donde va el escudo. */
function anchorOf(points: readonly [number, number][][]): { at: [number, number]; length: number } {
  let best: [number, number][] = [];
  let bestLength = -1;
  for (const line of points) {
    let length = 0;
    for (let index = 1; index < line.length; index += 1) {
      const [ax, ay] = line[index - 1]!;
      const [bx, by] = line[index]!;
      length += Math.hypot(bx - ax, by - ay);
    }
    if (length > bestLength) {
      bestLength = length;
      best = line;
    }
  }
  let walked = 0;
  for (let index = 1; index < best.length; index += 1) {
    const [ax, ay] = best[index - 1]!;
    const [bx, by] = best[index]!;
    const step = Math.hypot(bx - ax, by - ay);
    if (walked + step >= bestLength / 2) {
      const t = step ? (bestLength / 2 - walked) / step : 0;
      return { at: [ax + (bx - ax) * t, ay + (by - ay) * t], length: bestLength };
    }
    walked += step;
  }
  return { at: best[0] ?? [0, 0], length: Math.max(0, bestLength) };
}

export function RoadsMap({
  sections,
  matches,
  route,
  colorBy,
  zoomTo,
  onPickRoute,
}: {
  sections: readonly RoadSection[];
  /** Si el tramo entra en la selección del lector; el resto se atenúa. */
  matches: (section: RoadSection) => boolean;
  route: string | null;
  colorBy: RoadColorBy;
  /** Si el recorte actual pide acercar el mapa a lo elegido. */
  zoomTo: boolean;
  onPickRoute: (route: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number; width: number } | null>(null);

  const drawn = useMemo<Drawn[]>(
    () =>
      [...sections]
        .sort((left, right) => LAYER[left.network] - LAYER[right.network])
        .map((section) => {
          const points = section.geometry.map((line) => line.map((point) => projectRoadPoint(point)));
          const d = points
            .map((line) => `M${line.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}`)
            .join(' ');
          return { section, d, points };
        }),
    [sections],
  );

  const on = useMemo(() => drawn.filter((one) => matches(one.section)), [drawn, matches]);
  const filtering = on.length !== drawn.length;
  const onIds = useMemo(() => new Set(on.map((one) => one.section.sectionId)), [on]);

  const view = useMemo<Box>(() => (zoomTo && on.length ? boxOf(on) : FULL), [zoomTo, on]);
  /* Cuántas unidades del plano mide un píxel «de diseño»: lo que mantiene
     rótulos y escudos del mismo tamaño en pantalla al acercar. */
  const unit = Math.max(view.width / MAP_BOX.width, view.height / MAP_BOX.height);
  const zoomed = view !== FULL;

  /** Por ruta, lo que la selección tiene de ella: la cifra de la ficha. */
  const routeTotals = useMemo(() => {
    const totals = new Map<string, { km: number; paved: number; departments: Set<string> }>();
    for (const one of on) {
      const key = one.section.route;
      if (!key) continue;
      const entry = totals.get(key) ?? { km: 0, paved: 0, departments: new Set<string>() };
      entry.km += one.section.lengthKm;
      if (one.section.surface === 'PAVIMENTO') entry.paved += one.section.lengthKm;
      entry.departments.add(one.section.department);
      totals.set(key, entry);
    }
    return totals;
  }, [on]);

  /**
   * Un escudo por ruta, en el tramo más largo que la selección tiene de ella,
   * y ninguno encima de otro: se colocan de la ruta más larga a la más corta y
   * se salta el que caería sobre uno ya puesto. A escala de país sólo la
   * Fundamental lleva escudo; acercado, también la Departamental.
   */
  const shields = useMemo(() => {
    const best = new Map<string, { at: [number, number]; length: number; network: RoadSection['network'] }>();
    for (const one of on) {
      const key = one.section.route;
      if (!key) continue;
      if (!zoomed && one.section.network !== 'FUNDAMENTAL') continue;
      const anchor = anchorOf(one.points);
      if (!inside(view, anchor.at)) continue;
      const held = best.get(key);
      if (!held || anchor.length > held.length) best.set(key, { ...anchor, network: one.section.network });
    }
    const order = [...best.entries()].sort(
      (left, right) => (routeTotals.get(right[0])?.km ?? 0) - (routeTotals.get(left[0])?.km ?? 0),
    );
    const placed: { route: string; at: [number, number]; network: RoadSection['network'] }[] = [];
    /* Las capitales y su nombre, a la derecha del punto, son obstáculos fijos. */
    const taken = CAPITALS.map((capital) => {
      const [x, y] = projectRoadPoint(capital.at);
      return { x: x + capital.name.length * 3.6 * unit, y: y - 5 * unit, w: capital.name.length * 3.8 * unit + 10 * unit };
    });
    const gap = 38 * unit;
    for (const [key, anchor] of order) {
      if (key === route) {
        placed.unshift({ route: key, at: anchor.at, network: anchor.network });
        continue;
      }
      const nearCapital = taken.some(
        (spot) => Math.abs(spot.x - anchor.at[0]) < spot.w + 16 * unit && Math.abs(spot.y - anchor.at[1]) < 24 * unit,
      );
      const clash = nearCapital || placed.some(
        (other) => Math.abs(other.at[0] - anchor.at[0]) < gap && Math.abs(other.at[1] - anchor.at[1]) < gap * 0.6,
      );
      if (!clash) placed.push({ route: key, at: anchor.at, network: anchor.network });
    }
    return placed;
  }, [on, zoomed, view, unit, routeTotals, route]);

  const hovered = hover ? drawn.find((one) => one.section.sectionId === hover.id) : undefined;

  const track = (event: ReactPointerEvent<SVGPathElement>, id: string): void => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    setHover({ id, x: event.clientX - box.left, y: event.clientY - box.top, width: box.width });
  };

  const colorOf = (section: RoadSection): string =>
    colorBy === 'red' ? NETWORK_COLOR[section.network] : GROUP_COLOR[SURFACE_GROUP[section.surface]]!;

  /* Las cifras de la leyenda: lo que la selección tiene en cada categoría. */
  const legend = useMemo(() => {
    const totals = new Map<string, number>();
    for (const one of on) {
      const key = colorBy === 'red' ? one.section.network : SURFACE_GROUP[one.section.surface];
      totals.set(key, (totals.get(key) ?? 0) + one.section.lengthKm);
    }
    const entries =
      colorBy === 'red'
        ? NETWORKS.map((one) => ({ key: one.network, label: one.label, color: one.color }))
        : SURFACE_GROUPS.map((one) => ({ key: one.group, label: one.label, color: one.color }));
    return entries.map((entry) => ({ ...entry, km: totals.get(entry.key) ?? 0 }));
  }, [on, colorBy]);

  return (
    <figure className="roads-map-wrap">
      <div className="roads-map-stage" ref={wrapRef} onPointerLeave={() => setHover(null)}>
        <svg
          viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.width.toFixed(1)} ${view.height.toFixed(1)}`}
          role="img"
          aria-label="Red vial principal de Bolivia"
          className="roads-map"
        >
          <g className="roads-map-departments">
            {DEPARTMENTS.map((one) => (
              <path key={one.code} d={one.path} vectorEffect="non-scaling-stroke" />
            ))}
          </g>


          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {drawn.map(({ section, d }) => {
              const lit = onIds.has(section.sectionId);
              const chosen = route !== null && section.route === route;
              return (
                <path
                  key={section.sectionId}
                  d={d}
                  stroke={colorOf(section)}
                  strokeWidth={chosen ? WIDTH[section.network] + 1.6 : WIDTH[section.network]}
                  strokeDasharray={section.status === 'EN_CONSTRUCCION' ? '5 3' : undefined}
                  opacity={filtering && !lit ? 0.1 : section.network === 'SIN_REFERENCIA' ? 0.7 : 0.95}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {hovered ? (
              <path
                d={hovered.d}
                className="roads-map-hover"
                strokeWidth={WIDTH[hovered.section.network] + 2.4}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </g>

          {/* La capa que recibe el puntero: ancha e invisible, porque un trazo
              de un píxel no se puede apuntar. Sólo lo que está en la selección. */}
          <g className="roads-map-hits">
            {on.map(({ section, d }) => (
              <path
                key={section.sectionId}
                d={d}
                vectorEffect="non-scaling-stroke"
                onPointerMove={(event) => track(event, section.sectionId)}
                onPointerDown={(event) => track(event, section.sectionId)}
                onClick={() => {
                  if (section.route) onPickRoute(section.route);
                }}
                style={{ cursor: section.route ? 'pointer' : 'default' }}
              />
            ))}
          </g>

          {/* Los nombres de departamento, encima de las vías y con halo: debajo,
              la red los tapaba y se leía «PAZ» y «URO». */}
          {!zoomed ? (
            <g className="roads-map-dept-names" aria-hidden="true">
              {PLACE_POINTS.filter((point) => point.kind === 'departamento').map((point) => (
                <text key={point.code} x={point.x} y={point.y} fontSize={15 * unit}>
                  {point.name.toLocaleUpperCase('es')}
                </text>
              ))}
            </g>
          ) : null}

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

          <g className="roads-map-shields" aria-hidden="true">
            {shields.map((shield) => {
              const width = (shield.route.length * 7.4 + 10) * unit;
              const height = 17 * unit;
              const chosen = shield.route === route;
              return (
                <g
                  key={shield.route}
                  className={chosen ? 'roads-map-shield roads-map-shield-on' : 'roads-map-shield'}
                  data-network={shield.network}
                >
                  <rect
                    x={shield.at[0] - width / 2}
                    y={shield.at[1] - height / 2}
                    width={width}
                    height={height}
                    rx={3.5 * unit}
                  />
                  <text x={shield.at[0]} y={shield.at[1] + 4.3 * unit} fontSize={12 * unit}>
                    {shield.route}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {hovered && hover ? (
          <div
            className="map-tip roads-map-tip"
            style={{
              left: hover.x > hover.width * 0.6 ? undefined : hover.x + 14,
              right: hover.x > hover.width * 0.6 ? hover.width - hover.x + 14 : undefined,
              top: hover.y + 14,
            }}
            role="status"
            aria-live="polite"
          >
            <RoadCard
              section={hovered.section}
              total={hovered.section.route ? routeTotals.get(hovered.section.route) : undefined}
            />
          </div>
        ) : null}
      </div>

      <div className="roads-map-legend">
        {legend.map((entry) => (
          <span key={entry.key} className="roads-map-legend-item">
            <i style={{ background: entry.color }} />
            {entry.label}
            <em>{Math.round(entry.km).toLocaleString('es-BO')} km</em>
          </span>
        ))}
        <span className="roads-map-legend-item">
          <i className="roads-map-legend-dash" />
          En construcción
        </span>
        <span className="roads-map-legend-item">
          <b className="roads-map-legend-dot" />
          Capital de departamento
        </span>
      </div>

      <figcaption className="roads-map-foot">
        Pasa el cursor por una vía para ver qué es; haz clic para aislar su ruta. Elegir un
        departamento o una ruta acerca el mapa. Geometría © OpenStreetMap.
      </figcaption>
    </figure>
  );
}

/** Lo que dice la ficha de una vía: su ruta, su tramo y su rodadura. */
function RoadCard({
  section,
  total,
}: {
  section: RoadSection;
  total: { km: number; paved: number; departments: Set<string> } | undefined;
}) {
  const network = NETWORKS.find((one) => one.network === section.network)?.label ?? section.network;
  return (
    <div className="tooltip">
      <div className="t-date">{network}</div>
      <b className="map-card-name">{section.route ? `Ruta ${section.route}` : 'Vía sin ruta asignada'}</b>
      {section.name ? <div className="roads-map-tip-name">{section.name}</div> : null}
      <div className="t-row">
        <span>
          <i className="t-key" style={{ color: GROUP_COLOR[SURFACE_GROUP[section.surface]] }} />
          Este tramo
        </span>
        <strong>
          {km(section.lengthKm)} km · {GROUP_LABEL[SURFACE_GROUP[section.surface]]}
        </strong>
      </div>
      <div className="t-row">
        <span>Departamento</span>
        <strong>{departmentName(section.department)}</strong>
      </div>
      {total ? (
        <>
          <div className="t-row">
            <span>Toda la ruta en la selección</span>
            <strong>{km(total.km)} km</strong>
          </div>
          <div className="t-row">
            <span>Pavimentada</span>
            <strong>{total.km > 0 ? Math.round((total.paved / total.km) * 100) : 0} %</strong>
          </div>
        </>
      ) : null}
      {section.status === 'EN_CONSTRUCCION' ? <div className="t-note">En construcción.</div> : null}
      {section.route ? <div className="t-note">Clic para aislar la ruta {section.route}.</div> : null}
    </div>
  );
}

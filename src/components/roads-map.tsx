'use client';

import { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { DEPARTMENTS, MAP_BOX, PLACE_POINTS, projectRoadPoint } from '@/lib/bolivia-map';
import type { RoadSection } from '@/lib/roads';
import { NETWORKS, SURFACE_GROUP, SURFACE_GROUPS, departmentName } from '@/lib/roads-board';
import { FULL, MapTools, fitBox, useMapCamera } from './map-camera';
import type { Box } from './map-camera';

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
 * - **Acercamiento.** Rueda, pellizco, arrastre, doble clic, teclado y botones
 *   (`useMapCamera`): hasta ×80, donde un píxel son unos 130 m. Elegir un
 *   departamento o una ruta en el riel o en la tabla encuadra el mapa en ella;
 *   el trazo no engorda al acercar (`non-scaling-stroke`) pero sí se afina el
 *   detalle: a más zoom, más escudos, nombres de vía y trazos más gruesos.
 * - **Ficha.** Pasar el cursor por una vía dice qué es; el clic la aísla.
 *
 * Las capas de trazos y de blancos del puntero están memoizadas aparte: mover
 * la cámara cambia sólo el `viewBox`, y volver a reconciliar varios miles de
 * `<path>` en cada fotograma de un arrastre era lo que lo habría vuelto torpe.
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

/**
 * Grosor en píxeles de pantalla. No se usa `vector-effect: non-scaling-stroke`:
 * con seis mil trazos Chrome vuelve a teselarlos en cada fotograma de un
 * arrastre (148 ms por fotograma medidos, 40 sin él). En su lugar el grosor se
 * multiplica por `--ppx`, las unidades del plano que mide un píxel, que sólo
 * cambia al acercar y no al mover.
 */
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

/** Las clases de OpenStreetMap en castellano, para la ficha. */
const CLASS_LABEL: Record<string, string> = {
  motorway: 'autopista',
  trunk: 'troncal',
  primary: 'primaria',
  secondary: 'secundaria',
  tertiary: 'terciaria',
  unclassified: 'sin clasificar',
  track: 'pista',
  road: 'camino',
  residential: 'calle',
  living_street: 'calle',
  service: 'de servicio',
};

const km = (value: number): string =>
  value.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

interface Drawn {
  section: RoadSection;
  d: string;
  points: [number, number][][];
  /** `[minX, minY, maxX, maxY]` en el plano: para descartar de un vistazo lo que cae fuera de la vista. */
  bounds: [number, number, number, number];
}

const inside = (box: Box, [x, y]: [number, number]): boolean =>
  x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

const touches = (box: Box, [minX, minY, maxX, maxY]: [number, number, number, number]): boolean =>
  maxX >= box.x && minX <= box.x + box.width && maxY >= box.y && minY <= box.y + box.height;

/**
 * El punto medio, a lo largo, de la línea más larga del tramo: donde va el escudo.
 *
 * Con una vista, sólo cuentan los trozos que caen dentro de ella: a ×20 el
 * punto medio de una ruta de 400 km está a una pantalla de distancia, y el
 * escudo tiene que ir donde el lector está mirando.
 */
function anchorOf(
  points: readonly [number, number][][],
  view?: Box,
): { at: [number, number]; length: number } | null {
  let best: [number, number][] = [];
  let bestLength = -1;
  for (const line of points) {
    let run: [number, number][] = [];
    let length = 0;
    const close = (): void => {
      if (run.length && length > bestLength) {
        bestLength = length;
        best = run;
      }
      run = [];
      length = 0;
    };
    for (const point of line) {
      if (view && !inside(view, point)) {
        close();
        continue;
      }
      const last = run[run.length - 1];
      if (last) length += Math.hypot(point[0] - last[0], point[1] - last[1]);
      run.push(point);
    }
    close();
  }
  if (!best.length) return null;
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

interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}

const collide = (a: Slot, b: Slot, pad: number): boolean =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + pad;

/**
 * Todos los trazos. Sólo se vuelve a pintar si cambia la selección, el color o
 * la ruta elegida; el grosor sigue al acercamiento por la variable CSS `--lw`
 * del `<g>` padre, que no pasa por React.
 */
const RoadLines = memo(function RoadLines({
  drawn,
  onIds,
  filtering,
  route,
  colorBy,
}: {
  drawn: readonly Drawn[];
  onIds: ReadonlySet<string>;
  filtering: boolean;
  route: string | null;
  colorBy: RoadColorBy;
}) {
  return (
    <>
      {drawn.map(({ section, d }) => {
        const lit = onIds.has(section.sectionId);
        const chosen = route !== null && section.route === route;
        const width = chosen ? WIDTH[section.network] + 1.6 : WIDTH[section.network];
        return (
          <path
            key={section.sectionId}
            d={d}
            stroke={colorBy === 'red' ? NETWORK_COLOR[section.network] : GROUP_COLOR[SURFACE_GROUP[section.surface]]!}
            style={{
              strokeWidth: `calc(${width}px * var(--lw, 1) * var(--ppx, 1))`,
              strokeDasharray:
                section.status === 'EN_CONSTRUCCION' ? 'calc(5px * var(--ppx, 1)) calc(3px * var(--ppx, 1))' : undefined,
            }}
            opacity={filtering && !lit ? 0.1 : section.network === 'SIN_REFERENCIA' ? 0.7 : 0.95}
          />
        );
      })}
    </>
  );
});

/**
 * La capa que recibe el puntero: ancha e invisible, porque un trazo de un
 * píxel no se puede apuntar. Sólo lo que está en la selección.
 */
const RoadHits = memo(function RoadHits({
  on,
  onTrack,
  onPick,
}: {
  on: readonly Drawn[];
  onTrack: (event: ReactPointerEvent<SVGPathElement>, id: string) => void;
  onPick: (section: RoadSection) => void;
}) {
  return (
    <>
      {on.map(({ section, d }) => (
        <path
          key={section.sectionId}
          d={d}
          onPointerMove={(event) => onTrack(event, section.sectionId)}
          onPointerDown={(event) => onTrack(event, section.sectionId)}
          onClick={() => onPick(section)}
          style={{ cursor: section.route ? 'pointer' : undefined }}
        />
      ))}
    </>
  );
});

export function RoadsMap({
  sections,
  matches,
  route,
  colorBy,
  zoomTo,
  frameKey,
  onPickRoute,
}: {
  sections: readonly RoadSection[];
  /** Si el tramo entra en la selección del lector; el resto se atenúa. */
  matches: (section: RoadSection) => boolean;
  route: string | null;
  colorBy: RoadColorBy;
  /** Si el recorte actual pide acercar el mapa a lo elegido. */
  zoomTo: boolean;
  /**
   * Lo que identifica el encuadre: cuando cambia, la cámara que el lector
   * movió a mano se suelta y el mapa vuelve a encuadrar lo elegido.
   */
  frameKey: string;
  onPickRoute: (route: string) => void;
}) {
  const [hover, setHover] = useState<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const drawn = useMemo<Drawn[]>(
    () =>
      [...sections]
        .sort((left, right) => LAYER[left.network] - LAYER[right.network])
        .map((section) => {
          const points = section.geometry.map((line) => line.map((point) => projectRoadPoint(point)));
          const d = points
            .map((line) => `M${line.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}`)
            .join(' ');
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (const line of points) {
            for (const [x, y] of line) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
          return { section, d, points, bounds: [minX, minY, maxX, maxY] as [number, number, number, number] };
        }),
    [sections],
  );
  const byId = useMemo(() => new Map(drawn.map((one) => [one.section.sectionId, one])), [drawn]);

  const on = useMemo(() => drawn.filter((one) => matches(one.section)), [drawn, matches]);
  const filtering = on.length !== drawn.length;
  const onIds = useMemo(() => new Set(on.map((one) => one.section.sectionId)), [on]);

  /* El encuadre que pide lo elegido; la cámara del lector lo reemplaza al moverla. */
  const home = useMemo<Box>(() => {
    if (!zoomTo || !on.length) return FULL;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [ax, ay, bx, by] of on.map((one) => one.bounds)) {
      if (ax < minX) minX = ax;
      if (ay < minY) minY = ay;
      if (bx > maxX) maxX = bx;
      if (by > maxY) maxY = by;
    }
    return Number.isFinite(minX) ? fitBox(minX, minY, maxX, maxY) : FULL;
  }, [zoomTo, on]);

  const camera = useMapCamera(home, frameKey);
  const { view, zoom } = camera;
  /* Cuántas unidades del plano mide un píxel «de diseño»: lo que mantiene
     rótulos y escudos del mismo tamaño en pantalla al acercar. */
  const unit = Math.max(view.width / MAP_BOX.width, view.height / MAP_BOX.height);
  const zoomed = zoom > 1.6;
  /* Grosor: afina el detalle al acercar, con tope, sin que la maraña engorde de más. */
  const lineScale = Math.min(2.4, 1 + 0.3 * Math.log2(Math.max(zoom, 1)));
  /* Unidades del plano que mide un píxel de pantalla: con él el grosor no depende del acercamiento. */
  const perPixel = view.width / (camera.pixels || 700);

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

  /*
   * Escudos y nombres se calculan sobre la vista «diferida»: recorrer los
   * vértices de toda la red en cada fotograma de un arrastre no es gratis, y
   * React deja que el mapa se mueva primero y los rótulos lo alcancen después.
   */
  const labelView = useDeferredValue(view);
  const labelUnit = Math.max(labelView.width / MAP_BOX.width, labelView.height / MAP_BOX.height);
  const labelZoom = FULL.width / labelView.width;

  const labels = useMemo(() => {
    const unit_ = labelUnit;
    const seen = on.filter((one) => touches(labelView, one.bounds));

    /* Las capitales y su nombre, a la derecha del punto, son obstáculos fijos. */
    const taken: Slot[] = CAPITALS.map((capital) => {
      const [x, y] = projectRoadPoint(capital.at);
      const w = (capital.name.length * 7 + 14) * unit_;
      return { x: x + w / 2 - 4 * unit_, y: y - 6 * unit_, w, h: 16 * unit_ };
    });

    /* Un escudo por ruta, en el trozo más largo de ella que está a la vista. A escala de país sólo la
       Fundamental lleva escudo; acercado, también la Departamental. */
    const best = new Map<string, { at: [number, number]; length: number; network: RoadSection['network'] }>();
    for (const one of seen) {
      const key = one.section.route;
      if (!key) continue;
      if (labelZoom <= 1.6 && one.section.network !== 'FUNDAMENTAL') continue;
      const anchor = anchorOf(one.points, labelView);
      if (!anchor) continue;
      const held = best.get(key);
      if (!held || anchor.length > held.length) best.set(key, { ...anchor, network: one.section.network });
    }
    const order = [...best.entries()].sort(
      (left, right) => (routeTotals.get(right[0])?.km ?? 0) - (routeTotals.get(left[0])?.km ?? 0),
    );
    const shields: { route: string; at: [number, number]; network: RoadSection['network'] }[] = [];
    const gap = 38 * unit_;
    for (const [key, anchor] of order) {
      const slot: Slot = { x: anchor.at[0], y: anchor.at[1], w: (key.length * 7.4 + 10) * unit_, h: 17 * unit_ };
      if (key === route) {
        shields.unshift({ route: key, at: anchor.at, network: anchor.network });
        taken.push(slot);
        continue;
      }
      const clash =
        taken.some((spot) => collide(spot, slot, 4 * unit_)) ||
        shields.some(
          (other) => Math.abs(other.at[0] - anchor.at[0]) < gap && Math.abs(other.at[1] - anchor.at[1]) < gap * 0.6,
        );
      if (clash) continue;
      shields.push({ route: key, at: anchor.at, network: anchor.network });
      taken.push(slot);
    }

    /* Con la lupa puesta, el nombre de cada vía: es lo que deja leer una ruta tramo a tramo. */
    const names: { key: string; text: string; at: [number, number] }[] = [];
    if (labelZoom >= 4) {
      const candidates: { key: string; text: string; at: [number, number]; length: number }[] = [];
      const done = new Set<string>();
      for (const one of seen) {
        const text = one.section.name;
        if (!text || done.has(text)) continue;
        const anchor = anchorOf(one.points, labelView);
        if (!anchor || anchor.length < 70 * unit_) continue;
        done.add(text);
        candidates.push({
          key: one.section.sectionId,
          text: text.length > 30 ? `${text.slice(0, 29)}…` : text,
          at: anchor.at,
          length: anchor.length,
        });
      }
      candidates.sort((left, right) => right.length - left.length);
      for (const candidate of candidates) {
        if (names.length >= 28) break;
        const slot: Slot = {
          x: candidate.at[0],
          y: candidate.at[1] - 9 * unit_,
          w: candidate.text.length * 5.8 * unit_,
          h: 12 * unit_,
        };
        if (taken.some((spot) => collide(spot, slot, 3 * unit_))) continue;
        taken.push(slot);
        names.push({ key: candidate.key, text: candidate.text, at: [candidate.at[0], candidate.at[1] - 5 * unit_] });
      }
    }
    return { shields, names };
  }, [on, labelView, labelUnit, labelZoom, routeTotals, route]);

  const hovered = hover && !camera.panning ? byId.get(hover.id) : undefined;

  const onTrack = useCallback((event: ReactPointerEvent<SVGPathElement>, id: string): void => {
    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!box) return;
    setHover({ id, x: event.clientX - box.left, y: event.clientY - box.top, width: box.width, height: box.height });
  }, []);

  const { consumeDrag } = camera;
  const onPickSection = useCallback(
    (section: RoadSection) => {
      // El clic que cierra un arrastre no aísla nada.
      if (consumeDrag()) return;
      if (section.route) onPickRoute(section.route);
    },
    [consumeDrag, onPickRoute],
  );

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

  const tipBelow = hover ? hover.y < hover.height * 0.55 : true;

  return (
    <figure className="roads-map-wrap">
      <div
        className="roads-map-stage"
        role="group"
        onPointerLeave={() => setHover(null)}
        aria-label="Mapa de la red vial. Teclas más y menos para acercar, flechas para moverse, cero para volver."
        {...camera.stageProps}
      >
        <svg
          ref={camera.svgRef}
          viewBox={`${view.x.toFixed(2)} ${view.y.toFixed(2)} ${view.width.toFixed(2)} ${view.height.toFixed(2)}`}
          role="img"
          aria-label="Red vial principal de Bolivia"
          className="roads-map"
          {...camera.svgProps}
          style={{ ...camera.svgProps.style, '--ppx': perPixel, '--lw': lineScale } as CSSProperties}
          onPointerDown={(event) => {
            // Un toque fuera de las vías cierra la ficha: con el dedo no hay «sacar el cursor».
            if (!(event.target as Element).closest('.roads-map-hits')) setHover(null);
            camera.svgProps.onPointerDown(event);
          }}
        >
          <g className="roads-map-departments">
            {DEPARTMENTS.map((one) => (
              <path key={one.code} d={one.path} />
            ))}
          </g>

          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <RoadLines drawn={drawn} onIds={onIds} filtering={filtering} route={route} colorBy={colorBy} />
            {hovered ? (
              <path
                d={hovered.d}
                className="roads-map-hover"
                style={{ strokeWidth: `calc(${WIDTH[hovered.section.network] + 2.4}px * var(--lw, 1) * var(--ppx, 1))` }}
              />
            ) : null}
          </g>

          <g className="roads-map-hits">
            <RoadHits on={on} onTrack={onTrack} onPick={onPickSection} />
          </g>

          {/* Los nombres de departamento, encima de las vías y con halo: debajo,
              la red los tapaba y se leía «PAZ» y «URO». Con el mapa acercado
              estorban más de lo que orientan. */}
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

          <g className="roads-map-names" aria-hidden="true">
            {labels.names.map((name) => (
              <text key={name.key} x={name.at[0]} y={name.at[1]} fontSize={11 * labelUnit}>
                {name.text}
              </text>
            ))}
          </g>

          <g className="roads-map-shields" aria-hidden="true">
            {labels.shields.map((shield) => {
              const width = (shield.route.length * 7.4 + 10) * labelUnit;
              const height = 17 * labelUnit;
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
                    rx={3.5 * labelUnit}
                  />
                  <text x={shield.at[0]} y={shield.at[1] + 4.3 * labelUnit} fontSize={12 * labelUnit}>
                    {shield.route}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <MapTools camera={camera} homeLabel={zoomTo && home !== FULL ? 'Encuadre' : 'Todo el país'} />

        {hovered && hover ? (
          <div
            className="map-tip roads-map-tip"
            style={{
              left: hover.x > hover.width * 0.6 ? undefined : hover.x + 14,
              right: hover.x > hover.width * 0.6 ? hover.width - hover.x + 14 : undefined,
              top: tipBelow ? hover.y + 14 : undefined,
              bottom: tipBelow ? undefined : hover.height - hover.y + 14,
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
        Rueda del ratón, pellizco o doble clic para acercar; arrastra para moverte. Pasa el cursor por
        una vía para ver qué es y haz clic para aislar su ruta. Elegir un departamento o una ruta en la
        lista acerca el mapa. Geometría © OpenStreetMap.
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
      <b className="map-card-name">{section.route ? `Ruta ${section.route}` : 'Vía sin código de ruta'}</b>
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
      <div className="t-row">
        <span>Clase en OpenStreetMap</span>
        <strong>{CLASS_LABEL[section.highwayClass] ?? section.highwayClass}</strong>
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

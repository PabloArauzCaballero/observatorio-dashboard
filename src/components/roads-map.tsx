'use client';

import { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { DEPARTMENTS, MAP_BOX, PLACE_POINTS, projectRoadPoint } from '@/lib/bolivia-map';
import type { RoadSection } from '@/lib/roads';
import { NETWORKS, SURFACE_GROUP, SURFACE_GROUPS, departmentName } from '@/lib/roads-board';
import { streetKey } from '@/lib/street-names';
import { STREET_CLASS_LABEL, STREET_SURFACE_LABEL } from '@/lib/street-types';
import type { LonLatBox } from '@/lib/street-types';
import { ChartLegend } from './charts';
import type { LegendItem } from './charts';
import { FULL, MapTools, fitBox, useMapCamera } from './map-camera';
import type { Box } from './map-camera';
import { StreetsCanvas, nearestWay, useStreetCells } from './streets-layer';
import type { UrbanWay } from './streets-layer';

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

/** Cuánto pesa una clase para rotularla: 0 primero (se rotula desde más lejos), 3 última. */
const LABEL_RANK: Record<string, number> = {
  motorway: 0,
  trunk: 0,
  primary: 0,
  secondary: 1,
  tertiary: 2,
  unclassified: 3,
  residential: 3,
  living_street: 3,
  service: 3,
  track: 3,
  road: 3,
};

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
  /** La clave de búsqueda de su nombre («avenida circunvalacion»), o null si no tiene. */
  street: string | null;
  /** `[minX, minY, maxX, maxY]` en el plano: para descartar de un vistazo lo que cae fuera de la vista. */
  bounds: [number, number, number, number];
}

const inside = (box: Box, [x, y]: [number, number]): boolean =>
  x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

const touches = (box: Box, [minX, minY, maxX, maxY]: [number, number, number, number]): boolean =>
  maxX >= box.x && minX <= box.x + box.width && maxY >= box.y && minY <= box.y + box.height;

/** Recorta un segmento contra la vista: los extremos recortados y si cada uno era el original. */
function clipSegment(
  a: [number, number],
  b: [number, number],
  box: Box,
): [[number, number], [number, number], boolean, boolean] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, a[0] - box.x],
    [dx, box.x + box.width - a[0]],
    [-dy, a[1] - box.y],
    [dy, box.y + box.height - a[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [
    [a[0] + dx * t0, a[1] + dy * t0],
    [a[0] + dx * t1, a[1] + dy * t1],
    t0 === 0,
    t1 === 1,
  ];
}

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
): { at: [number, number]; length: number; run: [number, number][] } | null {
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
    for (let index = 0; index < line.length; index += 1) {
      const point = line[index]!;
      if (!view) {
        const last = run[run.length - 1];
        if (last) length += Math.hypot(point[0] - last[0], point[1] - last[1]);
        run.push(point);
        continue;
      }
      // Con vista, cada segmento se recorta contra ella: una vía simplificada tiene
      // vértices a cientos de metros, y a ×20 sus extremos caen fuera aunque el
      // segmento cruce la pantalla entera.
      const previous = line[index - 1];
      if (!previous) continue;
      const clipped = clipSegment(previous, point, view);
      if (!clipped) {
        close();
        continue;
      }
      const [from, to, startsInside, endsInside] = clipped;
      if (!startsInside) close();
      if (!run.length) run.push(from);
      length += Math.hypot(to[0] - run[run.length - 1]![0], to[1] - run[run.length - 1]![1]);
      run.push(to);
      if (!endsInside) close();
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
      return { at: [ax + (bx - ax) * t, ay + (by - ay) * t], length: bestLength, run: best };
    }
    walked += step;
  }
  return { at: best[0] ?? [0, 0], length: Math.max(0, bestLength), run: best };
}

/**
 * El pedazo de una corrida que mide `span`, centrado en su punto medio: es el
 * camino sobre el que se escribe el nombre, y su caja la que ocupa en el plano.
 * Va de izquierda a derecha para que el texto no salga boca abajo.
 */
function windowOf(run: readonly [number, number][], span: number): [number, number][] {
  let total = 0;
  for (let index = 1; index < run.length; index += 1) {
    total += Math.hypot(run[index]![0] - run[index - 1]![0], run[index]![1] - run[index - 1]![1]);
  }
  const from = Math.max(0, total / 2 - span / 2);
  const to = Math.min(total, total / 2 + span / 2);
  const out: [number, number][] = [];
  let walked = 0;
  for (let index = 1; index < run.length; index += 1) {
    const [ax, ay] = run[index - 1]!;
    const [bx, by] = run[index]!;
    const step = Math.hypot(bx - ax, by - ay);
    const start = walked;
    const end = walked + step;
    walked = end;
    if (end < from || start > to || step === 0) continue;
    const t0 = Math.max(0, (from - start) / step);
    const t1 = Math.min(1, (to - start) / step);
    if (!out.length) out.push([ax + (bx - ax) * t0, ay + (by - ay) * t0]);
    out.push([ax + (bx - ax) * t1, ay + (by - ay) * t1]);
  }
  if (out.length >= 2 && out[0]![0] > out[out.length - 1]![0]) out.reverse();
  return out;
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
  street,
  colorBy,
}: {
  drawn: readonly Drawn[];
  onIds: ReadonlySet<string>;
  filtering: boolean;
  route: string | null;
  street: string | null;
  colorBy: RoadColorBy;
}) {
  return (
    <>
      {drawn.map(({ section, d, street: own }) => {
        const lit = onIds.has(section.sectionId);
        const chosen = (route !== null && section.route === route) || (street !== null && own === street);
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
  street,
  streetBounds,
  focus,
  onPickRoute,
  onPickStreet,
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
  /** La calle aislada (su clave de búsqueda), o null. */
  street: string | null;
  /** Si la calle la eligió una ciudad concreta, la caja que la limita; si no, null. */
  streetBounds: LonLatBox | null;
  /** Una caja a la que acercar el mapa cuando lo elegido no está en los tramos nacionales. */
  focus: LonLatBox | null;
  onPickRoute: (route: string) => void;
  onPickStreet: (street: string) => void;
}) {
  const [hover, setHover] = useState<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [urbanHover, setUrbanHover] = useState<{
    item: UrbanWay;
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
          return { section, d, points, street: streetKey(section.name), bounds: [minX, minY, maxX, maxY] as [number, number, number, number] };
        }),
    [sections],
  );
  const byId = useMemo(() => new Map(drawn.map((one) => [one.section.sectionId, one])), [drawn]);

  const on = useMemo(() => drawn.filter((one) => matches(one.section)), [drawn, matches]);
  const filtering = on.length !== drawn.length;
  const onIds = useMemo(() => new Set(on.map((one) => one.section.sectionId)), [on]);

  /* El encuadre que pide lo elegido; la cámara del lector lo reemplaza al moverla. */
  const home = useMemo<Box>(() => {
    if (zoomTo && focus) {
      const [x0, y0] = projectRoadPoint([focus[0], focus[3]]);
      const [x1, y1] = projectRoadPoint([focus[2], focus[1]]);
      return fitBox(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), 0.12, 12);
    }
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
  }, [zoomTo, on, focus]);

  const camera = useMapCamera(home, frameKey);
  const urban = useStreetCells(camera.view, true);
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

  /** Por calle (clave de búsqueda), lo que la selección tiene de ella: la cifra de la ficha. */
  const streetTotals = useMemo(() => {
    const totals = new Map<string, { km: number; paved: number; ways: number }>();
    for (const one of on) {
      if (!one.street) continue;
      const entry = totals.get(one.street) ?? { km: 0, paved: 0, ways: 0 };
      entry.km += one.section.lengthKm;
      entry.ways += 1;
      if (one.section.surface === 'PAVIMENTO') entry.paved += one.section.lengthKm;
      totals.set(one.street, entry);
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

    /*
     * El nombre de cada vía, escrito a lo largo de ella y sin pisar nada. Aparece según la clase:
     * las troncales y primarias desde ×2,5, las secundarias y las rutas con código desde ×4 y
     * las calles menores desde ×7, cuando ya caben. Una vía corta no lleva su nombre si éste
     * no entra en ella: un rótulo desbordado se lee peor que ninguno.
     */
    const names: { key: string; text: string; d: string; size: number }[] = [];
    const fontSize = 11 * unit_;
    const candidates: { key: string; text: string; run: [number, number][]; length: number; rank: number }[] = [];
    for (const one of seen) {
      const text = one.section.name;
      if (!text) continue;
      const rank = LABEL_RANK[one.section.highwayClass] ?? 3;
      const needs = rank === 0 ? 2.5 : rank === 1 ? 4 : rank === 2 ? 7 : 12;
      if (labelZoom < needs) continue;
      const anchor = anchorOf(one.points, labelView);
      if (!anchor) continue;
      const width = text.length * 5.7 * unit_;
      if (anchor.length < width * 1.05) continue;
      candidates.push({ key: one.section.sectionId, text, run: anchor.run, length: anchor.length, rank });
    }
    // Las calles de las ciudades, sólo las nombradas y las más largas: son miles y caben decenas.
    const nearest = urban.ways
      .filter((item) => item.way.name && touches(labelView, item.box))
      .sort((left, right) => right.way.km - left.way.km)
      .slice(0, 300);
    for (const item of nearest) {
      const text = item.way.name;
      if (!text) continue;
      const line: [number, number][] = [];
      for (let index = 0; index < item.points.length; index += 2) {
        line.push([item.points[index]!, item.points[index + 1]!]);
      }
      const anchor = anchorOf([line], labelView);
      if (!anchor || anchor.length < text.length * 5.7 * unit_ * 1.05) continue;
      candidates.push({ key: `u${item.way.id}`, text, run: anchor.run, length: anchor.length, rank: 3 });
    }
    candidates.sort((left, right) => left.rank - right.rank || right.length - left.length);
    const seenText = new Map<string, number>();
    for (const candidate of candidates) {
      if (names.length >= 90) break;
      // La misma calle dos veces a la vista basta; diez, no.
      if ((seenText.get(candidate.text) ?? 0) >= 2) continue;
      const piece = windowOf(candidate.run, candidate.text.length * 5.7 * unit_);
      if (piece.length < 2) continue;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [x, y] of piece) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      const slot: Slot = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        w: maxX - minX + 4 * unit_,
        h: maxY - minY + fontSize,
      };
      if (taken.some((spot) => collide(spot, slot, 2 * unit_))) continue;
      taken.push(slot);
      seenText.set(candidate.text, (seenText.get(candidate.text) ?? 0) + 1);
      names.push({
        key: candidate.key,
        text: candidate.text,
        d: `M${piece.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}`,
        size: fontSize,
      });
    }
    return { shields, names };
  }, [on, labelView, labelUnit, labelZoom, routeTotals, route, urban.ways]);

  const hovered = hover && !camera.panning ? byId.get(hover.id) : undefined;
  const urbanStyle = useMemo(
    () => ({
      colorBy,
      neutral: NETWORK_COLOR.SIN_REFERENCIA,
      groups: {
        PAVIMENTADA: GROUP_COLOR.PAVIMENTADA!,
        RIPIO: GROUP_COLOR.RIPIO!,
        TIERRA: GROUP_COLOR.TIERRA!,
        SIN_DATO: GROUP_COLOR.SIN_DATO!,
      },
      ink: 'var(--ink)',
    }),
    [colorBy],
  );

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
      const key = streetKey(section.name);
      if (section.route) onPickRoute(section.route);
      else if (key) onPickStreet(key);
    },
    [consumeDrag, onPickRoute, onPickStreet],
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

  /*
   * La leyenda es la de todo gráfico del tablero (`ChartLegend`): así viaja dentro de la
   * imagen que baja el panel. Las calles de las ciudades se dibujan en un lienzo aparte
   * y no entran en esa imagen, por eso su aviso va en el pie del mapa y no aquí.
   */
  const legendItems: LegendItem[] = [
    ...legend.map(
      (entry): LegendItem => ({
        label: `${entry.label} · ${Math.round(entry.km).toLocaleString('es-BO')} km`,
        color: entry.color,
        shape: 'line',
      }),
    ),
    { label: 'En construcción', color: 'var(--ink-faint)', shape: 'line', dashed: true },
    { label: 'Capital de departamento', color: 'var(--ink)' },
  ];

  const tipBelow = hover ? hover.y < hover.height * 0.55 : true;

  return (
    <figure className="roads-map-wrap">
      <div
        className="roads-map-stage"
        role="group"
        onPointerLeave={() => {
          setHover(null);
          setUrbanHover(null);
        }}
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
            if (!(event.target as Element).closest('.roads-map-hits')) {
              setHover(null);
              setUrbanHover(null);
            }
            camera.svgProps.onPointerDown(event);
          }}
          onPointerMove={(event) => {
            camera.svgProps.onPointerMove(event);
            // Con un botón apretado es un arrastre: buscar la calle bajo el cursor frena cada fotograma.
            if (!urban.ways.length || event.buttons !== 0) return;
            // Sobre una vía nacional manda su ficha; la urbana sólo habla donde no hay otra.
            if ((event.target as Element).closest('.roads-map-hits')) {
              if (urbanHover) setUrbanHover(null);
              return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            const perPixel = view.width / rect.width;
            const found = nearestWay(
              urban.ways,
              view.x + (event.clientX - rect.left) * perPixel,
              view.y + (event.clientY - rect.top) * perPixel,
              9 * perPixel,
            );
            if (!found) {
              if (urbanHover) setUrbanHover(null);
              return;
            }
            setUrbanHover({
              item: found,
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              width: rect.width,
              height: rect.height,
            });
          }}
          onClick={() => {
            if (camera.consumeDrag()) return;
            const key = urbanHover?.item.key;
            if (key) onPickStreet(key);
          }}
        >
          <g className="roads-map-departments">
            {DEPARTMENTS.map((one) => (
              <path key={one.code} d={one.path} />
            ))}
          </g>

          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <RoadLines drawn={drawn} onIds={onIds} filtering={filtering} route={route} street={street} colorBy={colorBy} />
            {hovered ? (
              <path
                d={hovered.d}
                className="roads-map-hover"
                style={{ strokeWidth: `calc(${WIDTH[hovered.section.network] + 2.4}px * var(--lw, 1) * var(--ppx, 1))` }}
              />
            ) : null}
          </g>

          {/* Las zonas sensibles al cursor no se dibujan: fuera de la imagen que baja el panel. */}
          <g className="roads-map-hits" data-export="skip">
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

          <defs>
            {labels.names.map((name) => (
              <path key={name.key} id={`rn-${name.key}`} d={name.d} />
            ))}
          </defs>
          <g className="roads-map-names" aria-hidden="true">
            {labels.names.map((name) => (
              <text key={name.key} fontSize={name.size}>
                <textPath href={`#rn-${name.key}`} startOffset="50%">
                  {name.text}
                </textPath>
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

        <StreetsCanvas
          ways={urban.ways}
          view={view}
          style={urbanStyle}
          highlight={street ? { key: street, bounds: streetBounds } : null}
          scale={Math.min(lineScale, 1.3)}
        />

        {urban.active ? (
          <div className="roads-map-urban-note" role="status" aria-live="polite">
            {urban.failed
              ? 'No se pudieron leer las calles'
              : urban.loading && !urban.ways.length
                ? 'Leyendo las calles…'
                : urban.ways.length
                  ? `${urban.ways.length.toLocaleString('es-BO')} calles a la vista${urban.truncated ? ' (acerca más para ver todas)' : ''}`
                  : 'Sin calles de ciudad en esta vista'}
          </div>
        ) : null}

        <MapTools camera={camera} homeLabel={zoomTo && home !== FULL ? 'Encuadre' : 'Todo el país'} />

        {urbanHover && !hovered && !camera.panning ? (
          <div
            className="map-tip roads-map-tip"
            style={{
              left: urbanHover.x > urbanHover.width * 0.6 ? undefined : urbanHover.x + 14,
              right: urbanHover.x > urbanHover.width * 0.6 ? urbanHover.width - urbanHover.x + 14 : undefined,
              top: urbanHover.y < urbanHover.height * 0.55 ? urbanHover.y + 14 : undefined,
              bottom: urbanHover.y < urbanHover.height * 0.55 ? undefined : urbanHover.height - urbanHover.y + 14,
            }}
            role="status"
            aria-live="polite"
          >
            <UrbanCard item={urbanHover.item} />
          </div>
        ) : null}

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
              street={hovered.street ? streetTotals.get(hovered.street) : undefined}
            />
          </div>
        ) : null}
      </div>

      <ChartLegend items={legendItems} />

      <figcaption className="roads-map-foot">
        Rueda del ratón, pellizco o doble clic para acercar; arrastra para moverte. Pasa el cursor por
        una vía para ver qué es y haz clic para aislar su ruta o su calle. Al acercarte a una ciudad
        aparecen sus calles (desde ×25, en gris fino); OpenStreetMap nombra sólo una de cada cuatro.
        La imagen que se descarga no incluye esas calles.
      </figcaption>
    </figure>
  );
}

/** Lo que dice la ficha de una vía: su ruta, su tramo y su rodadura. */
function RoadCard({
  section,
  total,
  street,
}: {
  section: RoadSection;
  total: { km: number; paved: number; departments: Set<string> } | undefined;
  street: { km: number; paved: number; ways: number } | undefined;
}) {
  const network = NETWORKS.find((one) => one.network === section.network)?.label ?? section.network;
  return (
    <div className="tooltip">
      <div className="t-date">{network}</div>
      <b className="map-card-name">
        {section.route ? `Ruta ${section.route}` : (section.name ?? 'Vía sin nombre en OpenStreetMap')}
      </b>
      {section.name && section.route ? <div className="roads-map-tip-name">{section.name}</div> : null}
      {!section.route && section.name ? <div className="roads-map-tip-name">Vía sin código de ruta</div> : null}
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
      {!total && street ? (
        <>
          <div className="t-row">
            <span>Toda la calle en la selección</span>
            <strong>{km(street.km)} km</strong>
          </div>
          <div className="t-row">
            <span>Pavimentada</span>
            <strong>{street.km > 0 ? Math.round((street.paved / street.km) * 100) : 0} %</strong>
          </div>
        </>
      ) : null}
      {section.status === 'EN_CONSTRUCCION' ? <div className="t-note">En construcción.</div> : null}
      {section.route ? <div className="t-note">Clic para aislar la ruta {section.route}.</div> : null}
      {!section.route && section.name ? <div className="t-note">Clic para aislar esta calle.</div> : null}
      {!section.route && !section.name ? (
        <div className="t-note">OpenStreetMap no le da nombre a esta vía.</div>
      ) : null}
    </div>
  );
}

/** Lo que dice la ficha de una calle de ciudad: su nombre, su clase, su rodadura y su largo. */
function UrbanCard({ item }: { item: UrbanWay }) {
  const way = item.way;
  return (
    <div className="tooltip">
      <div className="t-date">Calle de la ciudad</div>
      <b className="map-card-name">{way.name ?? 'Vía sin nombre en OpenStreetMap'}</b>
      <div className="t-row">
        <span>Clase en OpenStreetMap</span>
        <strong>{STREET_CLASS_LABEL[way.class]}</strong>
      </div>
      <div className="t-row">
        <span>Rodadura</span>
        <strong>{STREET_SURFACE_LABEL[way.surface]}</strong>
      </div>
      <div className="t-row">
        <span>Esta vía</span>
        <strong>{Math.round(way.km * 1000).toLocaleString('es-BO')} m</strong>
      </div>
      {item.department ? (
        <div className="t-row">
          <span>Departamento</span>
          <strong>{departmentName(item.department)}</strong>
        </div>
      ) : null}
      {way.name ? (
        <div className="t-note">Clic para aislar esta calle.</div>
      ) : (
        <div className="t-note">OpenStreetMap no le da nombre a esta vía.</div>
      )}
    </div>
  );
}

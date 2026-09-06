/**
 * Turns Bolivia's official boundaries into the outline the report draws.
 *
 * Run by hand, not by the build: the source is a release of a public dataset
 * that changes when a department changes, which is to say almost never, and a
 * report that fetched a map at build time would fail to build the day that host
 * is down. The output is committed, small and readable.
 *
 *   node scripts/build-bolivia-map.mjs <adm1.geojson> <adm3.geojson>
 *
 * Both files come from geoBoundaries (gbOpen, release 9469f09), which
 * redistributes the boundaries published by the Bolivian state geoportal
 * geo.gob.bo under public domain terms. ADM1 gives the nine departments, ADM3
 * the municipalities — needed because El Alto is a city the register measures
 * on its own and not a department.
 */

import { readFileSync, writeFileSync } from 'node:fs';

/** Simplification tolerance, in degrees. Under a pixel at the width we draw. */
const TOLERANCE = 0.012;

/** Rings whose bounding box is smaller than this vanish at our scale anyway. */
const MIN_RING_SPAN = 0.06;

/** The drawing box. Height follows from Bolivia's shape, not from a guess. */
const WIDTH = 1000;

/**
 * Equirectangular, with the scale set at Bolivia's middle latitude.
 *
 * A degree of longitude is shorter than a degree of latitude everywhere but the
 * equator, and drawing them as equal would stretch the country sideways.
 * Correcting by the cosine of one middle parallel is exact on that parallel and
 * within a percent over the eleven degrees the country spans, which is finer
 * than the outline itself.
 */
const MID_LATITUDE = -16.5;
const LON_SCALE = Math.cos((MID_LATITUDE * Math.PI) / 180);

/** The department codes the register uses, keyed by the boundary's own name. */
const DEPARTMENT_CODE = {
  Beni: 'BENI',
  Chuquisaca: 'CHUQUISACA',
  Cochabamba: 'COCHABAMBA',
  'La Paz': 'LA_PAZ',
  Oruro: 'ORURO',
  Pando: 'PANDO',
  Potosí: 'POTOSI',
  'Santa Cruz': 'SANTA_CRUZ',
  Tarija: 'TARIJA',
};

/** Municipalities the register names on their own, keyed by boundary name. */
const MUNICIPALITY_CODE = { 'El Alto': 'EL_ALTO' };

function ringsOf(geometry) {
  return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat(1);
}

/** Perpendicular distance from a point to the segment ab, in degrees. */
function distanceToSegment(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(point[0] - (a[0] + clamped * dx), point[1] - (a[1] + clamped * dy));
}

/** Ramer-Douglas-Peucker: keeps the vertices that carry the shape. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = distanceToSegment(points[i], points[0], points[points.length - 1]);
    if (distance > worst) {
      worst = distance;
      index = i;
    }
  }
  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

/** A ring's area, and the point its area balances on. */
function ringCentroid(ring) {
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    twiceArea += cross;
    x += (ring[j][0] + ring[i][0]) * cross;
    y += (ring[j][1] + ring[i][1]) * cross;
  }
  if (twiceArea === 0) return { area: 0, lon: ring[0][0], lat: ring[0][1] };
  return { area: Math.abs(twiceArea) / 2, lon: x / (3 * twiceArea), lat: y / (3 * twiceArea) };
}

/** The centre of the largest ring, which is the mainland of the shape. */
function centreOf(geometry) {
  let best = { area: -1, lon: 0, lat: 0 };
  for (const ring of ringsOf(geometry)) {
    const centre = ringCentroid(ring);
    if (centre.area > best.area) best = centre;
  }
  return best;
}

/** Ray casting, to check a centre did not land outside its own department. */
function inside(point, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = yi > point[1] !== yj > point[1];
    if (straddles && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const [adm1Path, adm3Path] = process.argv.slice(2);
if (!adm1Path || !adm3Path)
  throw new Error('uso: build-bolivia-map.mjs <adm1.geojson> <adm3.geojson>');

const adm1 = JSON.parse(readFileSync(adm1Path, 'utf8'));
const adm3 = JSON.parse(readFileSync(adm3Path, 'utf8'));

const shapes = [];
for (const feature of adm1.features) {
  const code = DEPARTMENT_CODE[feature.properties.shapeName];
  if (!code) throw new Error(`departamento desconocido: ${feature.properties.shapeName}`);
  const rings = ringsOf(feature.geometry)
    .filter((ring) => {
      const lons = ring.map((point) => point[0]);
      const lats = ring.map((point) => point[1]);
      const span = Math.max(
        Math.max(...lons) - Math.min(...lons),
        Math.max(...lats) - Math.min(...lats),
      );
      return span >= MIN_RING_SPAN;
    })
    .map((ring) => simplify(ring, TOLERANCE));
  shapes.push({
    code,
    name: feature.properties.shapeName,
    rings,
    centre: centreOf(feature.geometry),
  });
}
shapes.sort((left, right) => left.code.localeCompare(right.code));

const points = [];
for (const feature of adm3.features) {
  const code = MUNICIPALITY_CODE[feature.properties.shapeName];
  if (!code) continue;
  points.push({
    code,
    name: feature.properties.shapeName,
    kind: 'municipio',
    ...centreOf(feature.geometry),
  });
}
for (const [name, code] of Object.entries(MUNICIPALITY_CODE)) {
  if (!points.some((point) => point.code === code)) throw new Error(`falta el municipio: ${name}`);
}
for (const shape of shapes) {
  points.push({ code: shape.code, name: shape.name, kind: 'departamento', ...shape.centre });
}
points.sort((left, right) => left.code.localeCompare(right.code));

// The box is whatever the country occupies, so no margin is invented for it.
const vertices = shapes.flatMap((shape) => shape.rings.flat());
const minLon = Math.min(...vertices.map((point) => point[0]));
const maxLon = Math.max(...vertices.map((point) => point[0]));
const minLat = Math.min(...vertices.map((point) => point[1]));
const maxLat = Math.max(...vertices.map((point) => point[1]));
const scale = WIDTH / ((maxLon - minLon) * LON_SCALE);
const HEIGHT = Math.round((maxLat - minLat) * scale);

const projectX = (lon) => Number(((lon - minLon) * LON_SCALE * scale).toFixed(1));
const projectY = (lat) => Number(((maxLat - lat) * scale).toFixed(1));

function pathOf(rings) {
  return rings
    .map(
      (ring) => `M${ring.map((point) => `${projectX(point[0])} ${projectY(point[1])}`).join('L')}Z`,
    )
    .join('');
}

for (const point of points) {
  if (point.kind !== 'departamento') continue;
  const shape = shapes.find((candidate) => candidate.code === point.code);
  if (!shape.rings.some((ring) => inside([point.lon, point.lat], ring))) {
    console.warn(`aviso: el centro de ${point.name} cae fuera de su propio contorno`);
  }
}

const header = `/**
 * Bolivia's outline, and the point each place the register names sits on.
 *
 * Generated by \`scripts/build-bolivia-map.mjs\` from geoBoundaries gbOpen
 * release 9469f09 (ADM1 and ADM3), which redistributes the boundaries the
 * Bolivian state geoportal geo.gob.bo publishes as public domain. Do not edit
 * by hand: rerun the script.
 *
 * Coordinates are already projected into the box below — equirectangular with
 * the scale set at 16.5 degrees south — so nothing projects anything at render
 * time. A department's point is the centre of its own area and not its capital:
 * the register files most readings by department, and putting the mark on the
 * capital would claim a city the reading never named.
 */

export const MAP_BOX = { width: ${WIDTH}, height: ${HEIGHT} } as const;

export interface MapShape {
  /** The code the register files, such as \`SANTA_CRUZ\`. */
  code: string;
  name: string;
  /** An SVG path in \`MAP_BOX\` coordinates. */
  path: string;
}

export interface MapPoint {
  code: string;
  name: string;
  kind: 'departamento' | 'municipio';
  x: number;
  y: number;
}
`;

const body = `${header}
export const DEPARTMENTS: MapShape[] = [
${shapes
  .map(
    (shape) =>
      `  { code: '${shape.code}', name: ${JSON.stringify(shape.name)}, path: '${pathOf(shape.rings)}' },`,
  )
  .join('\n')}
];

export const PLACE_POINTS: MapPoint[] = [
${points
  .map(
    (point) =>
      `  { code: '${point.code}', name: ${JSON.stringify(point.name)}, kind: '${point.kind}', x: ${projectX(point.lon)}, y: ${projectY(point.lat)} },`,
  )
  .join('\n')}
];
`;

writeFileSync('src/lib/bolivia-map.ts', body, 'utf8');
const vertexCount = shapes.reduce(
  (total, shape) => total + shape.rings.reduce((count, ring) => count + ring.length, 0),
  0,
);
console.log(
  `escrito src/lib/bolivia-map.ts: ${shapes.length} departamentos, ${points.length} puntos, ` +
    `${vertexCount} vertices, caja ${WIDTH}x${HEIGHT}`,
);

/**
 * Turns the world's country outlines into the map the trade chapter draws.
 *
 * Run by hand, not by the build, for the same reason as `build-bolivia-map.mjs`:
 * borders change almost never, and a report that fetched a map at build time
 * would fail to build the day that host is down. The output is committed.
 *
 *   node scripts/build-world-map.mjs <countries-110m.json> <countries.json>
 *
 * - `countries-110m.json` is world-atlas 2.0.2 (Natural Earth 1:110m, public
 *   domain), a TopoJSON keyed by ISO 3166 numeric code:
 *   https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json
 * - `countries.json` is world-countries 5.1.0 (ODbL), used only for the
 *   Spanish common name, the alpha-3 code and a centre point for the small
 *   states the 1:110m outline leaves out (Singapore, Hong Kong…):
 *   https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json
 *
 * The projection is Equal Earth: equal-area, so a large country is not made to
 * look like a larger buyer than it is, which is the one thing a choropleth of
 * trade must not do.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const [, , topoPath, namesPath] = process.argv;
if (!topoPath || !namesPath) {
  console.error('usage: node scripts/build-world-map.mjs <countries-110m.json> <countries.json>');
  process.exit(1);
}

const WIDTH = 1000;

/** Antarctica buys nothing and takes a fifth of the height. */
const SKIP = new Set(['010']);

const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

function equalEarth(lon, lat) {
  const lambda = (lon * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const theta = Math.asin(M * Math.sin(phi));
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  const x = (lambda * Math.cos(theta)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  const y = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [x, -y];
}

const topo = JSON.parse(readFileSync(topoPath, 'utf8'));
const names = JSON.parse(readFileSync(namesPath, 'utf8'));
const byNumeric = new Map(names.filter((row) => row.ccn3).map((row) => [row.ccn3, row]));

const { scale, translate } = topo.transform;
const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});

function ring(indexes) {
  const out = [];
  for (const index of indexes) {
    const arc = index >= 0 ? arcs[index] : [...arcs[~index]].reverse();
    out.push(...(out.length ? arc.slice(1) : arc));
  }
  return out;
}

/**
 * A ring that crosses the antimeridian, folded onto one side of it.
 *
 * Natural Earth cuts Fiji and Chukotka at 180°, but a ring can still carry a
 * vertex at -179.9 next to one at 179.9, and drawn flat that pair is a stroke
 * across the whole map. Moving the minority side's points onto ±180 costs a
 * sliver of Chukotka and of Fiji's easternmost islets, invisible at 1:110m.
 */
function unwrap(points) {
  const crosses = points.some((point, index) => index > 0 && Math.abs(point[0] - points[index - 1][0]) > 180);
  if (!crosses) return points;
  const east = points.filter(([lon]) => lon > 0).length >= points.length / 2;
  return points.map(([lon, lat]) => [east ? (lon < 0 ? 180 : lon) : lon > 0 ? -180 : lon, lat]);
}

const shapes = [];
for (const geometry of topo.objects.countries.geometries) {
  if (!geometry.id || SKIP.has(geometry.id)) continue;
  const polygons =
    geometry.type === 'Polygon' ? [geometry.arcs] : geometry.type === 'MultiPolygon' ? geometry.arcs : [];
  const rings = polygons.flatMap((polygon) => polygon.map((indexes) => unwrap(ring(indexes))));
  if (!rings.length) continue;
  shapes.push({ id: geometry.id, rings: rings.map((r) => r.map(([lon, lat]) => equalEarth(lon, lat))) });
}

// The box follows from the projected shapes, not from a guess.
let minX = Infinity;
let minY = Infinity;
let maxX = -Infinity;
let maxY = -Infinity;
for (const shape of shapes) {
  for (const r of shape.rings) {
    for (const [x, y] of r) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
}
const k = WIDTH / (maxX - minX);
const HEIGHT = Math.ceil((maxY - minY) * k);
const fit = ([x, y]) => [Math.round((x - minX) * k * 10) / 10, Math.round((y - minY) * k * 10) / 10];

function pathOf(rings) {
  return rings
    .map((r) => {
      const points = r.map(fit);
      const kept = points.filter(
        (point, index) => index === 0 || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1],
      );
      return `M${kept.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
    })
    .join('');
}

const drawn = new Set(shapes.map((shape) => shape.id));
const countries = shapes
  .map((shape) => {
    const row = byNumeric.get(shape.id);
    return {
      iso3: row?.cca3 ?? `N${shape.id}`,
      name: row?.translations?.spa?.common ?? row?.name?.common ?? shape.id,
      path: pathOf(shape.rings),
    };
  })
  .sort((left, right) => left.iso3.localeCompare(right.iso3));

const points = names
  .filter((row) => row.ccn3 && !drawn.has(row.ccn3) && Array.isArray(row.latlng) && row.latlng.length === 2)
  .map((row) => {
    const [x, y] = fit(equalEarth(row.latlng[1], row.latlng[0]));
    return { iso3: row.cca3, name: row.translations?.spa?.common ?? row.name.common, x, y };
  })
  .sort((left, right) => left.iso3.localeCompare(right.iso3));

const out = `/**
 * The world's countries, projected once for the trade chapter's map.
 *
 * Generated by \`scripts/build-world-map.mjs\` from world-atlas 2.0.2 (Natural
 * Earth 1:110m, public domain) and world-countries 5.1.0 (ODbL, for the Spanish
 * names). Do not edit by hand: rerun the script.
 *
 * Coordinates are already in \`WORLD_BOX\`, Equal Earth projection, Antarctica
 * left out. \`WORLD_POINTS\` are the states too small for the 1:110m outline,
 * drawn as a dot when they trade with Bolivia.
 */

export const WORLD_BOX = { width: ${WIDTH}, height: ${HEIGHT} } as const;

export interface WorldShape {
  /** ISO 3166 alpha-3, such as \`CHN\`. */
  iso3: string;
  /** Common name in Spanish. */
  name: string;
  /** An SVG path in \`WORLD_BOX\` coordinates. */
  path: string;
}

export interface WorldPoint {
  iso3: string;
  name: string;
  x: number;
  y: number;
}

export const WORLD_SHAPES: WorldShape[] = ${JSON.stringify(countries, null, 2)};

export const WORLD_POINTS: WorldPoint[] = ${JSON.stringify(points)};
`;

writeFileSync(new URL('../src/lib/world-map.ts', import.meta.url), out);
console.log(`${countries.length} shapes, ${points.length} points, box ${WIDTH}x${HEIGHT}, ${out.length} bytes`);

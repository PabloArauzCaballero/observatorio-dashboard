'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons';
import type { Place } from '@/lib/places';

/**
 * The places of one city, on the city.
 *
 * This drawing spent three versions without a basemap, on the argument that
 * several thousand shops draw the avenues on their own and that tiles mean
 * calling a third party on every pan. The first half of that was wrong. A
 * scatter of premises is a picture of where premises are dense, and a reader
 * who does not already carry Santa Cruz in their head cannot tell a ring road
 * from an edge of the data, cannot say which of two clusters is the centre, and
 * cannot find their own street. «No se ve la ciudad, porque no es un mapa» —
 * and it was not one.
 *
 * So there are tiles under the points now, from OpenStreetMap, which is what
 * makes the drawing legible as a place: streets, names, the river, the ring
 * roads the premises actually sit along. The cost is honest and stated — the
 * reader's browser asks openstreetmap.org for the squares of ground it is
 * looking at, and the attribution the licence requires is under the map.
 *
 * Everything else the map learned it keeps: the frame is the bulk of the
 * points rather than the extent of every one, so a mis-geocoded pharmacy forty
 * kilometres out cannot set the scale; it zooms, pans and says how far a
 * centimetre is; and it fits the screen it is read on.
 */

/**
 * Coordinates are Web Mercator, in the pixels of a world 256 wide.
 *
 * Not a choice of taste: raster tiles are cut on this grid, so drawing in any
 * other projection means the points and the streets under them disagree. One
 * unit here is one pixel at zoom 0; a tile at zoom z spans 256/2^z of them.
 */
const WORLD = 256;

/** The furthest in the tile pyramid goes, and the flattest a frame may be. */
const MAX_TILE_ZOOM = 19;
const MIN_ASPECT = 0.5;
const MAX_ASPECT = 1.25;

/**
 * How much wider than the city its frame may be.
 *
 * The frame wants the shape of the screen and the city has one of its own, and
 * neither can simply win: a landscape monitor asked for a frame three times
 * wider than tall, while obeying the city gave a portrait strip stranded in a
 * panel three times its width. It moves towards the screen and stops here.
 *
 * The bound is generous now, and it is the basemap that earned it. Before
 * there were streets underneath, ground with no premises on it was blank paper
 * and every extra centimetre of frame was a centimetre of nothing; now it is
 * the rest of the city — the road the shops are strung along, the river they
 * stop at — which is worth showing and is why anyone came to a map.
 */
const MOST_SPREAD = 2.6;

/** Metres across one pixel of a zoom-0 world, at the equator. */
const METRES_PER_UNIT = 156543.03392;

/** How far in and out the reader may go, against the city's own frame. */
const MAX_ZOOM = 250;
const MIN_ZOOM = 0.9;

/** The distances a scale bar is allowed to state, in kilometres. */
const SCALE_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100] as const;

/** Enough squares for any frame; past this something has gone wrong. */
const MOST_TILES = 80;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Dot {
  place: Place;
  x: number;
  y: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** Longitude and latitude into the tile grid's own pixels. */
function project(longitude: number, latitude: number): { x: number; y: number } {
  const lat = clamp(latitude, -85.05112878, 85.05112878);
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * WORLD,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * WORLD,
  };
}

/** Back again, for the scale bar, which needs to know where it is standing. */
function latitudeAt(y: number): number {
  const n = Math.PI - (2 * Math.PI * y) / WORLD;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/**
 * The value at a position in a sorted list, without sorting twice.
 *
 * Used to cut the extent at the 2nd and 98th percentile: enough to drop the
 * handful of points that are somewhere else entirely, never enough to drop a
 * real outskirt.
 */
function at(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = clamp(Math.round((sorted.length - 1) * fraction), 0, sorted.length - 1);
  return sorted[index] as number;
}

export function PlacesMap({
  places,
  csvHref,
  jsonHref,
  fileName = 'lugares',
}: {
  places: Place[];
  /** Where the same selection can be had as a file, if the caller offers one. */
  csvHref?: string;
  jsonHref?: string;
  fileName?: string;
}) {
  /**
   * Which place the pointer is over, held here rather than lifted to the
   * chapter above. Nothing outside this figure reacts to a hover, and a
   * callback crossing the boundary would make every move of the mouse
   * re-render the rail of families beside it.
   */
  const [hovered, setHovered] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);

  /**
   * The room the map is offered, and the height the screen can spare for it.
   *
   * Measured rather than guessed, and read from the figure around the plot:
   * the plot's own width is capped further down from this very number, so
   * measuring that would be a loop feeding on its own output.
   */
  const [box, setBox] = useState<{ width: number; cap: number }>({ width: 0, cap: 0 });

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const measure = () => {
      const room = plot.parentElement ?? plot;
      const padding = plot.parentElement
        ? Number.parseFloat(getComputedStyle(room).paddingLeft) * 2 || 0
        : 0;
      setBox({
        width: Math.max(room.clientWidth - padding, 1),
        cap: Math.min(window.innerHeight * 0.7, 680),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(plot);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  /** The shape the screen would like, before the city has a say. */
  const boxAspect = box.width > 0 && box.cap > 0 ? box.cap / box.width : 0.7;

  const layout = useMemo(() => {
    if (places.length === 0) return null;

    const points: Dot[] = places.map((place) => ({
      place,
      ...project(place.longitude, place.latitude),
    }));

    const xs = points.map((point) => point.x).sort((left, right) => left - right);
    const ys = points.map((point) => point.y).sort((left, right) => left - right);

    // Under a few dozen places every one of them is the map; trimming there
    // would throw away a quarter of the evidence to tidy the frame.
    const trim = points.length >= 40 ? 0.02 : 0;
    let west = at(xs, trim);
    let east = at(xs, 1 - trim);
    let north = at(ys, trim);
    let south = at(ys, 1 - trim);

    // A family that sits on one block still needs a frame with a size: about a
    // kilometre and a half across, whatever the zoom.
    // A kilometre and a half of ground, in units: the width of a unit shrinks
    // with the cosine of the latitude, so the number of units in a kilometre
    // grows with its reciprocal.
    const floor =
      1.5 /
      ((METRES_PER_UNIT / 1000) * Math.cos((latitudeAt((north + south) / 2) * Math.PI) / 180));
    if (east - west < floor) {
      const centre = (east + west) / 2;
      west = centre - floor / 2;
      east = centre + floor / 2;
    }
    if (south - north < floor) {
      const centre = (south + north) / 2;
      north = centre - floor / 2;
      south = centre + floor / 2;
    }

    // A margin, so the outermost premises are not welded to the border.
    const margin = 0.05;
    const padX = (east - west) * margin;
    const padY = (south - north) * margin;
    west -= padX;
    east += padX;
    north -= padY;
    south += padY;

    let span = east - west;
    let rise = south - north;

    // The city's own proportions, then as much of the screen's as may be had
    // without hanging more than `MOST_SPREAD` of empty ground around it.
    const city = clamp(rise / span, MIN_ASPECT, MAX_ASPECT);
    const aspect = clamp(clamp(boxAspect, city / MOST_SPREAD, city), MIN_ASPECT, MAX_ASPECT);

    // Widen the short side rather than stretch either one: a tile grid has one
    // scale, and a frame that stretched would slide the streets off the points.
    // The extra ground hangs around the median place, so the premises stay in
    // the middle of the drawing and the empty outskirts fall to the edges.
    const middleOf = (value: number, low: number, high: number, wanted: number): number =>
      clamp(value, high - wanted / 2, low + wanted / 2);

    if (rise / span < aspect) {
      const wanted = span * aspect;
      const centre = middleOf(at(ys, 0.5), north, south, wanted);
      north = centre - wanted / 2;
      south = centre + wanted / 2;
      rise = wanted;
    } else if (rise / span > aspect) {
      const wanted = rise / aspect;
      const centre = middleOf(at(xs, 0.5), west, east, wanted);
      west = centre - wanted / 2;
      east = centre + wanted / 2;
      span = wanted;
    }

    const frame: Rect = { x: west, y: north, width: span, height: rise };

    let outside = 0;
    let farLeft = west;
    let farRight = east;
    let farTop = north;
    let farBottom = south;
    for (const dot of points) {
      if (dot.x < west || dot.x > east || dot.y < north || dot.y > south) outside += 1;
      farLeft = Math.min(farLeft, dot.x);
      farRight = Math.max(farRight, dot.x);
      farTop = Math.min(farTop, dot.y);
      farBottom = Math.max(farBottom, dot.y);
    }

    /** Everything, stragglers included, in the same proportions as the frame. */
    const wholeWidth = Math.max(farRight - farLeft, span) * 1.05;
    const whole: Rect = {
      x: (farLeft + farRight) / 2 - wholeWidth / 2,
      y: (farTop + farBottom) / 2 - (wholeWidth * aspect) / 2,
      width: wholeWidth,
      height: wholeWidth * aspect,
    };

    /**
     * A grid over the frame, so telling which place the pointer is near costs a
     * glance at nine cells instead of a walk over four thousand points.
     */
    const cell = span / 48;
    const buckets = new Map<string, Dot[]>();
    for (const dot of points) {
      const key = `${Math.floor(dot.x / cell)}:${Math.floor(dot.y / cell)}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(dot);
      else buckets.set(key, [dot]);
    }

    return {
      dots: points,
      frame,
      whole,
      outside,
      cell,
      buckets,
      aspect,
      /** One world unit in kilometres, at this city's latitude. */
      kmPerUnit:
        (METRES_PER_UNIT / 1000) * Math.cos((latitudeAt((north + south) / 2) * Math.PI) / 180),
    };
  }, [places, boxAspect]);

  /**
   * The width that keeps the drawing inside the height the screen has.
   *
   * The shape is settled above, so the only lever left is size: at this width
   * the frame is exactly as tall as the screen allows, and on a narrower column
   * the column binds first and the map is simply shorter.
   */
  const plotWidthCap = layout && box.cap > 0 ? Math.round(box.cap / layout.aspect) : null;

  /** How wide the drawing actually comes out, in screen pixels. */
  const plotPixels = plotWidthCap && box.width > 0 ? Math.min(box.width, plotWidthCap) : box.width;

  const home: Rect = useMemo(
    () => layout?.frame ?? { x: 0, y: 0, width: WORLD, height: WORLD },
    [layout?.frame],
  );

  const [view, setView] = useState<Rect>(home);
  /** The frame the reader is on, so «volver» is a state and not a guess. */
  const [framed, setFramed] = useState<'ciudad' | 'todo'>('ciudad');

  // A new selection is a new city: the old window would be pointing at ground
  // this family does not stand on. A new frame shape counts as new too — the
  // first paint happens before the box has been measured.
  const signature = `${places.length}:${places[0]?.placeId ?? ''}:${home.width}:${home.height}`;
  const lastSignature = useRef(signature);
  if (lastSignature.current !== signature) {
    lastSignature.current = signature;
    if (view !== home) setView(home);
    if (framed !== 'ciudad') setFramed('ciudad');
  }

  /** How far in the reader is, as a multiple of the city's own frame. */
  const zoom = home.width / view.width;

  /**
   * Which level of the tile pyramid matches the scale on screen.
   *
   * A tile is 256 pixels of its own zoom; picking the level where that lands
   * closest to 256 pixels on this screen is what keeps the lettering sharp
   * instead of smeared or shrunk to nothing.
   */
  const tiles = useMemo(() => {
    if (plotPixels <= 0 || view.width <= 0) return null;
    const scale = plotPixels / view.width;
    // Biased a third of a level towards the sharper side: a square drawn
    // smaller than it was cut stays crisp, one blown up past its own size goes
    // soft, and street names are the first thing to go with it.
    const level = clamp(Math.round(Math.log2(scale) + 0.34), 0, MAX_TILE_ZOOM);
    const span = WORLD / 2 ** level;
    const count = 2 ** level;
    const first = { x: Math.floor(view.x / span), y: Math.floor(view.y / span) };
    const last = {
      x: Math.floor((view.x + view.width) / span),
      y: Math.floor((view.y + view.height) / span),
    };
    const list: Array<{ key: string; href: string; x: number; y: number }> = [];
    for (let ty = first.y; ty <= last.y; ty += 1) {
      if (ty < 0 || ty >= count) continue;
      for (let tx = first.x; tx <= last.x; tx += 1) {
        // The world wraps east to west; a city never needs it, but a stray
        // negative index would ask the tile server for a square that is not
        // there and draw a hole.
        const wrapped = ((tx % count) + count) % count;
        list.push({
          key: `${level}/${tx}/${ty}`,
          href: `https://tile.openstreetmap.org/${level}/${wrapped}/${ty}.png`,
          x: tx * span,
          y: ty * span,
        });
        if (list.length >= MOST_TILES) return { level, span, list };
      }
    }
    return { level, span, list };
  }, [view, plotPixels]);

  /**
   * Ink per point, kept the same size on screen at every zoom.
   *
   * With streets underneath, a dot that grew as the reader closed in would
   * cover the corner it is meant to be standing on.
   */
  const radius = useMemo(() => {
    const count = places.length;
    const base = count > 3000 ? 3 : count > 1200 ? 3.6 : count > 400 ? 4.4 : 5.6;
    const perPixel = plotPixels > 0 ? view.width / plotPixels : view.width / 800;
    return base * perPixel;
  }, [places.length, view.width, plotPixels]);

  /**
   * Every dot in two paths, one per kind.
   *
   * Four thousand `<circle>` elements is four thousand nodes the browser lays
   * out, hit-tests and repaints on every pan; two paths is two. The hover is
   * answered from the grid above instead of from the DOM.
   */
  const paths = useMemo(() => {
    if (!layout) return { plain: '', regulated: '' };
    const plain: string[] = [];
    const regulated: string[] = [];
    const r = radius;
    const d = r * 2;
    const round = (value: number) => value.toFixed(7);
    for (const dot of layout.dots) {
      const arc = `M${round(dot.x)} ${round(dot.y)}m${round(-r)} 0a${round(r)} ${round(r)} 0 1 0 ${round(d)} 0a${round(r)} ${round(r)} 0 1 0 ${round(-d)} 0`;
      (dot.place.isRegulated ? regulated : plain).push(arc);
    }
    return { plain: plain.join(''), regulated: regulated.join('') };
  }, [layout, radius]);

  const found = useMemo(
    () => (hovered ? layout?.dots.find((dot) => dot.place.placeId === hovered) : undefined),
    [layout, hovered],
  );

  /** Where a client point falls in the drawing's own coordinates. */
  const toWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      return {
        x: view.x + ((clientX - rect.left) / rect.width) * view.width,
        y: view.y + ((clientY - rect.top) / rect.height) * view.height,
      };
    },
    [view],
  );

  const keepInside = useCallback(
    (next: Rect): Rect => {
      const bounds = layout?.whole ?? home;
      // Room to breathe around the city, never a window adrift in empty space.
      const slackX = bounds.width * 0.25;
      const slackY = bounds.height * 0.25;
      return {
        ...next,
        x: clamp(next.x, bounds.x - slackX, bounds.x + bounds.width + slackX - next.width),
        y: clamp(next.y, bounds.y - slackY, bounds.y + bounds.height + slackY - next.height),
      };
    },
    [layout?.whole, home],
  );

  /** Zoom about a fixed point, so the ground under the cursor stays put. */
  const zoomBy = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      setView((current) => {
        const widest = Math.max(home.width / MIN_ZOOM, layout?.whole.width ?? 0);
        const width = clamp(current.width / factor, home.width / MAX_ZOOM, widest);
        const ratio = width / current.width;
        const point = anchor ?? {
          x: current.x + current.width / 2,
          y: current.y + current.height / 2,
        };
        return keepInside({
          x: point.x - (point.x - current.x) * ratio,
          y: point.y - (point.y - current.y) * ratio,
          width,
          height: current.height * ratio,
        });
      });
      setFramed('ciudad');
    },
    [keepInside, home.width, layout?.whole.width],
  );

  /** The drag, held in a ref: a pan must not re-render on every pixel. */
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const held = drag.current;
      const svg = svgRef.current;
      if (!svg) return;

      if (held && held.id === event.pointerId) {
        const rect = svg.getBoundingClientRect();
        const dx = ((event.clientX - held.x) / rect.width) * view.width;
        const dy = ((event.clientY - held.y) / rect.height) * view.height;
        if (Math.abs(event.clientX - held.x) + Math.abs(event.clientY - held.y) > 3) {
          held.moved = true;
        }
        held.x = event.clientX;
        held.y = event.clientY;
        if (held.moved) {
          setView((current) => keepInside({ ...current, x: current.x - dx, y: current.y - dy }));
          if (hovered) setHovered(null);
        }
        return;
      }

      if (!layout) return;
      const world = toWorld(event.clientX, event.clientY);
      if (!world) return;

      // Within about ten screen pixels of a point, that point is the answer.
      const reach = (view.width / svg.getBoundingClientRect().width) * 11;
      const column = Math.floor(world.x / layout.cell);
      const row = Math.floor(world.y / layout.cell);
      let best: Dot | null = null;
      let bestDistance = reach * reach;
      for (let dc = -1; dc <= 1; dc += 1) {
        for (let dr = -1; dr <= 1; dr += 1) {
          const bucket = layout.buckets.get(`${column + dc}:${row + dr}`);
          if (!bucket) continue;
          for (const dot of bucket) {
            const distance = (dot.x - world.x) ** 2 + (dot.y - world.y) ** 2;
            if (distance < bestDistance) {
              bestDistance = distance;
              best = dot;
            }
          }
        }
      }
      const next = best?.place.placeId ?? null;
      if (next !== hovered) setHovered(next);
    },
    [layout, view, hovered, keepInside, toWorld],
  );

  const endDrag = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current?.id === event.pointerId) drag.current = null;
  }, []);

  /**
   * The wheel is bound by hand, and not through `onWheel`.
   *
   * React registers its own wheel listener as passive, which makes
   * `preventDefault` a no-op: the reader would zoom the map and scroll the
   * article at the same time. A listener attached here can refuse the scroll.
   */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const anchor = toWorld(event.clientX, event.clientY) ?? undefined;
      zoomBy(event.deltaY < 0 ? 1.3 : 1 / 1.3, anchor);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [toWorld, zoomBy]);

  /** The bar, and the round number of kilometres it is worth right now. */
  const scaleBar = useMemo(() => {
    if (!layout) return null;
    const kmAcross = view.width * layout.kmPerUnit;
    const wanted = kmAcross * 0.24;
    const step = SCALE_STEPS.find((candidate) => candidate >= wanted) ?? SCALE_STEPS.at(-1) ?? 1;
    return {
      units: step / layout.kmPerUnit,
      label: step >= 1 ? `${step} km` : `${Math.round(step * 1000)} m`,
    };
  }, [layout, view.width]);

  /**
   * The map as a file, drawn again on a canvas rather than photographed.
   *
   * An SVG serialised into a `data:` URL is not allowed to fetch anything, so
   * the tiles would come out blank and the file would be the scatter this map
   * stopped being. The squares are fetched with CORS and painted, then the
   * points on top of them.
   */
  const savePng = useCallback(async () => {
    if (!layout || !tiles) return;
    const width = 1800;
    const height = Math.max(Math.round((width * view.height) / view.width), 1);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;

    const style = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;
    context.fillStyle = read('--panel-tint', '#f6f8fa');
    context.fillRect(0, 0, width, height);

    const scale = width / view.width;
    await Promise.all(
      tiles.list.map(
        (tile) =>
          new Promise<void>((done) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => {
              context.drawImage(
                image,
                (tile.x - view.x) * scale,
                (tile.y - view.y) * scale,
                tiles.span * scale,
                tiles.span * scale,
              );
              done();
            };
            // A square that will not come is a square left as background.
            image.onerror = () => done();
            image.src = tile.href;
          }),
      ),
    );

    const draw = (only: boolean, colour: string, alpha: number) => {
      context.fillStyle = colour;
      context.globalAlpha = alpha;
      context.beginPath();
      for (const dot of layout.dots) {
        if (dot.place.isRegulated !== only) continue;
        const x = (dot.x - view.x) * scale;
        const y = (dot.y - view.y) * scale;
        if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;
        context.moveTo(x + radius * scale, y);
        context.arc(x, y, radius * scale, 0, Math.PI * 2);
      }
      context.fill();
      context.globalAlpha = 1;
    };
    draw(false, read('--official', '#1b4f9c'), 0.75);
    draw(true, read('--parallel', '#c2551f'), 0.9);

    context.font = '20px ui-sans-serif, system-ui, sans-serif';
    context.fillStyle = 'rgba(255,255,255,0.85)';
    context.fillRect(0, height - 30, 330, 30);
    context.fillStyle = '#333';
    context.fillText('© OpenStreetMap contributors', 8, height - 9);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  }, [layout, tiles, view, radius, fileName]);

  if (!layout) {
    return <div className="callout">No hay lugares que dibujar con esta selección.</div>;
  }

  const regulated = places.reduce((sum, place) => sum + (place.isRegulated ? 1 : 0), 0);

  return (
    <figure className="places-map">
      <div className="places-map-bar">
        <div className="places-map-keys">
          <span className="places-map-key">
            <i className="places-map-swatch" /> lugar
          </span>
          <span className="places-map-key">
            <i className="places-map-swatch places-map-swatch-reg" /> actividad regulada
          </span>
          <span className="places-map-zoom-read">
            {zoom < 1.05 ? 'toda la ciudad' : `×${zoom.toFixed(1)}`}
          </span>
        </div>

        <div className="places-map-tools">
          <button
            type="button"
            className="map-tool"
            onClick={() => zoomBy(1 / 1.6)}
            aria-label="Alejar el mapa"
            title="Alejar"
          >
            −
          </button>
          <button
            type="button"
            className="map-tool"
            onClick={() => zoomBy(1.6)}
            aria-label="Acercar el mapa"
            title="Acercar"
          >
            +
          </button>
          <button
            type="button"
            className="map-tool map-tool-wide"
            onClick={() => {
              setView(home);
              setFramed('ciudad');
            }}
          >
            La ciudad
          </button>
          {layout.outside > 0 ? (
            <button
              type="button"
              className={
                framed === 'todo' ? 'map-tool map-tool-wide map-tool-on' : 'map-tool map-tool-wide'
              }
              onClick={() => {
                setView(layout.whole);
                setFramed('todo');
              }}
              title="Incluye los puntos que caen fuera del encuadre"
            >
              Todo
            </button>
          ) : null}

          <span className="places-map-sep" aria-hidden="true" />

          <button type="button" className="download-btn" onClick={() => void savePng()}>
            <Icon name="descarga" size={13} />
            PNG
          </button>
          {csvHref ? (
            <a className="download-btn" href={csvHref}>
              CSV
            </a>
          ) : null}
          {jsonHref ? (
            <a className="download-btn" href={jsonHref}>
              JSON
            </a>
          ) : null}
        </div>
      </div>

      <div
        className="places-map-plot"
        ref={plotRef}
        style={plotWidthCap ? { maxWidth: `${plotWidthCap}px` } : undefined}
      >
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          style={{ aspectRatio: `${home.width} / ${home.height}` }}
          role="img"
          aria-label={`Mapa de ${places.length.toLocaleString('es-BO')} lugares sobre las calles de la ciudad. Se puede acercar con la rueda y desplazar arrastrando.`}
          className="places-map-svg"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onMouseLeave={() => setHovered(null)}
        >
          <g className="places-map-tiles">
            {tiles?.list.map((tile) => (
              <image
                key={tile.key}
                href={tile.href}
                x={tile.x}
                y={tile.y}
                width={tiles.span}
                height={tiles.span}
                preserveAspectRatio="none"
              />
            ))}
          </g>
          <path className="poi-layer" d={paths.plain} />
          <path className="poi-layer poi-layer-regulated" d={paths.regulated} />
          {found ? (
            <g className="poi-found" pointerEvents="none" data-export="skip">
              <circle cx={found.x} cy={found.y} r={radius * 3.2} className="poi-halo" />
              <circle cx={found.x} cy={found.y} r={radius * 1.5} className="poi-core" />
            </g>
          ) : null}
        </svg>

        {scaleBar ? (
          <div className="places-map-scale" aria-hidden="true">
            <span
              className="places-map-scale-bar"
              style={{ width: `${(scaleBar.units / view.width) * 100}%` }}
            />
            <span className="places-map-scale-text">{scaleBar.label}</span>
          </div>
        ) : null}

        {/* The licence asks for this, and a reader deserves to know whose
            streets these are. */}
        <a
          className="places-map-credit"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer noopener"
        >
          © OpenStreetMap
        </a>
      </div>

      <figcaption className="places-map-foot">
        {found ? (
          <>
            <b>{found.place.name}</b> · {found.place.entityFamily}
            {found.place.zone ? ` · ${found.place.zone}` : ''}
            {found.place.address ? ` · ${found.place.address}` : ''}
            {found.place.isRegulated ? ' · actividad regulada' : ''}
          </>
        ) : (
          <>
            {places.length.toLocaleString('es-BO')} lugares sobre el callejero,{' '}
            {regulated.toLocaleString('es-BO')} de actividad regulada: deben verificarse con su
            regulador, no están verificados. Rueda para acercar, arrastra para moverte.
            {layout.outside > 0 ? (
              <>
                {' '}
                {layout.outside.toLocaleString('es-BO')}{' '}
                {layout.outside === 1
                  ? 'lugar queda fuera del encuadre'
                  : 'lugares quedan fuera del encuadre'}{' '}
                y no decide la escala; «Todo» los incluye.
              </>
            ) : null}
          </>
        )}
      </figcaption>
    </figure>
  );
}

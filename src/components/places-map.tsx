'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons';
import { downloadSvgAsPng } from './map-download';
import type { Place } from '@/lib/places';

/**
 * The places of one city, drawn where they are.
 *
 * There is no basemap under them, and that is a decision rather than an
 * omission. Tiles would mean calling a third party on every pan, handing that
 * third party the reader's address and this page a dependency it cannot serve
 * from its own container. Several thousand shops, clinics and schools already
 * draw the shape of a city on their own — the avenues appear as lines of dots
 * because that is where the premises are.
 *
 * Two things were wrong with the first version and both are fixed here.
 *
 * The frame was the extent of every point, so a single mis-geocoded pharmacy
 * forty kilometres out of town set the scale for the whole city: the fourteen
 * thousand premises that matter collapsed into a blot in the middle of an empty
 * rectangle. The frame is now the extent of the *bulk* of the points — the
 * middle 96% on each axis — and the stragglers are counted out loud in the
 * caption instead of silently deciding the zoom.
 *
 * And a map you cannot get closer to is a picture. This one zooms and pans, so
 * the blot of a whole city opens into blocks and avenues, and it carries a
 * scale bar because a scatter with no distance on it cannot be read.
 */

/** How wide the drawing is in its own units. Height follows the data. */
const WORLD_WIDTH = 1000;

/**
 * How square or how flat the frame is allowed to get.
 *
 * The shape is the box's, and these only stop the two silly ends of it. A
 * drawing flatter than the floor is a stripe of ink nobody can read, and one
 * taller than the phone it is on is the bug this whole file was rewritten for:
 * the first version came out 1.250 pixels tall and the reader never saw the
 * city and the caption that explains it at the same time.
 *
 * The ceiling can sit above one because the measured height of the box binds
 * first — on a tall phone that is what lets the map use the room it has.
 */
const MIN_ASPECT = 0.5;
const MAX_ASPECT = 1.25;

/**
 * How much wider than the city its frame may be.
 *
 * The frame wants the shape of the screen and the city has a shape of its own,
 * and neither can simply win. Santa Cruz's premises sit in a patch slightly
 * taller than it is wide; a landscape monitor asked for a frame three times
 * wider than tall, which put the city in a band down the middle of a mostly
 * empty rectangle. Obeying the city instead gave a portrait strip 516 pixels
 * wide stranded in a panel three times that.
 *
 * So the frame moves towards the screen's shape and stops here: at most three
 * fifths again of the city's own width in surrounding ground, which is enough
 * to fill a wide panel and not enough to lose the city inside it.
 */
const MOST_SPREAD = 1.6;

/** A degree of latitude, and of cosine-corrected longitude, in kilometres. */
const KM_PER_DEGREE = 111.32;

/** How far in and out the reader may go, as a multiple of the whole frame. */
const MAX_ZOOM = 60;
const MIN_ZOOM = 0.9;

/** The distances a scale bar is allowed to state, in kilometres. */
const SCALE_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100] as const;

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
   * How much height the screen can spare for a map.
   *
   * This is the only thing the box decides. Letting it decide the *shape* as
   * well was the second wrong answer: on a wide monitor the frame came out
   * three times wider than tall, so the city sat in a band down the middle
   * with a third of the municipality's empty ground on either side of it —
   * the reader saw a map that was mostly nothing. The frame takes the
   * proportions of the city again, and this number decides how large it is
   * drawn: as tall as the screen allows, as wide as that shape then needs.
   */
  const [box, setBox] = useState<{ width: number; cap: number }>({ width: 0, cap: 0 });

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const measure = () => {
      // The room the map is offered, read from the figure around it: the plot's
      // own width is capped further down from this very number, and measuring
      // that would be a loop feeding on its own output.
      const room = plot.parentElement ?? plot;
      const padding = plot.parentElement
        ? Number.parseFloat(getComputedStyle(room).paddingLeft) * 2 || 0
        : 0;
      setBox({
        width: Math.max(room.clientWidth - padding, 1),
        // Room for the caption and the strip of controls to stay on screen
        // with it: a map you have to scroll away from to read its legend is
        // still a map you cannot see.
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

  /**
   * Longitude is compressed by the cosine of the latitude before anything is
   * scaled. Without it a city seventeen degrees south comes out stretched
   * sideways by about a twentieth, which is enough to bend a straight avenue.
   */
  const layout = useMemo(() => {
    if (places.length === 0) return null;

    const middle = places.reduce((sum, place) => sum + place.latitude, 0) / places.length;
    const squeeze = Math.cos((middle * Math.PI) / 180);
    const points = places.map((place) => ({
      place,
      east: place.longitude * squeeze,
      north: place.latitude,
    }));

    const easts = points.map((point) => point.east).sort((left, right) => left - right);
    const norths = points.map((point) => point.north).sort((left, right) => left - right);

    // Under a few dozen places every one of them is the map; trimming there
    // would throw away a quarter of the evidence to tidy the frame.
    const trim = points.length >= 40 ? 0.02 : 0;
    let west = at(easts, trim);
    let east = at(easts, 1 - trim);
    let south = at(norths, trim);
    let north = at(norths, 1 - trim);

    // A single place, or a family that sits on one block, still needs a frame
    // with a size: about a kilometre and a half across.
    const FLOOR = 0.014;
    if (east - west < FLOOR) {
      const centre = (east + west) / 2;
      west = centre - FLOOR / 2;
      east = centre + FLOOR / 2;
    }
    if (north - south < FLOOR) {
      const centre = (north + south) / 2;
      south = centre - FLOOR / 2;
      north = centre + FLOOR / 2;
    }

    // A margin, so the outermost premises are not welded to the border.
    const margin = 0.045;
    const padX = (east - west) * margin;
    const padY = (north - south) * margin;
    west -= padX;
    east += padX;
    south -= padY;
    north += padY;

    let span = east - west;
    let rise = north - south;

    /**
     * Widen the short side rather than stretch either one: the scale has to
     * stay the same on both axes or the city changes shape. The proportion is
     * the box's, not the city's — see `boxAspect` above.
     *
     * The extra ground is hung around the median place and not around the
     * middle of the bounding box. On a wide monitor the frame gains a lot of
     * width, and centring it on the box put the mass of the city off to one
     * side with the empty half of the municipality beside it; the median sits
     * where the premises are. It is pulled back far enough to keep the whole
     * extent inside, so centring never crops anything.
     */
    // The city's own proportions, then as much of the screen's as may be had
    // without hanging more than `MOST_SPREAD` of empty ground around it.
    const city = clamp(rise / span, MIN_ASPECT, MAX_ASPECT);
    const aspect = clamp(clamp(boxAspect, city / MOST_SPREAD, city), MIN_ASPECT, MAX_ASPECT);
    const middleOf = (value: number, low: number, high: number, wanted: number): number =>
      clamp(value, high - wanted / 2, low + wanted / 2);

    if (rise / span < aspect) {
      const wanted = span * aspect;
      const centre = middleOf(at(norths, 0.5), south, north, wanted);
      south = centre - wanted / 2;
      north = centre + wanted / 2;
      rise = wanted;
    } else if (rise / span > aspect) {
      const wanted = rise / aspect;
      const centre = middleOf(at(easts, 0.5), west, east, wanted);
      west = centre - wanted / 2;
      east = centre + wanted / 2;
      span = wanted;
    }

    const height = WORLD_WIDTH * aspect;
    const scale = WORLD_WIDTH / span;

    const dots: Dot[] = points.map(({ place, east: pointEast, north: pointNorth }) => ({
      place,
      x: (pointEast - west) * scale,
      // North is up on the page and down in SVG coordinates.
      y: height - (pointNorth - south) * scale,
    }));

    // The frame itself is the floor of «everything»: a whole-extent view that
    // did not contain the city would be a stranger view than the one it fixes.
    let outside = 0;
    let farLeft = 0;
    let farRight = WORLD_WIDTH;
    let farTop = 0;
    let farBottom = height;
    for (const dot of dots) {
      const off = dot.x < 0 || dot.x > WORLD_WIDTH || dot.y < 0 || dot.y > height;
      if (off) outside += 1;
      farLeft = Math.min(farLeft, dot.x);
      farRight = Math.max(farRight, dot.x);
      farTop = Math.min(farTop, dot.y);
      farBottom = Math.max(farBottom, dot.y);
    }

    /** Everything, stragglers included, in the same proportions as the frame. */
    const wholeWidth = Math.max(farRight - farLeft, WORLD_WIDTH) * 1.04;
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
    const cell = WORLD_WIDTH / 48;
    const buckets = new Map<string, Dot[]>();
    for (const dot of dots) {
      const key = `${Math.floor(dot.x / cell)}:${Math.floor(dot.y / cell)}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(dot);
      else buckets.set(key, [dot]);
    }

    return {
      dots,
      height,
      whole,
      outside,
      cell,
      buckets,
      /** One world unit, in kilometres. */
      kmPerUnit: (1 / scale) * KM_PER_DEGREE,
    };
  }, [places, boxAspect]);

  /**
   * The width that keeps the drawing inside the height the screen has.
   *
   * The shape is the city's, so the only lever left is size: at this width the
   * frame is exactly as tall as `box.cap` allows, and on a narrower column the
   * column binds first and the map is shorter than it could be.
   */
  const plotWidthCap =
    layout && box.cap > 0 ? Math.round((box.cap * WORLD_WIDTH) / layout.height) : null;

  const home: Rect = useMemo(
    () => ({ x: 0, y: 0, width: WORLD_WIDTH, height: layout?.height ?? 720 }),
    [layout?.height],
  );

  const [view, setView] = useState<Rect>(home);
  /** The frame the reader is on, so «volver» is a state and not a guess. */
  const [framed, setFramed] = useState<'ciudad' | 'todo'>('ciudad');

  // A new selection is a new city: the old window would be pointing at ground
  // this family does not stand on. A new frame shape counts as new too — the
  // first paint happens before the box has been measured, and a window kept
  // from that guess would be a viewBox that no longer matches the drawing it
  // is placed in, which puts the scale bar and the hover a few pixels out.
  const signature = `${places.length}:${places[0]?.placeId ?? ''}:${home.height}`;
  const lastSignature = useRef(signature);
  if (lastSignature.current !== signature) {
    lastSignature.current = signature;
    if (view !== home) setView(home);
    if (framed !== 'ciudad') setFramed('ciudad');
  }

  /** How far in the reader is, as a multiple of the whole frame. */
  const zoom = WORLD_WIDTH / view.width;

  /**
   * Ink per point, thinned as the crowd grows and kept roughly the same size on
   * screen as the reader closes in. Quantised so that panning — which does not
   * change it — never rebuilds the drawing.
   */
  const radius = useMemo(() => {
    const count = places.length;
    const base = count > 3000 ? 2.7 : count > 1200 ? 3.3 : count > 400 ? 4.2 : 5.4;
    return Math.round((base / Math.pow(zoom, 0.68)) * 20) / 20;
  }, [places.length, zoom]);

  /**
   * Every dot in two strings, one per kind.
   *
   * Four thousand `<circle>` elements is four thousand nodes the browser lays
   * out, hit-tests and repaints on every pan; two paths is two. The hover is
   * answered from the grid above instead of from the DOM, which is also what
   * removed the flickering native tooltip.
   */
  const paths = useMemo(() => {
    if (!layout) return { plain: '', regulated: '' };
    const plain: string[] = [];
    const regulated: string[] = [];
    const r = radius;
    const d = r * 2;
    for (const dot of layout.dots) {
      const x = Math.round(dot.x * 10) / 10;
      const y = Math.round(dot.y * 10) / 10;
      const arc = `M${x} ${y}m-${r} 0a${r} ${r} 0 1 0 ${d} 0a${r} ${r} 0 1 0 -${d} 0`;
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
      const box = svg.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return null;
      return {
        x: view.x + ((clientX - box.left) / box.width) * view.width,
        y: view.y + ((clientY - box.top) / box.height) * view.height,
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
        const wanted = current.width / factor;
        // Far enough out to hold everything there is, even when a straggler
        // puts «everything» well outside the city's own frame: a reader who
        // pressed «Todo» and then «−» must not be thrown back into town.
        const widest = Math.max(WORLD_WIDTH / MIN_ZOOM, layout?.whole.width ?? 0);
        const width = clamp(wanted, WORLD_WIDTH / MAX_ZOOM, widest);
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
    [keepInside, layout?.whole.width],
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
        const box = svg.getBoundingClientRect();
        const dx = ((event.clientX - held.x) / box.width) * view.width;
        const dy = ((event.clientY - held.y) / box.height) * view.height;
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
      zoomBy(event.deltaY < 0 ? 1.22 : 1 / 1.22, anchor);
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
      km: step,
      units: step / layout.kmPerUnit,
      label: step >= 1 ? `${step} km` : `${Math.round(step * 1000)} m`,
    };
  }, [layout, view.width]);

  /** The drawing as a file, at the frame the reader is looking at. */
  const savePng = useCallback(() => {
    const svg = svgRef.current;
    if (svg) downloadSvgAsPng(svg, { fileName });
  }, [fileName]);

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
            {zoom < 1.05 ? 'todo el encuadre' : `×${zoom.toFixed(1)}`}
          </span>
        </div>

        <div className="places-map-tools">
          <button
            type="button"
            className="map-tool"
            onClick={() => zoomBy(1 / 1.5)}
            aria-label="Alejar el mapa"
            title="Alejar"
          >
            −
          </button>
          <button
            type="button"
            className="map-tool"
            onClick={() => zoomBy(1.5)}
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

          <button type="button" className="download-btn" onClick={savePng}>
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

      {/*
        The plot, and not the figure, carries the cap on height.
        `max-height` on an SVG letterboxes it instead of shortening it, and the
        scale bar is a percentage of this box, so box and drawing have to stay
        the same rectangle. Capping the width by the height the screen has
        keeps both true.
      */}
      <div
        className="places-map-plot"
        ref={plotRef}
        style={plotWidthCap ? { maxWidth: `${plotWidthCap}px` } : undefined}
      >
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          style={{ aspectRatio: `${WORLD_WIDTH} / ${layout.height}` }}
          role="img"
          aria-label={`Mapa de ${places.length.toLocaleString('es-BO')} lugares. Se puede acercar con la rueda y desplazar arrastrando.`}
          className="places-map-svg"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onMouseLeave={() => setHovered(null)}
        >
          <path className="poi-layer" d={paths.plain} />
          <path className="poi-layer poi-layer-regulated" d={paths.regulated} />
          {found ? (
            <g className="poi-found" pointerEvents="none" data-export="skip">
              <circle cx={found.x} cy={found.y} r={radius * 3.4} className="poi-halo" />
              <circle cx={found.x} cy={found.y} r={radius * 1.5} className="poi-core" />
            </g>
          ) : null}
        </svg>

        {scaleBar ? (
          // The bar is a percentage of the plot, and the plot is exactly as wide
          // as the drawing, so the percentage is the distance it claims to be.
          <div className="places-map-scale" aria-hidden="true">
            <span
              className="places-map-scale-bar"
              style={{ width: `${(scaleBar.units / view.width) * 100}%` }}
            />
            <span className="places-map-scale-text">{scaleBar.label}</span>
          </div>
        ) : null}
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
            {places.length.toLocaleString('es-BO')} lugares dibujados,{' '}
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

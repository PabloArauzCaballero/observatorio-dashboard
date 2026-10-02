'use client';

import { useEffect, useRef, useState } from 'react';
import { projectRoadPoint } from '@/lib/bolivia-map';
import { streetKey } from '@/lib/street-names';
import { STREET_SURFACE_GROUP, URBAN_MAX_WIDTH } from '@/lib/street-types';
import type { LonLatBox, StreetCell, StreetWay } from '@/lib/street-types';
import type { Box } from './map-camera';

/**
 * Las calles de las ciudades sobre el mapa de carreteras.
 *
 * Son decenas de miles de líneas por pantalla: en SVG serían decenas de miles de
 * nodos que el navegador tendría que reconciliar en cada fotograma de un arrastre.
 * Aquí se dibujan en un lienzo (`<canvas>`), de a un color por pasada, y sólo las
 * que cruzan la vista. Se piden a `/api/calles` por celdas y sólo al acercarse a
 * una ciudad (`URBAN_MAX_WIDTH`); cada celda se proyecta una vez al llegar.
 */

export interface UrbanWay {
  way: StreetWay;
  /** La clave de búsqueda del nombre, o null. */
  key: string | null;
  /** Vértices ya proyectados al plano del mapa: `[x0, y0, x1, y1, …]`. */
  points: Float32Array;
  /** `[minX, minY, maxX, maxY]` en el plano. */
  box: [number, number, number, number];
  department: string | null;
}

/**
 * De plano a longitud y latitud. `projectRoadPoint` es lineal en los dos ejes, así que
 * su inversa sale de dos puntos de referencia, sin repetir las constantes de su origen.
 */
const ORIGIN = projectRoadPoint([0, 0]);
const UNIT = projectRoadPoint([1, 1]);
const PER_LON = UNIT[0] - ORIGIN[0];
const PER_LAT = UNIT[1] - ORIGIN[1];

export function unproject(x: number, y: number): [number, number] {
  return [(x - ORIGIN[0]) / PER_LON, (y - ORIGIN[1]) / PER_LAT];
}

function project(cell: StreetCell): UrbanWay[] {
  return cell.streets.map((way) => {
    const points = new Float32Array(way.line.length * 2);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    way.line.forEach((point, index) => {
      const [x, y] = projectRoadPoint(point);
      points[index * 2] = x;
      points[index * 2 + 1] = y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
    return { way, key: streetKey(way.name), points, box: [minX, minY, maxX, maxY], department: cell.department };
  });
}

/** Lo ancho que se pide alrededor de la vista, para que arrastrar un poco no vuelva a pedir. */
const PAD = 0.25;
/** Las celdas que se guardan antes de soltar las que ya no se ven. */
const KEEP_CELLS = 700;

export interface UrbanLayer {
  ways: UrbanWay[];
  /** Si la vista está lo bastante cerca para que haya calles que pedir. */
  active: boolean;
  loading: boolean;
  truncated: boolean;
  failed: boolean;
}

export function useStreetCells(view: Box, enabled: boolean): UrbanLayer {
  const cache = useRef(new Map<string, UrbanWay[]>());
  const asked = useRef<LonLatBox | null>(null);
  const [ways, setWays] = useState<UrbanWay[]>([]);
  const [state, setState] = useState({ loading: false, truncated: false, failed: false });
  const active = enabled && view.width <= URBAN_MAX_WIDTH;

  useEffect(() => {
    if (!active) return;
    const [west, north] = unproject(view.x, view.y);
    const [east, south] = unproject(view.x + view.width, view.y + view.height);
    const covered = asked.current;
    if (covered && west >= covered[0] && south >= covered[1] && east <= covered[2] && north <= covered[3]) return;

    const padLon = (east - west) * PAD;
    const padLat = (north - south) * PAD;
    const box: LonLatBox = [west - padLon, south - padLat, east + padLon, north + padLat];
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState((current) => ({ ...current, loading: true, failed: false }));
      fetch(`/api/calles?bbox=${box.map((value) => value.toFixed(4)).join(',')}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error('calles'))))
        .then((body: { cells: StreetCell[]; truncated: boolean }) => {
          // Un tope de celdas con respuesta recortada no cubre la caja entera: no se da por cubierta.
          asked.current = body.truncated ? null : box;
          if (cache.current.size > KEEP_CELLS) cache.current.clear();
          for (const cell of body.cells) if (!cache.current.has(cell.id)) cache.current.set(cell.id, project(cell));
          setWays([...cache.current.values()].flat());
          setState({ loading: false, truncated: body.truncated, failed: false });
        })
        .catch((error: unknown) => {
          if ((error as { name?: string }).name === 'AbortError') return;
          setState({ loading: false, truncated: false, failed: true });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, view.x, view.y, view.width, view.height]);

  return { ways: active ? ways : [], active, ...state };
}

/** Lo que dibuja una pasada: el ancho en píxeles de pantalla y si va atenuada. */
const BASE_WIDTH: Record<StreetWay['class'], number> = { r: 1.1, l: 1, u: 1.2, s: 0.8, p: 0.9 };

function resolve(canvas: HTMLCanvasElement, css: string): string {
  canvas.style.color = css;
  return getComputedStyle(canvas).color;
}

export interface UrbanStyle {
  colorBy: 'red' | 'superficie';
  /** Por red: el color de lo «sin referencia». Por rodadura: el del grupo. */
  neutral: string;
  groups: Record<'PAVIMENTADA' | 'RIPIO' | 'TIERRA' | 'SIN_DATO', string>;
  ink: string;
}

export function StreetsCanvas({
  ways,
  view,
  style,
  highlight,
  scale,
}: {
  ways: readonly UrbanWay[];
  view: Box;
  style: UrbanStyle;
  /** La calle elegida: su clave y, si la eligió una ciudad concreta, la caja que la limita. */
  highlight: { key: string; bounds: LonLatBox | null } | null;
  /** Multiplicador del grosor que viene del acercamiento. */
  scale: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let frame = 0;
    const paint = (): void => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const context = canvas.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, width, height);
      if (!ways.length) return;

      const k = width / view.width;
      const colors = {
        neutral: resolve(canvas, style.neutral),
        PAVIMENTADA: resolve(canvas, style.groups.PAVIMENTADA),
        RIPIO: resolve(canvas, style.groups.RIPIO),
        TIERRA: resolve(canvas, style.groups.TIERRA),
        SIN_DATO: resolve(canvas, style.groups.SIN_DATO),
        ink: resolve(canvas, style.ink),
      };
      const chosenBox = highlight?.bounds ? { x0: highlight.bounds[0], y0: highlight.bounds[1], x1: highlight.bounds[2], y1: highlight.bounds[3] } : null;
      const isChosen = (item: UrbanWay): boolean => {
        if (!highlight || item.key !== highlight.key) return false;
        if (!chosenBox) return true;
        const [lon, lat] = unproject(item.points[0] ?? 0, item.points[1] ?? 0);
        return lon >= chosenBox.x0 && lon <= chosenBox.x1 && lat >= chosenBox.y0 && lat <= chosenBox.y1;
      };

      /* Una pasada por color y grosor: cambiar de estilo es lo caro, no trazar. */
      const buckets = new Map<string, { color: string; width: number; alpha: number; items: UrbanWay[] }>();
      for (const item of ways) {
        const [minX, minY, maxX, maxY] = item.box;
        if (maxX < view.x || minX > view.x + view.width || maxY < view.y || minY > view.y + view.height) continue;
        const chosen = isChosen(item);
        const group = STREET_SURFACE_GROUP[item.way.surface];
        const color = chosen ? colors.ink : style.colorBy === 'red' ? colors.neutral : colors[group];
        const width = (chosen ? 3.2 : BASE_WIDTH[item.way.class]) * scale;
        const alpha = highlight && !chosen ? 0.22 : 0.85;
        const id = `${color}|${width.toFixed(2)}|${alpha}`;
        const bucket = buckets.get(id) ?? { color, width, alpha, items: [] };
        bucket.items.push(item);
        buckets.set(id, bucket);
      }
      // Uniones simples: a un píxel de grosor las redondas no se ven y cuestan el doble de trazar.
      context.lineCap = 'butt';
      context.lineJoin = 'miter';
      const minStep = ratio * ratio * 1.4;
      const tiny = ratio * 1.5;
      for (const bucket of buckets.values()) {
        context.strokeStyle = bucket.color;
        context.globalAlpha = bucket.alpha;
        context.lineWidth = bucket.width * ratio;
        context.beginPath();
        for (const item of bucket.items) {
          const points = item.points;
          // Una vía que mide menos de un píxel y medio no se ve: no se traza.
          if ((item.box[2] - item.box[0]) * k < tiny && (item.box[3] - item.box[1]) * k < tiny) continue;
          let lastX = (points[0]! - view.x) * k;
          let lastY = (points[1]! - view.y) * k;
          context.moveTo(lastX, lastY);
          const end = points.length - 2;
          for (let index = 2; index <= end; index += 2) {
            const x = (points[index]! - view.x) * k;
            const y = (points[index + 1]! - view.y) * k;
            // Los vértices a menos de un píxel del último dibujado no cambian la línea; el final siempre se traza.
            if (index !== end && (x - lastX) ** 2 + (y - lastY) ** 2 < minStep) continue;
            context.lineTo(x, y);
            lastX = x;
            lastY = y;
          }
        }
        context.stroke();
      }
      context.globalAlpha = 1;
    };
    frame = requestAnimationFrame(paint);
    const watcher = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    });
    watcher.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      watcher.disconnect();
    };
  }, [ways, view, style, highlight, scale]);

  return <canvas ref={ref} className="roads-map-streets" aria-hidden="true" />;
}

/** La calle más cercana a un punto del plano, a no más de `tolerance` unidades. */
export function nearestWay(ways: readonly UrbanWay[], x: number, y: number, tolerance: number): UrbanWay | null {
  let best: UrbanWay | null = null;
  let bestDistance = tolerance * tolerance;
  for (const item of ways) {
    const [minX, minY, maxX, maxY] = item.box;
    if (x < minX - tolerance || x > maxX + tolerance || y < minY - tolerance || y > maxY + tolerance) continue;
    const points = item.points;
    for (let index = 2; index < points.length; index += 2) {
      const ax = points[index - 2]!;
      const ay = points[index - 1]!;
      const bx = points[index]!;
      const by = points[index + 1]!;
      const dx = bx - ax;
      const dy = by - ay;
      const length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0;
      const distance = (x - (ax + dx * t)) ** 2 + (y - (ay + dy * t)) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = item;
      }
    }
  }
  return best;
}

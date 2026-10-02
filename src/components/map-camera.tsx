'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { MAP_BOX, projectRoadPoint } from '@/lib/bolivia-map';

/**
 * La cámara de un mapa de líneas sobre el contorno de Bolivia: rueda,
 * pellizco, arrastre, doble clic, teclado y botones.
 *
 * Los mapas de «Transporte» sólo sabían encuadrar lo elegido; el lector que
 * quería ver una carretera tramo a tramo no podía acercarse a ella. Aquí el
 * encuadre automático (`home`) es sólo el punto de partida: cualquier gesto
 * lo reemplaza por la cámara del lector, y esa cámara se suelta sola cuando
 * cambia lo que se está mirando (`frameKey`), para que elegir otro
 * departamento no deje el mapa apuntando a donde estaba el anterior.
 *
 * El viewBox conserva siempre la proporción de `MAP_BOX` y el SVG la suya
 * (CSS `aspect-ratio`), así que un píxel de pantalla equivale a la misma
 * cantidad de plano en los dos ejes y no hay bandas: arrastrar y apuntar con
 * la rueda no necesitan corregir por letterbox.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FULL: Box = { x: 0, y: 0, width: MAP_BOX.width, height: MAP_BOX.height };

/** Cuánto se puede acercar: 1 es el país entero. A ×80 un píxel son unos 130 m. */
export const MAX_ZOOM = 80;

const RATIO = MAP_BOX.height / MAP_BOX.width;
const DRAG_SLOP = 4;

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high);

/** Un rectángulo con la proporción del mapa, centrado donde el dado y que lo contiene. */
export function fitBox(minX: number, minY: number, maxX: number, maxY: number, pad = 0.08, minSpan = 120): Box {
  // Un mínimo de 120 unidades: una ruta corta encuadrada al milímetro no deja ver dónde está.
  // Una calle de ciudad pide menos: 12 unidades son unos 16 km, una ciudad entera.
  const spanX = Math.max(minSpan, (maxX - minX) * (1 + pad * 2));
  const spanY = Math.max(minSpan, (maxY - minY) * (1 + pad * 2));
  const width = Math.min(Math.max(spanX, spanY / RATIO), FULL.width);
  const height = width * RATIO;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return clampBox({ x: cx - width / 2, y: cy - height / 2, width, height });
}

/** Mantiene la ventana dentro del país, con un poco de aire que se cierra al alejar. */
function clampBox(box: Box): Box {
  const width = clamp(box.width, FULL.width / MAX_ZOOM, FULL.width);
  const height = width * RATIO;
  const slackX = width * 0.1 * (1 - width / FULL.width);
  const slackY = height * 0.1 * (1 - width / FULL.width);
  return {
    x: clamp(box.x, FULL.x - slackX, FULL.x + FULL.width - width + slackX),
    y: clamp(box.y, FULL.y - slackY, FULL.y + FULL.height - height + slackY),
    width,
    height,
  };
}

interface Pointer {
  x: number;
  y: number;
}

type Gesture =
  | { mode: 'pan'; id: number; start: Pointer; view: Box; moved: boolean }
  | { mode: 'pinch'; start: Pointer[]; view: Box };

export interface MapCamera {
  view: Box;
  /** 1 es el país entero. */
  zoom: number;
  /** Ancho del SVG en píxeles, para dibujar la barra de escala. */
  pixels: number;
  /** Si el lector está arrastrando: no es momento de enseñar fichas. */
  panning: boolean;
  /** Si el lector movió la cámara por sí mismo (y no es el encuadre automático). */
  custom: boolean;
  atClosest: boolean;
  atWidest: boolean;
  zoomBy: (factor: number) => void;
  reset: () => void;
  /** Verdadero una vez tras un arrastre: el clic que lo cierra no es un clic. */
  consumeDrag: () => boolean;
  svgRef: RefObject<SVGSVGElement | null>;
  svgProps: {
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onDoubleClick: (event: React.MouseEvent<SVGSVGElement>) => void;
    style: React.CSSProperties;
  };
  stageProps: {
    tabIndex: number;
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  };
}

export function useMapCamera(home: Box, frameKey: string): MapCamera {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [camera, setCamera] = useState<{ key: string; box: Box } | null>(null);
  const [pixels, setPixels] = useState(0);
  const [panning, setPanning] = useState(false);

  const custom = camera !== null && camera.key === frameKey;
  const view = custom ? camera.box : home;
  /* La última vista, también entre dos renders: varias vueltas de rueda caben en uno. */
  const viewRef = useRef(view);
  viewRef.current = view;

  const apply = useCallback(
    (box: Box) => {
      const next = clampBox(box);
      viewRef.current = next;
      setCamera({ key: frameKey, box: next });
    },
    [frameKey],
  );

  /** Dónde cae un punto de la pantalla en el plano, según una vista dada. */
  const toPlane = useCallback((from: Box, clientX: number, clientY: number): Pointer | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: from.x + ((clientX - rect.left) / rect.width) * from.width,
      y: from.y + ((clientY - rect.top) / rect.height) * from.height,
    };
  }, []);

  /** Acerca por un factor dejando quieto el suelo que hay bajo el ancla (o el centro). */
  const zoomAbout = useCallback(
    (factor: number, anchor?: Pointer) => {
      const current = viewRef.current;
      const width = clamp(current.width / factor, FULL.width / MAX_ZOOM, FULL.width);
      const ratio = width / current.width;
      const point = anchor ?? { x: current.x + current.width / 2, y: current.y + current.height / 2 };
      apply({
        x: point.x - (point.x - current.x) * ratio,
        y: point.y - (point.y - current.y) * ratio,
        width,
        height: current.height * ratio,
      });
    },
    [apply],
  );

  const zoomBy = useCallback((factor: number) => zoomAbout(factor), [zoomAbout]);
  const reset = useCallback(() => {
    setCamera(null);
    setPanning(false);
  }, []);

  /* La rueda se ata a mano: React la registra pasiva y no podría impedir que la página se desplace. */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      const current = viewRef.current;
      const out = event.deltaY > 0;
      // Ya con el país entero a la vista, alejar es seguir bajando por la página.
      if (out && current.width >= FULL.width * 0.999 && !event.ctrlKey) return;
      event.preventDefault();
      const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      const factor = Math.exp(-clamp(event.deltaY * lines, -120, 120) * (event.ctrlKey ? 0.01 : 0.0018));
      zoomAbout(factor, toPlane(current, event.clientX, event.clientY) ?? undefined);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [toPlane, zoomAbout]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    setPixels(svg.clientWidth);
    const watcher = new ResizeObserver(() => setPixels(svg.clientWidth));
    watcher.observe(svg);
    return () => watcher.disconnect();
  }, []);

  const pointers = useRef(new Map<number, Pointer>());
  const gesture = useRef<Gesture | null>(null);
  const dragged = useRef(false);

  const begin = useCallback(() => {
    /* Copias: `onPointerMove` mueve los punteros vivos, y el punto de partida no debe moverse con ellos. */
    const held = [...pointers.current.entries()].map(([id, at]) => [id, { x: at.x, y: at.y }] as const);
    if (held.length === 1) {
      const [id, at] = held[0]!;
      gesture.current = { mode: 'pan', id, start: at, view: viewRef.current, moved: false };
    } else if (held.length >= 2) {
      gesture.current = { mode: 'pinch', start: [held[0]![1], held[1]![1]], view: viewRef.current };
      dragged.current = true;
      setPanning(true);
    } else {
      gesture.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      dragged.current = false;
      begin();
    },
    [begin],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const held = pointers.current.get(event.pointerId);
      const active = gesture.current;
      if (!held || !active) return;
      held.x = event.clientX;
      held.y = event.clientY;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;

      if (active.mode === 'pan' && active.id === event.pointerId) {
        const dx = event.clientX - active.start.x;
        const dy = event.clientY - active.start.y;
        if (!active.moved) {
          if (Math.abs(dx) + Math.abs(dy) <= DRAG_SLOP) return;
          active.moved = true;
          dragged.current = true;
          setPanning(true);
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* un puntero que ya se soltó: el arrastre sigue sin captura */
          }
        }
        const perPixel = active.view.width / rect.width;
        apply({ ...active.view, x: active.view.x - dx * perPixel, y: active.view.y - dy * perPixel });
      } else if (active.mode === 'pinch') {
        const [a, b] = [...pointers.current.values()];
        if (!a || !b) return;
        const [s1, s2] = active.start as [Pointer, Pointer];
        const startGap = Math.hypot(s1.x - s2.x, s1.y - s2.y) || 1;
        const factor = Math.hypot(a.x - b.x, a.y - b.y) / startGap;
        const width = clamp(active.view.width / factor, FULL.width / MAX_ZOOM, FULL.width);
        const height = width * RATIO;
        // El punto del plano que estaba entre los dedos al empezar sigue entre ellos.
        const anchor = toPlane(active.view, (s1.x + s2.x) / 2, (s1.y + s2.y) / 2);
        if (!anchor) return;
        const midX = ((a.x + b.x) / 2 - rect.left) / rect.width;
        const midY = ((a.y + b.y) / 2 - rect.top) / rect.height;
        apply({ x: anchor.x - midX * width, y: anchor.y - midY * height, width, height });
      }
    },
    [apply, toPlane],
  );

  const release = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      pointers.current.delete(event.pointerId);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      begin();
      if (pointers.current.size === 0) {
        setPanning(false);
        // El clic que cierra un arrastre llega justo después: se deja pasar un turno.
        if (dragged.current) setTimeout(() => (dragged.current = false), 0);
      }
    },
    [begin],
  );

  const onDoubleClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      zoomAbout(2, toPlane(viewRef.current, event.clientX, event.clientY) ?? undefined);
    },
    [toPlane, zoomAbout],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const current = viewRef.current;
      const step = 0.2;
      switch (event.key) {
        case '+':
        case '=':
          zoomAbout(1.5);
          break;
        case '-':
        case '_':
          zoomAbout(1 / 1.5);
          break;
        case '0':
          reset();
          break;
        case 'ArrowLeft':
          apply({ ...current, x: current.x - current.width * step });
          break;
        case 'ArrowRight':
          apply({ ...current, x: current.x + current.width * step });
          break;
        case 'ArrowUp':
          apply({ ...current, y: current.y - current.height * step });
          break;
        case 'ArrowDown':
          apply({ ...current, y: current.y + current.height * step });
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [apply, reset, zoomAbout],
  );

  const zoom = FULL.width / view.width;

  const consumeDrag = useCallback(() => {
    const was = dragged.current;
    dragged.current = false;
    return was;
  }, []);

  return {
    view,
    zoom,
    pixels,
    panning,
    custom,
    atClosest: view.width <= (FULL.width / MAX_ZOOM) * 1.001,
    atWidest: view.width >= FULL.width * 0.999,
    zoomBy,
    reset,
    consumeDrag,
    svgRef,
    svgProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel: release,
      onDoubleClick,
      // Con el país entero a la vista un dedo sigue desplazando la página; acercado, el dedo es del mapa.
      style: { touchAction: zoom > 1.02 ? 'none' : 'pan-y', cursor: panning ? 'grabbing' : zoom > 1.02 ? 'grab' : 'default' },
    },
    stageProps: { tabIndex: 0, onKeyDown },
  };
}

/** Km por unidad del plano: un grado de latitud (111,19 km) entre lo que mide en el plano. */
const KM_PER_UNIT = 111.19 / Math.abs(projectRoadPoint([0, -10])[1] - projectRoadPoint([0, -11])[1]);
const SCALE_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];

/**
 * Los botones, la lectura de acercamiento y la barra de escala.
 *
 * Misma píldora que los del mapa de «Ciudades» (`.map-tool`). La escala es la
 * del plano en el centro del encuadre: a la latitud de Bolivia la proyección
 * (equirrectangular a 16,5° S) se desvía unos pocos por ciento en los bordes,
 * lo que una barra redonda no pretende medir.
 */
export function MapTools({ camera, homeLabel }: { camera: MapCamera; homeLabel: string }) {
  const { view, zoom, pixels } = camera;
  const bar = useMemo(() => {
    if (pixels <= 0) return null;
    const kmPerPixel = (view.width * KM_PER_UNIT) / pixels;
    const step = SCALE_STEPS.find((candidate) => candidate / kmPerPixel >= 56) ?? SCALE_STEPS.at(-1)!;
    return {
      width: step / kmPerPixel,
      label: step >= 1 ? `${step} km` : `${Math.round(step * 1000)} m`,
    };
  }, [view.width, pixels]);

  return (
    <>
      <div className="roads-map-zoombar" role="group" aria-label="Acercamiento del mapa">
        <span className="places-map-zoom-read" aria-live="polite">
          {zoom < 1.05 ? 'todo el país' : `×${zoom.toFixed(zoom < 10 ? 1 : 0)}`}
        </span>
        <button
          type="button"
          className="map-tool"
          onClick={() => camera.zoomBy(1 / 1.6)}
          disabled={camera.atWidest}
          aria-label="Alejar el mapa"
          title="Alejar (tecla −)"
        >
          −
        </button>
        <button
          type="button"
          className="map-tool"
          onClick={() => camera.zoomBy(1.6)}
          disabled={camera.atClosest}
          aria-label="Acercar el mapa"
          title={camera.atClosest ? 'No hay más detalle que este' : 'Acercar (tecla +)'}
        >
          +
        </button>
        <button
          type="button"
          className="map-tool map-tool-wide"
          onClick={camera.reset}
          disabled={!camera.custom}
          title="Volver al encuadre inicial (tecla 0)"
        >
          {homeLabel}
        </button>
      </div>
      {bar ? (
        <div className="roads-map-scale" aria-hidden="true">
          <i style={{ width: bar.width }} />
          <span>{bar.label}</span>
        </div>
      ) : null}
    </>
  );
}

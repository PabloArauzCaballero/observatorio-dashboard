'use client';

import { Fragment, useState } from 'react';
import { additive } from '@/lib/choice';
import { Icon } from './icons';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

/**
 * One chart language for the whole report.
 *
 * Every series shares an axis treatment, a tooltip, a stroke weight and a draw
 * animation, so moving between sections never feels like moving between
 * products. Colour is spent only where it carries meaning: one hue for the
 * administered rate, one for the market, one for the distance between them.
 *
 * Rate axes are fitted rather than zeroed — a move from 9.6 to 11.6 is large in
 * economic terms and a zero baseline would flatten it into a straight line. The
 * gap axis keeps its zero, because there parity is a real reference.
 */

/**
 * The shape Recharts hands a custom tooltip, parameterised with the library's
 * own generics: pinning it tighter makes the renderer unassignable to `content`.
 */
type TooltipRender = TooltipContentProps<ValueType, NameType>;

/** Shared so a redesign happens in one place, not in six. */
const MOTION = { duration: 900, easing: 'ease-out' } as const;

/**
 * Los rótulos del eje son texto, y se leían a 3,8:1.
 *
 * `--ink-faint` es el gris de una nota al margen; en una cifra de 11 px pegada
 * al borde del dibujo es una sugerencia. `--axis-ink` es el mismo gris subido a
 * 4,6:1, que es el umbral a partir del cual un número pequeño se lee sin
 * acercarse a la pantalla.
 */
const AXIS = {
  stroke: 'var(--axis-ink)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

/** Rejilla: un pelo sólido a un paso de la superficie, nunca discontinua. */
const GRID = { stroke: 'var(--grid)', vertical: false } as const;

/**
 * El grosor máximo de una barra.
 *
 * Sin tope, una barra ocupa toda su banda y el gráfico se convierte en un muro
 * de bloques saturados: el dato deja de ser una marca y pasa a ser el fondo.
 * Con el tope, lo que sobra de la banda es aire, que es lo que separa una
 * barra de la siguiente sin dibujar nada.
 */
const BAR_CAP = 24;

/**
 * La rendija que separa dos marcas que se tocan.
 *
 * Son 2 px del color de la superficie entre los tramos de un apilado. Es el
 * mecanismo —no un borde alrededor de cada tramo, que añade tinta con peso de
 * dato— y tiene que medir lo mismo en todo el apilado.
 */
const STACK_GAP = { stroke: 'var(--chart-surface)', strokeWidth: 2 } as const;

/**
 * El anillo de superficie de un punto.
 *
 * Un punto de fin de línea cruza la línea de al lado y se pierde; 2 px del
 * color del panel alrededor lo devuelven. Forma parte del área sensible, no
 * solo del dibujo.
 */
const DOT_RING = { stroke: 'var(--chart-surface)', strokeWidth: 2 } as const;

/**
 * A frame height that follows the screen instead of the figure it was written
 * with.
 *
 * The callers of these bar charts pass pixels, and they have to: a list of
 * fourteen rows needs more box than a list of four, and only the caller knows
 * how many rows it has. But the figure was chosen against a laptop, so on a
 * desktop the chart drew itself exactly as small as it always had and left the
 * bottom of the screen empty.
 *
 * The caller's number becomes the floor — nothing gets shorter than it was, on
 * any display — and above it the frame takes the same share of the viewport
 * that number was of a 900-pixel one. The cap keeps a six-bar chart from
 * stretching its bars into bands.
 */
const framed = (base: number): string =>
  `clamp(${base}px, ${((base / 900) * 100).toFixed(1)}vh, ${Math.round(base * 1.55)}px)`;

/**
 * Las casillas de identidad, en su orden, y ese orden NO se toca.
 *
 * Es la única lista de la que puede salir el color de una serie. Se asignan en
 * orden y no se ciclan: la séptima serie no inventa un color —dos colores
 * generados son indistinguibles bajo daltonismo y rompen la validación— sino
 * que se pliega en «Otros», que es el gris de `--series-rest`.
 */
export const SERIES = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
] as const;

/** El color de la casilla `index`, o el gris del resto si ya no quedan. */
export const seriesTone = (index: number): string => SERIES[index] ?? 'var(--series-rest)';

export interface LegendItem {
  color: string;
  label: string;
  /** `line` para las series que son línea; `fill` (el defecto) para rellenos. */
  shape?: 'fill' | 'line';
  /** Marca discontinua, para la serie que el gráfico dibuja discontinua. */
  dashed?: boolean;
}

/**
 * La clave que nombra cada color, bajo el dibujo.
 *
 * Está SIEMPRE, y no como adorno: el color es el único canal que puede fallarle
 * a un lector —daltonismo, una impresión en gris, una captura de pantalla
 * recomprimida—. La leyenda es el canal que no falla, y las etiquetas directas
 * sobre las marcas la complementan en lugar de sustituirla.
 *
 * También cuando la serie es una sola. Antes se omitía ahí, con el argumento de
 * que el título ya la nombra; no la nombra. El título dice de qué trata el
 * panel —«Nivel», «Intensidad energética»— y la leyenda dice qué es esa línea y
 * en qué unidad, que es lo que hace falta para leerla. Un cuadrito de más gasta
 * una línea de texto; una línea anónima cuesta releer el párrafo de arriba.
 *
 * La marca imita la marca del gráfico: cuadrado para un relleno, trazo para una
 * línea, discontinuo si la línea lo es.
 */
function ChartLegend({ items }: { items: ReadonlyArray<LegendItem> }) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span
            className={
              item.shape === 'line'
                ? `chart-legend-mark chart-legend-mark-line${
                    item.dashed ? ' chart-legend-mark-dashed' : ''
                  }`
                : 'chart-legend-mark'
            }
            style={item.shape === 'line' ? { color: item.color } : { background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Los renglones de la leyenda de un gráfico de líneas, a partir de sus series.
 *
 * Tres gráficos distintos armaban la misma lista a mano y uno de ellos —el de
 * años, el que dibuja la mitad del capítulo de Energía— se quedó sin armarla:
 * siete líneas de colores y ninguna clave, con los nombres escondidos en el
 * emergente, que no existe al imprimir ni en una captura. Es la misma lista
 * siempre, así que se escribe una vez.
 */
function lineLegend(
  series: ReadonlyArray<{ label: string; tone: string; dashed?: boolean }>,
): ReadonlyArray<LegendItem> {
  return series.map((one) => ({
    color: one.tone,
    label: one.label,
    shape: 'line' as const,
    ...(one.dashed ? { dashed: true } : {}),
  }));
}

export interface RatePoint {
  date: string;
  parallelBuy?: number | null;
  parallelSell?: number | null;
  official?: number | null;
  archived?: boolean;
}

export interface GapChartPoint {
  date: string;
  gapPercent: number;
}

export interface SpreadPoint {
  date: string;
  spread: number;
  venues: number | null;
}

export interface MacroSeriesPoint {
  period: string;
  value: number;
}

const dayMonth = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});
const longDate = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Month names, for the tooltips that name a month rather than plot it. */
const MONTH_NAME = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** A day written out, for the captions that sit outside a chart. */
export const sayDate = (value: string): string => longDate.format(asDate(value));

const asDate = (value: string): Date => new Date(`${value}T12:00:00Z`);
/**
 * A day on the axis, and the year whenever the axis crosses into one.
 *
 * These series run for years, and "16-ene" on its own leaves the reader to
 * work out which January they are looking at from the ticks either side of it.
 * A January tick therefore carries the year instead of the day — the same
 * convention a price chart uses, and it costs nothing on a series short enough
 * never to reach one.
 */
const shortLabel = (value: string): string => {
  const date = asDate(value);
  // Only the tick that opens a January carries the year. Marking every January
  // tick printed «ene '26» three times in a row on a zoomed axis, which reads
  // as a broken chart rather than as a year boundary.
  if (date.getUTCMonth() === 0 && date.getUTCDate() <= 10) {
    return `ene ’${String(date.getUTCFullYear()).slice(2)}`;
  }
  return dayMonth.format(date);
};
const number = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/**
 * Drag across a chart to zoom into those dates.
 *
 * Press anywhere on the plot and a line marks where you started; keep the
 * button down and it opens into a band that follows the pointer; let go and the
 * chart redraws to that stretch alone. It is the gesture a reader already knows
 * from every trading terminal, and it answers the question a fixed period
 * control cannot: "what happened between those two weeks in particular".
 *
 * The right button works as well as the left, because that is the one people
 * reach for, and the context menu is suppressed only while a drag is in
 * progress — a reader who right-clicks without dragging still gets their menu.
 *
 * A drag that covers fewer than two readings is treated as a click and clears
 * the zoom instead of setting one: pinching the chart to a single day would
 * leave nothing to look at and no obvious way back.
 */
export interface RangeZoom {
  /** The rows the chart should draw: the whole series, or the chosen stretch. */
  visible: <T>(rows: readonly T[]) => T[];
  /** Whether a stretch is currently chosen. */
  zoomed: boolean;
  /** The band being dragged right now, if any. */
  marking: { from: string; to: string } | null;
  /** The labels bounding the chosen stretch, for the caption. */
  bounds: { from: string; to: string } | null;
  begin: (label?: unknown) => void;
  drag: (label?: unknown) => void;
  finish: () => void;
  reset: () => void;
}

export function useRangeZoom(labels: readonly string[]): RangeZoom {
  const [anchor, setAnchor] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);

  const at = (label: string): number => labels.indexOf(label);

  return {
    zoomed: range !== null,
    bounds:
      range && labels[range[0]] && labels[range[1]]
        ? { from: labels[range[0]] as string, to: labels[range[1]] as string }
        : null,
    marking: anchor && cursor && anchor !== cursor ? { from: anchor, to: cursor } : null,
    visible: <T,>(rows: readonly T[]): T[] =>
      range ? rows.slice(range[0], range[1] + 1) : [...rows],
    begin: (label?: unknown) => {
      // The axis holds dates, but Recharts types the active label as a string
      // or a number; anything that is not one of our labels is ignored.
      if (typeof label !== 'string') return;
      setAnchor(label);
      setCursor(label);
    },
    drag: (label?: unknown) => {
      if (anchor && typeof label === 'string') setCursor(label);
    },
    finish: () => {
      if (anchor && cursor) {
        const edges = [at(anchor), at(cursor)].sort((left, right) => left - right);
        const low = edges[0] ?? -1;
        const high = edges[1] ?? -1;
        if (low >= 0 && high - low >= 2) {
          // Indices are into the labels of what is on screen, so a zoom inside
          // a zoom composes with the one already applied.
          setRange((held) => (held ? [held[0] + low, held[0] + high] : [low, high]));
        }
      }
      setAnchor(null);
      setCursor(null);
    },
    reset: () => setRange(null),
  };
}

/** The band a drag is painting, drawn over the series it is selecting. */
export function ZoomBand({ zoom }: { zoom: RangeZoom }) {
  if (!zoom.marking) return null;
  return (
    <ReferenceArea
      x1={zoom.marking.from}
      x2={zoom.marking.to}
      strokeOpacity={0.9}
      stroke="var(--ink-faint)"
      fill="var(--ink)"
      fillOpacity={0.08}
    />
  );
}

/** The way back out, shown only once there is somewhere to go back to. */
export function ZoomExit({
  zoom,
  format,
}: {
  zoom: RangeZoom;
  format?: (label: string) => string;
}) {
  if (!zoom.zoomed || !zoom.bounds) return null;
  const say = format ?? ((label: string) => label);
  return (
    <button type="button" className="zoom-exit" onClick={zoom.reset}>
      <Icon name="refrescar" size={13} />
      {say(zoom.bounds.from)} → {say(zoom.bounds.to)} · ver todo
    </button>
  );
}

/** Padding that keeps a line off the frame without inventing headroom. */
function fittedDomain(values: number[]): [number, number] {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return [0, 1];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const pad = Math.max((max - min) * 0.12, Math.abs(max) * 0.01, 0.02);
  return [Number((min - pad).toFixed(4)), Number((max + pad).toFixed(4))];
}

/**
 * The box a chart is drawn in, and the one place the context menu is refused.
 *
 * Readers reach for the right button to drag a range — it is what a trading
 * terminal trains them to do — and the browser answers with its own menu
 * instead. Suppressing it here, over the plot and nowhere else, lets either
 * button paint the band. Everywhere else on the page the menu still works,
 * including on the text and links inside these panels.
 */
function Frame({ children, tall }: { children: React.ReactElement; tall?: boolean }) {
  return (
    <div
      className={tall ? 'chart-frame chart-frame-tall' : 'chart-frame'}
      onContextMenu={(event) => event.preventDefault()}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export interface TooltipRow {
  name: string;
  value: string;
  /** El color de la serie, dibujado como trazo corto delante del nombre. */
  color?: string;
}

/**
 * Lo que dice el gráfico cuando el lector apunta.
 *
 * Tres reglas, y ninguna es de estilo. La cifra manda y el rótulo la sigue,
 * porque quien apunta ya sabe qué serie mira y lo que le falta es el número.
 * La serie se identifica con un trazo de su color delante del nombre, no
 * pintando el nombre —un ámbar como texto no se lee—. Y el tooltip AÑADE: todo
 * lo que enseña está también en el eje, en una etiqueta directa o en la tabla,
 * porque un valor que solo existe al pasar el ratón no existe para quien lee
 * con teclado, imprime o mira una captura.
 */
function TooltipShell({
  label,
  rows,
  note,
}: {
  label: string;
  rows: Array<TooltipRow>;
  note?: string;
}) {
  return (
    <div className="tooltip">
      <div className="t-date">{label}</div>
      {rows.map((row) => (
        <div className="t-row" key={row.name}>
          <span>
            {row.color ? <i className="t-key" style={{ color: row.color }} /> : null}
            {row.name}
          </span>
          <strong>{row.value}</strong>
        </div>
      ))}
      {note ? <div className="t-note">{note}</div> : null}
    </div>
  );
}

/**
 * Las tres series del tipo de cambio, nombradas.
 *
 * Este gráfico llevaba tres líneas y ninguna clave: las dos del paralelo
 * comparten tono y se distinguen solo por el trazo, así que un lector que
 * llegaba por primera vez tenía que pasar el ratón por encima para saber cuál
 * era la compra y cuál la venta —y quien imprimía la página no podía saberlo
 * nunca—.
 */
const RATE_KEY: ReadonlyArray<LegendItem> = [
  { color: 'var(--official)', label: 'Oficial', shape: 'line' },
  { color: 'var(--parallel)', label: 'Paralelo · compra', shape: 'line' },
  { color: 'var(--parallel)', label: 'Paralelo · venta', shape: 'line', dashed: true },
];

/**
 * A rate against time, with the market's two published sides and, where it
 * exists, the administered rate.
 */
export function RateChart({
  data,
  tall,
  zoom: shared,
}: {
  data: RatePoint[];
  tall?: boolean;
  /**
   * A zoom owned by the panel rather than by this chart.
   *
   * The exchange-rate panel draws the same dates as a line and as candles, and
   * a reader who drags a stretch on one and then switches expects to still be
   * looking at it. A zoom that lives inside one chart cannot be honoured by the
   * other, so the panel holds it and both are handed the same one.
   */
  zoom?: RangeZoom;
}) {
  const own = useRangeZoom(data.map((point) => point.date));
  const zoom = shared ?? own;
  const shown = zoom.visible(data);
  const domain = fittedDomain(
    shown.flatMap((point) =>
      [point.parallelBuy, point.parallelSell, point.official].filter(
        (value): value is number => typeof value === 'number',
      ),
    ),
  );

  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length || typeof label !== 'string') return null;
    const point = payload[0]?.payload as RatePoint | undefined;
    const rows = [
      { name: 'Paralelo compra', value: point?.parallelBuy, color: 'var(--parallel)' },
      { name: 'Paralelo venta', value: point?.parallelSell, color: 'var(--parallel)' },
      { name: 'Oficial', value: point?.official, color: 'var(--official)' },
    ]
      .filter(
        (row): row is { name: string; value: number; color: string } =>
          typeof row.value === 'number',
      )
      .map((row) => ({
        name: row.name,
        value: `${number(row.value, 4)} Bs/USD`,
        color: row.color,
      }));

    return (
      <TooltipShell
        label={longDate.format(asDate(label))}
        rows={rows}
        {...(point?.archived ? { note: 'Incluye serie de promedio diario' } : {})}
      />
    );
  };

  /*
   * El punto del final de cada línea, con su anillo de superficie.
   *
   * Es el único punto que se dibuja: marcar los mil y pico días llenaría el
   * gráfico de puntos y no diría nada, pero el último es la lectura de hoy —la
   * cifra por la que se abre este panel— y sin él la línea se acaba en el aire.
   * El anillo del color del panel lo separa de la línea que cruza por detrás.
   */
  const last = shown.at(-1);
  const endDot = (key: 'official' | 'parallelBuy', color: string) =>
    last && typeof last[key] === 'number' ? (
      <ReferenceDot x={last.date} y={last[key] as number} r={4.5} fill={color} {...DOT_RING} />
    ) : null;

  return (
    <div className="chart-stack">
      <ZoomExit zoom={zoom} format={(label) => longDate.format(asDate(label))} />
      <Frame {...(tall ? { tall: true } : {})}>
        <ComposedChart
          data={shown}
          margin={{ top: 10, right: 14, bottom: 4, left: 4 }}
          onMouseDown={(event) => zoom.begin(event?.activeLabel)}
          onMouseMove={(event) => zoom.drag(event?.activeLabel)}
          onMouseUp={zoom.finish}
          onMouseLeave={zoom.finish}
        >
          <defs>
            {/*
             * Un lavado, no un bloque. El relleno de un área está para decir
             * de qué lado del eje vive la línea, no para competir con ella: a
             * 18 % el azul pesaba más que el trazo que es el dato.
             */}
            <linearGradient id="fillOfficial" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--official)" stopOpacity={0.1} />
              <stop offset="100%" stopColor="var(--official)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="date" tickFormatter={shortLabel} minTickGap={52} {...AXIS} />
          <YAxis domain={domain} width={54} tickFormatter={(value) => number(value, 2)} {...AXIS} />
          <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--rule)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="official"
            name="Oficial"
            stroke="var(--official)"
            strokeWidth={2}
            fill="url(#fillOfficial)"
            dot={false}
            connectNulls
            animationDuration={MOTION.duration}
            animationEasing={MOTION.easing}
          />
          <Line
            type="monotone"
            dataKey="parallelBuy"
            name="Paralelo compra"
            stroke="var(--parallel)"
            strokeWidth={2}
            dot={false}
            connectNulls
            animationDuration={MOTION.duration}
            animationEasing={MOTION.easing}
          />
          <Line
            type="monotone"
            dataKey="parallelSell"
            name="Paralelo venta"
            stroke="var(--parallel)"
            strokeWidth={1.4}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
            animationDuration={MOTION.duration}
            animationEasing={MOTION.easing}
          />
          {endDot('official', 'var(--official)')}
          {endDot('parallelBuy', 'var(--parallel)')}
          <ZoomBand zoom={zoom} />
        </ComposedChart>
      </Frame>
      <ChartLegend items={RATE_KEY} />
    </div>
  );
}

export function GapChart({ data, tall }: { data: GapChartPoint[]; tall?: boolean }) {
  const zoom = useRangeZoom(data.map((point) => point.date));
  const shown = zoom.visible(data);
  const domain = fittedDomain([0, ...shown.map((point) => point.gapPercent)]);
  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length || typeof label !== 'string') return null;
    const point = payload[0]?.payload as GapChartPoint | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={longDate.format(asDate(label))}
        rows={[{ name: 'Brecha', value: `${number(point.gapPercent)} %` }]}
      />
    );
  };

  return (
    <>
      <ZoomExit zoom={zoom} format={(label) => longDate.format(asDate(label))} />
      <Frame {...(tall ? { tall: true } : {})}>
        <ComposedChart
          data={shown}
          margin={{ top: 10, right: 14, bottom: 4, left: 4 }}
          onMouseDown={(event) => zoom.begin(event?.activeLabel)}
          onMouseMove={(event) => zoom.drag(event?.activeLabel)}
          onMouseUp={zoom.finish}
          onMouseLeave={zoom.finish}
        >
          <defs>
            <linearGradient id="fillGap" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gap)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="var(--gap)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="date" tickFormatter={shortLabel} minTickGap={52} {...AXIS} />
          <YAxis
            domain={domain}
            width={54}
            tickFormatter={(value) => `${number(value, 0)}%`}
            {...AXIS}
          />
          <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--rule)', strokeWidth: 1 }} />
          {/*
           * Parity is a real reference here, unlike on a rate axis — y es una
           * regla del eje, no un umbral que alguien eligió, así que va sólida:
           * el discontinuo dice «límite» y aquí solo dice «cero».
           */}
          <ReferenceLine y={0} stroke="var(--axis-rule)" strokeWidth={1} />
          <Area
            type="monotone"
            dataKey="gapPercent"
            name="Brecha"
            stroke="var(--gap)"
            fill="url(#fillGap)"
            strokeWidth={2}
            dot={false}
            animationDuration={MOTION.duration}
            animationEasing={MOTION.easing}
          />
          <ZoomBand zoom={zoom} />
        </ComposedChart>
      </Frame>
    </>
  );
}

export function SpreadChart({ data }: { data: SpreadPoint[] }) {
  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length || typeof label !== 'string') return null;
    const point = payload[0]?.payload as SpreadPoint | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={longDate.format(asDate(label))}
        rows={[{ name: 'Dispersión', value: `${number(point.spread, 4)} Bs` }]}
        {...(point.venues ? { note: `${point.venues} plazas cotizando` } : {})}
      />
    );
  };

  return (
    <Frame>
      <ComposedChart data={data} margin={{ top: 10, right: 14, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="fillSpread" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--parallel)" stopOpacity={0.12} />
            <stop offset="100%" stopColor="var(--parallel)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="date" tickFormatter={shortLabel} minTickGap={52} {...AXIS} />
        <YAxis width={54} tickFormatter={(value) => number(value, 2)} {...AXIS} />
        <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--rule)', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="spread"
          name="Dispersión"
          stroke="var(--parallel)"
          fill="url(#fillSpread)"
          strokeWidth={1.8}
          dot={false}
          animationDuration={MOTION.duration}
          animationEasing={MOTION.easing}
        />
      </ComposedChart>
    </Frame>
  );
}

/**
 * An annual series on its own axis.
 *
 * Small enough to sit in a grid of its peers, because a macroeconomic reading
 * is understood against its own history, not against another indicator's scale.
 */
export function MacroChart({
  data,
  unit,
  tone,
  label: seriesName,
}: {
  data: MacroSeriesPoint[];
  unit: string;
  tone: string;
  /**
   * Cómo se llama la línea, para la clave de abajo y para el emergente.
   *
   * Sin él el emergente decía «Valor», que es lo que ya se sabe de cualquier
   * número de un gráfico, y la línea no tenía nombre en ninguna parte: en una
   * fila de dos paneles el lector no puede decir cuál de los dos títulos manda
   * sobre cuál dibujo. Opcional porque los paneles macro más viejos llevan el
   * nombre en su propio pie; donde se pasa, se dibuja la clave.
   */
  label?: string;
}) {
  const zoom = useRangeZoom(data.map((point) => point.period));
  const shown = zoom.visible(data);
  const domain = fittedDomain(shown.map((point) => point.value));
  const compact = (value: number): string =>
    unit === 'USD'
      ? Math.abs(value) >= 1_000_000_000
        ? `${number(value / 1_000_000_000, 1)} MM`
        : `${number(value / 1_000_000, 0)} M`
      : number(value, 1);

  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length || typeof label !== 'string') return null;
    const point = payload[0]?.payload as MacroSeriesPoint | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={label}
        rows={[{ name: seriesName ?? 'Valor', value: compact(point.value) }]}
      />
    );
  };

  return (
    <div className="chart-stack">
      <ZoomExit zoom={zoom} />
      <div
        className="chart-frame chart-frame-small"
        onContextMenu={(event) => event.preventDefault()}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={shown}
            margin={{ top: 8, right: 6, bottom: 0, left: 0 }}
            onMouseDown={(event) => zoom.begin(event?.activeLabel)}
            onMouseMove={(event) => zoom.drag(event?.activeLabel)}
            onMouseUp={zoom.finish}
            onMouseLeave={zoom.finish}
          >
            <CartesianGrid {...GRID} />
            <XAxis dataKey="period" minTickGap={34} {...AXIS} />
            <YAxis domain={domain} width={46} tickFormatter={compact} {...AXIS} />
            <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--rule)', strokeWidth: 1 }} />
            {domain[0] < 0 ? (
              <ReferenceLine y={0} stroke="var(--axis-rule)" strokeWidth={1} />
            ) : null}
            <Line
              type="monotone"
              dataKey="value"
              stroke={tone}
              strokeWidth={1.9}
              dot={false}
              animationDuration={MOTION.duration}
              animationEasing={MOTION.easing}
            />
            <ZoomBand zoom={zoom} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {seriesName ? (
        <ChartLegend items={lineLegend([{ label: `${seriesName} (${unit})`, tone }])} />
      ) : null}
    </div>
  );
}

/**
 * The shape of a series behind its headline figure.
 *
 * No axes and no labels: it answers "which way has this been going", which is
 * the only question a number on a card leaves open.
 */
export function Sparkline({ data, tone }: { data: number[]; tone: string }) {
  const points = data.map((value, index) => ({ index, value }));
  return (
    <div className="sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <YAxis domain={fittedDomain(data)} hide />
          <Line
            type="monotone"
            dataKey="value"
            stroke={tone}
            strokeWidth={1.6}
            dot={false}
            animationDuration={MOTION.duration}
            animationEasing={MOTION.easing}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Econometric views ------------------------------------------------------ */

export interface SeriesPoint {
  date: string;
  value: number;
}

/**
 * One series against time, in whichever mark suits what it measures.
 *
 * A single component rather than four, so a rolling correlation and a rolling
 * volatility cannot drift apart in axis treatment, tooltip or timing. The mark
 * changes; the language does not.
 */
export function SeriesChart({
  data,
  kind,
  tone,
  unit,
  label: seriesName,
  decimals = 2,
  zeroLine,
  boundary,
  domain,
  height,
}: {
  data: SeriesPoint[];
  kind: 'line' | 'area' | 'bar';
  tone: string;
  unit: string;
  /**
   * Qué es esta serie, para la clave de abajo y para el emergente.
   *
   * Sin él el emergente decía «Valor» y el dibujo no decía nada: en una fila de
   * dos paneles —volatilidad al lado de distribución, correlación al lado de
   * caída— nada ataba cada trazo a su título, y menos al imprimir, donde el
   * emergente no existe. Opcional para no romper las llamadas que aún no lo
   * pasan; donde se pasa, se dibuja la clave.
   */
  label?: string;
  decimals?: number;
  /** Draw the zero reference, where crossing it means something. */
  zeroLine?: boolean;
  /** Day the measurement method changes, marked so it is not read as a signal. */
  boundary?: string | null;
  domain?: [number, number];
  height?: 'small' | 'normal' | 'tall';
}) {
  const gradientId = `grad-${tone.replace(/[^a-z]/gu, '')}-${kind}`;
  const values = data.map((point) => point.value);
  const zoom = useRangeZoom(data.map((point) => point.date));
  const shown = zoom.visible(data);
  const axisDomain = domain ?? fittedDomain(values);

  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length || typeof label !== 'string') return null;
    const point = payload[0]?.payload as SeriesPoint | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={longDate.format(asDate(label))}
        rows={[{ name: seriesName ?? 'Valor', value: `${number(point.value, decimals)} ${unit}` }]}
      />
    );
  };

  /** Dónde cae la frontera dentro de lo que se está dibujando, de 0 a 1. */
  const boundaryAt = boundary ? shown.findIndex((point) => point.date === boundary) : -1;
  const boundaryLate = boundaryAt >= 0 && shown.length > 1 && boundaryAt / shown.length > 0.62;

  const frameClass =
    height === 'tall'
      ? 'chart-frame chart-frame-tall'
      : height === 'small'
        ? 'chart-frame chart-frame-small'
        : 'chart-frame';

  return (
    <div className="chart-stack">
      <ZoomExit zoom={zoom} format={(label) => longDate.format(asDate(label))} />
      <div className={frameClass} onContextMenu={(event) => event.preventDefault()}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={shown}
            margin={{ top: 10, right: 14, bottom: 4, left: 4 }}
            onMouseDown={(event) => zoom.begin(event?.activeLabel)}
            onMouseMove={(event) => zoom.drag(event?.activeLabel)}
            onMouseUp={zoom.finish}
            onMouseLeave={zoom.finish}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tone} stopOpacity={0.12} />
                <stop offset="100%" stopColor={tone} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="date" tickFormatter={shortLabel} minTickGap={52} {...AXIS} />
            <YAxis
              domain={axisDomain}
              width={54}
              tickFormatter={(value) => number(value, decimals === 0 ? 0 : 1)}
              {...AXIS}
            />
            <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--rule)', strokeWidth: 1 }} />
            {zeroLine ? <ReferenceLine y={0} stroke="var(--axis-rule)" strokeWidth={1} /> : null}
            {boundary ? (
              <ReferenceLine
                x={boundary}
                stroke="var(--axis-rule)"
                strokeDasharray="2 4"
                label={{
                  value: 'cambio de método',
                  position: boundaryLate ? 'insideTopRight' : 'insideTopLeft',
                  fontSize: 10,
                  fill: 'var(--axis-ink)',
                }}
              />
            ) : null}
            {kind === 'bar' ? (
              /*
               * Opaca y con tope de grosor, no traslúcida y a toda la banda.
               * Bajar la opacidad de una barra para «suavizarla» la pone a
               * medio camino del fondo y hace que dos barras que se solapan
               * mientan sobre su valor; lo que la suaviza es ser delgada.
               */
              <Bar
                dataKey="value"
                fill={tone}
                maxBarSize={BAR_CAP}
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={MOTION.duration}
                animationEasing={MOTION.easing}
              />
            ) : kind === 'area' ? (
              <Area
                type="monotone"
                dataKey="value"
                stroke={tone}
                strokeWidth={1.9}
                fill={`url(#${gradientId})`}
                dot={false}
                animationDuration={MOTION.duration}
                animationEasing={MOTION.easing}
              />
            ) : (
              <Line
                type="monotone"
                dataKey="value"
                stroke={tone}
                strokeWidth={1.9}
                dot={false}
                animationDuration={MOTION.duration}
                animationEasing={MOTION.easing}
              />
            )}
            <ZoomBand zoom={zoom} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {seriesName ? (
        <ChartLegend
          items={lineLegend([{ label: unit ? `${seriesName} (${unit})` : seriesName, tone }])}
        />
      ) : null}
    </div>
  );
}

export interface HistogramBucket {
  bin: string;
  count: number;
  tail: boolean;
}

/**
 * The distribution of daily returns.
 *
 * The buckets below the fifth percentile are drawn apart, because the tail is
 * the part of this shape an analyst is looking for and reading it off a uniform
 * bar chart means counting.
 */
export function Histogram({ data }: { data: HistogramBucket[] }) {
  const renderTooltip = ({ active, payload }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as HistogramBucket | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={`${point.bin} %`}
        rows={[
          {
            name: point.tail ? 'Días (cola inferior)' : 'Días',
            value: String(point.count),
            color: point.tail ? 'var(--up)' : 'var(--official)',
          },
        ]}
        {...(point.tail ? { note: 'Cola inferior (5 %)' } : {})}
      />
    );
  };

  return (
    <div className="chart-stack">
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 14, bottom: 4, left: 4 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="bin" minTickGap={26} {...AXIS} />
            <YAxis width={44} allowDecimals={false} {...AXIS} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
            <Bar
              dataKey="count"
              maxBarSize={BAR_CAP}
              radius={[4, 4, 0, 0]}
              animationDuration={MOTION.duration}
              animationEasing={MOTION.easing}
            >
              {data.map((bucket) => (
                /*
                 * Énfasis, no dos series: la cola es el hallazgo y el resto es
                 * el contexto contra el que se lee. Las dos opacidades que
                 * había antes decían lo mismo dos veces y dejaban el cuerpo de
                 * la distribución medio borrado; el peso lo lleva el color.
                 */
                <Cell key={bucket.bin} fill={bucket.tail ? 'var(--up)' : 'var(--official)'} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={TAIL_KEY} />
    </div>
  );
}

/** Los dos colores del histograma, nombrados bajo el dibujo. */
const TAIL_KEY: ReadonlyArray<LegendItem> = [
  { color: 'var(--up)', label: 'Cola inferior (peor 5 % de las jornadas)' },
  { color: 'var(--official)', label: 'Resto de las jornadas' },
];

export interface CandlePoint {
  period: string;
  open: number;
  close: number;
}

/**
 * Year-on-year change as candles.
 *
 * Each candle spans from the previous year's level to this one's, so its body
 * IS the annual change: tall means the series moved a lot, and the colour says
 * which way. A line answers "what was the level"; this answers "what did the
 * year do", which is the question an annual series is usually asked.
 *
 * Drawn rather than composed from a chart library's OHLC series, because what
 * is wanted here is two numbers a year and not a trading instrument.
 */
export function YearCandles({ data, unit }: { data: CandlePoint[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) {
    return <div className="callout">Se necesitan al menos dos años para comparar.</div>;
  }

  const width = 1000;
  const height = 132;
  const covered = `${data[0]?.period ?? ''} a ${data.at(-1)?.period ?? ''}`;
  const values = data.flatMap((point) => [point.open, point.close]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const pad = 10;
  const scale = (value: number): number =>
    height - pad - ((value - low) / span) * (height - pad * 2);

  const step = width / data.length;
  const body = Math.min(step * 0.6, 20);
  const shown = hover === null ? null : data[hover];
  /*
   * The change the candle draws, stated as the reader reads it. A body is only
   * a length until it says how much: the percentage is what an economist quotes
   * and the points are what the axis shows, so the label carries both.
   */
  const move =
    shown && shown.open !== 0 ? ((shown.close - shown.open) / Math.abs(shown.open)) * 100 : null;

  return (
    <div className="candles">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Cambio anual de la serie, ${data.length} años, de ${covered}, en ${unit}. Cada vela va del nivel del año anterior al de ese año.`}
        onMouseLeave={() => setHover(null)}
      >
        <line x1="0" y1={height - pad} x2={width} y2={height - pad} className="candle-axis" />
        {data.map((point, index) => {
          const centre = step * (index + 0.5);
          const top = scale(Math.max(point.open, point.close));
          const bottom = scale(Math.min(point.open, point.close));
          const rising = point.close >= point.open;
          return (
            <g
              key={point.period}
              className={rising ? 'candle candle-up' : 'candle candle-down'}
              onMouseEnter={() => setHover(index)}
            >
              {/* A full-height target: a two-pixel body is not something a
                  pointer can be expected to find. */}
              <rect
                x={centre - step / 2}
                y={0}
                width={step}
                height={height}
                className="candle-hit"
              />
              <line x1={centre} y1={top} x2={centre} y2={bottom} className="candle-wick" />
              <rect
                x={centre - body / 2}
                y={top}
                width={body}
                height={Math.max(bottom - top, 1.2)}
              />
              {hover === index ? (
                <rect
                  x={centre - step / 2}
                  y={0}
                  width={step}
                  height={height}
                  className="candle-lit"
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      {shown ? (
        <div className="candle-tip">
          <b>{shown.period}</b>
          <span className={move !== null && move >= 0 ? 'delta-up' : 'delta-down'}>
            {move === null
              ? '—'
              : `${move > 0 ? '+' : ''}${move.toLocaleString('es-BO', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })} %`}
          </span>
          <span className="candle-tip-detail">
            {number(shown.open, 2)} → {number(shown.close, 2)} {unit}
          </span>
        </div>
      ) : (
        <div className="candle-foot">
          <span>{data[0]?.period}</span>
          <span className="candle-scale">
            {low.toLocaleString('es-BO', { maximumFractionDigits: 2 })} –{' '}
            {high.toLocaleString('es-BO', { maximumFractionDigits: 2 })} {unit}
          </span>
          <span>{data.at(-1)?.period}</span>
        </div>
      )}
    </div>
  );
}

export interface DayCandle {
  date: string;
  /** Where the day started: the previous session's mid-point. */
  open: number;
  /** Where it ended: this session's mid-point. */
  close: number;
  /** The two sides the source published that day. */
  high: number;
  low: number;
}

/**
 * The parallel dollar as one candle per session.
 *
 * Built from exactly what the source publishes and nothing more. It quotes two
 * prices a day — the two sides it labels `buy` and `sell` — so the day's range
 * is those two, and the body runs from yesterday's mid-point to today's. That
 * is a real high, a real low and a real change, which is what a candle is for.
 *
 * It is NOT an intraday candle and the caption says so. A true one would need
 * the ticks inside the session and the observatory holds one reading a day;
 * drawing four numbers from a single quote and calling it OHLC would be an
 * invention dressed as a market chart.
 *
 * The wick is the published spread, so a day where the two sides diverged shows
 * a long wick — which is exactly when the parallel market is under strain.
 */
export function DayCandles({ data, unit }: { data: DayCandle[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) {
    return <div className="callout">Se necesitan al menos dos jornadas para comparar.</div>;
  }

  /*
   * A fixed drawing space, and a body that cannot become a slab.
   *
   * The box is stretched to whatever width the panel takes, so its own width
   * decides how much every horizontal length is magnified. Sizing it per candle
   * made that factor depend on how many there were: thirteen weekly candles
   * across a wide screen came out as hundred-pixel slabs wider than they were
   * tall, which is not a candle. A thousand units is close to the panel's real
   * width, so the stretch stays near 1:1, and the body is capped so a short
   * selection draws candles rather than blocks.
   */
  const width = 1000;
  const height = 260;
  const covered = `${data[0]?.date ?? ''} a ${data.at(-1)?.date ?? ''}`;
  const values = data.flatMap((point) => [point.high, point.low, point.open, point.close]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const pad = 14;
  const scale = (value: number): number =>
    height - pad - ((value - low) / span) * (height - pad * 2);

  const step = width / data.length;
  /** Square, like a real candle body: a rounded one is a pill at this size. */
  const body = step * 0.62;
  const shown = hover === null ? null : data[hover];
  const move = shown && shown.open !== 0 ? ((shown.close - shown.open) / shown.open) * 100 : null;

  return (
    <div className="candles">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Una vela por jornada, ${data.length} jornadas, de ${covered}, en ${unit}. El cuerpo va del punto medio de la jornada anterior al de esta; la mecha es la horquilla publicada.`}
        onMouseLeave={() => setHover(null)}
      >
        {data.map((point, index) => {
          const centre = step * (index + 0.5);
          const top = scale(Math.max(point.open, point.close));
          const bottom = scale(Math.min(point.open, point.close));
          const rising = point.close >= point.open;
          return (
            <g
              key={point.date}
              className={rising ? 'candle candle-up' : 'candle candle-down'}
              onMouseEnter={() => setHover(index)}
            >
              <rect
                x={centre - step / 2}
                y={0}
                width={step}
                height={height}
                className="candle-hit"
              />
              <line
                x1={centre}
                y1={scale(point.high)}
                x2={centre}
                y2={scale(point.low)}
                className="candle-wick"
              />
              <rect
                x={centre - body / 2}
                y={top}
                width={body}
                height={Math.max(bottom - top, 1.2)}
              />
              {hover === index ? (
                <rect
                  x={centre - step / 2}
                  y={0}
                  width={step}
                  height={height}
                  className="candle-lit"
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      {shown ? (
        <div className="candle-tip">
          <b>{shown.date}</b>
          <span className={move !== null && move >= 0 ? 'delta-up' : 'delta-down'}>
            {move === null
              ? '—'
              : `${move > 0 ? '+' : ''}${move.toLocaleString('es-BO', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} %`}
          </span>
          <span className="candle-tip-detail">
            apertura {number(shown.open, 4)} · cierre {number(shown.close, 4)} · rango{' '}
            {number(shown.low, 4)}/{number(shown.high, 4)} {unit}
          </span>
        </div>
      ) : (
        <div className="candle-foot">
          <span>{data[0]?.date}</span>
          <span className="candle-scale">
            {low.toLocaleString('es-BO', { maximumFractionDigits: 2 })} –{' '}
            {high.toLocaleString('es-BO', { maximumFractionDigits: 2 })} {unit}
          </span>
          <span>{data.at(-1)?.date}</span>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * The social register's charts.
 *
 * Everything above draws a series against time. These draw a breakdown at one
 * moment, because that is what a published reading is: a compiler's count of a
 * corpus in a month, never a value that moved. So there is no zoom, no drag and
 * no date axis - offering them would promise a history the source never had.
 *
 * They keep the axis, tooltip and draw animation of the charts above so the
 * section does not read as a different product.
 * ------------------------------------------------------------------------- */

export interface ShareSlice {
  name: string;
  value: number;
  /** Set where one slice is the finding rather than one of several. */
  emphasis?: boolean;
  /**
   * The numbers `value` was computed from, named, for the hover.
   *
   * A percentage on its own is a claim the reader has to take on faith: «56,7 %
   * de cobertura adversa» says nothing about whether it is 17 mentions out of
   * 30 or 4.036 out of 7.118, and those are not the same finding. Where a bar
   * is a division, its two sides travel with it and the tooltip spells the
   * division out.
   */
  parts?: ReadonlyArray<{ name: string; value: number; unit?: string }>;
  /** One line under the numbers saying what the bar means. */
  note?: string;
  /**
   * La categoría que esta barra representa, cuando se puede filtrar por ella.
   *
   * `name` es el rótulo —«Comercio exterior»— y un recuento indexado por un
   * texto de pantalla no se puede volver a convertir en un filtro. Esto es el
   * código crudo, y su ausencia es lo que distingue una barra que se toca de
   * una que sólo se lee: los tonos de un tema no son un recorte de nada.
   */
  pick?: string;
}

/**
 * A breakdown, ranked, as horizontal bars.
 *
 * Horizontal because the categories are Spanish phrases: a vertical axis would
 * either truncate them or turn them sideways. Ranked because the order is the
 * reading - nobody asks what share Instagram took without asking who took more.
 *
 * La cifra va en la punta de cada barra, y por eso el eje de valores ya no está
 * dibujado: un eje numérico existe para dar los valores que no se rotularon, y
 * aquí están todos rotulados. Dibujarlo además era pedirle al lector que
 * midiera contra una rejilla lo que ya tenía escrito al lado.
 *
 * Cuando una fila va marcada, el gráfico pasa a la forma de énfasis: la marcada
 * se queda con el color y TODAS las demás bajan al gris de contexto. Antes la
 * marcada se pintaba de rojo, que en este informe significa «adverso», así que
 * elegir una familia en el buscador la teñía de alarma sin que nadie lo hubiera
 * medido.
 */
export function ShareBars({
  data,
  tone = 'var(--official)',
  unit = '%',
  height = 220,
  onPick,
}: {
  data: ShareSlice[];
  tone?: string;
  unit?: string;
  height?: number;
  /**
   * Qué hacer cuando el lector toca una barra que lleva `pick`.
   *
   * El segundo argumento dice si el gesto traía Ctrl/⌘/Mayús, igual que en el
   * resto del informe: el gráfico no decide qué significa sumar, sólo reporta
   * cómo se tocó. Sin este prop las barras siguen siendo un dibujo.
   */
  onPick?: (value: string, additive: boolean) => void;
}) {
  const rows = [...data].sort((left, right) => right.value - left.value);
  const peak = rows.reduce((highest, row) => Math.max(highest, row.value), 0);
  const marked = rows.some((row) => row.emphasis);
  /*
   * El dibujo se toca sólo si hay adónde ir.
   *
   * Un puntero de mano sobre una barra que no hace nada es una promesa que el
   * gráfico no puede cumplir; y el teclado llega a estas mismas categorías por
   * la lista del carril, que es donde vive el camino accesible. Esto es un
   * atajo sobre el dibujo, nunca la única puerta.
   */
  const clickable = Boolean(onPick) && rows.some((row) => row.pick);
  /** Un decimal donde cambia algo, ninguno donde la cifra son miles. */
  const decimals = peak >= 100 ? 0 : 1;
  const say = (value: number): string =>
    unit === '%' ? `${number(value, decimals)} %` : number(value, decimals);

  const renderTooltip = ({ active, payload }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as ShareSlice | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={point.name}
        rows={[
          {
            name: 'Valor',
            value: `${number(point.value, 1)} ${unit}`,
            color: marked && !point.emphasis ? 'var(--series-rest)' : tone,
          },
          ...(point.parts ?? []).map((part) => ({
            name: part.name,
            value: `${number(part.value, 0)}${part.unit ? ` ${part.unit}` : ''}`,
          })),
        ]}
        {...(point.note ? { note: point.note } : {})}
      />
    );
  };

  return (
    <div className="chart-frame" style={{ height: framed(height) }}>
      <ResponsiveContainer width="100%" height="100%">
        {/* El margen derecho es el sitio donde vive la cifra de la barra más larga. */}
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 0, left: 4 }}>
          <XAxis type="number" domain={[0, peak > 0 ? peak : 1]} hide />
          {/*
           * `auto`, and not the 172 pixels this column used to be fixed at: a
           * fixed column is wrong in both directions at once. «Actividad
           * económica» left sixty pixels of padding the bars could have used,
           * and a longer name was wrapped onto two lines or cut. Recharts
           * measures the longest label it actually has to draw and gives the
           * rest of the width to the bars.
           */}
          <YAxis type="category" dataKey="name" width="auto" {...AXIS} />
          <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
          <Bar
            dataKey="value"
            maxBarSize={BAR_CAP}
            radius={[0, 4, 4, 0]}
            animationDuration={MOTION.duration}
            animationEasing={MOTION.easing}
            {...(clickable
              ? {
                  cursor: 'pointer',
                  onClick: (_entry: unknown, index: number, event: unknown) => {
                    const row = rows[index];
                    if (!row?.pick) return;
                    const gesture = (event ?? {}) as {
                      ctrlKey?: boolean;
                      metaKey?: boolean;
                      shiftKey?: boolean;
                    };
                    onPick?.(row.pick, additive(gesture));
                  },
                }
              : {})}
          >
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              fontSize={11}
              fill="var(--ink-soft)"
              formatter={(value: unknown) => (typeof value === 'number' ? say(value) : '')}
            />
            {rows.map((row) => (
              <Cell
                key={row.name}
                fill={marked ? (row.emphasis ? tone : 'var(--series-rest)') : tone}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface ReachBar {
  platform: string;
  value: number;
  exceeds: boolean;
}

/**
 * Declared platform reach against the number of people who are online at all.
 *
 * The reference line is the chart. Reading these bars without it invites the
 * ranking question - who is biggest - when the finding is that the tallest bar
 * claims more reachable adults than Bolivia has internet users, and so counts
 * accounts rather than people.
 */
export function ReachChart({
  data,
  ceiling,
  height = 260,
}: {
  data: ReachBar[];
  ceiling: number | null;
  height?: number;
}) {
  const millions = (value: number): string => `${number(value / 1_000_000, 1)} M`;
  const renderTooltip = ({ active, payload }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as ReachBar | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={point.platform}
        rows={[{ name: 'Alcance declarado', value: point.value.toLocaleString('es-BO') }]}
        {...(point.exceeds ? { note: 'Excede a los internautas del pais' } : {})}
      />
    );
  };

  return (
    <div className="chart-stack">
      <div className="chart-frame" style={{ height: framed(height) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 64, bottom: 0, left: 4 }}
          >
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="platform" width={96} {...AXIS} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
            {ceiling === null ? null : (
              <ReferenceLine
                x={ceiling}
                stroke="var(--ink)"
                /*
                 * Discontinua, y aquí sí: esta línea no es el eje, es un techo
                 * medido aparte contra el que se leen las barras. El trazo
                 * partido es exactamente lo que distingue un umbral de una
                 * regla del dibujo.
                 */
                strokeDasharray="4 3"
                /*
                 * Bottom, not top. The line falls where the tallest bar is, and
                 * a label there sat on a dark fill in pale ink. The short bars
                 * leave the foot of the plot empty on both sides of it.
                 */
                label={{
                  value: `${millions(ceiling)} internautas`,
                  position: 'insideBottomLeft',
                  fill: 'var(--ink-soft)',
                  fontSize: 11,
                  offset: 10,
                }}
              />
            )}
            <Bar
              dataKey="value"
              maxBarSize={BAR_CAP}
              radius={[0, 4, 4, 0]}
              animationDuration={MOTION.duration}
              animationEasing={MOTION.easing}
            >
              <LabelList
                dataKey="value"
                position="right"
                offset={8}
                fontSize={11}
                fill="var(--ink-soft)"
                formatter={(value: unknown) => (typeof value === 'number' ? millions(value) : '')}
              />
              {data.map((row) => (
                <Cell key={row.platform} fill={row.exceeds ? 'var(--up)' : 'var(--official)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={REACH_KEY} />
    </div>
  );
}

/**
 * Los dos colores del alcance, nombrados.
 *
 * El hallazgo del panel es cuáles barras pasan el techo, y eso se estaba
 * diciendo solo con el color: quien no distingue el rojo del azul —o quien
 * imprime la página— veía un ranking y no el hallazgo.
 */
const REACH_KEY: ReadonlyArray<LegendItem> = [
  { color: 'var(--up)', label: 'Declara más alcance que internautas hay en el país' },
  { color: 'var(--official)', label: 'Dentro de los internautas del país' },
];

export interface StackedRow {
  name: string;
  informal: number;
  mixto: number;
  formal: number;
  note?: string;
}

/**
 * A basket's channels, split by whether the trade is invoiced anywhere.
 *
 * Stacked and not a ring, and the difference is not decorative: these
 * penetrations are multi-response — the same household buys clothing in a fair
 * and in a mall — so the bar does not exhaust a whole and a ring would invent
 * the denominator. The axis is left free to pass 100 for exactly that reason,
 * and the caption under the chart states what the total means.
 */
export function StackedBars({ data, height = 200 }: { data: StackedRow[]; height?: number }) {
  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as StackedRow | undefined;
    if (!point) return null;
    const total = point.informal + point.mixto + point.formal;
    return (
      <TooltipShell
        label={String(label)}
        rows={[
          { name: 'Informal', value: `${number(point.informal, 0)} %`, color: 'var(--ord-1)' },
          { name: 'Mixto', value: `${number(point.mixto, 0)} %`, color: 'var(--ord-2)' },
          { name: 'Formal', value: `${number(point.formal, 0)} %`, color: 'var(--ord-3)' },
        ]}
        note={`Las penetraciones suman ${number(total, 0)} % porque un hogar compra en varios canales`}
      />
    );
  };

  return (
    <div className="chart-stack">
      <div className="chart-frame" style={{ height: framed(height) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 0, left: 4 }}
          >
            <CartesianGrid {...GRID} horizontal={false} vertical />
            <XAxis type="number" tickFormatter={(value: number) => number(value, 0)} {...AXIS} />
            <YAxis type="category" dataKey="name" width={128} {...AXIS} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
            {/*
             * Informal, mixto, formal es una escala CON orden: cambiar los tres
             * de sitio cambia lo que dice la barra. Por eso los tres tramos son
             * un solo tono en tres luminosidades y no tres colores distintos —el
             * orden se ve en el color—. Antes el tramo informal iba en el rojo
             * de «adverso», que convertía una descripción de canales de compra
             * en un juicio, y el mixto y el formal eran dos identidades sin
             * relación entre sí.
             */}
            <Bar
              dataKey="informal"
              stackId="mix"
              fill="var(--ord-1)"
              maxBarSize={BAR_CAP}
              {...STACK_GAP}
              animationDuration={MOTION.duration}
              animationEasing={MOTION.easing}
            />
            <Bar
              dataKey="mixto"
              stackId="mix"
              fill="var(--ord-2)"
              maxBarSize={BAR_CAP}
              {...STACK_GAP}
              animationDuration={0}
            />
            <Bar
              dataKey="formal"
              stackId="mix"
              fill="var(--ord-3)"
              maxBarSize={BAR_CAP}
              {...STACK_GAP}
              radius={[0, 4, 4, 0]}
              animationDuration={0}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={CHANNEL_KEY} />
    </div>
  );
}

/** Los tres tramos del apilado, en el orden en el que están apilados. */
const CHANNEL_KEY: ReadonlyArray<LegendItem> = [
  { color: 'var(--ord-1)', label: 'Informal' },
  { color: 'var(--ord-2)', label: 'Mixto' },
  { color: 'var(--ord-3)', label: 'Formal' },
];

export interface DivergingRow {
  name: string;
  value: number;
  meta?: string;
}

/**
 * Distances from a reference, drawn on both sides of zero.
 *
 * Bars and a zero line rather than two series side by side: the quantity here
 * is the difference itself, and drawing the two levels would invite the reader
 * to compare heights and miss it. Por encima de la referencia es el color
 * cálido y por debajo el frío: es la convención del propio informe, no un
 * semáforo —la misma del tipo de cambio, donde una cifra por encima de la serie
 * medida es la que obliga a frenar—.
 *
 * El polo frío era verde. Rojo contra verde es el único par que un lector
 * daltónico no puede separar, y aquí el color es la mitad de la lectura, así
 * que el frío pasó a verde azulado: misma lectura, y los dos polos se
 * distinguen bajo protanopía y deuteranopía.
 */
export function DivergingBars({
  data,
  unit = 'puntos',
  height = 260,
}: {
  data: DivergingRow[];
  unit?: string;
  height?: number;
}) {
  const rows = [...data]
    .sort((left, right) => right.value - left.value)
    .map((row) => ({
      ...row,
      above: row.value >= 0 ? row.value : null,
      below: row.value < 0 ? row.value : null,
    }));
  const renderTooltip = ({ active, payload }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as DivergingRow | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={point.name}
        rows={[
          {
            name: point.value >= 0 ? 'Por encima' : 'Por debajo',
            value: `${point.value > 0 ? '+' : ''}${number(point.value, 1)} ${unit}`,
            color: point.value >= 0 ? 'var(--up)' : 'var(--down)',
          },
        ]}
        {...(point.meta ? { note: point.meta } : {})}
      />
    );
  };

  return (
    <div className="chart-stack">
      <div className="chart-frame" style={{ height: framed(height) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 0, left: 4 }}
          >
            <CartesianGrid {...GRID} horizontal={false} vertical />
            <XAxis
              type="number"
              tickFormatter={(value: number) => `${value > 0 ? '+' : ''}${number(value, 0)}`}
              {...AXIS}
            />
            <YAxis type="category" dataKey="name" width={210} {...AXIS} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
            {/* El cero es la referencia del gráfico: una regla del eje, sólida. */}
            <ReferenceLine x={0} stroke="var(--axis-rule)" strokeWidth={1} />
            {/*
             * Dos barras sobre una sola pila, una por lado del cero: la punta
             * redondeada tiene que estar del lado hacia el que crece la barra,
             * y el radio se declara por serie. Cada fila trae su valor en una
             * sola de las dos claves, así que no se dibuja nada dos veces.
             */}
            <Bar
              dataKey="above"
              stackId="cero"
              fill="var(--up)"
              maxBarSize={BAR_CAP}
              radius={[0, 4, 4, 0]}
              animationDuration={MOTION.duration}
              animationEasing={MOTION.easing}
            />
            <Bar
              dataKey="below"
              stackId="cero"
              fill="var(--down)"
              maxBarSize={BAR_CAP}
              radius={[4, 0, 0, 4]}
              animationDuration={MOTION.duration}
              animationEasing={MOTION.easing}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={DISTANCE_KEY(unit)} />
    </div>
  );
}

/**
 * Los dos lados del cero, dichos con palabras.
 *
 * El signo está en el eje, pero el eje no dice qué significa estar de un lado o
 * del otro, y ese era justo el sentido que el gráfico daba por supuesto.
 */
const DISTANCE_KEY = (unit: string): ReadonlyArray<LegendItem> => [
  { color: 'var(--up)', label: `Por encima de la referencia, en ${unit}` },
  { color: 'var(--down)', label: `Por debajo de la referencia, en ${unit}` },
];

export interface HeatCell {
  row: string;
  column: string;
  value: number;
  hint?: string;
}

/**
 * A matrix where the ink is the count.
 *
 * Used where the question is coverage rather than magnitude: which forms of
 * trade somebody measured, in which place, and where nobody measured anything.
 * An empty cell is drawn empty on purpose — a zero would read as a measurement
 * that came out zero, and the whole point of this grid is to show the holes.
 *
 * Not a chart library: a grid of cells reads at a glance, prints, and survives
 * a screenshot, which a canvas heatmap with a hover-only legend does not.
 */
export function HeatGrid({
  rows,
  columns,
  cells,
  unit = 'lecturas',
}: {
  rows: readonly string[];
  columns: readonly string[];
  cells: readonly HeatCell[];
  unit?: string;
}) {
  const index = new Map(cells.map((cell) => [`${cell.row}|${cell.column}`, cell]));
  const peak = cells.reduce((highest, cell) => Math.max(highest, cell.value), 0);
  /*
   * Cinco pasos de un solo tono, y no una opacidad continua.
   *
   * El relleno era `color-mix(… , transparent)`: un azul translúcido que deja
   * pasar lo que tenga debajo, así que la misma cuenta se veía de un color en
   * una fila pinchada y de otro sobre el panel, y el número escrito encima
   * perdía contraste sin avisar. Cinco pasos opacos de la rampa de magnitud
   * dan la misma lectura —más oscuro es más— con un color que es el que es, y
   * permiten elegir la tinta del número por lo oscuro que sea el paso.
   */
  const step = (value: number): number =>
    peak > 0 ? Math.min(SEQ_STEPS.length - 1, Math.floor((value / peak) * SEQ_STEPS.length)) : 0;

  return (
    <div className="heat-scroll">
      <div
        className="heat-grid"
        /*
         * A floor under the data columns, because the same grid now holds seven
         * years or eighty-one months: with a bare `1fr` the months squeezed
         * themselves into slivers too narrow for their own numbers instead of
         * letting the box scroll, which is what the box is for.
         */
        style={{
          gridTemplateColumns: `minmax(9rem, 1.4fr) repeat(${columns.length}, minmax(2.9rem, 1fr))`,
        }}
      >
        <span className="heat-corner" />
        {columns.map((column) => (
          <span className="heat-head" key={column}>
            {column}
          </span>
        ))}
        {rows.map((row) => (
          <Fragment key={row}>
            <span className="heat-row">{row}</span>
            {columns.map((column) => {
              const cell = index.get(`${row}|${column}`);
              const at = cell ? step(cell.value) : -1;
              return (
                <span
                  className={cell ? 'heat-cell heat-cell-filled' : 'heat-cell'}
                  key={`${row}|${column}`}
                  style={
                    cell
                      ? {
                          background: SEQ_STEPS[at]?.fill,
                          color: SEQ_STEPS[at]?.ink,
                        }
                      : undefined
                  }
                  title={
                    cell
                      ? `${row} · ${column}: ${number(cell.value, 0)} ${cell.hint ?? unit}`
                      : `${row} · ${column}: sin lectura`
                  }
                >
                  {cell ? number(cell.value, 0) : ''}
                </span>
              );
            })}
          </Fragment>
        ))}
      </div>
      <HeatScale unit={unit} peak={peak} />
    </div>
  );
}

/**
 * Los cinco pasos de la rampa de magnitud, de poco a mucho, con la tinta que le
 * toca a cada uno.
 *
 * La tinta viaja con el paso y no se deduce de su número. Es la única excepción
 * a «el texto nunca lleva el color del dato» —un rótulo escrito DENTRO de un
 * relleno tiene que elegir blanco o tinta según lo oscuro que sea el relleno—,
 * y deducirla del índice falla en cuanto la rampa se ancla al revés, que es
 * exactamente lo que pasa en modo oscuro.
 */
const SEQ_STEPS = [
  { fill: 'var(--seq-200)', ink: 'var(--seq-ink-1)' },
  { fill: 'var(--seq-300)', ink: 'var(--seq-ink-2)' },
  { fill: 'var(--seq-400)', ink: 'var(--seq-ink-3)' },
  { fill: 'var(--seq-500)', ink: 'var(--seq-ink-4)' },
  { fill: 'var(--seq-600)', ink: 'var(--seq-ink-5)' },
] as const;

/** La clave de la retícula: qué vale un paso, y que el hueco es un hueco. */
function HeatScale({ unit, peak }: { unit: string; peak: number }) {
  return (
    <div className="heat-scale">
      <span>0</span>
      <span className="heat-scale-steps">
        {SEQ_STEPS.map((step) => (
          <span key={step.fill} style={{ background: step.fill }} />
        ))}
      </span>
      <span>
        {number(peak, 0)} {unit}
      </span>
      <span className="heat-scale-steps" style={{ marginLeft: '0.6rem' }}>
        <span style={{ background: 'var(--rule-soft)' }} />
      </span>
      <span>sin lectura</span>
    </div>
  );
}

export interface MonthBar {
  month: string;
  mentions: number;
  adverse: number;
}

/**
 * What the two colours of a stacked month or year mean.
 *
 * Both charts stack the same division and neither said so: a reader met a red
 * block and a blue one and had to guess which was which, or hover every bar to
 * find out. The key is drawn under the chart, in the colours themselves.
 */
const TONE_KEY = [
  { color: 'var(--up)', label: 'Tono adverso (alarma, deterioro, conflicto, incertidumbre)' },
  { color: 'var(--official)', label: 'Resto de las menciones' },
] as const;

/**
 * A subject's coverage month by month, with the share that read badly inside
 * each bar.
 *
 * Bars and not a line, because the quantity is a count of notes in a month and
 * a line between two months asserts values in between that nobody published.
 * Stacked in two parts rather than coloured by a dominant tone: a month covered
 * with equal alarm and improvement is a real month, and naming one winner would
 * erase it.
 *
 * The axis labels a month only when the year turns, which keeps eighty months
 * legible without rotating anything.
 */
export function MonthlyBars({ data, height = 220 }: { data: MonthBar[]; height?: number }) {
  const rows = data.map((row) => ({
    ...row,
    calm: Math.max(0, row.mentions - row.adverse),
  }));
  let lastYear = '';
  const renderTooltip = ({ active, payload }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as (MonthBar & { calm: number }) | undefined;
    if (!point) return null;
    const [year = '', month = ''] = point.month.split('-');
    return (
      <TooltipShell
        label={`${MONTH_NAME[Number(month) - 1] ?? month} de ${year}`}
        rows={[
          { name: 'Notas', value: number(point.mentions, 0) },
          { name: 'Tono adverso', value: number(point.adverse, 0), color: 'var(--up)' },
          { name: 'Resto', value: number(point.calm, 0), color: 'var(--official)' },
        ]}
      />
    );
  };

  return (
    <div className="chart-stack">
      <div className="chart-frame" style={{ height: framed(height) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis
              dataKey="month"
              interval={0}
              tickFormatter={(value: string) => {
                const year = value.slice(0, 4);
                if (year === lastYear) return '';
                lastYear = year;
                return year;
              }}
              {...AXIS}
            />
            <YAxis tickFormatter={(value: number) => number(value, 0)} width={38} {...AXIS} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
            <Bar
              dataKey="adverse"
              stackId="mes"
              fill="var(--up)"
              animationDuration={MOTION.duration}
              animationEasing={MOTION.easing}
            />
            {/*
             * Sin rendija entre los dos tramos, y a propósito: con ochenta
             * meses en el cuadro la barra mide tres píxeles, y dos de borde
             * del color del panel no la separarían, la borrarían. Aquí lo que
             * separa los tramos es el contraste de los dos colores, que está
             * medido y sobra. La rendija vuelve en el gráfico por años, donde
             * las barras son anchas.
             */}
            <Bar
              dataKey="calm"
              stackId="mes"
              fill="var(--official)"
              radius={[3, 3, 0, 0]}
              animationDuration={0}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={TONE_KEY} />
    </div>
  );
}

export interface YearSeriesPoint {
  year: string;
  [country: string]: string | number;
}

/**
 * One indicator across years, with a bar per country.
 *
 * Bars and not lines, and the reason is what the panel holds: an annual figure
 * for a country is a value the publisher states for that year, not a point on a
 * continuous path. A line between 1994 and 1996 draws a 1995 that may simply
 * not exist — the panel is full of series that skip years — where a missing bar
 * says so.
 *
 * The axis labels every fifth year. Sixty-six labels do not fit and rotating
 * them makes a chart nobody reads sideways.
 */
export function YearSeriesBars({
  data,
  countries,
  height = 260,
}: {
  data: YearSeriesPoint[];
  countries: readonly string[];
  height?: number;
}) {
  /*
   * El color sale de la casilla que le toca al país, y de ninguna otra parte.
   *
   * Esta lista se recorría con un módulo: el quinto país recibía otra vez el
   * color del primero, así que dos barras de la misma altura y del mismo color
   * eran dos países distintos y el lector no tenía cómo saberlo. Con seis
   * casillas y ningún ciclo, un séptimo país cae en el gris de «Otros» —que es
   * una respuesta honesta— en vez de en un color prestado.
   */
  const toneOf = (index: number): string => seriesTone(index);
  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    return (
      <TooltipShell
        label={String(label)}
        rows={payload.map((entry) => ({
          name: String(entry.name ?? ''),
          value: number(Number(entry.value), 2),
          color: toneOf(countries.indexOf(String(entry.name ?? ''))),
        }))}
      />
    );
  };

  return (
    <div className="chart-stack">
      <div className="chart-frame" style={{ height: framed(height) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis
              dataKey="year"
              interval={0}
              tickFormatter={(value: string) => (Number(value) % 5 === 0 ? value : '')}
              {...AXIS}
            />
            <YAxis
              tickFormatter={(value: number) => number(value, Math.abs(value) < 10 ? 1 : 0)}
              width={54}
              {...AXIS}
            />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
            {countries.map((country, index) => (
              <Bar
                key={country}
                dataKey={country}
                name={country}
                fill={toneOf(index)}
                maxBarSize={BAR_CAP}
                radius={[2, 2, 0, 0]}
                animationDuration={index === 0 ? MOTION.duration : 0}
                animationEasing={MOTION.easing}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={countries.map((country, index) => ({ color: toneOf(index), label: country }))}
      />
    </div>
  );
}

export interface CloudWord {
  term: string;
  label: string;
  value: number;
  /** Share of the subject's mentions the press covered adversely, 0–100. */
  adverse: number | null;
}

/**
 * The whole watchlist at once, every subject at the size of its coverage.
 *
 * Two hundred subjects ranked down a bar chart is a chart nobody reads to the
 * bottom: the reader learns the first eight and stops. A cloud states the same
 * two hundred in one glance and answers the question this section opens with —
 * what does the country talk about — before any subject has been chosen.
 *
 * Three rules keep it a measurement rather than a decoration. Size is the
 * square root of the count, not the count, because area is what the eye reads
 * and a linear scale makes the leader forty times a word it is only six times.
 * Colour is the adverse share of that subject's own coverage, so the cloud
 * shows what is talked about and how at the same time. And the order is
 * alphabetical rather than scattered: a random layout looks more like a cloud
 * and makes a named subject impossible to find, which is the one thing a reader
 * standing in front of two hundred words actually needs to do.
 *
 * Every word is a button. The cloud is the section's coarse filter, so what it
 * shows can be opened without going back to the rail to find it.
 */
export function TermCloud({
  data,
  selected = '',
  onPick,
  limit = 120,
}: {
  data: readonly CloudWord[];
  selected?: string;
  onPick?: (term: string) => void;
  limit?: number;
}) {
  const strongest = [...data]
    .filter((word) => word.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, limit);
  const peak = strongest.reduce((highest, word) => Math.max(highest, word.value), 0);
  const floor = strongest.reduce((lowest, word) => Math.min(lowest, word.value), peak);
  const words = [...strongest].sort((left, right) => left.label.localeCompare(right.label, 'es'));

  if (!words.length) {
    return <p className="panel-sub">Ningún tema quedó dentro de esta selección.</p>;
  }

  /** Area, not height, carries the count — so the scale is the square root. */
  const sizeOf = (value: number): string => {
    const span = peak - floor;
    const share = span > 0 ? Math.sqrt((value - floor) / span) : 1;
    return `${(0.76 + share * 1.5).toFixed(3)}rem`;
  };

  return (
    <>
      <div className="cloud">
        {words.map((word) => {
          const heat = word.adverse === null ? null : Math.max(0, Math.min(100, word.adverse));
          return (
            <button
              key={word.term}
              type="button"
              className={word.term === selected ? 'cloud-word cloud-word-on' : 'cloud-word'}
              style={{
                fontSize: sizeOf(word.value),
                color: adverseTone(heat),
                fontWeight: word.value >= floor + (peak - floor) * 0.55 ? 600 : 500,
              }}
              title={`${word.label}: ${number(word.value, 0)} menciones${
                heat === null ? '' : ` · ${number(heat, 1)} % de cobertura adversa`
              }`}
              onClick={() => onPick?.(word.term)}
              aria-pressed={word.term === selected}
            >
              {word.label}
            </button>
          );
        })}
      </div>
      <CloudScale />
    </>
  );
}

/**
 * El color de una palabra de la nube: cuánta de su cobertura fue adversa.
 *
 * Era una mezcla continua entre el azul de «oficial» y el rojo de «adverso»,
 * y eso es un arcoíris para decir una magnitud: la mitad de la escala caía en
 * un violeta sucio que no es ninguno de los dos extremos, y los pasos claros
 * quedaban ilegibles —porque aquí el color no pinta una marca, pinta la propia
 * palabra—. Ahora son tres pasos de un solo tono, elegidos para pasar 4,5:1
 * contra el papel, más un gris para «no se midió», que es un estado y no un
 * cero.
 */
const adverseTone = (share: number | null): string => {
  if (share === null) return 'var(--adv-0)';
  if (share < 25) return 'var(--adv-1)';
  if (share < 50) return 'var(--adv-2)';
  return 'var(--adv-3)';
};

/** Qué vale cada tono de la nube. Sin esto el color es decoración. */
function CloudScale() {
  return (
    <div className="heat-scale">
      <span>Cobertura adversa</span>
      <span className="heat-scale-steps">
        <span style={{ background: 'var(--adv-1)' }} />
        <span style={{ background: 'var(--adv-2)' }} />
        <span style={{ background: 'var(--adv-3)' }} />
      </span>
      <span>0 → 100 %</span>
      <span className="heat-scale-steps" style={{ marginLeft: '0.6rem' }}>
        <span style={{ background: 'var(--adv-0)' }} />
      </span>
      <span>sin medir</span>
    </div>
  );
}

export interface YearBar {
  year: string;
  mentions: number;
  adverse: number;
}

/**
 * The same stacked reading as the monthly bars, one bar per year.
 *
 * Eighty months of a single subject is a shape; seven years of it is a
 * comparison, and the two answer different questions. Kept chronological rather
 * than ranked, because a year out of order stops being a year.
 */
export function YearlyBars({ data, height = 200 }: { data: YearBar[]; height?: number }) {
  const rows = [...data]
    .sort((left, right) => left.year.localeCompare(right.year))
    .map((row) => ({ ...row, calm: Math.max(0, row.mentions - row.adverse) }));
  const renderTooltip = ({ active, payload }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as (YearBar & { calm: number }) | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={point.year}
        rows={[
          { name: 'Menciones', value: number(point.mentions, 0) },
          { name: 'Tono adverso', value: number(point.adverse, 0), color: 'var(--up)' },
          { name: 'Resto', value: number(point.calm, 0), color: 'var(--official)' },
        ]}
      />
    );
  };

  return (
    <div className="chart-stack">
      <div className="chart-frame" style={{ height: framed(height) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="year" interval={0} {...AXIS} />
            <YAxis tickFormatter={(value: number) => number(value, 0)} width={40} {...AXIS} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
            <Bar
              dataKey="adverse"
              stackId="anio"
              fill="var(--up)"
              maxBarSize={BAR_CAP * 2}
              {...STACK_GAP}
              animationDuration={MOTION.duration}
              animationEasing={MOTION.easing}
            />
            {/*
             * El mismo tope que el tramo de abajo, y no es decorativo: sin él
             * Recharts le da a este tramo la banda entera mientras el adverso
             * se queda en 48 px, así que el apilado sale con el zócalo rojo
             * estrecho y el bloque azul volado por encima —dos anchos, que se
             * leen como dos gráficos mal pegados en vez de como una barra.
             */}
            <Bar
              dataKey="calm"
              stackId="anio"
              fill="var(--official)"
              radius={[4, 4, 0, 0]}
              maxBarSize={BAR_CAP * 2}
              {...STACK_GAP}
              animationDuration={0}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={TONE_KEY} />
    </div>
  );
}

export interface WorldLinePoint {
  year: string;
  [place: string]: string | number | null;
}

export interface WorldLineSeries {
  /** The key each point carries this series' value under. */
  key: string;
  label: string;
  tone: string;
  /** Drawn heavier: the figure the card is about. */
  emphasis?: boolean;
  /** Drawn dashed: the reference the others are read against. */
  dashed?: boolean;
}

/**
 * The world, a region and Bolivia on one axis of years.
 *
 * Lines, where the report's other annual panels draw bars, and the reason is
 * how many series share the frame: three sets of bars across sixty years is a
 * comb nobody reads. The objection to lines still holds — a line between two
 * published years asserts the year between them — so a missing year is a break
 * in the line and never a join. `connectNulls` is off on purpose.
 */
export function WorldLines({
  data,
  series,
  format,
  tick,
}: {
  data: WorldLinePoint[];
  series: WorldLineSeries[];
  format: (value: number) => string;
  tick: (value: number) => string;
}) {
  const values = data.flatMap((row) =>
    series.map((one) => row[one.key]).filter((value): value is number => typeof value === 'number'),
  );
  const domain = values.length ? fittedDomain(values) : undefined;

  /**
   * Wide enough for the longest label the axis will print. A fixed width fit the
   * rates and cut «72 mM» in two on an axis of dollars.
   */
  const axisWidth = domain
    ? Math.min(72, Math.max(34, Math.max(tick(domain[0]).length, tick(domain[1]).length) * 7 + 10))
    : 40;

  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as WorldLinePoint | undefined;
    if (!point) return null;
    const rows = series
      .map((one) => ({ name: one.label, value: point[one.key] }))
      .filter((row): row is { name: string; value: number } => typeof row.value === 'number')
      .map((row) => ({ name: row.name, value: format(row.value) }));
    return rows.length ? <TooltipShell label={String(label)} rows={rows} /> : null;
  };

  return (
    <div className="chart-stack">
      <div className="chart-frame" style={{ height: framed(190) }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="year" minTickGap={26} {...AXIS} />
            <YAxis
              {...(domain ? { domain } : {})}
              width={axisWidth}
              tickFormatter={(value: number) => tick(value)}
              {...AXIS}
            />
            <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--rule)', strokeWidth: 1 }} />
            {series.map((one, index) => (
              <Line
                key={one.key}
                type="monotone"
                dataKey={one.key}
                name={one.label}
                stroke={one.tone}
                strokeWidth={one.emphasis ? 2.4 : 1.6}
                {...(one.dashed ? { strokeDasharray: '4 3' } : {})}
                dot={false}
                connectNulls={false}
                animationDuration={index === 0 ? MOTION.duration : 0}
                animationEasing={MOTION.easing}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/*
       * La clave, que este gráfico no tenía.
       *
       * Es el que dibuja siete líneas de colores en Energía, cinco países en
       * Consumo y las seis áreas del índice de Fraser, y hasta ahora el único
       * sitio donde estaba escrito cuál era cuál era el emergente del ratón:
       * no existe al imprimir, no existe en una captura y no existe para quien
       * no distingue el naranja del verde.
       */}
      {series.length ? <ChartLegend items={lineLegend(series)} /> : null}
    </div>
  );
}

export interface DatedLinePoint {
  date: string;
  [key: string]: string | number | null;
}

export interface DatedLineSeries {
  /** The key each point carries this series' value under. */
  key: string;
  label: string;
  tone: string;
  /** Drawn heavier: the figure the panel is about. */
  emphasis?: boolean;
  /** Drawn dashed: a reference the others are read against. */
  dashed?: boolean;
}

/** A stretch of the axis worth naming, shaded behind the lines. */
export interface DatedBand {
  from: string;
  to: string;
  label: string;
  /**
   * Which edge of the band the label hangs from. Left by default.
   *
   * A label anchored to the left edge of a band that is a sliver at the end of
   * the axis runs off the plot and arrives cut mid-word. A band that ends where
   * the series ends says `right` and the text grows inwards instead.
   */
  align?: 'left' | 'right';
}

/**
 * Several series against a calendar axis, with the regime shaded behind them.
 *
 * The report already had a line chart per shape of question and none of them fit
 * this one. `RateChart` knows about two named rates and their sides; `SeriesChart`
 * draws exactly one series; `WorldLines` is keyed on the year. What the
 * exchange-rate analysis needs is arbitrary series over days, a reference line
 * that means something when crossed, and the ability to say *which regime* a
 * stretch belongs to — because a real index read across a change of regime is
 * two different measurements sharing a line.
 *
 * The bands are drawn rather than described because the alternative is a caption
 * asking the reader to hold a date in their head while looking at a curve. They
 * sit behind the grid at low opacity and are mixed with the panel colour rather
 * than with `transparent`: a translucent fill over an unknown backdrop changes
 * shade with whatever is beneath it, which in dark mode turns a neutral wash
 * into a tint.
 *
 * A missing day breaks the line instead of joining across it, for the reason the
 * annual panels do the same: a segment drawn between two readings asserts the
 * days in between.
 */
/**
 * ¿Tiene esta serie alguna lectura sin vecina a ningún lado?
 *
 * Una línea necesita dos puntos contiguos para existir. Una serie que acaba de
 * empezar —o que tiene un hueco de un día en medio— aporta valores que no
 * forman ningún segmento, y sin marcador quedan invisibles. Se comprueba sobre
 * las filas visibles, no sobre la serie entera: al acercar el zoom un tramo
 * puede quedar reducido a un punto, y ahí también hay que verlo.
 */
function isolatedPoints(rows: readonly DatedLinePoint[], key: string): boolean {
  return rows.some((row, index) => {
    if (typeof row[key] !== 'number') return false;
    const before = rows[index - 1]?.[key];
    const after = rows[index + 1]?.[key];
    return typeof before !== 'number' && typeof after !== 'number';
  });
}

export function DatedLines({
  data,
  series,
  unit,
  decimals = 1,
  referenceLine,
  referenceLabel,
  bands,
  height,
}: {
  data: DatedLinePoint[];
  series: readonly DatedLineSeries[];
  unit: string;
  decimals?: number;
  /** Level where crossing carries meaning — 100 on an index, 0 on a change. */
  referenceLine?: number;
  referenceLabel?: string;
  bands?: readonly DatedBand[];
  height?: 'small' | 'normal' | 'tall';
}) {
  const zoom = useRangeZoom(data.map((point) => point.date));
  const shown = zoom.visible(data);
  const values = shown.flatMap((row) =>
    series.map((one) => row[one.key]).filter((value): value is number => typeof value === 'number'),
  );
  const domain = values.length
    ? fittedDomain(referenceLine === undefined ? values : [...values, referenceLine])
    : undefined;

  const renderTooltip = ({ active, payload, label }: TooltipRender) => {
    if (!active || !payload?.length || typeof label !== 'string') return null;
    const point = payload[0]?.payload as DatedLinePoint | undefined;
    if (!point) return null;
    const rows = series
      .map((one) => ({ name: one.label, value: point[one.key] }))
      .filter((row): row is { name: string; value: number } => typeof row.value === 'number')
      .map((row) => ({ name: row.name, value: `${number(row.value, decimals)} ${unit}` }));
    return rows.length ? <TooltipShell label={longDate.format(asDate(label))} rows={rows} /> : null;
  };

  const frameClass =
    height === 'tall'
      ? 'chart-frame chart-frame-tall'
      : height === 'small'
        ? 'chart-frame chart-frame-small'
        : 'chart-frame';

  return (
    <div className="chart-stack">
      <ZoomExit zoom={zoom} format={(label) => longDate.format(asDate(label))} />
      <div className={frameClass} onContextMenu={(event) => event.preventDefault()}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={shown}
            margin={{ top: 10, right: 14, bottom: 4, left: 4 }}
            onMouseDown={(event) => zoom.begin(event?.activeLabel)}
            onMouseMove={(event) => zoom.drag(event?.activeLabel)}
            onMouseUp={zoom.finish}
            onMouseLeave={zoom.finish}
          >
            <CartesianGrid {...GRID} />
            <XAxis dataKey="date" tickFormatter={shortLabel} minTickGap={52} {...AXIS} />
            <YAxis
              {...(domain ? { domain } : {})}
              width={54}
              tickFormatter={(value: number) => number(value, decimals === 0 ? 0 : 1)}
              {...AXIS}
            />
            <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--rule)', strokeWidth: 1 }} />
            {(bands ?? []).map((band) => (
              <ReferenceArea
                key={`${band.from}-${band.to}`}
                x1={band.from}
                x2={band.to}
                fill="color-mix(in srgb, var(--axis-ink) 8%, var(--panel))"
                fillOpacity={1}
                label={{
                  value: band.label,
                  position: band.align === 'right' ? 'insideTopRight' : 'insideTopLeft',
                  fontSize: 10,
                  fill: 'var(--axis-ink)',
                }}
              />
            ))}
            {referenceLine === undefined ? null : (
              <ReferenceLine
                y={referenceLine}
                stroke="var(--axis-rule)"
                strokeWidth={1}
                {...(referenceLabel
                  ? {
                      label: {
                        value: referenceLabel,
                        position: 'insideBottomRight',
                        fontSize: 10,
                        fill: 'var(--axis-ink)',
                      },
                    }
                  : {})}
              />
            )}
            {series.map((one, index) => (
              <Line
                key={one.key}
                type="monotone"
                dataKey={one.key}
                name={one.label}
                stroke={one.tone}
                strokeWidth={one.emphasis ? 2.4 : 1.6}
                {...(one.dashed ? { strokeDasharray: '4 3' } : {})}
                /*
                 * Un punto sin vecinos se dibuja; el resto, no.
                 *
                 * `connectNulls` está apagado a propósito, así que un tramo de
                 * una sola lectura no tiene segmento que trazar y con
                 * `dot={false}` no se pinta nada en absoluto: la serie aparece
                 * en la leyenda y no en el gráfico, que es peor que no estar,
                 * porque parece un fallo. Pasó con la primera jornada de una
                 * ficha estable recién incorporada. El punto solo aparece donde
                 * hace falta —una lectura aislada—, no en toda la serie, que
                 * volvería ilegibles las ochocientas jornadas de al lado.
                 */
                dot={
                  isolatedPoints(shown, one.key)
                    ? // El relleno va explícito: por defecto el marcador es
                      // blanco con el borde del color de la serie, y sin borde
                      // —que es lo que hace falta aquí— queda un disco blanco
                      // invisible sobre el panel claro.
                      { r: 2.8, strokeWidth: 0, fill: one.tone }
                    : false
                }
                connectNulls={false}
                animationDuration={index === 0 ? MOTION.duration : 0}
                animationEasing={MOTION.easing}
              />
            ))}
            <ZoomBand zoom={zoom} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/*
       * La clave va también con una sola serie. El panel del dólar real dibuja
       * una línea y su título dice de qué trata el panel, no qué es la línea ni
       * en qué unidad está; la leyenda lo dice, y es el mismo renglón que
       * llevan los gráficos de al lado.
       */}
      {series.length ? <ChartLegend items={lineLegend(series)} /> : null}
    </div>
  );
}

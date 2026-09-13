'use client';

import { Fragment } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { DensityPoint, Fit, HistoBin, LagPoint, MacroStats } from '@/lib/macro-stats';

/**
 * Las cuatro lecturas de una distribucion anual.
 *
 * La tabla de macroeconomia resume cada serie en una fila de estadisticos, y un
 * estadistico solo se puede leer mal: dos series con la misma media y la misma
 * desviacion pueden ser una campana y dos jorobas. Estas vistas existen para
 * que el numero de la tabla se pueda comprobar de un vistazo —donde esta la
 * masa, cuan larga es la cola, que años se salen y cuanto arrastra la serie su
 * propio pasado— y son las mismas que se llevan al PDF.
 *
 * Comparten el lenguaje grafico del resto del tablero: los mismos ejes sin
 * linea, la misma rejilla horizontal, el mismo tooltip y las mismas variables
 * de color, para que moverse entre secciones no parezca cambiar de producto.
 */

type TooltipRender = TooltipContentProps<ValueType, NameType>;

const MOTION = { duration: 700, easing: 'ease-out' } as const;
const AXIS = {
  stroke: 'var(--ink-faint)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;
const GRID = { stroke: 'var(--rule-soft)', vertical: false } as const;

const number = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** Un valor con los decimales que su magnitud justifica. */
export const compactNumber = (value: number): string => {
  const magnitude = Math.abs(value);
  if (magnitude >= 1e9) return `${number(value / 1e9, 2)} MM`;
  if (magnitude >= 1e6) return `${number(value / 1e6, 2)} M`;
  if (magnitude >= 1000) return number(value, 0);
  if (magnitude >= 10) return number(value, 1);
  return number(value, 2);
};

function TooltipShell({
  label,
  rows,
  note,
}: {
  label: string;
  rows: Array<{ name: string; value: string }>;
  note?: string;
}) {
  return (
    <div className="tooltip">
      <div className="t-date">{label}</div>
      {rows.map((row) => (
        <div className="t-row" key={row.name}>
          <span>{row.name}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
      {note ? <div className="t-note">{note}</div> : null}
    </div>
  );
}

/* Densidad e histograma -------------------------------------------------- */

/**
 * Donde se acumulan los valores de la serie, contados y suavizados a la vez.
 *
 * Las barras cuentan años por intervalo y la curva es la densidad por nucleo
 * gaussiano reescalada a esa misma cuenta, asi que las dos se leen contra el
 * mismo eje y la comparacion es directa. Van juntas porque cada una corrige a
 * la otra: el histograma depende de donde cayeron los cortes —dos modas pegadas
 * se funden en una barra— y la densidad depende del ancho de banda, que puede
 * inventar una joroba donde hay tres observaciones sueltas. Cuando las dos
 * dicen lo mismo, la forma es real.
 *
 * Las lineas verticales son la media y la mediana. Verlas separadas es la
 * manera mas rapida de entender el signo de la asimetria que la tabla reporta.
 */
export function DensityHistogram({
  bins,
  curve,
  stats,
  unit,
}: {
  bins: HistoBin[];
  curve: DensityPoint[];
  stats: MacroStats;
  unit: string;
}) {
  if (bins.length < 2) {
    return <p className="analysis-empty">Faltan observaciones para estimar una distribución.</p>;
  }

  const width = (bins[0]?.to ?? 0) - (bins[0]?.from ?? 0);
  /**
   * La densidad evaluada en el centro de cada intervalo y llevada a años.
   *
   * Una densidad integra uno y un histograma suma n, asi que dibujadas contra
   * el mismo eje la curva seria una linea pegada al cero. Multiplicar por n y
   * por el ancho del intervalo es el cambio de unidad que las vuelve
   * comparables, y evita el segundo eje —un eje derecho rotulado «densidad» no
   * le dice nada a nadie que no venga a buscarlo.
   */
  const scale = stats.n * width;
  const data = bins.map((bin) => {
    let nearest = curve[0];
    for (const point of curve) {
      if (Math.abs(point.x - bin.centre) < Math.abs((nearest?.x ?? Infinity) - bin.centre)) {
        nearest = point;
      }
    }
    return {
      ...bin,
      curve: nearest ? nearest.density * scale : 0,
      /** Un intervalo por fuera de los bigotes se pinta como cola. */
      tail: bin.centre < stats.lowFence || bin.centre > stats.highFence,
    };
  });

  // Dónde caen la media y la mediana sobre un eje que es de categorías: el
  // intervalo que las contiene. Cuando caen en el mismo, solo se rotula la
  // media —dos etiquetas sobre la misma vertical se pisan y no se leen ninguna.
  const meanAt = nearestLabel(data, stats.mean);
  const medianAt = nearestLabel(data, stats.median);

  const renderTooltip = ({ active, payload }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as (typeof data)[number] | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={`${compactNumber(point.from)} → ${compactNumber(point.to)} ${unit}`}
        rows={[
          { name: 'Años', value: String(point.count) },
          { name: 'Del total', value: `${number((point.count / stats.n) * 100, 1)} %` },
          { name: 'Densidad', value: number(point.curve, 2) },
        ]}
        {...(point.tail ? { note: 'Fuera de los bigotes de Tukey' } : {})}
      />
    );
  };

  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="macroDensityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gap)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--gap)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" minTickGap={22} {...AXIS} />
          <YAxis width={40} allowDecimals={false} {...AXIS} />
          <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
          <Bar
            dataKey="count"
            animationDuration={MOTION.duration}
            animationEasing={MOTION.easing}
            radius={[3, 3, 0, 0]}
          >
            {data.map((bin) => (
              <Cell
                key={bin.label}
                fill={bin.tail ? 'var(--up)' : 'var(--official)'}
                fillOpacity={bin.tail ? 0.78 : 0.5}
              />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="curve"
            stroke="var(--gap)"
            strokeWidth={2.2}
            dot={false}
            animationDuration={MOTION.duration}
            animationEasing={MOTION.easing}
          />
          {meanAt === undefined ? null : (
            <ReferenceLine
              x={meanAt}
              stroke="var(--parallel)"
              strokeDasharray="4 3"
              label={{ value: 'media', position: 'top', fill: 'var(--parallel)', fontSize: 10 }}
            />
          )}
          {medianAt === undefined || medianAt === meanAt ? null : (
            <ReferenceLine
              x={medianAt}
              stroke="var(--down)"
              strokeDasharray="2 3"
              label={{ value: 'mediana', position: 'top', fill: 'var(--down)', fontSize: 10 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** El intervalo en cuyo centro cae un valor, para marcarlo sobre un eje de categorías. */
function nearestLabel(bins: ReadonlyArray<HistoBin>, value: number): string | undefined {
  let nearest: HistoBin | undefined;
  for (const bin of bins) {
    if (!nearest || Math.abs(bin.centre - value) < Math.abs(nearest.centre - value)) nearest = bin;
  }
  return nearest?.label;
}

/* Violín ----------------------------------------------------------------- */

/**
 * La misma distribución, de pie y con su caja dentro.
 *
 * Un violín es la densidad reflejada sobre su eje, así que la anchura en cada
 * altura es cuántos años valieron eso. Dibujado a mano en SVG y no con la
 * librería de gráficos: no trae violines, y hacerlo a mano deja meter dentro lo
 * que un violín solo no dice —la caja intercuartílica, la mediana, los bigotes
 * de Tukey y cada año atípico como un punto que se puede señalar—. Es también
 * lo que hace que la figura sobreviva al PDF: es vectorial y no depende de que
 * el navegador que imprime vuelva a montar la librería.
 */
export function ViolinPlot({
  curve,
  stats,
  unit,
  tone = 'var(--official)',
}: {
  curve: DensityPoint[];
  stats: MacroStats;
  unit: string;
  tone?: string;
}) {
  if (curve.length < 3) {
    return <p className="analysis-empty">Faltan observaciones para dibujar un violín.</p>;
  }

  const W = 340;
  const H = 320;
  const pad = { top: 16, right: 18, bottom: 26, left: 62 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const axis = pad.left + plotW / 2;

  const values = curve.map((point) => point.x);
  const low = Math.min(...values, stats.min.value);
  const high = Math.max(...values, stats.max.value);
  const span = high - low || 1;
  const y = (value: number): number => pad.top + plotH - ((value - low) / span) * plotH;

  const peak = Math.max(...curve.map((point) => point.density)) || 1;
  const half = (density: number): number => (density / peak) * (plotW / 2) * 0.94;

  // Un solo trazo cerrado: se sube por el lado derecho y se baja por el
  // izquierdo. Partirlo en dos caminos deja una costura visible en el borde
  // cuando el navegador redondea de distinta forma cada mitad.
  const right = curve.map((point) => `${axis + half(point.density)},${y(point.x)}`);
  const left = [...curve].reverse().map((point) => `${axis - half(point.density)},${y(point.x)}`);
  const shape = `M${right.join(' L')} L${left.join(' L')} Z`;

  const outliers = new Set(stats.outliers.map((row) => row.period));
  const inside = stats.spark.filter((value) => value >= stats.lowFence && value <= stats.highFence);
  const whiskerLow = inside.length ? Math.min(...inside) : stats.min.value;
  const whiskerHigh = inside.length ? Math.max(...inside) : stats.max.value;

  const boxW = 22;
  const ticks = Array.from({ length: 5 }, (_, index) => low + (span * index) / 4);

  return (
    <div className="violin-frame">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Violín de la distribución">
        <title>
          Distribución de {stats.n} observaciones, {stats.firstPeriod}–{stats.lastPeriod}
        </title>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left - 6}
              x2={W - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--rule-soft)"
            />
            <text
              x={pad.left - 10}
              y={y(tick) + 3.5}
              textAnchor="end"
              fontSize={10}
              fill="var(--ink-faint)"
              fontFamily="var(--mono)"
            >
              {compactNumber(tick)}
            </text>
          </g>
        ))}

        <path d={shape} fill={tone} fillOpacity={0.22} stroke={tone} strokeWidth={1.6} />

        {/* Bigotes hasta la observación más lejana que todavía no es atípica. */}
        <line
          x1={axis}
          x2={axis}
          y1={y(whiskerHigh)}
          y2={y(whiskerLow)}
          stroke="var(--ink-soft)"
          strokeWidth={1}
        />
        {[whiskerLow, whiskerHigh].map((value) => (
          <line
            key={value}
            x1={axis - 7}
            x2={axis + 7}
            y1={y(value)}
            y2={y(value)}
            stroke="var(--ink-soft)"
            strokeWidth={1}
          />
        ))}

        <rect
          x={axis - boxW / 2}
          y={y(stats.q3)}
          width={boxW}
          height={Math.max(1, y(stats.q1) - y(stats.q3))}
          fill="var(--panel)"
          stroke="var(--ink-soft)"
          strokeWidth={1.2}
          rx={2}
        >
          <title>
            RIC {compactNumber(stats.iqr)} {unit} · Q1 {compactNumber(stats.q1)} · Q3{' '}
            {compactNumber(stats.q3)}
          </title>
        </rect>
        <line
          x1={axis - boxW / 2}
          x2={axis + boxW / 2}
          y1={y(stats.median)}
          y2={y(stats.median)}
          stroke="var(--ink)"
          strokeWidth={2.2}
        />
        <line
          x1={axis - boxW / 2 - 5}
          x2={axis + boxW / 2 + 5}
          y1={y(stats.mean)}
          y2={y(stats.mean)}
          stroke="var(--parallel)"
          strokeWidth={1.4}
          strokeDasharray="4 3"
        />

        {stats.outliers.map((row) => (
          <circle
            key={row.period}
            cx={axis}
            cy={y(row.value)}
            r={3.4}
            fill="var(--up)"
            fillOpacity={0.85}
            stroke="var(--panel)"
            strokeWidth={0.8}
          >
            <title>
              {row.period}: {compactNumber(row.value)} {unit} · {number(row.z, 1)} σ
            </title>
          </circle>
        ))}

        <text
          x={axis}
          y={H - 8}
          textAnchor="middle"
          fontSize={10}
          fill="var(--ink-faint)"
          fontFamily="var(--sans)"
        >
          {stats.n} observaciones · {outliers.size} atípica{outliers.size === 1 ? '' : 's'}
        </text>
      </svg>
      <ul className="chart-legend">
        <li>
          <span className="chart-legend-mark" style={{ background: tone, opacity: 0.5 }} />
          densidad
        </li>
        <li>
          <span className="chart-legend-mark" style={{ background: 'var(--ink)' }} />
          mediana y RIC
        </li>
        <li>
          <span className="chart-legend-mark" style={{ background: 'var(--parallel)' }} />
          media
        </li>
        <li>
          <span className="chart-legend-mark" style={{ background: 'var(--up)' }} />
          atípicos
        </li>
      </ul>
    </div>
  );
}

/* Correlación ------------------------------------------------------------ */

export interface ScatterDatum {
  x: number;
  y: number;
  period: string;
}

export type AxisScale = 'valor' | 'año' | 'porcentaje';

const SCALE: Record<AxisScale, (value: number) => string> = {
  valor: compactNumber,
  año: (value) => String(Math.round(value)),
  porcentaje: (value) => `${number(value, Math.abs(value) >= 100 ? 0 : 1)} %`,
};

/**
 * Dos magnitudes enfrentadas, con la recta que las ajusta.
 *
 * Se usa dos veces con lecturas distintas: el nivel contra el año, que es la
 * tendencia de fondo de la serie, y la variación de un año contra la del
 * anterior, que es cuánta memoria tiene. La recta es mínimos cuadrados y el
 * rótulo lleva la r y la R², porque una nube con pendiente pronunciada y r de
 * 0,2 no es una relación, es un dibujo.
 */
export function ScatterTrend({
  points,
  fit,
  xLabel,
  yLabel,
  xScale = 'valor',
  yScale = 'valor',
  tone = 'var(--official)',
}: {
  points: ScatterDatum[];
  fit: Fit;
  xLabel: string;
  yLabel: string;
  /**
   * Cómo se rotula cada eje. Es un nombre y no una función porque el módulo es
   * frontera de cliente y Next revisa que cada prop cruce serializada; tres
   * escalas nombradas cubren todo lo que este panel enfrenta.
   */
  xScale?: AxisScale;
  yScale?: AxisScale;
  tone?: string;
}) {
  const xFormat = SCALE[xScale];
  const yFormat = SCALE[yScale];

  if (points.length < 3) {
    return <p className="analysis-empty">Faltan pares para medir una correlación.</p>;
  }

  const xs = points.map((point) => point.x);
  const from = Math.min(...xs);
  const to = Math.max(...xs);
  /*
   * La recta va como segmento de referencia y no como una serie más.
   *
   * Una segunda serie con sus propios dos puntos entra en el cálculo de los
   * dominios, y con ella los ejes dejan de terminar donde terminan los datos:
   * en una serie con pendiente fuerte la recta se sale por arriba y el eje se
   * estira para alcanzarla, dejando media caja vacía. Un segmento se dibuja
   * sobre las escalas ya fijadas y no las mueve.
   */
  const segment: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: from, y: fit.intercept + fit.slope * from },
    { x: to, y: fit.intercept + fit.slope * to },
  ];

  const renderTooltip = ({ active, payload }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as ScatterDatum | undefined;
    if (!point || point.period === undefined) return null;
    return (
      <TooltipShell
        label={point.period}
        rows={[
          { name: xLabel, value: xFormat(point.x) },
          { name: yLabel, value: yFormat(point.y) },
        ]}
      />
    );
  };

  return (
    <>
      {/*
        La caja del gráfico tiene alto fijo —es lo que evita que la página
        salte mientras dibuja— así que el pie con la r va fuera de ella. Dentro,
        se salía por debajo del borde de la tarjeta.
      */}
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 12, right: 18, bottom: 18, left: 4 }}>
            <CartesianGrid {...GRID} />
            <XAxis
              type="number"
              dataKey="x"
              domain={['dataMin', 'dataMax']}
              tickFormatter={xFormat}
              minTickGap={26}
              {...AXIS}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={['auto', 'auto']}
              tickFormatter={yFormat}
              width={52}
              {...AXIS}
            />
            <Tooltip content={renderTooltip} cursor={{ strokeDasharray: '3 3' }} />
            <ReferenceLine
              segment={segment}
              stroke="var(--parallel)"
              strokeWidth={1.8}
              strokeDasharray="6 4"
            />
            <Scatter
              dataKey="y"
              fill={tone}
              fillOpacity={0.72}
              animationDuration={MOTION.duration}
              animationEasing={MOTION.easing}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-note">
        r = <b>{number(fit.r, 3)}</b> · R² = <b>{number(fit.r2, 3)}</b> · {fit.n} pares ·{' '}
        {Math.abs(fit.r) >= 0.7
          ? 'relación fuerte'
          : Math.abs(fit.r) >= 0.4
            ? 'relación moderada'
            : 'relación débil'}
      </p>
    </>
  );
}

/**
 * Cuánto se parece la serie a sí misma unos años atrás.
 *
 * Cada barra es la correlación con el rezago que la rotula, y la banda gris es
 * el umbral de ruido: una barra que no la supera no distingue la serie de un
 * sorteo. Un stock de deuda mantiene barras altas diez años después; una
 * variación de precios suele apagarse al primero o al segundo.
 */
export function LagBars({ lags, band, label }: { lags: LagPoint[]; band: number; label: string }) {
  if (!lags.length) {
    return <p className="analysis-empty">Faltan años para medir la autocorrelación.</p>;
  }

  const renderTooltip = ({ active, payload }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as LagPoint | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={`Rezago de ${point.lag} año${point.lag === 1 ? '' : 's'}`}
        rows={[{ name: label, value: number(point.correlation, 3) }]}
        {...(Math.abs(point.correlation) > band ? { note: 'Fuera de la banda de ruido' } : {})}
      />
    );
  };

  return (
    <div className="chart-frame chart-frame-small">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={lags} margin={{ top: 10, right: 14, bottom: 4, left: 4 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="lag" {...AXIS} />
          <YAxis
            domain={[-1, 1]}
            width={40}
            tickFormatter={(v: number) => number(v, 1)}
            {...AXIS}
          />
          <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
          <ReferenceArea y1={-band} y2={band} fill="var(--ink-faint)" fillOpacity={0.12} />
          <ReferenceLine y={0} stroke="var(--ink-faint)" />
          <Bar dataKey="correlation" animationDuration={MOTION.duration} radius={[2, 2, 0, 0]}>
            {lags.map((point) => (
              <Cell
                key={point.lag}
                fill={point.correlation >= 0 ? 'var(--official)' : 'var(--parallel)'}
                fillOpacity={Math.abs(point.correlation) > band ? 0.85 : 0.32}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface VariationCell {
  period: string;
  change: number | null;
}

/**
 * Cada año de la serie como una celda, ordenados por década.
 *
 * Es la retícula que en una serie mensual sería mes contra año; aquí la serie
 * es anual, así que las filas son décadas y las columnas el último dígito del
 * año. Sirve para lo mismo: el color dice el signo y la intensidad la magnitud
 * de la variación, y una racha de crecimiento o un quiebre de régimen aparecen
 * como una banda de color antes de que nadie lea un número.
 */
export function VariationHeat({ cells, unit }: { cells: VariationCell[]; unit: string }) {
  const known = cells.filter((cell) => cell.change !== null);
  if (!known.length) {
    return (
      <p className="analysis-empty">La serie no tiene variaciones interanuales que mostrar.</p>
    );
  }

  const peak = Math.max(...known.map((cell) => Math.abs(cell.change ?? 0))) || 1;
  const decades = [...new Set(cells.map((cell) => `${cell.period.slice(0, 3)}0`))].sort();
  const index = new Map(cells.map((cell) => [cell.period, cell]));

  return (
    <div className="heat-scroll">
      <div
        className="heat-grid"
        style={{ gridTemplateColumns: `minmax(4.5rem, 0.7fr) repeat(10, minmax(2.6rem, 1fr))` }}
      >
        <span className="heat-corner" />
        {Array.from({ length: 10 }, (_, digit) => (
          <span className="heat-head" key={digit}>
            ·{digit}
          </span>
        ))}
        {decades.map((decade) => (
          <Fragment key={decade}>
            <span className="heat-row">{decade}s</span>
            {Array.from({ length: 10 }, (_, digit) => {
              const period = `${decade.slice(0, 3)}${digit}`;
              const cell = index.get(period);
              if (!cell || cell.change === null) {
                return (
                  <span
                    className="heat-cell"
                    key={period}
                    title={`${period}: sin lectura comparable`}
                  />
                );
              }
              // La intensidad va por la raíz de la proporción: una sola
              // hiperinflación en la serie dejaría todo lo demás en blanco si
              // el reparto fuera lineal.
              const weight = Math.max(0.14, Math.sqrt(Math.abs(cell.change) / peak));
              const hue = cell.change >= 0 ? 'var(--down)' : 'var(--up)';
              return (
                <span
                  className="heat-cell heat-cell-filled"
                  key={period}
                  title={`${period}: ${cell.change > 0 ? '+' : ''}${number(cell.change, 2)} % anual (${unit})`}
                  style={{
                    background: `color-mix(in srgb, ${hue} ${Math.round(weight * 100)}%, transparent)`,
                  }}
                >
                  {Math.abs(cell.change) >= 100 ? number(cell.change, 0) : number(cell.change, 1)}
                </span>
              );
            })}
          </Fragment>
        ))}
      </div>
      <ul className="chart-legend">
        <li>
          <span className="chart-legend-mark" style={{ background: 'var(--down)' }} />
          año al alza
        </li>
        <li>
          <span className="chart-legend-mark" style={{ background: 'var(--up)' }} />
          año a la baja
        </li>
        <li>
          <span className="chart-legend-mark" style={{ background: 'var(--rule)' }} />
          sin lectura
        </li>
      </ul>
    </div>
  );
}

/* Minigráfico de la tabla ------------------------------------------------ */

/**
 * La serie entera en el ancho de una celda, con sus extremos marcados.
 *
 * No lleva ejes ni tooltip porque no responde «cuánto»: responde «qué forma
 * tiene esto», que es lo único que una fila de tabla deja sin contestar. Se
 * dibuja a mano y no con la librería —ochenta filas montando ochenta gráficos
 * congelaban la tabla al pasar de página— y por eso además se puede imprimir.
 */
export function TrendSpark({
  values,
  tone,
  outlierAt = [],
}: {
  values: number[];
  tone: string;
  /** Índices, en el orden de `values`, que la serie declaró atípicos. */
  outlierAt?: number[];
}) {
  if (values.length < 2) return <span className="spark-empty">—</span>;
  const W = 96;
  const H = 26;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const x = (index: number): number => (index / (values.length - 1)) * (W - 2) + 1;
  const y = (value: number): number => H - 2 - ((value - low) / span) * (H - 5);

  const path = values.map((value, index) => `${x(index)},${y(value)}`).join(' L');
  const marks = new Set(outlierAt);
  const last = values.length - 1;
  const rising = (values.at(-1) ?? 0) >= (values[0] ?? 0);

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`M${path} L${W - 1},${H} L1,${H} Z`} fill={tone} fillOpacity={0.1} stroke="none" />
      <path d={`M${path}`} fill="none" stroke={tone} strokeWidth={1.4} strokeLinejoin="round" />
      {[...marks].map((at) =>
        values[at] === undefined ? null : (
          <circle key={at} cx={x(at)} cy={y(values[at])} r={1.9} fill="var(--up)" />
        ),
      )}
      <circle
        cx={x(last)}
        cy={y(values[last] ?? 0)}
        r={2.2}
        fill={rising ? 'var(--down)' : 'var(--up)'}
      />
    </svg>
  );
}

/**
 * La caja de la serie, del ancho de una celda.
 *
 * Dice en un centímetro lo que las seis columnas de estadísticos dicen en
 * números: dónde está el cuerpo, hacia qué lado se estira y si hay años sueltos
 * fuera. Es también el asidero de la fila —se pulsa y se abre el análisis
 * completo—, porque la pregunta que deja abierta es justo la que esa vista
 * contesta.
 */
export function DistributionStrip({
  stats,
  tone,
  unit,
}: {
  stats: MacroStats;
  tone: string;
  unit: string;
}) {
  if (stats.n < 3) return <span className="spark-empty">—</span>;
  const W = 110;
  const H = 26;
  const low = Math.min(stats.min.value, stats.lowFence);
  const high = Math.max(stats.max.value, stats.highFence);
  const span = high - low || 1;
  const x = (value: number): number => ((value - low) / span) * (W - 4) + 2;

  const inside = stats.spark.filter((value) => value >= stats.lowFence && value <= stats.highFence);
  const whiskerLow = inside.length ? Math.min(...inside) : stats.min.value;
  const whiskerHigh = inside.length ? Math.max(...inside) : stats.max.value;

  return (
    <svg
      className="strip"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Caja: mediana ${compactNumber(stats.median)} ${unit}, RIC ${compactNumber(stats.iqr)}`}
    >
      <line
        x1={x(whiskerLow)}
        x2={x(whiskerHigh)}
        y1={H / 2}
        y2={H / 2}
        stroke="var(--ink-faint)"
      />
      {[whiskerLow, whiskerHigh].map((value) => (
        <line
          key={value}
          x1={x(value)}
          x2={x(value)}
          y1={H / 2 - 5}
          y2={H / 2 + 5}
          stroke="var(--ink-faint)"
        />
      ))}
      <rect
        x={x(stats.q1)}
        y={H / 2 - 7}
        width={Math.max(1, x(stats.q3) - x(stats.q1))}
        height={14}
        fill={tone}
        fillOpacity={0.28}
        stroke={tone}
        strokeWidth={1}
        rx={2}
      />
      <line
        x1={x(stats.median)}
        x2={x(stats.median)}
        y1={H / 2 - 8}
        y2={H / 2 + 8}
        stroke="var(--ink)"
        strokeWidth={1.8}
      />
      {stats.outliers.map((row) => (
        <circle key={row.period} cx={x(row.value)} cy={H / 2} r={2} fill="var(--up)" />
      ))}
    </svg>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { DayCandles, Histogram, RateChart, SeriesChart } from './charts';
import type { DayCandle, RatePoint } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import {
  aggregationBoundary,
  drawdown,
  histogram,
  logReturns,
  moments,
  rollingCorrelation,
  rollingVolatility,
} from '@/lib/econometrics';
import type { Observation } from '@/lib/econometrics';

/**
 * The exchange-rate panel, with the reader's questions asked before the charts.
 *
 * Two things were missing here. The section opened straight into a volatility
 * estimate without saying what was being measured or on which series, which
 * asks the reader to reverse-engineer the method from the axis labels. And it
 * had no controls at all: every statistic was computed once, on the whole
 * history, on the mid-point — reasonable defaults, but defaults the reader
 * could neither see nor change.
 *
 * The controls are the ones that actually change the answer. The window decides
 * whether "volatility" means this quarter's or the decade's. The series decides
 * whether the figure describes the market mid-point or one of the two sides the
 * source publishes. The rolling span decides how fast the estimate reacts. Each
 * is recomputed here rather than fetched, so moving a control is immediate and
 * the numbers on screen always belong to the same selection.
 *
 * The basis filter deserves its own note: the history before the collector
 * started is a daily average of intraday quotes, and everything after it is a
 * reading at a point in time. They are different statistics. The panel keeps
 * them separable rather than quietly mixing them into one line.
 */

export interface FxExplorerProps {
  rows: RatePoint[];
  official: Observation[];
  readingCount: number;
}

type SeriesChoice = 'MID' | 'BUY' | 'SELL' | 'OFICIAL';

const RANGES: ReadonlyArray<{ key: string; label: string; days: number | null }> = [
  { key: '90d', label: '90 días', days: 90 },
  { key: '1a', label: '1 año', days: 365 },
  { key: '2a', label: '2 años', days: 730 },
  { key: 'todo', label: 'Todo', days: null },
];

const SERIES: ReadonlyArray<{
  key: SeriesChoice;
  label: string;
  hint: string;
  icon: IconName;
}> = [
  {
    key: 'MID',
    label: 'Paralelo · punto medio',
    hint: 'promedio de los dos lados publicados',
    icon: 'monedas',
  },
  {
    key: 'BUY',
    label: 'Paralelo · lado «buy»',
    hint: 'tal como lo etiqueta la fuente',
    icon: 'tendencia',
  },
  {
    key: 'SELL',
    label: 'Paralelo · lado «sell»',
    hint: 'tal como lo etiqueta la fuente',
    icon: 'area',
  },
  { key: 'OFICIAL', label: 'Oficial', hint: 'el que publica el Banco Central', icon: 'banco' },
];

const WINDOWS = [30, 60, 90] as const;

const number = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const signed = (value: number): string => `${value > 0 ? '+' : ''}${number(value)} %`;

function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: IconName;
}) {
  return (
    <div className="stat">
      <span className="stat-label">
        <Icon name={icon} size={12} />
        {label}
      </span>
      <span className="stat-value">{value}</span>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  );
}

/**
 * One of the four readings of the rate, assembled from the rows held.
 *
 * Lifted out of the panel because the pane needs to build every choice, not
 * just the chosen one: a slicer that cannot say how many readings an option
 * has is a slicer that will hand the reader an empty chart without warning.
 */
function seriesOf(rows: RatePoint[], official: Observation[], choice: SeriesChoice): Observation[] {
  if (choice === 'OFICIAL') return official;
  const out: Observation[] = [];
  for (const row of rows) {
    const buy = row.parallelBuy ?? null;
    const sell = row.parallelSell ?? null;
    const value =
      choice === 'BUY'
        ? buy
        : choice === 'SELL'
          ? sell
          : buy !== null && sell !== null
            ? (buy + sell) / 2
            : (buy ?? sell);
    if (value === null) continue;
    out.push({
      date: row.date,
      value,
      aggregation: row.archived ? ('DAILY_AVERAGE' as const) : ('POINT_IN_TIME' as const),
    });
  }
  return out;
}

/**
 * Above this many sessions the candles are grouped into weeks to stay legible.
 *
 * A hundred and twenty, not ninety: «90 días» leaves ninety-one sessions, and a
 * threshold of ninety turned the one selection the caption tells the reader to
 * pick into the weekly view it was meant to escape.
 */
const DAILY_LIMIT = 120;
/** And no more weeks than fit with a body a reader can see. */
const WEEK_LIMIT = 104;

export function FxExplorer({ rows, official, readingCount }: FxExplorerProps) {
  const [range, setRange] = useState('todo');
  const [series, setSeries] = useState<SeriesChoice>('MID');
  const [span, setSpan] = useState<number>(30);
  const [pointInTimeOnly, setPointInTimeOnly] = useState(false);
  /** Whether the level is read as a line or as one candle per session. */
  const [candles, setCandles] = useState(false);

  /** Every reading of one series, before the period filter narrows it. */
  const build = useMemo(() => {
    const cache = new Map<SeriesChoice, Observation[]>();
    return (choice: SeriesChoice): Observation[] => {
      const held = cache.get(choice);
      if (held) return held;
      const built = seriesOf(rows, official, choice);
      cache.set(choice, built);
      return built;
    };
  }, [rows, official]);

  const full = useMemo<Observation[]>(() => build(series), [build, series]);

  /** The cut-off the period control implies, as a date the series can be sliced on. */
  const floor = useMemo(() => {
    const days = RANGES.find((entry) => entry.key === range)?.days ?? null;
    const last = full.at(-1)?.date;
    if (days === null || !last) return null;
    const cut = new Date(`${last}T12:00:00Z`);
    cut.setUTCDate(cut.getUTCDate() - days);
    return cut.toISOString().slice(0, 10);
  }, [range, full]);

  const selected = useMemo(
    () =>
      full.filter(
        (point) =>
          (floor === null || point.date >= floor) &&
          (!pointInTimeOnly || point.aggregation === 'POINT_IN_TIME'),
      ),
    [full, floor, pointInTimeOnly],
  );

  const officialSelected = useMemo(
    () =>
      official.filter(
        (point) =>
          (floor === null || point.date >= floor) &&
          (!pointInTimeOnly || point.aggregation === 'POINT_IN_TIME'),
      ),
    [official, floor, pointInTimeOnly],
  );

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) => (floor === null || row.date >= floor) && (!pointInTimeOnly || !row.archived),
      ),
    [rows, floor, pointInTimeOnly],
  );

  const returns = useMemo(() => logReturns(selected), [selected]);
  const stats = useMemo(() => moments(returns), [returns]);
  const volatility = useMemo(() => rollingVolatility(returns, span), [returns, span]);
  const correlation = useMemo(
    () => rollingCorrelation(returns, logReturns(officialSelected), Math.max(span, 60)),
    [returns, officialSelected, span],
  );
  const fall = useMemo(() => drawdown(selected), [selected]);
  const buckets = useMemo(() => histogram(returns), [returns]);
  const boundary = useMemo(() => aggregationBoundary(selected), [selected]);
  const returnSeries = useMemo(
    () => returns.map((point) => ({ date: point.date, value: point.ret })),
    [returns],
  );

  /**
   * How many readings each option would leave standing, counted under every
   * other slicer but its own.
   *
   * The four series do not cover the same ground — the official was a flat
   * administered line for most of the record, and the point-in-time base drops
   * everything the collector did not read itself. Without these figures a
   * reader picks a combination, gets "fewer than five sessions chained" and has
   * no way to know which choice emptied it.
   */
  const countFor = (choice: SeriesChoice): number =>
    build(choice).filter(
      (point) =>
        (floor === null || point.date >= floor) &&
        (!pointInTimeOnly || point.aggregation === 'POINT_IN_TIME'),
    ).length;

  const countForBase = (onlyPointInTime: boolean): number =>
    full.filter(
      (point) =>
        (floor === null || point.date >= floor) &&
        (!onlyPointInTime || point.aggregation === 'POINT_IN_TIME'),
    ).length;

  /**
   * The rate as candles, over the period the reader chose.
   *
   * A candle needs a high and a low that are not its own body. With one quote a
   * day the close of each session IS the open of the next, so daily candles
   * tile into a continuous ribbon — honest, and unreadable as a candle chart.
   * Grouping the sessions into weeks fixes that with real numbers: the week
   * opens at its first mid-point, closes at its last, and its high and low are
   * the highest and lowest the rate actually reached inside it.
   *
   * Short selections stay daily, because ninety sessions do read, and there the
   * wick is the spread the source published that day — a long one is a session
   * where the two sides pulled apart, which is when the parallel market is
   * under strain.
   *
   * Neither is an intraday candle and the caption says so. The observatory
   * holds one reading a day; drawing four prices from a single quote would be
   * inventing three of them.
   */
  const dayCandles = useMemo((): DayCandle[] => {
    const sessions: Array<{ date: string; mid: number; buy: number; sell: number }> = [];
    for (const row of visibleRows) {
      const buy = row.parallelBuy ?? null;
      const sell = row.parallelSell ?? null;
      if (buy === null || sell === null) continue;
      sessions.push({ date: row.date, mid: (buy + sell) / 2, buy, sell });
    }

    if (sessions.length <= DAILY_LIMIT) {
      const out: DayCandle[] = [];
      let previous: number | null = null;
      for (const session of sessions) {
        if (previous !== null) {
          out.push({
            date: session.date,
            open: previous,
            close: session.mid,
            high: Math.max(session.buy, session.sell, previous, session.mid),
            low: Math.min(session.buy, session.sell, previous, session.mid),
          });
        }
        previous = session.mid;
      }
      return out;
    }

    /** Sessions grouped by the Monday they belong to. */
    const weeks = new Map<string, Array<(typeof sessions)[number]>>();
    for (const session of sessions) {
      const day = new Date(`${session.date}T12:00:00Z`);
      const monday = new Date(day);
      monday.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      weeks.set(key, [...(weeks.get(key) ?? []), session]);
    }

    return [...weeks.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .slice(-WEEK_LIMIT)
      .map(([week, held]) => {
        const mids = held.map((session) => session.mid);
        return {
          date: week,
          open: held[0]?.mid ?? 0,
          close: held.at(-1)?.mid ?? 0,
          high: Math.max(...mids),
          low: Math.min(...mids),
        };
      });
  }, [visibleRows]);

  const weekly = dayCandles.length > 0 && dayCandles.length !== visibleRows.length - 1;

  const chosen = SERIES.find((entry) => entry.key === series);
  const first = selected.at(0);
  const last = selected.at(-1);
  const move = first && last ? ((last.value - first.value) / first.value) * 100 : null;

  const active =
    (range === 'todo' ? 0 : 1) + (series === 'MID' ? 0 : 1) + (pointInTimeOnly ? 1 : 0);

  const query = new URLSearchParams({
    dataset: 'series',
    ...(floor ? { desde: floor } : {}),
  });

  return (
    <>
      <div className="briefcard">
        <span className="briefcard-mark">
          <Icon name="balanza" size={20} />
        </span>
        <div>
          <h2>Qué muestra esta sección</h2>
          <p>
            Bolivia tiene dos precios para el dólar —el oficial que fija el Banco Central y el
            paralelo del mercado—; la distancia entre ellos es la <strong>brecha cambiaria</strong>,
            el indicador más directo de la tensión sobre las reservas y sobre el poder de compra.
          </p>
          <div className="brief-points">
            <div className="brief-point">
              <span className="brief-point-mark">
                <Icon name="sigma" size={17} />
              </span>
              <div>
                <b>Retornos logarítmicos</b>
                <span>se mide la variación diaria, no el nivel</span>
              </div>
            </div>
            <div className="brief-point">
              <span className="brief-point-mark">
                <Icon name="campana" size={17} />
              </span>
              <div>
                <b>Volatilidad y cola</b>
                <span>qué tan violento es el movimiento</span>
              </div>
            </div>
            <div className="brief-point">
              <span className="brief-point-mark">
                <Icon name="refrescar" size={17} />
              </span>
              <div>
                <b>Todo recalcula</b>
                <span>con los filtros de la izquierda</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="workspace">
        <aside className="rail">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">
              {active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}
            </span>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} />
              Periodo
            </div>
            <div className="rail-pills">
              {RANGES.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className={range === entry.key ? 'chip chip-on' : 'chip'}
                  onClick={() => setRange(entry.key)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="capas" size={13} />
              Serie medida
            </div>
            {SERIES.map((entry) => (
              <button
                key={entry.key}
                type="button"
                title={entry.hint}
                className={series === entry.key ? 'rail-item rail-item-on' : 'rail-item'}
                onClick={() => setSeries(entry.key)}
              >
                <Icon name={entry.icon} size={16} />
                <span className="rail-name">{entry.label}</span>
                <span className="rail-n">{countFor(entry.key).toLocaleString('es-BO')}</span>
              </button>
            ))}
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="refrescar" size={13} />
              Ventana móvil
            </div>
            <div className="rail-pills">
              {WINDOWS.map((days) => (
                <button
                  key={days}
                  type="button"
                  className={span === days ? 'chip chip-on' : 'chip'}
                  onClick={() => setSpan(days)}
                >
                  {days} días
                </button>
              ))}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="capas" size={13} />
              Base de medición
            </div>
            <button
              type="button"
              className={pointInTimeOnly ? 'rail-item' : 'rail-item rail-item-on'}
              onClick={() => setPointInTimeOnly(false)}
              title="Incluye el tramo histórico, que es un promedio diario"
            >
              <Icon name="capas" size={16} />
              <span className="rail-name">Toda la serie</span>
              <span className="rail-n">{countForBase(false).toLocaleString('es-BO')}</span>
            </button>
            <button
              type="button"
              className={pointInTimeOnly ? 'rail-item rail-item-on' : 'rail-item'}
              onClick={() => setPointInTimeOnly(true)}
              title="Solo lecturas puntuales del recolector, homogéneas entre sí"
            >
              <Icon name="reloj" size={16} />
              <span className="rail-name">Solo lectura puntual</span>
              <span className="rail-n">{countForBase(true).toLocaleString('es-BO')}</span>
            </button>
          </div>

          <div className="rail-foot">
            <b>{selected.length.toLocaleString('es-BO')}</b> jornadas
            {first && last ? (
              <>
                <br />
                <b>{first.date}</b> → <b>{last.date}</b>
              </>
            ) : null}
            {move === null ? null : (
              <>
                <br />
                Movimiento: <b>{signed(move)}</b>
              </>
            )}
          </div>
        </aside>

        <div className="workspace-main" id="tablero" tabIndex={-1}>
          <div className="strap">
            <Icon name="linea" size={17} />
            <h2>{chosen?.label}</h2>
            <span className="tile-hint">{selected.length.toLocaleString('es-BO')} jornadas</span>
            <div className="download">
              <a className="download-btn" href={`/api/export?${query.toString()}&format=csv`}>
                CSV
              </a>
              <a className="download-btn" href={`/api/export?${query.toString()}&format=json`}>
                JSON
              </a>
            </div>
          </div>

          {returns.length < 5 ? (
            <div className="callout">
              La selección deja menos de cinco jornadas encadenadas: no alcanza para estimar nada.
              Amplía el periodo o vuelve a «Toda la serie».
            </div>
          ) : (
            <>
              <div className="panel">
                <div className="tile-head card-head">
                  <Icon name={candles ? 'velas' : 'linea'} size={17} />
                  <h2>Nivel</h2>
                  <span className="tile-hint">
                    {first && last ? `${first.date} → ${last.date}` : 'sin datos'}
                  </span>
                  <button
                    type="button"
                    className={candles ? 'card-toggle card-toggle-on' : 'card-toggle'}
                    onClick={() => setCandles(!candles)}
                    title={
                      candles ? 'Ver la serie como línea' : 'Ver una vela por jornada del paralelo'
                    }
                    aria-pressed={candles}
                  >
                    <Icon name={candles ? 'linea' : 'velas'} size={16} />
                  </button>
                </div>
                {candles ? (
                  <>
                    <p className="panel-sub" style={{ marginBottom: 'var(--s2)' }}>
                      {weekly ? (
                        <>
                          Una vela por <b>semana</b> del paralelo: abre en el punto medio de su
                          primera jornada, cierra en el de la última, y la mecha va del mínimo al
                          máximo que el tipo de cambio alcanzó dentro de esa semana. Con más de{' '}
                          {DAILY_LIMIT} jornadas se agrupa así porque, con una cotización por día,
                          el cierre de una vela diaria <b>es</b> la apertura de la siguiente y los
                          cuerpos se pegan en una cinta continua. Elegí «90 días» a la izquierda
                          para verlas jornada por jornada.
                        </>
                      ) : (
                        <>
                          Una vela por <b>jornada</b>. El cuerpo va del punto medio de la jornada
                          anterior al de esta, así que su altura <b>es</b> la variación del día; la
                          mecha son los dos lados que publica la fuente, de modo que una mecha larga
                          es una jornada en la que compra y venta se separaron.
                        </>
                      )}{' '}
                      <b>No es una vela intradía</b>: el observatorio guarda una lectura por día, y
                      dibujar cuatro precios a partir de una sola cotización sería inventarlos.
                    </p>
                    <DayCandles data={dayCandles} unit="Bs/USD" />
                  </>
                ) : (
                  <>
                    <p className="panel-sub" style={{ marginBottom: 'var(--s2)' }}>
                      Bolivianos por dólar. Naranja: los dos lados que publica la fuente para el
                      paralelo. Azul: tipo de cambio oficial. El eje no arranca en cero, porque un
                      movimiento de dos bolivianos es enorme y una base en cero lo aplanaría.
                    </p>
                    <RateChart data={visibleRows} tall />
                  </>
                )}
              </div>

              <div className="stat-strip">
                <Stat
                  label="Volatilidad anualizada"
                  icon="pulso"
                  value={`${number(stats.volatilityAnnual, 1)} %`}
                  hint="desviación típica de los retornos diarios, √365"
                />
                <Stat
                  label="Retorno medio diario"
                  icon="sigma"
                  value={signed(stats.meanDaily)}
                  hint={`${stats.observations.toLocaleString('es-BO')} observaciones`}
                />
                <Stat
                  label="Asimetría"
                  icon="area"
                  value={number(stats.skewness, 2)}
                  hint={stats.skewness > 0 ? 'sesgo a depreciaciones' : 'sesgo a apreciaciones'}
                />
                <Stat
                  label="Curtosis en exceso"
                  icon="barras"
                  value={number(stats.excessKurtosis, 2)}
                  hint={
                    stats.excessKurtosis > 0 ? 'colas más gruesas que la normal' : 'colas más finas'
                  }
                />
                <Stat
                  label="VaR 95 % diario"
                  icon="escudo"
                  value={`${number(stats.valueAtRisk95, 2)} %`}
                  hint="pérdida no superada en 19 de cada 20 días"
                />
                {stats.worstDay ? (
                  <Stat
                    label="Peor jornada"
                    icon="rayo"
                    value={signed(stats.worstDay.ret)}
                    hint={stats.worstDay.date}
                  />
                ) : null}
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h2>Retornos diarios</h2>
                  <p className="panel-sub">
                    Variación logarítmica de {chosen?.label.toLocaleLowerCase('es')}. Las barras
                    hacen visibles los saltos que una línea de nivel suaviza.
                  </p>
                </div>
                <SeriesChart
                  data={returnSeries}
                  kind="bar"
                  tone="var(--parallel)"
                  unit="%"
                  zeroLine
                  {...(boundary ? { boundary } : {})}
                />
              </div>

              <div className="grid-two">
                <div className="panel">
                  <div className="panel-head">
                    <h2>Volatilidad realizada</h2>
                    <p className="panel-sub">
                      Ventana móvil de {span} días, anualizada. Responde a «¿está el mercado más
                      nervioso ahora que hace un mes?».
                    </p>
                  </div>
                  {volatility.length >= 2 ? (
                    <SeriesChart
                      data={volatility}
                      kind="area"
                      tone="var(--gap)"
                      unit="%"
                      decimals={1}
                      {...(boundary ? { boundary } : {})}
                    />
                  ) : (
                    <div className="callout">
                      Se necesitan más de {span} jornadas para una primera estimación.
                    </div>
                  )}
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <h2>Distribución de retornos</h2>
                    <p className="panel-sub">
                      Días por tramo; en rojo, la cola inferior del 5 %. Si las barras extremas son
                      más altas de lo que sería normal, los días excepcionales no son tan
                      excepcionales.
                    </p>
                  </div>
                  <Histogram data={buckets} />
                </div>
              </div>

              <div className="grid-two">
                <div className="panel">
                  <div className="panel-head">
                    <h2>Correlación oficial–paralelo</h2>
                    <p className="panel-sub">
                      Ventana móvil de {Math.max(span, 60)} días. Cerca de cero mientras el oficial
                      estuvo fijo: un precio que no se mueve no puede acompañar a otro. Se despega
                      cuando empieza a seguir al mercado.
                    </p>
                  </div>
                  {correlation.length >= 2 ? (
                    <SeriesChart
                      data={correlation}
                      kind="line"
                      tone="var(--official)"
                      unit=""
                      zeroLine
                      domain={[-1, 1]}
                    />
                  ) : (
                    <div className="callout">
                      Se necesitan al menos {Math.max(span, 60)} jornadas con ambas series para
                      estimarla.
                    </div>
                  )}
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <h2>Caída desde el máximo</h2>
                    <p className="panel-sub">
                      Distancia respecto al mayor nivel alcanzado hasta cada fecha. En un tipo de
                      cambio que se deprecia, volver a cero significa un nuevo récord.
                    </p>
                  </div>
                  <SeriesChart data={fall} kind="area" tone="var(--up)" unit="%" zeroLine />
                </div>
              </div>
            </>
          )}

          <p className="panel-sub">
            {readingCount.toLocaleString('es-BO')} puntos de serie leídos del núcleo del
            observatorio.
          </p>
        </div>
      </div>
    </>
  );
}

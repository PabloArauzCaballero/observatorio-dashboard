'use client';

import { useState } from 'react';

import { BankQuotesPanel } from './bank-quotes-panel';
import { BcbUsdtMarket } from './bcb-usdt-market';
import { DatedLines } from './charts';
import type { DatedBand, DatedLinePoint, DatedLineSeries } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import { LevelCandles, ShapeToggle } from './level-candles';
import { Panel } from '@/components/ui/panel';
import type { CandleSession } from '@/lib/candles';
import type { MacroPoint, RegimeSegment } from '@/lib/fx-macro';
import type { FxConclusion, FxSnapshot, StablecoinReading } from '@/lib/fx-snapshot';
import { isPlottable } from '@/lib/stablecoin-market-survey';

/**
 * The macroeconomic reading of the exchange rate: the answers, then the charts.
 *
 * Deliberately placed before the statistical machinery rather than after it.
 * The old section opened on an annualised volatility and a value at risk, which
 * asks a reader to work out for themselves what the figures are for; this opens
 * on what the figures say, in sentences, with the number that carries each one.
 *
 * None of the prose here is written. Every sentence arrives from
 * `fxSnapshot`, derived from the same series the charts draw, so a reader can
 * check any claim against the plot beside it and neither can go stale while the
 * other updates.
 *
 * Las frases llegan plegadas: siguen siendo lo primero del capítulo, pero como
 * una cabecera que se abre y no como seis párrafos delante de los gráficos. El
 * porqué está en `FxConclusions`.
 */

const number = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const signed = (value: number, decimals = 2): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value), decimals)}`;

/** The icon each conclusion carries, chosen for what the figure is about. */
const CONCLUSION_ICON: Record<string, IconName> = {
  refugio: 'escudo',
  brecha: 'balanza',
  regimen: 'banco',
  real: 'monedas',
  paridad: 'diana',
  ritmo: 'tendencia',
  ancla: 'reloj',
  inflacion: 'etiqueta',
  riel: 'chip',
};

/**
 * Maps a conclusion's direction onto the report's two-colour convention.
 *
 * The existing marks are named `up` and `down` after a movement, but what they
 * actually encode is adverse and favourable — `--up` is the red used for "above
 * the reference, adverse". Translating here rather than renaming the tokens
 * keeps this panel inside the palette that was validated for contrast instead of
 * introducing a third colour that was not.
 */
const toneClass = (tone: FxConclusion['tone']): string =>
  tone === 'adverse' ? 'up' : tone === 'favourable' ? 'down' : 'flat';

/**
 * La lectura de los datos, plegada hasta que alguien la pide.
 *
 * Abierta ocupa la primera pantalla entera del capítulo y empuja por debajo del
 * pliegue a los gráficos de los que sale, de modo que la sección abría con seis
 * párrafos y ninguna serie. Plegada, la cabecera dice cuántas lecturas hay y el
 * lector decide: el orden sigue siendo respuestas primero, pero el texto ya no
 * se cobra la pantalla antes de que nadie lo haya pedido.
 *
 * El estado no se recuerda entre cargas a propósito. Guardarlo obliga a decidir
 * qué ve quien llega por primera vez desde otro aparato, y esa respuesta ya
 * está tomada aquí: cerrado.
 */
export function FxConclusions({ conclusions }: { conclusions: readonly FxConclusion[] }) {
  const [open, setOpen] = useState(false);
  if (!conclusions.length) return null;
  return (
    <Panel
      id="lecturas-del-dolar"
      title="Qué dicen los datos del tipo de cambio (lecturas derivadas)"
      lede={
        open
          ? 'Cada frase sale de las series de esta misma sección y se recalcula con cada carga. Dice qué nivel hay, contra qué referencia y bajo qué régimen, y qué vale esa cifra en bolivianos para quien tiene que decidir algo con ella; no dice por qué pasó ni qué va a pasar.'
          : 'Frases derivadas de las mismas series que se dibujan más abajo, cada una con la cifra que la sostiene.'
      }
      meta={
        <button
          type="button"
          className="menu-btn"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          title={open ? 'Plegar la lectura de los datos' : 'Ver qué dicen estos datos'}
        >
          {open
            ? 'Plegar'
            : `Ver ${conclusions.length} lectura${conclusions.length === 1 ? '' : 's'}`}
        </button>
      }
      source="Banco Central de Bolivia, mercados P2P en bolivianos y cálculo del Observatorio sobre las series de esta sección"
      data={{
        columnas: ['Lectura', 'Cifra', 'Detalle'],
        filas: conclusions.map((conclusion) => [
          conclusion.claim,
          conclusion.figure,
          conclusion.detail,
        ]),
      }}
    >
      {open ? (
        <ul className="bullets">
          {conclusions.map((conclusion) => (
            <li className="bullet" key={conclusion.key}>
              <span className={`bullet-mark bullet-mark-${toneClass(conclusion.tone)}`}>
                <Icon name={CONCLUSION_ICON[conclusion.key] ?? 'info'} size={16} />
              </span>
              <div className="bullet-body">
                <div className="bullet-line">
                  <b className="bullet-label">{conclusion.claim}</b>
                  <span className={`bullet-value bullet-value-${toneClass(conclusion.tone)}`}>
                    {conclusion.figure}
                  </span>
                </div>
                <p className="bullet-detail">{conclusion.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

/**
 * La franja del tramo leído por instrumento.
 *
 * Es la misma herramienta que marca el tramo de tipo de cambio fijo y por la
 * misma razón: el cambio de qué se está midiendo ocurre en una fecha, y un pie
 * de figura obliga al lector a sostener esa fecha en la cabeza mientras mira la
 * curva. Sombreada, la costura se ve donde está.
 */
function labelledBand(from: string | undefined, dates: readonly string[]): DatedBand[] {
  const last = dates.at(-1);
  // La franja son veintitantas jornadas de ochocientas, pegadas al borde
  // derecho: colgado de su izquierda, el rótulo se salía del gráfico y llegaba
  // cortado a media palabra. Colgado de la derecha, crece hacia adentro.
  return from && last && from <= last
    ? [{ from, to: last, label: 'leído por ficha', align: 'right' as const }]
    : [];
}

/** The regime stretches, shaded behind whichever series is drawn over them. */
function regimeBands(regimes: readonly RegimeSegment[]): DatedBand[] {
  return regimes
    .filter((segment) => segment.regime === 'FIJO' && segment.days > 60)
    .map((segment) => ({ from: segment.from, to: segment.to, label: 'oficial fijo' }));
}

/**
 * Un punto de nivel con los dos lados que lo produjeron, cuando la fuente los
 * publica. La línea dibuja `value`; la vela usa `bid` y `ask` como mecha.
 */
export interface SidedPoint extends MacroPoint {
  bid?: number | null;
  ask?: number | null;
}

export interface FxMacroPanelsProps {
  snapshot: FxSnapshot;
  /** The parallel in real terms, base 100 at the first day it and the UFV exist. */
  realParallel: readonly MacroPoint[];
  /** One entry per token; USDT carries the parallel before the split begins. */
  tokens: ReadonlyArray<{ token: string; points: readonly SidedPoint[] }>;
  /** First day a reading names its instrument, where the token line stops being spliced. */
  labelledFrom?: string | undefined;
}

const REAL_SERIES: readonly DatedLineSeries[] = [
  {
    key: 'paralelo',
    label: 'Dólar paralelo en poder de compra (índice)',
    tone: 'var(--parallel)',
    emphasis: true,
  },
];

/**
 * Colour for the token lines.
 *
 * Only the first three slots of the palette survive the pairwise separation
 * check, so the two tokens take the second and third rather than a new hue
 * invented for them. The parallel's own orange goes to USDT because USDT *is*
 * what most of the parallel series has been quoting all along.
 */
/**
 * Days a token needs before its line is drawn rather than tabulated.
 *
 * Two readings produce two flat segments and a vertical axis that prints the
 * same tick twice, which reads as a broken chart rather than as a series that
 * has just started. Until there is a fortnight the figures are given as
 * numbers, which is all they are.
 */
const TOKEN_CHART_MINIMUM = 14;

/**
 * Colour per token, and deliberately only three of them.
 *
 * The palette's pairwise separation check is passed by the first three slots
 * and by no combination that includes a fourth, so a fourth token gets the
 * neutral rest colour rather than a hue invented to fill the gap. That is not a
 * limitation worth working around here: three tokens have never had a boliviano
 * market at all, and the day one of them does it will be one line, not three.
 */
const TOKEN_TONE: Record<string, string> = {
  USDT: 'var(--parallel)',
  USDC: 'var(--gap)',
  USD: 'var(--series-rest)',
};

export function FxMacroPanels({
  snapshot,
  realParallel,
  tokens,
  labelledFrom,
}: FxMacroPanelsProps) {
  /*
   * Línea o velas, por panel y a propósito por separado. Los dos dibujan un
   * nivel de precio contra el calendario y los dos se piden como velas para
   * el análisis variacional, pero la pregunta de cada uno es distinta —cuánto
   * poder de compra perdió el dólar; cuánto cuesta por cada riel— y un lector
   * que abre las velas de uno no ha pedido las del otro.
   */
  const [realCandles, setRealCandles] = useState(false);
  const [tokenCandles, setTokenCandles] = useState(false);

  const bands = regimeBands(snapshot.regimes);
  const realRows: DatedLinePoint[] = realParallel.map((point) => ({
    date: point.date,
    paralelo: point.value,
  }));
  /** El índice real como jornadas: un valor al día y ningún lado, porque un índice no los tiene. */
  const realSessions: CandleSession[] = realParallel.map((point) => ({
    date: point.date,
    mid: point.value,
  }));

  /*
   * Las fichas que el censo declara sin precio no se dibujan, aunque tengan
   * lecturas. El porqué está en `isPlottable`; el efecto visible es que la
   * ficha baja a la nota del censo y allí se explica sola.
   */
  const plotted = tokens.filter((entry) => isPlottable(entry.token));
  const tokenSeries: DatedLineSeries[] = plotted.map((entry) => ({
    key: entry.token,
    label: `${entry.token} (Bs por USD)`,
    tone: TOKEN_TONE[entry.token] ?? 'var(--series-rest)',
    emphasis: entry.token === 'USDT',
  }));
  const tokenDates = [
    ...new Set(plotted.flatMap((entry) => entry.points.map((point) => point.date))),
  ].sort();
  /*
   * Por índice y no por búsqueda lineal.
   *
   * Con USDT empalmado al paralelo, la ficha larga pasa de unas decenas de
   * puntos a las ochocientas jornadas del capítulo, y un `find` por fecha y por
   * ficha recorre esa serie entera cada vez: armar la tabla pasaba de miles de
   * comparaciones a casi dos millones, en la página más lenta del tablero.
   */
  const byToken = new Map(
    plotted.map((entry) => [entry.token, new Map(entry.points.map((p) => [p.date, p.value]))]),
  );
  const tokenRows: DatedLinePoint[] = tokenDates.map((date) => {
    const row: DatedLinePoint = { date };
    for (const entry of plotted) {
      row[entry.token] = byToken.get(entry.token)?.get(date) ?? null;
    }
    return row;
  });
  /*
   * Cada ficha como jornadas para sus velas: el punto medio abre y cierra, y
   * la compra y la venta medianas del día —cuando la fuente resolvió los
   * lados— son la mecha. Una ficha con un solo lado ese día lleva ese lado y
   * el punto medio, que es lo que se sabe de ella.
   */
  const tokenSessions = plotted.map((entry) => ({
    token: entry.token,
    sessions: entry.points.map((point): CandleSession => ({
      date: point.date,
      mid: point.value,
      sides: [point.bid, point.ask].filter((side): side is number => typeof side === 'number'),
    })),
  }));

  const realLede = `Lo que la inflación le quitó al dólar: el paralelo deflactado por la UFV, con su nivel de ${sayShort(snapshot.real?.base)} = 100.`;
  const tokenChart = tokenRows.length >= TOKEN_CHART_MINIMUM;

  return (
    <>
      <FxConclusions conclusions={snapshot.conclusions} />

      {/*
       * Las dos series de tiempo del capítulo, en una fila y no una debajo de
       * otra.
       *
       * Son la misma clase de dibujo —bolivianos por dólar contra el
       * calendario, sobre la misma ventana de fechas— y apiladas a lo alto de
       * la pantalla obligaban a recordar la primera para mirar la segunda,
       * cuando la pregunta que resuelven juntas es si el dólar sube por sí
       * mismo o porque suben todos los precios. Lado a lado, el eje de fechas
       * de las dos empieza a la misma altura y la comparación se hace con los
       * ojos.
       *
       * Hasta ahora eran cuatro en `grid-three`, y a un tercio de la columna una
       * serie de ochocientas jornadas no se lee: el eje se queda sin sitio y la
       * leyenda de tres fichas pasa a dos renglones. Con la prosa plegada bajo
       * cada figura ya no hay razón para tanta estrechez, así que son dos
       * parejas. La segunda reúne lo que mira al mismo mercado desde el lado de
       * los bancos —el volumen que declara el BCB y lo que cobra cada banco—.
       */}
      <div className="grid-pair fx-par">
        <Panel
          id="dolar-paralelo-real"
          title="Dólar paralelo descontada la inflación (índice, base 100)"
          lede={realLede}
          source="Mercados P2P en bolivianos (paralelo), UFV del Banco Central de Bolivia y cálculo del Observatorio"
        >
          {realRows.length > 1 && realCandles ? (
            <LevelCandles
              sessions={realSessions}
              unit="puntos del índice"
              decimals={1}
              lead={<ShapeToggle candles={realCandles} onChange={setRealCandles} />}
            />
          ) : realRows.length > 1 ? (
            <>
              <div className="fx-filters">
                <ShapeToggle candles={realCandles} onChange={setRealCandles} />
              </div>
              <DatedLines
                data={realRows}
                series={REAL_SERIES}
                unit="índice"
                decimals={1}
                referenceLine={100}
                referenceLabel="nivel del inicio"
                bands={bands}
              />
            </>
          ) : (
            <div className="callout">
              Hace falta que el tipo de cambio y la UFV coincidan en al menos dos jornadas.
            </div>
          )}
          <details className="panel-note">
            <summary>Cómo leer este panel</summary>
            <p>
              Más abajo, «Dólar oficial y paralelo (Bs por USD)» dibuja el mismo dólar en bolivianos
              corrientes; esta línea lo dibuja en poder de compra, que es lo único que el nivel
              nominal no puede decir. Por encima de 100 el dólar se encareció de verdad; por debajo,
              su subida no alcanzó a los precios y hoy cuesta menos que al empezar. La franja
              sombreada es el tramo en que el oficial estuvo fijo.
            </p>
          </details>
        </Panel>

        <Panel
          id="dolar-por-ficha"
          title="Precio del dólar por ficha estable (Bs por USD)"
          lede="El punto medio en bolivianos por dólar de cada ficha estable, la vía por la que se compran dólares cuando el mercado formal no los da."
          source="Mercados P2P en bolivianos, lecturas por ficha del Observatorio"
          data={() =>
            tokenChart
              ? undefined
              : {
                  unidad: 'Bs por USD',
                  columnas: [
                    'Ficha',
                    'Punto medio (Bs por USD)',
                    'Compra (Bs)',
                    'Venta (Bs)',
                    'Ida y vuelta (%)',
                    'Costo de comprar sobre el punto medio (%)',
                    'Plazas',
                  ],
                  filas: snapshot.stablecoins.map((reading) => [
                    reading.token,
                    reading.mid,
                    reading.bid,
                    reading.ask,
                    reading.spreadPercent,
                    reading.premiumAskPercent,
                    reading.venues,
                  ]),
                }
          }
        >
          {tokenChart ? (
            <div className="fx-filters">
              <ShapeToggle candles={tokenCandles} onChange={setTokenCandles} />
            </div>
          ) : null}
          {tokenChart && tokenCandles ? (
            /*
             * Una pila de velas por ficha y no una sola con las dos: una vela
             * es un precio en el tiempo, y dos fichas superpuestas serían dos
             * precios peleando por el mismo cuerpo. La ventana abre en «90
             * días» porque es donde vive el tramo leído por ficha; «Todo»
             * devuelve a USDT su historia empalmada, ya por semanas.
             */
            <div className="chart-stack">
              {tokenSessions.map((entry) => (
                <div key={entry.token} className="candle-token">
                  <h4 className="candle-token-title">
                    {entry.token} (Bs por USD)
                    <span className="candle-token-hint">
                      {entry.sessions.length.toLocaleString('es-BO')} jornadas
                    </span>
                  </h4>
                  <LevelCandles
                    sessions={entry.sessions}
                    unit="Bs por USD"
                    decimals={3}
                    sidesNote="la compra y la venta medianas de la jornada"
                    defaultRange="90d"
                  />
                </div>
              ))}
            </div>
          ) : tokenChart ? (
            <DatedLines
              data={tokenRows}
              series={tokenSeries}
              unit="Bs por USD"
              decimals={3}
              bands={labelledBand(labelledFrom, tokenDates)}
            />
          ) : (
            <StablecoinTable readings={snapshot.stablecoins} />
          )}
          <details className="panel-note">
            <summary>Cómo leer este panel</summary>
            <p>
              Las fichas están ancladas al mismo dólar, de modo que la diferencia entre ellas es el
              costo del riel y no otro precio.
              {labelledFrom ? (
                <>
                  {' '}
                  Antes del {sayLong(labelledFrom)} el archivo no anotaba el instrumento, y lo que
                  cotizaba era USDT: hasta esa fecha la línea es el punto medio del paralelo, y{' '}
                  <b>la franja sombreada</b> es el tramo en que cada lectura ya viene con el nombre
                  de su ficha.
                </>
              ) : null}
            </p>
          </details>
        </Panel>
      </div>

      <div className="grid-pair fx-par">
        <BcbUsdtMarket />
        <BankQuotesPanel />
      </div>
    </>
  );
}

/*
 * El recuento de fichas sin línea (las que devolvieron el libro vacío o demasiado
 * fino en la última corrida) ya no se muestra bajo el gráfico: la nota se retiró
 * del tablero a pedido. El censo sigue en `stablecoin-market-survey.ts` y en los
 * datos de la corrida; aquí solo se dibujan las fichas con serie.
 */

/**
 * The tokens as a table, for while the series is too short to plot.
 *
 * A one-point line is not a chart, and drawing it anyway would suggest a history
 * that does not exist: the per-token split begins where the collector began
 * naming the instrument, not where the parallel series begins.
 */
export function StablecoinTable({ readings }: { readings: readonly StablecoinReading[] }) {
  if (!readings.length) {
    return (
      <div className="callout">
        Todavía no hay lecturas por ficha. La serie por moneda empieza cuando el recolector nuevo
        publica su primera jornada; antes de eso la fuente no distinguía el instrumento.
      </div>
    );
  }
  return (
    <div className="stat-strip">
      {readings.map((reading) => (
        <div className="stat" key={reading.token}>
          <span className="stat-label">
            <Icon name="chip" size={12} />
            {reading.token}
          </span>
          <span className="stat-value">{number(reading.mid, 3)}</span>
          <span className="stat-hint">
            {reading.bid !== null && reading.ask !== null
              ? `compra ${number(reading.bid, 2)} · venta ${number(reading.ask, 2)}`
              : 'punto medio entre plazas'}
            {reading.spreadPercent !== null
              ? ` · ida y vuelta ${number(reading.spreadPercent)} %`
              : ''}
            {reading.premiumAskPercent !== null
              ? ` · comprar aquí cuesta ${signed(reading.premiumAskPercent)} %`
              : ''}
            {` · ${reading.venues} plaza${reading.venues === 1 ? '' : 's'}`}
          </span>
        </div>
      ))}
    </div>
  );
}

const shortDate = new Intl.DateTimeFormat('es-BO', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const longDate = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
/** La fecha de la costura, dicha entera: es un dato del texto, no un rotulo de eje. */
const sayLong = (value: string): string => longDate.format(new Date(value + 'T12:00:00Z'));

const sayShort = (value: string | undefined): string =>
  value ? shortDate.format(new Date(`${value}T12:00:00Z`)) : 'inicio de la serie';

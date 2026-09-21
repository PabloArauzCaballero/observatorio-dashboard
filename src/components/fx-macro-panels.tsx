'use client';

import { useState } from 'react';

import { DatedLines } from './charts';
import type { DatedBand, DatedLinePoint, DatedLineSeries } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { MacroPoint, RegimeSegment } from '@/lib/fx-macro';
import type { FxConclusion, FxSnapshot, StablecoinReading } from '@/lib/fx-snapshot';
import {
  STABLECOIN_MARKET_SURVEY_DATE,
  STABLECOIN_MARKET_SURVEY_VENUES,
  stablecoinsWithoutSeries,
  type StablecoinMarketEntry,
} from '@/lib/stablecoin-market-survey';

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
  brecha: 'balanza',
  regimen: 'banco',
  real: 'monedas',
  ancla: 'diana',
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
    <div className={open ? 'analysis' : 'analysis analysis-folded'}>
      <div className="tile-head card-head">
        <Icon name="sigma" size={17} />
        <h2>Qué dicen estos datos</h2>
        <span className="tile-hint">
          {open
            ? 'derivado, no redactado'
            : `${conclusions.length} lectura${conclusions.length === 1 ? '' : 's'}`}
        </span>
        <button
          type="button"
          className={open ? 'card-toggle card-toggle-on' : 'card-toggle'}
          onClick={() => setOpen(!open)}
          title={open ? 'Plegar la lectura de los datos' : 'Ver qué dicen estos datos'}
          aria-expanded={open}
        >
          <Icon name={open ? 'plegar' : 'desplegar'} size={16} />
        </button>
      </div>
      {!open ? null : (
        <>
          <p className="analysis-note">
            Cada frase sale de las series de esta misma sección y se recalcula con cada carga. Dice
            qué nivel hay, contra qué referencia y bajo qué régimen; no dice por qué ni qué va a
            pasar.
          </p>
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
        </>
      )}
    </div>
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

export interface FxMacroPanelsProps {
  snapshot: FxSnapshot;
  /** The parallel in real terms, base 100 at the first day it and the UFV exist. */
  realParallel: readonly MacroPoint[];
  /** One entry per token; USDT carries the parallel before the split begins. */
  tokens: ReadonlyArray<{ token: string; points: readonly MacroPoint[] }>;
  /** First day a reading names its instrument, where the token line stops being spliced. */
  labelledFrom?: string | undefined;
}

const REAL_SERIES: readonly DatedLineSeries[] = [
  { key: 'paralelo', label: 'Paralelo, real', tone: 'var(--parallel)', emphasis: true },
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
  const bands = regimeBands(snapshot.regimes);
  const realRows: DatedLinePoint[] = realParallel.map((point) => ({
    date: point.date,
    paralelo: point.value,
  }));

  const tokenSeries: DatedLineSeries[] = tokens.map((entry) => ({
    key: entry.token,
    label: entry.token,
    tone: TOKEN_TONE[entry.token] ?? 'var(--series-rest)',
    emphasis: entry.token === 'USDT',
  }));
  const tokenDates = [
    ...new Set(tokens.flatMap((entry) => entry.points.map((point) => point.date))),
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
    tokens.map((entry) => [entry.token, new Map(entry.points.map((p) => [p.date, p.value]))]),
  );
  const tokenRows: DatedLinePoint[] = tokenDates.map((date) => {
    const row: DatedLinePoint = { date };
    for (const entry of tokens) {
      row[entry.token] = byToken.get(entry.token)?.get(date) ?? null;
    }
    return row;
  });

  return (
    <>
      <FxConclusions conclusions={snapshot.conclusions} />

      <div className="panel">
        <div className="panel-head">
          <h2>Lo que la inflación le quitó al dólar</h2>
          <p className="panel-sub">
            El paralelo deflactado por la UFV, con su nivel de {sayShort(snapshot.real?.base)} ={' '}
            <b>100</b>. Más abajo, «Nivel» dibuja el mismo dólar en bolivianos corrientes; esta
            línea lo dibuja en poder de compra, que es lo único que el nivel nominal no puede decir.
            Por encima de 100 el dólar se encareció de verdad; por debajo, su subida no alcanzó a
            los precios y hoy cuesta menos que al empezar. La franja sombreada es el tramo en que el
            oficial estuvo fijo.
          </p>
        </div>
        {realRows.length > 1 ? (
          <DatedLines
            data={realRows}
            series={REAL_SERIES}
            unit="índice"
            decimals={1}
            referenceLine={100}
            referenceLabel="nivel del inicio"
            bands={bands}
            height="tall"
          />
        ) : (
          <div className="callout">
            Hace falta que el tipo de cambio y la UFV coincidan en al menos dos jornadas.
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>El dólar por cada riel</h2>
          <p className="panel-sub">
            Punto medio en bolivianos por dólar de cada ficha estable, que es la vía por la que se
            compran dólares cuando el mercado formal no los da. Están ancladas al mismo dólar, de
            modo que la diferencia entre ellas es el costo del riel y no otro precio.
            {labelledFrom ? (
              <>
                {' '}
                Antes del {sayLong(labelledFrom)} el archivo no anotaba el instrumento, y lo que
                cotizaba era USDT: hasta esa fecha la línea es el punto medio del paralelo, y{' '}
                <b>la franja sombreada</b> es el tramo en que cada lectura ya viene con el nombre de
                su ficha.
              </>
            ) : null}
          </p>
        </div>
        {tokenRows.length >= TOKEN_CHART_MINIMUM ? (
          <DatedLines
            data={tokenRows}
            series={tokenSeries}
            unit="Bs/USD"
            decimals={3}
            bands={labelledBand(labelledFrom, tokenDates)}
            height="tall"
          />
        ) : (
          <StablecoinTable readings={snapshot.stablecoins} />
        )}
        <StablecoinCensus plotted={tokens.map((entry) => entry.token)} />
      </div>
    </>
  );
}

/**
 * Las fichas que se buscaron y hoy no tienen línea, con lo que devolvió cada una.
 *
 * Un gráfico con dos líneas no puede decir por sí solo si las demás fichas no
 * cotizan o si nadie las miró, y esa es exactamente la pregunta del lector que
 * conoce USDS, USDe o PYUSD de otros mercados. Sin esta nota la respuesta
 * honesta —«se pidieron las cinco y tres devolvieron el libro vacío»— no está
 * en ninguna parte de la página, y la ausencia se lee como un olvido.
 *
 * Se arma restando las fichas dibujadas al censo, no escribiendo nombres: el
 * día que una de estas abra mercado, su serie aparece arriba y su nombre
 * desaparece de aquí sin que nadie edite la frase.
 */
function StablecoinCensus({ plotted }: { plotted: readonly string[] }) {
  const missing = stablecoinsWithoutSeries(plotted);
  if (!missing.length) return null;

  /*
   * Tres motivos distintos por los que una ficha no tiene línea, y cada uno
   * dice una cosa distinta sobre el mercado. Meterlos en una sola frase fue el
   * primer intento y salió una falsedad: USDC, que cotiza por los dos lados,
   * quedó descrito como «de un solo lado» por compartir rama con FDUSD.
   */
  const empty = missing.filter((entry) => entry.state === 'NO_MARKET');
  const oneSided = missing.filter((entry) => entry.state === 'ONE_SIDED');
  const awaiting = missing.filter(
    (entry) => entry.state === 'QUOTED' || entry.state === 'QUOTED_THIN',
  );

  return (
    <p className="chart-note">
      <b>Por qué no hay una línea por cada ficha.</b> Cada corrida del recolector pide el libro en
      bolivianos de todas las fichas de esta lista, no solo de las que ya tienen serie.
      {empty.length ? (
        <>
          {' '}
          {sayList(empty)} {empty.length === 1 ? 'devolvió' : 'devolvieron'}{' '}
          <b>cero avisos en los dos lados</b> en {sayVenues()}: en bolivianos no{' '}
          {empty.length === 1 ? 'se negocia' : 'se negocian'}, de modo que no hay precio que dibujar
          y no se inventa uno.
        </>
      ) : null}
      {oneSided.map((entry) => (
        <span key={entry.label}>
          {' '}
          <b>{entry.label}</b> cotiza de un solo lado, {oneOrOther(entry)} y ninguno del contrario:
          medio libro no tiene punto medio, y media cotización no es un precio.
        </span>
      ))}
      {awaiting.map((entry) => (
        <span key={entry.label}>
          {' '}
          <b>{entry.label}</b> sí tiene libro por los dos lados —{entry.bids} y {entry.asks} avisos—
          y todavía no tiene línea: su serie empieza el día que se publique su primera lectura, no
          antes.
        </span>
      ))}{' '}
      Recuento del {sayLong(STABLECOIN_MARKET_SURVEY_DATE)}. Si alguna de las vacías abre mercado,
      su línea empieza sola el día que aparezca el primer aviso.
    </p>
  );
}

/** «7 avisos de compra» / «7 de venta», según qué lado sea el que existe. */
function oneOrOther(entry: StablecoinMarketEntry): string {
  const count = entry.asks || entry.bids;
  const side = entry.asks ? 'de venta' : 'de compra';
  return `${count} aviso${count === 1 ? '' : 's'} ${side}`;
}

/** «USDS, USDe y PYUSD» — la lista como se dice en voz alta, no separada por comas hasta el final. */
function sayList(entries: readonly StablecoinMarketEntry[]): string {
  const names = entries.map((entry) => entry.label);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
}

const sayVenues = (): string => {
  const names = [...STABLECOIN_MARKET_SURVEY_VENUES];
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
};

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

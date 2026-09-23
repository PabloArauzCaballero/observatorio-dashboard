import { Suspense } from 'react';
import type { GapChartPoint, RatePoint } from '@/components/charts';
import { Donate } from '@/components/donate';
import { CitiesSection } from '@/components/cities-section';
import { FilingsSection } from '@/components/filings-section';
import { FxEconometricsSection } from '@/components/fx-econometrics-section';
import { FxSection } from '@/components/fx-section';
import { MacroSection } from '@/components/macro-section';
import { MarketCards } from '@/components/market-cards';
import { PressSection } from '@/components/press-section';
import { SourcesSection } from '@/components/sources-section';
import { Icon } from '@/components/icons';
import { SummaryExplorer } from '@/components/summary-explorer';
import { TodayBoardPanel } from '@/components/today-board';
import type { SummaryFigure } from '@/components/summary-explorer';
import { Tabs } from '@/components/tabs';
import { dailyAnalysis } from '@/lib/daily-analysis';
import { buildTodayBoard } from '@/lib/today-board';
import { packMarketCards } from '@/lib/market-transport';
import {
  isUnaffordableRead,
  officialSeries,
  readCompanyFilings,
  readMarkets,
  readPressPage,
  readGap,
  readMacroAnnual,
  readObservatory,
} from '@/lib/series';
import type {
  CompanyFiling,
  MarketSeries,
  PressArticle,
  DailyPoint,
  GapPoint,
  MacroPoint,
  Observatory,
} from '@/lib/series';

/**
 * The briefing.
 *
 * Written for readers who will check the figures. Two rules shape it. Nothing
 * is stated more precisely than the source supports: where the publisher's own
 * labels do not carry a stable meaning, the page reports them as the publisher
 * writes them instead of translating them into a convention they do not follow.
 * And where a comparison would put two different statistics on the same footing,
 * the page either avoids it or names the basis it used.
 *
 * Everything is a series against time. A table answers "what was the value on
 * that row"; an analyst is asking "where has this been going", and only a line
 * answers that. The numbers behind every line are one click away in both
 * formats, from the same control in the same place on every section.
 *
 * ESTA PÁGINA ES LA PRIMERA PESTAÑA Y NADA MÁS. Fue las siete durante meses, y
 * lo que eso costaba se midió el 2026-09-22 contra `test`: la portada respondía
 * la cabecera al segundo 1 y después la conexión quedaba **muda hasta el
 * segundo 16**, con el informe completo entre los 16 y los 23 s. Ni la red ni el
 * peso lo explicaban —el mismo servidor entrega un megabyte en dos segundos—:
 * era que el servidor esperaba a que las veinte lecturas de las siete pestañas
 * terminaran antes de emitir una línea de contenido, y después serializaba 7,9
 * MB de los que unos 6,3 eran de pestañas que el lector no había abierto.
 *
 * `Tabs` ya dibujaba sólo la pestaña activa **en el navegador**. Ahora las otras
 * seis tampoco se leen en el servidor: cada una pide lo suyo al montarse, que es
 * lo que «Social Info» y «Bolivia ante el mundo» llevaban haciendo desde que se vio
 * que mil quinientas series no caben en una primera pantalla. Aquí quedan las
 * lecturas que el resumen necesita para existir, y de ellas viaja lo que el
 * resumen enseña —el cuadro de mando, el análisis, los contadores— y no el
 * corpus del que salen.
 */

// The exchange rate in force is not a cacheable fact.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PARALLEL_BUY = 'FX_PARALLEL_USD_BOB:BUY';
const PARALLEL_SELL = 'FX_PARALLEL_USD_BOB:SELL';
const UFV = 'UFV_BOB';
const TIME_ZONE = 'America/La_Paz';

const rate = (value: number, decimals = 4): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const percent = (value: number): string =>
  `${value > 0 ? '+' : ''}${value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const longDate = (value: string): string =>
  new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
const instant = (value: string): string =>
  new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  }).format(new Date(value));

interface RateRow extends RatePoint {
  parallelAggregation?: 'POINT_IN_TIME' | 'DAILY_AVERAGE';
  officialAggregation?: 'POINT_IN_TIME' | 'DAILY_AVERAGE';
  officialSide?: string | null;
}

const SIDE_LABEL: Record<string, string> = {
  OFFICIAL: 'tipo de cambio oficial',
  BUY: 'lado «buy»',
  SELL: 'lado «sell»',
};

/** A headline number with the shape of its own history under it. */
function buildRateSeries(buy: DailyPoint[], sell: DailyPoint[], official: DailyPoint[]): RateRow[] {
  const byDate = new Map<string, RateRow>();
  const at = (date: string): RateRow => byDate.get(date) ?? { date };

  for (const point of buy) {
    const row = at(point.date);
    row.parallelBuy = point.value;
    row.parallelAggregation = point.aggregation;
    byDate.set(point.date, row);
  }
  for (const point of sell) {
    const row = at(point.date);
    row.parallelSell = point.value;
    row.parallelAggregation = point.aggregation;
    byDate.set(point.date, row);
  }
  for (const point of official) {
    const row = at(point.date);
    row.official = point.value;
    row.officialAggregation = point.aggregation;
    row.officialSide = point.side;
    byDate.set(point.date, row);
  }

  const rows = [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
  for (const row of rows) {
    row.archived =
      row.parallelAggregation === 'DAILY_AVERAGE' || row.officialAggregation === 'DAILY_AVERAGE';
  }
  return rows;
}

function midpoint(row: RateRow): number | null {
  return typeof row.parallelBuy === 'number' && typeof row.parallelSell === 'number'
    ? (row.parallelBuy + row.parallelSell) / 2
    : null;
}

/**
 * Cuando el resumen no se pudo leer.
 *
 * Va dentro del informe y no en lugar de el. Antes reemplazaba la pagina entera
 * —cabecera, pestañas y todo— porque la pagina ERA el resumen; ahora el resumen
 * es la primera pestaña de siete, y las otras seis leen por su cuenta. Que la
 * lectura del resumen falle no es razon para esconderle al lector los seis
 * capitulos que si se pueden servir, ni para quitarle las pestañas con que
 * llegar a ellos.
 */
function Unreadable() {
  return (
    <div className="error">
      <strong>No fue posible leer la base de datos.</strong>
      <p>
        Este resumen no muestra cifras que no pudo verificar, así que no muestra ninguna. El
        detalle del fallo queda en el registro del servidor; las demás pestañas leen aparte y
        pueden estar al día.
      </p>
    </div>
  );
}

/** El nombre que un lector reconoce, para cada lectura que puede faltar. */
const NOMBRE_DE_SECCION: Record<string, string> = {
  gap: 'brecha cambiaria',
  macro: 'macroeconomía anual',
  filings: 'hechos relevantes',
  pressToday: 'prensa',
  markets: 'mercados',
};

/** Las secciones perdidas en castellano, sin repetir las que comparten nombre. */
function SECCIONES_PERDIDAS(perdidas: ReadonlySet<string>): string {
  const nombres = [...new Set([...perdidas].map((clave) => NOMBRE_DE_SECCION[clave] ?? clave))];
  return nombres.sort((left, right) => left.localeCompare(right, 'es')).join(', ');
}

/**
 * El esqueleto de una pestaña que el servidor todavía está armando.
 *
 * El capítulo del tipo de cambio sigue leyéndose en el servidor —son pruebas
 * formales sobre las mismas series que el resumen ya tiene, y hacerlas aquí
 * evita mandarlas dos veces— pero ya no retiene la página: va detrás de un
 * `Suspense`, así que la primera pantalla se emite en cuanto el resumen está y
 * el capítulo llega detrás, por el mismo flujo, sin una petición más.
 */
function Armando({ que }: { que: string }) {
  return <div className="callout">Armando {que}…</div>;
}

async function TodaySection() {
  let observatory: Observatory;
  let gap: GapPoint[];
  let macro: MacroPoint[];
  let filings: CompanyFiling[];
  let pressToday: PressArticle[];
  let markets: MarketSeries[];
  /*
   * Las secciones que no llegan se cuentan, para no publicar su ausencia como
   * un cero. «Macro anuales: 0» y «Macro anuales: no se pudo leer» dicen cosas
   * opuestas, y la primera es falsa: hay nueve mil filas ahi.
   */
  const perdidas = new Set<string>();

  /**
   * Una lectura que puede faltar sin llevarse el informe.
   *
   * Solo se perdona lo que el servidor no termino de leer — el plazo agotado,
   * el sitio que la ordenacion necesitaba. Cualquier otro fallo sigue tumbando
   * la pagina entera, que es lo correcto cuando lo que falla es la conexion y
   * no una vista cara: un informe que se dibuja a medias sin saber por que no
   * es un informe degradado, es uno que miente.
   */
  async function seccion<T>(nombre: string, read: () => Promise<T>, vacio: T): Promise<T> {
    try {
      return await read();
    } catch (error) {
      if (!isUnaffordableRead(error)) throw error;
      // El codigo va al registro; el mensaje puede llevar el host y el rol.
      console.warn(
        `[observatorio] seccion sin leer: ${nombre} (${(error as { code?: string }).code})`,
      );
      perdidas.add(nombre);
      return vacio;
    }
  }

  try {
    /*
     * El tipo de cambio no se perdona: sin el no hay fecha sobre la que
     * construir la portada ni cifra que publicar, y una pagina sin eso no es
     * una pagina degradada, es una vacia.
     *
     * LA BRECHA SI SE PERDONA, y aprendimos por que. Estaba aqui, sin colador,
     * con el argumento de que era la espina del informe. El 2026-09-21 su
     * consulta empezo a agotar el plazo en el servidor mas flojo de los dos
     * —solo en ese; en el otro la misma consulta devuelve sus setecientas
     * noventa filas— y el resultado fue que el tablero publico entero
     * desaparecio detras de «no fue posible leer la base de datos»: sin macro,
     * sin prensa, sin empresas, sin ciudades. Trece lectores sanos borrados por
     * uno agotado.
     *
     * Una seccion cara no puede llevarse las baratas. La brecha que falta se
     * anuncia arriba como lo que es, y el resto del informe se sirve.
     */
    observatory = await readObservatory();
    gap = await seccion('gap', readGap, []);

    /*
     * Las cuatro que el resumen necesita para existir, y ninguna más.
     *
     * Eran once. Las otras siete —fuentes, el cubo de prensa, su pulso, los dos
     * recuentos de temas, las familias de lugares y el panel empaquetado— sólo
     * alimentaban pestañas que esta página ya no dibuja, y cada una era una
     * consulta en el camino crítico del primer pintado. Ahora las pide la
     * pestaña que las enseña, cuando alguien la abre.
     *
     * De estas cuatro no viaja el corpus: macro y los hechos relevantes se leen
     * para fechar el cuadro de mando y citar el comunicado del día, y lo que
     * llega al navegador son esas conclusiones. La lectura queda sostenida cinco
     * minutos, así que cuando el lector abre «Macroeconomía» o «Empresas» su
     * petición la encuentra hecha en vez de volver a la base.
     */
    [macro, filings, pressToday, markets] = await Promise.all([
      seccion('macro', readMacroAnnual, []),
      seccion('filings', () => readCompanyFilings(), []),
      /*
       * El archivo sin filtrar por tema, para el cuadro de mando.
       *
       * La pestaña de prensa lee lo mismo dejando fuera `OTROS`, que es lo
       * correcto para un capítulo de prensa económica y lo contrario de lo que
       * necesita la portada: un bloqueo de caminos o una medida de combustible
       * entran por ahí, y son exactamente las novedades que un inversor externo
       * busca. El limite alcanza para los ultimos dias con holgura, que es lo
       * unico que el tablero mira.
       */
      seccion('pressToday', () => readPressPage({}, 120).then((page) => page.articles), []),
      seccion('markets', readMarkets, []),
    ]);
  } catch (error) {
    // The message can carry the host, the user and the port. It belongs in the
    // log, not in a page served to the public.
    console.error('[observatorio] lectura fallida', error);
    return <Unreadable />;
  }

  /** Un recuento, o el hecho de que no se pudo contar. Nunca un cero prestado. */
  const contar = (nombre: string, valores: readonly unknown[]): string =>
    perdidas.has(nombre) ? 'sin leer' : valores.length.toLocaleString('es-BO');

  const buy = observatory.series.get(PARALLEL_BUY) ?? [];
  const sell = observatory.series.get(PARALLEL_SELL) ?? [];
  const official = officialSeries(observatory);
  const ufv = observatory.series.get(UFV) ?? [];

  const officialIsCharteable = official.length >= 2;
  const rows = buildRateSeries(buy, sell, officialIsCharteable ? official : []);
  const latest = rows.at(-1);
  const latestMid = latest ? midpoint(latest) : null;

  const lastOfficial = official.at(-1);
  const lastUfv = ufv.at(-1);
  const lastGap = gap.at(-1);
  const peakGap = gap.reduce<GapPoint | null>(
    (best, point) => (!best || point.gapPercent > best.gapPercent ? point : best),
    null,
  );

  const gapSeries: GapChartPoint[] = gap.map((point) => ({
    date: point.date,
    gapPercent: point.gapPercent,
  }));

  /** Enough of the tail to show direction without redrawing the whole year. */
  const tail = <T,>(values: T[], count = 90): T[] => values.slice(-count);
  const midSpark = tail(rows)
    .map((row) => midpoint(row))
    .filter((value): value is number => value !== null);

  const summaryFigures: SummaryFigure[] = [
    ...(lastOfficial
      ? [
          {
            label: 'Oficial',
            value: rate(lastOfficial.value, 2),
            unit: 'Bs/USD',
            meta: SIDE_LABEL[lastOfficial.side ?? ''] ?? 'lado publicado',
            spark: tail(official).map((point) => point.value),
            tone: 'var(--official)',
            icon: 'banco' as const,
          },
        ]
      : []),
    ...(latestMid !== null
      ? [
          {
            label: 'Paralelo (punto medio)',
            value: rate(latestMid),
            unit: 'Bs/USD',
            spark: midSpark,
            tone: 'var(--parallel)',
            icon: 'monedas' as const,
          },
        ]
      : []),
    ...(lastGap
      ? [
          {
            label: 'Brecha cambiaria',
            value: percent(lastGap.gapPercent),
            meta: `al ${lastGap.date}`,
            spark: tail(gap).map((point) => point.gapPercent),
            tone: 'var(--gap)',
            icon: 'balanza' as const,
          },
        ]
      : []),
    ...(peakGap && lastGap && peakGap.date !== lastGap.date
      ? [
          {
            label: 'Máximo histórico',
            value: percent(peakGap.gapPercent),
            meta: `el ${peakGap.date}`,
            icon: 'tendencia' as const,
          },
        ]
      : []),
    ...(lastUfv
      ? [
          {
            label: 'UFV',
            value: rate(lastUfv.value, 5),
            unit: 'Bs/UFV',
            meta: lastUfv.date,
            icon: 'etiqueta' as const,
          },
        ]
      : []),
  ];

  /*
   * El año contra el que se mide la edad de cada dato macro.
   *
   * Se toma en La Paz y no en el reloj del servidor, que corre en UTC: entre
   * las 20:00 y la medianoche boliviana los dos no coinciden, y el 31 de
   * diciembre esa diferencia envejece de golpe cada cifra del tablero.
   */
  const currentYear = Number(
    new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: TIME_ZONE }).format(new Date()),
  );

  const board = buildTodayBoard({ macro, gap, press: pressToday, currentYear });

  /*
   * Lo que el analisis dice cuando no hay brecha, y por que aqui no vale.
   *
   * Sin brecha, `dailyAnalysis` publica una sola viñeta: «ninguna jornada tiene
   * cotizacion oficial y de mercado a la vez». Eso es cierto cuando la serie
   * esta vacia de verdad y es FALSO cuando la consulta se agoto — hay
   * setecientas noventa jornadas con las dos cotizaciones, y el informe estaria
   * afirmando lo contrario con la misma cara con que afirma lo que sabe.
   *
   * Asi que esa viñeta se retira cuando la ausencia es un fallo de lectura. El
   * aviso de arriba ya nombra la seccion perdida, que es lo unico que aqui se
   * puede sostener.
   */
  const analysisInput = dailyAnalysis({
    latestDate: observatory.latestDate,
    gap,
    parallelBuy: buy,
    parallelSell: sell,
    official,
    ufv,
    filings,
    macro,
  });

  const analysis = perdidas.has('gap')
    ? {
        ...analysisInput,
        bullets: analysisInput.bullets.filter((bullet) => bullet.key !== 'sin-brecha'),
      }
    : analysisInput;

  return (
    <>
      {/*
        Una seccion que falta se dice, no se disimula. Sin este aviso un
        explorador vacio se lee como «no hay nada cargado», que es justo lo
        contrario de lo que pasa: hay datos y el servidor no termino de leerlos.
        Van los nombres de las secciones y nada mas — ni el codigo, ni el host,
        ni el rol —, que es lo que puede publicarse en una direccion abierta.

        Va dentro del resumen y ya no sobre las pestañas, porque solo nombra lo
        que el resumen lee. Las que se piden al abrirse avisan cada una en su
        sitio, que es donde el lector esta mirando cuando se entera.
      */}
      {perdidas.size > 0 ? (
        <div className="callout">
          No se pudieron leer a tiempo estas secciones: {SECCIONES_PERDIDAS(perdidas)}. El resto del
          informe es correcto y esta al dia; lo que falta volvera cuando la consulta que lo arma
          deje de agotar su plazo.
        </div>
      ) : null}

      <SummaryExplorer
        gap={gapSeries}
        gapUnread={perdidas.has('gap')}
        figures={summaryFigures}
        coverage={[
          {
            label: 'Series diarias',
            count: observatory.readingCount.toLocaleString('es-BO'),
            icon: 'linea',
          },
          {
            label: 'Macro anuales',
            count: contar('macro', macro),
            icon: 'globo',
          },
          {
            label: 'Hechos relevantes',
            count: contar('filings', filings),
            icon: 'edificio',
          },
          {
            label: 'Días con brecha',
            count: contar('gap', gap),
            icon: 'balanza',
          },
        ]}
        analysis={analysis.bullets}
        latestDate={observatory.latestDate}
        markets={<MarketCards markets={packMarketCards(markets)} />}
        board={<TodayBoardPanel board={board} />}
      />
    </>
  );
}

/**
 * La fecha del dato mas reciente, en la cabecera.
 *
 * Aparte del resto de la cabecera a proposito, y es el detalle que decide si la
 * pagina se ve en un segundo o en dieciseis. El nombre, el rotulo y las siete
 * pestañas no dependen de ninguna lectura; esta linea si, y mientras estuvo en
 * el mismo componente que ellos los retenia a todos: la cabecera no podia
 * emitirse hasta que el observatorio hubiera contestado. Medido contra Contabo
 * con la memoria vencida, eso eran quince segundos de pagina en blanco por una
 * frase.
 *
 * Detras de su propio `Suspense`, la cabecera y las pestañas salen enseguida y
 * la fecha llega cuando el observatorio contesta. La lectura esta sostenida
 * cinco minutos y el resumen pide la misma, asi que no es una consulta mas.
 *
 * Si no se puede leer, dice «Sin datos» y no se lleva la cabecera: un `Suspense`
 * atrapa una espera, no un fallo, asi que lo que aqui no se recoja tumbaria la
 * pagina entera por una frase de fecha.
 */
async function Stamp() {
  let observatory: Observatory;
  try {
    observatory = await readObservatory();
  } catch (error) {
    // The message can carry the host, the user and the port. It belongs in the
    // log, not in a page served to the public.
    console.error('[observatorio] fecha de cabecera sin leer', error);
    return <span>Sin datos</span>;
  }

  return (
    <span>
      {observatory.latestDate ? `Datos al ${longDate(observatory.latestDate)}` : 'Sin datos'}
      {observatory.lastReceivedAt ? ` · carga ${instant(observatory.lastReceivedAt)}` : ''}
    </span>
  );
}

/**
 * El informe: una cabecera, siete pestañas y ni una lectura.
 *
 * No lee nada, y eso es el arreglo. Mientras esta funcion era el resumen, el
 * servidor no emitia una linea de contenido hasta tener todas sus consultas
 * hechas: contra Contabo con la memoria vencida eso median dieciseis segundos
 * con la conexion muda, y el lector no tenia ni las pestañas con que irse a otro
 * capitulo mientras esperaba. Ahora la cabecera y la lista de pestañas salen con
 * el primer byte —medido en 0,9 s en el servidor lento— y cada capitulo llega
 * cuando lo suyo esta: el resumen y el tipo de cambio por el mismo flujo, detras
 * de un `Suspense`; los otros cinco pidiendo su direccion al abrirse.
 */
export default function Page() {
  return (
    <main>
      {/* The pane holds a hundred controls; this is the way past them. */}
      <a className="skip-link" href="#tablero">
        Saltar los filtros e ir al tablero
      </a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="barras" size={19} />
          </span>
          <div>
            <h1>Observatorio Económico de Bolivia</h1>
            <div className="dateline">Situación económica y de los mercados</div>
          </div>
        </div>
        <div className="topbar-stamp">
          <Icon name="reloj" size={14} />
          <Suspense fallback={<span>Leyendo la fecha del último dato…</span>}>
            <Stamp />
          </Suspense>
        </div>
        <Donate />
      </header>

      <Tabs
        labels={[
          'Hoy',
          'Tipo de cambio',
          'Macroeconomía',
          'Empresas',
          'Ciudades',
          'Prensa',
          'Método',
        ]}
        icons={['diana', 'linea', 'globo', 'edificio', 'mapa', 'ventana', 'info']}
      >
        <section className="stack">
          <Suspense fallback={<Armando que="el resumen de hoy" />}>
            <TodaySection />
          </Suspense>
        </section>

        <section className="stack">
          {/*
            Las pruebas formales van después de la lectura y de los gráficos, y
            se montan aparte a propósito: el capítulo del tipo de cambio lee sus
            series y las dibuja; este lee las mismas series y las somete a
            prueba. Dos preguntas, dos componentes.
          */}
          <Suspense fallback={<Armando que="el capítulo del tipo de cambio" />}>
            <FxSection />
          </Suspense>
          <Suspense fallback={<Armando que="las pruebas del tipo de cambio" />}>
            <FxEconometricsSection />
          </Suspense>
        </section>

        <section className="stack">
          <MacroSection />
        </section>

        <section className="stack">
          <FilingsSection />
        </section>

        <section className="stack">
          <CitiesSection />
        </section>

        <section className="stack">
          <PressSection />
        </section>

        <section className="stack">
          <SourcesSection />
        </section>
      </Tabs>
    </main>
  );
}

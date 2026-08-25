import type { GapChartPoint, RatePoint } from '@/components/charts';
import { Download } from '@/components/download';
import { FilingExplorer } from '@/components/filing-explorer';
import { FxExplorer } from '@/components/fx-explorer';
import { MacroExplorer } from '@/components/macro-explorer';
import { MarketCards } from '@/components/market-cards';
import { PressExplorer } from '@/components/press-explorer';
import { Icon } from '@/components/icons';
import { SummaryExplorer } from '@/components/summary-explorer';
import type { SummaryFigure } from '@/components/summary-explorer';
import { Tabs } from '@/components/tabs';
import { dailyAnalysis } from '@/lib/daily-analysis';
import type { Observation } from '@/lib/econometrics';
import {
  officialSeries,
  readCompanyFilings,
  readMarkets,
  readPressArticles,
  readPressTerms,
  readGap,
  readMacroAnnual,
  readObservatory,
  readSources,
} from '@/lib/series';
import type {
  CompanyFiling,
  MarketSeries,
  PressArticle,
  TermMention,
  DailyPoint,
  GapPoint,
  MacroPoint,
  Observatory,
  SourceNote,
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

/** One statistic, stated with the unit it is measured in. */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  );
}

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
 * The date on which the ordering of the two published sides reverses.
 *
 * A bid and an ask cannot swap places. That this happens in the series is the
 * evidence that the two fields do not carry the meaning a Spanish
 * «compra/venta» pair would.
 */
function sideOrderReversal(rows: RateRow[]): string | null {
  let previous: boolean | null = null;
  for (const row of rows) {
    if (typeof row.parallelBuy !== 'number' || typeof row.parallelSell !== 'number') continue;
    const buyAbove = row.parallelBuy > row.parallelSell;
    if (previous !== null && buyAbove !== previous) return row.date;
    previous = buyAbove;
  }
  return null;
}

/** Latest published year of each indicator, which is not the same for all. */
function latestByIndicator(points: MacroPoint[]): MacroPoint[] {
  const latest = new Map<string, MacroPoint>();
  for (const point of points) {
    const current = latest.get(point.indicatorCode);
    if (!current || point.period > current.period) latest.set(point.indicatorCode, point);
  }
  return [...latest.values()].sort((left, right) =>
    (left.name ?? left.indicatorCode).localeCompare(right.name ?? right.indicatorCode),
  );
}

/**
 * Filings as a time line rather than a grid.
 *
 * What matters about a filing is when it landed relative to the others, which a
 * row in a table hides and a spine down the page makes obvious.
 */
function SourceList({ sources }: { sources: SourceNote[] }) {
  return (
    <ul className="sources">
      {sources.map((source) => (
        <li key={`${source.indicator}-${source.sourceUrl}`}>
          <code>{source.indicator}</code>
          <span>{source.publisher}</span>
          <span className="src-span">
            {source.firstDay} → {source.lastDay} · {source.readings.toLocaleString('es-BO')}{' '}
            lecturas
          </span>
          <a href={source.sourceUrl} target="_blank" rel="noreferrer noopener">
            abrir
          </a>
        </li>
      ))}
    </ul>
  );
}

function Unreadable() {
  return (
    <main>
      <div className="masthead">
        <h1>Observatorio económico de Bolivia</h1>
      </div>
      <div className="error">
        <strong>No fue posible leer la base de datos.</strong>
        <p>
          Esta página no muestra cifras que no pudo verificar, así que no muestra ninguna. El
          detalle del fallo queda en el registro del servidor.
        </p>
      </div>
    </main>
  );
}

export default async function Page() {
  let observatory: Observatory;
  let gap: GapPoint[];
  let sources: SourceNote[];
  let macro: MacroPoint[];
  let filings: CompanyFiling[];
  let press: PressArticle[];
  let markets: MarketSeries[];
  let pressTerms: TermMention[];
  try {
    [observatory, gap, sources, macro, filings, press, markets, pressTerms] = await Promise.all([
      readObservatory(),
      readGap(),
      readSources(),
      readMacroAnnual(),
      readCompanyFilings(),
      readPressArticles(),
      readMarkets(),
      readPressTerms(),
    ]);
  } catch (error) {
    // The message can carry the host, the user and the port. It belongs in the
    // log, not in a page served to the public.
    console.error('[observatorio] lectura fallida', error);
    return <Unreadable />;
  }

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

  const reversal = sideOrderReversal(rows);
  const gapSeries: GapChartPoint[] = gap.map((point) => ({
    date: point.date,
    gapPercent: point.gapPercent,
  }));

  /** The official series in the shape the exchange-rate explorer measures on. */
  const officialObservations: Observation[] = official.map((point) => ({
    date: point.date,
    value: point.value,
    aggregation: point.aggregation,
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

  const analysis = dailyAnalysis({
    latestDate: observatory.latestDate,
    gap,
    parallelBuy: buy,
    parallelSell: sell,
    official,
    ufv,
    filings,
    macro,
  });

  return (
    <main>
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
          <span>
            {observatory.latestDate ? `Datos al ${longDate(observatory.latestDate)}` : 'Sin datos'}
            {observatory.lastReceivedAt ? ` · carga ${instant(observatory.lastReceivedAt)}` : ''}
          </span>
        </div>
      </header>

      <Tabs
        labels={['Resumen', 'Tipo de cambio', 'Macroeconomía', 'Empresas', 'Prensa', 'Método']}
        icons={['diana', 'linea', 'globo', 'edificio', 'ventana', 'info']}
      >
        <section className="stack">
          <SummaryExplorer
            gap={gapSeries}
            figures={summaryFigures}
            coverage={[
              {
                label: 'Series diarias',
                count: observatory.readingCount.toLocaleString('es-BO'),
                icon: 'linea',
              },
              {
                label: 'Macro anuales',
                count: macro.length.toLocaleString('es-BO'),
                icon: 'globo',
              },
              {
                label: 'Hechos relevantes',
                count: filings.length.toLocaleString('es-BO'),
                icon: 'edificio',
              },
              {
                label: 'Días con brecha',
                count: gap.length.toLocaleString('es-BO'),
                icon: 'balanza',
              },
            ]}
            analysis={analysis.lines}
            latestDate={observatory.latestDate}
            markets={<MarketCards markets={markets} />}
          />
        </section>

        <section className="stack">
          <FxExplorer
            rows={rows}
            official={officialObservations}
            readingCount={observatory.readingCount}
          />
        </section>

        <section className="stack">
          <MacroExplorer points={macro} />
        </section>

        <section className="stack">
          {filings.length ? (
            <FilingExplorer filings={filings} />
          ) : (
            <div className="callout">Todavía no hay hechos relevantes cargados.</div>
          )}
        </section>

        <section className="stack">
          {press.length ? (
            <PressExplorer articles={press} terms={pressTerms} />
          ) : (
            <div className="callout">Todavía no hay cobertura de prensa cargada.</div>
          )}
        </section>

        <section className="stack notes">
          <div className="panel-head">
            <h2>Fuentes</h2>
          </div>
          <SourceList sources={sources} />

          <h2 className="section-gap">Notas metodológicas</h2>
          <dl>
            <dt>Los dos lados del paralelo no son una horquilla compra/venta</dt>
            <dd>
              La fuente publica dos valores por día bajo las etiquetas <code>buy</code> y{' '}
              <code>sell</code>.
              {reversal ? (
                <>
                  {' '}
                  Su orden <strong>se invierte el {reversal}</strong>: antes de esa fecha uno es
                  sistemáticamente mayor y después el otro. Una horquilla de compra y venta no puede
                  intercambiarse, así que estas etiquetas no corresponden a la convención boliviana.
                </>
              ) : (
                ' Se reportan tal como las publica la fuente.'
              )}{' '}
              Por eso el informe no las traduce, encabeza con el <strong>punto medio</strong> —que
              no depende de esa distinción— y mide la brecha contra él.
            </dd>

            <dt>El oficial sí es consistente</dt>
            <dd>
              En el tipo de cambio oficial el lado «sell» es mayor o igual al «buy» en toda la
              serie. Cuando existe el valor único que publica el Banco Central, el informe usa ese;
              si no, el lado «sell», que es lo que paga quien adquiere dólares.
            </dd>

            <dt>Valor del día</dt>
            <dd>
              Cuando varias plazas cotizan el mismo día, el valor publicado es la{' '}
              <strong>mediana discreta</strong>: resiste que una plaza se desvíe y devuelve un
              precio efectivamente cotizado en lugar de un valor intermedio que nadie ofreció.
            </dd>

            <dt>Promedio diario frente a lectura puntual</dt>
            <dd>
              La serie anterior al inicio de la recolección diaria es un{' '}
              <strong>promedio diario</strong> de las cotizaciones intradía; desde que el recolector
              opera, cada lectura es el precio <strong>en el momento</strong> de la consulta. Son
              estadísticos distintos y no se promedian entre sí.
            </dd>

            <dt>Frecuencias separadas</dt>
            <dd>
              Una cifra anual y un precio cotizado a diario viven en modelos de lectura distintos,
              de modo que ningún gráfico puede ponerlas en el mismo eje ni promediarlas.
            </dd>

            <dt>Trazabilidad y sus límites</dt>
            <dd>
              Cada lectura cita su fuente y conserva el hash del documento del que se obtuvo. En la
              serie histórica del <strong>oficial</strong> y en los hechos relevantes, la cita es el
              fragmento literal del que se leyó el dato. En la del <strong>paralelo</strong>,
              cargada antes de esa mejora, es una reformulación de los valores y no un extracto
              literal: sigue siendo trazable hasta el documento y su hash, pero no al nivel de la
              cita.
            </dd>
          </dl>

          <p className="panel-sub section-gap">
            {observatory.readingCount.toLocaleString('es-BO')} puntos de serie leídos del núcleo del
            observatorio.
          </p>
        </section>
      </Tabs>
    </main>
  );
}

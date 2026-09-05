import type { GapChartPoint, RatePoint } from '@/components/charts';
import { Download } from '@/components/download';
import { Donate } from '@/components/donate';
import { FilingExplorer } from '@/components/filing-explorer';
import { FxExplorer } from '@/components/fx-explorer';
import { MacroExplorer } from '@/components/macro-explorer';
import { MarketCards } from '@/components/market-cards';

import { PanelExplorer } from '@/components/panel-explorer';
import { PressExplorer } from '@/components/press-explorer';
import { SourcesExplorer } from '@/components/sources-explorer';
import { SubjectsExplorer } from '@/components/subjects-explorer';
import { SubTabs } from '@/components/tabs';
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
  readPressCube,
  readPressPage,
  readPressPulse,
  readGap,
  readMacroAnnual,
  readObservatory,
  readSources,
  readTermMonths,
  readTermTotals,
  readPanelCatalogue,
} from '@/lib/series';
import type {
  CompanyFiling,
  MarketSeries,
  PressArticle,
  PressPulseData,
  PressCube,
  DailyPoint,
  GapPoint,
  MacroPoint,
  Observatory,
  SourceNote,
  TermMonth,
  TermTotal,
  PanelIndicator,
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
  let pressCube: PressCube;
  let pressPulse: PressPulseData;
  let termMonths: TermMonth[];
  let termTotals: TermTotal[];
  let panelCatalogue: PanelIndicator[];
  try {
    [
      observatory,
      gap,
      sources,
      macro,
      filings,
      press,
      markets,
      pressCube,
      pressPulse,
      termMonths,
      termTotals,
      panelCatalogue,
    ] = await Promise.all([
      readObservatory(),
      readGap(),
      readSources(),
      readMacroAnnual(),
      readCompanyFilings(),
      readPressPage({ topic: 'ECONOMICOS' }, 60).then((page) => page.articles),
      readMarkets(),
      readPressCube(),
      readPressPulse(),
      readTermMonths(),
      readTermTotals(),
      readPanelCatalogue(),
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
          <span>
            {observatory.latestDate ? `Datos al ${longDate(observatory.latestDate)}` : 'Sin datos'}
            {observatory.lastReceivedAt ? ` · carga ${instant(observatory.lastReceivedAt)}` : ''}
          </span>
        </div>
        <Donate />
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
            analysis={analysis.bullets}
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
          <SubTabs labels={['Series de Bolivia', 'Panel mundial']} icons={['linea', 'globo']}>
            <MacroExplorer points={macro} />
            <PanelExplorer catalogue={panelCatalogue} />
          </SubTabs>
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
            // Two readings of one archive: the notes themselves, and what the
            // country talked about in them, month by month.
            <SubTabs labels={['Cobertura', 'Temas']} icons={['ventana', 'etiqueta']}>
              <PressExplorer
                cube={pressCube}
                initialArticles={press}
                span={{
                  total: pressPulse.total,
                  outlets: pressPulse.outlets,
                  firstDay: pressPulse.firstDay,
                  lastDay: pressPulse.lastDay,
                  unmarked: pressPulse.unmarked,
                }}
              />
              <SubjectsExplorer months={termMonths} totals={termTotals} />
            </SubTabs>
          ) : (
            <div className="callout">Todavía no hay cobertura de prensa cargada.</div>
          )}
        </section>

        <section className="stack">
          <SourcesExplorer
            sources={sources}
            readingCount={observatory.readingCount}
            reversal={reversal}
          />
        </section>
      </Tabs>
    </main>
  );
}

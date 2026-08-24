import { GapChart, RateChart, SpreadChart } from '@/components/charts';
import type { GapChartPoint, RatePoint, SpreadPoint } from '@/components/charts';
import {
  officialSeries,
  readGap,
  readMacroAnnual,
  readObservatory,
  readSources,
} from '@/lib/series';
import type { DailyPoint, GapPoint, MacroPoint, Observatory, SourceNote } from '@/lib/series';

/**
 * The briefing.
 *
 * Written for readers who will check the figures. Two rules shape it. Nothing
 * is stated more precisely than the source supports: where the publisher's own
 * labels do not carry a stable meaning, the page reports them as the publisher
 * writes them instead of translating them into a convention they do not follow.
 * And where a comparison would put two different statistics on the same footing,
 * the page either avoids it or names the basis it used.
 */

// The exchange rate in force is not a cacheable fact.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PARALLEL_BUY = 'FX_PARALLEL_USD_BOB:BUY';
const PARALLEL_SELL = 'FX_PARALLEL_USD_BOB:SELL';
const UFV = 'UFV_BOB';

/** Every timestamp is stated in the country the figures describe. */
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

const SIDE_LABEL: Record<string, string> = {
  OFFICIAL: 'tipo de cambio oficial',
  BUY: 'lado «buy»',
  SELL: 'lado «sell»',
};

function Figure({
  label,
  value,
  unit,
  meta,
  delta,
}: {
  label: string;
  value: string;
  unit?: string;
  meta?: string;
  delta?: number | null;
}) {
  return (
    <div className="figure">
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      {typeof delta === 'number' ? (
        <div className={`meta ${delta >= 0 ? 'delta-up' : 'delta-down'}`}>
          {percent(delta)} frente al día anterior
        </div>
      ) : null}
      {meta ? <div className="meta">{meta}</div> : null}
    </div>
  );
}

interface RateRow extends RatePoint {
  parallelAggregation?: 'POINT_IN_TIME' | 'DAILY_AVERAGE';
  officialAggregation?: 'POINT_IN_TIME' | 'DAILY_AVERAGE';
  officialSide?: string | null;
}

/**
 * Aligns the series on a single date axis without inventing missing days.
 *
 * Each series keeps its own aggregation on the row. A day where the parallel
 * rate was observed and the official one came from the archive is not "an
 * averaged day", and labelling the whole row from whichever series happened to
 * be archived would say exactly that.
 */
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
    // The chart only needs to know whether anything on the row is archived, to
    // say so in its tooltip; the table reports each series separately.
    row.archived =
      row.parallelAggregation === 'DAILY_AVERAGE' || row.officialAggregation === 'DAILY_AVERAGE';
  }
  return rows;
}

/** Mid-point of the two published sides, which their labelling cannot distort. */
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
 * «compra/venta» pair would, and the reader is told rather than left to
 * discover it.
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

/**
 * Change over the archived stretch of the series.
 *
 * Measured on the mid-point and only between two points of the same
 * aggregation: comparing a day averaged after the fact with a price read at a
 * moment would be the very splice the rest of the page refuses to make.
 */
function archivedSpan(rows: RateRow[]): { from: RateRow; to: RateRow; change: number } | null {
  const archived = rows.filter(
    (row) => row.parallelAggregation === 'DAILY_AVERAGE' && midpoint(row) !== null,
  );
  const from = archived[0];
  const to = archived.at(-1);
  if (!from || !to || from === to) return null;
  const start = midpoint(from);
  const end = midpoint(to);
  if (start === null || end === null || start === 0) return null;
  return { from, to, change: ((end - start) / start) * 100 };
}

function SourceTable({ sources }: { sources: SourceNote[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Indicador</th>
            <th>Editor</th>
            <th className="num">Lecturas</th>
            <th>Cobertura</th>
            <th>Fuente</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={`${source.indicator}-${source.sourceUrl}`}>
              <td>
                <code>{source.indicator}</code>
              </td>
              <td>{source.publisher}</td>
              <td className="num">{source.readings.toLocaleString('es-BO')}</td>
              <td>
                {source.firstDay} → {source.lastDay}
              </td>
              <td>
                <a href={source.sourceUrl} target="_blank" rel="noreferrer noopener">
                  abrir
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const measurement = (value: RateRow['parallelAggregation']): string =>
  value === 'DAILY_AVERAGE' ? 'promedio' : value === 'POINT_IN_TIME' ? 'puntual' : '—';

function RecentTable({ rows }: { rows: RateRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th className="num">Paralelo buy</th>
            <th className="num">Paralelo sell</th>
            <th className="num">Punto medio</th>
            <th>Medición paralelo</th>
            <th className="num">Oficial</th>
            <th>Medición oficial</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const mid = midpoint(row);
            return (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td className="num">
                  {typeof row.parallelBuy === 'number' ? rate(row.parallelBuy) : '—'}
                </td>
                <td className="num">
                  {typeof row.parallelSell === 'number' ? rate(row.parallelSell) : '—'}
                </td>
                <td className="num">{mid === null ? '—' : rate(mid)}</td>
                <td>{measurement(row.parallelAggregation)}</td>
                <td className="num">
                  {typeof row.official === 'number' ? rate(row.official, 2) : '—'}
                </td>
                <td>{measurement(row.officialAggregation)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const UNIT_LABEL: Record<string, string> = {
  PERCENT: '%',
  PERCENT_OF_GDP: '% del PIB',
  USD: 'USD',
};

/**
 * Formats a macroeconomic figure at the scale a reader thinks in.
 *
 * Reserves of 579,906,699.89 dollars are read as 580 million; printing every
 * digit implies a precision the annual estimate does not carry.
 */
function macroValue(point: MacroPoint): string {
  if (point.unit !== 'USD') {
    return point.value.toLocaleString('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  const billions = point.value / 1_000_000_000;
  if (Math.abs(billions) >= 1) {
    return `${billions.toLocaleString('es-BO', { maximumFractionDigits: 2 })} mil M`;
  }
  return `${(point.value / 1_000_000).toLocaleString('es-BO', { maximumFractionDigits: 0 })} M`;
}

/** Latest published year of each indicator, which is not the same year for all. */
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

function MacroTable({ points }: { points: MacroPoint[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Indicador</th>
            <th>Periodo</th>
            <th className="num">Valor</th>
            <th>Unidad</th>
            <th className="num">Variación anual</th>
            <th>Fuente</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.indicatorCode}>
              <td>{point.name ?? point.indicatorCode}</td>
              <td>{point.period}</td>
              <td className="num">{macroValue(point)}</td>
              <td>{UNIT_LABEL[point.unit] ?? point.unit}</td>
              <td
                className={`num ${point.changePercent === null ? '' : point.changePercent >= 0 ? 'delta-up' : 'delta-down'}`}
              >
                {point.changePercent === null ? '—' : percent(point.changePercent)}
              </td>
              <td>
                {point.sourceUrl ? (
                  <a href={point.sourceUrl} target="_blank" rel="noreferrer noopener">
                    abrir
                  </a>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  try {
    [observatory, gap, sources, macro] = await Promise.all([
      readObservatory(),
      readGap(),
      readSources(),
      readMacroAnnual(),
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

  // A single point cannot be drawn as a line.
  const officialIsCharteable = official.length >= 2;
  const rows = buildRateSeries(buy, sell, officialIsCharteable ? official : []);
  const recent = [...rows].reverse().slice(0, 14);
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
  const span = archivedSpan(rows);

  const gapSeries: GapChartPoint[] = gap.map((point) => ({
    date: point.date,
    gapPercent: point.gapPercent,
  }));

  const spreadSeries: SpreadPoint[] = sell
    .filter((point) => typeof point.spread === 'number' && (point.venues ?? 0) > 1)
    .map((point) => ({
      date: point.date,
      spread: point.spread ?? 0,
      venues: point.venues,
    }));

  return (
    <main>
      <header className="masthead">
        <div className="dateline">
          {observatory.latestDate ? `Datos al ${longDate(observatory.latestDate)}` : 'Sin datos'}
          {observatory.lastReceivedAt
            ? ` · última carga ${instant(observatory.lastReceivedAt)} (hora de Bolivia)`
            : ''}
        </div>
        <h1>Tipo de cambio y brecha cambiaria en Bolivia</h1>
        <p>
          Seguimiento diario del dólar paralelo y del tipo de cambio oficial. Cada cifra procede de
          una fuente registrada, con la evidencia conservada y verificable. Las series diarias, la
          mediana entre plazas y la brecha las publica el núcleo del observatorio; lo que esta
          página calcula por su cuenta —el punto medio y la variación del periodo— queda dicho donde
          aparece.
        </p>
      </header>

      <section>
        <div className="figures">
          {lastOfficial ? (
            <Figure
              label="Oficial"
              value={rate(lastOfficial.value, 2)}
              unit="Bs/USD"
              meta={`${SIDE_LABEL[lastOfficial.side ?? ''] ?? 'lado publicado'} · ${lastOfficial.date}`}
            />
          ) : null}
          {latestMid !== null && latest ? (
            <Figure
              label="Paralelo (punto medio)"
              value={rate(latestMid)}
              unit="Bs/USD"
              meta={`entre ${rate(latest.parallelBuy ?? 0)} y ${rate(latest.parallelSell ?? 0)} · ${latest.date}`}
            />
          ) : null}
          {lastGap ? (
            <Figure
              label="Brecha cambiaria"
              value={percent(lastGap.gapPercent)}
              meta={`al ${lastGap.date} · punto medio ${rate(lastGap.parallelMid, 2)} frente a oficial ${rate(lastGap.official, 2)}`}
            />
          ) : null}
          {peakGap && lastGap && peakGap.date !== lastGap.date ? (
            <Figure
              label="Máximo de la brecha"
              value={percent(peakGap.gapPercent)}
              meta={`el ${peakGap.date}`}
            />
          ) : null}
          {lastUfv ? (
            <Figure label="UFV" value={rate(lastUfv.value, 5)} unit="Bs/UFV" meta={lastUfv.date} />
          ) : null}
        </div>
      </section>

      <section>
        <h2>Evolución del tipo de cambio</h2>
        <p className="lede">
          Bolivianos por dólar. El eje no arranca en cero: en una cotización, la escala completa
          aplanaría movimientos que son grandes en términos económicos.
          {span
            ? ` Sobre el promedio diario del archivo, el paralelo varió ${percent(span.change)} entre el ${span.from.date} y el ${span.to.date}.`
            : ''}
        </p>
        <div className="panel">
          <RateChart data={rows} />
          <div className="axis-note">
            Naranja: los dos lados que publica la fuente para el paralelo (continua y punteada).
            {officialIsCharteable
              ? ' Azul: tipo de cambio oficial.'
              : ' El tipo de cambio oficial aún no tiene serie histórica cargada, por lo que no se grafica.'}
          </div>
        </div>
      </section>

      <section>
        <h2>Brecha cambiaria</h2>
        <p className="lede">
          Distancia entre el precio de mercado del dólar y el precio administrado, en porcentaje
          sobre el oficial. Se mide contra el punto medio del paralelo, que no depende de cómo estén
          etiquetados sus dos lados.
        </p>
        {gapSeries.length >= 2 ? (
          <div className="panel">
            <GapChart data={gapSeries} />
            <div className="axis-note">
              La referencia en cero es la paridad con el tipo de cambio oficial. Un valor negativo
              significa que el oficial quedó por encima del mercado.
            </div>
          </div>
        ) : (
          <div className="callout">
            La brecha solo puede calcularse en los días con ambas cotizaciones, y hoy hay{' '}
            <strong>{gapSeries.length === 1 ? 'un solo día' : 'ningún día'}</strong> con las dos.
          </div>
        )}
      </section>

      {spreadSeries.length >= 2 ? (
        <section>
          <h2>Dispersión entre plazas</h2>
          <p className="lede">
            Diferencia entre la cotización más alta y la más baja del día entre las plazas
            observadas. Un diferencial que se abre indica un mercado menos líquido o más
            fragmentado, y es en sí mismo una señal.
          </p>
          <div className="panel">
            <SpreadChart data={spreadSeries} />
            <div className="axis-note">Bolivianos de diferencia dentro del mismo día.</div>
          </div>
        </section>
      ) : null}

      <section>
        <h2>Últimos días</h2>
        <p className="lede">
          Serie diaria en crudo. <a href="/api/series.csv">Descargar la serie completa en CSV</a>.
        </p>
        <RecentTable rows={recent} />
      </section>

      {macro.length ? (
        <section>
          <h2>Contexto macroeconómico</h2>
          <p className="lede">
            Series anuales que sitúan el movimiento cambiario. Una brecha que se abre puede ser un
            mercado moviéndose o una economía bajo tensión, y son estas cifras las que permiten
            distinguirlo. Se publican una vez al año, así que su último dato disponible no coincide
            necesariamente entre indicadores ni con la fecha de las series diarias.
          </p>
          <MacroTable points={latestByIndicator(macro)} />
          <p className="lede" style={{ marginTop: '0.9rem' }}>
            Serie completa desde {macro[0]?.period ?? ''} en el CSV. La variación anual compara con
            el año inmediatamente anterior publicado.
          </p>
        </section>
      ) : null}

      <section>
        <h2>Fuentes</h2>
        <p className="lede">
          Cada lectura conserva la URL de la que se obtuvo y el hash de la evidencia almacenada.
        </p>
        <SourceTable sources={sources} />
      </section>

      <section className="notes">
        <h2>Notas metodológicas</h2>
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
                intercambiarse, así que estas etiquetas no corresponden a la convención boliviana de
                «compra» y «venta».
              </>
            ) : (
              ' Se reportan tal como las publica la fuente.'
            )}{' '}
            Por eso el informe no las traduce, encabeza con el <strong>punto medio</strong> —que no
            depende de esa distinción— y mide la brecha contra él.
          </dd>

          <dt>El oficial sí es consistente</dt>
          <dd>
            En el tipo de cambio oficial el lado «sell» es mayor o igual al «buy» en toda la serie,
            como corresponde a una cotización administrada. Cuando existe el valor único que publica
            el Banco Central, el informe usa ese; si no, el lado «sell», que es lo que paga quien
            adquiere dólares. La columna del cuadro indica cuál se usó.
          </dd>

          <dt>Valor del día</dt>
          <dd>
            Cuando varias plazas cotizan el mismo día, el valor publicado es la{' '}
            <strong>mediana discreta</strong>: resiste que una plaza se desvíe, cosa que un promedio
            no hace, y devuelve un precio efectivamente cotizado en lugar de un valor intermedio que
            nadie ofreció.
          </dd>

          <dt>Promedio diario frente a lectura puntual</dt>
          <dd>
            La serie anterior al inicio de la recolección diaria es un{' '}
            <strong>promedio diario</strong> de las cotizaciones intradía publicado por su editor;
            desde que el recolector opera, cada lectura es el precio <strong>en el momento</strong>{' '}
            de la consulta. Son estadísticos distintos y no se promedian entre sí: cuando un día
            tiene ambos prevalece el observado, y cada serie declara el suyo por separado en el
            cuadro. La variación del periodo se mide únicamente sobre el tramo de archivo, por la
            misma razón.
          </dd>

          <dt>Unidad del paralelo</dt>
          <dd>
            Algunas plazas cotizan contra USDT. La unidad se unifica en Bs/USD porque en este
            mercado la stablecoin opera como sustituto del dólar; el instrumento original se
            conserva en la base para quien necesite distinguirlo.
          </dd>

          <dt>Trazabilidad y sus límites</dt>
          <dd>
            Cada lectura cita su fuente y conserva el hash del documento del que se obtuvo. En la
            serie histórica del <strong>oficial</strong>, la cita es el fragmento literal del que se
            leyó cada valor. En la del <strong>paralelo</strong>, cargada antes de esa mejora, la
            cita es una reformulación de los valores leídos y no un extracto literal: sigue siendo
            trazable hasta el documento y su hash, pero no al nivel de la cita. Se documenta en
            lugar de reescribirse, porque la evidencia es inmutable.
          </dd>

          <dt>Cobertura</dt>
          <dd>
            El observatorio cubre hoy tipo de cambio oficial, dólar paralelo y UFV. Bonos soberanos,
            agregados macroeconómicos y noticias empresariales están contemplados pero aún no
            producen mediciones estructuradas.
          </dd>
        </dl>
        <p className="lede" style={{ marginTop: '1.4rem' }}>
          {observatory.readingCount.toLocaleString('es-BO')} puntos de serie leídos del núcleo del
          observatorio.
        </p>
      </section>
    </main>
  );
}

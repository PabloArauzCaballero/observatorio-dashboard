import { GapChart, RateChart, SpreadChart } from '@/components/charts';
import type { GapChartPoint, RatePoint, SpreadPoint } from '@/components/charts';
import { readGap, readObservatory, readSources } from '@/lib/series';
import type { DailyPoint, GapPoint, SourceNote } from '@/lib/series';

/**
 * The briefing.
 *
 * Written for readers who will check the figures: every number states its unit,
 * every series states how it was measured, and the sources are listed with the
 * URL each one came from. Where the data cannot support a claim — a gap that
 * has only one day behind it — the page says so instead of drawing a line
 * through a single point.
 */

// The exchange rate in force is not a cacheable fact.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PARALLEL_BUY = 'FX_PARALLEL_USD_BOB:BUY';
const PARALLEL_SELL = 'FX_PARALLEL_USD_BOB:SELL';
const OFFICIAL = 'FX_OFFICIAL_USD_BOB:OFFICIAL';
const UFV = 'UFV_BOB';

const rate = (value: number, decimals = 4): string =>
  value.toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const percent = (value: number): string =>
  `${value > 0 ? '+' : ''}${value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const longDate = (value: string): string =>
  new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'long', year: 'numeric' }).format(
    new Date(`${value}T12:00:00Z`),
  );

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

/** Aligns the series on a single date axis without inventing missing days. */
function buildRateSeries(
  buy: DailyPoint[],
  sell: DailyPoint[],
  official: DailyPoint[],
): RatePoint[] {
  const byDate = new Map<string, RatePoint>();
  const put = (points: DailyPoint[], apply: (target: RatePoint, point: DailyPoint) => void) => {
    for (const point of points) {
      const target = byDate.get(point.date) ?? { date: point.date };
      apply(target, point);
      if (point.aggregation === 'DAILY_AVERAGE') target.archived = true;
      byDate.set(point.date, target);
    }
  };
  put(buy, (target, point) => (target.parallelBuy = point.value));
  put(sell, (target, point) => (target.parallelSell = point.value));
  put(official, (target, point) => (target.official = point.value));
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
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

function RecentTable({ rows }: { rows: RatePoint[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th className="num">Paralelo compra</th>
            <th className="num">Paralelo venta</th>
            <th className="num">Oficial</th>
            <th>Medición</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <td>{row.date}</td>
              <td className="num">{typeof row.parallelBuy === 'number' ? rate(row.parallelBuy) : '—'}</td>
              <td className="num">{typeof row.parallelSell === 'number' ? rate(row.parallelSell) : '—'}</td>
              <td className="num">{typeof row.official === 'number' ? rate(row.official, 2) : '—'}</td>
              <td>{row.archived ? 'Promedio diario' : 'Puntual'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Page() {
  let observatory;
  let gap: GapPoint[] = [];
  let sources: SourceNote[] = [];
  try {
    [observatory, gap, sources] = await Promise.all([readObservatory(), readGap(), readSources()]);
  } catch (error) {
    return (
      <main>
        <div className="masthead">
          <h1>Observatorio económico de Bolivia</h1>
        </div>
        <div className="error">
          <strong>No fue posible leer la base de datos.</strong>
          <p>
            La página no muestra cifras que no pudo verificar. Detalle:{' '}
            <code>{error instanceof Error ? error.message : 'error desconocido'}</code>
          </p>
        </div>
      </main>
    );
  }

  const buy = observatory.series.get(PARALLEL_BUY) ?? [];
  const sell = observatory.series.get(PARALLEL_SELL) ?? [];
  const official = observatory.series.get(OFFICIAL) ?? [];
  const ufv = observatory.series.get(UFV) ?? [];

  // A single point cannot be drawn as a line: an official series that short is
  // reported as a figure and excluded from the chart.
  const officialIsCharteable = official.length >= 2;
  const rateSeries = buildRateSeries(buy, sell, officialIsCharteable ? official : []);
  const recent = [...rateSeries].reverse().slice(0, 14);

  const lastBuy = buy.at(-1);
  const lastSell = sell.at(-1);
  const lastOfficial = official.at(-1);
  const lastUfv = ufv.at(-1);
  const lastGap = gap.at(-1);

  const gapSeries: GapChartPoint[] = gap.map((point) => ({
    date: point.date,
    gapPercent: point.gapPercent,
  }));

  const spreadSeries: SpreadPoint[] = sell
    .filter((point) => typeof point.spread === 'number' && (point.venues ?? 0) > 1)
    .map((point) => ({ date: point.date, spread: point.spread ?? 0, venues: point.venues }));

  const firstParallel = buy[0];
  const yearMove =
    firstParallel && lastBuy ? ((lastBuy.value - firstParallel.value) / firstParallel.value) * 100 : null;

  return (
    <main>
      <header className="masthead">
        <div className="dateline">
          {observatory.latestDate ? `Datos al ${longDate(observatory.latestDate)}` : 'Sin datos'}
          {observatory.lastReceivedAt
            ? ` · última carga ${new Date(observatory.lastReceivedAt).toLocaleString('es-BO')}`
            : ''}
        </div>
        <h1>Tipo de cambio y brecha cambiaria en Bolivia</h1>
        <p>
          Seguimiento diario del dólar paralelo y del tipo de cambio oficial. Cada cifra procede de
          una fuente registrada, con la evidencia conservada y verificable; las series y sus
          agregaciones son las que publica el núcleo del observatorio, no cálculos de esta página.
        </p>
      </header>

      <section>
        <div className="figures">
          {lastOfficial ? (
            <Figure
              label="Oficial (TCO)"
              value={rate(lastOfficial.value, 2)}
              unit="Bs/USD"
              meta={`Banco Central · ${lastOfficial.date}`}
            />
          ) : null}
          {lastBuy ? (
            <Figure
              label="Paralelo compra"
              value={rate(lastBuy.value)}
              unit="Bs/USD"
              delta={lastBuy.changePercent}
            />
          ) : null}
          {lastSell ? (
            <Figure
              label="Paralelo venta"
              value={rate(lastSell.value)}
              unit="Bs/USD"
              delta={lastSell.changePercent}
            />
          ) : null}
          {lastGap ? (
            <Figure
              label="Brecha cambiaria"
              value={percent(lastGap.gapPercent)}
              meta={`Punto medio ${rate(lastGap.parallelMid, 2)} frente a oficial ${rate(lastGap.official, 2)}`}
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
          {yearMove !== null
            ? ` En lo que va del año el paralelo acumula ${percent(yearMove)} desde el 1 de enero.`
            : ''}
        </p>
        <div className="panel">
          <RateChart data={rateSeries} />
          <div className="axis-note">
            Línea continua: paralelo compra. Línea punteada: paralelo venta.
            {officialIsCharteable
              ? ' Línea azul: tipo de cambio oficial.'
              : ' El tipo de cambio oficial aún no tiene serie histórica cargada, por lo que no se grafica.'}
          </div>
        </div>
      </section>

      <section>
        <h2>Brecha cambiaria</h2>
        <p className="lede">
          Distancia entre el precio de mercado del dólar y el precio administrado, en porcentaje
          sobre el oficial. Es la variable que mejor resume la presión externa.
        </p>
        {gapSeries.length >= 2 ? (
          <div className="panel">
            <GapChart data={gapSeries} />
            <div className="axis-note">
              La referencia en cero es la paridad con el tipo de cambio oficial.
            </div>
          </div>
        ) : (
          <div className="callout">
            La brecha solo puede calcularse en los días con ambas cotizaciones. Hoy hay{' '}
            <strong>{gapSeries.length === 1 ? 'un solo día' : 'ningún día'}</strong> con las dos, porque
            la serie histórica cargada es únicamente la del paralelo. En cuanto se incorpore el
            histórico del tipo de cambio oficial, este gráfico se completa solo.
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
          Serie diaria en crudo.{' '}
          <a href="/api/series.csv">Descargar la serie completa en CSV</a>.
        </p>
        <RecentTable rows={recent} />
      </section>

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
            desde que el recolector opera, cada lectura es el precio{' '}
            <strong>en el momento</strong> de la consulta. Son estadísticos distintos y no se
            promedian entre sí: cuando un día tiene ambos, prevalece el observado, y la tabla lo
            indica en la columna «Medición».
          </dd>

          <dt>Unidad del paralelo</dt>
          <dd>
            Algunas plazas cotizan contra USDT. La unidad se unifica en Bs/USD porque en este
            mercado la stablecoin opera como sustituto del dólar; el instrumento original se
            conserva en la base para quien necesite distinguirlo.
          </dd>

          <dt>Trazabilidad</dt>
          <dd>
            Ninguna cifra se publica sin evidencia: cada lectura cita textualmente su fuente, y esa
            cita debe aparecer literalmente en el documento descargado, cuyo hash se conserva. Una
            afirmación cuya cifra no aparece en su evidencia se descarta entera.
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

import Link from 'next/link';
import { count, formatBytes, formatDuration, instant, percent } from '@/components/admin/format';
import { DataTable } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import { SegmentedLinks } from '@/components/admin/segmented';
import { StatStrip } from '@/components/admin/stat';
import { StateBadge, type Tone } from '@/components/admin/state-badge';
import { BarList, ShareBar } from '@/components/admin/viz/share-bar';
import { TimeSeries } from '@/components/admin/viz/time-series';
import type { ExportReport } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const STATUSES = ['', 'REQUESTED', 'GENERATED', 'FAILED'] as const;
const WINDOWS = [7, 30, 90] as const;
/** Lo máximo que el núcleo entrega por página; de ahí sale la serie por día. */
const SERIES_PAGE = 200;

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Solicitada',
  GENERATED: 'Generada',
  FAILED: 'Fallida',
};

function statusTone(status: string): Tone {
  if (status === 'GENERATED') return 'ok';
  if (status === 'REQUESTED') return 'warn';
  if (status === 'FAILED') return 'bad';
  return 'unknown';
}

const LA_PAZ_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/La_Paz',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** El día de La Paz de un instante, como el balde que el resto del portal dibuja. */
function dayBucket(instantIso: string): string {
  const [year, month, dayOfMonth] = LA_PAZ_DAY.format(new Date(instantIso)).split('-');
  return `${year}-${month}-${dayOfMonth}T04:00:00.000Z`;
}

/**
 * Exportaciones, con las tres etapas que de verdad se miden.
 *
 * No hay una columna «descarga completada», y es a propósito. Nada en este
 * despliegue observa el último byte llegando al lector: lo que se mide es que un
 * archivo se pidió y que el servidor lo armó. Añadir un cuarto estado que nadie
 * mide habría sido la forma más fácil de convertir esta pantalla en un conjunto
 * de cifras que no se pueden defender.
 *
 * Una petición sin su generación es una exportación que nunca produjo un
 * archivo, que es justo el hueco que esta tabla existe para mostrar: aquí se
 * llama «sin cierre» y se cuenta aparte, en lugar de dejarla disfrazada de
 * «solicitada» para siempre.
 */
export default async function DownloadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await currentSession();
  if (!session) return null;
  const parameters = await searchParams;
  const pick = (name: string): string =>
    typeof parameters[name] === 'string' ? (parameters[name] as string) : '';
  const asked = Number(pick('range'));
  const range = (WINDOWS as readonly number[]).includes(asked) ? asked : 30;
  const since = new Date(Date.now() - range * 864e5).toISOString();

  const table = new URLSearchParams();
  for (const name of ['datasetCode', 'status', 'cursor']) {
    const value = pick(name);
    if (value) table.set(name, value);
  }
  table.set('pageSize', '50');
  table.set('since', since);

  const [result, recent] = await Promise.all([
    callCore<ExportReport>('/api/v1/admin/analytics/exports', session, { search: table }),
    callCore<ExportReport>('/api/v1/admin/analytics/exports', session, {
      search: new URLSearchParams({ pageSize: String(SERIES_PAGE), since }),
    }),
  ]);

  const href = (next: number): string => `/admin/downloads?range=${next}`;

  // Cada petición cierra en GENERATED o FAILED; la que no tiene ninguna de las dos no cerró.
  const closing = new Map<string, 'GENERATED' | 'FAILED'>();
  const requestDay = new Map<string, string>();
  if (recent.ok) {
    for (const item of recent.body.data.items) {
      if (item.status === 'GENERATED' || item.status === 'FAILED')
        closing.set(item.requestId, item.status);
      if (item.status === 'REQUESTED') requestDay.set(item.requestId, dayBucket(item.occurredAt));
    }
  }
  const perDay = new Map<string, { generated: number; failed: number; open: number }>();
  for (const [requestId, bucket] of requestDay) {
    const entry = perDay.get(bucket) ?? { generated: 0, failed: 0, open: 0 };
    const outcome = closing.get(requestId);
    if (outcome === 'GENERATED') entry.generated += 1;
    else if (outcome === 'FAILED') entry.failed += 1;
    else entry.open += 1;
    perDay.set(bucket, entry);
  }
  const days = [...perDay.keys()].sort();
  const seriesFor = (
    pickValue: (entry: { generated: number; failed: number; open: number }) => number,
  ) =>
    days.map((day) => ({
      x: day,
      y: pickValue(perDay.get(day) ?? { generated: 0, failed: 0, open: 0 }),
    }));

  return (
    <>
      <PageHeader
        title="Descargas"
        lead="Solicitud, generación y fallo. La transferencia completa no se mide en este despliegue y por eso no se informa."
        {...(result.ok
          ? { observedAt: result.body.meta.observedAt, requestId: result.body.meta.requestId }
          : {})}
        actions={
          <SegmentedLinks
            label="Últimos"
            options={WINDOWS.map((option) => ({
              href: href(option),
              label: `${option} días`,
              current: option === range,
            }))}
          />
        }
      />

      {!result.ok ? (
        <section className="admin-panel">
          <ProblemNote problem={result} />
        </section>
      ) : (
        (() => {
          const summary = result.body.data.summary;
          const datasets = [...new Set(summary.map((entry) => entry.datasetCode))].sort();
          const total = (status: string): number =>
            summary
              .filter((entry) => entry.status === status)
              .reduce((sum, entry) => sum + entry.requests, 0);
          const requested = total('REQUESTED');
          const generated = total('GENERATED');
          const failed = total('FAILED');
          const open = Math.max(requested - generated - failed, 0);
          const rows = summary
            .filter((entry) => entry.status === 'GENERATED')
            .reduce((sum, entry) => sum + (entry.rows ?? 0), 0);
          const byDataset = datasets.map((code) => {
            const of = (status: string) =>
              summary.find((entry) => entry.datasetCode === code && entry.status === status);
            const req = of('REQUESTED')?.requests ?? 0;
            const gen = of('GENERATED')?.requests ?? 0;
            const fail = of('FAILED')?.requests ?? 0;
            return {
              code,
              requested: req,
              generated: gen,
              failed: fail,
              open: Math.max(req - gen - fail, 0),
              rows: of('GENERATED')?.rows ?? null,
            };
          });

          return (
            <>
              <StatStrip
                label="Cifras de descargas"
                stats={[
                  {
                    label: 'Archivos generados',
                    value: count(generated),
                    detail: 'desde que hay registro',
                    state: {
                      tone: generated > 0 ? 'ok' : 'unknown',
                      label: generated > 0 ? 'Entregando' : 'Sin archivos',
                    },
                  },
                  {
                    label: 'Tasa de fallo',
                    value:
                      generated + failed === 0
                        ? null
                        : percent(failed, generated + failed).replace(' %', ''),
                    unit: '%',
                    detail: `${count(failed)} fallidas de ${count(generated + failed)} cerradas`,
                    state: {
                      tone: failed > 0 ? 'bad' : 'ok',
                      label: failed > 0 ? 'Con fallos' : 'Sin fallos',
                    },
                    href: '/admin/downloads?status=FAILED',
                  },
                  {
                    label: 'Sin cierre',
                    value: count(open),
                    detail: 'pedidas y nunca cerradas como generadas ni fallidas',
                    state: {
                      tone: open > 0 ? 'warn' : 'ok',
                      label: open > 0 ? 'Revisar' : 'Ninguna',
                    },
                  },
                  {
                    label: 'Filas entregadas',
                    value: count(rows),
                    detail: 'suma de los archivos generados',
                  },
                ]}
              />

              <div className="admin-pair admin-pair-wide">
                <section className="admin-panel">
                  <header>
                    <div>
                      <h2>Peticiones por día</h2>
                      <p>
                        Hora de La Paz, últimos {range} días
                        {recent.ok && recent.body.data.items.length >= SERIES_PAGE
                          ? `; se dibujan las últimas ${SERIES_PAGE} etapas registradas`
                          : ''}
                        .
                      </p>
                    </div>
                  </header>
                  {days.length > 0 ? (
                    <TimeSeries
                      title="Exportaciones por resultado"
                      kind="stacked"
                      unit="peticiones"
                      granularity="day"
                      series={[
                        {
                          key: 'generated',
                          label: 'Generadas',
                          color: 'var(--series-1)',
                          points: seriesFor((e) => e.generated),
                        },
                        {
                          key: 'failed',
                          label: 'Fallidas',
                          color: 'var(--critical)',
                          points: seriesFor((e) => e.failed),
                        },
                        {
                          key: 'open',
                          label: 'Sin cierre',
                          color: 'var(--series-rest)',
                          points: seriesFor((e) => e.open),
                        },
                      ]}
                    />
                  ) : (
                    <EmptyNote
                      title="Sin peticiones en la ventana"
                      detail="No se registró ninguna exportación en estos días. Prueba con una ventana más larga."
                    />
                  )}
                </section>

                <section className="admin-panel">
                  <header>
                    <div>
                      <h2>Resultado de todas las peticiones</h2>
                      <p>Las partes de un total, desde que hay registro.</p>
                    </div>
                  </header>
                  <div className="admin-panel-body" style={{ display: 'grid', gap: 'var(--s3)' }}>
                    <ShareBar
                      title="Cerradas y sin cierre"
                      unit="peticiones"
                      segments={[
                        { label: 'Generadas', value: generated, color: 'var(--series-1)' },
                        { label: 'Fallidas', value: failed, color: 'var(--critical)' },
                        { label: 'Sin cierre', value: open, color: 'var(--series-rest)' },
                      ]}
                    />
                    <div>
                      <p className="pg-chart-title">Filas entregadas por conjunto</p>
                      <BarList
                        unit="filas"
                        rows={byDataset
                          .filter((entry) => (entry.rows ?? 0) > 0)
                          .sort((a, b) => (b.rows ?? 0) - (a.rows ?? 0))
                          .map((entry) => ({ label: entry.code, value: entry.rows ?? 0 }))}
                      />
                    </div>
                  </div>
                </section>
              </div>

              <Panel
                title="Resumen por conjunto"
                subtitle={`Estados registrados: ${result.body.data.measures.join(', ')}.`}
              >
                {byDataset.length === 0 ? (
                  <EmptyNote
                    title="Ninguna exportación registrada"
                    detail="No se ha instrumentado ninguna descarga en este entorno todavía."
                  />
                ) : (
                  <DataTable
                    caption={`${count(byDataset.length)} conjuntos, desde que hay registro`}
                    rows={byDataset}
                    rowKey={(row) => row.code}
                    columns={[
                      { header: 'Conjunto', cell: (row) => row.code, mono: true },
                      { header: 'Solicitadas', cell: (row) => count(row.requested), align: 'num' },
                      { header: 'Generadas', cell: (row) => count(row.generated), align: 'num' },
                      { header: 'Fallidas', cell: (row) => count(row.failed), align: 'num' },
                      { header: 'Sin cierre', cell: (row) => count(row.open), align: 'num' },
                      { header: 'Filas entregadas', cell: (row) => count(row.rows), align: 'num' },
                    ]}
                  />
                )}
              </Panel>

              <Panel
                title="Peticiones"
                subtitle="Cada fila lleva el identificador que devolvió la respuesta."
              >
                <form className="admin-form" method="get">
                  <input type="hidden" name="range" value={range} />
                  <label className="admin-field">
                    Conjunto
                    <select name="datasetCode" defaultValue={pick('datasetCode')}>
                      <option value="">Cualquiera</option>
                      {datasets.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-field">
                    Estado
                    <select name="status" defaultValue={pick('status')}>
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status === '' ? 'Cualquiera' : (STATUS_LABEL[status] ?? status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="admin-button admin-button-strong" type="submit">
                    Filtrar
                  </button>
                  <Link className="admin-button" href={href(range)}>
                    Limpiar
                  </Link>
                </form>

                {result.body.data.items.length === 0 ? (
                  <EmptyNote
                    title="Ninguna petición coincide"
                    detail="La consulta se ejecutó y no devolvió filas."
                  />
                ) : (
                  <>
                    <DataTable
                      rows={result.body.data.items}
                      rowKey={(item) => item.exportRequestId}
                      columns={[
                        { header: 'Instante', cell: (item) => instant(item.occurredAt) },
                        { header: 'Conjunto', cell: (item) => item.datasetCode, mono: true },
                        { header: 'Formato', cell: (item) => item.format.toUpperCase() },
                        {
                          header: 'Estado',
                          title: (item) => item.errorCode ?? undefined,
                          cell: (item) =>
                            item.status === 'REQUESTED' &&
                            recent.ok &&
                            !closing.has(item.requestId) &&
                            requestDay.has(item.requestId) ? (
                              <StateBadge tone="warn" label="Solicitada, sin cierre" />
                            ) : (
                              <StateBadge
                                tone={statusTone(item.status)}
                                label={STATUS_LABEL[item.status] ?? item.status}
                              />
                            ),
                        },
                        { header: 'Filas', cell: (item) => count(item.rowCount), align: 'num' },
                        {
                          header: 'Tamaño',
                          cell: (item) => formatBytes(item.byteCount),
                          align: 'num',
                          title: (item) =>
                            item.byteCount === null ? undefined : `${count(item.byteCount)} bytes`,
                        },
                        {
                          header: 'Tardó',
                          cell: (item) => formatDuration(item.durationMs),
                          align: 'num',
                        },
                        {
                          header: 'Truncada',
                          cell: (item) =>
                            item.truncated ? (
                              <StateBadge tone="warn" label="Sí, alcanzó el techo" />
                            ) : (
                              <StateBadge tone="ok" label="No" />
                            ),
                        },
                        { header: 'Petición', cell: (item) => item.requestId, mono: true },
                      ]}
                    />
                    {result.body.data.nextCursor ? (
                      <div className="admin-actions">
                        <Link
                          className="admin-button"
                          href={`/admin/downloads?${new URLSearchParams({
                            ...Object.fromEntries(table.entries()),
                            range: String(range),
                            cursor: result.body.data.nextCursor,
                          }).toString()}`}
                        >
                          Página siguiente
                        </Link>
                      </div>
                    ) : null}
                  </>
                )}
              </Panel>
            </>
          );
        })()
      )}
    </>
  );
}

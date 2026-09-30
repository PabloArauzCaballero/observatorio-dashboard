import { count, day, instant } from '@/components/admin/format';
import { DataTable } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import { SegmentedLinks } from '@/components/admin/segmented';
import { StateBadge } from '@/components/admin/state-badge';
import { TrafficExplorer } from '@/components/admin/traffic-explorer';
import type { TrafficReport } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';
import { DEVICE_LABEL, KIND_LABEL, REFERRER_LABEL } from '@/lib/admin/traffic-model';

export const dynamic = 'force-dynamic';

/**
 * Las ventanas que se pueden pedir. Una sola lista por granularidad: lo que no
 * está aquí no se acepta de la URL, así que un `?range=` inventado cae en la
 * ventana por omisión y no en una consulta sin techo.
 */
const WINDOWS = {
  day: { options: [7, 30, 90], fallback: 30, unit: 'días', milliseconds: 864e5 },
  hour: { options: [24, 72], fallback: 72, unit: 'horas', milliseconds: 36e5 },
} as const;

/** El núcleo corta la respuesta en este número de combinaciones. */
const CORE_BUCKET_LIMIT = 2000;

/**
 * Tráfico, y cuánto de él se midió de verdad.
 *
 * La línea de cobertura no es decoración. Un receptor caído desde el martes
 * produce cero vistas el miércoles, y lo único que impide leer ese cero como
 * «nadie visitó» es saber cuándo llegó el último evento. Por eso la ventana, el
 * primer y el último evento y la cuota de robots están en pantalla antes que
 * cualquier cifra.
 *
 * «Sesiones estimadas» es el nombre honesto de lo que puede medir un balde
 * diario que rota: no son personas ni dispositivos, y la columna lo dice.
 */
export default async function TrafficPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await currentSession();
  if (!session) return null;
  const parameters = await searchParams;
  const granularity = parameters.granularity === 'hour' ? 'hour' : 'day';
  const window = WINDOWS[granularity];
  const asked = Number(typeof parameters.range === 'string' ? parameters.range : '');
  const range = (window.options as readonly number[]).includes(asked) ? asked : window.fallback;

  const search = new URLSearchParams({
    granularity,
    // Los baldes se cortan en la zona de quien los lee: en UTC, las visitas de
    // la noche de La Paz aparecían bajo la fecha de mañana.
    timeZone: 'America/La_Paz',
    since: new Date(Date.now() - range * window.milliseconds).toISOString(),
  });
  const result = await callCore<TrafficReport>('/api/v1/admin/analytics/traffic', session, {
    search,
  });

  const href = (nextGranularity: string, nextRange: number): string =>
    `/admin/traffic?granularity=${nextGranularity}&range=${nextRange}`;

  return (
    <>
      <PageHeader
        title="Tráfico"
        lead="Vistas de página y sesiones estimadas del sitio público. No se guarda la dirección del visitante ni el texto que buscó. Las visitas al propio portal no se cuentan."
        {...(result.ok
          ? { observedAt: result.body.meta.observedAt, requestId: result.body.meta.requestId }
          : {})}
        actions={
          <div className="pg-filters" style={{ padding: 0, border: 0, background: 'transparent' }}>
            <SegmentedLinks
              label="Por"
              options={[
                {
                  href: href('day', WINDOWS.day.fallback),
                  label: 'Día',
                  current: granularity === 'day',
                },
                {
                  href: href('hour', WINDOWS.hour.fallback),
                  label: 'Hora',
                  current: granularity === 'hour',
                },
              ]}
            />
            <SegmentedLinks
              label="Últimos"
              options={window.options.map((option) => ({
                href: href(granularity, option),
                label: `${option} ${window.unit}`,
                current: option === range,
              }))}
            />
          </div>
        }
      />

      {!result.ok ? (
        <section className="admin-panel">
          <ProblemNote problem={result} />
        </section>
      ) : (
        <>
          <Panel
            title="Cobertura de la medición"
            subtitle="Lo primero, porque decide si las cifras de abajo significan algo."
          >
            <dl className="admin-dl admin-dl-row">
              <div>
                <dt>Estado</dt>
                <dd>
                  <StateBadge
                    tone={result.body.data.coverage.measured ? 'ok' : 'unknown'}
                    label={result.body.data.coverage.measured ? 'Midiendo' : 'Sin medición'}
                  />
                </dd>
              </div>
              <div>
                <dt>Primer evento</dt>
                <dd>{instant(result.body.data.coverage.firstEventAt)}</dd>
              </div>
              <div>
                <dt>Último evento</dt>
                <dd>{instant(result.body.data.coverage.lastEventAt)}</dd>
              </div>
              <div>
                <dt>Eventos recibidos</dt>
                <dd>{count(result.body.data.coverage.totalEvents)}</dd>
              </div>
              <div>
                <dt>Cuota atribuida a robots</dt>
                <dd>
                  {result.body.data.coverage.robotShare === null
                    ? 'sin población que medir'
                    : `${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 }).format(result.body.data.coverage.robotShare)} % (detección aproximada por agente de usuario)`}
                </dd>
              </div>
            </dl>
          </Panel>

          {!result.body.data.coverage.measured ? (
            <section className="admin-panel">
              <EmptyNote
                title="Todavía no hay nada medido"
                detail="Ningún evento ha llegado a este entorno. Esto no quiere decir que no haya visitas: quiere decir que no se están registrando."
              />
            </section>
          ) : result.body.data.buckets.length === 0 ? (
            <section className="admin-panel">
              <EmptyNote
                title="Sin vistas en la ventana consultada"
                detail="La consulta se ejecutó y no devolvió filas para el período seleccionado. Prueba con una ventana más larga."
              />
            </section>
          ) : (
            <>
              <TrafficExplorer
                buckets={result.body.data.buckets}
                granularity={granularity}
                truncated={result.body.data.buckets.length >= CORE_BUCKET_LIMIT}
              />
              <details className="admin-panel pg-detail">
                <summary>Detalle por período</summary>
                <DataTable
                  caption={`${count(result.body.data.buckets.length)} combinaciones de período, ruta, dispositivo y origen`}
                  rows={result.body.data.buckets}
                  rowKey={(bucket) =>
                    `${bucket.bucket}-${bucket.route}-${bucket.kind}-${bucket.device}-${bucket.referrer}`
                  }
                  columns={[
                    {
                      header: 'Período',
                      cell: (bucket) =>
                        granularity === 'day' ? day(bucket.bucket) : instant(bucket.bucket),
                    },
                    { header: 'Ruta', cell: (bucket) => bucket.route, mono: true, wrap: true },
                    { header: 'Tipo', cell: (bucket) => KIND_LABEL[bucket.kind] ?? bucket.kind },
                    {
                      header: 'Dispositivo',
                      cell: (bucket) => DEVICE_LABEL[bucket.device] ?? bucket.device,
                    },
                    {
                      header: 'Origen',
                      cell: (bucket) => REFERRER_LABEL[bucket.referrer] ?? bucket.referrer,
                    },
                    { header: 'Vistas', cell: (bucket) => count(bucket.views), align: 'num' },
                    {
                      header: 'Sesiones estimadas',
                      cell: (bucket) => count(bucket.estimatedSessions),
                      align: 'num',
                      title: () => 'Estimación, no personas únicas',
                    },
                  ]}
                />
              </details>
            </>
          )}
        </>
      )}
    </>
  );
}

import Link from 'next/link';
import { count, instant } from '@/components/admin/format';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import { StateBadge } from '@/components/admin/state-badge';
import type { TrafficReport } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const DEVICE_LABEL: Record<string, string> = {
  DESKTOP: 'Escritorio',
  MOBILE: 'Móvil',
  TABLET: 'Tableta',
  UNKNOWN: 'Sin determinar',
};

const REFERRER_LABEL: Record<string, string> = {
  DIRECT: 'Directo',
  SEARCH: 'Buscador',
  SOCIAL: 'Redes',
  EXTERNAL: 'Enlace externo',
  INTERNAL: 'Interno',
};

/**
 * Traffic, and how much of it was actually measured.
 *
 * The coverage line is not decoration. A receiver that has been down since
 * Tuesday produces zero page views for Wednesday, and the only thing that stops
 * that zero from reading as «nadie visitó» is knowing when the last event
 * arrived. So the window, the first and last event and the robot share are on
 * screen before any count is.
 *
 * «Sesiones estimadas» is the honest name for what a rotating daily bucket can
 * measure. It is not people, it is not devices, and the column says so.
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
  const search = new URLSearchParams({ granularity });
  const result = await callCore<TrafficReport>('/api/v1/admin/analytics/traffic', session, {
    search,
  });

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Tráfico</h1>
          <p>
            Vistas de página y sesiones estimadas del sitio público. No se guarda la dirección del
            visitante ni el texto que buscó.
          </p>
        </div>
        <div className="admin-form">
          <Link
            className="admin-button"
            href="/admin/traffic?granularity=day"
            aria-current={granularity === 'day' ? 'page' : undefined}
          >
            Por día
          </Link>
          <Link
            className="admin-button"
            href="/admin/traffic?granularity=hour"
            aria-current={granularity === 'hour' ? 'page' : undefined}
          >
            Por hora
          </Link>
        </div>
      </div>

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
            <dl className="admin-dl">
              <dt>Estado</dt>
              <dd>
                <StateBadge
                  tone={result.body.data.coverage.measured ? 'ok' : 'unknown'}
                  label={result.body.data.coverage.measured ? 'Midiendo' : 'Sin medición'}
                />
              </dd>
              <dt>Primer evento</dt>
              <dd>{instant(result.body.data.coverage.firstEventAt)}</dd>
              <dt>Último evento</dt>
              <dd>{instant(result.body.data.coverage.lastEventAt)}</dd>
              <dt>Eventos recibidos</dt>
              <dd>{count(result.body.data.coverage.totalEvents)}</dd>
              <dt>Cuota atribuida a robots</dt>
              <dd>
                {result.body.data.coverage.robotShare === null
                  ? 'sin población que medir'
                  : `${result.body.data.coverage.robotShare} % (detección aproximada por agente de usuario)`}
              </dd>
            </dl>
          </Panel>

          <Panel
            title="Vistas por ruta"
            subtitle="Rutas normalizadas: un identificador en la ruta se sustituye antes de guardarse."
          >
            {!result.body.data.coverage.measured ? (
              <EmptyNote
                title="Todavía no hay nada medido"
                detail="Ningún evento ha llegado a este entorno. Esto no quiere decir que no haya visitas: quiere decir que no se están registrando."
              />
            ) : result.body.data.buckets.length === 0 ? (
              <EmptyNote
                title="Sin vistas en la ventana consultada"
                detail="La consulta se ejecutó y no devolvió filas para el período seleccionado."
              />
            ) : (
              <div
                className="admin-scroll"
                tabIndex={0}
                role="region"
                aria-label="Tabla desplazable"
              >
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Período</th>
                      <th scope="col">Ruta</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Dispositivo</th>
                      <th scope="col">Origen</th>
                      <th scope="col" className="num">
                        Vistas
                      </th>
                      <th scope="col" className="num" title="Estimación, no personas únicas">
                        Sesiones estimadas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.body.data.buckets.map((bucket, index) => (
                      <tr key={`${bucket.bucket}-${bucket.route}-${index}`}>
                        <td>{instant(bucket.bucket)}</td>
                        <td className="admin-mono wrap">{bucket.route}</td>
                        <td>{bucket.kind === 'PAGE_VIEW' ? 'Vista' : 'Intención de descarga'}</td>
                        <td>{DEVICE_LABEL[bucket.device] ?? bucket.device}</td>
                        <td>{REFERRER_LABEL[bucket.referrer] ?? bucket.referrer}</td>
                        <td className="num">{count(bucket.views)}</td>
                        <td className="num">{count(bucket.estimatedSessions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

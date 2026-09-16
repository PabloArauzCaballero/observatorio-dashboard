import { count, instant } from '@/components/admin/format';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import { StateBadge, type Tone } from '@/components/admin/state-badge';
import type { HealthSummary } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const PUBLICATION_LABEL: Record<string, string> = {
  PUBLISHED: 'Publicado',
  PENDING: 'Pendiente',
  FAILED: 'Falló',
  UNKNOWN: 'Sin evidencia',
};

function publicationTone(status: string): Tone {
  if (status === 'PUBLISHED') return 'ok';
  if (status === 'PENDING') return 'warn';
  if (status === 'FAILED') return 'bad';
  return 'unknown';
}

/**
 * Availability, split into the four things it is actually made of.
 *
 * A process being alive, its dependencies answering, the obligatory catalogues
 * being present and a dataset being current are different questions with
 * different consequences, and the only reason they were ever one green light is
 * that one light was easier to build. Keeping them apart is what stops an
 * optional dataset a day behind from looking like an outage — and stops an
 * outage from hiding behind a dataset that happens to be fresh.
 *
 * A target with no probes reads «sin telemetría», never «en pie».
 */
export default async function HealthPage() {
  const session = await currentSession();
  if (!session) return null;
  const result = await callCore<HealthSummary>('/api/v1/admin/health/summary', session);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Disponibilidad</h1>
          <p>
            Comprobaciones externas, incidentes, publicación por conjunto y copias guardadas. La
            ausencia de telemetría se informa como desconocido, no como cero errores.
          </p>
        </div>
        {result.ok ? (
          <div className="admin-meta">
            <span>Build: {result.body.data.build.commit ?? 'sin commit declarado'}</span>
            <span>Observado: {instant(result.body.meta.observedAt)}</span>
          </div>
        ) : null}
      </div>

      {!result.ok ? (
        <section className="admin-panel">
          <ProblemNote problem={result} />
        </section>
      ) : (
        <>
          <Panel
            title="Comprobaciones"
            subtitle="Hechas desde fuera del proceso que sirve el sitio: un proceso no puede certificarse a sí mismo."
          >
            {result.body.data.probes.length === 0 ? (
              <EmptyNote
                title="Sin telemetría de disponibilidad"
                detail="Ninguna comprobación externa ha llegado. Esto no significa que el sitio esté en pie: significa que nadie lo ha mirado desde fuera."
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
                      <th scope="col">Objetivo</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Último resultado</th>
                      <th scope="col">Observado</th>
                      <th scope="col" className="num">
                        Comprobaciones
                      </th>
                      <th scope="col" className="num">
                        Fallidas
                      </th>
                      <th scope="col" className="num">
                        Desconocidas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.body.data.probes.map((probe) => (
                      <tr key={`${probe.target}-${probe.probeType}`}>
                        <td>{probe.target}</td>
                        <td>{probe.probeType}</td>
                        <td>
                          <StateBadge
                            tone={
                              probe.lastOutcome === 'UP'
                                ? 'ok'
                                : probe.lastOutcome === 'DOWN'
                                  ? 'bad'
                                  : 'unknown'
                            }
                            label={
                              probe.lastOutcome === 'UP'
                                ? 'En pie'
                                : probe.lastOutcome === 'DOWN'
                                  ? 'Caído'
                                  : 'Sin evidencia'
                            }
                          />
                        </td>
                        <td>{instant(probe.lastObservedAt)}</td>
                        <td className="num">{count(probe.checks)}</td>
                        <td className="num">{count(probe.failedChecks)}</td>
                        <td className="num">{count(probe.unknownChecks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Incidentes"
            subtitle="Uno por caída, no uno por sondeo. La entrega del aviso es un estado aparte del incidente."
          >
            {result.body.data.incidents.length === 0 ? (
              <EmptyNote
                title="Sin incidentes registrados"
                detail="Ninguna racha de fallos consecutivos ha abierto un incidente."
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
                      <th scope="col">Objetivo</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Causa</th>
                      <th scope="col">Abierto</th>
                      <th scope="col">Cerrado</th>
                      <th scope="col" className="num">
                        Duración (s)
                      </th>
                      <th scope="col">Avisos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.body.data.incidents.map((incident) => (
                      <tr key={incident.healthIncidentId}>
                        <td>{incident.target}</td>
                        <td>
                          <StateBadge
                            tone={incident.status === 'OPEN' ? 'bad' : 'ok'}
                            label={incident.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                          />
                        </td>
                        <td className="wrap">{incident.cause}</td>
                        <td>{instant(incident.openedAt)}</td>
                        <td>{incident.closedAt ? instant(incident.closedAt) : 'sigue abierto'}</td>
                        <td className="num">{count(incident.durationSeconds)}</td>
                        <td>
                          {incident.delivery.delivered} de {incident.delivery.attempts} entregados
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Publicación por conjunto"
            subtitle="Una carga confirmada y una copia que nunca se reconstruyó son dos estados distintos."
          >
            {result.body.data.publication.length === 0 ? (
              <EmptyNote
                title="Sin registro de publicación"
                detail="Ninguna reconstrucción ha dejado constancia todavía en este entorno."
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
                      <th scope="col">Conjunto</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Último intento</th>
                      <th scope="col">Último éxito</th>
                      <th scope="col">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.body.data.publication.map((entry) => (
                      <tr key={entry.datasetCode}>
                        <td className="admin-mono">{entry.datasetCode}</td>
                        <td>
                          <StateBadge
                            tone={publicationTone(entry.status)}
                            label={PUBLICATION_LABEL[entry.status] ?? entry.status}
                          />
                        </td>
                        <td>{instant(entry.lastAttemptAt)}</td>
                        <td>{instant(entry.lastSuccessAt)}</td>
                        <td className="wrap">{entry.lastError ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Copias guardadas"
            subtitle="«Construida» lo dice el catálogo del servidor; una copia creada sin datos no es una copia vacía."
          >
            <div className="admin-scroll" tabIndex={0} role="region" aria-label="Tabla desplazable">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Copia</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {result.body.data.storedCopies.map((copy) => (
                    <tr key={copy.name}>
                      <td className="admin-mono">{copy.name}</td>
                      <td>
                        <StateBadge
                          tone={copy.built ? 'ok' : 'warn'}
                          label={copy.built ? 'Construida' : 'Nunca construida'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

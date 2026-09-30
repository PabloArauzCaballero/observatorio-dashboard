import { count, formatDuration, instant, percent } from '@/components/admin/format';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import { StatStrip } from '@/components/admin/stat';
import { StateBadge, type Tone } from '@/components/admin/state-badge';
import { ShareBar } from '@/components/admin/viz/share-bar';
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
      <PageHeader
        title="Disponibilidad"
        lead="Comprobaciones externas, incidentes, publicación por conjunto y copias guardadas. La ausencia de telemetría se informa como desconocido, no como cero errores."
        {...(result.ok
          ? { observedAt: result.body.meta.observedAt, requestId: result.body.meta.requestId }
          : {})}
      />

      {!result.ok ? (
        <section className="admin-panel">
          <ProblemNote problem={result} />
        </section>
      ) : (
        <>
          {(() => {
            const data = result.body.data;
            const checks = data.probes.reduce((sum, probe) => sum + probe.checks, 0);
            const failed = data.probes.reduce((sum, probe) => sum + probe.failedChecks, 0);
            const unknown = data.probes.reduce((sum, probe) => sum + probe.unknownChecks, 0);
            const ok = Math.max(checks - failed - unknown, 0);
            const openIncidents = data.incidents.filter(
              (incident) => incident.status === 'OPEN',
            ).length;
            const notPublished = data.publication.filter(
              (entry) => entry.status !== 'PUBLISHED',
            ).length;
            const unbuilt = data.storedCopies.filter((copy) => !copy.built).length;
            return (
              <>
                <StatStrip
                  label="Cifras de disponibilidad"
                  stats={[
                    {
                      label: 'Comprobaciones que respondieron',
                      value: checks === 0 ? null : percent(ok, checks).replace(' %', ''),
                      unit: '%',
                      detail:
                        checks === 0
                          ? 'ninguna comprobación externa ha llegado'
                          : `${count(ok)} de ${count(checks)}`,
                    },
                    {
                      label: 'Incidentes abiertos',
                      value: count(openIncidents),
                      detail: `${count(data.incidents.length)} registrados`,
                      state: {
                        tone: openIncidents > 0 ? 'bad' : 'ok',
                        label: openIncidents > 0 ? 'Hay caída en curso' : 'Ninguno',
                      },
                    },
                    {
                      label: 'Conjuntos sin publicar',
                      value: count(notPublished),
                      detail: `de ${count(data.publication.length)} con registro`,
                      state: {
                        tone: notPublished > 0 ? 'warn' : 'ok',
                        label: notPublished > 0 ? 'Datos sin ver' : 'Al día',
                      },
                    },
                    {
                      label: 'Copias sin construir',
                      value: count(unbuilt),
                      detail: `de ${count(data.storedCopies.length)} copias guardadas`,
                      state: {
                        tone: unbuilt > 0 ? 'warn' : 'ok',
                        label: unbuilt > 0 ? 'Fallan al leerse' : 'Construidas',
                      },
                    },
                  ]}
                />
                {checks > 0 ? (
                  <section className="admin-panel">
                    <div className="admin-panel-body">
                      <ShareBar
                        title="Las comprobaciones, como partes de un total"
                        unit="comprobaciones"
                        segments={[
                          { label: 'Respondieron', value: ok, color: 'var(--series-1)' },
                          { label: 'Fallaron', value: failed, color: 'var(--critical)' },
                          { label: 'Sin resultado', value: unknown, color: 'var(--series-rest)' },
                        ]}
                      />
                    </div>
                  </section>
                ) : null}
              </>
            );
          })()}
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
                <table className="admin-table" data-stack>
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
                        <td data-label="Objetivo">{probe.target}</td>
                        <td data-label="Tipo">{probe.probeType}</td>
                        <td data-label="Último resultado">
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
                        <td data-label="Observado">{instant(probe.lastObservedAt)}</td>
                        <td data-label="Comprobaciones" className="num">{count(probe.checks)}</td>
                        <td data-label="Fallidas" className="num">{count(probe.failedChecks)}</td>
                        <td data-label="Desconocidas" className="num">{count(probe.unknownChecks)}</td>
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
                <table className="admin-table" data-stack>
                  <thead>
                    <tr>
                      <th scope="col">Objetivo</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Causa</th>
                      <th scope="col">Abierto</th>
                      <th scope="col">Cerrado</th>
                      <th scope="col" className="num">
                        Duración
                      </th>
                      <th scope="col">Avisos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.body.data.incidents.map((incident) => (
                      <tr key={incident.healthIncidentId}>
                        <td data-label="Objetivo">{incident.target}</td>
                        <td data-label="Estado">
                          <StateBadge
                            tone={incident.status === 'OPEN' ? 'bad' : 'ok'}
                            label={incident.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                          />
                        </td>
                        <td data-label="Causa" className="wrap">{incident.cause}</td>
                        <td data-label="Abierto">{instant(incident.openedAt)}</td>
                        <td data-label="Cerrado">{incident.closedAt ? instant(incident.closedAt) : 'sigue abierto'}</td>
                        <td data-label="Duración" className="num">
                          {incident.durationSeconds === null
                            ? 'sin medición'
                            : formatDuration(incident.durationSeconds * 1000)}
                        </td>
                        <td data-label="Avisos">
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
                <table className="admin-table" data-stack>
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
                        <td data-label="Conjunto" className="admin-mono">{entry.datasetCode}</td>
                        <td data-label="Estado">
                          <StateBadge
                            tone={publicationTone(entry.status)}
                            label={PUBLICATION_LABEL[entry.status] ?? entry.status}
                          />
                        </td>
                        <td data-label="Último intento">{instant(entry.lastAttemptAt)}</td>
                        <td data-label="Último éxito">{instant(entry.lastSuccessAt)}</td>
                        <td data-label="Detalle" className="wrap">{entry.lastError ?? '—'}</td>
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
              <table className="admin-table" data-stack>
                <thead>
                  <tr>
                    <th scope="col">Copia</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {result.body.data.storedCopies.map((copy) => (
                    <tr key={copy.name}>
                      <td data-label="Copia" className="admin-mono">{copy.name}</td>
                      <td data-label="Estado">
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

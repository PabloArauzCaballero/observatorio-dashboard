import Link from 'next/link';
import { count, instant } from '@/components/admin/format';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import { RUN_LABEL, StateBadge, runTone } from '@/components/admin/state-badge';
import type { IngestionRunDetail } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const STAGE_LABEL: Record<string, string> = {
  COLLECTION: 'Recolección',
  VALIDATION: 'Validación',
  DELIVERY: 'Entrega',
  PERSISTENCE: 'Persistencia',
  REVIEW: 'Revisión',
  PUBLICATION: 'Publicación',
};

const OUTCOME_LABEL: Record<string, string> = {
  SUCCEEDED: 'Completada',
  PARTIAL: 'Parcial',
  FAILED: 'Fallida',
  NO_CHANGES: 'Sin novedades',
  SKIPPED: 'Omitida',
};

function outcomeTone(outcome: string): 'ok' | 'warn' | 'bad' | 'unknown' {
  if (outcome === 'SUCCEEDED') return 'ok';
  if (outcome === 'PARTIAL') return 'warn';
  if (outcome === 'FAILED') return 'bad';
  return 'unknown';
}

/**
 * One execution, stage by stage.
 *
 * Opening this page reads and does nothing else. The temptation to requeue a
 * failed item «while we are here» is exactly what makes an operator unable to
 * tell their own investigation apart from their decision, so reprocessing stays
 * where it was: an explicit action on the core's own endpoint.
 */
export default async function IngestionRunPage({
  params,
}: {
  params: Promise<{ agentRunId: string }>;
}) {
  const session = await currentSession();
  if (!session) return null;
  const { agentRunId } = await params;
  const result = await callCore<IngestionRunDetail>(
    `/api/v1/admin/ingestion/runs/${encodeURIComponent(agentRunId)}`,
    session,
  );

  if (!result.ok) {
    return (
      <>
        <div className="admin-head">
          <div>
            <h1>Ejecución</h1>
            <p className="admin-mono">{agentRunId}</p>
          </div>
          <Link className="admin-button" href="/admin/ingestion">
            Volver a ingesta
          </Link>
        </div>
        <section className="admin-panel">
          <ProblemNote problem={result} />
        </section>
      </>
    );
  }

  const run = result.body.data;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>{run.sourceName}</h1>
          <p className="admin-mono">{run.agentRunId}</p>
        </div>
        <Link className="admin-button" href="/admin/ingestion">
          Volver a ingesta
        </Link>
      </div>

      <Panel title="Ejecución" subtitle={run.errorSummary ?? 'Sin resumen de error registrado.'}>
        <dl className="admin-dl">
          <dt>Estado</dt>
          <dd>
            <StateBadge tone={runTone(run.status)} label={RUN_LABEL[run.status] ?? run.status} />
          </dd>
          <dt>Disparo</dt>
          <dd>
            {run.triggerType} · intento {count(run.attemptNo)}
          </dd>
          <dt>Inicio</dt>
          <dd>{instant(run.startedAt)}</dd>
          <dt>Fin</dt>
          <dd>{run.completedAt ? instant(run.completedAt) : 'sigue abierta'}</dd>
          <dt>Correlación</dt>
          <dd className="admin-mono">{run.correlationId}</dd>
          <dt>Recibidos</dt>
          <dd>{count(run.counters.received)}</dd>
          <dt>Aceptados</dt>
          <dd>{count(run.counters.accepted)}</dd>
          <dt>Rechazados</dt>
          <dd>{count(run.counters.rejected)}</dd>
          <dt>En cuarentena</dt>
          <dd>{count(run.counters.quarantined)}</dd>
          <dt title="Recibidos menos aceptados, rechazados y en cuarentena">Sin resolver</dt>
          <dd>{count(run.counters.unresolved)}</dd>
        </dl>
      </Panel>

      <Panel
        title="Etapas"
        subtitle="Una recolección exitosa y una entrega que nunca ocurrió son dos filas distintas, no una."
      >
        {!run.stagesRecorded ? (
          <EmptyNote
            title="Esta ejecución no tiene etapas registradas"
            detail="El registro de etapas empieza cuando se instrumenta un recolector; las ejecuciones anteriores tienen contadores y no tienen etapas. No es que no haya pasado nada."
          />
        ) : (
          <div className="admin-scroll" tabIndex={0} role="region" aria-label="Tabla desplazable">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Instante</th>
                  <th scope="col">Etapa</th>
                  <th scope="col">Resultado</th>
                  <th scope="col" className="num">
                    Recibidos
                  </th>
                  <th scope="col" className="num">
                    Aceptados
                  </th>
                  <th scope="col" className="num">
                    Rechazados
                  </th>
                  <th scope="col" className="num">
                    Omitidos
                  </th>
                  <th scope="col">Evidencia</th>
                </tr>
              </thead>
              <tbody>
                {run.stages.map((stage) => (
                  <tr key={stage.eventId}>
                    <td title={instant(stage.occurredAt)}>{instant(stage.occurredAt)}</td>
                    <td>{STAGE_LABEL[stage.stage] ?? stage.stage}</td>
                    <td title={stage.reason ?? undefined}>
                      <StateBadge
                        tone={outcomeTone(stage.outcome)}
                        label={OUTCOME_LABEL[stage.outcome] ?? stage.outcome}
                      />
                    </td>
                    <td className="num">{count(stage.counters.received)}</td>
                    <td className="num">{count(stage.counters.accepted)}</td>
                    <td className="num">{count(stage.counters.rejected)}</td>
                    <td className="num">{count(stage.counters.skipped)}</td>
                    <td className="admin-mono wrap">
                      {stage.artifactSha256 ?? stage.artifactReference ?? 'sin artefacto'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

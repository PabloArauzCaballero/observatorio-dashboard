import Link from 'next/link';
import { instant, share } from '@/components/admin/format';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import { StateBadge } from '@/components/admin/state-badge';
import type { QualityIssue } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/**
 * One incident, its measurement and everything that was done to it.
 *
 * The evidence and the history sit side by side on purpose. A resolution never
 * rewrites the observation that raised the issue, so an operator can see the
 * measurement that is still there next to the decision somebody took about it —
 * which is the only way to disagree with a closure that was wrong.
 */
export default async function QualityIssuePage({
  params,
}: {
  params: Promise<{ dataIssueId: string }>;
}) {
  const session = await currentSession();
  if (!session) return null;
  const { dataIssueId } = await params;
  const result = await callCore<QualityIssue>(
    `/api/v1/admin/quality/issues/${encodeURIComponent(dataIssueId)}`,
    session,
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Incidencia de calidad</h1>
          <p className="admin-mono">{dataIssueId}</p>
        </div>
        <Link className="admin-button" href="/admin/quality">
          Volver a calidad
        </Link>
      </div>

      {!result.ok ? (
        <section className="admin-panel">
          <ProblemNote problem={result} />
        </section>
      ) : (
        <>
          <Panel title={result.body.data.title} subtitle={result.body.data.description}>
            <dl className="admin-dl">
              <dt>Estado</dt>
              <dd>
                <StateBadge
                  tone={result.body.data.status === 'CLOSED' ? 'ok' : 'warn'}
                  label={result.body.data.status}
                />
              </dd>
              <dt>Severidad</dt>
              <dd>
                <StateBadge
                  tone={result.body.data.severity === 'CRITICAL' ? 'bad' : 'warn'}
                  label={result.body.data.severity}
                />
              </dd>
              <dt>Tipo</dt>
              <dd>{result.body.data.issueType}</dd>
              <dt>Entidad afectada</dt>
              <dd className="admin-mono">
                {result.body.data.target.type} · {result.body.data.target.id}
              </dd>
              <dt>Detectada</dt>
              <dd>{instant(result.body.data.detectedAt)}</dd>
              <dt>Resuelta</dt>
              <dd>
                {result.body.data.resolvedAt
                  ? instant(result.body.data.resolvedAt)
                  : 'sin resolver'}
              </dd>
              <dt>Notas de resolución</dt>
              <dd>{result.body.data.resolutionNotes ?? 'sin notas'}</dd>
            </dl>
          </Panel>

          <Panel
            title="Evidencia"
            subtitle="La medición que la levantó, intacta. Cerrar la incidencia no la borra."
          >
            <dl className="admin-dl">
              <dt>Regla</dt>
              <dd className="admin-mono">
                {result.body.data.evidence.ruleCode ?? 'sin regla asociada'}
              </dd>
              <dt>Resultado de la evaluación</dt>
              <dd>{result.body.data.evidence.assessmentStatus ?? 'sin evaluación'}</dd>
              <dt>Cumplimiento medido</dt>
              <dd>
                {share(
                  result.body.data.evidence.numerator,
                  result.body.data.evidence.denominator,
                  result.body.data.evidence.share,
                )}
              </dd>
              <dt>Valor medido</dt>
              <dd className="admin-mono">
                {result.body.data.evidence.measuredValue ?? 'sin valor registrado'}
              </dd>
            </dl>
          </Panel>

          <Panel
            title="Historial"
            subtitle="Leído de la auditoría, que es inmutable: lo que se hizo queda aunque el estado cambie."
          >
            {result.body.data.history.length === 0 ? (
              <EmptyNote
                title="Sin acciones registradas"
                detail="Nadie ha aplicado una transición sobre esta incidencia todavía."
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
                      <th scope="col">Instante</th>
                      <th scope="col">Actor</th>
                      <th scope="col">Acción</th>
                      <th scope="col">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.body.data.history.map((entry) => (
                      <tr key={`${entry.occurredAt}-${entry.action}`}>
                        <td>{instant(entry.occurredAt)}</td>
                        <td className="wrap">
                          {entry.actorSubject}
                          <br />
                          <small>{entry.actorRoles.join(', ')}</small>
                        </td>
                        <td className="admin-mono wrap">{entry.action}</td>
                        <td>
                          <StateBadge
                            tone={entry.outcome === 'SUCCESS' ? 'ok' : 'bad'}
                            label={entry.outcome === 'SUCCESS' ? 'Aplicada' : 'Rechazada'}
                          />
                        </td>
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

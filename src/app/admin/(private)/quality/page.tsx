import Link from 'next/link';
import { count, instant, share } from '@/components/admin/format';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import { QUALITY_LABEL, StateBadge, qualityTone } from '@/components/admin/state-badge';
import type { Paged, QualityEvaluation, QualitySummary } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const RESULTS = [
  '',
  'PASS',
  'WARNING',
  'FAIL',
  'ERROR',
  'NOT_EVALUATED',
  'NOT_APPLICABLE',
] as const;
const SEVERITIES = ['', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const;

/**
 * Results, always with the population they were measured against.
 *
 * The rule listing starts from the declared rules and not from the results, so
 * a rule that has never run is on the screen. A summary built from assessments
 * alone cannot show the check nobody performed, and that is the one worth
 * knowing about.
 */
export default async function QualityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await currentSession();
  if (!session) return null;
  const parameters = await searchParams;
  const pick = (name: string): string =>
    typeof parameters[name] === 'string' ? (parameters[name] as string) : '';

  const search = new URLSearchParams();
  for (const name of ['ruleCode', 'result', 'severity', 'cursor']) {
    const value = pick(name);
    if (value) search.set(name, value);
  }
  search.set('pageSize', '50');

  const [summary, evaluations] = await Promise.all([
    callCore<QualitySummary>('/api/v1/admin/quality/summary', session),
    callCore<Paged<QualityEvaluation>>('/api/v1/admin/quality/evaluations', session, { search }),
  ]);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Calidad</h1>
          <p>
            Cada resultado trae numerador, denominador y cuántos no se pudieron evaluar. «0 de 0» no
            es cien por ciento y no aparece como tal.
          </p>
        </div>
      </div>

      <Panel
        title="Cobertura de reglas"
        subtitle="Una regla declarada y nunca ejecutada es una fila de esta tabla."
      >
        {!summary.ok ? (
          <ProblemNote problem={summary} />
        ) : (
          <>
            <dl className="admin-dl">
              <dt>Reglas declaradas</dt>
              <dd>{count(summary.body.data.coverage.declared)}</dd>
              <dt>Reglas evaluadas alguna vez</dt>
              <dd>
                {share(
                  summary.body.data.coverage.evaluated,
                  summary.body.data.coverage.declared,
                  summary.body.data.coverage.share,
                )}
              </dd>
              <dt>Incumplimientos bloqueantes</dt>
              <dd>{count(summary.body.data.blocking)}</dd>
            </dl>
            <div className="admin-scroll" tabIndex={0} role="region" aria-label="Tabla desplazable">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Regla</th>
                    <th scope="col">Severidad</th>
                    <th scope="col">Último resultado</th>
                    <th scope="col">Evaluada</th>
                    <th scope="col" className="num">
                      Evaluaciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.body.data.rules.map((rule) => (
                    <tr key={rule.ruleCode}>
                      <td className="wrap">
                        {rule.ruleName}
                        <br />
                        <small className="admin-mono">{rule.ruleCode}</small>
                      </td>
                      <td>{rule.severity}</td>
                      <td>
                        <StateBadge
                          tone={qualityTone(rule.lastStatus)}
                          label={QUALITY_LABEL[rule.lastStatus] ?? rule.lastStatus}
                        />
                      </td>
                      <td>{rule.lastAssessedAt ? instant(rule.lastAssessedAt) : 'nunca'}</td>
                      <td className="num">{count(rule.evaluations)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <Panel
        title="Evaluaciones"
        subtitle="Filtrables y enlazables; el filtro vive en la dirección."
      >
        <form className="admin-form" method="get">
          <label className="admin-field">
            Regla
            <input name="ruleCode" defaultValue={pick('ruleCode')} maxLength={80} />
          </label>
          <label className="admin-field">
            Resultado
            <select name="result" defaultValue={pick('result')}>
              {RESULTS.map((value) => (
                <option key={value} value={value}>
                  {value === '' ? 'Cualquiera' : (QUALITY_LABEL[value] ?? value)}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            Severidad
            <select name="severity" defaultValue={pick('severity')}>
              {SEVERITIES.map((value) => (
                <option key={value} value={value}>
                  {value === '' ? 'Cualquiera' : value}
                </option>
              ))}
            </select>
          </label>
          <button className="admin-button" type="submit">
            Filtrar
          </button>
          <Link className="admin-button" href="/admin/quality">
            Limpiar
          </Link>
        </form>

        {!evaluations.ok ? (
          <ProblemNote problem={evaluations} />
        ) : evaluations.body.data.items.length === 0 ? (
          <EmptyNote
            title="Ninguna evaluación coincide"
            detail="La consulta se ejecutó y no devolvió filas. Si nunca se han ejecutado las reglas, la tabla de arriba lo dice."
          />
        ) : (
          <div className="admin-scroll" tabIndex={0} role="region" aria-label="Tabla desplazable">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Evaluada</th>
                  <th scope="col">Regla</th>
                  <th scope="col">Alcance</th>
                  <th scope="col">Resultado</th>
                  <th scope="col">Cumplimiento</th>
                  <th scope="col" className="num">
                    Sin evaluar
                  </th>
                </tr>
              </thead>
              <tbody>
                {evaluations.body.data.items.map((evaluation) => (
                  <tr key={evaluation.evaluationId}>
                    <td>{instant(evaluation.assessedAt)}</td>
                    <td className="wrap">
                      {evaluation.ruleName}
                      <br />
                      <small className="admin-mono">
                        {evaluation.ruleCode}
                        {evaluation.ruleVersion ? ` v${evaluation.ruleVersion}` : ''}
                      </small>
                    </td>
                    <td className="admin-mono">{evaluation.scope ?? 'sin alcance'}</td>
                    <td>
                      <StateBadge
                        tone={qualityTone(evaluation.status)}
                        label={QUALITY_LABEL[evaluation.status] ?? evaluation.status}
                      />
                    </td>
                    <td>{share(evaluation.numerator, evaluation.denominator, evaluation.share)}</td>
                    <td className="num">{count(evaluation.notEvaluated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Incidencias abiertas"
        subtitle="Una crítica no desaparece dentro de un promedio: se cuenta aparte."
      >
        {!summary.ok ? (
          <ProblemNote problem={summary} />
        ) : summary.body.data.issues.length === 0 ? (
          <EmptyNote
            title="No hay incidencias abiertas"
            detail="Ninguna incidencia de calidad está en un estado distinto de cerrada o descartada."
          />
        ) : (
          <div className="admin-scroll" tabIndex={0} role="region" aria-label="Tabla desplazable">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Severidad</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="num">
                    Incidencias
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.body.data.issues.map((issue) => (
                  <tr key={`${issue.severity}-${issue.status}`}>
                    <td>
                      <StateBadge
                        tone={issue.severity === 'CRITICAL' ? 'bad' : 'warn'}
                        label={issue.severity}
                      />
                    </td>
                    <td>{issue.status}</td>
                    <td className="num">{count(issue.issues)}</td>
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

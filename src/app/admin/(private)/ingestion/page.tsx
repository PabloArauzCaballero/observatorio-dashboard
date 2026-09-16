import Link from 'next/link';
import { count, elapsed, instant, plural } from '@/components/admin/format';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import {
  FRESHNESS_LABEL,
  RUN_LABEL,
  StateBadge,
  freshnessTone,
  runTone,
} from '@/components/admin/state-badge';
import type { Paged, IngestionRun, SourceList } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const STATUSES = ['', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'] as const;
const STAGES = [
  '',
  'COLLECTION',
  'VALIDATION',
  'DELIVERY',
  'PERSISTENCE',
  'REVIEW',
  'PUBLICATION',
] as const;

/**
 * Sources and executions, with the filters in the address bar.
 *
 * Every filter is a query parameter and the form is a plain `GET`, so a
 * filtered view can be copied to somebody else, bookmarked, and reloaded
 * without losing what was selected. A filter that lives only in component state
 * is a filter nobody can hand over.
 */
export default async function IngestionPage({
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
  for (const name of ['sourceCode', 'status', 'stage', 'since', 'until', 'cursor']) {
    const value = pick(name);
    if (value) search.set(name, value);
  }
  search.set('pageSize', '50');

  const [sources, runs] = await Promise.all([
    callCore<SourceList>('/api/v1/admin/ingestion/sources', session),
    callCore<Paged<IngestionRun>>('/api/v1/admin/ingestion/runs', session, { search }),
  ]);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Ingesta</h1>
          <p>
            Qué prometió cada fuente, cuándo cumplió y qué etapa alcanzó cada ejecución. Abrir un
            detalle no reintenta nada.
          </p>
        </div>
      </div>

      <Panel
        title="Fuentes"
        subtitle="El atraso se juzga contra el calendario que la fuente declara, no contra la antigüedad del último dato."
      >
        {!sources.ok ? (
          <ProblemNote problem={sources} />
        ) : sources.body.data.items.length === 0 ? (
          <EmptyNote
            title="No hay fuentes registradas"
            detail="Este entorno no tiene ninguna fuente de procedencia cargada."
          />
        ) : (
          <div className="admin-scroll" tabIndex={0} role="region" aria-label="Tabla desplazable">
            <table className="admin-table">
              <caption>
                {plural(sources.body.data.items.length, 'fuente', 'fuentes')} ·{' '}
                {plural(sources.body.data.late, 'atrasada', 'atrasadas')} ·{' '}
                {count(sources.body.data.withoutSchedule)} sin calendario declarado
              </caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Fuente</th>
                  <th scope="col">Cadencia</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Última consulta con éxito</th>
                  <th scope="col">Último dato</th>
                  <th scope="col">Publicado</th>
                  <th scope="col" className="num">
                    Artefactos
                  </th>
                </tr>
              </thead>
              <tbody>
                {sources.body.data.items.map((source) => (
                  <tr key={source.sourceId}>
                    <td className="admin-mono">{source.code}</td>
                    <td className="wrap">
                      {source.name}
                      <br />
                      <small>{source.organization}</small>
                    </td>
                    <td>{source.cadence ?? 'sin declarar'}</td>
                    <td title={source.freshness.reason}>
                      <StateBadge
                        tone={freshnessTone(source.freshness.state)}
                        label={FRESHNESS_LABEL[source.freshness.state] ?? source.freshness.state}
                      />
                    </td>
                    <td title={instant(source.lastSuccessAt)}>{elapsed(source.lastSuccessAt)}</td>
                    <td title={instant(source.lastObservedAt)}>{elapsed(source.lastObservedAt)}</td>
                    <td title={instant(source.lastPublishedAt)}>
                      {source.lastPublishedAt ? elapsed(source.lastPublishedAt) : 'sin registro'}
                    </td>
                    <td className="num">{count(source.artifactCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Ejecuciones"
        subtitle="Los contadores son por etapa y no se suman entre sí: «aceptados» en validación y en persistencia describen los mismos elementos en dos momentos."
      >
        <form className="admin-form" method="get">
          <label className="admin-field">
            Fuente
            <input name="sourceCode" defaultValue={pick('sourceCode')} maxLength={80} />
          </label>
          <label className="admin-field">
            Estado
            <select name="status" defaultValue={pick('status')}>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status === '' ? 'Cualquiera' : (RUN_LABEL[status] ?? status)}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            Etapa registrada
            <select name="stage" defaultValue={pick('stage')}>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage === '' ? 'Cualquiera' : stage}
                </option>
              ))}
            </select>
          </label>
          <button className="admin-button" type="submit">
            Filtrar
          </button>
          <Link className="admin-button" href="/admin/ingestion">
            Limpiar
          </Link>
        </form>

        {!runs.ok ? (
          <ProblemNote problem={runs} />
        ) : runs.body.data.items.length === 0 ? (
          <EmptyNote
            title="Ninguna ejecución coincide"
            detail="La consulta se ejecutó y no devolvió filas; no es que esté cargando."
          />
        ) : (
          <>
            <div className="admin-scroll" tabIndex={0} role="region" aria-label="Tabla desplazable">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Inicio</th>
                    <th scope="col">Fuente</th>
                    <th scope="col">Estado</th>
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
                      En cuarentena
                    </th>
                    <th scope="col">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.body.data.items.map((run) => (
                    <tr key={run.agentRunId}>
                      <td title={instant(run.startedAt)}>{elapsed(run.startedAt)}</td>
                      <td className="wrap">{run.sourceCode}</td>
                      <td title={run.errorSummary ?? undefined}>
                        <StateBadge
                          tone={runTone(run.status)}
                          label={RUN_LABEL[run.status] ?? run.status}
                        />
                      </td>
                      <td className="num">{count(run.counters.received)}</td>
                      <td className="num">{count(run.counters.accepted)}</td>
                      <td className="num">{count(run.counters.rejected)}</td>
                      <td className="num">{count(run.counters.quarantined)}</td>
                      <td>
                        <Link href={`/admin/ingestion/runs/${run.agentRunId}`}>Ver etapas</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {runs.body.data.nextCursor ? (
              <div className="admin-actions">
                <Link
                  className="admin-button"
                  href={`/admin/ingestion?${new URLSearchParams({
                    ...Object.fromEntries(search.entries()),
                    cursor: runs.body.data.nextCursor,
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
}

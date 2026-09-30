import Link from 'next/link';
import { count, elapsed, instant, plural } from '@/components/admin/format';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import { StatStrip } from '@/components/admin/stat';
import { OutcomeBar, ShareBar } from '@/components/admin/viz/share-bar';
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
      <PageHeader
        title="Ingesta"
        lead="Qué prometió cada fuente, cuándo cumplió y qué etapa alcanzó cada ejecución. Abrir un detalle no reintenta nada."
        {...(runs.ok
          ? { observedAt: runs.body.meta.observedAt, requestId: runs.body.meta.requestId }
          : {})}
      />

      {sources.ok && runs.ok
        ? (() => {
            const items = sources.body.data.items;
            const onTime = items.filter((source) => source.freshness.state === 'on_time').length;
            const byStatus = (status: string): number =>
              runs.body.data.items.filter((run) => run.status === status).length;
            const total = runs.body.data.items.length;
            return (
              <>
                <StatStrip
                  label="Cifras de ingesta"
                  stats={[
                    {
                      label: 'Fuentes al día',
                      value: count(onTime),
                      unit: `de ${count(items.length)}`,
                      detail: `${count(sources.body.data.late)} atrasadas · ${count(sources.body.data.withoutSchedule)} sin calendario`,
                      state: {
                        tone:
                          sources.body.data.late > 0
                            ? 'bad'
                            : sources.body.data.withoutSchedule > 0
                              ? 'warn'
                              : 'ok',
                        label:
                          sources.body.data.late > 0
                            ? 'Incumplen calendario'
                            : 'Dentro del calendario',
                      },
                    },
                    {
                      label: 'Ejecuciones fallidas',
                      value: count(byStatus('FAILED')),
                      detail: `de las ${count(total)} más recientes`,
                      state: {
                        tone: byStatus('FAILED') > 0 ? 'bad' : 'ok',
                        label: byStatus('FAILED') > 0 ? 'Con fallos' : 'Sin fallos',
                      },
                    },
                    {
                      label: 'Parciales',
                      value: count(byStatus('PARTIAL')),
                      detail: 'la recolección cerró con una etapa a medias',
                    },
                    {
                      label: 'En curso',
                      value: count(byStatus('RUNNING')),
                      detail: 'todavía no terminan',
                    },
                  ]}
                />
                {total > 0 ? (
                  <section className="admin-panel">
                    <div className="admin-panel-body">
                      <ShareBar
                        title={`Las ${count(total)} ejecuciones más recientes, por resultado`}
                        unit="ejecuciones"
                        segments={[
                          {
                            label: 'Terminadas',
                            value: byStatus('SUCCEEDED'),
                            color: 'var(--series-1)',
                          },
                          {
                            label: 'Parciales',
                            value: byStatus('PARTIAL'),
                            color: 'var(--series-3)',
                          },
                          {
                            label: 'Fallidas',
                            value: byStatus('FAILED'),
                            color: 'var(--critical)',
                          },
                          {
                            label: 'En curso',
                            value: byStatus('RUNNING'),
                            color: 'var(--series-rest)',
                          },
                        ]}
                      />
                    </div>
                  </section>
                ) : null}
              </>
            );
          })()
        : null}

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
            <table className="admin-table" data-stack>
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
                    <td data-label="Código" className="admin-mono">{source.code}</td>
                    <td data-label="Fuente" className="wrap">
                      {source.name}
                      <br />
                      <small>{source.organization}</small>
                    </td>
                    <td data-label="Cadencia">{source.cadence ?? 'sin declarar'}</td>
                    <td data-label="Estado" title={source.freshness.reason}>
                      <StateBadge
                        tone={freshnessTone(source.freshness.state)}
                        label={FRESHNESS_LABEL[source.freshness.state] ?? source.freshness.state}
                      />
                    </td>
                    <td data-label="Última consulta con éxito" title={instant(source.lastSuccessAt)}>{elapsed(source.lastSuccessAt)}</td>
                    <td data-label="Último dato" title={instant(source.lastObservedAt)}>{elapsed(source.lastObservedAt)}</td>
                    <td data-label="Publicado" title={instant(source.lastPublishedAt)}>
                      {source.lastPublishedAt ? elapsed(source.lastPublishedAt) : 'sin registro'}
                    </td>
                    <td data-label="Artefactos" className="num">{count(source.artifactCount)}</td>
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
              <table className="admin-table" data-stack>
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
                    <th scope="col">Resultado</th>
                    <th scope="col">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.body.data.items.map((run) => (
                    <tr key={run.agentRunId}>
                      <td data-label="Inicio" title={instant(run.startedAt)}>{elapsed(run.startedAt)}</td>
                      <td data-label="Fuente" className="wrap">{run.sourceCode}</td>
                      <td data-label="Estado" title={run.errorSummary ?? undefined}>
                        <StateBadge
                          tone={runTone(run.status)}
                          label={RUN_LABEL[run.status] ?? run.status}
                        />
                      </td>
                      <td data-label="Recibidos" className="num">{count(run.counters.received)}</td>
                      <td data-label="Aceptados" className="num">{count(run.counters.accepted)}</td>
                      <td data-label="Rechazados" className="num">{count(run.counters.rejected)}</td>
                      <td data-label="En cuarentena" className="num">{count(run.counters.quarantined)}</td>
                      <td data-label="Resultado">
                        <OutcomeBar
                          received={run.counters.received}
                          accepted={run.counters.accepted}
                          rejected={run.counters.rejected}
                          quarantined={run.counters.quarantined}
                        />
                      </td>
                      <td data-label="Detalle">
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

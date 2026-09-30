import Link from 'next/link';
import { instant } from '@/components/admin/format';
import { Panel, ProblemNote } from '@/components/admin/panel';
import { RUN_LABEL, StateBadge, runTone } from '@/components/admin/state-badge';
import type { SeedRun } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/**
 * The durable state of one seed execution, reloadable.
 *
 * It is a page and not only a dialog because the dialog closes with the tab and
 * a corpus takes minutes: an operator has to be able to come back to the
 * address and find out how it went. The checkpoint is shown because it is what
 * a resumed attempt will start from, and «parcial» is shown as its own state
 * because data applied with its publication pending is neither a success nor a
 * failure.
 */
export default async function SeedRunPage({ params }: { params: Promise<{ seedRunId: string }> }) {
  const session = await currentSession();
  if (!session) return null;
  const { seedRunId } = await params;
  const result = await callCore<SeedRun>(
    `/api/v1/admin/seeds/runs/${encodeURIComponent(seedRunId)}`,
    session,
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Ejecución de siembra</h1>
          <p className="admin-mono">{seedRunId}</p>
        </div>
        <Link className="admin-button" href="/admin/seeds">
          Volver a sembradores
        </Link>
      </div>

      <Panel title="Estado" subtitle="Leído del registro, no del navegador.">
        {!result.ok ? (
          <ProblemNote problem={result} />
        ) : (
          <dl className="admin-dl">
            <dt>Paquete</dt>
            <dd className="admin-mono">
              {result.body.data.packageCode} · {result.body.data.packageVersion}
            </dd>
            <dt>Operación</dt>
            <dd>{result.body.data.operation}</dd>
            <dt>Estado</dt>
            <dd>
              <StateBadge
                tone={runTone(result.body.data.status)}
                label={RUN_LABEL[result.body.data.status] ?? result.body.data.status}
              />
            </dd>
            <dt>Intento</dt>
            <dd>{result.body.data.attemptNo}</dd>
            <dt>Inicio</dt>
            <dd>{instant(result.body.data.startedAt)}</dd>
            <dt title="Un latido detenido, no la duración, es lo que declara abandonada una ejecución">
              Último latido
            </dt>
            <dd>{instant(result.body.data.heartbeatAt)}</dd>
            <dt>Fin</dt>
            <dd>
              {result.body.data.completedAt
                ? instant(result.body.data.completedAt)
                : 'sin terminar'}
            </dd>
            <dt>Pasos completados</dt>
            <dd className="admin-mono">
              {result.body.data.checkpoint?.completed?.join(', ') ?? 'ninguno registrado'}
            </dd>
            <dt>Detalle</dt>
            <dd>{result.body.data.errorSummary ?? 'sin incidencias registradas'}</dd>
          </dl>
        )}
      </Panel>
    </>
  );
}

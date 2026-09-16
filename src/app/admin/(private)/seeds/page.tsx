import { elapsed, instant, plural } from '@/components/admin/format';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import { SeedConsole } from '@/components/admin/seed-console';
import { StateBadge, type Tone } from '@/components/admin/state-badge';
import type { SeedPackageList } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  REQUIRED_METADATA: 'Metadatos obligatorios',
  OBSERVATORY_BASELINE: 'Base del observatorio',
  HISTORICAL_DATA: 'Corpus histórico',
  DEMO_DATA: 'Datos de demostración',
};

const LEDGER_LABEL: Record<string, string> = {
  absent: 'No aplicado',
  applied: 'Aplicado',
  outdated: 'Versión anterior',
  conflict: 'Conflicto de checksum',
};

function ledgerTone(state: string, kind: string): Tone {
  if (state === 'conflict') return 'bad';
  if (state === 'applied') return 'ok';
  if (state === 'absent') return kind === 'REQUIRED_METADATA' ? 'bad' : 'warn';
  return 'warn';
}

/**
 * The manifest this build carries, next to the ledger of what this database has.
 *
 * The distinction the screen exists to make: a package is not «the seeds». Six
 * catalogues are the rows every other table points at and an environment
 * without them cannot admit an observation; seventeen are corpora that take
 * minutes; one is synthetic data that must never reach production. Showing them
 * as one list with one button was what made «está sembrado» a sentence with no
 * checkable meaning.
 */
export default async function SeedsPage() {
  const session = await currentSession();
  if (!session) return null;
  const result = await callCore<SeedPackageList>('/api/v1/admin/seeds/packages', session);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Sembradores</h1>
          <p>
            Cada paquete declara su versión y su checksum. Validar muestra la diferencia; aplicar
            exige que esa versión y ese checksum sigan siendo los mismos.
          </p>
        </div>
        {result.ok ? (
          <div className="admin-meta">
            <span>Perfil: {result.body.data.profile}</span>
            <span>
              Demostración: {result.body.data.demoEnabled ? 'habilitada' : 'deshabilitada'}
            </span>
            <span>Observado: {instant(result.body.meta.observedAt)}</span>
          </div>
        ) : null}
      </div>

      <Panel
        title="Paquetes"
        subtitle="«Adicionales permitidos» no es una divergencia. Un conflicto de checksum sí lo es: una misma versión con dos contenidos."
      >
        {!result.ok ? (
          <ProblemNote problem={result} />
        ) : result.body.data.items.length === 0 ? (
          <EmptyNote
            title="No hay paquetes declarados"
            detail="Este build no declara ningún paquete de siembra."
          />
        ) : (
          <div className="admin-scroll" tabIndex={0} role="region" aria-label="Tabla desplazable">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Paquete</th>
                  <th scope="col">Clase</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Aplicado</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {result.body.data.items.map((entry) => {
                  const applied = entry.appliedVersions[entry.appliedVersions.length - 1];
                  return (
                    <tr key={entry.code}>
                      <td className="wrap">
                        {entry.label}
                        <br />
                        <small className="admin-mono">
                          {entry.code} · v{entry.version} ·{' '}
                          {plural(entry.fileCount, 'archivo', 'archivos')}
                        </small>
                      </td>
                      <td>{KIND_LABEL[entry.kind] ?? entry.kind}</td>
                      <td title={entry.refusal?.message ?? undefined}>
                        <StateBadge
                          tone={ledgerTone(entry.ledgerState, entry.kind)}
                          label={LEDGER_LABEL[entry.ledgerState] ?? entry.ledgerState}
                        />
                        {entry.refusal ? (
                          <>
                            <br />
                            <small>{entry.refusal.message}</small>
                          </>
                        ) : null}
                      </td>
                      <td title={applied ? instant(applied.appliedAt) : undefined}>
                        {applied ? `v${applied.version} · ${elapsed(applied.appliedAt)}` : 'nunca'}
                      </td>
                      <td>
                        <SeedConsole entry={entry} csrf={session.csrf} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

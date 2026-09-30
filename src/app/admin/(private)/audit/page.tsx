import Link from 'next/link';
import { instant } from '@/components/admin/format';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import { StateBadge } from '@/components/admin/state-badge';
import type { AuditEvent, Paged } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/**
 * Who did what, including what was refused.
 *
 * Rejections matter as much as successes here: a 403 against a package an
 * operator should not be able to apply is evidence the boundary held, and a
 * trail that only recorded what worked would be unable to show that.
 *
 * The listing is scoped by the core to what this reader may see. The filter is
 * applied in the query and not after it, because paging a list and then
 * removing rows produces short pages whose length leaks how many were removed.
 */
export default async function AuditPage({
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
  for (const name of ['entityType', 'outcome', 'actorSubject', 'cursor']) {
    const value = pick(name);
    if (value) search.set(name, value);
  }
  search.set('pageSize', '50');

  const result = await callCore<Paged<AuditEvent>>('/api/v1/admin/audit/events', session, {
    search,
  });

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Auditoría</h1>
          <p>
            Acciones autorizadas y rechazos, tal como quedaron registrados. La auditoría es
            inmutable: aquí no se edita nada.
          </p>
        </div>
      </div>

      <Panel
        title="Eventos"
        subtitle="El identificador de correlación enlaza cada acción con su petición."
      >
        <form className="admin-form" method="get">
          <label className="admin-field">
            Tipo de entidad
            <input name="entityType" defaultValue={pick('entityType')} maxLength={60} />
          </label>
          <label className="admin-field">
            Resultado
            <select name="outcome" defaultValue={pick('outcome')}>
              <option value="">Cualquiera</option>
              <option value="SUCCESS">Aplicada</option>
              <option value="FAILURE">Rechazada</option>
            </select>
          </label>
          <label className="admin-field">
            Actor
            <input name="actorSubject" defaultValue={pick('actorSubject')} maxLength={200} />
          </label>
          <button className="admin-button" type="submit">
            Filtrar
          </button>
          <Link className="admin-button" href="/admin/audit">
            Limpiar
          </Link>
        </form>

        {!result.ok ? (
          <ProblemNote problem={result} />
        ) : result.body.data.items.length === 0 ? (
          <EmptyNote
            title="Ningún evento coincide"
            detail="La consulta se ejecutó y no devolvió filas dentro del alcance de esta sesión."
          />
        ) : (
          <>
            <div className="admin-scroll" tabIndex={0} role="region" aria-label="Tabla desplazable">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Instante</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Acción</th>
                    <th scope="col">Entidad</th>
                    <th scope="col">Resultado</th>
                    <th scope="col">Correlación</th>
                  </tr>
                </thead>
                <tbody>
                  {result.body.data.items.map((event) => (
                    <tr key={event.auditLogId}>
                      <td>{instant(event.occurredAt)}</td>
                      <td className="wrap">
                        {event.actorSubject}
                        <br />
                        <small>{event.actorRoles.join(', ') || 'sin roles declarados'}</small>
                      </td>
                      <td className="admin-mono wrap">{event.action}</td>
                      <td className="wrap">
                        {event.entityType}
                        {event.entityReference ? (
                          <>
                            <br />
                            <small className="admin-mono">{event.entityReference}</small>
                          </>
                        ) : null}
                      </td>
                      <td>
                        <StateBadge
                          tone={event.outcome === 'SUCCESS' ? 'ok' : 'bad'}
                          label={event.outcome === 'SUCCESS' ? 'Aplicada' : 'Rechazada'}
                        />
                      </td>
                      <td className="admin-mono">{event.correlationId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.body.data.nextCursor ? (
              <div className="admin-actions">
                <Link
                  className="admin-button"
                  href={`/admin/audit?${new URLSearchParams({
                    ...Object.fromEntries(search.entries()),
                    cursor: result.body.data.nextCursor,
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

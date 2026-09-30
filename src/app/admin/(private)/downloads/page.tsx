import Link from 'next/link';
import { count, instant } from '@/components/admin/format';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import { StateBadge, type Tone } from '@/components/admin/state-badge';
import type { ExportReport } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const STATUSES = ['', 'REQUESTED', 'GENERATED', 'FAILED'] as const;

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Solicitada',
  GENERATED: 'Generada',
  FAILED: 'Fallida',
};

function statusTone(status: string): Tone {
  if (status === 'GENERATED') return 'ok';
  if (status === 'REQUESTED') return 'warn';
  if (status === 'FAILED') return 'bad';
  return 'unknown';
}

/**
 * Exports, with the three stages that are actually measured.
 *
 * There is no «descarga completada» column and that is deliberate. Nothing in
 * this deployment observes the last byte reaching the reader: what is measured
 * is that a file was asked for and that the server built it. Adding a fourth
 * status nobody measures would have been the easiest way to turn this screen
 * into a set of numbers that cannot be defended.
 *
 * A request with no matching generation is an export that never produced a
 * file, which is exactly the gap this table exists to show.
 */
export default async function DownloadsPage({
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
  for (const name of ['datasetCode', 'status', 'cursor']) {
    const value = pick(name);
    if (value) search.set(name, value);
  }
  search.set('pageSize', '50');

  const result = await callCore<ExportReport>('/api/v1/admin/analytics/exports', session, {
    search,
  });

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Descargas</h1>
          <p>
            Solicitud, generación y fallo. La transferencia completa no se mide en este despliegue y
            por eso no se informa.
          </p>
        </div>
      </div>

      {!result.ok ? (
        <section className="admin-panel">
          <ProblemNote problem={result} />
        </section>
      ) : (
        <>
          <Panel
            title="Resumen por conjunto"
            subtitle={`Estados registrados: ${result.body.data.measures.join(', ')}.`}
          >
            {result.body.data.summary.length === 0 ? (
              <EmptyNote
                title="Ninguna exportación registrada"
                detail="No se ha instrumentado ninguna descarga en este entorno todavía."
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
                      <th scope="col" className="num">
                        Peticiones
                      </th>
                      <th scope="col" className="num">
                        Filas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.body.data.summary.map((entry) => (
                      <tr key={`${entry.datasetCode}-${entry.status}`}>
                        <td className="admin-mono">{entry.datasetCode}</td>
                        <td>
                          <StateBadge
                            tone={statusTone(entry.status)}
                            label={STATUS_LABEL[entry.status] ?? entry.status}
                          />
                        </td>
                        <td className="num">{count(entry.requests)}</td>
                        <td className="num">{count(entry.rows)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Peticiones"
            subtitle="Cada fila lleva el identificador que devolvió la respuesta."
          >
            <form className="admin-form" method="get">
              <label className="admin-field">
                Conjunto
                <input name="datasetCode" defaultValue={pick('datasetCode')} maxLength={40} />
              </label>
              <label className="admin-field">
                Estado
                <select name="status" defaultValue={pick('status')}>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status === '' ? 'Cualquiera' : (STATUS_LABEL[status] ?? status)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="admin-button" type="submit">
                Filtrar
              </button>
              <Link className="admin-button" href="/admin/downloads">
                Limpiar
              </Link>
            </form>

            {result.body.data.items.length === 0 ? (
              <EmptyNote
                title="Ninguna petición coincide"
                detail="La consulta se ejecutó y no devolvió filas."
              />
            ) : (
              <>
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
                        <th scope="col">Conjunto</th>
                        <th scope="col">Formato</th>
                        <th scope="col">Estado</th>
                        <th scope="col" className="num">
                          Filas
                        </th>
                        <th scope="col" className="num">
                          Bytes
                        </th>
                        <th scope="col">Truncada</th>
                        <th scope="col">Petición</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.body.data.items.map((item) => (
                        <tr key={item.exportRequestId}>
                          <td>{instant(item.occurredAt)}</td>
                          <td className="admin-mono">{item.datasetCode}</td>
                          <td>{item.format}</td>
                          <td title={item.errorCode ?? undefined}>
                            <StateBadge
                              tone={statusTone(item.status)}
                              label={STATUS_LABEL[item.status] ?? item.status}
                            />
                          </td>
                          <td className="num">{count(item.rowCount)}</td>
                          <td className="num">{count(item.byteCount)}</td>
                          <td>
                            {item.truncated ? (
                              <StateBadge tone="warn" label="Sí, alcanzó el techo" />
                            ) : (
                              <StateBadge tone="ok" label="No" />
                            )}
                          </td>
                          <td className="admin-mono">{item.requestId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.body.data.nextCursor ? (
                  <div className="admin-actions">
                    <Link
                      className="admin-button"
                      href={`/admin/downloads?${new URLSearchParams({
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
      )}
    </>
  );
}

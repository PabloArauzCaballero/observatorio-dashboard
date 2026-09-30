import Link from 'next/link';
import { instant, plural } from '@/components/admin/format';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyNote, Panel, ProblemNote } from '@/components/admin/panel';
import { SegmentedLinks } from '@/components/admin/segmented';
import { StateBadge } from '@/components/admin/state-badge';
import type { MetadataCatalog } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const CATALOGS = [
  { code: 'frequencies', label: 'Frecuencias' },
  { code: 'units', label: 'Unidades de medida' },
  { code: 'geographic-units', label: 'Geografía' },
  { code: 'statistical-domains', label: 'Dominios estadísticos' },
  { code: 'quality-dimensions', label: 'Dimensiones de calidad' },
  { code: 'organizations', label: 'Instituciones' },
  { code: 'sources', label: 'Fuentes' },
  { code: 'datasets', label: 'Conjuntos de datos' },
  { code: 'indicators', label: 'Indicadores' },
  { code: 'methodologies', label: 'Metodologías' },
] as const;

/**
 * The catalogues, chosen by name from a list the core also enforces.
 *
 * The screen never sends a table name. It sends a catalogue code, the core
 * resolves it against its own allowlist, and a code that is not on that list is
 * refused there rather than here — which is what keeps this page from becoming
 * a way to read arbitrary tables.
 *
 * The `referencias` column is what decides what an operator may do: an entry
 * something else points at cannot simply be edited away, and the screen says so
 * instead of offering a button that would fail.
 */
export default async function MetadataPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await currentSession();
  if (!session) return null;
  const parameters = await searchParams;
  const requested = typeof parameters.catalog === 'string' ? parameters.catalog : 'frequencies';
  const selected = CATALOGS.find((entry) => entry.code === requested) ?? CATALOGS[0];
  const result = await callCore<MetadataCatalog>(
    `/api/v1/admin/metadata/${selected.code}`,
    session,
  );

  return (
    <>
      <PageHeader
        title="Metadatos"
        lead="Catálogos, su origen y qué depende de cada entrada. Una entrada referenciada se versiona o se deprecia; no se borra."
        {...(result.ok
          ? { observedAt: result.body.meta.observedAt, requestId: result.body.meta.requestId }
          : {})}
      />

      <Panel title="Catálogo" subtitle="El nombre viene de una lista cerrada, nunca de una tabla.">
        <div className="pg-filters">
          <SegmentedLinks
            label="Catálogo"
            options={CATALOGS.map((catalog) => ({
              href: `/admin/metadata?catalog=${catalog.code}`,
              label: catalog.label,
              current: catalog.code === selected.code,
            }))}
          />
        </div>

        {!result.ok ? (
          <ProblemNote problem={result} />
        ) : result.body.data.entries.length === 0 ? (
          <EmptyNote
            title={`«${selected.label}» está vacío`}
            detail="La consulta se ejecutó y el catálogo no tiene entradas en este entorno. Si es un catálogo obligatorio, la pantalla de sembradores dice por qué."
          />
        ) : (
          <div className="admin-scroll" tabIndex={0} role="region" aria-label="Tabla desplazable">
            <table className="admin-table" data-stack>
              <caption>
                {plural(result.body.data.entries.length, 'entrada', 'entradas')} en {selected.label}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Nombre</th>
                  <th scope="col">Detalle</th>
                  <th scope="col">Vigencia</th>
                  <th scope="col" className="num">
                    Referencias
                  </th>
                  <th scope="col">Edición</th>
                </tr>
              </thead>
              <tbody>
                {result.body.data.entries.map((entry) => (
                  <tr key={entry.identity}>
                    <td data-label="Código" className="admin-mono">{entry.code}</td>
                    <td data-label="Nombre" className="wrap">{entry.name}</td>
                    <td data-label="Detalle" className="wrap">{entry.detail ?? '—'}</td>
                    <td data-label="Vigencia">
                      {entry.active === null ? (
                        <StateBadge tone="unknown" label="No aplica" />
                      ) : (
                        <StateBadge
                          tone={entry.active ? 'ok' : 'warn'}
                          label={entry.active ? 'Vigente' : 'Retirada'}
                        />
                      )}
                    </td>
                    <td data-label="Referencias" className="num">{entry.references}</td>
                    <td data-label="Edición">
                      {entry.references > 0 ? (
                        <StateBadge tone="warn" label="Protegida" />
                      ) : (
                        <StateBadge tone="unknown" label="Sin referencias" />
                      )}
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

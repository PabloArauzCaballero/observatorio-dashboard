import Link from 'next/link';
import { count, instant } from '@/components/admin/format';
import { DataTable } from '@/components/admin/data-table';
import { INQUIRY_STATUS_LABEL, InquiryStatusForm } from '@/components/admin/inquiry-status';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyNote, ProblemNote } from '@/components/admin/panel';
import { SegmentedLinks } from '@/components/admin/segmented';
import { StatStrip } from '@/components/admin/stat';
import type { InquiryReport, InquiryStatus, ServiceInquiry } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';
import { INQUIRY_PLANS } from '@/lib/plans';

export const dynamic = 'force-dynamic';

const FILTERS: ReadonlyArray<{ value: '' | InquiryStatus; label: string }> = [
  { value: 'NEW', label: 'Nuevos' },
  { value: 'CONTACTED', label: 'Contactados' },
  { value: 'WON', label: 'Clientes' },
  { value: 'LOST', label: 'Descartados' },
  { value: '', label: 'Todos' },
];

const planName = (code: string): string =>
  INQUIRY_PLANS.find((plan) => plan.code === code)?.nombre ?? code;

/**
 * Los pedidos que llegan desde «Servicios».
 *
 * Es la bandeja de ventas de la fase 1: cada fila es alguien que pidió un plan
 * o un informe. El operador le escribe, marca el estado y deja una nota; la
 * cuenta del cliente se crea a mano cuando paga (las cuentas llegan en la fase
 * 2, ver `docs/plan-monetizacion-2026-10-27.md`).
 */
export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await currentSession();
  if (!session) return null;
  const parameters = await searchParams;
  const pick = (name: string): string =>
    typeof parameters[name] === 'string' ? (parameters[name] as string) : '';
  const asked = pick('status');
  // Sin filtro se abre en «Nuevos», que es lo que hay que contestar; «todos» lo dice explícito.
  const status =
    asked === 'todos' ? '' : FILTERS.some((filter) => filter.value === asked) ? asked : 'NEW';
  const search = new URLSearchParams({ pageSize: '50' });
  if (status) search.set('status', status);
  const cursor = pick('cursor');
  if (cursor) search.set('cursor', cursor);

  const result = await callCore<InquiryReport>('/api/v1/admin/inquiries', session, { search });
  const href = (value: string, next?: string): string => {
    const query = new URLSearchParams({ status: value || 'todos' });
    if (next) query.set('cursor', next);
    return `/admin/pedidos?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Pedidos"
        lead="Quienes pidieron un plan o un informe desde «Servicios», con su estado y la nota del operador."
        {...(result.ok
          ? { observedAt: result.body.meta.observedAt, requestId: result.body.meta.requestId }
          : {})}
        actions={
          <SegmentedLinks
            label="Estado"
            options={FILTERS.map((filter) => ({
              href: href(filter.value),
              label: filter.label,
              current: filter.value === status,
            }))}
          />
        }
      />

      {!result.ok ? (
        <section className="admin-panel">
          <ProblemNote problem={result} />
        </section>
      ) : (
        (() => {
          const summary = result.body.data.summary;
          const of = (value: InquiryStatus): number =>
            summary.find((entry) => entry.status === value)?.count ?? 0;
          const items = result.body.data.items;
          return (
            <>
              <StatStrip
                label="Pedidos por estado"
                stats={[
                  {
                    label: 'Nuevos',
                    value: count(of('NEW')),
                    detail: 'sin contestar',
                    state: {
                      tone: of('NEW') > 0 ? 'warn' : 'ok',
                      label: of('NEW') > 0 ? 'Por contestar' : 'Al día',
                    },
                    href: href('NEW'),
                  },
                  { label: 'Contactados', value: count(of('CONTACTED')), detail: 'en conversación', href: href('CONTACTED') },
                  { label: 'Clientes', value: count(of('WON')), detail: 'pagaron un plan', href: href('WON') },
                  { label: 'Descartados', value: count(of('LOST')), detail: 'no siguieron', href: href('LOST') },
                ]}
              />

              <section className="admin-panel">
                {items.length === 0 ? (
                  <EmptyNote
                    title="Sin pedidos"
                    detail={
                      status
                        ? `No hay pedidos en «${INQUIRY_STATUS_LABEL[status as InquiryStatus]}».`
                        : 'Todavía nadie escribió desde «Servicios».'
                    }
                  />
                ) : (
                  <DataTable<ServiceInquiry>
                    caption="Pedidos, del más reciente al más antiguo"
                    rows={items}
                    rowKey={(row) => row.serviceInquiryId}
                    columns={[
                      { header: 'Recibido', cell: (row) => instant(row.createdAt) },
                      {
                        header: 'Quién',
                        wrap: true,
                        cell: (row) => (
                          <>
                            <strong>{row.fullName}</strong>
                            {row.organization ? <> · {row.organization}</> : null}
                            <br />
                            <a href={`mailto:${row.email}`}>{row.email}</a>
                            {row.phone ? <> · {row.phone}</> : null}
                          </>
                        ),
                      },
                      { header: 'Plan', cell: (row) => planName(row.planCode) },
                      { header: 'Mensaje', wrap: true, cell: (row) => row.message },
                      {
                        header: 'Estado',
                        wrap: true,
                        cell: (row) => (
                          <InquiryStatusForm
                            id={row.serviceInquiryId}
                            status={row.status}
                            note={row.operatorNote}
                            csrf={session.csrf}
                          />
                        ),
                      },
                    ]}
                  />
                )}
                {result.body.data.nextCursor ? (
                  <p className="admin-more">
                    <Link href={href(status, result.body.data.nextCursor)}>Pedidos anteriores</Link>
                  </p>
                ) : null}
              </section>
            </>
          );
        })()
      )}
    </>
  );
}

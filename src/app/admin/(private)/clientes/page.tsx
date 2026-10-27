import Link from 'next/link';
import { count, day } from '@/components/admin/format';
import { DataTable } from '@/components/admin/data-table';
import { ClientActions, NewClientForm } from '@/components/admin/clientes';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyNote, ProblemNote } from '@/components/admin/panel';
import { SegmentedLinks } from '@/components/admin/segmented';
import type { InquiryReport } from '@/lib/admin/contracts';
import { callCore } from '@/lib/admin/core-client';
import { currentSession } from '@/lib/admin/session';
import { listAccounts, type AdminAccount } from '@/lib/cuenta/admin';
import { STATUS_WORDS, USAGE_KINDS, USAGE_WORDS, isUuid, type UsageRow } from '@/lib/cuenta/puro';
import { readAccount } from '@/lib/cuenta/servidor';
import { PLANS } from '@/lib/plans';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'TRIAL', label: 'En prueba' },
  { value: 'ACTIVE', label: 'Vigentes' },
  { value: 'GRACE', label: 'En gracia' },
  { value: 'SUSPENDED', label: 'Suspendidas' },
  { value: 'CANCELLED', label: 'Canceladas' },
] as const;

const planName = (code: string): string => PLANS.find((plan) => plan.code === code)?.nombre ?? code;

/**
 * El pedido del que sale una cuenta nueva. Se busca en la bandeja de pedidos
 * (las primeras páginas alcanzan: un pedido se convierte en cuenta poco después
 * de llegar), para no llevar el correo del cliente en la dirección.
 */
async function findInquiry(session: NonNullable<Awaited<ReturnType<typeof currentSession>>>, id: string) {
  let cursor: string | null = null;
  for (let page = 0; page < 4; page += 1) {
    const search = new URLSearchParams({ pageSize: '50' });
    if (cursor) search.set('cursor', cursor);
    const result = await callCore<InquiryReport>('/api/v1/admin/inquiries', session, { search, timeoutMs: 6_000 });
    if (!result.ok) return null;
    const found = result.body.data.items.find((item) => item.serviceInquiryId === id);
    if (found) return found;
    cursor = result.body.data.nextCursor;
    if (!cursor) return null;
  }
  return null;
}

/** El consumo del mes de cada cuenta: del listado si lo trae, si no, de la ficha de cada una. */
async function usageOf(items: readonly AdminAccount[]): Promise<Map<string, UsageRow[]>> {
  const map = new Map<string, UsageRow[]>();
  await Promise.all(
    items.map(async (item) => {
      if (item.usage) {
        map.set(item.subscriberAccountId, item.usage);
        return;
      }
      const detail = await readAccount(item.subscriberAccountId);
      if (detail.ok) map.set(item.subscriberAccountId, detail.body.data.usage);
    }),
  );
  return map;
}

/**
 * Las cuentas de cliente: quién tiene un plan, hasta cuándo y cuánto lo usa.
 * Aquí se abre una cuenta (o se convierte un pedido en cuenta), se registran
 * los pagos y se genera el enlace para fijar o recuperar la contraseña.
 */
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await currentSession();
  if (!session) return null;
  const parameters = await searchParams;
  const pick = (name: string): string => (typeof parameters[name] === 'string' ? (parameters[name] as string) : '');
  const asked = pick('status');
  const status = FILTERS.some((filter) => filter.value === asked) ? asked : '';
  const search = new URLSearchParams({ pageSize: '50' });
  if (status) search.set('status', status);
  const cursor = pick('cursor');
  if (cursor) search.set('cursor', cursor);

  const inquiryId = pick('pedido');
  const [result, inquiry] = await Promise.all([
    listAccounts(session, search),
    isUuid(inquiryId) ? findInquiry(session, inquiryId) : Promise.resolve(null),
  ]);
  const usage = result.ok ? await usageOf(result.body.data.items) : new Map<string, UsageRow[]>();

  const href = (value: string, next?: string): string => {
    const query = new URLSearchParams();
    if (value) query.set('status', value);
    if (next) query.set('cursor', next);
    const text = query.toString();
    return `/admin/clientes${text ? `?${text}` : ''}`;
  };

  return (
    <>
      <PageHeader
        title="Clientes"
        lead="Las cuentas con plan: estado, vigencia y consumo del mes. Aquí se abren, se cobran y se recupera la contraseña."
        {...(result.ok && result.body.meta
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

      <section className="admin-panel" aria-labelledby="nueva-cuenta">
        <h2 id="nueva-cuenta">Cuenta nueva</h2>
        {inquiryId && !inquiry ? (
          <p className="admin-note">No se encontró el pedido; completar los datos a mano.</p>
        ) : null}
        {inquiry ? (
          <p className="admin-note">
            Desde el pedido de {inquiry.fullName}, recibido el {day(inquiry.createdAt)}.
          </p>
        ) : null}
        <NewClientForm
          csrf={session.csrf}
          prefill={
            inquiry
              ? {
                  email: inquiry.email,
                  fullName: inquiry.fullName,
                  organization: inquiry.organization ?? '',
                  planCode: inquiry.planCode,
                  inquiryId: inquiry.serviceInquiryId,
                }
              : null
          }
        />
      </section>

      {!result.ok ? (
        <section className="admin-panel">
          <ProblemNote problem={result} />
        </section>
      ) : (
        <section className="admin-panel">
          {result.body.data.items.length === 0 ? (
            <EmptyNote
              title="Sin cuentas"
              detail={status ? 'No hay cuentas en este estado.' : 'Todavía no se abrió ninguna cuenta de cliente.'}
            />
          ) : (
            <DataTable<AdminAccount>
              caption="Cuentas de cliente"
              rows={result.body.data.items}
              rowKey={(row) => row.subscriberAccountId}
              columns={[
                {
                  header: 'Cliente',
                  wrap: true,
                  cell: (row) => (
                    <>
                      <strong>{row.fullName}</strong>
                      {row.organization ? <> · {row.organization}</> : null}
                      <br />
                      <a href={`mailto:${row.email}`}>{row.email}</a>
                    </>
                  ),
                },
                {
                  header: 'Plan',
                  cell: (row) => `${planName(row.planCode)} · ${row.billingPeriod === 'ANNUAL' ? 'anual' : 'mensual'}`,
                },
                {
                  header: 'Estado',
                  cell: (row) => STATUS_WORDS[row.effectiveStatus] ?? row.effectiveStatus,
                },
                { header: 'Vigente hasta', cell: (row) => day(row.paidUntil) },
                {
                  header: 'Consumo del mes',
                  wrap: true,
                  cell: (row) => {
                    const rows = usage.get(row.subscriberAccountId);
                    if (!rows) return '—';
                    return USAGE_KINDS.map((kind) => {
                      const used = rows.filter((entry) => entry.usageKind === kind).reduce((sum, entry) => sum + entry.used, 0);
                      return `${USAGE_WORDS[kind]}: ${count(used)}`;
                    }).join(' · ');
                  },
                },
                {
                  header: 'Acciones',
                  wrap: true,
                  cell: (row) => (
                    <ClientActions
                      csrf={session.csrf}
                      id={row.subscriberAccountId}
                      email={row.email}
                      fullName={row.fullName}
                      planCode={row.planCode}
                      status={row.status}
                    />
                  ),
                },
              ]}
            />
          )}
          {result.body.data.nextCursor ? (
            <p className="admin-more">
              <Link href={href(status, result.body.data.nextCursor)}>Cuentas anteriores</Link>
            </p>
          ) : null}
        </section>
      )}
    </>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { day, instant } from '@/components/admin/format';

/**
 * Los formularios de «Clientes»: crear una cuenta, registrar un pago, cambiar
 * plan o estado, desbloquear el ingreso, cerrar sesiones y generar un enlace.
 * Todas las escrituras van por `/api/admin/clientes/*` con el token CSRF de la
 * sesión, igual que el estado de un pedido. El historial de pagos y los
 * miembros se leen al abrir la ficha, no con la página: son dos llamadas al
 * núcleo por cuenta y casi nunca se miran todas.
 */

export const PLAN_OPTIONS = [
  { value: 'analista', label: 'Analista' },
  { value: 'profesional', label: 'Profesional' },
  { value: 'institucional', label: 'Institucional' },
] as const;

/** Los estados que el operador fija a mano; el servidor valida la misma lista (`OPERATOR_STATUSES`). */
export const STATUS_OPTIONS = [
  { value: 'TRIAL', label: 'Prueba' },
  { value: 'ACTIVE', label: 'Activa' },
  { value: 'SUSPENDED', label: 'Suspendida' },
  { value: 'CANCELLED', label: 'Cancelada' },
] as const;

type Outcome = { ok: true; data: Record<string, unknown> | null } | { ok: false; message: string };

const messageOf = (data: Record<string, unknown> | null, status: number): string =>
  (data?.['error'] as { message?: string } | undefined)?.message ??
  (status === 401 ? 'La sesión venció. Volver a ingresar al portal.' : 'No se pudo completar la acción.');

async function send(url: string, method: 'POST' | 'PATCH', csrf: string, body?: unknown): Promise<Outcome> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', 'x-obs-csrf': csrf },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    return response.ok ? { ok: true, data } : { ok: false, message: messageOf(data, response.status) };
  } catch {
    return { ok: false, message: 'Sin conexión con el servidor. Volver a intentar.' };
  }
}

async function read<T>(url: string): Promise<{ ok: true; items: T[] } | { ok: false; message: string }> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) return { ok: false, message: messageOf(data, response.status) };
    return { ok: true, items: Array.isArray(data?.['items']) ? (data['items'] as T[]) : [] };
  } catch {
    return { ok: false, message: 'Sin conexión con el servidor.' };
  }
}

/** Una fecha `YYYY-MM-DD` leída al mediodía, para que el huso de La Paz no la corra un día. */
const dateOnly = (value: string): string => day(/^\d{4}-\d{2}-\d{2}$/u.test(value) ? `${value}T12:00:00Z` : value);

/**
 * El monto que escribió el operador. Con coma, la coma es el decimal y los
 * puntos separan miles («1.250,50»); sin coma, un punto seguido de grupos de
 * tres cifras también separa miles («1.250»), y si no, es el decimal («350.5»).
 */
function parseAmount(raw: string): number {
  const text = raw.replace(/\s/gu, '');
  if (text.includes(',')) return Number(text.replace(/\./gu, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/u.test(text)) return Number(text.replace(/\./gu, ''));
  return Number(text);
}

const BOB = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bolivianos = (value: string): string => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `Bs ${BOB.format(parsed)}` : `Bs ${value}`;
};

interface IssuedLink {
  link: string;
  emailed: boolean;
  mailConfigured: boolean;
}

function LinkBox({ link, emailed, mailConfigured }: IssuedLink) {
  const id = useId();
  const [copy, setCopy] = useState<'idle' | 'done' | 'failed'>('idle');
  return (
    <div className="admin-cliente-enlace" role="status">
      <p>
        <strong>Enlace de un solo uso.</strong>{' '}
        {emailed
          ? 'Se mandó por correo al cliente; también queda aquí para copiarlo.'
          : mailConfigured
            ? 'El correo no salió: copiar el enlace y mandarlo a mano.'
            : 'Este despliegue no manda correos: copiar el enlace y mandarlo a mano.'}
      </p>
      <label className="sr-only" htmlFor={id}>
        Enlace de un solo uso
      </label>
      <input id={id} type="text" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard
            .writeText(link)
            .then(() => setCopy('done'))
            .catch(() => setCopy('failed'));
        }}
      >
        {copy === 'done' ? 'Copiado' : 'Copiar el enlace'}
      </button>
      {copy === 'failed' ? <p>No se pudo copiar: seleccionar el texto y copiarlo a mano.</p> : null}
    </div>
  );
}

const issued = (data: Record<string, unknown> | null, key: 'link' | 'activationLink'): IssuedLink => ({
  link: String(data?.[key] ?? ''),
  emailed: data?.['emailed'] === true,
  mailConfigured: data?.['mailConfigured'] === true,
});

export function NewClientForm({
  csrf,
  prefill,
}: {
  csrf: string;
  prefill: { email: string; fullName: string; organization: string; planCode: string; inquiryId: string } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [created, setCreated] = useState<IssuedLink | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setProblem(null);
    setCreated(null);
    const result = await send('/api/admin/clientes', 'POST', csrf, {
      email: String(data.get('email') ?? ''),
      fullName: String(data.get('fullName') ?? ''),
      organization: String(data.get('organization') ?? ''),
      planCode: String(data.get('planCode') ?? ''),
      billingPeriod: String(data.get('billingPeriod') ?? ''),
      trial: data.get('trial') === 'si',
      ...(prefill?.inquiryId ? { serviceInquiryId: prefill.inquiryId } : {}),
    });
    setBusy(false);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    setCreated(issued(result.data, 'activationLink'));
    form.reset();
    router.refresh();
  };

  const plan = PLAN_OPTIONS.some((option) => option.value === prefill?.planCode) ? prefill?.planCode : 'analista';

  return (
    <>
      <form className="admin-cliente-form" onSubmit={(event) => void submit(event)} aria-busy={busy}>
        <label>
          Correo
          <input name="email" type="email" required maxLength={254} autoComplete="off" defaultValue={prefill?.email ?? ''} />
        </label>
        <label>
          Nombre
          <input name="fullName" type="text" required minLength={2} maxLength={120} autoComplete="off" defaultValue={prefill?.fullName ?? ''} />
        </label>
        <label>
          Organización
          <input name="organization" type="text" maxLength={160} autoComplete="off" defaultValue={prefill?.organization ?? ''} />
        </label>
        <label>
          Plan
          <select name="planCode" defaultValue={plan}>
            {PLAN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Periodo
          <select name="billingPeriod" defaultValue="MONTHLY">
            <option value="MONTHLY">Mensual</option>
            <option value="ANNUAL">Anual</option>
          </select>
        </label>
        <label className="admin-cliente-check">
          <input name="trial" type="checkbox" value="si" defaultChecked />
          Prueba de 7 días
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Creando la cuenta…' : 'Crear cuenta'}
        </button>
        {problem ? (
          <p className="admin-inquiry-problem" role="alert">
            {problem}
          </p>
        ) : null}
      </form>
      {created ? <LinkBox {...created} /> : null}
    </>
  );
}

/* ------------------------------ Ficha de cuenta ----------------------------- */

interface PaymentItem {
  subscriberPaymentId: string;
  amountBob: string;
  coversUntil: string;
  reference: string | null;
  recordedBy: string;
  recordedAt: string;
}

interface MemberItem {
  memberId: string;
  email: string;
  fullName: string;
  status: 'ACTIVE' | 'REMOVED';
  createdAt: string;
  activated: boolean;
}

type Listing<T> = { state: 'idle' } | { state: 'loading' } | { state: 'ready'; items: T[] } | { state: 'failed'; message: string };

function useListing<T>(url: string) {
  const [listing, setListing] = useState<Listing<T>>({ state: 'idle' });
  const load = useCallback(async () => {
    setListing({ state: 'loading' });
    const result = await read<T>(url);
    setListing(result.ok ? { state: 'ready', items: result.items } : { state: 'failed', message: result.message });
  }, [url]);
  return [listing, load] as const;
}

function ListingNote<T>({
  listing,
  loading,
  empty,
  retry,
}: {
  listing: Listing<T>;
  loading: string;
  empty: string;
  retry: () => void;
}) {
  if (listing.state === 'idle' || listing.state === 'loading') return <p role="status">{loading}</p>;
  if (listing.state === 'failed') {
    return (
      <div className="admin-inquiry-form">
        <p className="admin-inquiry-problem" role="alert">
          {listing.message}
        </p>
        <button type="button" onClick={retry}>
          Volver a intentar
        </button>
      </div>
    );
  }
  return listing.items.length === 0 ? <p>{empty}</p> : null;
}

export function ClientActions({
  csrf,
  id,
  fullName,
  planCode,
  status,
  lockedUntilText,
  maxMembers,
}: {
  csrf: string;
  id: string;
  /** Para nombrar la ficha ante un lector de pantalla. */
  fullName: string;
  planCode: string;
  /** El estado guardado, no el efectivo: es el que el operador cambia. */
  status: string;
  /** Hasta cuándo está bloqueado el ingreso, ya escrito; `null` si no lo está. */
  lockedUntilText: string | null;
  /** Cuántos miembros admite el plan además del titular. */
  maxMembers: number;
}) {
  const router = useRouter();
  const formId = useId();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [link, setLink] = useState<IssuedLink | null>(null);
  const [payments, loadPayments] = useListing<PaymentItem>(`/api/admin/clientes/${id}/pagos`);
  const [members, loadMembers] = useListing<MemberItem>(`/api/admin/clientes/${id}/miembros`);

  const run = async (
    what: string,
    url: string,
    method: 'POST' | 'PATCH',
    body: unknown,
    after?: (data: Record<string, unknown> | null) => void,
  ) => {
    setBusy(what);
    setProblem(null);
    setDone(null);
    setLink(null);
    const result = await send(url, method, csrf, body);
    setBusy(null);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    after?.(result.data);
    router.refresh();
  };

  const pay = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void run(
      'pago',
      `/api/admin/clientes/${id}/pagos`,
      'POST',
      {
        amountBob: parseAmount(String(data.get('amountBob') ?? '')),
        coversUntil: String(data.get('coversUntil') ?? ''),
        reference: String(data.get('reference') ?? ''),
      },
      (answer) => {
        form.reset();
        const paidUntil = (answer?.['account'] as { paidUntil?: string | null } | undefined)?.paidUntil;
        setDone(paidUntil ? `Pago registrado. La cuenta queda vigente hasta el ${day(paidUntil)}.` : 'Pago registrado.');
        void loadPayments();
      },
    );
  };

  const change = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body: Record<string, string> = {};
    const nextPlan = String(data.get('planCode') ?? '');
    const nextStatus = String(data.get('status') ?? '');
    if (nextPlan && nextPlan !== planCode) body['planCode'] = nextPlan;
    if (nextStatus && nextStatus !== status) body['status'] = nextStatus;
    if (Object.keys(body).length === 0) {
      setDone(null);
      setProblem('No hay cambios que guardar.');
      return;
    }
    if (body['status'] === 'CANCELLED' && !window.confirm(`¿Cancelar la cuenta de ${fullName}? Pierde el acceso al plan.`)) {
      return;
    }
    void run('cambio', `/api/admin/clientes/${id}`, 'PATCH', body, () => setDone('Cuenta actualizada.'));
  };

  const unlock = () =>
    void run('desbloqueo', `/api/admin/clientes/${id}`, 'PATCH', { unlock: true }, () =>
      setDone('Ingreso desbloqueado.'),
    );

  const revoke = () => {
    if (!window.confirm(`¿Cerrar todas las sesiones de ${fullName} y de sus miembros? Deberán volver a ingresar.`)) return;
    void run('sesiones', `/api/admin/clientes/${id}/sesiones`, 'POST', {}, () =>
      setDone('Sesiones cerradas: la cuenta y sus miembros deben volver a ingresar.'),
    );
  };

  const issue = (purpose: 'ACTIVATE' | 'RESET') =>
    void run(purpose, `/api/admin/clientes/${id}/enlace`, 'POST', { purpose }, (data) => setLink(issued(data, 'link')));

  const field = (name: string): string => `${formId}-${name}`;
  const idle = busy === null;

  return (
    <details
      className="admin-cliente-acciones"
      onToggle={(event) => {
        if (!event.currentTarget.open) return;
        if (payments.state === 'idle') void loadPayments();
        if (members.state === 'idle') void loadMembers();
      }}
    >
      <summary aria-label={`Gestionar la cuenta de ${fullName}`}>Gestionar</summary>

      <section aria-labelledby={field('acceso')}>
        <h3 id={field('acceso')}>Acceso</h3>
        {lockedUntilText ? <p>El ingreso está bloqueado hasta {lockedUntilText} por intentos fallidos.</p> : null}
        <div className="admin-inquiry-form">
          {lockedUntilText ? (
            <button type="button" disabled={!idle} onClick={unlock}>
              {busy === 'desbloqueo' ? 'Desbloqueando…' : 'Desbloquear'}
            </button>
          ) : null}
          <button type="button" disabled={!idle} onClick={revoke}>
            {busy === 'sesiones' ? 'Cerrando sesiones…' : 'Cerrar sesiones'}
          </button>
          <button type="button" disabled={!idle} onClick={() => issue('RESET')}>
            {busy === 'RESET' ? 'Generando…' : 'Generar enlace de contraseña'}
          </button>
          <button type="button" disabled={!idle} onClick={() => issue('ACTIVATE')}>
            {busy === 'ACTIVATE' ? 'Generando…' : 'Reenviar activación'}
          </button>
        </div>
        {link ? <LinkBox {...link} /> : null}
      </section>

      <section aria-labelledby={field('pago')}>
        <h3 id={field('pago')}>Registrar pago</h3>
        <form className="admin-cliente-form" onSubmit={pay} aria-busy={busy === 'pago'}>
          <label>
            Monto (Bs)
            <input
              name="amountBob"
              type="text"
              inputMode="decimal"
              required
              placeholder="350,00"
              autoComplete="off"
            />
          </label>
          <label>
            Cubre hasta
            <input name="coversUntil" type="date" required />
          </label>
          <label>
            Referencia o comprobante
            <input name="reference" type="text" maxLength={200} autoComplete="off" />
          </label>
          <button type="submit" disabled={!idle}>
            {busy === 'pago' ? 'Registrando…' : 'Registrar pago'}
          </button>
        </form>
      </section>

      <section aria-labelledby={field('plan')}>
        <h3 id={field('plan')}>Plan y estado</h3>
        <form className="admin-cliente-form" onSubmit={change} aria-busy={busy === 'cambio'}>
          <label>
            Plan
            <select name="planCode" defaultValue={planCode}>
              {PLAN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select name="status" defaultValue={STATUS_OPTIONS.some((option) => option.value === status) ? status : ''}>
              <option value="">Sin cambiar</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={!idle}>
            {busy === 'cambio' ? 'Guardando…' : 'Guardar plan y estado'}
          </button>
        </form>
      </section>

      {done ? <p role="status">{done}</p> : null}
      {problem ? (
        <p className="admin-inquiry-problem" role="alert">
          {problem}
        </p>
      ) : null}

      <section aria-labelledby={field('pagos')}>
        <h3 id={field('pagos')}>Pagos registrados</h3>
        <ListingNote
          listing={payments}
          loading="Cargando los pagos…"
          empty="Sin pagos registrados."
          retry={() => void loadPayments()}
        />
        {payments.state === 'ready' && payments.items.length > 0 ? (
          <ul>
            {payments.items.map((payment) => (
              <li key={payment.subscriberPaymentId}>
                <strong>{bolivianos(payment.amountBob)}</strong>, cubre hasta el {dateOnly(payment.coversUntil)}
                {payment.reference ? <> · {payment.reference}</> : null}
                <br />
                <small>
                  Registrado el {instant(payment.recordedAt)} por {payment.recordedBy}
                </small>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby={field('miembros')}>
        <h3 id={field('miembros')}>
          Miembros{' '}
          <small>
            {maxMembers > 0
              ? `(el plan admite ${maxMembers} además del titular)`
              : '(el plan es de un solo usuario)'}
          </small>
        </h3>
        <ListingNote
          listing={members}
          loading="Cargando los miembros…"
          empty="La cuenta no tiene miembros."
          retry={() => void loadMembers()}
        />
        {members.state === 'ready' && members.items.length > 0 ? (
          <ul>
            {members.items.map((member) => (
              <li key={member.memberId}>
                <strong>{member.fullName}</strong> · <a href={`mailto:${member.email}`}>{member.email}</a>
                <br />
                <small>
                  {member.status === 'ACTIVE' ? 'Activo' : 'Retirado'} ·{' '}
                  {member.activated ? 'contraseña fijada' : 'sin activar'} · alta el {day(member.createdAt)}
                </small>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </details>
  );
}

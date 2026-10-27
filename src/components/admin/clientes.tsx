'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';

/**
 * Los formularios de «Clientes»: crear una cuenta, registrar un pago, cambiar
 * plan o estado y generar un enlace. Todos van por `/api/admin/clientes/*` con
 * el token CSRF de la sesión, igual que el estado de un pedido.
 */

export const PLAN_OPTIONS = [
  { value: 'analista', label: 'Analista' },
  { value: 'profesional', label: 'Profesional' },
  { value: 'institucional', label: 'Institucional' },
] as const;

export const STATUS_OPTIONS = [
  { value: 'TRIAL', label: 'En prueba' },
  { value: 'ACTIVE', label: 'Vigente' },
  { value: 'GRACE', label: 'En gracia' },
  { value: 'SUSPENDED', label: 'Suspendida' },
  { value: 'CANCELLED', label: 'Cancelada' },
] as const;

async function send(
  url: string,
  method: 'POST' | 'PATCH',
  csrf: string,
  body: unknown,
): Promise<{ ok: true; data: Record<string, unknown> | null } | { ok: false; message: string }> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', 'x-obs-csrf': csrf },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      const message = (data?.['error'] as { message?: string } | undefined)?.message;
      return { ok: false, message: message ?? `No se guardó (${response.status}).` };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, message: 'Sin conexión con el servidor.' };
  }
}

function LinkBox({ link, emailed, mailConfigured }: { link: string; emailed: boolean; mailConfigured: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="admin-cliente-enlace" role="status">
      <p>
        <strong>Enlace de un solo uso.</strong>{' '}
        {emailed
          ? 'También se mandó por correo al cliente.'
          : mailConfigured
            ? 'El correo no salió: copiar el enlace y mandarlo a mano.'
            : 'Este despliegue no manda correos: copiar el enlace y mandarlo a mano.'}
      </p>
      <input type="text" readOnly value={link} onFocus={(event) => event.currentTarget.select()} aria-label="Enlace" />
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard
            .writeText(link)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        {copied ? 'Copiado' : 'Copiar el enlace'}
      </button>
    </div>
  );
}

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
  const [created, setCreated] = useState<{ link: string; emailed: boolean; mailConfigured: boolean } | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setProblem(null);
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
    setCreated({
      link: String(result.data?.['activationLink'] ?? ''),
      emailed: result.data?.['emailed'] === true,
      mailConfigured: result.data?.['mailConfigured'] === true,
    });
    form.reset();
    router.refresh();
  };

  const plan = PLAN_OPTIONS.some((option) => option.value === prefill?.planCode) ? prefill?.planCode : 'analista';

  return (
    <>
      <form className="admin-cliente-form" onSubmit={(event) => void submit(event)}>
        <label>
          Correo
          <input name="email" type="email" required maxLength={254} defaultValue={prefill?.email ?? ''} />
        </label>
        <label>
          Nombre
          <input name="fullName" type="text" required maxLength={160} defaultValue={prefill?.fullName ?? ''} />
        </label>
        <label>
          Organización
          <input name="organization" type="text" maxLength={160} defaultValue={prefill?.organization ?? ''} />
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
          {busy ? 'Creando…' : 'Crear cuenta'}
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

export function ClientActions({
  csrf,
  id,
  email,
  fullName,
  planCode,
  status,
}: {
  csrf: string;
  id: string;
  email: string;
  fullName: string;
  planCode: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [link, setLink] = useState<{ link: string; emailed: boolean; mailConfigured: boolean } | null>(null);

  const run = async (what: string, url: string, method: 'POST' | 'PATCH', body: unknown, after?: (data: Record<string, unknown> | null) => void) => {
    setBusy(what);
    setProblem(null);
    setDone(null);
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
        amountBob: Number(String(data.get('amountBob') ?? '').replace(',', '.')),
        coversUntil: String(data.get('coversUntil') ?? ''),
        reference: String(data.get('reference') ?? ''),
      },
      () => {
        form.reset();
        setDone('Pago registrado.');
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
      setProblem('No hay cambios.');
      return;
    }
    void run('cambio', `/api/admin/clientes/${id}`, 'PATCH', body, () => setDone('Cuenta actualizada.'));
  };

  const issue = (purpose: 'ACTIVATE' | 'RESET') =>
    void run(purpose, `/api/admin/clientes/${id}/enlace`, 'POST', { purpose, email, fullName }, (data) =>
      setLink({
        link: String(data?.['link'] ?? ''),
        emailed: data?.['emailed'] === true,
        mailConfigured: data?.['mailConfigured'] === true,
      }),
    );

  return (
    <details className="admin-cliente-acciones">
      <summary>Gestionar</summary>
      <form className="admin-inquiry-form" onSubmit={pay}>
        <label>
          <span className="sr-only">Monto en Bs</span>
          <input name="amountBob" type="text" inputMode="decimal" required placeholder="Monto (Bs)" />
        </label>
        <label>
          <span className="sr-only">Cubre hasta</span>
          <input name="coversUntil" type="date" required />
        </label>
        <label>
          <span className="sr-only">Referencia</span>
          <input name="reference" type="text" maxLength={200} placeholder="Referencia o comprobante" />
        </label>
        <button type="submit" disabled={busy !== null}>
          {busy === 'pago' ? 'Guardando…' : 'Registrar pago'}
        </button>
      </form>
      <form className="admin-inquiry-form" onSubmit={change}>
        <label>
          <span className="sr-only">Plan</span>
          <select name="planCode" defaultValue={planCode}>
            {PLAN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Estado</span>
          <select name="status" defaultValue={STATUS_OPTIONS.some((option) => option.value === status) ? status : ''}>
            <option value="">Sin cambiar el estado</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy !== null}>
          {busy === 'cambio' ? 'Guardando…' : 'Guardar plan y estado'}
        </button>
      </form>
      <div className="admin-inquiry-form">
        <button type="button" disabled={busy !== null} onClick={() => issue('RESET')}>
          {busy === 'RESET' ? 'Generando…' : 'Generar enlace de contraseña'}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => issue('ACTIVATE')}>
          {busy === 'ACTIVATE' ? 'Generando…' : 'Reenviar activación'}
        </button>
      </div>
      {link ? <LinkBox {...link} /> : null}
      {done ? <p role="status">{done}</p> : null}
      {problem ? (
        <p className="admin-inquiry-problem" role="alert">
          {problem}
        </p>
      ) : null}
    </details>
  );
}

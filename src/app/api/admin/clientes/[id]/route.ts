import { BILLING_PERIODS, PAID_PLAN_CODES, SETTABLE_STATUSES, isUuid } from '@/lib/cuenta/puro';
import { adminError, adminOk, operatorFor, updateAccount } from '@/lib/cuenta/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cambia el plan, el periodo, el estado o los datos de facturación de una cuenta. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await operatorFor(request);
  if (session instanceof Response) return session;
  const { id } = await params;
  if (!isUuid(id)) return adminError(400, 'VALIDATION_ERROR', 'La cuenta no es válida.');

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const changes: Record<string, unknown> = {};
  const planCode = body?.['planCode'];
  if (planCode !== undefined) {
    if (!(PAID_PLAN_CODES as readonly unknown[]).includes(planCode)) return adminError(400, 'VALIDATION_ERROR', 'El plan no es válido.');
    changes['planCode'] = planCode;
  }
  const billingPeriod = body?.['billingPeriod'];
  if (billingPeriod !== undefined) {
    if (!(BILLING_PERIODS as readonly unknown[]).includes(billingPeriod)) return adminError(400, 'VALIDATION_ERROR', 'El periodo no es válido.');
    changes['billingPeriod'] = billingPeriod;
  }
  const status = body?.['status'];
  if (status !== undefined) {
    if (!(SETTABLE_STATUSES as readonly unknown[]).includes(status)) return adminError(400, 'VALIDATION_ERROR', 'El estado no es válido.');
    changes['status'] = status;
  }
  for (const campo of ['legalName', 'taxId', 'organization'] as const) {
    const valor = body?.[campo];
    if (valor === undefined) continue;
    if (valor !== null && typeof valor !== 'string') return adminError(400, 'VALIDATION_ERROR', 'Un dato de la cuenta no es válido.');
    changes[campo] = typeof valor === 'string' && valor.trim() ? valor.trim().slice(0, 160) : null;
  }
  if (Object.keys(changes).length === 0) return adminError(400, 'VALIDATION_ERROR', 'No hay cambios.');

  const result = await updateAccount(session, id, changes);
  if (!result.ok) return adminError(result.status, result.code, result.message);
  return adminOk(result.body);
}

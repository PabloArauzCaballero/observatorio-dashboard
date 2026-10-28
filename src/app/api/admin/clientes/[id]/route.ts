import { BILLING_PERIODS, PAID_PLAN_CODES, isUuid } from '@/lib/cuenta/puro';
import { OPERATOR_STATUSES, adminError, adminOk, coreRefusal, operatorFor, updateAccount } from '@/lib/cuenta/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Los datos de facturación y su tope en el esquema del núcleo. */
const TEXT_FIELDS = { organization: 160, legalName: 200, taxId: 40 } as const;

const invalid = (message: string): Response => adminError(400, 'VALIDATION_ERROR', message);

/**
 * Cambia el plan, el periodo, el estado o los datos de facturación de una
 * cuenta, o la desbloquea (`unlock: true`) tras los intentos fallidos de
 * ingreso. Un texto vacío o `null` borra el dato; un campo ausente lo deja.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await operatorFor(request);
  if (session instanceof Response) return session;
  const { id } = await params;
  if (!isUuid(id)) return invalid('La cuenta no es válida.');

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid('No hay cambios.');

  const changes: Record<string, unknown> = {};
  const planCode = body['planCode'];
  if (planCode !== undefined) {
    if (!(PAID_PLAN_CODES as readonly unknown[]).includes(planCode)) return invalid('El plan no es válido.');
    changes['planCode'] = planCode;
  }
  const billingPeriod = body['billingPeriod'];
  if (billingPeriod !== undefined) {
    if (!(BILLING_PERIODS as readonly unknown[]).includes(billingPeriod)) return invalid('El periodo no es válido.');
    changes['billingPeriod'] = billingPeriod;
  }
  const status = body['status'];
  if (status !== undefined) {
    if (!(OPERATOR_STATUSES as readonly unknown[]).includes(status)) return invalid('El estado no es válido.');
    changes['status'] = status;
  }
  for (const [campo, max] of Object.entries(TEXT_FIELDS)) {
    const valor = body[campo];
    if (valor === undefined) continue;
    if (valor !== null && typeof valor !== 'string') return invalid('Un dato de la cuenta no es válido.');
    const limpio = typeof valor === 'string' ? valor.replace(/\s+/gu, ' ').trim() : '';
    if (limpio.length > max) return invalid(`Un dato de la cuenta pasa de ${max} caracteres.`);
    changes[campo] = limpio || null;
  }
  const unlock = body['unlock'];
  if (unlock !== undefined) {
    if (unlock !== true) return invalid('El desbloqueo no es válido.');
    changes['unlock'] = true;
  }
  if (Object.keys(changes).length === 0) return invalid('No hay cambios.');

  const result = await updateAccount(session, id, changes);
  if (!result.ok) return coreRefusal('actualizar cuenta', result);
  return adminOk(result.body.data);
}

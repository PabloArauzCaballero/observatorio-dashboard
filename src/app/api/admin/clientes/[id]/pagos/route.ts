import { isIsoDate, isUuid } from '@/lib/cuenta/puro';
import {
  adminError,
  adminOk,
  coreRefusal,
  listPayments,
  operatorFor,
  operatorForRead,
  registerPayment,
} from '@/lib/cuenta/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AMOUNT_MAX = 10_000_000;

/** El historial de pagos de una cuenta, del más reciente al más antiguo. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await operatorForRead();
  if (session instanceof Response) return session;
  const { id } = await params;
  if (!isUuid(id)) return adminError(400, 'VALIDATION_ERROR', 'La cuenta no es válida.');

  const result = await listPayments(session, id);
  if (!result.ok) return coreRefusal('listar pagos', result);
  return adminOk({ items: result.body.data?.items ?? [] });
}

/**
 * Registra un pago a mano. El núcleo extiende la vigencia hasta el final de
 * `coversUntil` en La Paz —nunca la acorta— y no borra pagos: una corrección
 * es otro registro.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await operatorFor(request);
  if (session instanceof Response) return session;
  const { id } = await params;
  if (!isUuid(id)) return adminError(400, 'VALIDATION_ERROR', 'La cuenta no es válida.');

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const amountBob = Number(body?.['amountBob']);
  const coversUntil = body?.['coversUntil'];
  const reference =
    typeof body?.['reference'] === 'string' ? body['reference'].replace(/\s+/gu, ' ').trim().slice(0, 200) : '';
  if (!Number.isFinite(amountBob) || amountBob <= 0 || amountBob > AMOUNT_MAX || !isIsoDate(coversUntil)) {
    return adminError(400, 'VALIDATION_ERROR', 'Revisar el monto en bolivianos y la fecha hasta la que cubre.');
  }

  const result = await registerPayment(session, id, {
    amountBob: Math.round(amountBob * 100) / 100,
    coversUntil,
    ...(reference ? { reference } : {}),
  });
  if (!result.ok) return coreRefusal('registrar pago', result);
  return adminOk(result.body.data ?? null, 201);
}

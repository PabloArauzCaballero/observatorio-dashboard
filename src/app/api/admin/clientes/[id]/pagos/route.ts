import { isIsoDate, isUuid } from '@/lib/cuenta/puro';
import { adminError, adminOk, operatorFor, registerPayment } from '@/lib/cuenta/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Registra un pago a mano. El núcleo extiende la vigencia hasta `coversUntil`
 * y nunca borra un pago: una corrección es otro registro.
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
  if (!Number.isFinite(amountBob) || amountBob <= 0 || amountBob > 10_000_000 || !isIsoDate(coversUntil)) {
    return adminError(400, 'VALIDATION_ERROR', 'Revisar el monto en bolivianos y la fecha hasta la que cubre.');
  }

  const result = await registerPayment(session, id, {
    amountBob: Math.round(amountBob * 100) / 100,
    coversUntil,
    ...(reference ? { reference } : {}),
  });
  if (!result.ok) return adminError(result.status, result.code, result.message);
  return adminOk(result.body ?? null, 201);
}

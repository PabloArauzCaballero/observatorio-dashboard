import { BILLING_PERIODS, PAID_PLAN_CODES, isUuid, normalizeEmail } from '@/lib/cuenta/puro';
import {
  adminError,
  adminOk,
  createAccount,
  linkFor,
  mailIsConfigured,
  mailLink,
  operatorFor,
} from '@/lib/cuenta/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const texto = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, max) : '';

/**
 * Crea una cuenta de cliente y devuelve el enlace de activación para copiarlo.
 * Si el despliegue tiene Resend configurado, también lo manda por correo.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await operatorFor(request);
  if (session instanceof Response) return session;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = normalizeEmail(body?.['email']);
  const fullName = texto(body?.['fullName'], 160);
  const organization = texto(body?.['organization'], 160);
  const planCode = body?.['planCode'];
  const billingPeriod = body?.['billingPeriod'];
  const trial = body?.['trial'] === true;
  const inquiry = body?.['serviceInquiryId'];
  if (
    !email ||
    fullName.length < 2 ||
    !(PAID_PLAN_CODES as readonly unknown[]).includes(planCode) ||
    !(BILLING_PERIODS as readonly unknown[]).includes(billingPeriod) ||
    (inquiry !== undefined && inquiry !== null && inquiry !== '' && !isUuid(inquiry))
  ) {
    return adminError(400, 'VALIDATION_ERROR', 'Revisar el correo, el nombre, el plan y el periodo.');
  }

  const result = await createAccount(session, {
    email,
    fullName,
    ...(organization ? { organization } : {}),
    planCode: planCode as (typeof PAID_PLAN_CODES)[number],
    billingPeriod: billingPeriod as (typeof BILLING_PERIODS)[number],
    ...(trial ? { trialDays: 7 } : {}),
    ...(isUuid(inquiry) ? { serviceInquiryId: inquiry } : {}),
  });
  if (!result.ok) {
    if (result.status === 409) return adminError(409, 'DUPLICATE', 'Ya existe una cuenta con ese correo.');
    return adminError(result.status, result.code, result.message);
  }

  const { account, activationToken, activationExpiresAt } = result.body.data;
  const link = linkFor(request, activationToken);
  const emailed = mailIsConfigured() ? await mailLink(account.email, account.fullName, link, 'ACTIVATE') : false;
  return adminOk(
    { account, activationLink: link, activationExpiresAt, emailed, mailConfigured: mailIsConfigured() },
    201,
  );
}

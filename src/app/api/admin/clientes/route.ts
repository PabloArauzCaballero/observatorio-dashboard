import { BILLING_PERIODS, PAID_PLAN_CODES, isUuid, normalizeEmail } from '@/lib/cuenta/puro';
import {
  adminError,
  adminOk,
  coreRefusal,
  createAccount,
  linkFor,
  mailIsConfigured,
  mailLink,
  operatorFor,
} from '@/lib/cuenta/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Los topes del esquema del núcleo: un texto más largo volvería como un 400 sin explicación. */
const FULL_NAME_MAX = 120;
const ORGANIZATION_MAX = 160;
const TRIAL_DAYS = 7;

const texto = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, max) : '';

/**
 * Crea una cuenta de cliente y devuelve el enlace de activación. Con Resend
 * configurado, el enlace sale por correo al cliente; sin él, o si el envío
 * falla, se muestra para copiarlo y mandarlo a mano.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await operatorFor(request);
  if (session instanceof Response) return session;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = normalizeEmail(body?.['email']);
  const fullName = texto(body?.['fullName'], FULL_NAME_MAX);
  const organization = texto(body?.['organization'], ORGANIZATION_MAX);
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
    ...(trial ? { trialDays: TRIAL_DAYS } : {}),
    ...(isUuid(inquiry) ? { serviceInquiryId: inquiry } : {}),
  });
  if (!result.ok) {
    return coreRefusal('crear cuenta', result, 'Ese correo ya pertenece a una cuenta o a un miembro de otra cuenta.');
  }

  const { account, activationToken, activationExpiresAt } = result.body.data;
  const link = linkFor(request, activationToken);
  const mailConfigured = mailIsConfigured();
  const emailed = mailConfigured ? await mailLink(account.email, account.fullName, link, 'ACTIVATE') : false;
  return adminOk({ account, activationLink: link, activationExpiresAt, emailed, mailConfigured }, 201);
}

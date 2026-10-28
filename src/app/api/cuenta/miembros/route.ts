import { admit, clientIp } from '@/lib/ip-limit';
import { membersAllowed } from '@/lib/plans';
import { activationLink, memberInvite } from '@/lib/cuenta/puro';
import {
  answer,
  customerFor,
  foreignOrigin,
  inviteMember,
  mailAccountLink,
  mailIsConfigured,
  publicSiteOrigin,
  readJson,
  refuse,
  requestIsSameOrigin,
  tooMany,
} from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Suma una persona a la cuenta. Solo la titular, con la cuenta vigente y dentro
 * de los usuarios del plan: el tope sale de `plans.ts` y lo hace cumplir el
 * núcleo (409 si ya se alcanzó).
 *
 * El enlace para que la persona fije su contraseña vuelve a la titular, que ya
 * está identificada, para copiarlo; si hay correo configurado, además se manda.
 * No llega al registro.
 */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return foreignOrigin();
  const admission = admit('cuenta-miembros', clientIp(request), 20, 60 * 60 * 1000);
  if (!admission.ok) return tooMany(admission.retryAfter);
  const contexto = await customerFor(request, 'owner');
  if (contexto instanceof Response) return contexto;
  const { customer, detail, plan } = contexto;

  if (!detail.account.entitled) return refuse(403, 'NOT_ENTITLED', 'La cuenta no está vigente.');
  const maximo = plan ? membersAllowed(plan) : 0;
  if (maximo <= 0) return refuse(403, 'NOT_ENTITLED', 'El plan no incluye otros usuarios.');

  const datos = memberInvite(await readJson(request));
  if (!datos.ok) return refuse(400, 'VALIDATION_ERROR', datos.message, { field: datos.field });
  if (datos.value.email === detail.account.email) {
    return refuse(400, 'VALIDATION_ERROR', 'Ese correo es el de la titular de la cuenta.', { field: 'email' });
  }

  const result = await inviteMember(customer.accountId, datos.value.email, datos.value.fullName, maximo);
  if (!result.ok) {
    if (result.status === 409) {
      // Un solo mensaje para los dos 409: distinguirlos diría qué correos tienen cuenta en otra parte.
      return refuse(
        409,
        'MEMBER_CONFLICT',
        'No se pudo sumar a esa persona: el plan ya tiene todos sus usuarios o el correo ya está en uso.',
        { field: 'email' },
      );
    }
    return refuse(503, 'CORE_REFUSED', 'No se pudo sumar a la persona. Intentar de nuevo en unos minutos.');
  }

  const creado = result.body?.data;
  if (!creado?.member || typeof creado.activationToken !== 'string') {
    return refuse(503, 'CORE_REFUSED', 'No se pudo sumar a la persona. Intentar de nuevo en unos minutos.');
  }
  const enlace = activationLink(publicSiteOrigin(), creado.activationToken);
  const enviado = mailIsConfigured()
    ? await mailAccountLink({
        to: creado.member.email,
        purpose: 'INVITE',
        fullName: creado.member.fullName,
        link: enlace,
        expiresAt: creado.activationExpiresAt,
        accountName: detail.account.organization ?? detail.account.fullName,
      })
    : false;
  return answer({ miembro: creado.member, enlace, vence: creado.activationExpiresAt ?? null, enviado }, 201);
}

import { isUuid, normalizeEmail } from '@/lib/cuenta/puro';
import { adminError, adminOk, issueToken, linkFor, mailIsConfigured, mailLink, operatorFor } from '@/lib/cuenta/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Emite un enlace de un solo uso: activar (si el primero venció) o recuperar
 * la contraseña. Se muestra para copiarlo y, con Resend configurado, se manda.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await operatorFor(request);
  if (session instanceof Response) return session;
  const { id } = await params;
  if (!isUuid(id)) return adminError(400, 'VALIDATION_ERROR', 'La cuenta no es válida.');

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const purpose = body?.['purpose'] === 'ACTIVATE' ? 'ACTIVATE' : body?.['purpose'] === 'RESET' ? 'RESET' : null;
  if (!purpose) return adminError(400, 'VALIDATION_ERROR', 'El tipo de enlace no es válido.');

  const result = await issueToken(session, id, purpose);
  if (!result.ok) return adminError(result.status, result.code, result.message);

  const link = linkFor(request, result.body.data.token);
  // El correo y el nombre los manda la pantalla, que ya los tiene; si faltan, solo se muestra el enlace.
  const email = normalizeEmail(body?.['email']);
  const fullName = typeof body?.['fullName'] === 'string' ? body['fullName'].slice(0, 160) : '';
  const emailed = mailIsConfigured() && email ? await mailLink(email, fullName || email, link, purpose) : false;
  return adminOk({ link, expiresAt: result.body.data.expiresAt, emailed, mailConfigured: mailIsConfigured() }, 201);
}

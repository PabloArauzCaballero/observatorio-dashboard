import { isUuid } from '@/lib/cuenta/puro';
import { readAccount } from '@/lib/cuenta/servidor';
import {
  adminError,
  adminOk,
  coreRefusal,
  issueToken,
  linkFor,
  mailIsConfigured,
  mailLink,
  operatorFor,
} from '@/lib/cuenta/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Emite un enlace de un solo uso: activar (si el primero venció) o recuperar
 * la contraseña. Se muestra para copiarlo y, con Resend configurado, se manda.
 *
 * El destinatario sale de la cuenta guardada en el núcleo, nunca del cuerpo de
 * la petición: si no, el enlace para fijar la contraseña de una cuenta podría
 * mandarse a cualquier dirección.
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
  if (!result.ok) return coreRefusal('emitir enlace', result);

  const link = linkFor(request, result.body.data.token);
  const mailConfigured = mailIsConfigured();
  let emailed = false;
  if (mailConfigured) {
    const stored = await readAccount(id);
    if (stored.ok) {
      const { email, fullName } = stored.body.data.account;
      emailed = await mailLink(email, fullName, link, purpose);
    }
  }
  return adminOk({ link, expiresAt: result.body.data.expiresAt, emailed, mailConfigured }, 201);
}

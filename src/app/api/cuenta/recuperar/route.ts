import { after } from 'next/server';
import { HOUR_MS, admit, clientIp } from '@/lib/ip-limit';
import { activationLink, isActivationToken, normalizeEmail } from '@/lib/cuenta/puro';
import {
  accountsAreConfigured,
  answer,
  foreignOrigin,
  mailAccountLink,
  mailIsConfigured,
  publicSiteOrigin,
  readJson,
  refuse,
  requestIsSameOrigin,
  requestPasswordReset,
  tooMany,
} from '@/lib/cuenta/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QUINCE_MINUTOS = 15 * 60 * 1000;

/** La única respuesta de esta ruta a un pedido bien formado. */
const ACEPTADO = {
  mensaje:
    'Si el correo corresponde a una cuenta de DatosBolivia.com, en unos minutos llega un enlace para fijar una contraseña nueva.',
};

/**
 * Pide un enlace para fijar una contraseña nueva, sin sesión.
 *
 * Contesta siempre el mismo 202, exista o no el correo, haya o no salido el
 * mensaje: cualquier diferencia diría qué correos tienen cuenta. Por la misma
 * razón el correo sale después de responder (`after`), para que el tiempo de
 * respuesta no delate nada, y el freno por correo calla en vez de contestar 429.
 *
 * Ni el correo ni el token llegan al registro. El enlace solo viaja por correo:
 * mostrarlo aquí se lo daría a quien escribió una dirección ajena. Sin Resend
 * configurado ni siquiera se pide al núcleo, y la recuperación queda en manos
 * del operador.
 */
export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) return foreignOrigin();
  const admission = admit('cuenta-recuperar', clientIp(request), 5, QUINCE_MINUTOS);
  if (!admission.ok) return tooMany(admission.retryAfter);
  if (!accountsAreConfigured()) {
    return refuse(503, 'NOT_CONFIGURED', 'Las cuentas no están disponibles en este momento.');
  }

  const body = await readJson<{ email: unknown }>(request);
  const email = normalizeEmail(body?.email);
  if (!email) return refuse(400, 'VALIDATION_ERROR', 'Escribir el correo de la cuenta.', { field: 'email' });

  // Tres enlaces por correo y por hora: un buzón no se llena con pedidos ajenos.
  if (!admit('cuenta-recuperar-correo', email, 3, HOUR_MS).ok) return answer(ACEPTADO, 202);

  // Sin correo no se pide el enlace: emitirlo anularía el que haya dado un operador y no llegaría a nadie.
  if (!mailIsConfigured()) {
    console.warn('[cuenta] Se pidió recuperar una clave, pero el correo no está configurado: no se emitió el enlace.');
    return answer(ACEPTADO, 202);
  }

  const result = await requestPasswordReset(email);
  const datos = result.ok ? result.body?.data : undefined;
  const token = datos?.token;
  // El enlace va al correo tal como lo guarda el núcleo, nunca al escrito en el formulario.
  const guardado = typeof datos?.email === 'string' && datos.email.includes('@') ? datos.email : null;
  if (isActivationToken(token) && guardado) {
    const mensaje = {
      to: guardado,
      purpose: 'RESET' as const,
      fullName: typeof datos?.fullName === 'string' && datos.fullName.trim() ? datos.fullName : guardado,
      link: activationLink(publicSiteOrigin(), token),
      expiresAt: datos?.expiresAt ?? null,
    };
    after(() => mailAccountLink(mensaje));
  } else if (!result.ok && result.status >= 500) {
    console.error('[cuenta] El núcleo no atendió un pedido de recuperación', result.status);
  }
  return answer(ACEPTADO, 202);
}

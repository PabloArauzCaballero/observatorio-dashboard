import { checkInquiry } from '@/lib/inquiry';
import { HOUR_MS, admit, clientIp } from '@/lib/ip-limit';
import { inquiriesAreConfigured, recordInquiry } from '@/lib/servicios';

/**
 * El formulario de «Servicios»: un pedido de alguien que quiere un plan.
 *
 * Se valida aquí para contestar en el acto y se guarda en el núcleo, que lo
 * muestra en `/admin/pedidos`. Cinco envíos por hora y por dirección bastan para
 * quien se equivocó y quiere corregir, y frenan a quien quiere llenar la bandeja.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SENT = { ok: true, mensaje: 'Pedido recibido. La respuesta llega por correo en un día hábil.' };

export async function POST(request: Request): Promise<Response> {
  const admission = admit('servicios-contacto', clientIp(request), 5, HOUR_MS);
  if (!admission.ok) {
    return Response.json(
      { error: 'Ya se recibieron varios pedidos desde esta conexión. Volver a intentar en un rato o escribir por WhatsApp o correo.' },
      { status: 429, headers: { 'Retry-After': String(admission.retryAfter) } },
    );
  }

  const check = checkInquiry(await request.json().catch(() => null));
  if (!check.ok) {
    // A un robot se le contesta como a cualquiera: decirle por qué falló es enseñarle.
    if (check.spam) return Response.json(SENT, { status: 202 });
    return Response.json({ error: check.error, campo: check.field ?? null }, { status: 400 });
  }

  if (!inquiriesAreConfigured()) {
    console.error('[servicios] pedido sin núcleo configurado: CORE_API_URL o ADMIN_JWT_PRIVATE_KEY faltan');
    return Response.json(
      { error: 'No se pudo registrar el pedido en este momento. Escribir por WhatsApp o correo, o volver a intentar en unos minutos.' },
      { status: 503 },
    );
  }

  const result = await recordInquiry(check.value);
  if (!result.ok) {
    // Sin el contenido del pedido: el registro no es lugar para el correo ni el mensaje de nadie.
    console.error('[servicios] el núcleo no guardó el pedido', result.status, result.code);
    return Response.json(
      { error: 'No se pudo registrar el pedido en este momento. Escribir por WhatsApp o correo, o volver a intentar en unos minutos.' },
      { status: result.status === 400 ? 400 : 503 },
    );
  }
  return Response.json(SENT, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}

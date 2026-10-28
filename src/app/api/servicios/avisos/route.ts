import { noticesAreConfigured, noticesSecret, runNotices } from '@/lib/cuenta/avisos';
import { bearerMatches } from '@/lib/cuenta/avisos-puro';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'cache-control': 'no-store' };

const refuse = (status: number, code: string, message: string): Response =>
  Response.json({ error: { code, message } }, { status, headers: noStore });

/**
 * La corrida de avisos a clientes: consumo al 80 %, vencimiento en cinco días
 * y periodo de gracia. La llama cada hora una tarea programada de Coolify con
 * `Authorization: Bearer $AVISOS_SECRET`; nadie más tiene por qué llamarla.
 *
 * Responde con cifras y nada más: ni correos ni identificadores de cuenta, que
 * quedarían en el registro de la tarea.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = noticesSecret();
  if (!secret) return refuse(503, 'NOT_CONFIGURED', 'Los avisos no están configurados en este despliegue.');
  if (!bearerMatches(request.headers.get('authorization'), secret)) {
    return refuse(401, 'UNAUTHORIZED', 'Credencial no válida.');
  }

  // Sin correo no se reclama nada: un aviso reclamado que no sale no vuelve a intentarse.
  const configured = noticesAreConfigured();
  if (!configured.core) return refuse(503, 'CORE_NOT_CONFIGURED', 'El núcleo no está configurado en este despliegue.');
  if (!configured.mail) return refuse(503, 'MAIL_NOT_CONFIGURED', 'El correo no está configurado en este despliegue.');

  const startedAt = Date.now();
  const summary = await runNotices();
  if (!summary) return refuse(502, 'CORE_UNAVAILABLE', 'El núcleo no entregó las cuentas candidatas.');
  return Response.json({ ...summary, durationMs: Date.now() - startedAt }, { status: 200, headers: noStore });
}

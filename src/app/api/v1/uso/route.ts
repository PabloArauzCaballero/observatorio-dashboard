import { nextQuotaReset } from '@/lib/api-v1/contrato';
import { OPTIONS, serveObject } from '@/lib/api-v1/responder';

/**
 * El cupo de la propia llave: plan, consultas del mes y cuántas quedan.
 *
 * Preguntar el uso también es una consulta y cuenta como una: el núcleo suma
 * antes de contestar, así que la cifra que llega ya la incluye.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { OPTIONS };

export function GET(request: Request): Promise<Response> {
  return serveObject(request, 'uso', ({ account, plan, used }) => ({
    data: {
      plan: plan.code,
      nombre: plan.nombre,
      estado: account.effectiveStatus,
      pagado_hasta: account.paidUntil,
      cupo_mensual: plan.apiPorMes,
      usadas: used,
      restantes: Math.max(0, plan.apiPorMes - used),
      reinicio: nextQuotaReset(new Date()).toISOString().slice(0, 10),
    },
    siguiente: null,
    fuente: 'DatosBolivia.com',
    actualizado: new Date().toISOString(),
  }));
}

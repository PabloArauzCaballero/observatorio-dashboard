import { parseDateParam } from '@/lib/api-v1/contrato';
import { seriesObservations } from '@/lib/api-v1/series';
import { BadParam, OPTIONS, accept, serve } from '@/lib/api-v1/responder';

/**
 * Las observaciones de una serie del catálogo, de la más vieja a la más nueva,
 * entre `desde` y `hasta` (los dos inclusive).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { OPTIONS };

/** El código llega codificado si lleva «:» (las series diarias por lado). */
function decoded(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> },
): Promise<Response> {
  const codigo = decoded((await params).codigo);
  // En el registro y en el nombre del CSV va el código recortado: viene de quien llama.
  return serve(request, `series/${codigo.slice(0, 120)}`, async ({ params: query, offset, pageSize }) => {
    const desde = accept(parseDateParam('desde', query.get('desde')));
    const hasta = accept(parseDateParam('hasta', query.get('hasta')));
    const page = await seriesObservations(codigo, { desde, hasta }, offset, pageSize);
    if (!page) {
      throw BadParam.invalid(
        'codigo',
        `no hay una serie «${codigo.slice(0, 120)}»; los códigos están en /api/v1/series`,
      );
    }
    return page;
  });
}

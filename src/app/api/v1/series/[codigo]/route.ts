import { parseDateParam } from '@/lib/api-v1/contrato';
import { seriesObservations } from '@/lib/api-v1/series';
import { BadParam, OPTIONS, serve } from '@/lib/api-v1/responder';

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
  return serve(request, `series/${codigo}`, async ({ params: query, offset, pageSize }) => {
    const desde = parseDateParam('desde', query.get('desde'));
    const hasta = parseDateParam('hasta', query.get('hasta'));
    if (!desde.ok) throw new BadParam(desde.error);
    if (!hasta.ok) throw new BadParam(hasta.error);
    const page = await seriesObservations(
      codigo,
      { desde: desde.value, hasta: hasta.value },
      offset,
      pageSize,
    );
    if (!page) {
      throw new BadParam(
        `No hay una serie con el código «${codigo.slice(0, 120)}». El catálogo está en /api/v1/series.`,
      );
    }
    return page;
  });
}

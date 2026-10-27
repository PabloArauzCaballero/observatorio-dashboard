import { seriesCatalogue } from '@/lib/api-v1/series';
import { OPTIONS, serve } from '@/lib/api-v1/responder';

/**
 * El catálogo de series: código, nombre, unidad, frecuencia y el tramo que
 * cubre cada una. `fuente` recorta a diario, macro, panel o bcb; `buscar`
 * filtra por palabras en el código o el nombre.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { OPTIONS };

export function GET(request: Request): Promise<Response> {
  return serve(request, 'series', ({ params, offset, pageSize }) =>
    seriesCatalogue(params, offset, pageSize),
  );
}

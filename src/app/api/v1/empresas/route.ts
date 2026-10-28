import { paginate, parseTextParam, toIsoInstant } from '@/lib/api-v1/contrato';
import { OPTIONS, accept, serve } from '@/lib/api-v1/responder';
import { readBusinessDirectoryForExport } from '@/lib/business-directory';

/**
 * El directorio de empresas (subconjunto público del SEPREC), con los mismos
 * filtros que la tabla de Empresas y su descarga: departamento, municipio y
 * texto en el nombre. Ordenado por departamento, municipio, nombre y registro.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { OPTIONS };

/** El largo que la tabla de Empresas admite en cada filtro. */
const MAX_FILTER_LENGTH = 100;

export function GET(request: Request): Promise<Response> {
  return serve(request, 'empresas', async ({ params, offset, pageSize }) => {
    const text = (name: string) =>
      accept(parseTextParam(name, params.get(name), MAX_FILTER_LENGTH));
    const { rows, meta } = await readBusinessDirectoryForExport({
      department: text('departamento'),
      municipality: text('municipio'),
      search: text('buscar'),
    });
    const all = rows.map((row) => ({
      registro: row.registrationId,
      nombre: row.name,
      departamento: row.department,
      municipio: row.municipality,
      direccion: row.address,
      actividad: row.activity,
      licencia: row.licence,
      fecha_de_corte: toIsoInstant(row.cutDate),
    }));
    const { data, siguiente } = paginate(all, offset, pageSize);
    return {
      data,
      siguiente,
      fuente: `${meta.publisher} (${meta.sourceUrl}). ${meta.note}`,
      actualizado: toIsoInstant(meta.cutDate),
    };
  });
}

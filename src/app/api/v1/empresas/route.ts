import { paginate } from '@/lib/api-v1/contrato';
import { OPTIONS, serve } from '@/lib/api-v1/responder';
import { readBusinessDirectoryForExport } from '@/lib/business-directory';

/**
 * El directorio de empresas (subconjunto público del SEPREC), con los mismos
 * filtros que la tabla de Empresas y su descarga: departamento, municipio y
 * texto en el nombre. Ordenado por departamento, municipio y nombre.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { OPTIONS };

export function GET(request: Request): Promise<Response> {
  return serve(request, 'empresas', async ({ params, offset, pageSize }) => {
    const { rows, meta } = await readBusinessDirectoryForExport({
      department: params.get('departamento') ?? '',
      municipality: params.get('municipio') ?? '',
      search: params.get('buscar') ?? '',
    });
    const all = rows.map((row) => ({
      registro: row.registrationId,
      nombre: row.name,
      departamento: row.department,
      municipio: row.municipality,
      direccion: row.address,
      actividad: row.activity,
      licencia: row.licence,
      fecha_de_corte: row.cutDate,
    }));
    return {
      ...paginate(all, offset, pageSize),
      fuente: `${meta.publisher} (${meta.sourceUrl}). ${meta.note}`,
      actualizado: meta.cutDate,
    };
  });
}

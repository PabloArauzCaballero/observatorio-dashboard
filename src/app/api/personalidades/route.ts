import { peopleSummary } from '@/lib/people-data';
import { jsonResponse } from '@/lib/respond';

/**
 * El resumen de «Personalidades»: el ránking de Ipsos, las 298 personas con sus cifras, la
 * calidad de las fuentes y lo que hay de conversación. La evidencia, las direcciones de las
 * cuentas, los videos y las palabras de cada persona están en `/api/personalidades/[slug]`
 * y se piden al abrir su ficha. Las direcciones de cuentas sin verificar no salen de aquí.
 *
 * Son archivos del repositorio, así que se pueden guardar un rato; un despliegue nuevo cambia
 * el contenido y a lo sumo se tarda esos diez minutos en verlo.
 */
export function GET(request: Request): Response {
  return jsonResponse(request, peopleSummary(), {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600' },
  });
}

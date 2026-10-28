import { breakTies, paginate, parseListParam } from '@/lib/api-v1/contrato';
import { BadParam, OPTIONS, accept, serve } from '@/lib/api-v1/responder';
import { readPlacesForExport } from '@/lib/places';

/**
 * Los lugares de una o varias ciudades, con la misma lectura que la descarga
 * del mapa. Se pagina por cursor, en el orden ciudad, familia y nombre.
 *
 * El plan fija cuántos lugares da una misma consulta, también recorrida por
 * cursor (`lugaresPorDescarga`: 5.000 en Analista, sin tope en Profesional e
 * Institucional). La página que llega al tope trae `siguiente` en `null`, y
 * toda página de una consulta recortada lleva `X-Tope-Lugares` con el tope,
 * para que quien llama sepa que hay más lugares de los que su plan entrega.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { OPTIONS };

const MAX_CITIES = 12;
const MAX_FAMILIES = 60;

export function GET(request: Request): Promise<Response> {
  return serve(request, 'lugares', async ({ caller, params, offset, pageSize }) => {
    const cities = accept(
      parseListParam('ciudad', params.get('ciudad'), { limit: MAX_CITIES, maxLength: 60 }),
    );
    if (cities.length === 0) {
      throw BadParam.missing('ciudad', 'una o varias ciudades separadas por coma, p. ej. «La Paz,El Alto»');
    }
    const families = accept(
      parseListParam('familia', params.get('familia'), { limit: MAX_FAMILIES, maxLength: 60 }),
    );
    // La base ordena por ciudad, familia y nombre, que pueden repetirse; el
    // identificador desempata para que el cursor no repita ni salte lugares.
    const places = breakTies(
      await readPlacesForExport(cities, families),
      (left, right) =>
        left.city === right.city && left.entityFamily === right.entityFamily && left.name === right.name,
      (place) => place.placeId,
    );
    const cap = caller.plan.lugaresPorDescarga;
    const { data, siguiente, capped } = paginate(places, offset, pageSize, cap);
    return {
      data: data.map((place) => ({
        id: place.placeId,
        ciudad: place.city,
        nombre: place.name,
        grupo: place.entityGroup,
        familia: place.entityFamily,
        barrio: place.zone,
        direccion: place.address,
        marca: place.brand,
        latitud: place.latitude,
        longitud: place.longitude,
        actividad_regulada: place.isRegulated,
        registro_que_lo_confirmaria: place.officialValidationSource,
        confianza: place.confidence,
        grado_de_calidad: place.qualityGrade,
        metodo_de_ubicacion: place.positionMethod,
      })),
      siguiente,
      fuente: 'DatosBolivia.com: catálogo de lugares (la confianza y el método van en cada fila)',
      // El catálogo de lugares no registra cuándo se cargó cada lugar.
      actualizado: null,
      ...(capped && cap !== null ? { headers: { 'X-Tope-Lugares': String(cap) } } : {}),
    };
  });
}

import { encodeCursor, parseList } from '@/lib/api-v1/contrato';
import { BadParam, OPTIONS, serve } from '@/lib/api-v1/responder';
import { readPlacesForExport } from '@/lib/places';

/**
 * Los lugares de una o varias ciudades, con la misma lectura que la descarga
 * del mapa y sin el tope de quinientos del plan gratuito: la llave ya es de un
 * plan. Se pagina por cursor, en el orden ciudad, familia y nombre.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { OPTIONS };

export function GET(request: Request): Promise<Response> {
  return serve(request, 'lugares', async ({ caller, params, offset, pageSize }) => {
    const cities = parseList(params.get('ciudad'), 12, 60);
    if (cities.length === 0) {
      throw new BadParam('Falta ciudad: una o varias, separadas por coma (p. ej. «La Paz,El Alto»).');
    }
    const families = parseList(params.get('familia'), 60, 60);
    const todos = await readPlacesForExport(cities, families);
    // El plan fija cuántos lugares da una misma consulta, también recorrida por cursor.
    const tope = caller.plan.lugaresPorDescarga;
    const places = tope === null ? todos : todos.slice(0, tope);
    const data = places.slice(offset, offset + pageSize).map((place) => ({
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
    }));
    const end = offset + data.length;
    return {
      data,
      siguiente: end < places.length ? encodeCursor({ o: end }) : null,
      fuente: 'DatosBolivia.com: catálogo de lugares (la confianza y el método van en cada fila)',
      actualizado: null,
    };
  });
}

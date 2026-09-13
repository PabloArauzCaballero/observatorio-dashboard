import 'server-only';
import { pool } from './db';

/**
 * The places of Santa Cruz de la Sierra, La Paz and Cochabamba.
 *
 * Read in two halves, for the reason the world panel is: a chooser is useless
 * without its catalogue, and the corpus is too large to hand over whole. The
 * family counts are a few hundred rows and travel with the page; the 26.671
 * places themselves are fetched when the reader picks a city and a family.
 *
 * A place is not a reading. There is no period here, no value and no series —
 * which is why these live in their own module rather than beside the figures in
 * `series.ts`, and why nothing here can be plotted against time.
 */

/**
 * Como se llama el grupo de los que no estan en ninguna poblacion.
 *
 * Es una etiqueta, no un municipio, y esta escrita para que nadie la lea como
 * un municipio. Son 14.325 lugares con coordenadas y sin nombre de poblacion:
 * mas de la mitad del corpus nacional, porque OpenStreetMap no publica una y la
 * entrega no la deduce. Agruparlos asi es lo unico que los pone en el mapa sin
 * inventarles un pueblo.
 */
export const WITHOUT_LOCALITY = 'Sin localidad declarada';

/**
 * Los dos corpus de lugares, presentados con las mismas columnas.
 *
 * `city_place` son las tres ciudades que Overture cartografió dentro de sus
 * polígonos municipales; `national_place` es el país entero leído de Overture y
 * de OpenStreetMap. Hasta ahora el informe sólo enseñaba el primero, así que
 * Sucre, Tarija, Oruro, Potosí, Trinidad y Cobija estaban en la base y en
 * ninguna pantalla — que desde fuera se parece demasiado a no haberlas cargado.
 *
 * La clave territorial de uno es `city` y la del otro `locality`, y no son lo
 * mismo: la primera es un municipio que el publicador delimitó, la segunda el
 * nombre de población que escribió en la dirección. Se unen bajo el nombre más
 * flojo de los dos, que es el único que las dos sostienen.
 *
 * Las 14.325 filas del corpus nacional que no traen localidad tampoco se
 * esconden. Se agrupan bajo un nombre que dice justo lo que les pasa —«Sin
 * localidad declarada»— en vez de quedarse fuera del explorador: no están en
 * ninguna ciudad, pero sí tienen coordenadas, y en el mapa se ven igual que
 * cualquier otra. El nombre no pretende ser un municipio y ningún lector puede
 * confundirlo con uno.
 *
 * `corpus` viaja en cada fila porque las dos mitades no son intercambiables:
 * una trae confianza, zona y marca, y la otra no. Un lector que las suma sin
 * ver cuál es cuál confunde un dato ausente con un dato malo.
 */
const PLACE_UNION = `(
  SELECT place_id, name, city AS locality, zone, latitude, longitude,
         entity_group, entity_family, is_regulated, address, brand,
         confidence, quality_grade, official_validation_source,
         'ciudades' AS corpus, status, superseded
  FROM read_models.city_place
  UNION ALL
  SELECT place_id, name,
         COALESCE(locality, '${WITHOUT_LOCALITY}') AS locality,
         NULL::text AS zone, latitude, longitude,
         entity_group, entity_family, is_regulated, address, NULL::text AS brand,
         confidence, NULL::text AS quality_grade, official_validation_source,
         'nacional' AS corpus, status, superseded
  FROM read_models.national_place
) AS lugares`;

export interface PlaceFamily {
  city: string;
  entityGroup: string;
  entityFamily: string;
  places: number;
  /** Of those, how many an activity a Bolivian regulator licenses. */
  regulated: number;
  /** How many sit inside a neighbourhood polygon Overture publishes. */
  locatedInZone: number;
  meanConfidence: number | null;
}

export interface Place {
  placeId: string;
  name: string;
  city: string;
  zone: string | null;
  latitude: number;
  longitude: number;
  entityGroup: string;
  entityFamily: string;
  isRegulated: boolean;
  address: string | null;
  brand: string | null;
  confidence: number | null;
  qualityGrade: string | null;
  /** Which Bolivian register would confirm a regulated place. */
  officialValidationSource: string | null;
}

/**
 * True when the model is there in the schema but not readable from here.
 *
 * Mirrors the rule in `series.ts`: a section that cannot be read is an empty
 * section, never a briefing that fails to load. The SQLSTATE goes to the log
 * because that is what a fix needs; the page gets nothing, because a database
 * error can carry the host, the role and the port.
 */
function unreadable<T>(model: string, error: unknown): T[] {
  const code = (error as { code?: string }).code;
  if (code === '42P01' || code === '42501' || code === '42703') {
    console.warn(`[observatorio] modelo ilegible: ${model} (${code})`);
    return [];
  }
  throw error;
}

/** How many places of each family each city holds. */
export async function readPlaceFamilies(): Promise<PlaceFamily[]> {
  try {
    const { rows } = await pool().query<{
      city: string;
      entity_group: string;
      entity_family: string;
      places: string;
      regulated: string;
      located_in_zone: string;
      mean_confidence: string | null;
    }>(
      `SELECT locality AS city, entity_group, entity_family,
              count(*)::text                                  AS places,
              count(*) FILTER (WHERE is_regulated)::text      AS regulated,
              count(*) FILTER (WHERE zone IS NOT NULL)::text  AS located_in_zone,
              round(avg(confidence), 4)::text                 AS mean_confidence
       FROM ${PLACE_UNION}
       WHERE status = 'PUBLISHED' AND NOT superseded
       GROUP BY locality, entity_group, entity_family
       ORDER BY 1, places DESC`,
    );

    return rows.map((row) => ({
      city: row.city,
      entityGroup: row.entity_group,
      entityFamily: row.entity_family,
      places: Number(row.places),
      regulated: Number(row.regulated),
      locatedInZone: Number(row.located_in_zone),
      meanConfidence: row.mean_confidence === null ? null : Number(row.mean_confidence),
    }));
  } catch (error) {
    return unreadable<PlaceFamily>('read_models.city_place_family', error);
  }
}

/**
 * The places of one city, optionally narrowed to one family.
 *
 * Cuatro mil por defecto, y el tope no es arbitrario: una pagina que sirve
 * catorce mil lugares en cada cambio de ciudad son varios megas por clic, y el
 * mapa queda como una mancha. Pero el techo duro es de veinte mil, porque el
 * lector puede pedirlos todos y entonces hay que darselos: el mapa los dibuja
 * en dos paths SVG, no en un nodo por punto, asi que el dibujo aguanta lo que
 * la red aguante. Quien llama recibe cuantos existen, para poder decirlo en vez
 * de enseñar un mapa recortado como si fuera la ciudad entera.
 */
export async function readPlaces(
  city: string,
  family: string | null,
  limit = 4000,
): Promise<{ places: Place[]; total: number }> {
  try {
    const conditions = ['locality = $1'];
    const values: unknown[] = [city.slice(0, 60)];
    if (family) {
      conditions.push(`entity_family = $${values.length + 1}`);
      values.push(family.slice(0, 60));
    }
    const where = `WHERE ${conditions.join(' AND ')} AND status = 'PUBLISHED' AND NOT superseded`;

    const counted = await pool().query<{ total: string }>(
      `SELECT count(*)::text AS total FROM ${PLACE_UNION} ${where}`,
      values,
    );

    const { rows } = await pool().query<{
      place_id: string;
      name: string;
      city: string;
      zone: string | null;
      latitude: string;
      longitude: string;
      entity_group: string;
      entity_family: string;
      is_regulated: boolean;
      address: string | null;
      brand: string | null;
      confidence: string | null;
      quality_grade: string | null;
      official_validation_source: string | null;
    }>(
      `SELECT place_id, name, locality AS city, zone, latitude::text, longitude::text,
              entity_group, entity_family, is_regulated, address, brand,
              confidence::text, quality_grade, official_validation_source
       FROM ${PLACE_UNION}
       ${where}
       -- Los mas fiables primero, para que un recorte deje fuera lo peor medido
       -- y no una franja arbitraria de la ciudad.
       ORDER BY confidence DESC NULLS LAST, name
       LIMIT $${values.length + 1}`,
      [...values, Math.min(Math.max(limit, 1), 20000)],
    );

    return {
      total: Number(counted.rows[0]?.total ?? 0),
      places: rows.map((row) => ({
        placeId: row.place_id,
        name: row.name,
        city: row.city,
        zone: row.zone,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        entityGroup: row.entity_group,
        entityFamily: row.entity_family,
        isRegulated: row.is_regulated,
        address: row.address,
        brand: row.brand,
        confidence: row.confidence === null ? null : Number(row.confidence),
        qualityGrade: row.quality_grade,
        officialValidationSource: row.official_validation_source,
      })),
    };
  } catch (error) {
    return { places: unreadable<Place>('read_models.city_place', error), total: 0 };
  }
}

/**
 * The same selection the map is showing, whole, for a file.
 *
 * `readPlaces` stops at four thousand because that is where a drawing stops
 * being a map, and a file has no such ceiling: an analyst who downloads the
 * pharmacies of Santa Cruz wants the pharmacies of Santa Cruz, not the four
 * thousand best-measured ones. The panel says which of the two it is showing,
 * so the difference is stated rather than discovered.
 */
export async function readPlacesForExport(city: string, family: string | null): Promise<Place[]> {
  try {
    const conditions = ['locality = $1'];
    const values: unknown[] = [city.slice(0, 60)];
    if (family) {
      conditions.push(`entity_family = $${values.length + 1}`);
      values.push(family.slice(0, 60));
    }

    const { rows } = await pool().query<{
      place_id: string;
      name: string;
      city: string;
      zone: string | null;
      latitude: string;
      longitude: string;
      entity_group: string;
      entity_family: string;
      is_regulated: boolean;
      address: string | null;
      brand: string | null;
      confidence: string | null;
      quality_grade: string | null;
      official_validation_source: string | null;
    }>(
      `SELECT place_id, name, locality AS city, zone, latitude::text, longitude::text,
              entity_group, entity_family, is_regulated, address, brand,
              confidence::text, quality_grade, official_validation_source
       FROM ${PLACE_UNION}
       WHERE ${conditions.join(' AND ')} AND status = 'PUBLISHED' AND NOT superseded
       ORDER BY entity_family, name
       LIMIT 60000`,
      values,
    );

    return rows.map((row) => ({
      placeId: row.place_id,
      name: row.name,
      city: row.city,
      zone: row.zone,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      entityGroup: row.entity_group,
      entityFamily: row.entity_family,
      isRegulated: row.is_regulated,
      address: row.address,
      brand: row.brand,
      confidence: row.confidence === null ? null : Number(row.confidence),
      qualityGrade: row.quality_grade,
      officialValidationSource: row.official_validation_source,
    }));
  } catch (error) {
    return unreadable<Place>('read_models.city_place', error);
  }
}

/**
 * How many rows a place model holds, with the error left to travel.
 *
 * The readers above swallow «relation does not exist» and answer with an empty
 * section, which is right for a public page and useless for repairing one: an
 * empty section and an absent model look identical from outside. This does not
 * swallow it, so `/api/readers` can tell a corpus nobody has loaded yet from a
 * migration that never ran.
 *
 * The model is a closed union rather than a string: the name is interpolated
 * into the statement, and only these two spellings can reach it.
 */
export async function countPlaceRows(
  model: 'city_place' | 'city_place_family' | 'national_place' | 'national_place_family',
): Promise<number> {
  const { rows } = await pool().query<{ total: string }>(
    `SELECT count(*)::text AS total FROM read_models.${model}`,
  );
  return Number(rows[0]?.total ?? 0);
}

import 'server-only';
import { pool } from './db';
import { held } from './hold';
import {
  deriveRestaurantCuisine,
  isCuisineKey,
  syntheticRestaurantFamily,
  SYNTHETIC_RESTAURANT_PREFIX,
  type CuisineKey,
} from './restaurant-cuisine';

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
export function readPlaceFamilies(): Promise<PlaceFamily[]> {
  return held('placeFamilies', buildPlaceFamilies);
}

/**
 * `RESTAURANTE`, partida por la cocina que su nombre delata.
 *
 * El resto de familias se cuenta agregado en la base —una fila por ciudad y
 * familia— porque a nadie le hace falta el nombre para sumarlas. `RESTAURANTE`
 * es la excepción: 1.273 de 1.281 restaurantes de Santa Cruz llegan bajo esa
 * familia genérica sin cocina (comentario de cabecera de `tallySectors` en
 * `place-sectors.ts`), y la única forma de saber cuántos son pizzería es leer
 * el nombre de cada uno. Así que esta consulta, y solo esta, trae el nombre
 * fila por fila y agrega en JavaScript con {@link deriveRestaurantCuisine} —la
 * misma heurística que usa `/api/lugares` para filtrar, para que el número
 * mostrado y los lugares que aparecen al pulsarlo sean siempre el mismo
 * conjunto.
 *
 * Devuelve familias sintéticas (`RESTAURANTE__PIZZERIAS`, …) más
 * `RESTAURANTE` a secas para lo que no tiene cocina detectada. La suma de
 * todas es exactamente el total que antes tenía la fila `RESTAURANTE`, porque
 * viene de la misma condición `WHERE`.
 */
async function readRestaurantCuisineFamilies(): Promise<PlaceFamily[]> {
  try {
    const { rows } = await pool().query<{
      city: string;
      entity_group: string;
      name: string;
      is_regulated: boolean;
      in_zone: boolean;
      confidence: string | null;
    }>(
      `SELECT locality AS city, entity_group, name, is_regulated,
              (zone IS NOT NULL) AS in_zone, confidence::text AS confidence
       FROM ${PLACE_UNION}
       WHERE entity_family = 'RESTAURANTE' AND status = 'PUBLISHED' AND NOT superseded`,
    );

    interface Bucket {
      city: string;
      entityGroup: string;
      entityFamily: string;
      places: number;
      regulated: number;
      locatedInZone: number;
      confidenceSum: number;
      confidenceCount: number;
    }
    const buckets = new Map<string, Bucket>(); // clave: ciudad + '\u0000' + familia

    for (const row of rows) {
      const cuisine = deriveRestaurantCuisine(row.name);
      const entityFamily = cuisine ? syntheticRestaurantFamily(cuisine) : 'RESTAURANTE';
      const key = `${row.city}\u0000${entityFamily}`;
      const bucket = buckets.get(key) ?? {
        city: row.city,
        entityGroup: row.entity_group,
        entityFamily,
        places: 0,
        regulated: 0,
        locatedInZone: 0,
        confidenceSum: 0,
        confidenceCount: 0,
      };
      bucket.places += 1;
      if (row.is_regulated) bucket.regulated += 1;
      if (row.in_zone) bucket.locatedInZone += 1;
      if (row.confidence !== null) {
        bucket.confidenceSum += Number(row.confidence);
        bucket.confidenceCount += 1;
      }
      buckets.set(key, bucket);
    }

    return [...buckets.values()].map((bucket) => ({
      city: bucket.city,
      entityGroup: bucket.entityGroup,
      entityFamily: bucket.entityFamily,
      places: bucket.places,
      regulated: bucket.regulated,
      locatedInZone: bucket.locatedInZone,
      meanConfidence: bucket.confidenceCount
        ? Math.round((bucket.confidenceSum / bucket.confidenceCount) * 10000) / 10000
        : null,
    }));
  } catch (error) {
    /*
     * Si esta consulta falla (columna o tabla ilegible), no hay que perder
     * `RESTAURANTE` entero: se cae a la agregación simple, sin desglose por
     * cocina, que es el comportamiento de antes de que existiera esta función.
     */
    console.warn(
      '[observatorio] no se pudo derivar la cocina de los restaurantes, RESTAURANTE queda sin desglosar',
      error,
    );
    return readRestaurantFamiliesPlain();
  }
}

async function readRestaurantFamiliesPlain(): Promise<PlaceFamily[]> {
  try {
    const { rows } = await pool().query<{
      city: string;
      entity_group: string;
      places: string;
      regulated: string;
      located_in_zone: string;
      mean_confidence: string | null;
    }>(
      `SELECT locality AS city, entity_group,
              count(*)::text                                  AS places,
              count(*) FILTER (WHERE is_regulated)::text      AS regulated,
              count(*) FILTER (WHERE zone IS NOT NULL)::text  AS located_in_zone,
              round(avg(confidence), 4)::text                 AS mean_confidence
       FROM ${PLACE_UNION}
       WHERE entity_family = 'RESTAURANTE' AND status = 'PUBLISHED' AND NOT superseded
       GROUP BY locality, entity_group`,
    );
    return rows.map((row) => ({
      city: row.city,
      entityGroup: row.entity_group,
      entityFamily: 'RESTAURANTE',
      places: Number(row.places),
      regulated: Number(row.regulated),
      locatedInZone: Number(row.located_in_zone),
      meanConfidence: row.mean_confidence === null ? null : Number(row.mean_confidence),
    }));
  } catch (error) {
    return unreadable<PlaceFamily>('read_models.city_place_family (RESTAURANTE)', error);
  }
}

async function buildPlaceFamilies(): Promise<PlaceFamily[]> {
  try {
    const [{ rows }, restaurants] = await Promise.all([
      pool().query<{
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
         -- RESTAURANTE se calcula aparte, con el nombre, en readRestaurantCuisineFamilies.
         WHERE status = 'PUBLISHED' AND NOT superseded AND entity_family <> 'RESTAURANTE'
         GROUP BY locality, entity_group, entity_family
         ORDER BY 1, places DESC`,
      ),
      readRestaurantCuisineFamilies(),
    ]);

    const base = rows.map((row) => ({
      city: row.city,
      entityGroup: row.entity_group,
      entityFamily: row.entity_family,
      places: Number(row.places),
      regulated: Number(row.regulated),
      locatedInZone: Number(row.located_in_zone),
      meanConfidence: row.mean_confidence === null ? null : Number(row.mean_confidence),
    }));

    return [...base, ...restaurants].sort(
      (a, b) => a.city.localeCompare(b.city) || b.places - a.places,
    );
  } catch (error) {
    return unreadable<PlaceFamily>('read_models.city_place_family', error);
  }
}

/**
 * Cómo traducir las familias que pide el lector antes de ir a la base.
 *
 * `RESTAURANTE__PIZZERIAS` (y sus hermanas) no son un `entity_family` real:
 * son `RESTAURANTE` filtrado por el mismo patrón de nombre que
 * {@link deriveRestaurantCuisine} usó para publicarlas en `/api/familias`. La
 * base no sabe leer eso, así que esta función pide siempre `RESTAURANTE` en su
 * lugar y deja anotado qué cocinas hay que quedarse tras leer el nombre de
 * cada fila.
 */
interface FamilyPlan {
  /** Las familias reales que sí puede filtrar la base con `entity_family = ANY(...)`. */
  queryFamilies: string[];
  /** Las cocinas pedidas, o `null` si no se pidió ninguna familia sintética. */
  cuisines: Set<CuisineKey> | null;
  /** Si además se pidió `RESTAURANTE` a secas (sin cocina detectada). */
  plainRestaurante: boolean;
}

function planFamilies(families: readonly string[]): FamilyPlan {
  const queryFamilies = new Set<string>();
  const cuisines = new Set<CuisineKey>();
  let plainRestaurante = false;
  let sawSynthetic = false;

  for (const family of families) {
    if (family === 'RESTAURANTE') {
      plainRestaurante = true;
      queryFamilies.add(family);
      continue;
    }
    if (family.startsWith(SYNTHETIC_RESTAURANT_PREFIX)) {
      const cuisine = family.slice(SYNTHETIC_RESTAURANT_PREFIX.length);
      if (isCuisineKey(cuisine)) {
        cuisines.add(cuisine);
        sawSynthetic = true;
        queryFamilies.add('RESTAURANTE');
      }
      continue;
    }
    queryFamilies.add(family);
  }

  return {
    queryFamilies: [...queryFamilies],
    cuisines: sawSynthetic ? cuisines : null,
    plainRestaurante,
  };
}

/**
 * Deja solo los `RESTAURANTE` cuya cocina —derivada del nombre— está en
 * `plan`; cualquier otra familia pasa igual, sin tocar.
 *
 * Es la contraparte, en JavaScript, de lo que `/api/familias` ya contó en
 * `readRestaurantCuisineFamilies`: por eso el número que el árbol muestra al
 * lado de «Pizzerías» y los lugares que aparecen al pulsarla son siempre el
 * mismo conjunto.
 */
function filterByCuisine<T extends { entityFamily: string; name: string }>(
  places: readonly T[],
  plan: FamilyPlan,
): T[] {
  if (!plan.cuisines) return [...places];
  const cuisines = plan.cuisines;
  return places.filter((place) => {
    if (place.entityFamily !== 'RESTAURANTE') return true;
    const cuisine = deriveRestaurantCuisine(place.name);
    return cuisine ? cuisines.has(cuisine) : plan.plainRestaurante;
  });
}

/**
 * El recorte del mapa, traducido a una condicion.
 *
 * Ciudad y familia dejaron de ser un valor cada una: el lector suma las que
 * quiera con Ctrl+clic, y varias ciudades o varias familias son una disyuncion.
 * Una lista vacia de familias no recorta; una lista vacia de ciudades no es un
 * caso legal y quien llama la descarta antes, porque «todos los lugares del
 * pais» son veintiseis mil filas que nadie pidio.
 */
function placeScope(
  cities: readonly string[],
  families: readonly string[],
): { where: string; values: unknown[] } {
  const values: unknown[] = [cities.map((city) => city.slice(0, 60))];
  const conditions = ['locality = ANY($1)'];
  if (families.length) {
    values.push(families.map((family) => family.slice(0, 60)));
    conditions.push(`entity_family = ANY($${values.length})`);
  }
  return {
    where: `WHERE ${conditions.join(' AND ')} AND status = 'PUBLISHED' AND NOT superseded`,
    values,
  };
}

/**
 * The places of the chosen cities, optionally narrowed to some families.
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
  cities: readonly string[],
  families: readonly string[],
  limit = 4000,
): Promise<{ places: Place[]; total: number }> {
  if (cities.length === 0) return { places: [], total: 0 };
  try {
    const plan = planFamilies(families);
    const { where, values } = placeScope(cities, plan.queryFamilies);
    /*
     * Con familia sintética hay que leer el `RESTAURANTE` de la ciudad entero
     * y filtrar por nombre después: el recorte real es más chico que lo que
     * pide la base, así que un límite de 4.000 aplicado antes del filtro
     * podría dejar fuera pizzerías que sí calificaban. El tope duro sigue
     * siendo el mismo de siempre (`todos=1`).
     */
    const fetchLimit = plan.cuisines
      ? 20000
      : Math.min(Math.max(limit, 1), 20000);

    /*
     * El recuento y las filas a la vez, cada uno en su conexión del pool.
     *
     * Iban uno detrás del otro, y cada uno recorre la misma unión de los dos
     * corpus: en Contabo eso era la mitad de los 3 a 7 s que tardaba en
     * contestar una ciudad grande. Son independientes —el recuento no recorta
     * las filas ni al revés—, así que esperar al primero para lanzar el segundo
     * no compraba nada.
     */
    const countedQuery = pool().query<{ total: string }>(
      `SELECT count(*)::text AS total FROM ${PLACE_UNION} ${where}`,
      values,
    );

    const rowsQuery = pool().query<{
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
      [...values, fetchLimit],
    );

    const [counted, { rows }] = await Promise.all([countedQuery, rowsQuery]);

    let places = rows.map((row) => ({
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
    let total = Number(counted.rows[0]?.total ?? 0);

    if (plan.cuisines) {
      // El recuento SQL contaba todo `RESTAURANTE`; el nombre descarta lo que
      // no encaja con la cocina pedida, así que el total real es el filtrado.
      places = filterByCuisine(places, plan);
      total = places.length;
      places = places.slice(0, Math.min(Math.max(limit, 1), 20000));
    }

    return { total, places };
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
export async function readPlacesForExport(
  cities: readonly string[],
  families: readonly string[],
): Promise<Place[]> {
  if (cities.length === 0) return [];
  const plan = planFamilies(families);
  const { where, values } = placeScope(cities, plan.queryFamilies);
  try {

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
       ORDER BY city, entity_family, name
       LIMIT 60000`,
      values,
    );

    const places = rows.map((row) => ({
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
    return filterByCuisine(places, plan);
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

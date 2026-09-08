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
      `SELECT city, entity_group, entity_family, places, regulated,
              located_in_zone, mean_confidence::text
       FROM read_models.city_place_family
       ORDER BY city, places DESC`,
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
 * Bounded at four thousand rows, and the bound is not arbitrary: Santa Cruz
 * alone holds fourteen thousand places, and a map that plots them all hands the
 * reader a solid block of ink and the page a payload we just spent an afternoon
 * removing. The caller is told how many exist so it can say so plainly instead
 * of showing a truncated map as if it were the whole city.
 */
export async function readPlaces(
  city: string,
  family: string | null,
  limit = 4000,
): Promise<{ places: Place[]; total: number }> {
  try {
    const conditions = ['city = $1'];
    const values: unknown[] = [city.slice(0, 60)];
    if (family) {
      conditions.push(`entity_family = $${values.length + 1}`);
      values.push(family.slice(0, 60));
    }
    const where = `WHERE ${conditions.join(' AND ')} AND status = 'PUBLISHED' AND NOT superseded`;

    const counted = await pool().query<{ total: string }>(
      `SELECT count(*)::text AS total FROM read_models.city_place ${where}`,
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
      `SELECT place_id, name, city, zone, latitude::text, longitude::text,
              entity_group, entity_family, is_regulated, address, brand,
              confidence::text, quality_grade, official_validation_source
       FROM read_models.city_place
       ${where}
       -- Los mas fiables primero, para que un recorte deje fuera lo peor medido
       -- y no una franja arbitraria de la ciudad.
       ORDER BY confidence DESC NULLS LAST, name
       LIMIT $${values.length + 1}`,
      [...values, Math.min(Math.max(limit, 1), 4000)],
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

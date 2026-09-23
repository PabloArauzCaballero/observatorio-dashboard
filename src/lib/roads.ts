import 'server-only';
import { pool } from './db';
import { held } from './hold';

/**
 * La red vial que el núcleo lee de OpenStreetMap y del INE.
 *
 * Dos vistas, dos preguntas distintas bajo la misma palabra. `road_section` es
 * el mapa: cada tramo que la Red Vial Fundamental (F-n), la Red Departamental
 * (Dn) o una vía secundaria sin referencia recorre, con su geometría ya
 * simplificada. `road_length_annual` es el conteo oficial: la serie 2000-2024
 * del INE, atribuida por el propio INE a la ABC y a los servicios
 * departamentales de caminos. Las dos conviven aquí y no se funden en una sola
 * cifra: los kilómetros que OpenStreetMap traza y los que el INE inventaría no
 * miden lo mismo, y una sola respuesta ocultaría cuál de las dos está leyendo
 * el lector.
 */

export type RoadNetwork = 'FUNDAMENTAL' | 'DEPARTAMENTAL' | 'SIN_REFERENCIA';
export type RoadSurface =
  | 'PAVIMENTO'
  | 'EMPEDRADO'
  | 'RIPIO'
  | 'TIERRA'
  | 'SIN_PAVIMENTAR'
  | 'SIN_DATO';
export type RoadStatus = 'EN_SERVICIO' | 'EN_CONSTRUCCION';

export interface RoadSection {
  sectionId: string;
  route: string | null;
  network: RoadNetwork;
  name: string | null;
  department: string;
  surface: RoadSurface;
  status: RoadStatus;
  lengthKm: number;
  maxspeed: string | null;
  /** Una o más líneas, `[longitud, latitud]`, ya simplificadas. */
  geometry: [number, number][][];
}

export interface RoadLengthPoint {
  geography: string;
  network: 'TOTAL' | 'FUNDAMENTAL' | 'DEPARTAMENTAL';
  surface:
    | 'TOTAL'
    | 'PAVIMENTO'
    | 'EMPEDRADO'
    | 'RIPIO'
    | 'TIERRA'
    | 'EN_CONSTRUCCION'
    | 'TRAZO_EN_EVALUACION';
  period: string;
  lengthKm: number;
  preliminary: boolean;
}

/**
 * True cuando el modelo existe en el esquema pero no se puede leer desde aquí.
 *
 * La misma regla que `series.ts` y `places.ts`: un modelo ilegible es un
 * capítulo vacío, nunca un informe que se cae. El SQLSTATE va al log porque
 * eso es lo que una corrección necesita; la página recibe una lista vacía,
 * porque un error de base de datos puede llevar el servidor, el usuario y el
 * puerto.
 */
function unreadable<T>(model: string, error: unknown): T[] {
  const code = (error as { code?: string }).code;
  if (code === '42P01' || code === '42501' || code === '42703') {
    console.warn(`[observatorio] modelo ilegible: ${model} (${code})`);
    return [];
  }
  throw error;
}

export function readRoadSections(): Promise<RoadSection[]> {
  return held('roadSections', buildRoadSections);
}

async function buildRoadSections(): Promise<RoadSection[]> {
  try {
    const { rows } = await pool().query<{
      section_id: string;
      route: string | null;
      network: RoadNetwork;
      name: string | null;
      department: string;
      surface: RoadSurface;
      status: RoadStatus;
      length_km: string;
      maxspeed: string | null;
      geometry: [number, number][][];
    }>(
      `SELECT section_id, route, network, name, department, surface, status,
              length_km::text, maxspeed, geometry
       FROM read_models.road_section
       WHERE claim_status = 'PUBLISHED' AND NOT superseded
       ORDER BY department, network, route NULLS LAST`,
    );
    return rows.map((row) => ({
      sectionId: row.section_id,
      route: row.route,
      network: row.network,
      name: row.name,
      department: row.department,
      surface: row.surface,
      status: row.status,
      lengthKm: Number(row.length_km),
      maxspeed: row.maxspeed,
      geometry: row.geometry,
    }));
  } catch (error) {
    return unreadable<RoadSection>('read_models.road_section', error);
  }
}

export function readRoadLengths(): Promise<RoadLengthPoint[]> {
  return held('roadLengths', buildRoadLengths);
}

async function buildRoadLengths(): Promise<RoadLengthPoint[]> {
  try {
    const { rows } = await pool().query<{
      geography: string;
      network: RoadLengthPoint['network'];
      surface: RoadLengthPoint['surface'];
      period: string;
      length_km: string;
      preliminary: boolean;
    }>(
      `SELECT geography, network, surface, period, length_km::text, preliminary
       FROM read_models.road_length_annual
       WHERE claim_status = 'PUBLISHED' AND NOT superseded
       ORDER BY geography, network, surface, period`,
    );
    return rows.map((row) => ({
      geography: row.geography,
      network: row.network,
      surface: row.surface,
      period: row.period,
      lengthKm: Number(row.length_km),
      preliminary: row.preliminary,
    }));
  } catch (error) {
    return unreadable<RoadLengthPoint>('read_models.road_length_annual', error);
  }
}

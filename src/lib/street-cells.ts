import 'server-only';
import { pool } from './db';
import { held } from './hold';
import type { LonLatBox, StreetCell, StreetIndexEntry } from './street-types';

/**
 * Las calles de las ciudades, leídas de `read_models.road_street_cell` y
 * `read_models.road_street_index` (migración 0095 del núcleo).
 *
 * Pesan ~27 MB en 3.256 celdas, así que nada las pide enteras. Lo que se sostiene
 * en memoria es el mapa de celdas —su id y su caja, unos 150 KB—; la geometría de
 * una celda se lee sólo cuando una pantalla la cruza, por el índice de su id.
 */

export interface CellBox {
  id: string;
  bounds: LonLatBox;
}

/** Un modelo que todavía no existe es un mapa sin calles, no una página que se cae. */
function unreadable<T>(model: string, error: unknown): T[] {
  const code = (error as { code?: string }).code;
  if (code === '42P01' || code === '42501' || code === '42703') {
    console.warn(`[observatorio] modelo ilegible: ${model} (${code})`);
    return [];
  }
  throw error;
}

export function readStreetCellBoxes(): Promise<CellBox[]> {
  return held('streetCellBoxes', async () => {
    try {
      const { rows } = await pool().query<{ cell_id: string; bounds: LonLatBox }>(
        `SELECT cell_id, bounds
         FROM read_models.road_street_cell
         WHERE claim_status = 'PUBLISHED' AND NOT superseded`,
      );
      return rows.map((row) => ({ id: row.cell_id, bounds: row.bounds }));
    } catch (error) {
      return unreadable<CellBox>('read_models.road_street_cell', error);
    }
  });
}

/** Las celdas cuya caja cruza la vista, las más cercanas a su centro primero, hasta `limit`. */
export async function cellsInBox(box: LonLatBox, limit: number): Promise<{ ids: string[]; truncated: boolean }> {
  const [minLon, minLat, maxLon, maxLat] = box;
  const cx = (minLon + maxLon) / 2;
  const cy = (minLat + maxLat) / 2;
  const hits = (await readStreetCellBoxes())
    .filter(({ bounds }) => bounds[2] >= minLon && bounds[0] <= maxLon && bounds[3] >= minLat && bounds[1] <= maxLat)
    .map(({ id, bounds }) => ({
      id,
      distance: Math.hypot((bounds[0] + bounds[2]) / 2 - cx, (bounds[1] + bounds[3]) / 2 - cy),
    }))
    .sort((left, right) => left.distance - right.distance);
  return { ids: hits.slice(0, limit).map((hit) => hit.id), truncated: hits.length > limit };
}

export async function readStreetCells(ids: readonly string[]): Promise<StreetCell[]> {
  if (!ids.length) return [];
  try {
    const { rows } = await pool().query<{ cell_id: string; department: string | null; streets: StreetCell['streets'] }>(
      `SELECT cell_id, department, streets
       FROM read_models.road_street_cell
       WHERE cell_id = ANY($1::text[]) AND claim_status = 'PUBLISHED' AND NOT superseded`,
      [ids],
    );
    return rows.map((row) => ({ id: row.cell_id, department: row.department, streets: row.streets }));
  } catch (error) {
    return unreadable<StreetCell>('read_models.road_street_cell', error);
  }
}

/** Cada nombre de calle que OpenStreetMap da a una ciudad, con sus km y su caja. */
export function readStreetIndex(): Promise<StreetIndexEntry[]> {
  return held('streetIndex', async () => {
    try {
      const { rows } = await pool().query<{ streets: StreetIndexEntry[] }>(
        `SELECT streets
         FROM read_models.road_street_index
         WHERE claim_status = 'PUBLISHED' AND NOT superseded`,
      );
      return rows.flatMap((row) => row.streets);
    } catch (error) {
      return unreadable<StreetIndexEntry>('read_models.road_street_index', error);
    }
  });
}

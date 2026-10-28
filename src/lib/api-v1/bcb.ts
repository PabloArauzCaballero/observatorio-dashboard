import 'server-only';
import { tidyName, workbookTitle } from '@/lib/bcb-board';
import { BCB_TITLES } from '@/lib/bcb-titles';
import { pool } from '@/lib/db';
import { bcbCatalogueWhere } from './contrato';

/**
 * Las estadísticas del Banco Central para la API, leídas de los mismos modelos
 * que el explorador del tablero (`read_models.bcb_statistic_catalog` y
 * `read_models.bcb_statistic_data`).
 *
 * No se usa `searchBcb` de `lib/bcb.ts` porque su página es de cuarenta fijas y
 * cada llamada cuenta además las cuatro facetas del explorador: servir un
 * `pageSize` de cinco mil con ella serían más de cien vueltas a la base. Aquí
 * la página es la que se pide, en una consulta, con el mismo filtro de nombres
 * que el tablero (`BCB_NOT_AN_INDICATOR`) y el mismo nombre del informe.
 *
 * Un modelo ausente no se disimula como catálogo vacío: es un 503, porque la
 * API no puede decir «no hay series» cuando no pudo leerlas.
 */

interface CatalogRow {
  indicator_code: string;
  name: string;
  family: string;
  workbook: string;
  source_url: string | null;
  sheet: string;
  unit: string | null;
  frequency: string;
  first_period: string;
  last_period: string;
  point_count: number;
}

export interface BcbCatalogueEntry {
  code: string;
  name: string;
  family: string;
  workbookTitle: string;
  sheet: string;
  unit: string | null;
  frequency: string;
  firstPeriod: string;
  lastPeriod: string;
  pointCount: number;
}

/** El título del informe, como lo escribe el explorador del tablero. */
function titleOf(url: string | null, workbook: string): string {
  const known = BCB_TITLES[workbook];
  if (!known) return workbookTitle(url, workbook);
  return known.cuadro ? `${known.title} (cuadro ${known.cuadro})` : known.title;
}

/**
 * Una página del catálogo y si hay otra después.
 *
 * Se pide una fila de más para saber si sigue algo sin contar el catálogo
 * entero. El orden es el del explorador con el código como desempate, para que
 * una página nunca repita ni salte una serie.
 */
export async function readBcbCataloguePage(
  filter: { family: string; text: string },
  offset: number,
  limit: number,
): Promise<{ entries: BcbCatalogueEntry[]; more: boolean; receivedAt: string | null }> {
  const { where, values } = bcbCatalogueWhere(filter);
  const [listed, latest] = await Promise.all([
    pool().query<CatalogRow>(
      `SELECT indicator_code, name, family, workbook, source_url, sheet, unit, frequency,
              to_char(first_period, 'YYYY-MM-DD') AS first_period,
              to_char(last_period, 'YYYY-MM-DD') AS last_period, point_count
         FROM read_models.bcb_statistic_catalog ${where}
        ORDER BY family, workbook, sheet, point_count DESC, name, indicator_code
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit + 1, offset],
    ),
    // Cuándo llegó la última lectura del catálogo: la frescura de la fuente,
    // no de la página.
    pool().query<{ received_at: Date | null }>(
      'SELECT max(received_at) AS received_at FROM read_models.bcb_statistic_catalog',
    ),
  ]);
  const rows = listed.rows.slice(0, limit);
  return {
    entries: rows.map((row) => ({
      code: row.indicator_code,
      name: tidyName(row.name),
      family: row.family,
      workbookTitle: titleOf(row.source_url, row.workbook),
      sheet: row.sheet,
      unit: row.unit,
      frequency: row.frequency,
      firstPeriod: row.first_period,
      lastPeriod: row.last_period,
      pointCount: Number(row.point_count),
    })),
    more: listed.rows.length > limit,
    receivedAt: latest.rows[0]?.received_at?.toISOString() ?? null,
  };
}

/** Los puntos de una serie del BCB, con su unidad, su documento y cuándo llegaron. */
export async function readBcbObservations(code: string): Promise<{
  unit: string | null;
  sourceUrl: string | null;
  receivedAt: string | null;
  points: Array<[string, number]>;
} | null> {
  const { rows } = await pool().query<{
    unit: string | null;
    source_url: string | null;
    received_at: Date | null;
    points: Array<[string, string]> | null;
  }>(
    `SELECT c.unit, d.source_url, d.received_at, d.points
       FROM read_models.bcb_statistic_catalog c
       JOIN read_models.bcb_statistic_data d USING (indicator_code)
      WHERE c.indicator_code = $1`,
    [code],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    unit: row.unit,
    sourceUrl: row.source_url,
    receivedAt: row.received_at?.toISOString() ?? null,
    points: (row.points ?? []).map(([date, value]): [string, number] => [date, Number(value)]),
  };
}

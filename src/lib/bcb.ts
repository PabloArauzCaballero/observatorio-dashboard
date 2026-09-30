import 'server-only';
import { pool } from './db';
import { PAGE, familyLabel, isOpaqueTitle, tidyName, workbookTitle } from './bcb-board';
import type { BcbCatalogPage, BcbFacet, BcbSeriesData, BcbSeriesInfo } from './bcb-board';

/**
 * Las estadísticas del Banco Central, leídas de `read_models.bcb_statistic_catalog`
 * (una fila chica por serie) y `read_models.bcb_statistic_data` (los puntos, que solo se
 * desempaquetan de la serie pedida).
 *
 * Cada filtro se cuenta con los demás aplicados y sin el suyo, que es lo que hace que los
 * filtros se recorten entre sí como en las otras pestañas: al elegir un informe, las
 * frecuencias y las hojas que quedan son las suyas.
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

const toInfo = (row: CatalogRow): BcbSeriesInfo => ({
  code: row.indicator_code,
  name: tidyName(row.name),
  family: row.family,
  workbook: row.workbook,
  workbookTitle: workbookTitle(row.source_url, row.workbook),
  sheet: row.sheet,
  unit: row.unit,
  frequency: row.frequency,
  firstPeriod: row.first_period,
  lastPeriod: row.last_period,
  pointCount: row.point_count,
});

/**
 * Las columnas que el lector del cuaderno tomó por series y son el eje: «Mes», «Fecha»,
 * «Año»… No son indicadores, y dibujadas dan una rampa o un pico sin sentido. Se excluyen
 * aquí y no solo en la semilla porque las ya sembradas no se borran.
 */
const NOT_AN_INDICATOR =
  "name !~* '^(mes|meses|fecha|fechas|a[nñ]o|a[nñ]os|per[ií]odo|trimestre|semana|d[ií]a|gesti[oó]n|n|no|n[°º]|[ií]tem|c[oó]digo|columna [a-z]{1,2})( \\(\\d+\\))?$'";

const SELECT = `SELECT indicator_code, name, family, workbook, source_url, sheet, unit, frequency,
  to_char(first_period, 'YYYY-MM-DD') AS first_period,
  to_char(last_period, 'YYYY-MM-DD') AS last_period, point_count`;

const MISSING_MODEL = new Set(['42P01', '42501', '42703']);

function emptyOrThrow<T>(error: unknown, empty: T): T {
  const code = (error as { code?: string }).code;
  if (code && MISSING_MODEL.has(code)) {
    console.warn(`[observatorio] modelo ilegible: read_models.bcb_statistic_* (${code})`);
    return empty;
  }
  throw error;
}

/** `%` y `_` del texto buscado son texto, no comodines. */
const literal = (text: string): string => text.replace(/[\\%_]/gu, (char) => `\\${char}`);

export interface BcbQuery {
  family: string;
  workbook: string;
  sheet: string;
  frequency: string;
  text: string;
  offset: number;
}

type Dimension = 'family' | 'workbook' | 'sheet' | 'frequency';

function filters(
  query: BcbQuery,
  skip: readonly Dimension[] = [],
): { where: string; values: unknown[] } {
  const conditions: string[] = [NOT_AN_INDICATOR];
  const values: unknown[] = [];
  const add = (column: string, value: string, dimension: Dimension) => {
    if (!value || skip.includes(dimension)) return;
    values.push(value);
    conditions.push(`${column} = $${values.length}`);
  };
  add('family', query.family, 'family');
  add('workbook', query.workbook, 'workbook');
  add('sheet', query.sheet, 'sheet');
  add('frequency', query.frequency, 'frequency');
  // Cada palabra tiene que aparecer en el nombre, la hoja o el informe: «reservas oro»
  // encuentra lo que dice las dos, en cualquier orden.
  for (const word of query.text.trim().split(/\s+/u).filter(Boolean).slice(0, 5)) {
    values.push(`%${literal(word)}%`);
    const at = values.length;
    conditions.push(`(name ILIKE $${at} OR sheet ILIKE $${at} OR workbook ILIKE $${at})`);
  }
  return { where: `WHERE ${conditions.join(' AND ')}`, values };
}

async function facet(
  query: BcbQuery,
  dimension: Dimension,
  label: (key: string, url: string | null, sheet: string) => string,
  limit: number,
): Promise<BcbFacet[]> {
  // Las familias se cuentan sin el informe ni la hoja: son la entrada a la pestaña y no
  // deben encogerse al elegir un informe, como los grupos de las otras pestañas.
  const { where, values } = filters(
    query,
    dimension === 'family' ? ['family', 'workbook', 'sheet'] : [dimension],
  );
  const { rows } = await pool().query<{
    key: string;
    url: string | null;
    sheet: string;
    n: string;
  }>(
    `SELECT ${dimension} AS key, min(source_url) AS url, min(sheet) AS sheet, count(*)::text AS n
     FROM read_models.bcb_statistic_catalog ${where}
     GROUP BY ${dimension} ORDER BY count(*) DESC, ${dimension} LIMIT ${limit}`,
    values,
  );
  return rows.map((row) => ({
    key: row.key,
    label: label(row.key, row.url, row.sheet),
    count: Number(row.n),
  }));
}

export async function searchBcb(query: BcbQuery): Promise<BcbCatalogPage> {
  const empty: BcbCatalogPage = {
    families: [],
    workbooks: [],
    sheets: [],
    frequencies: [],
    results: [],
    total: 0,
    latest: null,
  };
  try {
    const { where, values } = filters(query);
    const [families, workbooks, sheets, frequencies, totals, listed] = await Promise.all([
      facet(query, 'family', (key) => familyLabel(key), 40),
      facet(
        query,
        'workbook',
        (key, url, first) => {
          const title = workbookTitle(url, key);
          return isOpaqueTitle(title) && first.toLowerCase() !== title.toLowerCase()
            ? `${title} · ${first}`
            : title;
        },
        400,
      ),
      query.workbook ? facet(query, 'sheet', (key) => key, 200) : Promise.resolve([]),
      facet(query, 'frequency', (key) => key, 10),
      pool().query<{ total: string; latest: string | null }>(
        `SELECT count(*)::text AS total, to_char(max(last_period), 'YYYY-MM-DD') AS latest
         FROM read_models.bcb_statistic_catalog ${where}`,
        values,
      ),
      pool().query<CatalogRow>(
        `${SELECT} FROM read_models.bcb_statistic_catalog ${where}
         ORDER BY family, workbook, sheet, point_count DESC, name
         LIMIT ${PAGE} OFFSET ${Math.max(0, Math.floor(query.offset))}`,
        values,
      ),
    ]);
    return {
      families,
      workbooks: workbooks.sort((a, b) => a.label.localeCompare(b.label, 'es')),
      sheets,
      frequencies,
      results: listed.rows.map(toInfo),
      total: Number(totals.rows[0]?.total ?? 0),
      latest: totals.rows[0]?.latest ?? null,
    };
  } catch (error) {
    return emptyOrThrow(error, empty);
  }
}

export async function readBcbSeries(codes: readonly string[]): Promise<BcbSeriesData[]> {
  const wanted = [...new Set(codes)].slice(0, 8);
  if (!wanted.length) return [];
  try {
    const { rows } = await pool().query<
      CatalogRow & {
        locator: Record<string, string | number> | null;
        evidence_sha256: string | null;
        points: Array<[string, string]>;
      }
    >(
      `SELECT c.indicator_code, c.name, c.family, c.workbook, d.source_url, c.sheet, c.unit,
              c.frequency, to_char(c.first_period, 'YYYY-MM-DD') AS first_period,
              to_char(c.last_period, 'YYYY-MM-DD') AS last_period, c.point_count,
              c.locator, d.evidence_sha256, d.points
       FROM read_models.bcb_statistic_catalog c
       JOIN read_models.bcb_statistic_data d USING (indicator_code)
       WHERE c.indicator_code = ANY($1::text[])`,
      [wanted],
    );
    return rows.map((row) => ({
      ...toInfo(row),
      locator: row.locator,
      sourceUrl: row.source_url,
      evidenceSha256: row.evidence_sha256,
      points: row.points.map(([date, value]): [string, number] => [date, Number(value)]),
    }));
  } catch (error) {
    return emptyOrThrow(error, []);
  }
}

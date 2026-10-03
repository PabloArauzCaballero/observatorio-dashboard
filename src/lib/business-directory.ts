import 'server-only';
import { pool } from './db';
import { businessNameTerms } from './business-directory-words';
import {
  DIRECTORY_SOURCE,
  type BusinessDirectoryFilters,
  type BusinessDirectoryMeta,
  type BusinessDirectoryPage,
  type BusinessDirectoryRow,
} from './business-directory-contract';

export type { BusinessDirectoryFilters, BusinessDirectoryMeta, BusinessDirectoryPage, BusinessDirectoryRow };

export interface BusinessDirectoryExport {
  rows: BusinessDirectoryRow[];
  meta: BusinessDirectoryMeta;
}

interface DatabaseDirectoryRow {
  place_id: string;
  registration_id: string;
  name: string;
  department: string | null;
  municipality: string | null;
  address: string | null;
  activity: string | null;
  licence: string | null;
  cut_date: string | null;
}

const DIRECTORY_CTE = `WITH directory AS (
  SELECT DISTINCT ON (place_id)
         place_id,
         regexp_replace(place_id, '^.*:', '') AS registration_id,
         name,
         department,
         locality AS municipality,
         address,
         entity_family AS activity,
         licence,
         snapshot_taken_at::text AS cut_date
    FROM read_models.national_place
   WHERE publisher = 'SEPREC'
     AND status = 'PUBLISHED'
     AND NOT superseded
     AND NOT outside_country
   ORDER BY place_id, snapshot_taken_at DESC NULLS LAST, fact_claim_id DESC
)`;

const foldedColumn = (column: 'name'): string =>
  `translate(lower(COALESCE(${column}, '')), 'áéíóúüñ', 'aeiouun')`;

function likeValue(value: string): string {
  return `%${value.replace(/[\\%_]/gu, '\\$&')}%`;
}

function cleanFilters(filters: BusinessDirectoryFilters): Required<BusinessDirectoryFilters> {
  const short = (value?: string): string => value?.trim().slice(0, 100) ?? '';
  return {
    department: short(filters.department),
    municipality: short(filters.municipality),
    search: short(filters.search),
    word: short(filters.word),
    page: Math.max(1, Math.trunc(filters.page ?? 1)),
    pageSize: Math.min(100, Math.max(1, Math.trunc(filters.pageSize ?? 50))),
  };
}

function directoryWhere(
  filters: Required<BusinessDirectoryFilters>,
  includeWord = true,
): { sql: string; values: string[] } {
  const conditions: string[] = [];
  const values: string[] = [];
  const exact = (column: 'department' | 'municipality', value: string): void => {
    if (!value) return;
    values.push(value);
    conditions.push(`${column} = $${values.length}`);
  };
  const like = (value: string): void => {
    if (!value) return;
    values.push(likeValue(value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase('es')));
    conditions.push(`${foldedColumn('name')} LIKE $${values.length} ESCAPE '\\'`);
  };
  exact('department', filters.department);
  exact('municipality', filters.municipality);
  like(filters.search);
  if (includeWord) like(filters.word);
  return { sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', values };
}

function mapRow(row: DatabaseDirectoryRow): BusinessDirectoryRow {
  return {
    placeId: row.place_id,
    registrationId: row.registration_id,
    name: row.name,
    department: row.department,
    municipality: row.municipality,
    address: row.address,
    activity: row.activity,
    licence: row.licence,
    cutDate: row.cut_date,
  };
}

async function readMeta(): Promise<BusinessDirectoryMeta> {
  const { rows } = await pool().query<{
    available_records: string;
    cut_date: string | null;
    departments: string[] | null;
    municipalities: string[] | null;
  }>(`${DIRECTORY_CTE}
     SELECT count(*)::text AS available_records,
            max(cut_date) AS cut_date,
            array_agg(DISTINCT department ORDER BY department) FILTER (WHERE department IS NOT NULL) AS departments,
            array_agg(DISTINCT municipality ORDER BY municipality) FILTER (WHERE municipality IS NOT NULL) AS municipalities
       FROM directory`);
  const summary = rows[0];
  return {
    coverage: 'PARCIAL',
    ...DIRECTORY_SOURCE,
    availableRecords: Number(summary?.available_records ?? 0),
    cutDate: summary?.cut_date ?? null,
    redistributable: true,
    departments: summary?.departments ?? [],
    municipalities: summary?.municipalities ?? [],
  };
}

export async function readBusinessDirectory(filters: BusinessDirectoryFilters = {}): Promise<BusinessDirectoryPage> {
  const selected = cleanFilters(filters);
  const scoped = directoryWhere(selected);
  const forTerms = directoryWhere(selected, false);
  const offset = (selected.page - 1) * selected.pageSize;

  const [counted, listed, named, meta] = await Promise.all([
    pool().query<{ total: string }>(`${DIRECTORY_CTE} SELECT count(*)::text AS total FROM directory ${scoped.sql}`, scoped.values),
    pool().query<DatabaseDirectoryRow>(
      `${DIRECTORY_CTE}
       SELECT place_id, registration_id, name, department, municipality, address, activity, licence, cut_date
         FROM directory ${scoped.sql}
        ORDER BY name, registration_id
        LIMIT $${scoped.values.length + 1} OFFSET $${scoped.values.length + 2}`,
      [...scoped.values, selected.pageSize, offset],
    ),
    pool().query<{ name: string }>(`${DIRECTORY_CTE} SELECT name FROM directory ${forTerms.sql}`, forTerms.values),
    readMeta(),
  ]);

  return {
    rows: listed.rows.map(mapRow),
    total: Number(counted.rows[0]?.total ?? 0),
    terms: businessNameTerms(named.rows.map((row) => row.name)),
    meta,
    page: selected.page,
    pageSize: selected.pageSize,
  };
}

/** Todas las filas que coinciden con los mismos filtros de la tabla, sin paginación. */
export async function readBusinessDirectoryForExport(
  filters: BusinessDirectoryFilters = {},
): Promise<BusinessDirectoryExport> {
  const selected = cleanFilters(filters);
  const scoped = directoryWhere(selected);
  const [{ rows }, meta] = await Promise.all([
    pool().query<DatabaseDirectoryRow>(
      `${DIRECTORY_CTE}
       SELECT place_id, registration_id, name, department, municipality, address, activity, licence, cut_date
         FROM directory ${scoped.sql}
        ORDER BY department NULLS LAST, municipality NULLS LAST, name, registration_id`,
      scoped.values,
    ),
    readMeta(),
  ]);
  return { rows: rows.map(mapRow), meta };
}

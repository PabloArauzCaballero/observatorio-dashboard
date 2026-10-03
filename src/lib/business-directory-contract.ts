import type { BusinessNameTerm } from './business-directory-words';

function foldDirectoryText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export interface BusinessDirectoryRow {
  placeId: string;
  /** Identificador textual del registro; nunca se convierte a número. */
  registrationId: string;
  name: string;
  department: string | null;
  municipality: string | null;
  address: string | null;
  activity: string | null;
  licence: string | null;
  cutDate: string | null;
}

export interface BusinessDirectoryFilters {
  department?: string;
  municipality?: string;
  search?: string;
  word?: string;
  page?: number;
  pageSize?: number;
}

export interface BusinessDirectoryMeta {
  coverage: 'PARCIAL' | 'COMPLETA';
  publisher: 'SEPREC';
  sourceUrl: string;
  officialFullDatabaseUrl: string;
  availableRecords: number;
  cutDate: string | null;
  licence: string;
  /** Permite el archivo del subconjunto público, sin afirmar licencia abierta. */
  redistributable: boolean;
  departments: string[];
  municipalities: string[];
  note: string;
}

export interface BusinessDirectoryPage {
  rows: BusinessDirectoryRow[];
  total: number;
  page: number;
  pageSize: number;
  terms: BusinessNameTerm[];
  meta: BusinessDirectoryMeta;
}

export const DIRECTORY_SOURCE = {
  publisher: 'SEPREC' as const,
  sourceUrl: 'https://servicios.seprec.gob.bo/',
  officialFullDatabaseUrl: 'https://www.seprec.gob.bo/index.php/tramite58/',
  licence: 'Información pública del directorio SEPREC; licencia abierta y redistribución no verificadas',
  note: 'Directorio parcial disponible en el Observatorio. No equivale a la base completa del Registro de Comercio ni acredita operación actual del establecimiento.',
};

export function directoryMeta(
  availableRecords: number,
  rows: readonly BusinessDirectoryRow[] = [],
): BusinessDirectoryMeta {
  const values = <K extends 'department' | 'municipality'>(key: K): string[] =>
    [...new Set(rows.flatMap((row) => (row[key] ? [row[key]] : [])))].sort((a, b) => a.localeCompare(b, 'es'));
  const cutDate = rows
    .flatMap((row) => (row.cutDate ? [row.cutDate] : []))
    .sort()
    .at(-1) ?? null;
  return {
    coverage: 'PARCIAL',
    ...DIRECTORY_SOURCE,
    availableRecords,
    cutDate,
    redistributable: true,
    departments: values('department'),
    municipalities: values('municipality'),
  };
}

/** Constructor puro usado por pruebas y por importadores futuros. */
export function buildDirectoryPage(
  sourceRows: readonly BusinessDirectoryRow[],
  filters: BusinessDirectoryFilters,
): BusinessDirectoryPage {
  const unique = [...new Map(sourceRows.map((row) => [row.placeId, row])).values()];
  const includes = (value: string | null, wanted?: string): boolean =>
    !wanted || foldDirectoryText(value ?? '').includes(foldDirectoryText(wanted));
  const filtered = unique.filter(
    (row) =>
      (!filters.department || row.department === filters.department) &&
      (!filters.municipality || row.municipality === filters.municipality) &&
      includes(row.name, filters.search) &&
      includes(row.name, filters.word),
  );
  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(filters.pageSize ?? 50)));
  const offset = (page - 1) * pageSize;
  return {
    rows: filtered.slice(offset, offset + pageSize),
    total: filtered.length,
    page,
    pageSize,
    terms: [],
    meta: directoryMeta(unique.length, unique),
  };
}

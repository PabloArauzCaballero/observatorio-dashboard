import type { LonLatBox } from './street-types';

/** Una fila analítica del callejero, urbana o de la red vial nacional. */
export interface StreetDataRow {
  id: string;
  key: string;
  name: string;
  properName: string;
  type: string | null;
  departments: string[];
  departmentKm: Record<string, number>;
  departmentPavedKm: Record<string, number>;
  departmentWays: Record<string, number>;
  routes: string[];
  km: number;
  paved: number;
  sections: number;
  city: string | null;
  bounds: LonLatBox | null;
  scope: 'URBANA' | 'RED_NACIONAL';
}

export type StreetPavementBand = 'SIN_REGISTRO' | 'PARCIAL' | 'COMPLETA';
export type StreetLengthBand = 'CORTA' | 'MEDIA' | 'LARGA' | 'MUY_LARGA';

export interface StreetFilters {
  scope?: StreetDataRow['scope'] | 'TODAS';
  type?: string | 'TODOS';
  pavement?: StreetPavementBand | 'TODOS';
  length?: StreetLengthBand | 'TODAS';
}

export interface StreetSummary {
  records: number;
  uniqueNames: number;
  repeatedNames: number;
  cities: number;
  departments: number;
  ways: number;
  urbanRecords: number;
  nationalRecords: number;
  typedRecords: number;
  missingDepartmentRecords: number;
  totalKm: number;
  pavedKm: number;
  remainderKm: number;
  pavedShare: number;
  medianKm: number;
  longestKm: number;
}

export interface StreetBreakdownRow {
  key: string;
  records: number;
  km: number;
  pavedKm: number;
  ways: number;
}

export type StreetBreakdownDimension =
  | 'city'
  | 'department'
  | 'type'
  | 'scope'
  | 'pavement'
  | 'length';

export type StreetIndexState = 'loading' | 'ready' | 'failed';

export interface StreetExportAvailability {
  enabled: boolean;
  completeness: 'CARGANDO' | 'COMPLETA' | 'SOLO_RED_NACIONAL';
}

export const STREET_LENGTH_LABEL: Record<StreetLengthBand, string> = {
  CORTA: 'Corta (menos de 0,5 km)',
  MEDIA: 'Media (0,5 a menos de 1 km)',
  LARGA: 'Larga (1 a menos de 5 km)',
  MUY_LARGA: 'Muy larga (5 km o más)',
};

export const STREET_PAVEMENT_LABEL: Record<StreetPavementBand, string> = {
  SIN_REGISTRO: 'Sin pavimento registrado',
  PARCIAL: 'Parcial',
  COMPLETA: 'Completa',
};

const rounded = (value: number, decimals = 3): number => {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
};

export function streetLengthBand(km: number): StreetLengthBand {
  if (km < 0.5) return 'CORTA';
  if (km < 1) return 'MEDIA';
  if (km < 5) return 'LARGA';
  return 'MUY_LARGA';
}

/**
 * La parte no marcada como pavimento no se llama "no pavimentada": el índice
 * urbano mezcla ripio, tierra y superficie no informada y no permite separarlas.
 */
export function streetPavementBand(row: Pick<StreetDataRow, 'km' | 'paved'>): StreetPavementBand {
  if (row.km <= 0 || row.paved <= 0) return 'SIN_REGISTRO';
  if (row.paved >= row.km - 0.000_001) return 'COMPLETA';
  return 'PARCIAL';
}

export function summarizeStreetRows(rows: readonly StreetDataRow[]): StreetSummary {
  const names = new Map<string, Set<string>>();
  const cities = new Set<string>();
  const departments = new Set<string>();
  const lengths: number[] = [];
  let totalKm = 0;
  let pavedKm = 0;
  let ways = 0;
  let urbanRecords = 0;
  let typedRecords = 0;
  let missingDepartmentRecords = 0;

  for (const row of rows) {
    const places = names.get(row.key) ?? new Set<string>();
    places.add(row.city ?? 'Red nacional');
    names.set(row.key, places);
    if (row.city) cities.add(row.city);
    row.departments.forEach((department) => departments.add(department));
    if (!row.departments.length) missingDepartmentRecords += 1;
    if (row.type) typedRecords += 1;
    if (row.scope === 'URBANA') urbanRecords += 1;
    totalKm += row.km;
    pavedKm += Math.min(Math.max(row.paved, 0), Math.max(row.km, 0));
    ways += row.sections;
    lengths.push(row.km);
  }

  lengths.sort((left, right) => left - right);
  const middle = Math.floor(lengths.length / 2);
  const medianKm = lengths.length
    ? lengths.length % 2
      ? lengths[middle] ?? 0
      : ((lengths[middle - 1] ?? 0) + (lengths[middle] ?? 0)) / 2
    : 0;

  return {
    records: rows.length,
    uniqueNames: names.size,
    repeatedNames: [...names.values()].filter((places) => places.size > 1).length,
    cities: cities.size,
    departments: departments.size,
    ways,
    urbanRecords,
    nationalRecords: rows.length - urbanRecords,
    typedRecords,
    missingDepartmentRecords,
    totalKm: rounded(totalKm),
    pavedKm: rounded(pavedKm),
    remainderKm: rounded(Math.max(totalKm - pavedKm, 0)),
    pavedShare: totalKm > 0 ? rounded((pavedKm / totalKm) * 100, 1) : 0,
    medianKm: rounded(medianKm),
    longestKm: rounded(lengths.at(-1) ?? 0),
  };
}

export function filterStreetRows(
  rows: readonly StreetDataRow[],
  filters: StreetFilters,
): StreetDataRow[] {
  return rows.filter(
    (row) =>
      (!filters.scope || filters.scope === 'TODAS' || row.scope === filters.scope) &&
      (!filters.type || filters.type === 'TODOS' || (row.type ?? 'Sin tipo explícito') === filters.type) &&
      (!filters.pavement || filters.pavement === 'TODOS' || streetPavementBand(row) === filters.pavement) &&
      (!filters.length || filters.length === 'TODAS' || streetLengthBand(row.km) === filters.length),
  );
}

export function streetExportAvailability(state: StreetIndexState): StreetExportAvailability {
  if (state === 'loading') return { enabled: false, completeness: 'CARGANDO' };
  if (state === 'failed') return { enabled: true, completeness: 'SOLO_RED_NACIONAL' };
  return { enabled: true, completeness: 'COMPLETA' };
}

function breakdownKey(row: StreetDataRow, dimension: StreetBreakdownDimension): string {
  switch (dimension) {
    case 'city':
      return row.city ?? 'Sin ciudad';
    case 'department':
      return row.departments[0] ?? 'Sin departamento';
    case 'type':
      return row.type ?? 'Sin tipo explícito';
    case 'scope':
      return row.scope === 'URBANA' ? 'Calle urbana' : 'Red vial nacional';
    case 'pavement':
      return STREET_PAVEMENT_LABEL[streetPavementBand(row)];
    case 'length':
      return STREET_LENGTH_LABEL[streetLengthBand(row.km)];
  }
}

export function streetBreakdown(
  rows: readonly StreetDataRow[],
  dimension: StreetBreakdownDimension,
): StreetBreakdownRow[] {
  const groups = new Map<string, StreetBreakdownRow>();
  for (const row of rows) {
    if (dimension === 'department') {
      const departments = row.departments.length ? row.departments : ['Sin departamento'];
      for (const department of departments) {
        const group = groups.get(department) ?? {
          key: department,
          records: 0,
          km: 0,
          pavedKm: 0,
          ways: 0,
        };
        group.records += 1;
        group.km += row.departmentKm[department] ?? (departments.length === 1 ? row.km : 0);
        group.pavedKm +=
          row.departmentPavedKm[department] ?? (departments.length === 1 ? row.paved : 0);
        group.ways += row.departmentWays[department] ?? (departments.length === 1 ? row.sections : 0);
        groups.set(department, group);
      }
      continue;
    }
    const key = breakdownKey(row, dimension);
    const group = groups.get(key) ?? { key, records: 0, km: 0, pavedKm: 0, ways: 0 };
    group.records += 1;
    group.km += row.km;
    group.pavedKm += row.paved;
    group.ways += row.sections;
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    km: rounded(group.km),
    pavedKm: rounded(group.pavedKm),
  }));
}

export function streetRowsForDownload(
  rows: readonly StreetDataRow[],
  departmentLabel: (department: string) => string,
): Array<Record<string, string | number>> {
  return rows.map((row) => ({
    nombre: row.name,
    nombre_propio: row.properName,
    tipo_via: row.type ?? 'Sin tipo explícito',
    ambito: row.scope === 'URBANA' ? 'Calle urbana' : 'Red vial nacional',
    ciudad: row.city ?? '',
    departamentos: row.departments.map(departmentLabel).join(' | '),
    rutas: row.routes.join(' | '),
    kilometros_totales: rounded(row.km),
    kilometros_pavimentados_registrados: rounded(row.paved),
    kilometros_sin_desglose_de_superficie: rounded(Math.max(row.km - row.paved, 0)),
    porcentaje_pavimentado_registrado: row.km > 0 ? rounded((row.paved / row.km) * 100, 1) : 0,
    estado_del_registro_de_pavimento: STREET_PAVEMENT_LABEL[streetPavementBand(row)],
    categoria_de_longitud: STREET_LENGTH_LABEL[streetLengthBand(row.km)],
    tramos_o_vias: row.sections,
    longitud_minima: row.bounds?.[0] ?? '',
    latitud_minima: row.bounds?.[1] ?? '',
    longitud_maxima: row.bounds?.[2] ?? '',
    latitud_maxima: row.bounds?.[3] ?? '',
    fuente: 'OpenStreetMap contributors',
    licencia: 'ODbL 1.0',
  }));
}

/** CSV UTF-8 para Excel; una celda de texto nunca se deja ejecutar como fórmula. */
export function streetCsv(rows: ReadonlyArray<Record<string, string | number>>): string {
  const first = rows[0];
  const headers = first ? Object.keys(first) : [];
  const field = (value: string | number | undefined): string => {
    if (value === undefined) return '';
    let text = String(value);
    if (typeof value === 'string' && /^[\t\r ]*[=+\-@]/u.test(text)) text = `'${text}`;
    return /[",\n\r]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
  };
  const lines = [headers.map(field).join(',')];
  for (const row of rows) lines.push(headers.map((header) => field(row[header])).join(','));
  return `\ufeff${lines.join('\n')}\n`;
}

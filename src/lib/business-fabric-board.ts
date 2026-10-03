import type { MacroPoint } from './series';

/**
 * «Empresas › Tejido empresarial»: cuántas empresas tiene Bolivia, de qué
 * tipo, dónde, de qué tamaño, y cómo se reparte el padrón de Impuestos.
 *
 * El núcleo guarda cada cifra como una serie con la dimensión dentro del
 * código —`FIRMS_STOCK_DEPTFORM_LA_PAZ__SRL`— porque la vista anual no tiene
 * columnas para ellas. Aquí se deshace: cada lectura vuelve a ser una fila con
 * su lugar, su dimensión y su categoría, que es lo que los filtros cruzados de
 * la página recortan. Nada se suma ni se recalcula al armar; lo derivado
 * (cuotas, variaciones) lo calcula la página sobre lo que el lector eligió.
 */

/** Dónde: el país o uno de sus nueve departamentos. */
export const PLACES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'BOLIVIA', label: 'Bolivia' },
  { key: 'LA_PAZ', label: 'La Paz' },
  { key: 'SANTA_CRUZ', label: 'Santa Cruz' },
  { key: 'COCHABAMBA', label: 'Cochabamba' },
  { key: 'CHUQUISACA', label: 'Chuquisaca' },
  { key: 'ORURO', label: 'Oruro' },
  { key: 'POTOSI', label: 'Potosí' },
  { key: 'TARIJA', label: 'Tarija' },
  { key: 'BENI', label: 'Beni' },
  { key: 'PANDO', label: 'Pando' },
];

export const FORMS: ReadonlyArray<{ key: string; label: string; short: string }> = [
  { key: 'UNIPERSONAL', label: 'Empresa unipersonal', short: 'Unipersonal' },
  { key: 'SRL', label: 'Sociedad de responsabilidad limitada', short: 'SRL' },
  { key: 'SA', label: 'Sociedad anónima', short: 'SA' },
  { key: 'EXTRANJERA', label: 'Sociedad constituida en el extranjero', short: 'Extranjera' },
  { key: 'COLECTIVA', label: 'Sociedad colectiva', short: 'Colectiva' },
  { key: 'SAM', label: 'Sociedad anónima mixta', short: 'SAM' },
  { key: 'COMANDITA_SIMPLE', label: 'Sociedad en comandita simple', short: 'Comandita simple' },
  {
    key: 'COMANDITA_ACCIONES',
    label: 'Sociedad en comandita por acciones',
    short: 'Comandita por acciones',
  },
  { key: 'EFV', label: 'Entidad financiera de vivienda', short: 'EFV' },
  {
    key: 'PUBLICA_DEPARTAMENTAL',
    label: 'Empresa pública departamental mixta',
    short: 'Pública dptal.',
  },
];

export const ACTIVITIES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'G', label: 'Comercio y reparación de vehículos' },
  { key: 'F', label: 'Construcción' },
  { key: 'C', label: 'Industria manufacturera' },
  { key: 'M', label: 'Servicios profesionales y técnicos' },
  { key: 'H', label: 'Transporte y almacenamiento' },
  { key: 'I', label: 'Alojamiento y comidas' },
  { key: 'J', label: 'Información y comunicaciones' },
  { key: 'N', label: 'Servicios administrativos y de apoyo' },
  { key: 'B', label: 'Minas y canteras' },
  { key: 'Q', label: 'Salud y asistencia social' },
  { key: 'P', label: 'Educación' },
  { key: 'S', label: 'Otros servicios' },
  { key: 'L', label: 'Inmobiliarias' },
  { key: 'A', label: 'Agropecuario, silvicultura y pesca' },
  { key: 'R', label: 'Artes y recreación' },
  { key: 'K', label: 'Intermediación financiera y seguros' },
  { key: 'E', label: 'Agua y saneamiento' },
  { key: 'D', label: 'Electricidad y gas' },
  { key: 'X', label: 'Actividad no declarada' },
];

/** Qué mide una fila del registro. */
export type FirmMeasure = 'STOCK' | 'NEW' | 'RENEWED' | 'CANCELLED' | 'ACTIVE';
/** Por qué se abre: el total de un lugar, su tipo societario o su actividad. */
export type FirmDimension = 'TOTAL' | 'FORM' | 'CIIU';

export const FIRM_MEASURES: ReadonlyArray<{ value: FirmMeasure; label: string; noun: string }> = [
  { value: 'STOCK', label: 'Vigentes', noun: 'empresas con matrícula vigente' },
  { value: 'NEW', label: 'Inscripciones', noun: 'empresas inscritas en el año' },
  { value: 'RENEWED', label: 'Renovaciones', noun: 'matrículas renovadas en el año' },
  { value: 'CANCELLED', label: 'Cierres', noun: 'matrículas canceladas en el año' },
  { value: 'ACTIVE', label: 'Activas', noun: 'empresas activas' },
];

/** Una cifra del registro de comercio. */
export interface FirmCount {
  measure: FirmMeasure;
  place: string;
  dimension: FirmDimension;
  key: string;
  year: number;
  count: number;
}

/** Serie continua de cierres; un año no publicado queda ausente, nunca en cero. */
export function buildClosureSeries(
  firms: readonly FirmCount[],
  place: string,
): Array<{ year: number; count: number | null }> {
  const available = firms
    .filter(
      (row) => row.measure === 'CANCELLED' && row.place === place && row.dimension === 'TOTAL',
    )
    .sort((left, right) => left.year - right.year);
  const first = available[0]?.year;
  const last = available.at(-1)?.year;
  if (first === undefined || last === undefined) return [];
  const values = new Map(available.map((row) => [row.year, row.count]));
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const year = first + index;
    return { year, count: values.get(year) ?? null };
  });
}

const RECENT_OFFICIAL_CLOSURES: ReadonlyArray<{
  year: number;
  count: number;
  sourceUrl: string;
}> = [
  {
    year: 2022,
    count: 3339,
    sourceUrl: 'https://www.seprec.gob.bo/wp-content/uploads/2024/12/Memoria-Anual-2-2022.pdf',
  },
  {
    year: 2023,
    count: 3945,
    sourceUrl: 'https://www.seprec.gob.bo/wp-content/uploads/2025/10/Memoria_ANUAL-2023.pdf',
  },
];

/**
 * Completa la copia anual mientras la siembra del núcleo reconstruye su vista materializada.
 * Las filas que ya llegaron de la base prevalecen, de modo que el respaldo no duplica ni
 * reemplaza una lectura publicada por el núcleo.
 */
export function withOfficialRecentClosures(points: readonly MacroPoint[]): MacroPoint[] {
  const code = 'FIRMS_CANCELLED_TOTAL_BOLIVIA';
  const existing = new Set(
    points.filter((point) => point.indicatorCode === code).map((point) => point.period),
  );
  return [
    ...points,
    ...RECENT_OFFICIAL_CLOSURES.filter(({ year }) => !existing.has(String(year))).map(
      ({ year, count, sourceUrl }): MacroPoint => ({
        indicatorCode: code,
        name: 'Bolivia: matrículas canceladas',
        sector: 'TEJIDO_EMPRESARIAL',
        period: String(year),
        unit: 'COUNT',
        value: count,
        previousValue: null,
        changePercent: null,
        publisher: 'Servicio Plurinacional de Registro de Comercio (SEPREC)',
        sourceUrl,
      }),
    ),
  ];
}

/** Quién encabeza las empresas de un departamento (SEPREC, corte de 2025). */
export interface OwnerCount {
  place: string;
  kind: 'MEN' | 'WOMEN' | 'ADULT' | 'YOUTH';
  year: number;
  count: number;
}

/** Una celda de la foto de tamaño del Ministerio (julio de 2025). */
export interface SizeCell {
  base: 'VIG' | 'ACT';
  /** `SIZE` cruza tamaño con otra cosa; `DEPT`, departamento con otra cosa. */
  row: 'SIZE' | 'DEPT';
  rowKey: string;
  rowLabel: string;
  column: string;
  columnLabel: string;
  count: number;
}

/** El empleo que las empresas declaran, por tamaño, tipo, gran sector o departamento. */
export interface JobCell {
  base: 'VIG' | 'ACT';
  dimension: string;
  key: string;
  label: string;
  kind: 'PERMANENT' | 'TEMPORARY' | 'TOTAL';
  count: number;
}

/** Una fila del cuadro del padrón de Impuestos. */
export interface TaxRollShare {
  dimension: string;
  key: string;
  label: string;
  year: number;
  roll: number | null;
  revenue: number | null;
}

export interface FabricBoard {
  firms: FirmCount[];
  owners: OwnerCount[];
  sectors: Array<{ key: string; label: string; year: number; count: number }>;
  size: SizeCell[];
  jobs: JobCell[];
  taxRoll: TaxRollShare[];
  taxpayers: Array<{ year: number; count: number }>;
  /** La fuente de cada familia, para la nota al pie de cada panel. */
  sources: Record<string, { publisher: string; url: string | null }>;
}

const FIRM =
  /^FIRMS_(STOCK|NEW|RENEWED|CANCELLED|ACTIVE)_(TOTAL|DEPT|FORM|CIIU|DEPTFORM|DEPTCIIU)_(.+)$/u;
const OWNER = /^FIRMS_OWNER_(MEN|WOMEN|ADULT|YOUTH)_DEPT_(.+)$/u;
const SIZE = /^FIRMS_(SIZE|DEPT)_(VIG|ACT)_(.+?)__(.+)$/u;
const JOBS = /^FIRMS_JOBS_(VIG|ACT)_([A-Z]+)_(.+)_(PERMANENT|TEMPORARY|TOTAL)$/u;
const ROLL = /^TAXROLL_(ROLL|REVENUE)_PCT_([A-Z]+)_(.+)$/u;

/** Lo que va detrás de «: » y antes de « · » o de las llaves: el rótulo de la categoría. */
function labelOf(printed: string | null, fallback: string): string {
  const name = printed ?? fallback;
  const after = name.includes(': ') ? name.slice(name.indexOf(': ') + 2) : name;
  return (
    after
      .replace(/\s*\{[^}]*\}\s*$/u, '')
      .split(' · ')[0]
      ?.trim() || fallback
  );
}

/**
 * Lo que va ANTES de «: » en el nombre de una serie del padrón («Comercio:
 * participación en el padrón»): ahí la categoría es lo primero y lo que sigue
 * es la medida, al revés que en las series de empresas.
 */
function leadLabel(printed: string | null, fallback: string): string {
  const name = printed ?? fallback;
  const lead = name.includes(': ') ? name.slice(0, name.indexOf(': ')) : name;
  return lead.replace(/\s*\{[^}]*\}\s*$/u, '').trim() || fallback;
}

/** Lo que va detrás del último « · », para las celdas cruzadas de la foto de tamaño. */
function crossLabel(printed: string | null, fallback: string): string {
  const parts = (printed ?? fallback).replace(/\s*\{[^}]*\}\s*$/u, '').split(' · ');
  return parts.length > 1 ? (parts.at(-1)?.trim() ?? fallback) : fallback;
}

function firmRow(match: RegExpExecArray, year: number, count: number): FirmCount | null {
  const measure = match[1] as FirmMeasure;
  const kind = match[2] ?? '';
  const rest = match[3] ?? '';
  if (kind === 'TOTAL')
    return { measure, place: rest, dimension: 'TOTAL', key: 'TOTAL', year, count };
  if (kind === 'DEPT')
    return { measure, place: rest, dimension: 'TOTAL', key: 'TOTAL', year, count };
  if (kind === 'FORM')
    return { measure, place: 'BOLIVIA', dimension: 'FORM', key: rest, year, count };
  if (kind === 'CIIU')
    return { measure, place: 'BOLIVIA', dimension: 'CIIU', key: rest, year, count };
  const [place, key] = rest.split('__');
  if (!place || !key) return null;
  return { measure, place, dimension: kind === 'DEPTFORM' ? 'FORM' : 'CIIU', key, year, count };
}

export function buildFabricBoard(points: readonly MacroPoint[]): FabricBoard {
  const board: FabricBoard = {
    firms: [],
    owners: [],
    sectors: [],
    size: [],
    jobs: [],
    taxRoll: [],
    taxpayers: [],
    sources: {},
  };
  const roll = new Map<string, TaxRollShare>();

  for (const point of points) {
    if (!Number.isFinite(point.value)) continue;
    const code = point.indicatorCode;
    const year = Number(point.period);
    const family = code.split('_').slice(0, 2).join('_');
    board.sources[family] ??= { publisher: point.publisher ?? '', url: point.sourceUrl };

    const owner = OWNER.exec(code);
    if (owner) {
      board.owners.push({
        place: owner[2] ?? '',
        kind: owner[1] as OwnerCount['kind'],
        year,
        count: point.value,
      });
      continue;
    }
    if (code.startsWith('FIRMS_STOCK_SECTOR_')) {
      board.sectors.push({
        key: code.slice('FIRMS_STOCK_SECTOR_'.length),
        label: labelOf(point.name, code).replace(/\s*\(gran sector\)$/u, ''),
        year,
        count: point.value,
      });
      continue;
    }
    const jobs = JOBS.exec(code);
    if (jobs) {
      board.jobs.push({
        base: jobs[1] as JobCell['base'],
        dimension: jobs[2] ?? '',
        key: jobs[3] ?? '',
        label: labelOf(point.name, jobs[3] ?? ''),
        kind: jobs[4] as JobCell['kind'],
        count: point.value,
      });
      continue;
    }
    const size = SIZE.exec(code);
    if (size) {
      board.size.push({
        base: size[2] as SizeCell['base'],
        row: size[1] as SizeCell['row'],
        rowKey: size[3] ?? '',
        rowLabel: labelOf(point.name, size[3] ?? ''),
        column: size[4] ?? '',
        columnLabel: crossLabel(point.name, size[4] ?? ''),
        count: point.value,
      });
      continue;
    }
    const firm = FIRM.exec(code);
    if (firm) {
      const row = firmRow(firm, year, point.value);
      if (row) board.firms.push(row);
      continue;
    }
    const share = ROLL.exec(code);
    if (share) {
      const id = `${share[2]}|${share[3]}|${year}`;
      const row = roll.get(id) ?? {
        dimension: share[2] ?? '',
        key: share[3] ?? '',
        label: leadLabel(point.name, share[3] ?? ''),
        year,
        roll: null,
        revenue: null,
      };
      if (share[1] === 'ROLL') row.roll = point.value;
      else row.revenue = point.value;
      roll.set(id, row);
      continue;
    }
    if (code === 'TAXROLL_ACTIVE_TAXPAYERS') board.taxpayers.push({ year, count: point.value });
  }
  board.taxRoll = [...roll.values()];
  return board;
}

export const EMPTY_FABRIC_BOARD: FabricBoard = buildFabricBoard([]);

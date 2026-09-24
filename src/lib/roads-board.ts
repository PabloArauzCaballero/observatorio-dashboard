import type { MacroSeriesPoint } from '@/components/charts';
import { DEPARTMENTS } from './departments';
import type { FxConclusion } from './fx-snapshot';
import type { RoadLengthPoint, RoadSection } from './roads';

/**
 * La red vial reducida a lo que el tablero dibuja: un mapa, una tabla y un
 * cuadro de mando, construidos una sola vez y no en cada componente que los
 * lee.
 */

export type RoadSurface = RoadSection['surface'];

const SURFACE_LABEL: Record<RoadSurface, string> = {
  PAVIMENTO: 'Pavimento',
  EMPEDRADO: 'Empedrado',
  RIPIO: 'Ripio',
  TIERRA: 'Tierra',
  SIN_PAVIMENTAR: 'Sin pavimentar (sin detalle)',
  SIN_DATO: 'Sin dato de rodadura',
};

export const SURFACE_ORDER: readonly RoadSurface[] = [
  'PAVIMENTO',
  'EMPEDRADO',
  'RIPIO',
  'TIERRA',
  'SIN_PAVIMENTAR',
  'SIN_DATO',
];

/**
 * Las seis rodaduras de OpenStreetMap, en las cuatro que el lector distingue.
 *
 * Seis colores sobre una red de dos mil quinientos tramos no se separan a ojo
 * —la paleta sólo garantiza tres casillas distinguibles entre vecinas— y la
 * «otra» de la tabla vieja escondía los 8.400 km «sin pavimentar» sin detalle,
 * un tercio de la red. Empedrado va con el ripio porque las dos son firmes sin
 * asfalto; «sin pavimentar» va con la tierra porque eso es lo único que
 * OpenStreetMap afirma de ella.
 */
export type SurfaceGroup = 'PAVIMENTADA' | 'RIPIO' | 'TIERRA' | 'SIN_DATO';

export const SURFACE_GROUP: Record<RoadSurface, SurfaceGroup> = {
  PAVIMENTO: 'PAVIMENTADA',
  EMPEDRADO: 'RIPIO',
  RIPIO: 'RIPIO',
  TIERRA: 'TIERRA',
  SIN_PAVIMENTAR: 'TIERRA',
  SIN_DATO: 'SIN_DATO',
};

export const SURFACE_GROUPS: readonly { group: SurfaceGroup; label: string; color: string }[] = [
  { group: 'PAVIMENTADA', label: 'Pavimentada', color: 'var(--series-1)' },
  { group: 'RIPIO', label: 'Ripio o empedrado', color: 'var(--series-3)' },
  { group: 'TIERRA', label: 'Tierra o sin pavimentar', color: 'var(--series-2)' },
  { group: 'SIN_DATO', label: 'Sin dato de rodadura', color: 'var(--series-rest)' },
];

export const NETWORKS: readonly { network: RoadSection['network']; label: string; color: string }[] = [
  { network: 'FUNDAMENTAL', label: 'Red Fundamental (F-n)', color: 'var(--series-1)' },
  { network: 'DEPARTAMENTAL', label: 'Red Departamental (Dn)', color: 'var(--series-2)' },
  { network: 'SIN_REFERENCIA', label: 'Sin ruta asignada', color: 'var(--ink-faint)' },
];

const DEPARTMENT_NAME: Record<string, string> = Object.fromEntries(
  DEPARTMENTS.map((department) => [department.slug, department.name]),
);

export const departmentName = (slug: string): string => DEPARTMENT_NAME[slug] ?? slug;

export interface DepartmentTotal {
  department: string;
  name: string;
  totalKm: number;
  bySurface: Partial<Record<RoadSurface, number>>;
}

export interface RouteTotal {
  route: string;
  network: RoadSection['network'];
  totalKm: number;
  departments: string[];
  bySurface: Partial<Record<RoadSurface, number>>;
}

export interface RoadBoard {
  sections: RoadSection[];
  totalKm: number;
  pavedShare: number;
  kmBySurface: { surface: RoadSurface; label: string; km: number }[];
  kmByDepartment: DepartmentTotal[];
  routes: RouteTotal[];
  annual: { surface: string; unit: string; data: MacroSeriesPoint[] }[];
  asOfPeriod: string | null;
  conclusions: FxConclusion[];
}

function addTo(bag: Partial<Record<RoadSurface, number>>, surface: RoadSurface, km: number): void {
  bag[surface] = (bag[surface] ?? 0) + km;
}

function buildKmBySurface(sections: readonly RoadSection[]): RoadBoard['kmBySurface'] {
  const totals = new Map<RoadSurface, number>();
  for (const section of sections) totals.set(section.surface, (totals.get(section.surface) ?? 0) + section.lengthKm);
  return SURFACE_ORDER.filter((surface) => totals.has(surface)).map((surface) => ({
    surface,
    label: SURFACE_LABEL[surface],
    km: Math.round((totals.get(surface) ?? 0) * 10) / 10,
  }));
}

function buildKmByDepartment(sections: readonly RoadSection[]): DepartmentTotal[] {
  const byDepartment = new Map<string, DepartmentTotal>();
  for (const section of sections) {
    const existing = byDepartment.get(section.department) ?? {
      department: section.department,
      name: DEPARTMENT_NAME[section.department] ?? section.department,
      totalKm: 0,
      bySurface: {},
    };
    existing.totalKm += section.lengthKm;
    addTo(existing.bySurface, section.surface, section.lengthKm);
    byDepartment.set(section.department, existing);
  }
  return [...byDepartment.values()]
    .map((entry) => ({ ...entry, totalKm: Math.round(entry.totalKm * 10) / 10 }))
    .sort((left, right) => right.totalKm - left.totalKm);
}

function buildRoutes(sections: readonly RoadSection[]): RouteTotal[] {
  const byRoute = new Map<string, RouteTotal>();
  for (const section of sections) {
    if (!section.route) continue;
    const existing = byRoute.get(section.route) ?? {
      route: section.route,
      network: section.network,
      totalKm: 0,
      departments: [],
      bySurface: {},
    };
    existing.totalKm += section.lengthKm;
    addTo(existing.bySurface, section.surface, section.lengthKm);
    if (!existing.departments.includes(section.department)) existing.departments.push(section.department);
    byRoute.set(section.route, existing);
  }
  return [...byRoute.values()]
    .map((entry) => ({ ...entry, totalKm: Math.round(entry.totalKm * 10) / 10 }))
    .sort((left, right) => right.totalKm - left.totalKm);
}

/** La serie nacional del INE, por rodadura, lista para `MacroChart`. */
function buildAnnual(lengths: readonly RoadLengthPoint[]): RoadBoard['annual'] {
  const series: RoadBoard['annual'] = [];
  for (const surface of ['TOTAL', 'PAVIMENTO', 'RIPIO', 'TIERRA'] as const) {
    const points = lengths
      .filter((point) => point.geography === 'BOLIVIA' && point.network === 'TOTAL' && point.surface === surface)
      .sort((left, right) => left.period.localeCompare(right.period))
      .map((point): MacroSeriesPoint => ({ period: point.period, value: point.lengthKm }));
    if (points.length) series.push({ surface, unit: 'KM', data: points });
  }
  return series;
}

function buildConclusions(
  sections: readonly RoadSection[],
  kmBySurface: RoadBoard['kmBySurface'],
  kmByDepartment: DepartmentTotal[],
  totalKm: number,
  pavedShare: number,
  asOfPoint: RoadLengthPoint | null,
): FxConclusion[] {
  const conclusions: FxConclusion[] = [];
  const paved = kmBySurface.find((entry) => entry.surface === 'PAVIMENTO');
  if (paved) {
    conclusions.push({
      key: 'pavimento',
      claim: 'De la red mapeada, esta parte está pavimentada',
      figure: `${pavedShare.toFixed(1).replace('.', ',')} %`,
      detail: `${paved.km.toLocaleString('es-BO')} km de ${totalKm.toLocaleString('es-BO')} km trazados por OpenStreetMap en vías principales (motorway, trunk, primary, secondary).`,
      tone: 'neutral',
    });
  }
  const first = kmByDepartment[0];
  if (first) {
    conclusions.push({
      key: 'concentracion',
      claim: 'El departamento con más red mapeada es',
      figure: first.name,
      detail: `${first.totalKm.toLocaleString('es-BO')} km, sobre ${totalKm.toLocaleString('es-BO')} km del país.`,
      tone: 'neutral',
    });
  }
  const unreferenced = sections.filter((section) => section.network === 'SIN_REFERENCIA');
  if (unreferenced.length) {
    const km = Math.round(unreferenced.reduce((sum, section) => sum + section.lengthKm, 0));
    conclusions.push({
      key: 'sin_referencia',
      claim: 'Vías principales sin ruta F-n ni Dn asignada en el mapa',
      figure: `${km.toLocaleString('es-BO')} km`,
      detail:
        'OpenStreetMap traza la vía pero no le atribuye una referencia oficial; se muestran igual, agrupadas por su clase.',
      tone: 'adverse',
    });
  }
  if (asOfPoint) {
    conclusions.push({
      key: 'ine',
      claim: `Longitud oficial de caminos según el INE (${asOfPoint.period}${asOfPoint.preliminary ? ', preliminar' : ''})`,
      figure: `${asOfPoint.lengthKm.toLocaleString('es-BO')} km`,
      detail: 'Red Fundamental y Red Departamental; no incluye la red municipal. Fuente: ABC y los SEDECA, vía el INE.',
      tone: 'neutral',
    });
  }
  return conclusions;
}

export function buildRoadBoard(sections: RoadSection[], lengths: RoadLengthPoint[]): RoadBoard {
  const totalKm = Math.round(sections.reduce((sum, section) => sum + section.lengthKm, 0) * 10) / 10;
  const kmBySurface = buildKmBySurface(sections);
  const pavedKm = kmBySurface.find((entry) => entry.surface === 'PAVIMENTO')?.km ?? 0;
  const pavedShare = totalKm > 0 ? (pavedKm / totalKm) * 100 : 0;
  const kmByDepartment = buildKmByDepartment(sections);
  const asOf = lengths
    .filter((point) => point.geography === 'BOLIVIA' && point.network === 'TOTAL' && point.surface === 'TOTAL')
    .sort((left, right) => right.period.localeCompare(left.period))[0] ?? null;

  return {
    sections,
    totalKm,
    pavedShare,
    kmBySurface,
    kmByDepartment,
    routes: buildRoutes(sections),
    annual: buildAnnual(lengths),
    asOfPeriod: asOf?.period ?? null,
    conclusions: buildConclusions(sections, kmBySurface, kmByDepartment, totalKm, pavedShare, asOf),
  };
}

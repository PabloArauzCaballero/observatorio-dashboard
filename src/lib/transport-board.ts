import type {
  RailFlowPoint,
  RailLine,
  RailNetwork,
  RailStation,
  RailStatus,
  WaterPort,
  Waterway,
  WaterwayCategory,
} from './transport';

/**
 * La red ferroviaria y la fluvial reducidas a lo que el tablero dibuja.
 *
 * Tres colores como máximo por mapa, porque la paleta sólo garantiza tres
 * casillas distinguibles entre vecinas (ver `roads-board.ts`): en el
 * ferrocarril, las tres redes; en los ríos, las tres fuentes de
 * navegabilidad. Lo demás —el estado de una vía, un río que nadie afirma
 * navegable— se lee por el trazo (discontinuo, fino, gris), no por otro color.
 */

export const RAIL_NETWORKS: readonly { network: RailNetwork; label: string; color: string }[] = [
  { network: 'ANDINA', label: 'Red Andina (occidental)', color: 'var(--series-1)' },
  { network: 'ORIENTAL', label: 'Red Oriental', color: 'var(--series-2)' },
  { network: 'METROPOLITANA', label: 'Tren metropolitano (Cochabamba)', color: 'var(--series-3)' },
];

export const RAIL_STATUSES: readonly { status: RailStatus; label: string; dash?: string }[] = [
  { status: 'EN_SERVICIO', label: 'En servicio' },
  { status: 'EN_CONSTRUCCION', label: 'En construcción', dash: '5 3' },
  { status: 'EN_DESUSO', label: 'En desuso', dash: '2 3' },
  { status: 'ABANDONADA', label: 'Abandonada o levantada', dash: '1 4' },
];

export const WATERWAY_CATEGORIES: readonly {
  category: WaterwayCategory;
  label: string;
  hint: string;
  color: string;
  navigable: boolean;
}[] = [
  {
    category: 'HIDROVIA',
    label: 'Hidrovía (Ichilo-Mamoré, Iténez, Paraguay-Paraná)',
    hint: 'Ministerio de Obras Públicas',
    color: 'var(--series-1)',
    navigable: true,
  },
  {
    category: 'NAVEGABLE_EN_ESTUDIO',
    label: 'Afluente navegable en estudio',
    hint: 'Madre de Dios, Beni, Abuná, Madera, Tahuamanu, Orthon — Ministerio de Obras Públicas',
    color: 'var(--series-2)',
    navigable: true,
  },
  {
    category: 'NAVEGABLE_OSM',
    label: 'Navegable según OpenStreetMap',
    hint: 'Otros ríos con la etiqueta boat=yes',
    color: 'var(--series-3)',
    navigable: true,
  },
  {
    category: 'TRANSBORDADOR',
    label: 'Cruce en transbordador o balsa',
    hint: 'Tiquina, Rurrenabaque, Guayaramerín y otros cruces',
    color: 'var(--ink)',
    navigable: false,
  },
  {
    category: 'RIO',
    label: 'Otros ríos',
    hint: 'Sin afirmación de navegabilidad',
    color: 'var(--ink-faint)',
    navigable: false,
  },
];

const round = (value: number): number => Math.round(value * 10) / 10;

export interface FlowSeries {
  network: RailFlowPoint['network'];
  service: RailFlowPoint['service'];
  annual: { period: string; value: number; preliminary: boolean }[];
  monthly: { period: string; value: number; preliminary: boolean }[];
  /** El último año cerrado que el INE publica, y su valor. */
  lastYear: { period: string; value: number; preliminary: boolean } | null;
}

export interface RailBoard {
  lines: RailLine[];
  stations: RailStation[];
  flows: FlowSeries[];
  kmByStatus: Record<RailStatus, number>;
  /** Hasta qué mes publica el INE el año en curso, si lo publica. */
  lastMonth: string | null;
}

export function buildRailBoard(
  lines: RailLine[],
  stations: RailStation[],
  flows: RailFlowPoint[],
): RailBoard {
  const kmByStatus: Record<RailStatus, number> = {
    EN_SERVICIO: 0,
    EN_CONSTRUCCION: 0,
    EN_DESUSO: 0,
    ABANDONADA: 0,
  };
  for (const line of lines) kmByStatus[line.status] += line.lengthKm;
  for (const status of Object.keys(kmByStatus) as RailStatus[])
    kmByStatus[status] = round(kmByStatus[status]);

  const series: FlowSeries[] = [];
  for (const network of ['ANDINA', 'ORIENTAL'] as const) {
    for (const service of ['CARGA', 'PASAJEROS', 'EQUIPAJE_ENCOMIENDA'] as const) {
      const mine = flows.filter((point) => point.network === network && point.service === service);
      // Un año a medias no se compara con uno cerrado: va a la serie mensual y no a la anual.
      const annual = mine
        .filter((point) => point.period.length === 4 && !point.partialYear)
        .map(({ period, value, preliminary }) => ({ period, value, preliminary }));
      const monthly = mine
        .filter((point) => point.period.length === 7)
        .map(({ period, value, preliminary }) => ({ period, value, preliminary }));
      if (!annual.length && !monthly.length) continue;
      series.push({ network, service, annual, monthly, lastYear: annual.at(-1) ?? null });
    }
  }
  const lastMonth = flows
    .filter((point) => point.period.length === 7)
    .map((point) => point.period)
    .sort()
    .at(-1);

  return { lines, stations, flows: series, kmByStatus, lastMonth: lastMonth ?? null };
}

export interface WaterBoard {
  waterways: Waterway[];
  ports: WaterPort[];
  kmByCategory: Record<WaterwayCategory, number>;
}

export function buildWaterBoard(waterways: Waterway[], ports: WaterPort[]): WaterBoard {
  const kmByCategory: Record<WaterwayCategory, number> = {
    HIDROVIA: 0,
    NAVEGABLE_EN_ESTUDIO: 0,
    NAVEGABLE_OSM: 0,
    TRANSBORDADOR: 0,
    RIO: 0,
  };
  for (const one of waterways) kmByCategory[one.category] += one.lengthKm;
  for (const category of Object.keys(kmByCategory) as WaterwayCategory[]) {
    kmByCategory[category] = round(kmByCategory[category]);
  }
  return { waterways, ports, kmByCategory };
}

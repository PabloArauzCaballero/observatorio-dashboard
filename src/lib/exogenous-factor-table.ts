import type { FactorObservation, FactorSeries } from './exogenous-factor-types';

export interface FamilySeriesData {
  series: FactorSeries;
  points: FactorObservation[];
}
export interface FamilyTableColumn {
  code: string;
  name: string;
  unit: string;
}
export interface FamilyTableGroup {
  frequency: string;
  columns: FamilyTableColumn[];
  /** Del período más reciente al más antiguo; `values` sigue el orden de `columns`. */
  rows: Array<{ period: string; values: Array<number | null> }>;
}

const RANK: Record<string, number> = { DAILY: 0, WEEKLY: 1, MONTHLY: 2, QUARTERLY: 3, ANNUAL: 4 };

/**
 * Todas las series de una familia en tablas: una por frecuencia, porque un dato anual y uno
 * mensual no comparten fila sin inventar un valor. Cada columna es una serie; una celda
 * vacía es un período sin observación, nunca un valor rellenado.
 */
export function buildFamilyTables(items: readonly FamilySeriesData[]): FamilyTableGroup[] {
  const byFrequency = new Map<string, FamilySeriesData[]>();
  for (const item of items) {
    const list = byFrequency.get(item.series.frequency) ?? [];
    list.push(item);
    byFrequency.set(item.series.frequency, list);
  }
  return [...byFrequency]
    .sort(([a], [b]) => (RANK[a] ?? 99) - (RANK[b] ?? 99))
    .map(([frequency, group]) => {
      const lookups = group.map(
        (item) =>
          new Map(
            item.points.map((point) => [
              point.period,
              point.value !== null && Number.isFinite(point.value) ? point.value : null,
            ]),
          ),
      );
      const periods = [...new Set(lookups.flatMap((lookup) => [...lookup.keys()]))].sort((a, b) =>
        b.localeCompare(a),
      );
      return {
        frequency,
        columns: group.map(({ series }) => ({
          code: series.code,
          name: series.name,
          unit: series.unit,
        })),
        rows: periods.map((period) => ({
          period,
          values: lookups.map((lookup) => lookup.get(period) ?? null),
        })),
      };
    });
}

export const FAMILY_CSV_HEADER = [
  'serie',
  'nombre',
  'unidad',
  'frecuencia',
  'periodo',
  'valor',
  'estado',
  'fuente',
] as const;

/** Todas las observaciones de todas las series, una por fila: se abre igual en una planilla o en código. */
export function familyCsvRows(
  items: readonly FamilySeriesData[],
): Array<Array<string | number | null>> {
  return items.flatMap(({ series, points }) =>
    points.map((point) => [
      series.code,
      series.name,
      series.unit,
      series.frequency,
      point.period,
      point.value !== null && Number.isFinite(point.value) ? point.value : null,
      point.status,
      point.sourceUrl || series.sourceUrl || null,
    ]),
  );
}

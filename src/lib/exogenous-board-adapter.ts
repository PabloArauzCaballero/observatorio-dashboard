import type { ExogenousSeries } from './exogenous-board';
import type { FamilySeriesData } from './exogenous-factor-table';
import type { FactorObservation, FactorSeries } from './exogenous-factor-types';

/**
 * Una lectura de «Precios por producto» con la forma que usan la tabla completa y la
 * comparación entre frecuencias. No inventa nada: lo que la lectura no declara queda vacío.
 */
export function asFactorSeries(one: ExogenousSeries): FactorSeries {
  const last = one.points.at(-1);
  return {
    code: one.code,
    familyIds: [],
    sectorIds: [],
    name: one.name,
    measureType: one.kind,
    unit: one.unit,
    frequency: one.frequency,
    geography: one.market,
    market: one.market,
    publisher: one.publisher,
    sourceUrl: one.sourceUrl ?? '',
    note: one.note,
    economicRole: '',
    targetScope: one.scope,
    observationStatus: 'OBSERVED',
    measurementStatus: 'DIRECT',
    transformationType: 'NONE',
    origin: 'LEGACY_PRICE',
    latestPeriod: last?.[0] ?? null,
    latestValue: last?.[1] ?? null,
    availableAt: null,
    freshnessDays: null,
  };
}

export function asFamilyData(one: ExogenousSeries): FamilySeriesData {
  const points: FactorObservation[] = one.points.map(([period, value]) => ({
    period,
    value,
    status: 'OBSERVED',
    publishedAt: null,
    availableAt: '',
    retrievedAt: '',
    sourceUrl: one.sourceUrl ?? '',
    evidenceSha256: null,
  }));
  return { series: asFactorSeries(one), points };
}

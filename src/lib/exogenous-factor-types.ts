/** Contratos públicos: metadatos y series viajan separados del histórico. */
export interface EconomicSector {
  id: string;
  label: string;
}
export interface FactorFamily {
  id: string;
  name: string;
  sectorLabel: string;
  sectorIds: string[];
  definition: string;
  unit: string;
  frequency: string;
  geography: string;
  channel: string;
  lagHypothesis: string;
  sourceUrl: string | null;
  priority: 'P0' | 'P1' | 'P2';
  role: string;
  roleDetail: string;
  availability: string;
  mechanisms: string[];
  desk: string;
  seriesCount: number;
}
export type FactorMeasure =
  'PRICE' | 'INDEX' | 'RATE' | 'STOCK' | 'FLOW' | 'QUANTITY' | 'COUNT' | 'DURATION' | 'PROPORTION';
export type FactorFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
export interface FactorObservation {
  period: string;
  value: number | null;
  status: string;
  publishedAt: string | null;
  availableAt: string;
  retrievedAt: string;
  sourceUrl: string;
  evidenceSha256: string | null;
}
export interface FactorSeries {
  code: string;
  familyIds: string[];
  sectorIds: string[];
  name: string;
  measureType: FactorMeasure;
  unit: string;
  frequency: FactorFrequency;
  geography: string;
  market: string;
  publisher: string;
  sourceUrl: string;
  sourceSeriesKey?: string;
  note: string;
  economicRole: string;
  targetScope: string;
  observationStatus: string;
  measurementStatus: string;
  transformationType: string;
  origin: 'FACTOR' | 'LEGACY_PRICE';
  latestPeriod: string | null;
  latestValue: number | null;
  availableAt: string | null;
  freshnessDays: number | null;
}
export interface FactorCatalogueResponse {
  families: FactorFamily[];
  total: number;
  page: number;
  pageSize: number;
  sectors: EconomicSector[];
  mechanisms: string[];
  coverage: { families: number; linkedFamilies: number; series: number };
  warnings: string[];
}
export interface FactorSeriesResponse {
  series: FactorSeries[];
  warnings: string[];
}
export interface FactorHistoryResponse {
  series: FactorSeries;
  points: FactorObservation[];
  asOf: string;
  nextCursor: string | null;
  warnings: string[];
}

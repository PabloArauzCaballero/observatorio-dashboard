/**
 * Las estadísticas del Banco Central, en la forma que el explorador las pide.
 *
 * El catálogo son doce mil series y no viaja entero: cada búsqueda trae las que
 * coinciden (hasta `PAGE`) y los puntos se piden solo de las series que alguien
 * eligió. Este módulo no toca la base.
 */

export interface BcbFamily {
  family: string;
  label: string;
  series: number;
}

export interface BcbSeriesInfo {
  code: string;
  name: string;
  family: string;
  workbook: string;
  sheet: string;
  unit: string | null;
  frequency: string;
  firstPeriod: string;
  lastPeriod: string;
  pointCount: number;
}

export interface BcbCatalogPage {
  families: BcbFamily[];
  results: BcbSeriesInfo[];
  total: number;
}

export interface BcbSeriesData extends BcbSeriesInfo {
  locator: Record<string, string | number> | null;
  sourceUrl: string | null;
  evidenceSha256: string | null;
  /** `[fecha, valor]` como la semilla: el nombre de dos campos repetido en cada punto era la mitad del peso. */
  points: Array<[string, number]>;
}

export const PAGE = 60;
export const MAX_SELECTED = 4;

export const FAMILY_LABEL: Record<string, string> = {
  'activos-virtuales': 'Activos virtuales (BCB)',
  'sector-externo': 'Sector externo',
  'sector-monetario': 'Dinero y bancos',
  'sistema-de-pagos': 'Sistema de pagos',
  semanales: 'Estadísticas semanales',
  'tasas-de-interes': 'Tasas de interés',
  precios: 'Precios',
  'tipo-de-cambio': 'Tipo de cambio',
  publicaciones: 'Publicaciones del BCB',
  otros: 'Otros',
};

export const FREQUENCY_LABEL: Record<string, string> = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
  MIXED: 'Mezclada',
};

export const familyLabel = (family: string): string => FAMILY_LABEL[family] ?? family;

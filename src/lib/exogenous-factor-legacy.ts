import type { FactorSeries } from './exogenous-factor-types';

// Correspondencias económicas explícitas; nunca se enlaza una tarifa a una familia de demoras.
const PRODUCT_FAMILIES: Record<string, string[]> = {
  CRUDE: ['PRD_EN01'],
  GASOLINE: ['PRD_EN02'],
  DIESEL: ['PRD_EN02'],
  LPG: ['PRD_EN02'],
  NATURAL_GAS: ['PRD_EN05'],
  GOLD: ['PRD_MI02'],
  SILVER: ['PRD_MI02'],
  ZINC: ['PRD_MI01'],
  LEAD: ['PRD_MI01'],
  TIN: ['PRD_MI01'],
  COPPER: ['PRD_MI01'],
  ALUMINUM: ['PRD_MI01'],
  IRON_ORE: ['PRD_MI03'],
  STEEL: ['PRD_MI03'],
  SOY: ['PRD_AG01'],
  MAIZE: ['PRD_AG05'],
  RICE: ['PRD_AG05'],
  WHEAT: ['PRD_AG05'],
  SORGHUM: ['PRD_AG05'],
  SUGAR: ['PRD_AG12'],
  COFFEE: ['PRD_AG09'],
  COCOA: ['PRD_AG10'],
  BANANA: ['PRD_AG14'],
  POTATO: ['PRD_AG15'],
  QUINOA: ['PRD_AG08'],
  BEEF: ['PRD_LV01'],
  DAIRY: ['PRD_LV05'],
  CHEESE: ['PRD_LV05'],
  FERTILIZERS: ['PRD_AG16'],
  RESINS: ['PRD_MA09'],
  AGROCHEMICALS: ['PRD_AG17'],
  PRECURSORS: ['PRD_MA06'],
  CEMENT: ['PRD_CO01'],
  JOISTS: ['PRD_CO01'],
  REBAR: ['PRD_CO01'],
  CONCRETE: ['PRD_CO01'],
  BRICK: ['PRD_CO01'],
  LUMBER: ['PRD_CO01'],
};
const GROUP_SECTORS: Record<string, string[]> = {
  ENERGY: ['B', 'D', 'H'],
  MINERALS: ['B', 'C'],
  AGRICULTURE: ['A', 'C', 'G'],
  LIVESTOCK: ['A', 'C'],
  INDUSTRY: ['C'],
  CONSTRUCTION: ['F'],
  FREIGHT: ['H', 'G'],
  CURRENCY: ['K', 'G'],
};
/** El período realizado debe existir en el calendario y haber empezado al capturarlo. */
export function isKnownLegacyPeriod(period: string, availableAt: string): boolean {
  if (!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(period)) return false;
  const day =
    period.length === 4 ? `${period}-01-01` : period.length === 7 ? `${period}-01` : period;
  const start = new Date(`${day}T00:00:00Z`);
  const received = new Date(availableAt);
  return (
    Number.isFinite(start.getTime()) &&
    Number.isFinite(received.getTime()) &&
    start.toISOString().slice(0, 10) === day &&
    start.getTime() <= received.getTime()
  );
}
export function legacyFactor(
  payload: Record<string, unknown>,
  sourceUrl: string,
  availableAt: string,
): FactorSeries {
  const text = (key: string) => (typeof payload[key] === 'string' ? (payload[key] as string) : '');
  const product = text('product');
  const scope = text('scope');
  let familyIds = PRODUCT_FAMILIES[product] ?? [];
  if (text('group') === 'CURRENCY')
    familyIds =
      (
        {
          USD: ['MF_FX_OFFICIAL'],
          BRL: ['MF_BRLUSD'],
          ARS: ['MF_ARSUSD'],
          CLP: ['MF_CLPUSD'],
          PEN: ['MF_PENUSD'],
          CNY: ['MF_CNYUSD'],
          EUR: ['MF_EURUSD'],
        } as Record<string, string[]>
      )[product] ?? [];
  // Cotizaciones BCB por BOB no son cruces USD. Se muestran sólo en familia oficial correspondiente.
  if (text('group') === 'CURRENCY' && product !== 'USD') familyIds = [];
  if (scope === 'BOLIVIA_CUSTOMS' && product === 'NATURAL_GAS') familyIds = ['PRD_EN06'];
  const local = ['BOLIVIA_MARKET', 'BOLIVIA_CUSTOMS', 'BCB_OFFICIAL'].includes(scope);
  return {
    code: text('indicatorCode'),
    familyIds,
    sectorIds: GROUP_SECTORS[text('group')] ?? [],
    name: text('name'),
    measureType: text('kind') === 'INDEX' ? 'INDEX' : 'PRICE',
    unit: text('unit'),
    frequency: text('frequency') as FactorSeries['frequency'],
    geography: text('market'),
    market: text('market'),
    publisher: text('publisher'),
    sourceUrl,
    note: text('note'),
    economicRole: scope === 'BCB_OFFICIAL' ? 'CONDITION' : local ? 'OUTCOME' : 'EXTERNAL_DRIVER',
    targetScope: 'Costos e ingresos del sector boliviano; validar exposición y horizonte.',
    observationStatus: 'OBSERVED',
    measurementStatus: ['US_PRODUCER_INDEX', 'BOLIVIA_CUSTOMS'].includes(scope)
      ? 'PROXY'
      : 'DIRECT',
    transformationType: 'ORIGINAL',
    origin: 'LEGACY_PRICE',
    latestPeriod: text('period') || null,
    latestValue: payload.value == null ? null : Number(payload.value),
    availableAt,
    freshnessDays: null,
  };
}

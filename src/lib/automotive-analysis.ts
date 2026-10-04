import type snapshot from '@/data/automotive-study.json';

export type AutomotiveStudy = typeof snapshot;
export type AutomotiveOffer = AutomotiveStudy['offers'][number];

export function offerStatus(offer: AutomotiveOffer, asOf: string): string {
  if (offer.validUntil && offer.validUntil < asOf) return 'Vencida';
  return offer.status;
}

export function fleetSignals(study: AutomotiveStudy) {
  const annual = study.fleet.annual;
  const total = annual.at(-1)!.value;
  const prior = annual.at(-2)!.value;
  const motorcycle = study.fleet.classes.find(row => row.name === 'Motocicleta')!;
  const core = study.fleet.departments.filter(row => ['Santa Cruz', 'La Paz', 'Cochabamba'].includes(row.name));
  return {
    total, increase: total - prior, growth: (total / prior - 1) * 100,
    nonMotorcycle: total - motorcycle.value,
    nonMotorcycleGrowth: ((total - motorcycle.value) / (prior - motorcycle.prior) - 1) * 100,
    motorcycleContribution: (motorcycle.value - motorcycle.prior) / (total - prior) * 100,
    mainDepartmentsShare: core.reduce((sum, row) => sum + row.value, 0) / total * 100,
    through2015: study.fleet.ages.slice(0, 10).reduce((sum, row) => sum + row.value, 0),
  };
}

export interface InventoryInputs {
  purchaseUsd: number; freightUsd: number; fx: number; taxesBob: number;
  recoverableTaxBob: number; localBob: number; units: number; days: number;
  annualRate: number; targetMargin: number; fixedMonthlyBob: number;
}

/** All defaults in the UI are hypothetical; tax amounts are entered, never inferred from a label. */
export function inventoryScenario(input: InventoryInputs) {
  if (Object.values(input).some(v => !Number.isFinite(v) || v < 0) || input.fx <= 0 || input.targetMargin >= 100) return null;
  const economicCost = (input.purchaseUsd + input.freightUsd) * input.fx + input.taxesBob + input.localBob;
  const cashPerUnit = economicCost + input.recoverableTaxBob;
  const financing = cashPerUnit * input.annualRate / 100 * input.days / 365;
  const costWithFinance = economicCost + financing;
  const targetPrice = costWithFinance / (1 - input.targetMargin / 100);
  const contribution = targetPrice - costWithFinance;
  return {
    economicCost, cashPerUnit, financing, costWithFinance, targetPrice,
    workingCapital: cashPerUnit * input.units,
    breakEvenUnits: contribution > 0 ? Math.ceil(input.fixedMonthlyBob / contribution) : null,
  };
}

export function ownershipCost(purchase: number, resale: number, years: number, annualKm: number, consumption: number, energyPrice: number, annualOther: number) {
  const valid = [purchase, resale, years, annualKm, consumption, energyPrice, annualOther].every(v => Number.isFinite(v) && v >= 0);
  if (!valid || years <= 0 || annualKm <= 0 || resale > purchase) return null;
  const energy = annualKm * years * consumption / 100 * energyPrice;
  const total = purchase - resale + energy + years * annualOther;
  return { energy, total, perKm: total / (years * annualKm) };
}

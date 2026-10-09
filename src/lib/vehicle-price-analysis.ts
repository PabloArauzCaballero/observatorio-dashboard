export type VehicleOffer = {
  type: string;
  brand: string;
  model: string;
  version: string;
  modelYear: number;
  price: number;
  currency: string;
  priceType: string;
  observedAt: string;
};

export function vehicleCoverage(rows: readonly VehicleOffer[]) {
  const groups = new Map<string, VehicleOffer[]>();
  for (const row of rows) groups.set(row.type, [...(groups.get(row.type) ?? []), row]);
  return [...groups].map(([type, offers]) => ({
    type,
    brands: new Set(offers.map(row => row.brand)).size,
    models: new Set(offers.map(row => `${row.brand}|${row.model}`)).size,
    versions: offers.length,
  })).sort((a, b) => a.type.localeCompare(b.type, 'es'));
}

/** A numeric price range needs exactly one currency, selected or in the whole dataset. */
export function priceRangeCurrency(rows: readonly VehicleOffer[], selected: ReadonlySet<string>): string | null {
  const currencies = new Set(rows.map(row => row.currency));
  if (selected.size === 1) return [...selected][0] ?? null;
  return currencies.size === 1 ? [...currencies][0] ?? null : null;
}

/** Compares simultaneous offers for the same named version across model years. */
export function comparableModelYears(rows: readonly VehicleOffer[]) {
  const groups = new Map<string, VehicleOffer[]>();
  for (const row of rows) {
    const key = [row.brand, row.model, row.version, row.currency, row.priceType, row.observedAt].join('|');
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].flatMap(group => {
    const years = [...group].sort((a, b) => a.modelYear - b.modelYear);
    return years.slice(1).flatMap((after, index) => {
      const before = years[index]!;
      return before.modelYear !== after.modelYear ? [{ before, after, difference: after.price - before.price }] : [];
    });
  }).sort((a, b) => a.before.brand.localeCompare(b.before.brand, 'es') ||
    a.before.model.localeCompare(b.before.model, 'es') ||
    a.before.version.localeCompare(b.before.version, 'es'));
}

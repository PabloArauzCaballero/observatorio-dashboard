import 'server-only';
import fallback from '@/data/vehicle-prices.json';
import { readAutomotiveStudy } from './automotive-study';

export type VehiclePrice = (typeof fallback)[number] & {
  powertrain?: string | null;
  city?: string | null;
  dealer?: string | null;
  validUntil?: string | null;
  availability?: string;
  sourceSha256?: string;
  conditions?: string;
};

/** Expanded study supersedes the dated pilot; original observations remain in core history. */
export async function readVehiclePrices(): Promise<{
  rows: VehiclePrice[];
  catalogOrigin: 'core' | 'snapshot';
}> {
  const { study, catalogOrigin } = await readAutomotiveStudy();
  const sources = new Map(study.sources.map(row => [row.id, row]));
  const rows = study.offers.filter(row => row.country === 'Bolivia' && row.modelYear !== null && row.currency === 'USD' && !row.status.startsWith('Conflicto')).map(row => {
    const prior = fallback.find(old => old.brand === row.brand && old.model.replace('New ', '') === row.model);
    const source = sources.get(row.sourceId)!;
    return {
      type: prior?.type ?? 'Otro', brand: row.brand, model: row.model, version: row.version,
      modelYear: row.modelYear!, price: row.price, currency: row.currency,
      priceType: row.priceType, observedAt: row.observedAt, source: source.url,
      transmission: /CVT/i.test(row.version) ? 'CVT' : /MT|mecánica/i.test(row.version) ? 'Manual' : /automática|\bAT\b|\bTA\b/i.test(row.version) ? 'Automática' : 'No especificada',
      traction: /4x4/i.test(row.version) ? '4x4' : /4x2/i.test(row.version) ? '4x2' : 'No especificada',
      city: null, dealer: row.dealer, validUntil: row.validUntil, availability: row.availability,
      sourceSha256: source.sha256, conditions: row.conditions,
    };
  });
  return { rows, catalogOrigin };
}

import 'server-only';
import fallback from '@/data/vehicle-prices.json';
import { pool } from './db';

export type VehiclePrice = (typeof fallback)[number] & {
  powertrain?: string | null;
  city?: string | null;
  dealer?: string | null;
  validUntil?: string | null;
  availability?: string;
  sourceSha256?: string;
};

type VehiclePriceRow = Omit<VehiclePrice, 'price'> & { price: string };

/** Reads the core catalogue; the dated local capture bridges pre-migration deployments. */
export async function readVehiclePrices(): Promise<{
  rows: VehiclePrice[];
  catalogOrigin: 'core' | 'snapshot';
}> {
  try {
    const result = await pool().query<VehiclePriceRow>(`
      SELECT body_type AS type, brand, model, version, model_year AS "modelYear",
             price::text AS price, currency, price_type AS "priceType",
             to_char(observed_at, 'YYYY-MM-DD') AS "observedAt",
             source_url AS source, transmission, traction, powertrain, city, dealer,
             to_char(valid_until, 'YYYY-MM-DD') AS "validUntil",
             availability, source_sha256 AS "sourceSha256"
      FROM read_models.vehicle_price_offer
      ORDER BY brand, model, version, model_year, source_url`);
    // The migration can finish before the separate seed service has loaded its offers.
    if (!result.rows.length) return { rows: fallback, catalogOrigin: 'snapshot' };
    return {
      rows: result.rows.map((row) => ({ ...row, price: Number(row.price) })),
      catalogOrigin: 'core',
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== '42P01' && code !== '42501' && code !== '42703') throw error;
    console.warn(`[observatorio] modelo ilegible: read_models.vehicle_price_offer (${code})`);
    return { rows: fallback, catalogOrigin: 'snapshot' };
  }
}

import 'server-only';
import roadTransportSeed from '../data/road-transport.json';
import { pool } from './db';
import { held } from './hold';
import {
  fillRoadTransportGaps,
  roadTransportFromSeed,
  type RoadTransportSeed,
} from './road-transport-fallback';

/**
 * La red ferroviaria y la fluvial que el núcleo lee de OpenStreetMap y del INE.
 *
 * Las mismas reglas que `roads.ts`: la geometría viene del mismo extracto de
 * OpenStreetMap que la red vial, ya cortada por departamento y simplificada;
 * el tráfico ferroviario, del cuadro mensual del INE. La navegabilidad de un
 * río no la afirma OpenStreetMap, así que cada río trae la categoría que dice
 * quién la afirma: el Ministerio de Obras Públicas (hidrovía o afluente en
 * estudio), la etiqueta `boat=yes` de OpenStreetMap, o nadie.
 */

type Line = [number, number][][];

export type RailNetwork = 'ANDINA' | 'ORIENTAL' | 'METROPOLITANA';
export type RailStatus = 'EN_SERVICIO' | 'EN_CONSTRUCCION' | 'EN_DESUSO' | 'ABANDONADA';

export interface RailLine {
  lineId: string;
  network: RailNetwork;
  line: string | null;
  department: string;
  status: RailStatus;
  operator: string | null;
  gauge: string | null;
  lengthKm: number;
  geometry: Line;
}

export interface RailStation {
  osmId: string;
  name: string;
  kind: 'ESTACION' | 'APEADERO';
  network: RailNetwork;
  department: string;
  lon: number;
  lat: number;
}

export interface RailFlowPoint {
  network: 'ANDINA' | 'ORIENTAL';
  service: 'PASAJEROS' | 'CARGA' | 'EQUIPAJE_ENCOMIENDA';
  unit: 'PERSONAS' | 'TONELADAS';
  period: string;
  value: number;
  preliminary: boolean;
  partialYear: boolean;
}

export type WaterwayCategory =
  'HIDROVIA' | 'NAVEGABLE_EN_ESTUDIO' | 'NAVEGABLE_OSM' | 'RIO' | 'TRANSBORDADOR';

export interface Waterway {
  waterwayId: string;
  category: WaterwayCategory;
  name: string | null;
  department: string;
  lengthKm: number;
  boatYesKm: number;
  geometry: Line;
}

export interface WaterPort {
  osmId: string;
  name: string | null;
  kind: 'PUERTO' | 'TERMINAL';
  department: string;
  lon: number;
  lat: number;
}

export interface TransportProvenance {
  sourceKey: string;
  publisher: string;
  sourceTitle: string;
  sourceUrl: string;
  evidenceSha256: string;
}

export interface FleetPoint extends TransportProvenance {
  dimension: 'DEPARTMENT_SERVICE' | 'SERVICE_CLASS' | 'SERVICE_CLASS_CAPACITY';
  department: string | null;
  service: 'TOTAL' | 'PARTICULAR' | 'PUBLICO' | 'OFICIAL';
  vehicleClass: string | null;
  capacityBand: string | null;
  period: string;
  value: number;
  preliminary: boolean;
}

export interface GnvPoint extends TransportProvenance {
  metric: 'CONVERSION' | 'CYLINDER_REQUALIFICATION';
  dimension: 'DEPARTMENT_QUARTER' | 'DEPARTMENT_CLASS';
  department: string;
  vehicleClass: string | null;
  period: string;
  value: number;
  preliminary: boolean;
}

export interface FareBand extends TransportProvenance {
  regulation: 'ATT_0178_2013' | 'ATT_0032_2025';
  publishedOn: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  origin: string;
  destination: string;
  road: 'DEFAULT' | 'NEW' | 'OLD';
  currency: 'BOB';
  normalMin: number;
  normalMax: number;
  semicamaMin: number | null;
  semicamaMax: number | null;
  camaMin: number | null;
  camaMax: number | null;
}

export interface RoadTransportData {
  fleet: FleetPoint[];
  gnv: GnvPoint[];
  fares: FareBand[];
}

const BUNDLED_ROAD_TRANSPORT = roadTransportFromSeed(
  roadTransportSeed as unknown as RoadTransportSeed,
);

/**
 * Un modelo ilegible es un capítulo vacío, nunca un informe que se cae: la
 * misma regla que `roads.ts`. El SQLSTATE va al log; la página recibe una
 * lista vacía, porque el mensaje puede llevar el servidor, el usuario y el
 * puerto.
 */
async function readOrEmpty<T>(model: string, read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === '42P01' || code === '42501' || code === '42703') {
      console.warn(`[observatorio] modelo ilegible: ${model} (${code})`);
      return [];
    }
    throw error;
  }
}

const PUBLISHED = `claim_status = 'PUBLISHED' AND NOT superseded`;

export function readRailLines(): Promise<RailLine[]> {
  return held('railLines', () =>
    readOrEmpty('read_models.rail_line', async () => {
      const { rows } = await pool().query<{
        line_id: string;
        network: RailNetwork;
        line: string | null;
        department: string;
        status: RailStatus;
        operator: string | null;
        gauge: string | null;
        length_km: string;
        geometry: Line;
      }>(
        `SELECT line_id, network, line, department, status, operator, gauge, length_km::text, geometry
         FROM read_models.rail_line WHERE ${PUBLISHED}
         ORDER BY network, line NULLS LAST, department`,
      );
      return rows.map((row) => ({
        lineId: row.line_id,
        network: row.network,
        line: row.line,
        department: row.department,
        status: row.status,
        operator: row.operator,
        gauge: row.gauge,
        lengthKm: Number(row.length_km),
        geometry: row.geometry,
      }));
    }),
  );
}

export function readRailStations(): Promise<RailStation[]> {
  return held('railStations', () =>
    readOrEmpty('read_models.rail_station', async () => {
      const { rows } = await pool().query<{
        osm_id: string;
        name: string;
        kind: RailStation['kind'];
        network: RailNetwork;
        department: string;
        lon: string;
        lat: string;
      }>(
        `SELECT osm_id, name, kind, network, department, lon::text, lat::text
         FROM read_models.rail_station WHERE ${PUBLISHED} ORDER BY name`,
      );
      return rows.map((row) => ({
        osmId: row.osm_id,
        name: row.name,
        kind: row.kind,
        network: row.network,
        department: row.department,
        lon: Number(row.lon),
        lat: Number(row.lat),
      }));
    }),
  );
}

export function readRailFlows(): Promise<RailFlowPoint[]> {
  return held('railFlows', () =>
    readOrEmpty('read_models.rail_flow', async () => {
      const { rows } = await pool().query<{
        network: RailFlowPoint['network'];
        service: RailFlowPoint['service'];
        unit: RailFlowPoint['unit'];
        period: string;
        value: string;
        preliminary: boolean;
        partial_year: boolean;
      }>(
        `SELECT network, service, unit, period, value::text, preliminary, partial_year
         FROM read_models.rail_flow WHERE ${PUBLISHED} ORDER BY network, service, period`,
      );
      return rows.map((row) => ({
        network: row.network,
        service: row.service,
        unit: row.unit,
        period: row.period,
        value: Number(row.value),
        preliminary: row.preliminary,
        partialYear: row.partial_year,
      }));
    }),
  );
}

export function readWaterways(): Promise<Waterway[]> {
  return held('waterways', () =>
    readOrEmpty('read_models.waterway_line', async () => {
      const { rows } = await pool().query<{
        waterway_id: string;
        category: WaterwayCategory;
        name: string | null;
        department: string;
        length_km: string;
        boat_yes_km: string;
        geometry: Line;
      }>(
        `SELECT waterway_id, category, name, department, length_km::text, boat_yes_km::text, geometry
         FROM read_models.waterway_line WHERE ${PUBLISHED}
         ORDER BY category, name NULLS LAST, department`,
      );
      return rows.map((row) => ({
        waterwayId: row.waterway_id,
        category: row.category,
        name: row.name,
        department: row.department,
        lengthKm: Number(row.length_km),
        boatYesKm: Number(row.boat_yes_km),
        geometry: row.geometry,
      }));
    }),
  );
}

export function readWaterPorts(): Promise<WaterPort[]> {
  return held('waterPorts', () =>
    readOrEmpty('read_models.water_port', async () => {
      const { rows } = await pool().query<{
        osm_id: string;
        name: string | null;
        kind: WaterPort['kind'];
        department: string;
        lon: string;
        lat: string;
      }>(
        `SELECT osm_id, name, kind, department, lon::text, lat::text
         FROM read_models.water_port WHERE ${PUBLISHED} ORDER BY name NULLS LAST`,
      );
      return rows.map((row) => ({
        osmId: row.osm_id,
        name: row.name,
        kind: row.kind,
        department: row.department,
        lon: Number(row.lon),
        lat: Number(row.lat),
      }));
    }),
  );
}

const provenance = (row: {
  source_key: string;
  publisher: string;
  source_title: string;
  source_url: string;
  evidence_sha256: string;
}): TransportProvenance => ({
  sourceKey: row.source_key,
  publisher: row.publisher,
  sourceTitle: row.source_title,
  sourceUrl: row.source_url,
  evidenceSha256: row.evidence_sha256,
});

/** All road-economy readings in one held request; each query still degrades independently. */
export function readRoadTransport(): Promise<RoadTransportData> {
  return held('roadTransport', async () => {
    const [fleet, gnv, fares] = await Promise.all([
      readOrEmpty('read_models.vehicle_fleet', async () => {
        const { rows } = await pool().query<{
          dimension: FleetPoint['dimension'];
          department: string | null;
          service: FleetPoint['service'];
          vehicle_class: string | null;
          capacity_band: string | null;
          period: string;
          value: string;
          preliminary: boolean;
          source_key: string;
          publisher: string;
          source_title: string;
          source_url: string;
          evidence_sha256: string;
        }>(`SELECT dimension, department, service, vehicle_class, capacity_band, period,
                    value::text, preliminary, source_key, publisher, source_title,
                    source_url, evidence_sha256
             FROM read_models.vehicle_fleet WHERE ${PUBLISHED}
             ORDER BY dimension, department NULLS FIRST, service, vehicle_class NULLS FIRST, period`);
        return rows.map((row) => ({
          dimension: row.dimension,
          department: row.department,
          service: row.service,
          vehicleClass: row.vehicle_class,
          capacityBand: row.capacity_band,
          period: row.period,
          value: Number(row.value),
          preliminary: row.preliminary,
          ...provenance(row),
        }));
      }),
      readOrEmpty('read_models.gnv_activity', async () => {
        const { rows } = await pool().query<{
          metric: GnvPoint['metric'];
          dimension: GnvPoint['dimension'];
          department: string;
          vehicle_class: string | null;
          period: string;
          value: string;
          preliminary: boolean;
          source_key: string;
          publisher: string;
          source_title: string;
          source_url: string;
          evidence_sha256: string;
        }>(`SELECT metric, dimension, department, vehicle_class, period, value::text, preliminary,
                    source_key, publisher, source_title, source_url, evidence_sha256
             FROM read_models.gnv_activity WHERE ${PUBLISHED}
             ORDER BY metric, dimension, department, vehicle_class NULLS FIRST, period`);
        return rows.map((row) => ({
          metric: row.metric,
          dimension: row.dimension,
          department: row.department,
          vehicleClass: row.vehicle_class,
          period: row.period,
          value: Number(row.value),
          preliminary: row.preliminary,
          ...provenance(row),
        }));
      }),
      readOrEmpty('read_models.intercity_fare_band', async () => {
        const { rows } = await pool().query<{
          regulation: FareBand['regulation'];
          published_on: string;
          effective_from: string;
          effective_until: string | null;
          origin: string;
          destination: string;
          road: FareBand['road'];
          currency: 'BOB';
          normal_min: string;
          normal_max: string;
          semicama_min: string | null;
          semicama_max: string | null;
          cama_min: string | null;
          cama_max: string | null;
          source_key: string;
          publisher: string;
          source_title: string;
          source_url: string;
          evidence_sha256: string;
        }>(`SELECT regulation, published_on::text, effective_from::text, effective_until::text,
                    origin, destination, road, currency, normal_min::text, normal_max::text,
                    semicama_min::text, semicama_max::text, cama_min::text, cama_max::text,
                    source_key, publisher, source_title, source_url, evidence_sha256
             FROM read_models.intercity_fare_band WHERE ${PUBLISHED}
             ORDER BY regulation, origin, destination, road`);
        const optional = (value: string | null): number | null =>
          value === null ? null : Number(value);
        return rows.map((row) => ({
          regulation: row.regulation,
          publishedOn: row.published_on,
          effectiveFrom: row.effective_from,
          effectiveUntil: row.effective_until,
          origin: row.origin,
          destination: row.destination,
          road: row.road,
          currency: row.currency,
          normalMin: Number(row.normal_min),
          normalMax: Number(row.normal_max),
          semicamaMin: optional(row.semicama_min),
          semicamaMax: optional(row.semicama_max),
          camaMin: optional(row.cama_min),
          camaMax: optional(row.cama_max),
          ...provenance(row),
        }));
      }),
    ]);
    return fillRoadTransportGaps({ fleet, gnv, fares }, BUNDLED_ROAD_TRANSPORT);
  });
}

import 'server-only';
import catalogue from '@/data/exogenous-catalogue.json';
import snapshot from '@/data/exogenous-factor-snapshot.json';
import legacySnapshot from '@/data/exogenous-legacy-snapshot.json';
import { pool } from './db';
import { held } from './hold';
import {
  catalogueQuery,
  filterFamilies,
  historyQuery,
  selectKnownPoints,
  supportsSnapshotFallback,
  factorPageMetadata,
} from './exogenous-factor-query';
import { isKnownLegacyPeriod, legacyFactor } from './exogenous-factor-legacy';
import type {
  FactorCatalogueResponse,
  FactorFamily,
  FactorHistoryResponse,
  FactorObservation,
  FactorSeries,
  FactorSeriesResponse,
} from './exogenous-factor-types';

type Payload = Record<string, unknown>;
interface VersionRow {
  code: string;
  period: string;
  value: string | null;
  available_at: Date | string;
  received_at: Date | string;
  payload: Payload;
  source_url: string;
  evidence_sha256: string | null;
}
interface SnapshotSeries extends Omit<
  FactorSeries,
  'origin' | 'latestPeriod' | 'latestValue' | 'availableAt'
> {
  licenseStatus: string;
  points: Array<{
    period: string;
    value: string | null;
    status: string;
    publishedAt: string | null;
    firstSeenAt: string;
    retrievedAt: string;
    sourceUrl: string;
    upstreamSha256: string;
  }>;
}
const archived = (snapshot as unknown as { series: SnapshotSeries[] }).series.filter(
  (s) => s.licenseStatus === 'PUBLIC_REUSE_ALLOWED',
);
interface LegacySnapshotSeries extends Payload {
  indicatorCode: string;
  provenance?: { sourceUrl: string; upstreamSha256: string; retrievedAt: string };
  points: Array<{
    period: string;
    value: string;
    sourceUrl?: string;
    upstreamSha256?: string;
    retrievedAt?: string;
  }>;
}
const legacyArchived = (legacySnapshot as unknown as { series: LegacySnapshotSeries[] }).series.map(
  (s) => {
    const points: FactorObservation[] = s.points.flatMap((p) => {
      const availableAt = p.retrievedAt ?? s.provenance?.retrievedAt;
      const sourceUrl = p.sourceUrl ?? s.provenance?.sourceUrl;
      if (!availableAt || !sourceUrl) return [];
      // Los precios realizados no pueden corresponder a un día posterior a su captura.
      if (!isKnownLegacyPeriod(p.period, availableAt)) return [];
      return [
        {
          period: p.period,
          value: Number(p.value),
          status: 'OBSERVED',
          publishedAt: null,
          availableAt,
          retrievedAt: availableAt,
          sourceUrl,
          evidenceSha256: p.upstreamSha256 ?? s.provenance?.upstreamSha256 ?? null,
        },
      ];
    });
    return {
      series: legacyFactor(
        s,
        s.provenance?.sourceUrl ?? points.at(-1)?.sourceUrl ?? '',
        points.at(-1)?.availableAt ?? new Date(0).toISOString(),
      ),
      points,
    };
  },
);
const iso = (value: Date | string) => new Date(value).toISOString();
const fields = (legacy: boolean) =>
  `code, period, value::text, available_at, received_at, payload, ${legacy ? 'source_url, evidence_sha256' : "payload->>'sourceUrl' AS source_url, payload->>'upstreamSha256' AS evidence_sha256"}`;
const view = (legacy: boolean) =>
  legacy ? 'read_models.exogenous_legacy_version' : 'read_models.exogenous_factor_version';
function seriesOf(row: VersionRow, legacy: boolean): FactorSeries {
  if (legacy) return legacyFactor(row.payload, row.source_url, iso(row.available_at));
  const p = row.payload;
  return {
    sourceSeriesKey: String(p.sourceSeriesKey),
    code: row.code,
    familyIds: p.familyIds as string[],
    sectorIds: p.sectorIds as string[],
    name: String(p.name),
    measureType: p.measureType as FactorSeries['measureType'],
    unit: String(p.unit),
    frequency: p.frequency as FactorSeries['frequency'],
    geography: String(p.geography),
    market: String(p.market),
    publisher: String(p.publisher),
    sourceUrl: String(p.sourceUrl),
    note: String(p.note),
    economicRole: String(p.economicRole),
    targetScope: String(p.targetScope),
    observationStatus: String(p.observationStatus),
    measurementStatus: String(p.measurementStatus),
    transformationType: String(p.transformationType),
    origin: 'FACTOR',
    latestPeriod: row.period,
    latestValue: row.value === null ? null : Number(row.value),
    availableAt: iso(row.available_at),
    freshnessDays: typeof p.freshnessDays === 'number' ? p.freshnessDays : null,
  };
}
function observationOf(row: VersionRow): FactorObservation {
  return {
    period: row.period,
    value: row.value === null ? null : Number(row.value),
    status: String(row.payload.status ?? 'OBSERVED'),
    publishedAt: typeof row.payload.publishedAt === 'string' ? row.payload.publishedAt : null,
    availableAt: iso(row.available_at),
    retrievedAt: iso(row.received_at),
    sourceUrl: row.source_url,
    evidenceSha256: row.evidence_sha256,
  };
}
function snapshotPoints(s: SnapshotSeries): FactorObservation[] {
  return s.points.map((p) => ({
    period: p.period,
    value: p.value === null ? null : Number(p.value),
    status: p.status,
    publishedAt: p.publishedAt,
    availableAt: p.publishedAt ?? p.firstSeenAt,
    retrievedAt: p.retrievedAt,
    sourceUrl: p.sourceUrl,
    evidenceSha256: p.upstreamSha256,
  }));
}
function snapshotSeries(s: SnapshotSeries, asOf: string): FactorSeries {
  const { points, licenseStatus, ...metadata } = s;
  void points;
  void licenseStatus;
  const latest = selectKnownPoints(snapshotPoints(s), asOf).at(-1);
  return {
    ...metadata,
    origin: 'FACTOR',
    latestPeriod: latest?.period ?? null,
    latestValue: latest?.value ?? null,
    availableAt: latest?.availableAt ?? null,
  };
}
function legacySnapshotSeries(s: (typeof legacyArchived)[number], asOf: string): FactorSeries {
  const latest = selectKnownPoints(s.points, asOf).at(-1);
  return {
    ...s.series,
    latestPeriod: latest?.period ?? null,
    latestValue: latest?.value ?? null,
    availableAt: latest?.availableAt ?? null,
  };
}
const SNAPSHOT_NOTICE =
  'Lectura de la copia de datos incluida en esta versión. Su cobertura y fechas de adquisición se muestran por serie; puede contener menos revisiones que la base.';

async function buildIndex(): Promise<FactorSeriesResponse> {
  const now = new Date().toISOString();
  const results = await Promise.allSettled(
    [false, true].map(async (legacy) => {
      const result = await pool().query<VersionRow>(
        `SELECT DISTINCT ON (code) ${fields(legacy)} FROM ${view(legacy)} WHERE available_at <= $1::timestamptz ORDER BY code,period DESC,available_at DESC,received_at DESC,revision_id DESC`,
        [now],
      );
      return result.rows.map((row) => seriesOf(row, legacy));
    }),
  );
  const series: FactorSeries[] = [];
  const warnings: string[] = [];
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') series.push(...result.value);
    else {
      if (!supportsSnapshotFallback(result.reason)) throw result.reason;
      console.warn(
        `[observatorio] índice de factores ${i === 0 ? 'nuevos' : 'precios'} no disponible`,
      );
      warnings.push(SNAPSHOT_NOTICE);
      if (i === 0)
        series.push(
          ...archived.map((s) => snapshotSeries(s, now)).filter((s) => s.latestPeriod !== null),
        );
      else
        series.push(
          ...legacyArchived
            .map((s) => legacySnapshotSeries(s, now))
            .filter((s) => s.latestPeriod !== null),
        );
    }
  }
  // Una base accesible controla publicación y retiros: jamás rellenar sus ausencias con snapshots.
  return { series, warnings: [...new Set(warnings)] };
}
export const readFactorIndex = (): Promise<FactorSeriesResponse> =>
  held('exogenous-factor-index-v1', buildIndex);

export async function readFactorCatalogue(
  params: URLSearchParams,
): Promise<FactorCatalogueResponse> {
  const query = catalogueQuery(params);
  const index = await readFactorIndex();
  const counts = new Map<string, number>();
  for (const s of index.series)
    for (const id of new Set(s.familyIds)) counts.set(id, (counts.get(id) ?? 0) + 1);
  const families = (catalogue.families as FactorFamily[]).map((f) => ({
    ...f,
    seriesCount: counts.get(f.id) ?? 0,
  }));
  const selected = filterFamilies(families, query);
  return {
    families: selected.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
    total: selected.length,
    page: query.page,
    pageSize: query.pageSize,
    sectors: catalogue.sectors,
    mechanisms: [...new Set(families.flatMap((f) => f.mechanisms))].sort(),
    coverage: {
      families: families.length,
      linkedFamilies: families.filter((f) => f.seriesCount > 0).length,
      series: index.series.length,
    },
    warnings: index.warnings,
  };
}
export async function readFactorSeries(params: URLSearchParams): Promise<FactorSeriesResponse> {
  const family = params.get('family') ?? '';
  const sector = params.get('sector') ?? '';
  const index = await readFactorIndex();
  return {
    ...index,
    series: index.series.filter(
      (s) => (!family || s.familyIds.includes(family)) && (!sector || s.sectorIds.includes(sector)),
    ),
  };
}
export async function readFactorHistory(
  query: ReturnType<typeof historyQuery>,
  exportAll = false,
): Promise<FactorHistoryResponse | null> {
  const legacy = query.series.startsWith('EXO_');
  let rows: VersionRow[] = [];
  let fallback = false;
  const warnings: string[] = [];
  try {
    const result = await pool().query<VersionRow>(
      `SELECT DISTINCT ON (period) ${fields(legacy)} FROM ${view(legacy)} WHERE code=$1 AND available_at <= $2::timestamptz AND substring(period,1,4)::integer BETWEEN $3 AND $4 AND period > $5 ORDER BY period,available_at DESC,received_at DESC,revision_id DESC LIMIT $6`,
      [
        query.series,
        query.asOf,
        query.from,
        query.to,
        exportAll ? '' : query.cursor,
        exportAll ? 20001 : query.pageSize + 1,
      ],
    );
    rows = result.rows;
  } catch (error) {
    if (!supportsSnapshotFallback(error)) throw error;
    fallback = true;
  }
  let series: FactorSeries | undefined;
  let points: FactorObservation[] = [];
  if (rows.length) {
    series = factorPageMetadata(
      rows.map((row) => seriesOf(row, legacy)),
      query.pageSize,
      exportAll,
    );
    points = rows.map(observationOf);
  } else if (!legacy && fallback) {
    const stored = archived.find((s) => s.code === query.series);
    if (stored) {
      fallback = true;
      series = snapshotSeries(stored, query.asOf);
      points = selectKnownPoints(snapshotPoints(stored), query.asOf).filter(
        (p) =>
          Number(p.period.slice(0, 4)) >= query.from &&
          Number(p.period.slice(0, 4)) <= query.to &&
          (exportAll || p.period > query.cursor),
      );
    }
  } else if (legacy && fallback) {
    const stored = legacyArchived.find((s) => s.series.code === query.series);
    if (stored) {
      fallback = true;
      series = legacySnapshotSeries(stored, query.asOf);
      points = selectKnownPoints(stored.points, query.asOf).filter(
        (p) =>
          Number(p.period.slice(0, 4)) >= query.from &&
          Number(p.period.slice(0, 4)) <= query.to &&
          (exportAll || p.period > query.cursor),
      );
    }
  }
  if (!series) {
    const index = await readFactorIndex();
    const metadata = index.series.find((s) => s.code === query.series);
    if (!metadata) return null;
    series = { ...metadata, latestPeriod: null, latestValue: null, availableAt: null };
    warnings.push(
      'No hay observaciones conocidas para ese corte y rango. No se reconstruyen fechas de publicación desconocidas.',
    );
  }
  if (fallback) warnings.push(SNAPSHOT_NOTICE);
  if (legacy)
    warnings.push(
      'La disponibilidad histórica usa la recepción documentada por el observatorio; la fecha original de publicación puede ser desconocida.',
    );
  if (exportAll && points.length > 20000) throw new Error('EXPORT_LIMIT');
  const hasMore = !exportAll && points.length > query.pageSize;
  if (hasMore) points = points.slice(0, query.pageSize);
  const last = points.at(-1);
  series = {
    ...series,
    latestPeriod: last?.period ?? null,
    latestValue: last?.value ?? null,
    availableAt: last?.availableAt ?? null,
  };
  return {
    series,
    points,
    asOf: query.asOf,
    nextCursor: hasMore ? (last?.period ?? null) : null,
    warnings,
  };
}

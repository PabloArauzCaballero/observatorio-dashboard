import type { FareBand, FleetPoint, GnvPoint, RoadTransportData } from './transport';

interface SeedSource {
  key: string;
  publisher: string;
  title: string;
  url: string;
  sha256: string;
}

export interface RoadTransportSeed {
  sources: SeedSource[];
  fleetPoints: Array<
    Omit<FleetPoint, 'publisher' | 'sourceTitle' | 'sourceUrl' | 'evidenceSha256'>
  >;
  gnvPoints: Array<Omit<GnvPoint, 'publisher' | 'sourceTitle' | 'sourceUrl' | 'evidenceSha256'>>;
  fareBands: Array<Omit<FareBand, 'publisher' | 'sourceTitle' | 'sourceUrl' | 'evidenceSha256'>>;
}

const sourceIndex = (sources: SeedSource[]) => new Map(sources.map((source) => [source.key, source]));

function provenance(sources: Map<string, SeedSource>, sourceKey: string) {
  const source = sources.get(sourceKey);
  if (!source) throw new Error(`Fuente ausente en respaldo de transporte: ${sourceKey}`);
  return {
    sourceKey,
    publisher: source.publisher,
    sourceTitle: source.title,
    sourceUrl: source.url,
    evidenceSha256: source.sha256,
  };
}

/** Projects the versioned core seed into the exact contract returned by PostgreSQL. */
export function roadTransportFromSeed(seed: RoadTransportSeed): RoadTransportData {
  const sources = sourceIndex(seed.sources);
  return {
    fleet: seed.fleetPoints.map((point) => ({
      ...point,
      ...provenance(sources, point.sourceKey),
    })),
    gnv: seed.gnvPoints.map((point) => ({
      ...point,
      ...provenance(sources, point.sourceKey),
    })),
    fares: seed.fareBands.map((point) => ({
      ...point,
      ...provenance(sources, point.sourceKey),
    })),
  };
}

/** Keep live database rows and fill only categories that provisioning has not loaded yet. */
export function fillRoadTransportGaps(
  database: RoadTransportData,
  fallback: RoadTransportData,
): RoadTransportData {
  return {
    fleet: database.fleet.length > 0 ? database.fleet : fallback.fleet,
    gnv: database.gnv.length > 0 ? database.gnv : fallback.gnv,
    fares: database.fares.length > 0 ? database.fares : fallback.fares,
  };
}

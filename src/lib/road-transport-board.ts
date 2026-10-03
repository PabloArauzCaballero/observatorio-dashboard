import type { FareBand, FleetPoint, GnvPoint, RoadTransportData } from './transport';

export interface RoadTransportSummary {
  firstYear: string | null;
  latestYear: string | null;
  firstFleet: number | null;
  latestFleet: number | null;
  growthPercent: number | null;
  publicFleet: number | null;
  publicPassengerFleet: number | null;
  gnvConversions: number | null;
  gnvRequalifications: number | null;
}

export interface RoadTransportBoard extends RoadTransportData {
  summary: RoadTransportSummary;
  sources: Array<
    Pick<FleetPoint, 'sourceKey' | 'publisher' | 'sourceTitle' | 'sourceUrl' | 'evidenceSha256'>
  >;
}

const annualNationalFleet = (fleet: FleetPoint[]) =>
  fleet
    .filter(
      (point) =>
        point.dimension === 'DEPARTMENT_SERVICE' &&
        point.department === 'BOLIVIA' &&
        point.service === 'TOTAL',
    )
    .sort((left, right) => left.period.localeCompare(right.period));

const valueAt = (
  points: GnvPoint[],
  metric: GnvPoint['metric'],
  period: string | null,
): number | null =>
  points.find(
    (point) =>
      point.metric === metric &&
      point.dimension === 'DEPARTMENT_CLASS' &&
      point.department === 'BOLIVIA' &&
      (point.vehicleClass === 'TOTAL' || point.vehicleClass === null) &&
      point.period === period,
  )?.value ?? null;

export function buildRoadTransportBoard(data: RoadTransportData): RoadTransportBoard {
  const national = annualNationalFleet(data.fleet);
  const first = national[0] ?? null;
  const latest = national.at(-1) ?? null;
  const latestYear = latest?.period ?? null;
  const serviceClass = data.fleet.filter(
    (point) => point.dimension === 'SERVICE_CLASS' && point.period === latestYear,
  );
  const publicFleet =
    serviceClass.find((point) => point.service === 'PUBLICO' && point.vehicleClass === 'TOTAL')
      ?.value ?? null;
  const publicPassengerFleet = ['BUS', 'MICROBUS', 'MINIBUS'].reduce(
    (sum, vehicleClass) =>
      sum +
      (serviceClass.find(
        (point) => point.service === 'PUBLICO' && point.vehicleClass === vehicleClass,
      )?.value ?? 0),
    0,
  );
  const latestGnvYear =
    data.gnv
      .filter(
        (point) =>
          point.dimension === 'DEPARTMENT_CLASS' &&
          point.department === 'BOLIVIA' &&
          (point.vehicleClass === 'TOTAL' || point.vehicleClass === null) &&
          point.period.length === 4,
      )
      .map((point) => point.period)
      .sort()
      .at(-1) ?? null;
  const sourceMap = new Map<string, RoadTransportBoard['sources'][number]>();
  for (const point of [...data.fleet, ...data.gnv, ...data.fares] as Array<
    FleetPoint | GnvPoint | FareBand
  >) {
    sourceMap.set(point.sourceKey, point);
  }
  return {
    ...data,
    summary: {
      firstYear: first?.period ?? null,
      latestYear,
      firstFleet: first?.value ?? null,
      latestFleet: latest?.value ?? null,
      growthPercent: first && latest ? (latest.value / first.value - 1) * 100 : null,
      publicFleet,
      publicPassengerFleet: latestYear ? publicPassengerFleet : null,
      gnvConversions: valueAt(data.gnv, 'CONVERSION', latestGnvYear),
      gnvRequalifications: valueAt(data.gnv, 'CYLINDER_REQUALIFICATION', latestGnvYear),
    },
    sources: [...sourceMap.values()].map(
      ({ sourceKey, publisher, sourceTitle, sourceUrl, evidenceSha256 }) => ({
        sourceKey,
        publisher,
        sourceTitle,
        sourceUrl,
        evidenceSha256,
      }),
    ),
  };
}

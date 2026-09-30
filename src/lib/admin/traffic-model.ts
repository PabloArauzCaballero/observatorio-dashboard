import type { TrafficReport } from '@/lib/admin/contracts';

/**
 * Lo que el panel de tráfico calcula con los baldes que devuelve el núcleo.
 *
 * Vive aparte de la pantalla porque lo usan dos (el Resumen y Tráfico) y porque
 * no toca nada del servidor: los baldes llegan ya cortados en La Paz y aquí solo
 * se suman. No hay una cifra de «visitantes» en ningún sitio: el núcleo estima
 * sesiones por balde y fila, y sumarlas es una aproximación que la pantalla
 * rotula como tal.
 */
export type TrafficBucket = TrafficReport['buckets'][number];

export const KIND_LABEL: Record<string, string> = {
  PAGE_VIEW: 'Vista',
  DOWNLOAD_INTENT: 'Intención de descarga',
};

export const DEVICE_LABEL: Record<string, string> = {
  DESKTOP: 'Escritorio',
  MOBILE: 'Móvil',
  TABLET: 'Tableta',
  UNKNOWN: 'Sin clasificar',
};

export const REFERRER_LABEL: Record<string, string> = {
  DIRECT: 'Directo',
  SEARCH: 'Buscador',
  SOCIAL: 'Redes sociales',
  EXTERNAL: 'Otro sitio',
  UNKNOWN: 'Sin clasificar',
};

export interface Filters {
  readonly device: string;
  readonly referrer: string;
  readonly route: string;
}

export const NO_FILTERS: Filters = { device: '', referrer: '', route: '' };

export function matches(bucket: TrafficBucket, filters: Partial<Filters>): boolean {
  return (
    (!filters.device || bucket.device === filters.device) &&
    (!filters.referrer || bucket.referrer === filters.referrer) &&
    (!filters.route || bucket.route === filters.route)
  );
}

/** Suma por instante de balde, en orden cronológico. */
export function byBucket(
  buckets: readonly TrafficBucket[],
  kind: string,
): Array<{ x: string; y: number }> {
  const totals = new Map<string, number>();
  for (const bucket of buckets) {
    if (bucket.kind !== kind) continue;
    totals.set(bucket.bucket, (totals.get(bucket.bucket) ?? 0) + bucket.views);
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([x, y]) => ({ x, y }));
}

export function sum(buckets: readonly TrafficBucket[], kind: string): number {
  return buckets.reduce(
    (total, bucket) => (bucket.kind === kind ? total + bucket.views : total),
    0,
  );
}

/** Vistas agrupadas por una dimensión, de mayor a menor. */
export function group(
  buckets: readonly TrafficBucket[],
  kind: string,
  pick: (bucket: TrafficBucket) => string,
): Array<{ key: string; views: number; sessions: number }> {
  const totals = new Map<string, { views: number; sessions: number }>();
  for (const bucket of buckets) {
    if (bucket.kind !== kind) continue;
    const key = pick(bucket);
    const entry = totals.get(key) ?? { views: 0, sessions: 0 };
    entry.views += bucket.views;
    entry.sessions += bucket.estimatedSessions;
    totals.set(key, entry);
  }
  return [...totals.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.views - a.views);
}

import type { FactorHistoryResponse, FactorObservation, FactorSeries } from './exogenous-factor-types';

/** Tope de observaciones por serie; por encima de esto la consulta pide reducir el período. */
export const MAX_FACTOR_POINTS = 20_000;
const PAGE_SIZE = 500;

export class FactorFetchError extends Error {}

export interface CompleteFactorHistory {
  series: FactorSeries;
  points: FactorObservation[];
  warnings: string[];
}
export interface FactorHistoryRange {
  from: string;
  to: string;
  /** Instante de conocimiento (ISO). Sin él, el de la consulta. */
  asOf?: string;
}

/**
 * Todas las páginas de una serie, nunca una parcial: o llega completa o falla con un motivo.
 * La misma fecha de conocimiento fija todas las páginas.
 */
export async function fetchCompleteHistory(
  code: string,
  range: FactorHistoryRange,
  signal: AbortSignal,
  progress?: (count: number) => void,
): Promise<CompleteFactorHistory> {
  const params = new URLSearchParams({
    series: code,
    from: range.from,
    to: range.to,
    pageSize: String(PAGE_SIZE),
  });
  if (range.asOf) params.set('asOf', range.asOf);
  const points = new Map<string, FactorObservation>();
  const warnings = new Set<string>();
  const cursors = new Set<string>();
  let metadata: FactorSeries | null = null;
  for (let page = 0; page < MAX_FACTOR_POINTS / PAGE_SIZE; page += 1) {
    const response = await fetch(`/api/exogenas/factores?${params}`, { signal });
    if (!response.ok) {
      throw new FactorFetchError('No se pudo completar una de las series. Reintenta la consulta.');
    }
    const body = (await response.json()) as FactorHistoryResponse;
    if (signal.aborted) throw new DOMException('Consulta cancelada', 'AbortError');
    if (
      metadata &&
      (metadata.unit !== body.series.unit ||
        metadata.frequency !== body.series.frequency ||
        metadata.measureType !== body.series.measureType ||
        metadata.geography !== body.series.geography ||
        metadata.observationStatus !== body.series.observationStatus ||
        metadata.measurementStatus !== body.series.measurementStatus ||
        metadata.transformationType !== body.series.transformationType)
    ) {
      throw new FactorFetchError(
        'La definición de una serie cambió entre páginas. Reintenta para obtener una lectura consistente.',
      );
    }
    metadata = body.series;
    for (const point of body.points) {
      if (points.has(point.period)) {
        throw new FactorFetchError(
          'El histórico repite un período entre páginas. Reintenta para obtener una sola revisión por período.',
        );
      }
      points.set(point.period, point);
    }
    body.warnings.forEach((warning) => warnings.add(warning));
    progress?.(points.size);
    if (!body.nextCursor) {
      return {
        series: metadata,
        points: [...points.values()].sort((a, b) => a.period.localeCompare(b.period)),
        warnings: [...warnings],
      };
    }
    if (cursors.has(body.nextCursor)) {
      throw new FactorFetchError(
        'No se pudo completar la paginación. No se presentan datos parciales.',
      );
    }
    cursors.add(body.nextCursor);
    params.set('cursor', body.nextCursor);
  }
  throw new FactorFetchError(
    `La consulta supera el límite de ${MAX_FACTOR_POINTS.toLocaleString('es-BO')} observaciones por serie. Reduce el período.`,
  );
}

/** Corre las tareas con un máximo de `limit` a la vez; el resultado conserva el orden de entrada. */
export async function runLimited<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]!, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

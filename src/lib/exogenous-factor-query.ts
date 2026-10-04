import type { FactorFamily, FactorObservation, FactorSeries } from './exogenous-factor-types';

export class FactorQueryError extends Error {}
export class FactorHistoryCompatibilityError extends Error {}

/** A permission denial or malformed query must never expose a bundled snapshot instead. */
export function supportsSnapshotFallback(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return (
    !!code &&
    [
      '42P01',
      'ECONNREFUSED',
      'ECONNRESET',
      'ENOTFOUND',
      'EAI_AGAIN',
      'ETIMEDOUT',
      '57P01',
      '57P02',
      '57P03',
      '08001',
      '08006',
    ].includes(code)
  );
}

/** Inspect the boundary row for breaks, but use metadata only from a delivered row. */
export function factorPageMetadata(
  series: FactorSeries[],
  pageSize: number,
  exportAll = false,
): FactorSeries | undefined {
  const first = series[0];
  if (!first) return undefined;
  const dimensions = ['unit', 'frequency', 'measureType', 'geography'] as const;
  if (series.some((entry) => dimensions.some((key) => entry[key] !== first[key]))) {
    throw new FactorHistoryCompatibilityError(
      'El histórico contiene cambios de unidad, frecuencia, tipo de medida o geografía. Reduce el rango para consultar un tramo compatible; no se mezclaron las observaciones.',
    );
  }
  return series[exportAll ? series.length - 1 : Math.min(pageSize, series.length) - 1];
}

export const normalizeFactorText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');

function integer(input: string | null, fallback: number, min: number, max: number): number {
  if (input === null) return fallback;
  if (!/^\d+$/.test(input))
    throw new FactorQueryError('El número de página o tamaño no es válido.');
  const n = Number(input);
  if (n < min || n > max) throw new FactorQueryError(`El valor debe estar entre ${min} y ${max}.`);
  return n;
}
export function catalogueQuery(params: URLSearchParams) {
  const query = {
    q: params.get('q')?.trim() ?? '',
    sector: params.get('sector') ?? '',
    mechanism: params.get('mechanism') ?? '',
    priority: params.get('priority') ?? '',
    role: params.get('role') ?? '',
    availability: params.get('availability') ?? '',
    page: integer(params.get('page'), 1, 1, 10000),
    pageSize: integer(params.get('pageSize'), 24, 1, 100),
  };
  if (query.q.length > 200 || (query.sector && !/^[A-U]$/.test(query.sector)))
    throw new FactorQueryError('Búsqueda o sector no válido.');
  if (query.priority && !['P0', 'P1', 'P2'].includes(query.priority))
    throw new FactorQueryError('Prioridad no válida.');
  if (query.availability && !['available', 'research'].includes(query.availability))
    throw new FactorQueryError('Disponibilidad no válida.');
  return query;
}
export function filterFamilies(
  families: FactorFamily[],
  query: ReturnType<typeof catalogueQuery>,
): FactorFamily[] {
  const terms = normalizeFactorText(query.q).split(/\s+/).filter(Boolean);
  return families.filter(
    (f) =>
      (!query.sector || f.sectorIds.includes(query.sector)) &&
      (!query.mechanism || f.mechanisms.includes(query.mechanism)) &&
      (!query.priority || f.priority === query.priority) &&
      (!query.role || f.role === query.role) &&
      (!query.availability ||
        (query.availability === 'available' ? f.seriesCount > 0 : f.seriesCount === 0)) &&
      terms.every((term) =>
        normalizeFactorText(
          `${f.id} ${f.name} ${f.definition} ${f.sectorLabel} ${f.channel} ${f.geography}`,
        ).includes(term),
      ),
  );
}
export function historyQuery(params: URLSearchParams, now = new Date()) {
  const series = params.get('series') ?? '';
  if (!/^[A-Z][A-Z0-9_]{1,100}$/.test(series))
    throw new FactorQueryError('Identificador de serie no válido.');
  const from = integer(params.get('from'), 1900, 1800, 2200);
  const to = integer(params.get('to'), now.getUTCFullYear(), 1800, 2200);
  if (from > to) throw new FactorQueryError('El año inicial debe ser anterior al final.');
  const requested = params.get('asOf');
  let asOf = now.toISOString();
  if (requested) {
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(requested))
      throw new FactorQueryError('Fecha de corte no válida.');
    const midnight = new Date(`${requested.slice(0, 10)}T00:00:00Z`);
    if (
      !Number.isFinite(midnight.getTime()) ||
      midnight.toISOString().slice(0, 10) !== requested.slice(0, 10)
    )
      throw new FactorQueryError('Fecha de corte no válida.');
    const end = new Date(requested.length === 10 ? `${requested}T23:59:59.999Z` : requested);
    if (!Number.isFinite(end.getTime()) || midnight.getTime() > now.getTime())
      throw new FactorQueryError('El corte no puede estar en el futuro.');
    asOf = new Date(Math.min(end.getTime(), now.getTime())).toISOString();
  }
  const cursor = params.get('cursor') ?? '';
  if (cursor && !/^\d{4}(?:-(?:\d{2}(?:-\d{2})?|Q[1-4]|W\d{2}))?$/.test(cursor))
    throw new FactorQueryError('Cursor no válido.');
  return {
    series,
    from,
    to,
    asOf,
    cursor,
    pageSize: integer(params.get('pageSize'), 500, 1, 2000),
  };
}
export function selectKnownPoints(points: FactorObservation[], asOf: string): FactorObservation[] {
  const selected = new Map<string, FactorObservation>();
  const cutoff = Date.parse(asOf);
  for (const point of points) {
    const at = Date.parse(point.availableAt);
    if (!Number.isFinite(at) || at > cutoff) continue;
    const old = selected.get(point.period);
    if (
      !old ||
      at > Date.parse(old.availableAt) ||
      (at === Date.parse(old.availableAt) &&
        Date.parse(point.retrievedAt) > Date.parse(old.retrievedAt))
    )
      selected.set(point.period, point);
  }
  return [...selected.values()].sort((a, b) => a.period.localeCompare(b.period));
}
/** Protect spreadsheet users without losing decimals, zeros or missing-value meaning. */
export function factorCsv(
  series: FactorSeries,
  points: FactorObservation[],
  asOf: string,
  warnings: string[] = [],
): string {
  const escape = (input: unknown, numeric = false): string => {
    const value = input == null ? '' : String(input);
    const safe = !numeric && /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const fields = [
    'serie',
    'nombre',
    'periodo',
    'valor',
    'unidad',
    'frecuencia',
    'geografia',
    'rol',
    'estado_dato',
    'publicado',
    'disponible',
    'recuperado',
    'corte',
    'fuente',
    'sha256',
    'estado_observacion',
    'medicion',
    'transformacion',
    'objetivo',
    'nota',
    'codigo_fuente',
    'editor',
    'mercado',
    'familias',
    'sectores',
    'advertencias',
  ];
  return (
    '\uFEFF' +
    [
      fields.join(','),
      ...points.map((p) =>
        [
          series.code,
          series.name,
          p.period,
          p.value,
          series.unit,
          series.frequency,
          series.geography,
          series.economicRole,
          p.status,
          p.publishedAt,
          p.availableAt,
          p.retrievedAt,
          asOf,
          p.sourceUrl,
          p.evidenceSha256,
          series.observationStatus,
          series.measurementStatus,
          series.transformationType,
          series.targetScope,
          series.note,
          series.sourceSeriesKey,
          series.publisher,
          series.market,
          series.familyIds?.join('|'),
          series.sectorIds?.join('|'),
          warnings.join(' '),
        ]
          .map((v, i) => escape(v, i === 3))
          .join(','),
      ),
    ].join('\r\n') +
    '\r\n'
  );
}

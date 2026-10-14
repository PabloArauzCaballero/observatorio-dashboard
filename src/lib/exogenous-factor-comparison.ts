import type { FactorObservation, FactorSeries } from './exogenous-factor-types';

export type FactorComparisonMode = 'LEVEL' | 'BASE100' | 'CHANGE';
export interface FactorComparisonInput {
  leftSeries: FactorSeries;
  rightSeries: FactorSeries;
  leftPoints: FactorObservation[];
  rightPoints: FactorObservation[];
  mode: FactorComparisonMode;
}
export interface FactorComparisonResult {
  mode: FactorComparisonMode;
  unit: string;
  basePeriod: string | null;
  leftBaseValue: number | null;
  rightBaseValue: number | null;
  points: Array<{ period: string; left: number | null; right: number | null }>;
  warnings: string[];
  description: string;
  /** Frecuencia en que quedó la comparación: la más gruesa de las dos series. */
  frequency: string;
}
export class FactorComparisonError extends Error {}

const FREQUENCY_RANK: Record<string, number> = {
  DAILY: 0,
  WEEKLY: 1,
  MONTHLY: 2,
  QUARTERLY: 3,
  ANNUAL: 4,
};
const FREQUENCY_LABEL: Record<string, string> = {
  DAILY: 'diaria',
  WEEKLY: 'semanal',
  MONTHLY: 'mensual',
  QUARTERLY: 'trimestral',
  ANNUAL: 'anual',
};
const BUCKET_LABEL: Record<string, string> = {
  WEEKLY: 'semana',
  MONTHLY: 'mes',
  QUARTERLY: 'trimestre',
  ANNUAL: 'año',
};

/** El período de la frecuencia gruesa al que pertenece uno más fino: «2024-03-05» → «2024-03» → «2024». */
export function bucketOfPeriod(period: string, target: string): string | null {
  const year = /^(\d{4})(?:-(\d{2}))?/.exec(period);
  if (!year) return null;
  if (target === 'ANNUAL') return year[1]!;
  if (target === 'MONTHLY') return year[2] ? `${year[1]}-${year[2]}` : null;
  if (target === 'QUARTERLY') {
    if (/^\d{4}-Q[1-4]$/.test(period)) return period;
    return year[2] ? `${year[1]}-Q${Math.ceil(Number(year[2]) / 3)}` : null;
  }
  return null;
}

/**
 * Lleva una serie a una frecuencia más gruesa promediando lo observado dentro de cada
 * período (el promedio mensual de un precio diario, el promedio anual de uno mensual).
 * No inventa valores: un período sin observaciones queda nulo.
 */
function toCoarser(values: Map<string, number | null>, target: string): Map<string, number | null> {
  const sums = new Map<string, { sum: number; count: number }>();
  for (const [period, value] of values) {
    const bucket = bucketOfPeriod(period, target);
    if (bucket === null) {
      throw new FactorComparisonError(
        'No se puede llevar una de las series a la frecuencia de la otra: sus períodos no son compatibles.',
      );
    }
    const slot = sums.get(bucket) ?? { sum: 0, count: 0 };
    if (value !== null) {
      slot.sum += value;
      slot.count += 1;
    }
    sums.set(bucket, slot);
  }
  return new Map([...sums].map(([bucket, { sum, count }]) => [bucket, count ? sum / count : null]));
}

const BASE_TYPES = new Set(['PRICE', 'INDEX', 'STOCK', 'FLOW', 'QUANTITY', 'COUNT', 'DURATION']);
const CHANGE_TYPES = new Set(['RATE', 'PROPORTION']);

function observedValues(points: FactorObservation[]): Map<string, number | null> {
  const values = new Map<string, number | null>();
  for (const point of points) {
    if (values.has(point.period)) {
      throw new FactorComparisonError(
        'Hay más de una revisión para un período. Selecciona una fecha de corte antes de comparar.',
      );
    }
    values.set(
      point.period,
      point.status === 'OBSERVED' && typeof point.value === 'number' && Number.isFinite(point.value)
        ? point.value
        : null,
    );
  }
  return values;
}

/** Inputs already share the caller's range/asOf; no resampling, interpolation or mutation. */
export function compareFactorSeries(input: FactorComparisonInput): FactorComparisonResult {
  const { leftSeries, rightSeries, leftPoints, rightPoints, mode } = input;
  if (!['LEVEL', 'BASE100', 'CHANGE'].includes(mode)) {
    throw new FactorComparisonError('Modo de comparación no válido.');
  }
  const leftRank = FREQUENCY_RANK[leftSeries.frequency];
  const rightRank = FREQUENCY_RANK[rightSeries.frequency];
  if (leftSeries.frequency !== rightSeries.frequency && (leftRank === undefined || rightRank === undefined)) {
    throw new FactorComparisonError('La frecuencia de una de las series no es reconocida.');
  }
  const leftForecast = leftSeries.observationStatus === 'FORECAST';
  const rightForecast = rightSeries.observationStatus === 'FORECAST';
  if (leftForecast !== rightForecast) {
    throw new FactorComparisonError(
      'No se puede mezclar un pronóstico con una serie observada o estimada en esta comparación.',
    );
  }
  if (
    mode === 'LEVEL' &&
    (leftSeries.unit !== rightSeries.unit || leftSeries.measureType !== rightSeries.measureType)
  ) {
    throw new FactorComparisonError(
      'Comparar niveles exige la misma unidad y el mismo tipo de medida.',
    );
  }
  if (
    mode === 'BASE100' &&
    (!BASE_TYPES.has(leftSeries.measureType) || !BASE_TYPES.has(rightSeries.measureType))
  ) {
    throw new FactorComparisonError(
      'La base 100 no está disponible para tasas o proporciones. Usa cambios absolutos con unidades compatibles.',
    );
  }
  if (
    mode === 'BASE100' &&
    [leftSeries, rightSeries].some((series) => series.transformationType === 'ANOMALY')
  ) {
    throw new FactorComparisonError(
      'Las anomalías, como el ONI, se expresan respecto a una referencia y no admiten base 100. Compara niveles cuando las unidades sean compatibles.',
    );
  }
  if (
    mode === 'CHANGE' &&
    (!CHANGE_TYPES.has(leftSeries.measureType) ||
      !CHANGE_TYPES.has(rightSeries.measureType) ||
      leftSeries.unit !== rightSeries.unit)
  ) {
    throw new FactorComparisonError(
      'Los cambios absolutos requieren tasas o proporciones con la misma unidad declarada.',
    );
  }

  let left = observedValues(leftPoints);
  let right = observedValues(rightPoints);
  const warnings = ['Una comparación descriptiva no demuestra causalidad'];
  /* Frecuencias distintas: la más fina se promedia al período de la más gruesa. Nunca se interpola. */
  let frequency = leftSeries.frequency;
  if (leftSeries.frequency !== rightSeries.frequency) {
    const finerIsLeft = leftRank! < rightRank!;
    frequency = finerIsLeft ? rightSeries.frequency : leftSeries.frequency;
    const finer = finerIsLeft ? leftSeries : rightSeries;
    if (finerIsLeft) left = toCoarser(left, frequency);
    else right = toCoarser(right, frequency);
    warnings.push(
      `«${finer.name}» es ${FREQUENCY_LABEL[finer.frequency]} y la otra serie es ${FREQUENCY_LABEL[frequency]}: se promedió por ${BUCKET_LABEL[frequency]} lo observado, sin interpolar. El último período puede promediar solo los datos disponibles.`,
    );
  }
  const periods = [...new Set([...left.keys(), ...right.keys()])].sort((a, b) =>
    a.localeCompare(b),
  );
  if (leftForecast)
    warnings.push(
      'Ambas series son pronósticos; sus valores no representan resultados realizados.',
    );
  let basePeriod: string | null = null;
  let leftBaseValue: number | null = null;
  let rightBaseValue: number | null = null;
  if (mode !== 'LEVEL') {
    basePeriod =
      periods.find((period) => {
        const a = left.get(period);
        const b = right.get(period);
        return a != null && b != null && (mode === 'CHANGE' || (a > 0 && b > 0));
      }) ?? null;
    if (!basePeriod) {
      throw new FactorComparisonError(
        mode === 'BASE100'
          ? 'No hay un período común con dos valores finitos y positivos para fijar la base 100.'
          : 'No hay un período común con dos valores finitos para calcular cambios absolutos.',
      );
    }
    leftBaseValue = left.get(basePeriod)!;
    rightBaseValue = right.get(basePeriod)!;
  }
  const included = basePeriod === null ? periods : periods.filter((period) => period >= basePeriod);
  let nonFiniteTransforms = 0;
  const transform = (value: number | null | undefined, base: number | null): number | null => {
    if (value == null) return null;
    const result =
      mode === 'LEVEL' ? value : mode === 'BASE100' ? (value / base!) * 100 : value - base!;
    if (Number.isFinite(result)) return result;
    nonFiniteTransforms += 1;
    return null;
  };
  const points = included.map((period) => ({
    period,
    left: transform(left.get(period), leftBaseValue),
    right: transform(right.get(period), rightBaseValue),
  }));
  if (points.some((point) => point.left === null || point.right === null)) {
    warnings.push(
      'Los períodos sin una observación válida conservan valores nulos; no se rellenan ni interpolan.',
    );
  }
  if (mode === 'LEVEL' && !points.some((point) => point.left !== null && point.right !== null)) {
    warnings.push('No hay un período con observaciones válidas de ambas series.');
  }
  if (nonFiniteTransforms)
    warnings.push(
      'Algunas transformaciones exceden el rango numérico representable y se muestran como nulas.',
    );
  const range = points.length
    ? `Períodos mostrados: ${points[0]!.period} a ${points.at(-1)!.period}.`
    : 'No hay períodos para mostrar.';
  const shown = (value: number | null) =>
    value === null ? 'sin dato' : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 4 }).format(value);
  const baseline = `Base común real: ${basePeriod}; valores iniciales ${shown(leftBaseValue)} ${leftSeries.unit} y ${shown(rightBaseValue)} ${rightSeries.unit}. Los períodos anteriores a esa base se excluyen.`;
  const description =
    mode === 'LEVEL'
      ? `Niveles originales en ${leftSeries.unit}. ${range}`
      : mode === 'BASE100'
        ? `Ambas series valen 100 en la misma base. ${baseline} ${range}`
        : `Diferencia absoluta respecto a la base común, conservando la unidad declarada (${leftSeries.unit}). ${baseline} ${range}`;
  return {
    mode,
    unit:
      mode === 'BASE100'
        ? 'índice (base común = 100)'
        : mode === 'CHANGE'
          ? `diferencia en ${leftSeries.unit}`
          : leftSeries.unit,
    basePeriod,
    leftBaseValue,
    rightBaseValue,
    points,
    warnings,
    description,
    frequency,
  };
}

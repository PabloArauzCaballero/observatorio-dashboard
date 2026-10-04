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
}
export class FactorComparisonError extends Error {}

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
  if (leftSeries.frequency !== rightSeries.frequency) {
    throw new FactorComparisonError(
      'Las series tienen frecuencias distintas. No se agregan ni interpolan automáticamente.',
    );
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

  const left = observedValues(leftPoints);
  const right = observedValues(rightPoints);
  const periods = [...new Set([...left.keys(), ...right.keys()])].sort((a, b) =>
    a.localeCompare(b),
  );
  const warnings = ['Una comparación descriptiva no demuestra causalidad'];
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
  const baseline = `Base común real: ${basePeriod}; valores iniciales ${leftBaseValue} ${leftSeries.unit} y ${rightBaseValue} ${rightSeries.unit}. Los períodos anteriores a esa base se excluyen.`;
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
  };
}

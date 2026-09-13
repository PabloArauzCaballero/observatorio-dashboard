/**
 * Lo que una serie anual dice de si misma.
 *
 * La tabla de macroeconomia mostraba el ultimo valor, su variacion y cuantos
 * años hay detras. Eso responde «cuanto vale hoy» y nada mas: no dice si ese
 * valor es alto para la serie, si la serie es estable o erratica, ni si el año
 * pasado fue una excepcion. Esas preguntas son descriptiva basica y se
 * contestan con los mismos numeros para los 1.620 indicadores, asi que se
 * calculan aqui una vez y los consumen la tabla, la vista de analisis y el PDF.
 *
 * Todo se calcula sobre la seleccion que el lector tiene en pantalla —el filtro
 * «desde» recorta la serie— porque una media de 1960 a 2024 mostrada junto a un
 * grafico que arranca en 1990 son dos cosas distintas presentadas como una.
 */

export interface Reading {
  period: string;
  value: number;
}

/** Un extremo, con el año en el que ocurrio: el numero solo no sirve. */
export interface Extreme {
  period: string;
  value: number;
}

/**
 * Una observacion que cae fuera de los bigotes de Tukey.
 *
 * Se guarda de que lado cayo y a cuantas desviaciones esta, porque «es atipico»
 * sin magnitud no distingue un año raro de una hiperinflacion.
 */
export interface Outlier {
  period: string;
  value: number;
  side: 'alto' | 'bajo';
  /** Distancia a la media en desviaciones estandar. */
  z: number;
}

export interface MacroStats {
  n: number;

  /* Tendencia central */
  mean: number;
  median: number;
  /** Media recortada al 10 % por cola: la media sin los años excepcionales. */
  trimmedMean: number;
  /** Centro del intervalo mas poblado del histograma. Null si no hay masa. */
  mode: number | null;

  /* Dispersion */
  variance: number;
  sd: number;
  /** Coeficiente de variacion. Null cuando la media roza el cero y no significa nada. */
  cv: number | null;
  range: number;
  q1: number;
  q3: number;
  /** Rango intercuartilico (RIC). */
  iqr: number;
  /** Desviacion absoluta mediana: dispersion que los atipicos no mueven. */
  mad: number;

  /* Forma */
  skewness: number;
  /** Curtosis en exceso: cero es normal, positivo es cola pesada. */
  kurtosis: number;

  /* Extremos y atipicos */
  max: Extreme;
  min: Extreme;
  lowFence: number;
  highFence: number;
  outliers: Outlier[];

  /** La serie en orden cronologico, para el minigrafico. */
  spark: number[];
  firstPeriod: string;
  lastPeriod: string;
}

/** Cuantil interpolado de una muestra ya ordenada. */
export function quantile(sorted: readonly number[], q: number): number {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] ?? 0;
  const high = sorted[upper] ?? low;
  return low + (high - low) * (position - lower);
}

const average = (values: readonly number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

/**
 * Las descriptivas de una serie, en una pasada.
 *
 * La varianza es muestral (n-1) y la asimetria y la curtosis son las formas
 * poblacionales sobre la desviacion muestral: con treinta o sesenta años la
 * diferencia entre las versiones corregidas y las simples es menor que la
 * incertidumbre del propio dato, y las simples son las que un lector puede
 * reproducir en una planilla.
 *
 * Una serie de menos de dos lecturas devuelve ceros en vez de NaN. Un NaN se
 * propaga hasta el eje de un grafico y rompe la vista entera; un cero se lee
 * como lo que es cuando al lado dice «2 observaciones».
 */
export function macroStats(readings: readonly Reading[]): MacroStats {
  const ordered = [...readings].sort((left, right) => left.period.localeCompare(right.period));
  const values = ordered.map((row) => row.value).filter((value) => Number.isFinite(value));
  const n = values.length;

  if (n < 2) {
    return {
      n,
      mean: values[0] ?? 0,
      median: values[0] ?? 0,
      trimmedMean: values[0] ?? 0,
      mode: null,
      variance: 0,
      sd: 0,
      cv: null,
      range: 0,
      q1: values[0] ?? 0,
      q3: values[0] ?? 0,
      iqr: 0,
      mad: 0,
      skewness: 0,
      kurtosis: 0,
      max: { period: ordered[0]?.period ?? '—', value: values[0] ?? 0 },
      min: { period: ordered[0]?.period ?? '—', value: values[0] ?? 0 },
      lowFence: 0,
      highFence: 0,
      outliers: [],
      spark: values,
      firstPeriod: ordered[0]?.period ?? '—',
      lastPeriod: ordered.at(-1)?.period ?? '—',
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = average(values);
  const median = quantile(sorted, 0.5);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;

  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);

  const deviations = values.map((value) => Math.abs(value - median)).sort((a, b) => a - b);
  const mad = quantile(deviations, 0.5);

  // El 10 % de cada cola, redondeado hacia abajo: con menos de diez lecturas no
  // se recorta nada y la media recortada coincide con la media, que es lo
  // honesto —no hay cola que quitar.
  const cut = Math.floor(n * 0.1);
  const trimmedMean = average(cut > 0 ? sorted.slice(cut, n - cut) : sorted);

  const shape = (power: number): number =>
    sd > 0 ? values.reduce((sum, value) => sum + ((value - mean) / sd) ** power, 0) / n : 0;

  let maxAt = 0;
  let minAt = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    if ((ordered[index]?.value ?? 0) > (ordered[maxAt]?.value ?? 0)) maxAt = index;
    if ((ordered[index]?.value ?? 0) < (ordered[minAt]?.value ?? 0)) minAt = index;
  }

  // Bigotes de Tukey. Cuando el RIC es cero —una serie plana con un salto— el
  // 1,5x no separa nada, asi que la valla se abre con la desviacion absoluta
  // mediana y, si esa tambien es cero, no se declara ningun atipico.
  const spread = iqr > 0 ? 1.5 * iqr : mad > 0 ? 3 * mad : 0;
  const lowFence = q1 - spread;
  const highFence = q3 + spread;
  const outliers: Outlier[] = spread
    ? ordered
        .filter((row) => row.value < lowFence || row.value > highFence)
        .map((row) => ({
          period: row.period,
          value: row.value,
          side: row.value > highFence ? ('alto' as const) : ('bajo' as const),
          z: sd > 0 ? (row.value - mean) / sd : 0,
        }))
        .sort((left, right) => Math.abs(right.z) - Math.abs(left.z))
    : [];

  const bins = histogram(values);
  const fullest = bins.reduce<HistoBin | null>(
    (best, bin) => (bin.count > (best?.count ?? -1) ? bin : best),
    null,
  );

  return {
    n,
    mean,
    median,
    trimmedMean,
    mode: fullest && fullest.count > 1 ? fullest.centre : null,
    variance,
    sd,
    // Bajo una media casi nula el coeficiente de variacion tiende a infinito y
    // deja de describir nada. Se prefiere el hueco al numero enorme.
    cv: Math.abs(mean) > 1e-9 ? sd / Math.abs(mean) : null,
    range: (sorted.at(-1) ?? 0) - (sorted[0] ?? 0),
    q1,
    q3,
    iqr,
    mad,
    skewness: shape(3),
    kurtosis: shape(4) - 3,
    max: { period: ordered[maxAt]?.period ?? '—', value: ordered[maxAt]?.value ?? 0 },
    min: { period: ordered[minAt]?.period ?? '—', value: ordered[minAt]?.value ?? 0 },
    lowFence,
    highFence,
    outliers,
    spark: values,
    firstPeriod: ordered[0]?.period ?? '—',
    lastPeriod: ordered.at(-1)?.period ?? '—',
  };
}

export interface HistoBin {
  from: number;
  to: number;
  centre: number;
  count: number;
  /** Etiqueta corta para el eje. */
  label: string;
}

/**
 * El histograma de la serie, con los intervalos que elige Freedman-Diaconis y
 * un tope de dieciocho.
 *
 * Sturges parte de que la muestra es normal, y estas series no lo son: una con
 * un pico inflacionario reparte todo el cuerpo en dos barras y deja diez
 * vacias. Freedman-Diaconis usa el RIC, que el pico no mueve, asi que el cuerpo
 * conserva su detalle. El tope existe porque un histograma de sesenta lecturas
 * en cuarenta intervalos es un peine, no una distribucion.
 */
export function histogram(values: readonly number[], maxBins = 18): HistoBin[] {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length < 2) return [];
  const sorted = [...clean].sort((a, b) => a - b);
  const low = sorted[0] ?? 0;
  const high = sorted.at(-1) ?? 0;
  if (high === low) {
    return [{ from: low, to: high, centre: low, count: clean.length, label: format(low) }];
  }

  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  const width = iqr > 0 ? (2 * iqr) / Math.cbrt(clean.length) : 0;
  const suggested =
    width > 0 ? Math.ceil((high - low) / width) : Math.ceil(Math.sqrt(clean.length));
  const count = Math.max(5, Math.min(maxBins, suggested));
  const step = (high - low) / count;

  const bins: HistoBin[] = Array.from({ length: count }, (_, index) => {
    const from = low + index * step;
    const to = from + step;
    return { from, to, centre: (from + to) / 2, count: 0, label: format((from + to) / 2) };
  });

  for (const value of clean) {
    // El maximo cae justo en el borde superior del ultimo intervalo y sin este
    // tope se iria a un intervalo que no existe.
    const index = Math.min(count - 1, Math.floor((value - low) / step));
    const bin = bins[index];
    if (bin) bin.count += 1;
  }
  return bins;
}

export interface DensityPoint {
  x: number;
  density: number;
}

/**
 * La densidad de la serie por nucleo gaussiano.
 *
 * El histograma depende de donde caen los cortes; la densidad no, y por eso van
 * juntos en el mismo grafico: si la curva marca dos modas y las barras una, la
 * segunda moda estaba partida entre dos intervalos.
 *
 * El ancho de banda es la regla de Silverman con la desviacion robusta —la
 * menor entre la desviacion estandar y el RIC sobre 1,349— para que una sola
 * observacion extrema no aplane la curva de toda la serie.
 */
export function density(values: readonly number[], points = 96): DensityPoint[] {
  const clean = values.filter((value) => Number.isFinite(value));
  const n = clean.length;
  if (n < 3) return [];
  const sorted = [...clean].sort((a, b) => a - b);
  const mean = average(clean);
  const sd = Math.sqrt(clean.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1));
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  const robust = Math.min(sd || Infinity, iqr > 0 ? iqr / 1.349 : Infinity);
  const bandwidth = 0.9 * (Number.isFinite(robust) ? robust : sd) * n ** (-1 / 5);
  if (!(bandwidth > 0)) return [];

  const low = (sorted[0] ?? 0) - 3 * bandwidth;
  const high = (sorted.at(-1) ?? 0) + 3 * bandwidth;
  const step = (high - low) / (points - 1);
  const scale = 1 / (n * bandwidth * Math.sqrt(2 * Math.PI));

  return Array.from({ length: points }, (_, index) => {
    const x = low + index * step;
    let sum = 0;
    for (const value of clean) {
      const u = (x - value) / bandwidth;
      sum += Math.exp(-0.5 * u * u);
    }
    return { x, density: sum * scale };
  });
}

export interface Fit {
  slope: number;
  intercept: number;
  /** Coeficiente de correlacion de Pearson. */
  r: number;
  /** Bondad de ajuste. */
  r2: number;
  n: number;
}

/** El ajuste por minimos cuadrados de y sobre x, con su correlacion. */
export function linearFit(pairs: ReadonlyArray<{ x: number; y: number }>): Fit {
  const clean = pairs.filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y));
  const n = clean.length;
  if (n < 3) return { slope: 0, intercept: 0, r: 0, r2: 0, n };

  const meanX = average(clean.map((pair) => pair.x));
  const meanY = average(clean.map((pair) => pair.y));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const pair of clean) {
    sxy += (pair.x - meanX) * (pair.y - meanY);
    sxx += (pair.x - meanX) ** 2;
    syy += (pair.y - meanY) ** 2;
  }
  if (sxx === 0 || syy === 0) return { slope: 0, intercept: meanY, r: 0, r2: 0, n };

  const slope = sxy / sxx;
  const r = sxy / Math.sqrt(sxx * syy);
  return { slope, intercept: meanY - slope * meanX, r, r2: r * r, n };
}

export interface LagPoint {
  lag: number;
  correlation: number;
}

/**
 * La autocorrelacion de la serie hasta el rezago que la muestra aguante.
 *
 * Responde cuanto arrastra un indicador su propio pasado: una deuda que se
 * acumula mantiene correlaciones altas diez años despues, y una variacion de
 * precios agota la suya al primer o segundo rezago. La banda de significancia
 * es la aproximacion habitual, 1,96 sobre la raiz de n.
 */
export function autocorrelation(values: readonly number[], maxLag = 12): LagPoint[] {
  const clean = values.filter((value) => Number.isFinite(value));
  const n = clean.length;
  if (n < 6) return [];
  const mean = average(clean);
  const denominator = clean.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  if (denominator === 0) return [];

  // Nunca mas alla de un cuarto de la muestra: un rezago calculado sobre cinco
  // pares es ruido con forma de barra.
  const top = Math.max(1, Math.min(maxLag, Math.floor(n / 4)));
  return Array.from({ length: top }, (_, index) => {
    const lag = index + 1;
    let sum = 0;
    for (let at = lag; at < n; at += 1) {
      sum += ((clean[at] ?? 0) - mean) * ((clean[at - lag] ?? 0) - mean);
    }
    return { lag, correlation: sum / denominator };
  });
}

/** La banda fuera de la cual una autocorrelacion deja de ser ruido. */
export const significanceBand = (n: number): number => (n > 0 ? 1.96 / Math.sqrt(n) : 0);

/** Un numero como lo escribe el resto del tablero. */
function format(value: number): string {
  const magnitude = Math.abs(value);
  const decimals = magnitude >= 1000 ? 0 : magnitude >= 10 ? 1 : 2;
  return value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * El clima, el aire, el fuego y el bosque de Bolivia, por departamento.
 *
 * Los datos son los JSON que arma `scripts/clima/collect-climate.mjs` a partir de
 * cinco fuentes abiertas (ERA5, NASA POWER, CAMS, NASA FIRMS y Global Forest
 * Watch) y el índice ONI de la NOAA. Aquí no se descarga nada: se describen las
 * medidas que el lector puede elegir y se calculan, a partir de los meses, los
 * años, las épocas, la normal 1991-2020, las diferencias y las tendencias que
 * dibuja la página.
 *
 * Una «medida» es una variable leída en una fuente: la lluvia en la capital
 * (ERA5) y la lluvia en el departamento entero (NASA POWER) son dos medidas del
 * mismo concepto, y la página deja elegir cuál mirar.
 */

/* ───────────────────────── forma de los datos ───────────────────────── */

export interface SourceNote {
  nombre: string;
  url: string;
  nota?: string;
}

type Monthly = Record<string, Array<number | null>>;

export interface CapitalsFile {
  fuente: SourceNote;
  consultado: string;
  inicio: string;
  fin: string;
  ultimoDia: string;
  lugares: Array<{
    code: string;
    dept: string;
    city: string;
    lat: number;
    lon: number;
    grid: { lat: number; lon: number; elev: number };
  }>;
  series: Record<string, Monthly>;
}

export interface DepartmentsFile {
  fuente: SourceNote;
  limites: { nombre: string; url: string };
  consultado: string;
  inicio: string;
  fin: string;
  celdas: Record<string, number>;
  series: Record<string, Monthly>;
  capitalT: Record<string, Array<number | null>>;
}

export interface AirFile {
  fuente: SourceNote;
  consultado: string;
  inicio: string;
  fin: string;
  series: Record<string, Monthly>;
}

export interface FireForestFile {
  focos: {
    fuente: SourceNote;
    inicio: string;
    fin: string;
    series: Record<string, number[]>;
    fueraDeLimites: number;
  };
  focos2026: {
    fuente: SourceNote;
    semanas: Record<string, Record<string, number[]>>;
    ultimaSemana: number;
    cotejo2025: Record<string, { firms: number; gfw: number }>;
  };
  bosque: {
    fuente: SourceNote;
    anios: number[];
    cobertura2000: Record<string, number>;
    perdida: Record<string, number[]>;
    porFuego: Record<string, number[]>;
    primario: Record<string, number[]>;
    emisiones: Record<string, number[]>;
    causas: Record<string, Record<string, number[]>>;
  };
  consultado: string;
}

export interface OniFile {
  fuente: SourceNote;
  consultado: string;
  inicio: string;
  fin: string;
  valores: Array<number | null>;
}

export interface ClimateBundle {
  capitales: CapitalsFile;
  departamentos: DepartmentsFile;
  aire: AirFile;
  fuegoBosque: FireForestFile;
  oni: OniFile;
}

/* ───────────────────────── lugares ───────────────────────── */

export const DEPARTMENTS: ReadonlyArray<{ code: string; name: string; city: string }> = [
  { code: 'LA_PAZ', name: 'La Paz', city: 'La Paz' },
  { code: 'ORURO', name: 'Oruro', city: 'Oruro' },
  { code: 'POTOSI', name: 'Potosí', city: 'Potosí' },
  { code: 'COCHABAMBA', name: 'Cochabamba', city: 'Cochabamba' },
  { code: 'CHUQUISACA', name: 'Chuquisaca', city: 'Sucre' },
  { code: 'TARIJA', name: 'Tarija', city: 'Tarija' },
  { code: 'SANTA_CRUZ', name: 'Santa Cruz', city: 'Santa Cruz de la Sierra' },
  { code: 'BENI', name: 'Beni', city: 'Trinidad' },
  { code: 'PANDO', name: 'Pando', city: 'Cobija' },
];

export const deptName = (code: string): string =>
  DEPARTMENTS.find((one) => one.code === code)?.name ?? code;
export const cityName = (code: string): string =>
  DEPARTMENTS.find((one) => one.code === code)?.city ?? code;

/* ───────────────────────── fuentes y medidas ───────────────────────── */

export type SourceId = 'era5' | 'power' | 'cams' | 'firms' | 'gfw';

/** Cómo se dice al lector dónde y con qué se mide cada fuente. */
export const SOURCES: Record<SourceId, { label: string; where: string; credit: string }> = {
  era5: {
    label: 'ERA5 · ciudad capital',
    where: 'en la ciudad capital',
    credit: 'Copernicus/ECMWF (reanálisis ERA5), vía Open-Meteo',
  },
  power: {
    label: 'NASA POWER · departamento',
    where: 'en promedio sobre todo el departamento',
    credit: 'NASA POWER (MERRA-2 y CERES)',
  },
  cams: {
    label: 'CAMS · ciudad capital',
    where: 'en la ciudad capital',
    credit: 'Copernicus (Servicio de Vigilancia Atmosférica, CAMS), vía Open-Meteo',
  },
  firms: {
    label: 'NASA FIRMS · departamento',
    where: 'en todo el departamento',
    credit: 'NASA FIRMS (satélites MODIS)',
  },
  gfw: {
    label: 'Global Forest Watch · departamento',
    where: 'en todo el departamento',
    credit: 'Global Forest Watch (Universidad de Maryland y WRI)',
  },
};

export type Family = 'temperatura' | 'agua' | 'extremos' | 'sol' | 'aire' | 'fuego';

export const FAMILIES: ReadonlyArray<{ id: Family; label: string }> = [
  { id: 'temperatura', label: 'Temperatura' },
  { id: 'agua', label: 'Lluvia, humedad y suelo' },
  { id: 'extremos', label: 'Días extremos' },
  { id: 'sol', label: 'Sol y viento' },
  { id: 'aire', label: 'Calidad del aire' },
  { id: 'fuego', label: 'Fuego y bosque' },
];

/**
 * Cómo se juntan los meses de una época o de un año: promedio (temperatura),
 * suma (lluvia, días), el más alto o el más bajo (los extremos del mes).
 */
export type Aggregate = 'mean' | 'sum' | 'max' | 'min';

/**
 * Qué color lleva una diferencia positiva: `warm` la pinta del tono cálido
 * (más calor, más fuego, más humo); `cool` del frío (más lluvia, más helada).
 */
export type Polarity = 'warm' | 'cool';

export interface Variable {
  id: string;
  family: Family;
  label: string;
  /** Qué es, en una línea y sin jerga. */
  what: string;
  agg: Aggregate;
  /** La diferencia con lo normal se dice en unidades (`diff`) o en porcentaje (`pct`). */
  anomaly: 'diff' | 'pct';
  polarity: Polarity;
  /** Solo hay un dato por año (la pérdida de bosque). */
  annualOnly?: boolean;
  measures: ReadonlyArray<{
    source: SourceId;
    key: string;
    unit: string;
    decimals: number;
    scale?: number;
  }>;
}

export const VARIABLES: readonly Variable[] = [
  {
    id: 't',
    family: 'temperatura',
    label: 'Temperatura media',
    what: 'Promedio del aire a 2 metros del suelo, de día y de noche.',
    agg: 'mean',
    anomaly: 'diff',
    polarity: 'warm',
    measures: [
      { source: 'era5', key: 't', unit: '°C', decimals: 1 },
      { source: 'power', key: 't', unit: '°C', decimals: 1 },
    ],
  },
  {
    id: 'tx',
    family: 'temperatura',
    label: 'Máxima diaria (promedio)',
    what: 'La temperatura más alta de cada día, promediada en el mes.',
    agg: 'mean',
    anomaly: 'diff',
    polarity: 'warm',
    measures: [{ source: 'era5', key: 'tx', unit: '°C', decimals: 1 }],
  },
  {
    id: 'tn',
    family: 'temperatura',
    label: 'Mínima diaria (promedio)',
    what: 'La temperatura más baja de cada día —la de la madrugada—, promediada en el mes.',
    agg: 'mean',
    anomaly: 'diff',
    polarity: 'warm',
    measures: [{ source: 'era5', key: 'tn', unit: '°C', decimals: 1 }],
  },
  {
    id: 'txa',
    family: 'temperatura',
    label: 'Máxima absoluta',
    what: 'La temperatura más alta registrada en el periodo (un solo momento, no un promedio).',
    agg: 'max',
    anomaly: 'diff',
    polarity: 'warm',
    measures: [{ source: 'power', key: 'tx', unit: '°C', decimals: 1 }],
  },
  {
    id: 'tna',
    family: 'temperatura',
    label: 'Mínima absoluta',
    what: 'La temperatura más baja registrada en el periodo (la helada más fuerte).',
    agg: 'min',
    anomaly: 'diff',
    polarity: 'warm',
    measures: [{ source: 'power', key: 'tn', unit: '°C', decimals: 1 }],
  },
  {
    id: 'p',
    family: 'agua',
    label: 'Lluvia',
    what: 'Toda el agua que cae (lluvia, granizo o nieve), en milímetros: 1 mm es un litro por metro cuadrado.',
    agg: 'sum',
    anomaly: 'pct',
    polarity: 'cool',
    measures: [
      { source: 'era5', key: 'p', unit: 'mm', decimals: 0 },
      { source: 'power', key: 'p', unit: 'mm', decimals: 0 },
    ],
  },
  {
    id: 'rx',
    family: 'agua',
    label: 'Lluvia máxima en un día',
    what: 'El aguacero más grande del periodo: la lluvia del día más lluvioso.',
    agg: 'max',
    anomaly: 'pct',
    polarity: 'cool',
    measures: [{ source: 'era5', key: 'rx', unit: 'mm', decimals: 1 }],
  },
  {
    id: 'rh',
    family: 'agua',
    label: 'Humedad del aire',
    what: 'Humedad relativa: cuánto vapor de agua lleva el aire frente al máximo que podría llevar.',
    agg: 'mean',
    anomaly: 'diff',
    polarity: 'cool',
    measures: [
      { source: 'era5', key: 'rh', unit: '%', decimals: 0 },
      { source: 'power', key: 'rh', unit: '%', decimals: 0 },
    ],
  },
  {
    id: 'sm',
    family: 'agua',
    label: 'Humedad del suelo',
    what: 'Agua guardada en el primer metro del suelo, la que usan los cultivos y los pastos.',
    agg: 'mean',
    anomaly: 'diff',
    polarity: 'cool',
    measures: [
      { source: 'era5', key: 'sm', unit: '% del volumen', decimals: 1, scale: 100 },
      { source: 'power', key: 'sm', unit: '% de saturación', decimals: 1, scale: 100 },
    ],
  },
  {
    id: 'et0',
    family: 'agua',
    label: 'Evaporación de referencia',
    what: 'El agua que un pasto bien regado devolvería al aire: mide la sed de la atmósfera.',
    agg: 'sum',
    anomaly: 'pct',
    polarity: 'warm',
    measures: [{ source: 'era5', key: 'et0', unit: 'mm', decimals: 0 }],
  },
  {
    id: 'd35',
    family: 'extremos',
    label: 'Días de calor extremo (más de 35 °C)',
    what: 'Días cuya máxima pasó de 35 °C. Solo ocurren en los llanos.',
    agg: 'sum',
    anomaly: 'diff',
    polarity: 'warm',
    measures: [{ source: 'era5', key: 'd35', unit: 'días', decimals: 0 }],
  },
  {
    id: 'd30',
    family: 'extremos',
    label: 'Días calurosos (más de 30 °C)',
    what: 'Días cuya máxima pasó de 30 °C.',
    agg: 'sum',
    anomaly: 'diff',
    polarity: 'warm',
    measures: [{ source: 'era5', key: 'd30', unit: 'días', decimals: 0 }],
  },
  {
    id: 'fr',
    family: 'extremos',
    label: 'Noches de helada',
    what: 'Días en que la temperatura bajó de 0 °C. Frecuentes en el altiplano.',
    agg: 'sum',
    anomaly: 'diff',
    polarity: 'cool',
    measures: [
      { source: 'era5', key: 'fr', unit: 'días', decimals: 0 },
      { source: 'power', key: 'fr', unit: 'días', decimals: 0 },
    ],
  },
  {
    id: 'r20',
    family: 'extremos',
    label: 'Días de lluvia fuerte (20 mm o más)',
    what: 'Días con un aguacero de al menos 20 litros por metro cuadrado.',
    agg: 'sum',
    anomaly: 'diff',
    polarity: 'cool',
    measures: [{ source: 'era5', key: 'r20', unit: 'días', decimals: 0 }],
  },
  {
    id: 'rad',
    family: 'sol',
    label: 'Radiación solar',
    what: 'Energía del sol que llega al suelo en un día promedio.',
    agg: 'mean',
    anomaly: 'diff',
    polarity: 'warm',
    measures: [
      { source: 'era5', key: 'rad', unit: 'MJ/m² por día', decimals: 1 },
      { source: 'power', key: 'rad', unit: 'kWh/m² por día', decimals: 2 },
    ],
  },
  {
    id: 'wx',
    family: 'sol',
    label: 'Viento máximo diario',
    what: 'La racha media más fuerte de cada día a 10 metros de altura, promediada.',
    agg: 'mean',
    anomaly: 'diff',
    polarity: 'warm',
    measures: [{ source: 'era5', key: 'w', unit: 'km/h', decimals: 1 }],
  },
  {
    id: 'w2',
    family: 'sol',
    label: 'Viento medio',
    what: 'Velocidad media del viento a 2 metros del suelo.',
    agg: 'mean',
    anomaly: 'diff',
    polarity: 'warm',
    measures: [{ source: 'power', key: 'w', unit: 'm/s', decimals: 2 }],
  },
  {
    id: 'pm25',
    family: 'aire',
    label: 'Partículas finas (PM2,5)',
    what: 'Polvo y humo tan finos que entran a los pulmones. La Organización Mundial de la Salud (OMS) recomienda no pasar de 5 µg/m³ en el año.',
    agg: 'mean',
    anomaly: 'pct',
    polarity: 'warm',
    measures: [{ source: 'cams', key: 'pm25', unit: 'µg/m³', decimals: 1 }],
  },
  {
    id: 'pm10',
    family: 'aire',
    label: 'Partículas gruesas (PM10)',
    what: 'Polvo y humo de hasta 10 micras. La OMS recomienda no pasar de 15 µg/m³ en el año.',
    agg: 'mean',
    anomaly: 'pct',
    polarity: 'warm',
    measures: [{ source: 'cams', key: 'pm10', unit: 'µg/m³', decimals: 1 }],
  },
  {
    id: 'd15',
    family: 'aire',
    label: 'Días con aire malo (PM2,5 sobre 15 µg/m³)',
    what: 'Días cuyo promedio de partículas finas superó la guía diaria de la OMS (15 µg/m³).',
    agg: 'sum',
    anomaly: 'diff',
    polarity: 'warm',
    measures: [{ source: 'cams', key: 'd15', unit: 'días', decimals: 0 }],
  },
  {
    id: 'co',
    family: 'aire',
    label: 'Monóxido de carbono',
    what: 'Gas que sale de la combustión; sube con el humo de los chaqueos.',
    agg: 'mean',
    anomaly: 'pct',
    polarity: 'warm',
    measures: [{ source: 'cams', key: 'co', unit: 'µg/m³', decimals: 0 }],
  },
  {
    id: 'aod',
    family: 'aire',
    label: 'Bruma de aerosoles',
    what: 'Espesor óptico de aerosoles: cuánto tapan el sol el humo y el polvo (0 es cielo limpio).',
    agg: 'mean',
    anomaly: 'pct',
    polarity: 'warm',
    measures: [{ source: 'cams', key: 'aod', unit: 'índice', decimals: 2 }],
  },
  {
    id: 'focos',
    family: 'fuego',
    label: 'Focos de calor',
    what: 'Fuegos de vegetación que detectan los satélites MODIS: cada foco es un punto caliente de 1 km.',
    agg: 'sum',
    anomaly: 'pct',
    polarity: 'warm',
    measures: [{ source: 'firms', key: 'focos', unit: 'focos', decimals: 0 }],
  },
  {
    id: 'perdida',
    family: 'fuego',
    label: 'Pérdida de cobertura arbórea',
    what: 'Hectáreas donde desapareció la copa de los árboles (por desmonte, incendio u otra causa).',
    agg: 'sum',
    anomaly: 'pct',
    polarity: 'warm',
    annualOnly: true,
    measures: [{ source: 'gfw', key: 'perdida', unit: 'ha', decimals: 0 }],
  },
  {
    id: 'porFuego',
    family: 'fuego',
    label: 'Pérdida de árboles por incendios',
    what: 'La parte de la pérdida de cobertura arbórea causada por el fuego.',
    agg: 'sum',
    anomaly: 'pct',
    polarity: 'warm',
    annualOnly: true,
    measures: [{ source: 'gfw', key: 'porFuego', unit: 'ha', decimals: 0 }],
  },
  {
    id: 'primario',
    family: 'fuego',
    label: 'Pérdida de bosque primario',
    what: 'Pérdida en bosque húmedo maduro, el que no se había talado antes.',
    agg: 'sum',
    anomaly: 'pct',
    polarity: 'warm',
    annualOnly: true,
    measures: [{ source: 'gfw', key: 'primario', unit: 'ha', decimals: 0 }],
  },
  {
    id: 'emisiones',
    family: 'fuego',
    label: 'Emisiones por pérdida de bosque',
    what: 'Gases de efecto invernadero liberados al perder árboles, en millones de toneladas de CO₂ equivalente.',
    agg: 'sum',
    anomaly: 'pct',
    polarity: 'warm',
    annualOnly: true,
    measures: [{ source: 'gfw', key: 'emisiones', unit: 'Mt de CO₂e', decimals: 2 }],
  },
];

export const variableOf = (id: string): Variable =>
  VARIABLES.find((one) => one.id === id) ?? (VARIABLES[0] as Variable);

/* ───────────────────────── épocas ───────────────────────── */

export interface Season {
  id: string;
  label: string;
  /** Meses de la época; un mes negativo es del año anterior (−12 = diciembre previo). */
  months: readonly number[];
}

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
export const MONTH_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sept',
  'oct',
  'nov',
  'dic',
];

export const SEASONS: readonly Season[] = [
  { id: 'anio', label: 'Año completo', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: 'lluvias', label: 'Época de lluvias (dic–mar)', months: [-12, 1, 2, 3] },
  { id: 'seca', label: 'Época seca (may–sept)', months: [5, 6, 7, 8, 9] },
  { id: 'quemas', label: 'Época de quemas (jul–oct)', months: [7, 8, 9, 10] },
  ...MONTH_NAMES.map((name, index) => ({
    id: `m${index + 1}`,
    label: `Solo ${name}`,
    months: [index + 1],
  })),
];

export const seasonOf = (id: string): Season =>
  SEASONS.find((one) => one.id === id) ?? (SEASONS[0] as Season);

/** Cómo se nombra el año de una época: la de lluvias 2026 va de dic-2025 a mar-2026. */
export function seasonYearLabel(season: Season, year: number): string {
  if (season.months.some((month) => month < 0)) return `${year - 1}-${String(year).slice(2)}`;
  return String(year);
}

/* ───────────────────────── series ───────────────────────── */

/** Una serie mensual alineada: el mes de la posición 0 y los valores. */
export interface MonthSeries {
  start: { year: number; month: number };
  values: ReadonlyArray<number | null>;
}

const parseMonth = (key: string): { year: number; month: number } => {
  const [year, month] = key.split('-').map(Number);
  return { year: year ?? 1950, month: month ?? 1 };
};

export function valueAt(series: MonthSeries, year: number, month: number): number | null {
  const index = (year - series.start.year) * 12 + (month - series.start.month);
  if (index < 0 || index >= series.values.length) return null;
  return series.values[index] ?? null;
}

export function lastMonthOf(series: MonthSeries): { year: number; month: number } {
  const total = series.start.month - 1 + series.values.length - 1;
  return { year: series.start.year + Math.floor(total / 12), month: (total % 12) + 1 };
}

export type Measure = Variable['measures'][number];

/** La serie mensual de una medida en un departamento, o `null` si esa fuente no la tiene. */
export function monthSeries(
  bundle: ClimateBundle,
  measure: Measure,
  code: string,
): MonthSeries | null {
  const scale = (values: ReadonlyArray<number | null>) =>
    measure.scale
      ? values.map((value) => (value === null ? null : value * (measure.scale ?? 1)))
      : values;
  switch (measure.source) {
    case 'era5': {
      const values = bundle.capitales.series[code]?.[measure.key];
      return values ? { start: parseMonth(bundle.capitales.inicio), values: scale(values) } : null;
    }
    case 'power': {
      const values = bundle.departamentos.series[code]?.[measure.key];
      return values
        ? { start: parseMonth(bundle.departamentos.inicio), values: scale(values) }
        : null;
    }
    case 'cams': {
      const values = bundle.aire.series[code]?.[measure.key];
      return values ? { start: parseMonth(bundle.aire.inicio), values: scale(values) } : null;
    }
    case 'firms': {
      const values = bundle.fuegoBosque.focos.series[code];
      return values ? { start: parseMonth(bundle.fuegoBosque.focos.inicio), values } : null;
    }
    case 'gfw':
      return null;
  }
}

/** La serie anual de la pérdida de bosque (solo existe por año). */
function forestYears(bundle: ClimateBundle, key: string, code: string): Map<number, number> {
  const forest = bundle.fuegoBosque.bosque;
  const table = (forest as unknown as Record<string, Record<string, number[]> | undefined>)[key];
  const values = table?.[code] ?? [];
  return new Map(forest.anios.map((year, index) => [year, values[index] ?? 0]));
}

function combine(values: readonly number[], agg: Aggregate): number {
  switch (agg) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'max':
      return Math.max(...values);
    case 'min':
      return Math.min(...values);
    default:
      return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

/** El valor de una época en un año, o `null` si falta cualquiera de sus meses. */
export function seasonValue(
  series: MonthSeries,
  season: Season,
  year: number,
  agg: Aggregate,
): number | null {
  const values: number[] = [];
  for (const month of season.months) {
    const value = month < 0 ? valueAt(series, year - 1, -month) : valueAt(series, year, month);
    if (value === null) return null;
    values.push(value);
  }
  return combine(values, agg);
}

/** Año → valor de la época, solo los años completos. */
export function yearly(
  bundle: ClimateBundle,
  variable: Variable,
  measure: Measure,
  code: string,
  season: Season,
): Map<number, number> {
  if (variable.annualOnly) return forestYears(bundle, measure.key, code);
  const series = monthSeries(bundle, measure, code);
  const out = new Map<number, number>();
  if (!series) return out;
  const last = lastMonthOf(series);
  for (let year = series.start.year; year <= last.year; year += 1) {
    const value = seasonValue(series, season, year, variable.agg);
    if (value !== null) out.set(year, value);
  }
  return out;
}

/** El periodo contra el que se compara: 1991-2020 para el clima, 2001-2020 para el fuego. */
export function normalPeriod(measure: Measure): [number, number] | null {
  if (measure.source === 'cams') return null;
  if (measure.source === 'firms' || measure.source === 'gfw') return [2001, 2020];
  return [1991, 2020];
}

/** El promedio de la época en el periodo normal; exige 24 de los 30 años (o 16 de 20). */
export function normalOf(
  years: Map<number, number>,
  period: [number, number] | null,
): number | null {
  if (!period) return null;
  const values: number[] = [];
  for (let year = period[0]; year <= period[1]; year += 1) {
    const value = years.get(year);
    if (value !== undefined) values.push(value);
  }
  const needed = Math.ceil((period[1] - period[0] + 1) * 0.8);
  return values.length >= needed ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function anomalyOf(value: number, normal: number, kind: Variable['anomaly']): number | null {
  if (kind === 'diff') return value - normal;
  if (normal === 0) return null;
  return ((value - normal) / Math.abs(normal)) * 100;
}

/** La pendiente por mínimos cuadrados, en unidades por década. */
export function trendPerDecade(points: ReadonlyArray<[number, number]>): number | null {
  if (points.length < 10) return null;
  const n = points.length;
  const meanX = points.reduce((a, [x]) => a + x, 0) / n;
  const meanY = points.reduce((a, [, y]) => a + y, 0) / n;
  let top = 0;
  let bottom = 0;
  for (const [x, y] of points) {
    top += (x - meanX) * (y - meanY);
    bottom += (x - meanX) ** 2;
  }
  return bottom ? (top / bottom) * 10 : null;
}

/** El normal de cada mes del calendario (1-12) en el periodo de referencia. */
export function monthlyNormals(
  series: MonthSeries,
  period: [number, number],
): Array<number | null> {
  return Array.from({ length: 12 }, (_, index) => {
    const values: number[] = [];
    for (let year = period[0]; year <= period[1]; year += 1) {
      const value = valueAt(series, year, index + 1);
      if (value !== null) values.push(value);
    }
    const needed = Math.ceil((period[1] - period[0] + 1) * 0.8);
    return values.length >= needed ? values.reduce((a, b) => a + b, 0) / values.length : null;
  });
}

/** La primera y la última fecha que cubre una medida, para los selectores de años. */
export function coverage(
  bundle: ClimateBundle,
  variable: Variable,
  measure: Measure,
): [number, number] {
  if (variable.annualOnly) {
    const years = bundle.fuegoBosque.bosque.anios;
    return [years[0] ?? 2001, years.at(-1) ?? 2025];
  }
  const series = monthSeries(bundle, measure, 'LA_PAZ');
  if (!series) return [1950, 2026];
  return [series.start.year, lastMonthOf(series).year];
}

/* ───────────────────────── ONI ───────────────────────── */

export type EnsoPhase = 'nino' | 'nina' | 'neutral';

/** La fase de El Niño de la época de lluvias de un año, por el ONI de dic-ene-feb. */
export function ensoPhase(bundle: ClimateBundle, year: number): EnsoPhase | null {
  const series: MonthSeries = { start: parseMonth(bundle.oni.inicio), values: bundle.oni.valores };
  const value = valueAt(series, year, 1);
  if (value === null) return null;
  return value >= 0.5 ? 'nino' : value <= -0.5 ? 'nina' : 'neutral';
}

export const oniSeries = (bundle: ClimateBundle): MonthSeries => ({
  start: parseMonth(bundle.oni.inicio),
  values: bundle.oni.valores,
});

/* ───────────────────────── formato ───────────────────────── */

export function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Una diferencia con su signo explícito: «+1,2», «−0,4». */
export function signed(value: number, decimals: number): string {
  const text = formatNumber(Math.abs(value), decimals);
  if (Number(text.replace(/\./g, '').replace(',', '.')) === 0) return text;
  return value > 0 ? `+${text}` : `−${text}`;
}

export const monthLabel = (year: number, month: number): string =>
  `${MONTH_SHORT[month - 1] ?? ''}-${year}`;

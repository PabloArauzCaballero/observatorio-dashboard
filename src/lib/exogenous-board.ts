/**
 * El capítulo de variables exógenas: los precios que Bolivia no fija.
 *
 * Tipos, rótulos y las tres cuentas que el lector puede pedir —nivel, índice y
 * variación interanual—, sin nada de servidor, para que el explorador las
 * rehaga en el navegador cada vez que se mueve un filtro.
 */

export type ExogenousGroup =
  | 'ENERGY'
  | 'MINERALS'
  | 'AGRICULTURE'
  | 'LIVESTOCK'
  | 'INDUSTRY'
  | 'CONSTRUCTION'
  | 'FREIGHT';

export type ExogenousScope =
  'WORLD' | 'REGIONAL' | 'US_PRODUCER_INDEX' | 'BOLIVIA_MARKET' | 'BOLIVIA_CUSTOMS';

export type ExogenousPoint = [period: string, value: number];

export interface ExogenousSeries {
  code: string;
  group: ExogenousGroup;
  product: string;
  productLabel: string;
  name: string;
  scope: ExogenousScope;
  market: string;
  unit: string;
  kind: 'PRICE' | 'INDEX';
  frequency: 'MONTHLY' | 'ANNUAL';
  publisher: string;
  note: string;
  sourceUrl: string | null;
  /** `[periodo, valor]`: `2026-08` si es mensual, `2025` si es anual. */
  points: ExogenousPoint[];
}

export interface ExogenousBoard {
  series: ExogenousSeries[];
  latestMonth: string | null;
}

export const GROUPS: ReadonlyArray<{
  key: ExogenousGroup;
  label: string;
  lead: string;
}> = [
  {
    key: 'ENERGY',
    label: 'Energético',
    lead: 'Crudo, gasolina, diésel, gas y GLP: lo que Bolivia vende por gasoducto y lo que compra para mover el país a un precio que fija el Estado.',
  },
  {
    key: 'MINERALS',
    label: 'Minerales',
    lead: 'Oro, plata, zinc, plomo, estaño, acero, litio y bismuto: más de la mitad de lo que Bolivia exporta sale de una mina.',
  },
  {
    key: 'AGRICULTURE',
    label: 'Agro',
    lead: 'Soya, arroz, maíz, azúcar, trigo, papa, quinua, café, cacao, girasol, banano y castaña: el precio mundial y el de los mercados del país.',
  },
  {
    key: 'LIVESTOCK',
    label: 'Ganadería',
    lead: 'Carne de res, pollo, huevos, leche, queso y el alimento de la piscicultura, contra los vecinos que exportan lo mismo.',
  },
  {
    key: 'INDUSTRY',
    label: 'Industria',
    lead: 'Resinas PET, PP y PE, fertilizantes, herbicidas y precursores químicos: los insumos que Bolivia importa para producir.',
  },
  {
    key: 'CONSTRUCTION',
    label: 'Construcción',
    lead: 'Cemento, fierro de construcción, alambre y viguetas pretensadas, hormigón, ladrillo y madera.',
  },
  {
    key: 'FREIGHT',
    label: 'Fletes',
    lead: 'Lo que cuesta mover la carga: el contenedor y el flete aéreo por tonelada, el flete que Bolivia paga en su aduana y las tarifas del transporte pesado entre ciudades.',
  },
];

export const SCOPES: ReadonlyArray<{ key: ExogenousScope; label: string; hint: string }> = [
  { key: 'WORLD', label: 'Mercado mundial', hint: 'Cotización de referencia en dólares.' },
  { key: 'REGIONAL', label: 'Vecinos', hint: 'Argentina y Brasil, en dólares por tonelada.' },
  {
    key: 'US_PRODUCER_INDEX',
    label: 'Índice EE. UU.',
    hint: 'Índice de precios al productor: se mueve como el precio, no es el precio.',
  },
  { key: 'BOLIVIA_MARKET', label: 'Bolivia, mercados', hint: 'Precio en bolivianos por ciudad.' },
  {
    key: 'BOLIVIA_CUSTOMS',
    label: 'Bolivia, aduana',
    hint: 'Valor unitario de lo que Bolivia exportó o importó, anual; o el flete implícito de sus importaciones, mensual.',
  },
];

/**
 * Lo que se pidió y no tiene serie abierta, dicho en su familia.
 *
 * Un capítulo que calla un producto hace creer que el tablero lo olvidó. Aquí
 * cada ausencia dice por qué falta y con qué se la sustituye, que es lo único
 * honesto que se puede hacer con un precio que nadie publica.
 */
export const MISSING: Record<ExogenousGroup, readonly string[]> = {
  ENERGY: [
    'El precio del gas que Bolivia vende a Brasil y Argentina sale de contratos de YPFB que no se publican mes a mes; aquí va el valor unitario anual declarado en aduana.',
    'La gasolina, el diésel y el GLP se venden en Bolivia a un precio fijado por decreto, no de mercado: lo que se muestra es el precio del mundo al que el país los compra.',
  ],
  MINERALS: [
    'El litio y el bismuto no tienen cotización abierta; se muestra el precio al que Bolivia los exportó, anual, según su aduana.',
  ],
  AGRICULTURE: [
    'La castaña amazónica no cotiza en bolsa: se muestra el precio al que salió de Bolivia, anual.',
  ],
  LIVESTOCK: [
    'No hay precio abierto del pescado de cultivo boliviano (pacú, tambaquí); se muestra el de su alimento, la harina de pescado, y el del pescado que el país importa.',
  ],
  INDUSTRY: [
    'Nadie publica gratis el precio mensual del PET o del polipropileno por grado. Se muestran el índice de productor de EE. UU. y el precio por kilo que Bolivia pagó en su aduana.',
    'Los precursores químicos controlados se leen por sus partidas de aduana: ácido sulfúrico, ácido clorhídrico y acetona.',
  ],
  CONSTRUCTION: [
    'No hay cotización abierta de la vigueta pretensada: se muestra el índice de hormigón pretensado de EE. UU. y el alambre de acero que Bolivia importa para fabricarla.',
  ],
  FREIGHT: [
    'El índice de contenedores de Freightos (FBX) trae dos rutas hacia Sudamérica, pero sólo en el sentido de ida desde Europa (a Santos y Buenos Aires, y a San Antonio y el Callao). La vuelta, que es la del exportador boliviano, no se publica abierta, ni tampoco hacia Arica.',
    'La historia abierta de Freightos es de trece semanas: el colector guarda cada semana desde que se instaló y el gráfico crece solo. Los índices de productor de EE. UU. dan la historia larga (desde 2000), pero son índices, no dólares.',
    'El flete implícito de aduana es el cociente entre el valor CIF y el FOB de lo que Bolivia importó, por tonelada. Incluye flete y seguro hasta la frontera, no sólo el tramo marítimo, y mezcla productos: es un valor unitario, no una tarifa.',
    'El flete entre ciudades de Bolivia no tiene serie oficial: el INE publica las toneladas transportadas, no lo que se cobra. Abajo se citan las tarifas que el transporte pesado y la prensa han dado, con su fuente y su fecha.',
  ],
};

/**
 * Lo que se pidió y no tiene ninguna serie: ni cotización, ni mercado del país,
 * ni partida de aduana con precio por kilo.
 *
 * Va en el riel como un producto más, sin datos y con el rótulo «sin fuente
 * disponible», para que la ausencia se lea en el mismo sitio donde se buscaría
 * el precio. Nunca se rellena con una serie parecida.
 */
export const UNSOURCED: Record<ExogenousGroup, ReadonlyArray<{ label: string; why: string }>> = {
  ENERGY: [],
  MINERALS: [],
  AGRICULTURE: [
    {
      label: 'Yuca',
      why: 'Ni la FAO (GIEWS) ni el Banco Mundial publican un precio de la yuca en Bolivia, ni mensual ni anual.',
    },
    {
      label: 'Hoja de coca',
      why: 'No hay serie abierta: sólo el promedio anual del informe de monitoreo de cultivos de Naciones Unidas (UNODC), en PDF, que el observatorio no recoge.',
    },
  ],
  LIVESTOCK: [],
  INDUSTRY: [],
  CONSTRUCTION: [],
  FREIGHT: [],
};

/**
 * El orden del riel: el de la lista con que se pidió la pestaña.
 *
 * La vista entrega las series por código, y por código el carbón abre la
 * energía y el aluminio los minerales. Lo que no está aquí va al final.
 */
export const PRODUCT_ORDER: readonly string[] = [
  'CRUDE',
  'GASOLINE',
  'DIESEL',
  'NATURAL_GAS',
  'LPG',
  'COAL',
  'STEEL',
  'GOLD',
  'SILVER',
  'LEAD',
  'TIN',
  'LITHIUM',
  'ZINC',
  'BISMUTH',
  'COPPER',
  'ALUMINUM',
  'IRON_ORE',
  'SOY',
  'RICE',
  'MAIZE',
  'SUGAR',
  'WHEAT',
  'POTATO',
  'BANANA',
  'COFFEE',
  'COCOA',
  'QUINOA',
  'SORGHUM',
  'SUNFLOWER',
  'BRAZIL_NUT',
  'BEEF',
  'CHICKEN',
  'EGGS',
  'CHEESE',
  'DAIRY',
  'FISH',
  'PORK',
  'RESINS',
  'PRECURSORS',
  'FERTILIZERS',
  'AGROCHEMICALS',
  'CEMENT',
  'JOISTS',
  'REBAR',
  'CONCRETE',
  'BRICK',
  'LUMBER',
  'CONTAINER',
  'AIR_FREIGHT',
  'SEA_FREIGHT',
  'FREIGHT_BO',
  'LOGISTICS',
];

export type Measure = 'LEVEL' | 'INDEX' | 'YOY';

export const yearOf = (period: string): number => Number(period.slice(0, 4));

/** El punto de hace un año: el mismo mes, o el año anterior en una serie anual. */
function yearAgo(period: string): string {
  const year = yearOf(period) - 1;
  return period.length === 4 ? String(year) : `${year}${period.slice(4)}`;
}

/** Retrocede períodos de calendario, aunque falten observaciones entre ellos. */
function periodsAgo(period: string, frequency: ExogenousSeries['frequency'], count: number): string {
  if (frequency === 'ANNUAL') return String(yearOf(period) - count);
  const month = yearOf(period) * 12 + Number(period.slice(5, 7)) - 1 - count;
  return `${Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}`;
}

/**
 * La serie como el lector la pidió, recortada a sus años.
 *
 * El índice toma como base el primer punto visible y no uno fijo: el lector que
 * mueve el «desde» a 2020 quiere ver cuánto subió cada cosa desde 2020, y una
 * base en el año 2000 le obligaría a hacer la cuenta él.
 */
export function measured(
  points: readonly ExogenousPoint[],
  measure: Measure,
  from: number,
  to: number,
): ExogenousPoint[] {
  const inRange = points.filter(([period]) => yearOf(period) >= from && yearOf(period) <= to);
  if (measure === 'LEVEL') return inRange;
  if (measure === 'INDEX') {
    const base = inRange[0]?.[1];
    if (base === undefined || !Number.isFinite(base) || base <= 0) return [];
    return inRange.map(([period, value]) => [period, (value / base) * 100]);
  }
  const all = new Map(points);
  return inRange.flatMap(([period, value]): ExogenousPoint[] => {
    const change = ratio(value, all.get(yearAgo(period)));
    return change === null ? [] : [[period, change]];
  });
}

export interface Summary {
  last: ExogenousPoint | null;
  /** Contra el período calendario anterior; nulo si falta esa observación. */
  change: number | null;
  /** Contra hace un año. */
  yearChange: number | null;
  /** Contra 60 meses o 5 años previos completos; nulo si falta algún período. */
  versusFiveYears: number | null;
}

const ratio = (now: number, before: number | undefined): number | null =>
  before === undefined || before <= 0 || !Number.isFinite(before) || !Number.isFinite(now)
    ? null : (now / before - 1) * 100;

export function summarize(series: ExogenousSeries): Summary {
  const last = series.points.at(-1) ?? null;
  if (!last) return { last, change: null, yearChange: null, versusFiveYears: null };
  const all = new Map(series.points);
  const window = Array.from({ length: series.frequency === 'MONTHLY' ? 60 : 5 }, (_, index) =>
    all.get(periodsAgo(last[0], series.frequency, index + 1)),
  );
  const average = window.every((value): value is number => value !== undefined && Number.isFinite(value))
    ? window.reduce((sum, value) => sum + value, 0) / window.length
    : undefined;
  return {
    last,
    change: ratio(last[1], all.get(periodsAgo(last[0], series.frequency, 1))),
    yearChange: ratio(last[1], all.get(yearAgo(last[0]))),
    versusFiveYears: ratio(last[1], average),
  };
}

export function measureUnit(measure: Measure, unit: string): string {
  if (measure === 'INDEX') return 'índice';
  if (measure === 'YOY') return '%';
  return unit;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function sayPeriod(period: string): string {
  if (period.length === 4) return period;
  return `${MONTHS[Number(period.slice(5, 7)) - 1] ?? period.slice(5, 7)} ${period.slice(0, 4)}`;
}

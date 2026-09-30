import { PLACES } from './departments';
import type { YearValue } from './departments-board';

/**
 * De qué vive cada departamento, y no sólo cuánto produce.
 *
 * Las cuentas regionales contestan el tamaño: Tarija perdió un tercio de su
 * economía desde 2014. No contestan qué perdió, y sin eso la cifra no se puede
 * discutir. El INE abre el producto de cada departamento en once actividades
 * —y diecinueve ramas dentro de cinco de ellas— desde 1988, en tres medidas: el
 * nivel a precios constantes, su variación anual y el reparto a precios
 * corrientes. Eso es lo que este archivo vuelve a abrir.
 *
 * **El cuadro del país abre más que el de un departamento.** Donde el
 * departamental dice «Alimentos», el nacional separa carnes, lácteos,
 * molinería, azúcar y alimenticios diversos. El núcleo archiva las dos cosas
 * tal como se publican, con el mismo identificador de actividad cuando la fila
 * es la misma, y aquí se cierra el círculo: la cifra de Bolivia para un grupo
 * que su cuadro no trae se arma sumando las ramas que lo componen. Es una suma
 * de cifras publicadas, no una estimación, y por eso se hace al dibujar y no al
 * sembrar: un punto del corpus cita la celda de la que salió y una suma no
 * tiene celda que citar.
 *
 * **El crecimiento no se suma.** Sumar dos variaciones no da la variación de la
 * suma, así que el crecimiento de un grupo que el cuadro nacional no publica
 * sale del nivel agregado, año contra año anterior. Va dicho en la figura.
 */

/** En qué plano del cuadro vive una fila; espeja el catálogo del núcleo. */
export type ActivityLevel = 'TOTAL' | 'GROUP' | 'BRANCH' | 'ADJUSTMENT';

export interface Activity {
  slug: string;
  name: string;
  level: ActivityLevel;
  /** El grupo del que cuelga una rama. */
  parent?: string;
}

const group = (slug: string, name: string): Activity => ({ slug, name, level: 'GROUP' });
const branch = (slug: string, name: string, parent: string): Activity => ({
  slug,
  name,
  level: 'BRANCH',
  parent,
});

/**
 * Los once grupos, en el orden del INE.
 *
 * El orden es el del cuaderno —lo que se saca de la tierra, lo que se
 * transforma, lo que se mueve, lo que se administra— y no el del tamaño:
 * ordenar por tamaño es lo que hace la figura, y una lista que ya venía
 * ordenada por tamaño no dejaría ver que el orden es una lectura.
 */
export const ACTIVITY_GROUPS: readonly Activity[] = [
  group('AGRICULTURA', 'Agricultura, silvicultura, caza y pesca'),
  group('MINAS_Y_CANTERAS', 'Extracción de minas y canteras'),
  group('MANUFACTURA', 'Industrias manufactureras'),
  group('ELECTRICIDAD_GAS_Y_AGUA', 'Electricidad, gas y agua'),
  group('CONSTRUCCION', 'Construcción'),
  group('COMERCIO', 'Comercio'),
  group('TRANSPORTE_Y_COMUNICACIONES', 'Transporte, almacenamiento y comunicaciones'),
  group('FINANZAS_Y_EMPRESAS', 'Establecimientos financieros, seguros e inmuebles'),
  group('SERVICIOS_COMUNALES', 'Servicios comunales, sociales, personales y domésticos'),
  group('RESTAURANTES_Y_HOTELES', 'Restaurantes y hoteles'),
  group('ADMINISTRACION_PUBLICA', 'Servicios de la administración pública'),
];

/**
 * Las ramas, las del cuadro departamental y las que sólo trae el nacional.
 *
 * Están juntas a propósito: el tablero pregunta «¿qué es esta actividad y de
 * qué grupo cuelga?» sin saber de qué cuadro vino la fila, y dos listas
 * separadas obligarían a probar en las dos cada vez.
 */
export const ACTIVITY_BRANCHES: readonly Activity[] = [
  branch('AGRICOLA_NO_INDUSTRIAL', 'Productos agrícolas no industriales', 'AGRICULTURA'),
  branch('AGRICOLA_INDUSTRIAL', 'Productos agrícolas industriales', 'AGRICULTURA'),
  branch('COCA', 'Coca', 'AGRICULTURA'),
  branch('PECUARIO', 'Productos pecuarios', 'AGRICULTURA'),
  branch('SILVICULTURA_CAZA_Y_PESCA', 'Silvicultura, caza y pesca', 'AGRICULTURA'),

  branch('PETROLEO_Y_GAS', 'Petróleo crudo y gas natural', 'MINAS_Y_CANTERAS'),
  branch('MINERALES', 'Minerales metálicos y no metálicos', 'MINAS_Y_CANTERAS'),

  branch('ALIMENTOS', 'Alimentos', 'MANUFACTURA'),
  branch('BEBIDAS_Y_TABACO', 'Bebidas y tabaco', 'MANUFACTURA'),
  branch('TEXTILES_Y_CUERO', 'Textiles, prendas de vestir y cuero', 'MANUFACTURA'),
  branch('MADERA', 'Madera y productos de madera', 'MANUFACTURA'),
  branch('REFINACION_DE_PETROLEO', 'Productos de refinación del petróleo', 'MANUFACTURA'),
  branch('MINERALES_NO_METALICOS', 'Productos de minerales no metálicos', 'MANUFACTURA'),
  branch('OTRAS_MANUFACTURAS', 'Otras industrias manufactureras', 'MANUFACTURA'),
  branch('CARNES', 'Carnes frescas y elaboradas', 'MANUFACTURA'),
  branch('LACTEOS', 'Productos lácteos', 'MANUFACTURA'),
  branch('MOLINERIA_Y_PANADERIA', 'Productos de molinería y panadería', 'MANUFACTURA'),
  branch('AZUCAR_Y_CONFITERIA', 'Azúcar y confitería', 'MANUFACTURA'),
  branch('ALIMENTICIOS_DIVERSOS', 'Productos alimenticios diversos', 'MANUFACTURA'),
  branch('BEBIDAS', 'Bebidas', 'MANUFACTURA'),
  branch('TABACO', 'Tabaco elaborado', 'MANUFACTURA'),
  branch('PAPEL', 'Papel y productos de papel', 'MANUFACTURA'),
  branch('QUIMICOS', 'Sustancias y productos químicos', 'MANUFACTURA'),
  branch('METALES_BASICOS', 'Productos básicos de metales', 'MANUFACTURA'),
  branch('METALMECANICA', 'Productos metálicos, maquinaria y equipo', 'MANUFACTURA'),
  branch('MANUFACTURAS_DIVERSAS', 'Productos manufacturados diversos', 'MANUFACTURA'),

  branch(
    'TRANSPORTE_Y_ALMACENAMIENTO',
    'Transporte y almacenamiento',
    'TRANSPORTE_Y_COMUNICACIONES',
  ),
  branch('COMUNICACIONES', 'Comunicaciones', 'TRANSPORTE_Y_COMUNICACIONES'),

  branch('SERVICIOS_FINANCIEROS', 'Servicios financieros', 'FINANZAS_Y_EMPRESAS'),
  branch('SERVICIOS_A_LAS_EMPRESAS', 'Servicios a las empresas', 'FINANZAS_Y_EMPRESAS'),
  branch('PROPIEDAD_DE_VIVIENDA', 'Propiedad de vivienda', 'FINANZAS_Y_EMPRESAS'),

  branch(
    'SERVICIOS_PERSONALES',
    'Servicios comunales, sociales y personales',
    'SERVICIOS_COMUNALES',
  ),
  branch('SERVICIOS_DOMESTICOS', 'Servicios domésticos', 'SERVICIOS_COMUNALES'),
];

/** El total contra el que se reparte, y el ajuste que se resta de él. */
export const BASIC_PRODUCT = 'PIB_BASICO';
export const IMPUTED_BANK_SERVICES = 'SERVICIOS_BANCARIOS_IMPUTADOS';

const TOTALS: readonly Activity[] = [
  { slug: 'PIB_MERCADO', name: 'PIB a precios de mercado', level: 'TOTAL' },
  { slug: 'IMPUESTOS_INDIRECTOS', name: 'Impuestos indirectos', level: 'TOTAL' },
  { slug: BASIC_PRODUCT, name: 'PIB a precios básicos', level: 'TOTAL' },
  { slug: IMPUTED_BANK_SERVICES, name: 'Servicios bancarios imputados', level: 'ADJUSTMENT' },
];

export const ACTIVITIES: readonly Activity[] = [
  ...TOTALS,
  ...ACTIVITY_GROUPS,
  ...ACTIVITY_BRANCHES,
];

const BY_SLUG = new Map(ACTIVITIES.map((one) => [one.slug, one]));

export const activityName = (slug: string): string => BY_SLUG.get(slug)?.name ?? slug;

export const activityOf = (slug: string): Activity | undefined => BY_SLUG.get(slug);

/** Las ramas que componen un grupo, en el orden en que se declararon. */
export const branchesOf = (group: string): readonly Activity[] =>
  ACTIVITY_BRANCHES.filter((one) => one.parent === group);

/** Una de las tres medidas que el INE cruza por actividad. */
export interface ActivityMeasure {
  slug: string;
  label: string;
  unit: string;
  decimals: number;
  what: string;
}

export const ACTIVITY_MEASURES: readonly ActivityMeasure[] = [
  {
    slug: 'SHARE',
    label: 'Peso en la economía',
    unit: '% del producto',
    decimals: 1,
    what: 'Qué parte del producto del lugar aporta la actividad. Dice la estructura: de qué vive, no cuánto produce.',
  },
  {
    slug: 'GROWTH',
    label: 'Crecimiento anual',
    unit: '% anual',
    decimals: 1,
    what: 'La variación anual del producto de la actividad a precios constantes, tal como el INE la publica.',
  },
  {
    slug: 'VALUE',
    label: 'Tamaño real',
    unit: 'miles de Bs de 1990',
    decimals: 0,
    what: 'El producto de la actividad con los precios de 1990 congelados, que es la única forma de comparar un año con otro.',
  },
];

export const activityMeasureOf = (slug: string): ActivityMeasure | undefined =>
  ACTIVITY_MEASURES.find((one) => one.slug === slug);

/** El prefijo con el que el núcleo marca estas series. */
const PREFIX = 'DEPT_ACT_';

const PLACES_BY_LENGTH = [...PLACES].sort((left, right) => right.slug.length - left.slug.length);

export interface ParsedActivityCode {
  measure: string;
  place: string;
  activity: string;
}

/**
 * Qué mide un código, de dónde y de qué actividad, o nada si no es de los
 * nuestros.
 *
 * Se parte por catálogo y no por guiones bajos, por lo mismo que los códigos de
 * las cuentas regionales: `SANTA_CRUZ` lleva uno dentro y
 * `SILVICULTURA_CAZA_Y_PESCA` lleva tres. Lo cerrado es la lista de medidas y
 * la de lugares, y con las dos el corte es único.
 */
export function parseActivityCode(code: string): ParsedActivityCode | null {
  if (!code.startsWith(PREFIX)) return null;
  const rest = code.slice(PREFIX.length);

  const measure = ACTIVITY_MEASURES.find((one) => rest.startsWith(`${one.slug}_`));
  if (!measure) return null;
  const afterMeasure = rest.slice(measure.slug.length + 1);

  const place = PLACES_BY_LENGTH.find((one) => afterMeasure.startsWith(`${one.slug}_`));
  if (!place) return null;
  const activity = afterMeasure.slice(place.slug.length + 1);
  if (!activity.length) return null;

  return { measure: measure.slug, place: place.slug, activity };
}

/** Por medida, por lugar y por actividad, la serie entera ordenada por año. */
export type ActivitySeries = Record<string, Record<string, Record<string, YearValue[]>>>;

const at = (values: readonly YearValue[] | undefined, year: number): number | undefined =>
  values?.find((point) => point.year === year)?.value;

/** Suma varias series año a año; un año entra si alguna de ellas lo publicó. */
function added(parts: ReadonlyArray<readonly YearValue[]>): YearValue[] {
  const byYear = new Map<number, number>();
  for (const part of parts) {
    for (const point of part) byYear.set(point.year, (byYear.get(point.year) ?? 0) + point.value);
  }
  return [...byYear.entries()]
    .map(([year, value]) => ({ year, value }))
    .sort((left, right) => left.year - right.year);
}

/** La variación anual de una serie de niveles, en por ciento. */
function yearOnYear(values: readonly YearValue[]): YearValue[] {
  const out: YearValue[] = [];
  for (const [index, point] of values.entries()) {
    const before = values[index - 1];
    if (!before || before.year !== point.year - 1 || before.value === 0) continue;
    out.push({ year: point.year, value: ((point.value - before.value) / before.value) * 100 });
  }
  return out;
}

/**
 * La serie de una actividad en un lugar, publicada o compuesta.
 *
 * Publicada siempre que exista: es la cifra del INE y no se recalcula. Cuando
 * el cuadro de ese lugar no trae la fila —el nacional no publica «industrias
 * manufactureras», publica sus dieciséis ramas— se compone, y cómo depende de
 * la medida: los niveles y los repartos se suman, porque son cantidades sobre
 * el mismo total; el crecimiento no, porque sumar dos variaciones no da la
 * variación de la suma, así que sale del nivel compuesto año contra año.
 */
export function activityValues(
  series: ActivitySeries,
  measure: string,
  place: string,
  activity: string,
): YearValue[] {
  const published = series[measure]?.[place]?.[activity];
  if (published?.length) return published;

  const parts = branchesOf(activity)
    .map((one) => series[measure === 'GROWTH' ? 'VALUE' : measure]?.[place]?.[one.slug] ?? [])
    .filter((values) => values.length > 0);
  if (!parts.length) return [];

  return measure === 'GROWTH' ? yearOnYear(added(parts)) : added(parts);
}

/** El año más reciente con reparto publicado para un lugar. */
export function latestActivityYear(series: ActivitySeries, place: string): number | null {
  const byActivity = series['SHARE']?.[place] ?? {};
  const years = Object.values(byActivity).map((values) => values.at(-1)?.year ?? 0);
  const newest = Math.max(0, ...years);
  return newest > 0 ? newest : null;
}

export interface ActivitySlice {
  slug: string;
  name: string;
  value: number;
}

/**
 * De qué vive un lugar en un año: los once grupos, sobre cien.
 *
 * **El denominador es la suma de los once y no el producto a precios de
 * mercado.** El cuadro departamental reparte sobre el producto a precios de
 * mercado, así que sus once grupos suman ochenta y pico y el resto son los
 * impuestos indirectos; el cuadro nacional reparte sobre el valor agregado, que
 * ya los excluye. Comparar los dos sin igualar el denominador haría que
 * cualquier departamento pareciera menos industrial que el país por una razón
 * puramente contable. Los servicios bancarios imputados, que la contabilidad
 * resta, se quedan fuera del reparto y se dicen aparte.
 */
export function activityStructure(
  series: ActivitySeries,
  place: string,
  year: number | null,
): ActivitySlice[] {
  if (year === null) return [];
  const slices = ACTIVITY_GROUPS.map((one) => ({
    slug: one.slug,
    name: one.name,
    value: at(activityValues(series, 'SHARE', place, one.slug), year) ?? 0,
  })).filter((slice) => slice.value > 0);

  const whole = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (whole <= 0) return [];
  return slices.map((slice) => ({ ...slice, value: (slice.value / whole) * 100 }));
}

/** Lo que la contabilidad resta del producto, para decirlo bajo el reparto. */
export function imputedBankShare(
  series: ActivitySeries,
  place: string,
  year: number | null,
): number | null {
  if (year === null) return null;
  const basic = at(activityValues(series, 'SHARE', place, BASIC_PRODUCT), year);
  const imputed = at(activityValues(series, 'SHARE', place, IMPUTED_BANK_SERVICES), year);
  if (basic === undefined || imputed === undefined || basic === 0) return null;
  return (imputed / basic) * 100;
}

export interface ActivityMove {
  slug: string;
  name: string;
  /** Crecimiento real acumulado del periodo, en por ciento. */
  change: number;
  from: number;
  to: number;
}

/**
 * Cuánto creció o cayó de verdad cada actividad en una década.
 *
 * Sobre el nivel a precios constantes y no sobre el reparto: el reparto es un
 * juego de suma cero, y una actividad puede ganar peso sin crecer sólo porque
 * otra se hundió. Es exactamente lo que pasó en Tarija, y contarlo con el
 * reparto lo contaría al revés.
 */
export function activityMoves(
  series: ActivitySeries,
  place: string,
  year: number | null,
  span = 10,
): ActivityMove[] {
  if (year === null) return [];
  const from = year - span;
  return ACTIVITY_GROUPS.map((one) => {
    const values = activityValues(series, 'VALUE', place, one.slug);
    const before = at(values, from);
    const now = at(values, year);
    if (before === undefined || now === undefined || before === 0) return null;
    return {
      slug: one.slug,
      name: one.name,
      change: ((now - before) / before) * 100,
      from,
      to: year,
    };
  }).filter((row): row is ActivityMove => row !== null);
}

/** El año más reciente con niveles publicados, que es donde cierra el periodo. */
export function latestValueYear(series: ActivitySeries, place: string): number | null {
  const byActivity = series['VALUE']?.[place] ?? {};
  const years = Object.values(byActivity).map((values) => values.at(-1)?.year ?? 0);
  const newest = Math.max(0, ...years);
  return newest > 0 ? newest : null;
}

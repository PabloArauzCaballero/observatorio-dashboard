/**
 * Cómo se lee el departamento que lleva dentro el código de una serie.
 *
 * La vista anual del observatorio archiva por `indicator_code` y no tiene
 * columna para el sitio, así que el sitio va dentro del código:
 * `DEPT_GDP_SHARE_SANTA_CRUZ`, `DEPT_EXPORTS_USD_POTOSI_CARBONATO_DE_LITIO`.
 * El núcleo lo escribe así y este archivo es quien lo vuelve a abrir.
 *
 * **Se parte por catálogo y no por guiones bajos.** «SANTA_CRUZ» tiene uno
 * dentro y «CARBONATO_DE_LITIO» tiene dos, así que contar separadores da la
 * respuesta equivocada en la mitad de las series. Lo que sí es cerrado es la
 * lista de medidas y la de lugares —seis y trece—, y con las dos el corte es
 * único: se prueba el prefijo de medida más largo que encaje, después el lugar
 * más largo que encaje, y lo que sobre es el producto.
 *
 * **Espeja `department-sources.ts` del núcleo.** Son dos repositorios y por eso
 * son dos copias; la del núcleo manda, porque es la que escribe los códigos. Si
 * las dos se separan, lo que pasa es que una serie nueva cae en «otros» y no
 * que algo se dibuje mal: el analizador devuelve `null` cuando no reconoce un
 * código, y quien lo llama lo descarta en vez de inventarle un sitio.
 */

/** Un departamento, o el país cuando la fila es el total. */
export interface Place {
  slug: string;
  name: string;
  /** `COUNTRY` no se suma con los demás: ya los contiene. */
  level: 'COUNTRY' | 'DEPARTMENT' | 'AGGREGATE';
}

export const PLACES: readonly Place[] = [
  { slug: 'BOLIVIA', name: 'Bolivia', level: 'COUNTRY' },
  { slug: 'CHUQUISACA', name: 'Chuquisaca', level: 'DEPARTMENT' },
  { slug: 'LA_PAZ', name: 'La Paz', level: 'DEPARTMENT' },
  { slug: 'COCHABAMBA', name: 'Cochabamba', level: 'DEPARTMENT' },
  { slug: 'ORURO', name: 'Oruro', level: 'DEPARTMENT' },
  { slug: 'POTOSI', name: 'Potosí', level: 'DEPARTMENT' },
  { slug: 'TARIJA', name: 'Tarija', level: 'DEPARTMENT' },
  { slug: 'SANTA_CRUZ', name: 'Santa Cruz', level: 'DEPARTMENT' },
  { slug: 'BENI', name: 'Beni', level: 'DEPARTMENT' },
  { slug: 'PANDO', name: 'Pando', level: 'DEPARTMENT' },
  /*
   * Los cuatro lugares del cuadro de comercio exterior que no son un
   * departamento. `NATIONAL` es lo que el país vendió de lo suyo y es la fila
   * contra la que se compara la suma de los nueve; `TOTAL` le añade
   * reexportaciones y efectos personales, que es mercancía de origen extranjero
   * cruzando de vuelta. Confundir esos dos es sobreestimar las exportaciones
   * bolivianas en unos cien millones de dólares al año.
   */
  { slug: 'TOTAL', name: 'Total declarado', level: 'AGGREGATE' },
  { slug: 'NATIONAL', name: 'Exportaciones del país', level: 'AGGREGATE' },
  { slug: 'REEXPORTS', name: 'Reexportaciones', level: 'AGGREGATE' },
  { slug: 'PERSONAL_EFFECTS', name: 'Efectos personales', level: 'AGGREGATE' },
];

export const DEPARTMENTS = PLACES.filter((place) => place.level === 'DEPARTMENT');

/** Una de las medidas que el INE cruza por departamento. */
export interface Measure {
  slug: string;
  label: string;
  /** La unidad, para el título de la figura: sin ella el eje es un número suelto. */
  unit: string;
  decimals: number;
  what: string;
}

export const MEASURES: readonly Measure[] = [
  {
    slug: 'GDP_CONSTANT',
    label: 'PIB a precios constantes',
    unit: 'miles de Bs de 1990',
    decimals: 0,
    what: 'El tamaño de la economía departamental con los precios de 1990 congelados, que es la única forma de comparar un año con otro sin que la inflación haga el trabajo.',
  },
  {
    slug: 'GDP_CURRENT',
    label: 'PIB a precios corrientes',
    unit: 'miles de Bs',
    decimals: 0,
    what: 'El mismo producto en los bolivianos de cada año. Sirve para repartos y proporciones, no para medir crecimiento.',
  },
  {
    slug: 'GDP_GROWTH',
    label: 'Crecimiento del PIB',
    unit: '% anual',
    decimals: 2,
    what: 'La variación anual del producto a precios constantes, tal como el INE la publica.',
  },
  {
    slug: 'GDP_SHARE',
    label: 'Participación en el PIB',
    unit: '% del país',
    decimals: 2,
    what: 'Qué parte del producto nacional aporta el departamento. Las nueve suman cien.',
  },
  {
    slug: 'GDP_PER_CAPITA',
    label: 'PIB per cápita',
    unit: 'Bs por habitante',
    decimals: 0,
    what: 'El producto dividido por la gente que vive ahí. Cierra un año antes que las demás porque necesita la proyección de población.',
  },
  {
    slug: 'GDP_DEFLATOR',
    label: 'Deflactor implícito del PIB',
    unit: 'índice, 1990 = 100',
    decimals: 1,
    what: 'Los precios implícitos en el producto departamental. Es el índice que separa el crecimiento real del nominal.',
  },
  {
    slug: 'EXPORTS_USD',
    label: 'Exportaciones',
    unit: 'millones de USD',
    decimals: 1,
    what: 'Valor declarado en aduana de lo que sale del departamento.',
  },
  {
    slug: 'EXPORTS_TONNES',
    label: 'Exportaciones en peso',
    unit: 'toneladas',
    decimals: 0,
    what: 'El peso neto de lo mismo. Separa precio de volumen: un año que vale más puede ser el mismo mineral más caro.',
  },
];

const BY_LENGTH = <T extends { slug: string }>(list: readonly T[]): T[] =>
  [...list].sort((left, right) => right.slug.length - left.slug.length);

/*
 * Se prueban de más largo a más corto, y esa es toda la astucia que hace falta.
 * `GDP_CONSTANT` no puede confundirse con nada, pero `LA_PAZ` sí empieza donde
 * empezaría un hipotético `LA`, y `EXPORTS_USD` es prefijo de nada mientras que
 * `TOTAL` sí es prefijo del comienzo de otras palabras. Probar el más largo
 * primero convierte un problema de ambigüedad en ninguno.
 */
const MEASURES_BY_LENGTH = BY_LENGTH(MEASURES);
const PLACES_BY_LENGTH = BY_LENGTH(PLACES);

export interface ParsedCode {
  measure: Measure;
  place: Place;
  /** El producto, cuando la serie es una línea de un departamento. */
  product: string | null;
}

/** El prefijo con el que el núcleo marca todas estas series. */
export const DEPARTMENT_PREFIX = 'DEPT_';

/**
 * Qué mide un código y de dónde habla, o nada si no es de los nuestros.
 *
 * Devolver `null` y no lanzar: el tablero se despliega desde un repositorio
 * distinto del que siembra, así que puede encontrarse con un código de una
 * medida que todavía no conoce. Una serie que no se reconoce se queda fuera del
 * capítulo; una excepción se llevaría el capítulo entero por una serie.
 */
export function parseDepartmentCode(code: string): ParsedCode | null {
  if (!code.startsWith(DEPARTMENT_PREFIX)) return null;
  const rest = code.slice(DEPARTMENT_PREFIX.length);

  const measure = MEASURES_BY_LENGTH.find(
    (one) => rest === one.slug || rest.startsWith(`${one.slug}_`),
  );
  if (!measure) return null;
  const afterMeasure = rest.slice(measure.slug.length).replace(/^_/u, '');

  const place = PLACES_BY_LENGTH.find(
    (one) => afterMeasure === one.slug || afterMeasure.startsWith(`${one.slug}_`),
  );
  if (!place) return null;
  const product = afterMeasure.slice(place.slug.length).replace(/^_/u, '');

  return { measure, place, product: product.length ? product : null };
}

/**
 * El nombre del producto, tomado del rótulo que el INE le puso.
 *
 * El núcleo escribe `indicator_name` como «Carbonato de Litio exportado desde
 * Potosí», y esa mitad de la izquierda es el nombre del INE con sus tildes y
 * sus mayúsculas. Reconstruirlo del código daría «CARBONATO DE LITIO», que es
 * el mismo producto gritado.
 */
export function productLabel(indicatorName: string | null, slug: string): string {
  const cut = indicatorName?.split(' exportado desde ')[0]?.trim();
  if (cut && cut.length > 1) return cut;
  return slug
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLocaleLowerCase('es'))
    .join(' ');
}

export const placeName = (slug: string): string =>
  PLACES.find((place) => place.slug === slug)?.name ?? slug;

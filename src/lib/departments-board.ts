import { activityMoves, activityStructure, parseActivityCode } from './department-activities';
import type { ActivitySeries } from './department-activities';
import { DEPARTMENTS, parseDepartmentCode, productLabel, placeName } from './departments';
import type { FxConclusion } from './fx-snapshot';
import type { MacroPoint } from './series';

/**
 * Bolivia dejada de ser una sola cifra.
 *
 * Todas las series anuales del observatorio —el producto, las exportaciones,
 * las rentas del subsuelo— son un número al año para nueve departamentos a la
 * vez. Con eso no se puede contestar la pregunta que cualquiera hace primero,
 * que es dónde, y peor: la agregación esconde justo lo que hay que ver. Tarija
 * perdió más de un tercio de su producto desde 2014 mientras La Paz ganaba la
 * mitad del suyo, y en la cifra nacional esas dos mitades se cancelan hasta
 * parecer una economía quieta.
 *
 * El capítulo se arma con tres corpus del INE que el núcleo recoge: las cuentas
 * regionales —seis medidas por departamento desde 1988—, el comercio exterior
 * por departamento y producto desde 2010, y el producto abierto por actividad
 * económica, que es el que contesta de qué vive cada departamento y no sólo
 * cuánto produce. Los tres se leen de la misma vista anual, filiados por el
 * prefijo `DEPT_`, y `departments.ts` y `department-activities.ts` explican cómo
 * se vuelve a abrir lo que el código lleva dentro.
 *
 * **Lo que no se hace aquí.** No se suman los nueve para reconstruir el país:
 * el INE publica la fila de Bolivia y es la que se usa, porque sumar
 * departamentos de un cuadro de cuentas regionales arrastra la discrepancia
 * estadística que el propio instituto ya resolvió. Y no se compara el valor
 * exportado con el producto sin decirlo: uno está en dólares corrientes y el
 * otro en bolivianos, y el tipo de cambio que los une es precisamente lo que
 * este observatorio pasa el día discutiendo.
 *
 * Las conclusiones se derivan de las últimas lecturas y de aquella contra la
 * que se miden; ninguna está redactada a mano.
 */

export interface YearValue {
  year: number;
  value: number;
}

/** Lo que un departamento vende de un producto, en las dos unidades. */
export interface ProductLine {
  place: string;
  slug: string;
  label: string;
  usd: YearValue[];
  tonnes: YearValue[];
}

export interface DepartmentBoard {
  /** Por medida y por lugar, la serie entera ordenada por año. */
  series: Record<string, Record<string, YearValue[]>>;
  /** Las líneas de producto de cada departamento. */
  products: ProductLine[];
  /** Por medida, lugar y actividad: el producto abierto por rubro. */
  activities: ActivitySeries;
  conclusions: FxConclusion[];
  /** El año más reciente con cuentas regionales, y el más reciente con comercio. */
  accountsYear: number | null;
  tradeYear: number | null;
  /** El año más reciente con el producto abierto por actividad. */
  activityYear: number | null;
}

const last = (values: readonly YearValue[] | undefined): YearValue | undefined => values?.at(-1);

const at = (values: readonly YearValue[] | undefined, year: number): YearValue | undefined =>
  values?.find((point) => point.year === year);

const say = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const percent = (value: number, decimals = 1): string => `${say(value, decimals)} %`;

/**
 * El año con el que se compara, que es diez atrás o el primero que haya.
 *
 * Diez años y no el principio de la serie: estas cuentas arrancan en 1988 y la
 * Bolivia de 1988 no es una referencia, es otro país. Una década es el plazo en
 * que un departamento cambia de motor —el gas de Tarija, el oro de La Paz— y
 * sigue siendo la misma economía.
 */
function decadeAgo(values: readonly YearValue[]): YearValue | undefined {
  const latest = last(values);
  if (!latest) return undefined;
  return at(values, latest.year - 10) ?? values.at(0);
}

/**
 * Lo que el tablero concluye solo, mirando lo que acaba de leer.
 *
 * Cuatro lecturas, y las cuatro son comparaciones: quién pesa más, quién ha
 * ganado y quién ha perdido en una década, y qué tan concentrada está la venta
 * al exterior. Ninguna está escrita a mano; todas cambian con el dato.
 */
function conclude(board: Omit<DepartmentBoard, 'conclusions'>): FxConclusion[] {
  const out: FxConclusion[] = [];
  const shares = board.series['GDP_SHARE'] ?? {};
  const constant = board.series['GDP_CONSTANT'] ?? {};
  const exports = board.series['EXPORTS_USD'] ?? {};

  const ranked = DEPARTMENTS.map((department) => ({
    department,
    share: last(shares[department.slug]),
  }))
    .filter((row): row is { department: (typeof DEPARTMENTS)[number]; share: YearValue } =>
      Boolean(row.share),
    )
    .sort((left, right) => right.share.value - left.share.value);

  const top = ranked[0];
  const second = ranked[1];
  if (top && second) {
    const threeBiggest = ranked.slice(0, 3).reduce((sum, row) => sum + row.share.value, 0);
    out.push({
      key: 'concentracion',
      claim: `${top.department.name} es la economía más grande del país y tres departamentos hacen casi todo el producto`,
      figure: percent(threeBiggest),
      detail: `Suma de ${ranked
        .slice(0, 3)
        .map((row) => row.department.name)
        .join(
          ', ',
        )} en ${top.share.year}. ${top.department.name} sola aporta el ${percent(top.share.value)}, frente al ${percent(second.share.value)} de ${second.department.name}.`,
      tone: 'neutral',
    });
  }

  /*
   * Quién ganó y quién perdió tamaño real en una década.
   *
   * Se mide sobre el producto a precios constantes y no sobre la participación,
   * porque la participación es un juego de suma cero: un departamento puede
   * subir en ella sin crecer, sólo porque otro se hundió. Eso es exactamente lo
   * que pasó aquí, y decirlo con la participación lo contaría al revés.
   */
  const moves = DEPARTMENTS.map((department) => {
    const values = constant[department.slug] ?? [];
    const latest = last(values);
    const before = decadeAgo(values);
    if (!latest || !before || before.value === 0) return null;
    return {
      department,
      change: ((latest.value - before.value) / before.value) * 100,
      from: before.year,
      to: latest.year,
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  const winner = [...moves].sort((left, right) => right.change - left.change)[0];
  const loser = [...moves].sort((left, right) => left.change - right.change)[0];

  if (winner) {
    out.push({
      key: 'ganador',
      claim: `${winner.department.name} es el departamento que más creció en la última década`,
      figure: percent(winner.change),
      detail: `Producto a precios constantes de 1990 entre ${winner.from} y ${winner.to}, según el INE.`,
      tone: 'favourable',
    });
  }

  if (loser && loser.change < 0) {
    out.push({
      key: 'perdedor',
      claim: `${loser.department.name} es el único gran perdedor del periodo: su economía es hoy más chica que hace diez años`,
      figure: percent(loser.change),
      detail: `Producto a precios constantes de 1990 entre ${loser.from} y ${loser.to}. Una caída así en una cifra departamental no aparece en el dato nacional, que la promedia con el resto.`,
      tone: 'adverse',
    });
  }

  const sold = DEPARTMENTS.map((department) => ({
    department,
    value: last(exports[department.slug]),
  }))
    .filter((row): row is { department: (typeof DEPARTMENTS)[number]; value: YearValue } =>
      Boolean(row.value),
    )
    .sort((left, right) => right.value.value - left.value.value);

  /*
   * De qué vive el que más depende de una sola cosa.
   *
   * Es la lectura que el reparto del producto no da: un departamento puede ser
   * pequeño y estar entero colgado de una actividad, y eso no se ve en ninguna
   * figura que ordene por tamaño. Se busca sobre los once grupos y los nueve
   * departamentos a la vez, y gana el par más concentrado.
   */
  const leaning = DEPARTMENTS.flatMap((department) =>
    activityStructure(board.activities, department.slug, board.activityYear).map((slice) => ({
      department,
      slice,
    })),
  ).sort((left, right) => right.slice.value - left.slice.value)[0];

  if (leaning && board.activityYear !== null) {
    out.push({
      key: 'rubro',
      claim: `Ningún departamento depende de una sola actividad tanto como ${leaning.department.name} de ${leaning.slice.name.toLocaleLowerCase('es')}`,
      figure: percent(leaning.slice.value),
      detail: `Parte del producto departamental a precios corrientes en ${board.activityYear}, repartido entre las once actividades que el INE publica. Es la mayor de las noventa y nueve combinaciones de departamento y actividad.`,
      tone: 'neutral',
    });
  }

  /*
   * Y qué actividad se hundió en el país. Sobre el nivel a precios constantes
   * del cuadro nacional, que es donde una caída real se distingue de una
   * pérdida de peso: una actividad puede encoger en el reparto sin encoger.
   */
  const country = activityMoves(board.activities, 'BOLIVIA', board.activityYear).sort(
    (left, right) => left.change - right.change,
  )[0];

  if (country && country.change < 0) {
    out.push({
      key: 'hundida',
      claim: `${country.name} es la actividad que más se ha encogido en Bolivia en una década`,
      figure: percent(country.change),
      detail: `Valor agregado a precios constantes de 1990 entre ${country.from} y ${country.to}, sumando las ramas que el cuadro nacional publica de esa actividad.`,
      tone: 'adverse',
    });
  }

  const total = sold.reduce((sum, row) => sum + row.value.value, 0);
  const leader = sold[0];
  if (leader && total > 0) {
    out.push({
      key: 'exportador',
      claim: `${leader.department.name} encabeza lo que el país vende afuera`,
      figure: percent((leader.value.value / total) * 100),
      detail: `De los ${say(total, 0)} millones de dólares que los nueve departamentos declararon en ${leader.value.year}, ${leader.department.name} puso ${say(leader.value.value, 0)}.`,
      tone: 'neutral',
    });
  }

  return out;
}

/** Arma el capítulo con las filas que la vista anual marcó como departamentales. */
export function buildDepartmentBoard(points: readonly MacroPoint[]): DepartmentBoard {
  const series: Record<string, Record<string, YearValue[]>> = {};
  const lines = new Map<string, ProductLine>();

  const activities: ActivitySeries = {};

  for (const point of points) {
    if (!Number.isFinite(point.value)) continue;
    const year = Number(point.period);
    if (!Number.isInteger(year)) continue;

    /*
     * Las series por actividad se reconocen antes que las demás y por su propio
     * tramo de código. Sin esto, `DEPT_ACT_VALUE_TARIJA_PETROLEO_Y_GAS` no
     * encaja con ninguna medida de cuentas regionales y se cae del capítulo en
     * silencio, que es justo el fallo que el analizador devuelve `null` para
     * evitar.
     */
    const rubro = parseActivityCode(point.indicatorCode);
    if (rubro) {
      const byPlace = (activities[rubro.measure] ??= {});
      const byActivity = (byPlace[rubro.place] ??= {});
      (byActivity[rubro.activity] ??= []).push({ year, value: point.value });
      continue;
    }

    const parsed = parseDepartmentCode(point.indicatorCode);
    if (!parsed) continue;

    if (parsed.product === null) {
      const byPlace = (series[parsed.measure.slug] ??= {});
      (byPlace[parsed.place.slug] ??= []).push({ year, value: point.value });
      continue;
    }

    /*
     * Un producto es una fila con dos columnas y no dos series sueltas: el
     * valor y el peso del mismo producto se leen juntos o no se leen, porque la
     * pregunta que contestan —¿salió más o sólo valió más?— necesita las dos.
     */
    const key = `${parsed.place.slug}|${parsed.product}`;
    const line =
      lines.get(key) ??
      ({
        place: parsed.place.slug,
        slug: parsed.product,
        label: productLabel(point.name, parsed.product),
        usd: [],
        tonnes: [],
      } satisfies ProductLine);
    (parsed.measure.slug === 'EXPORTS_TONNES' ? line.tonnes : line.usd).push({
      year,
      value: point.value,
    });
    lines.set(key, line);
  }

  const byYear = (values: YearValue[]): YearValue[] =>
    values.sort((left, right) => left.year - right.year);
  for (const byPlace of Object.values(series)) {
    for (const values of Object.values(byPlace)) byYear(values);
  }
  for (const byPlace of Object.values(activities)) {
    for (const byActivity of Object.values(byPlace)) {
      for (const values of Object.values(byActivity)) byYear(values);
    }
  }
  const products = [...lines.values()].map((line) => ({
    ...line,
    usd: byYear(line.usd),
    tonnes: byYear(line.tonnes),
  }));

  const yearOf = (measure: string): number | null => {
    const years = Object.values(series[measure] ?? {}).map((values) => last(values)?.year ?? 0);
    const newest = Math.max(0, ...years);
    return newest > 0 ? newest : null;
  };

  const activityYears = Object.values(activities['SHARE'] ?? {}).flatMap((byActivity) =>
    Object.values(byActivity).map((values) => last(values)?.year ?? 0),
  );
  const newestActivity = Math.max(0, ...activityYears);

  const partial: Omit<DepartmentBoard, 'conclusions'> = {
    series,
    products,
    activities,
    accountsYear: yearOf('GDP_CONSTANT'),
    tradeYear: yearOf('EXPORTS_USD'),
    activityYear: newestActivity > 0 ? newestActivity : null,
  };

  return { ...partial, conclusions: conclude(partial) };
}

/** El residuo que el INE publica al final de cada lista: no es un producto. */
export const OTHER_PRODUCTS = 'OTROS_PRODUCTOS';

/**
 * Lo que un departamento vendió en un año, de más a menos, para el reparto.
 *
 * En dólares o en toneladas, según se pida: el ránking en peso no es el mismo
 * que en valor —el mineral pesa y el oro no—, y esa diferencia es lo que
 * separa «de qué vive» de «qué carga en el camión».
 */
export function productMix(
  board: DepartmentBoard,
  place: string,
  year: number | null,
  unit: 'usd' | 'tonnes' = 'usd',
): Array<{ name: string; value: number }> {
  if (year === null) return [];
  return board.products
    .filter((line) => line.place === place)
    .map((line) => ({ name: line.label, value: at(line[unit], year)?.value ?? 0 }))
    .filter((slice) => slice.value > 0)
    .sort((left, right) => right.value - left.value);
}

/**
 * Los productos principales de un departamento, por lo que valieron en un año.
 *
 * Se ordena por dólares y no por peso, y se deja fuera «otros productos»: es
 * el residuo con el que el INE cierra la lista, y ponerlo entre los cinco
 * principales sería dibujar como producto la suma de todo lo que no se nombró.
 */
export function topProducts(
  board: DepartmentBoard,
  place: string,
  year: number | null,
  count: number,
): ProductLine[] {
  if (year === null) return [];
  return board.products
    .filter((line) => line.place === place && line.slug !== OTHER_PRODUCTS)
    .map((line) => ({ line, value: at(line.usd, year)?.value ?? 0 }))
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, count)
    .map((row) => row.line);
}

/**
 * La mediana de los nueve departamentos, año a año, para una medida.
 *
 * La mediana y no el promedio, porque el promedio de nueve departamentos con
 * Santa Cruz dentro es Santa Cruz diluida: un departamento mediano quedaría
 * «por debajo del promedio» en todas las medidas de tamaño sin que eso diga
 * nada de él. Un año entra sólo si al menos la mitad de los nueve lo publicó;
 * la mediana de tres departamentos no es la mediana de Bolivia.
 */
export function medianAcross(board: DepartmentBoard, measure: string): YearValue[] {
  const byPlace = board.series[measure] ?? {};
  const byYear = new Map<number, number[]>();
  for (const department of DEPARTMENTS) {
    for (const point of byPlace[department.slug] ?? []) {
      const values = byYear.get(point.year) ?? [];
      values.push(point.value);
      byYear.set(point.year, values);
    }
  }
  const floor = Math.ceil(DEPARTMENTS.length / 2);
  return [...byYear.entries()]
    .filter(([, values]) => values.length >= floor)
    .map(([year, values]) => {
      const sorted = [...values].sort((left, right) => left - right);
      const middle = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 0
          ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
          : (sorted[middle] ?? 0);
      return { year, value: median };
    })
    .sort((left, right) => left.year - right.year);
}

/**
 * En qué puesto queda un departamento entre los nueve en el último año de una
 * medida, y cuántos publicaron ese año. `null` si no tiene dato.
 *
 * Se compara sobre el mismo año para todos y no sobre el último de cada uno,
 * porque el per cápita cierra un año antes que el resto y un departamento no
 * puede ganar puestos por haber publicado más tarde.
 */
export function placeRank(
  board: DepartmentBoard,
  measure: string,
  place: string,
): { position: number; of: number; year: number } | null {
  const byPlace = board.series[measure] ?? {};
  const own = last(byPlace[place]);
  if (!own) return null;
  const peers = DEPARTMENTS.map((department) => at(byPlace[department.slug], own.year)).filter(
    (point): point is YearValue => point !== undefined,
  );
  const above = peers.filter((point) => point.value > own.value).length;
  return { position: above + 1, of: peers.length, year: own.year };
}

/** El reparto entre departamentos de una medida, en su último año. */
export function placeMix(
  board: DepartmentBoard,
  measure: string,
): Array<{ name: string; value: number; pick: string }> {
  const byPlace = board.series[measure] ?? {};
  return DEPARTMENTS.map((department) => ({
    name: placeName(department.slug),
    value: last(byPlace[department.slug])?.value ?? 0,
    pick: department.slug,
  }))
    .filter((slice) => slice.value > 0)
    .sort((left, right) => right.value - left.value);
}

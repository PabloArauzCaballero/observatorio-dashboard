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
 * El capítulo se arma con dos corpus del INE que el núcleo ahora recoge: las
 * cuentas regionales —seis medidas por departamento desde 1988— y el comercio
 * exterior por departamento y producto desde 2010. Los dos se leen de la misma
 * vista anual, filiados por el prefijo `DEPT_`, y `departments.ts` explica cómo
 * se vuelve a abrir el sitio que el código lleva dentro.
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
  conclusions: FxConclusion[];
  /** El año más reciente con cuentas regionales, y el más reciente con comercio. */
  accountsYear: number | null;
  tradeYear: number | null;
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

  for (const point of points) {
    if (!Number.isFinite(point.value)) continue;
    const parsed = parseDepartmentCode(point.indicatorCode);
    if (!parsed) continue;
    const year = Number(point.period);
    if (!Number.isInteger(year)) continue;

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

  const partial: Omit<DepartmentBoard, 'conclusions'> = {
    series,
    products,
    accountsYear: yearOf('GDP_CONSTANT'),
    tradeYear: yearOf('EXPORTS_USD'),
  };

  return { ...partial, conclusions: conclude(partial) };
}

/** Lo que un departamento vendió en un año, de más a menos, para el reparto. */
export function productMix(
  board: DepartmentBoard,
  place: string,
  year: number | null,
): Array<{ name: string; value: number }> {
  if (year === null) return [];
  return board.products
    .filter((line) => line.place === place)
    .map((line) => ({ name: line.label, value: at(line.usd, year)?.value ?? 0 }))
    .filter((slice) => slice.value > 0)
    .sort((left, right) => right.value - left.value);
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

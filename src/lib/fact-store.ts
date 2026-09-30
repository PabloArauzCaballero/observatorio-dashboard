/**
 * Los hechos de los que se arma una lectura, antes de que ninguna frase exista.
 *
 * El capítulo cambiario venía escrito al revés: una función por conclusión, y
 * dentro de cada función la cuenta y la frase cosidas juntas. Eso tiene dos
 * consecuencias que se notan enseguida. Añadir una lectura obliga a escribir
 * otra función entera, de modo que el informe sólo dice lo que alguien se sentó
 * a redactar; y nada sabe qué es importante hoy, porque no hay nada que comparar
 * —cada frase mira su propio número y ninguna mira el de al lado.
 *
 * Aquí las cuentas se separan del texto. Un hecho es una medición con nombre,
 * unidad, ventana, tamaño de muestra, fórmula y fecha, y se calcula igual para
 * el dólar, para la UFV, para el oro o para cualquier serie que llegue después.
 * Las lecturas pasan a ser consultas: piden los hechos que necesitan y se
 * apagan solas si alguno falta, en vez de comprobar a mano que haya datos.
 *
 * Tres reglas que este módulo hace cumplir por construcción:
 *
 * 1. **Sin ventana no hay hecho.** Un cambio a doce meses medido sobre cinco no
 *    se calcula «con lo que haya»: no se emite. Un número con la etiqueta
 *    equivocada es peor que un hueco, porque el hueco se ve.
 * 2. **Todo hecho lleva su fórmula y sus fechas**, así que `explain` devuelve
 *    cómo se calculó sin que nadie tenga que abrir el código. Es la diferencia
 *    entre un informe que se puede auditar y uno que hay que creer.
 * 3. **La ventana es nominal, no exacta.** Una serie que se lee en días hábiles
 *    no tiene punto en la fecha calendario de hace un año, así que se compara
 *    contra la última lectura anterior a esa fecha y el hecho guarda cuál fue.
 *
 * No interpreta nada. No sabe qué es una brecha ni qué es un tipo de cambio: la
 * economía vive en los detectores, y este módulo sólo mide.
 */

import type { MacroPoint } from './fx-macro';

/** La unidad en que se lee el valor, que decide cómo se lo formatea y compara. */
export type FactUnit =
  | 'pct'
  | 'bob_usd'
  | 'usd'
  | 'indice'
  | 'dias'
  | 'veces'
  | 'bob'
  | 'recuento';

/**
 * Qué mide un hecho.
 *
 * Deliberadamente cortas y genéricas: son las preguntas que se le pueden hacer
 * a cualquier serie temporal sin saber de qué trata. Lo que distingue a la
 * brecha del precio del oro es el detector que los pide, no la medición.
 */
export type FactMetric =
  | 'nivel'
  | 'cambio'
  | 'maximo'
  | 'minimo'
  | 'desde_maximo'
  | 'percentil'
  | 'sorpresa'
  | 'racha'
  | 'volatilidad'
  | 'recencia';

export interface Fact {
  /** `serie.metrica[.ventana]`, que es como lo pide un detector. */
  id: string;
  serie: string;
  metrica: FactMetric;
  /** Días de la ventana; `null` cuando la medición no tiene una. */
  ventana: number | null;
  valor: number;
  unidad: FactUnit;
  /** La fecha a la que corresponde el valor. */
  hasta: string;
  /** El otro extremo de la ventana, cuando la hay. */
  desde: string | null;
  /** Observaciones que entraron en la medición. */
  n: number;
  /** Cómo se calculó, en una línea que se pueda leer sin el código. */
  formula: string;
}

export interface Facts {
  get(id: string): Fact | undefined;
  /**
   * Todos los hechos pedidos, o `null` si falta alguno.
   *
   * Es la primitiva que hace desaparecer la comprobación a mano de cada
   * conclusión: un detector declara lo que necesita y el motor decide si puede
   * hablar. Todo o nada a propósito —media lectura es una lectura falsa.
   */
  need(...ids: readonly string[]): Fact[] | null;
  all(): Fact[];
  /** La fórmula, las fechas y la muestra de un hecho, para auditarlo. */
  explain(id: string): string | null;
}

export function factStore(facts: readonly Fact[]): Facts {
  const index = new Map(facts.map((fact) => [fact.id, fact]));
  return {
    get: (id) => index.get(id),
    need: (...ids) => {
      const found = ids.map((id) => index.get(id));
      return found.every((fact): fact is Fact => fact !== undefined) ? found : null;
    },
    all: () => [...index.values()],
    explain: (id) => {
      const fact = index.get(id);
      if (!fact) return null;
      const window = fact.desde ? `del ${fact.desde} al ${fact.hasta}` : `al ${fact.hasta}`;
      return `${fact.id} = ${fact.valor} (${fact.unidad}), ${window}, n = ${fact.n}. ${fact.formula}`;
    },
  };
}

const minusDays = (date: string, days: number): string => {
  const moved = new Date(`${date}T12:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() - days);
  return moved.toISOString().slice(0, 10);
};

const spanDays = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000,
  );

/**
 * La última lectura en una fecha o antes, que es como mira hacia atrás todo esto.
 *
 * Por bisección y no filtrando la serie, porque esto se llama una vez por punto
 * al medir la distribución de movimientos y la UFV son nueve mil puntos: filtrar
 * convierte una pasada en un cuadrado, y con las series diarias del informe eso
 * es la diferencia entre milisegundos y decenas de segundos por carga.
 */
export function asOfDate(series: readonly MacroPoint[], date: string): MacroPoint | undefined {
  let low = 0;
  let high = series.length - 1;
  let found: MacroPoint | undefined;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const point = series[middle];
    if (!point) break;
    if (point.date <= date) {
      found = point;
      low = middle + 1;
    } else high = middle - 1;
  }
  return found;
}

interface FactSeed {
  serie: string;
  metrica: FactMetric;
  ventana?: number;
  valor: number;
  unidad: FactUnit;
  hasta: string;
  desde?: string | null;
  n: number;
  formula: string;
}

const fact = (seed: FactSeed): Fact => ({
  id: `${seed.serie}.${seed.metrica}${seed.ventana ? `.${seed.ventana}d` : ''}`,
  serie: seed.serie,
  metrica: seed.metrica,
  ventana: seed.ventana ?? null,
  valor: seed.valor,
  unidad: seed.unidad,
  hasta: seed.hasta,
  desde: seed.desde ?? null,
  n: seed.n,
  formula: seed.formula,
});

/** Un hecho armado fuera de una serie: un cociente, una cuenta, un cruce. */
export function derived(seed: FactSeed): Fact {
  return fact(seed);
}

export interface DescribeOptions {
  /** Las ventanas en días que se miden si la serie llega hasta ellas. */
  ventanas?: readonly number[];
  /** Si la serie es un nivel cuyo cambio se lee en por ciento. */
  cambioRelativo?: boolean;
}

const DEFAULT_WINDOWS = [7, 30, 90, 365] as const;

/**
 * Todo lo que se puede decir de una serie sin saber qué mide.
 *
 * Diez mediciones sobre el mismo recorrido, y la misma docena de líneas sirve
 * para el paralelo, para el índice real, para la inflación implícita o para el
 * oro. Ahí está el cambio respecto de lo que había: una serie nueva entra al
 * informe con sus hechos completos sin escribir una función más.
 *
 * El percentil y la sorpresa son los que permiten ordenar después por
 * importancia. El percentil sitúa el nivel de hoy dentro de su propia historia
 * —un ocho por ciento de brecha no dice nada hasta que se sabe que es el
 * percentil cuatro de su serie—, y la sorpresa mide el movimiento del mes
 * contra la distribución de todos los meses, que es la única forma de que el
 * motor distinga una noticia de un martes cualquiera.
 */
export function describe(
  serie: string,
  points: readonly MacroPoint[],
  unidad: FactUnit,
  options: DescribeOptions = {},
): Fact[] {
  const ordered = [...points].sort((left, right) => left.date.localeCompare(right.date));
  const last = ordered.at(-1);
  if (!last || ordered.length < 2) return [];
  const relative = options.cambioRelativo ?? unidad !== 'pct';
  const windows = options.ventanas ?? DEFAULT_WINDOWS;
  const out: Fact[] = [];

  out.push(
    fact({
      serie,
      metrica: 'nivel',
      valor: last.value,
      unidad,
      hasta: last.date,
      n: ordered.length,
      formula: 'Última lectura publicada de la serie.',
    }),
  );

  const changes: number[] = [];
  for (const days of windows) {
    const from = asOfDate(ordered, minusDays(last.date, days));
    if (!from || from.date === last.date) continue;
    if (relative && from.value <= 0) continue;
    const value = relative ? (last.value / from.value - 1) * 100 : last.value - from.value;
    const n = ordered.filter((point) => point.date >= from.date).length;
    out.push(
      fact({
        serie,
        metrica: 'cambio',
        ventana: days,
        valor: value,
        unidad: relative ? 'pct' : unidad,
        hasta: last.date,
        desde: from.date,
        n,
        formula: relative
          ? `(${last.value} / ${from.value} − 1) × 100, contra la última lectura anterior a ${days} días calendario.`
          : `${last.value} − ${from.value}, contra la última lectura anterior a ${days} días calendario.`,
      }),
    );
    if (days === 30) changes.push(value);
  }

  const high = ordered.reduce((best, point) => (point.value > best.value ? point : best));
  const low = ordered.reduce((best, point) => (point.value < best.value ? point : best));
  out.push(
    fact({
      serie,
      metrica: 'maximo',
      valor: high.value,
      unidad,
      hasta: high.date,
      desde: ordered[0]?.date ?? null,
      n: ordered.length,
      formula: 'Máximo de toda la serie disponible, con la fecha en que ocurrió.',
    }),
    fact({
      serie,
      metrica: 'minimo',
      valor: low.value,
      unidad,
      hasta: low.date,
      desde: ordered[0]?.date ?? null,
      n: ordered.length,
      formula: 'Mínimo de toda la serie disponible, con la fecha en que ocurrió.',
    }),
  );
  if (high.value !== 0 && high.date !== last.date) {
    out.push(
      fact({
        serie,
        metrica: 'desde_maximo',
        valor: relative ? (last.value / high.value - 1) * 100 : last.value - high.value,
        unidad: relative ? 'pct' : unidad,
        hasta: last.date,
        desde: high.date,
        n: ordered.length,
        formula: `Distancia del nivel de hoy a su máximo del ${high.date}.`,
      }),
    );
  }

  /*
   * El percentil sólo significa algo si la serie sube y baja. Una serie
   * monótona —la UFV, que por construcción nunca retrocede salvo en deflación—
   * está en su percentil 100 todos los días desde 2001, y publicar eso como
   * hallazgo es ruido con cara de noticia. Se mide la proporción de pasos que
   * van en la misma dirección y, si casi todos lo hacen, no se emite el hecho.
   */
  if (!isMonotone(ordered)) {
    const sorted = [...ordered].map((point) => point.value).sort((a, b) => a - b);
    const rank = sorted.filter((value) => value <= last.value).length;
    out.push(
      fact({
        serie,
        metrica: 'percentil',
        valor: (rank / sorted.length) * 100,
        unidad: 'pct',
        hasta: last.date,
        desde: ordered[0]?.date ?? null,
        n: ordered.length,
        formula:
          'Porcentaje de la propia historia de la serie que queda por debajo del nivel de hoy.',
      }),
    );
  }

  /*
   * La sorpresa se mide sobre los movimientos y no sobre el nivel. El nivel de
   * una serie con tendencia está casi siempre en su propio extremo, de modo que
   * un z del nivel diría «histórico» todos los días; lo que se puede comparar
   * con su propia distribución es cuánto se movió.
   */
  const month = windows.includes(30) ? 30 : (windows.at(0) ?? 30);
  const moves = monthlyMoves(ordered, month, relative);
  const current = changes.at(0) ?? null;
  if (current !== null && moves.length >= 12) {
    const mean = moves.reduce((sum, value) => sum + value, 0) / moves.length;
    const variance =
      moves.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (moves.length - 1);
    const sd = Math.sqrt(variance);
    if (sd > 0) {
      out.push(
        fact({
          serie,
          metrica: 'sorpresa',
          ventana: month,
          valor: (current - mean) / sd,
          unidad: 'veces',
          hasta: last.date,
          desde: ordered[0]?.date ?? null,
          n: moves.length,
          formula: `Desviaciones típicas entre el movimiento de ${month} días de hoy y la distribución de todos los de la serie (media ${mean.toFixed(3)}, sigma ${sd.toFixed(3)}).`,
        }),
      );
    }
  }

  const streak = trailingStreak(ordered);
  if (streak.days > 1) {
    out.push(
      fact({
        serie,
        metrica: 'racha',
        valor: streak.days * streak.direction,
        unidad: 'dias',
        hasta: last.date,
        desde: streak.from,
        n: ordered.length,
        formula:
          'Lecturas consecutivas moviéndose en la misma dirección; el signo dice hacia dónde.',
      }),
    );
  }

  /*
   * La volatilidad se mide sobre precios, no sobre tasas. Una serie que ya es
   * un porcentaje —la brecha, la inflación implícita— pasa cerca del cero y sus
   * variaciones logarítmicas explotan: la brecha daba 1.709 % anualizado, que
   * es aritmética correcta sobre la serie equivocada.
   */
  const vol = unidad === 'pct' ? null : annualisedVolatility(ordered, 30);
  if (vol !== null) {
    out.push(
      fact({
        serie,
        metrica: 'volatilidad',
        ventana: 30,
        valor: vol,
        unidad: 'pct',
        hasta: last.date,
        desde: minusDays(last.date, 30),
        n: 30,
        formula:
          'Desviación típica de las variaciones logarítmicas diarias de los últimos 30 días, anualizada por raíz de 252.',
      }),
    );
  }

  return out;
}

/** Si la serie prácticamente nunca cambia de dirección, y por tanto no tiene percentil que decir. */
function isMonotone(ordered: readonly MacroPoint[]): boolean {
  let up = 0;
  let down = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const step = (ordered[index]?.value ?? 0) - (ordered[index - 1]?.value ?? 0);
    if (step > 0) up += 1;
    else if (step < 0) down += 1;
  }
  const steps = up + down;
  return steps > 0 && Math.max(up, down) / steps > 0.99;
}

/** Los movimientos de la serie en ventanas sucesivas, para tener con qué comparar el de hoy. */
function monthlyMoves(
  ordered: readonly MacroPoint[],
  days: number,
  relative: boolean,
): number[] {
  /*
   * Un cursor que avanza en vez de una búsqueda por punto: la fecha de partida
   * crece con la de llegada, así que el extremo de atrás nunca retrocede y la
   * distribución entera sale en una sola pasada.
   */
  const moves: number[] = [];
  let cursor = 0;
  for (const point of ordered) {
    const target = minusDays(point.date, days);
    while (cursor + 1 < ordered.length && (ordered[cursor + 1]?.date ?? '') <= target) cursor += 1;
    const past = ordered[cursor];
    if (!past || past.date > target || past.date === point.date) continue;
    if (relative && past.value <= 0) continue;
    moves.push(relative ? (point.value / past.value - 1) * 100 : point.value - past.value);
  }
  return moves;
}

/** Cuántas lecturas seguidas viene moviéndose en la misma dirección, y hacia dónde. */
function trailingStreak(ordered: readonly MacroPoint[]): {
  days: number;
  direction: number;
  from: string;
} {
  let days = 0;
  let direction = 0;
  let from = ordered.at(-1)?.date ?? '';
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const current = ordered[index];
    const previous = ordered[index - 1];
    if (!current || !previous) break;
    const step = Math.sign(current.value - previous.value);
    if (step === 0) break;
    if (direction === 0) direction = step;
    else if (step !== direction) break;
    days += 1;
    from = previous.date;
  }
  return { days, direction, from };
}

/** Volatilidad anualizada de la ventana, o nada si no hay ventana que medir. */
function annualisedVolatility(ordered: readonly MacroPoint[], days: number): number | null {
  const last = ordered.at(-1);
  if (!last) return null;
  const window = ordered.filter(
    (point) => point.date > minusDays(last.date, days) && point.value > 0,
  );
  if (window.length < 10) return null;
  const returns: number[] = [];
  for (let index = 1; index < window.length; index += 1) {
    const current = window[index]?.value;
    const previous = window[index - 1]?.value;
    if (!current || !previous) continue;
    returns.push(Math.log(current / previous));
  }
  if (returns.length < 8) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

/** Días entre dos fechas, que es lo que mide la recencia de una serie. */
export function recency(serie: string, points: readonly MacroPoint[], asOf: string): Fact | null {
  const last = points.at(-1);
  if (!last) return null;
  return fact({
    serie,
    metrica: 'recencia',
    valor: spanDays(last.date, asOf),
    unidad: 'dias',
    hasta: asOf,
    desde: last.date,
    n: points.length,
    formula: 'Días entre la última lectura publicada y la fecha del informe.',
  });
}

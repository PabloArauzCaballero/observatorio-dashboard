import { ANY, accepts, choiceOf, counts, param } from './choice';
import type { Choice } from './choice';
import type { PressCube } from './series';

/**
 * Cross-filtering, the way a report pane does it.
 *
 * Click a bar and every other visual narrows to it — but the bar you clicked
 * keeps showing all of its own options, because a slicer that hides the
 * alternatives the moment you choose one cannot be un-chosen. So each visual is
 * counted under every selection EXCEPT its own, which is the whole rule.
 *
 * Cada dimensión guarda un conjunto y no una cadena (ver `./choice`): con un
 * valor adentro filtra como siempre filtró, y con varios es una disyunción —
 * Santa Cruz o Tarija— que se recuenta igual de rápido, porque lo que cambia es
 * la prueba de una fila y no el recorrido.
 *
 * All of it runs over the cross-tabulation the page was handed: about fourteen
 * hundred rows for the corpus and twenty-four hundred for the vocabulary, so a
 * click re-counts twenty-two thousand articles in well under a frame, without
 * asking the server anything.
 */

export type PressDimension = 'year' | 'tone' | 'topic' | 'region' | 'outlet' | 'term';

export type PressSelection = Record<PressDimension, Choice>;

/** Every subject except the residual bucket: the observatory's own remit. */
export const ECONOMIC_TOPICS = 'ECONOMICOS';

export const NO_SELECTION: PressSelection = {
  year: ANY,
  tone: ANY,
  topic: choiceOf(ECONOMIC_TOPICS),
  region: ANY,
  outlet: ANY,
  term: ANY,
};

/** Where each dimension sits in a fact row; a term row carries the same five, shifted. */
const COLUMN: Record<Exclude<PressDimension, 'term'>, number> = {
  year: 0,
  tone: 1,
  topic: 2,
  region: 3,
  outlet: 4,
};

const VALUES: Record<Exclude<PressDimension, 'term'>, keyof PressCube> = {
  year: 'years',
  tone: 'tones',
  topic: 'topics',
  region: 'regions',
  outlet: 'outlets',
};

/**
 * Whether a row's value for one dimension survives that dimension's selection.
 *
 * `ECONOMICOS` no es un tema: es «cualquiera menos el residuo», y se puede
 * elegir junto a temas concretos sin que la prueba deje de ser una disyunción.
 */
function keeps(dimension: Exclude<PressDimension, 'term'>, value: string, chosen: Choice): boolean {
  if (chosen.size === 0) return true;
  if (dimension === 'topic' && chosen.has(ECONOMIC_TOPICS) && value !== 'OTROS') return true;
  return accepts(chosen, value);
}

/** Los índices del cubo que corresponden a los términos elegidos. */
function termIndices(cube: PressCube, chosen: Choice): Set<number> {
  const wanted = new Set<number>();
  if (chosen.size === 0) return wanted;
  cube.terms.forEach((entry, index) => {
    if (chosen.has(entry.term)) wanted.add(index);
  });
  return wanted;
}

/**
 * Si los recuentos de esta selección son un techo y no una cifra exacta.
 *
 * Una nota puede nombrar dos términos vigilados, y el cubo guarda una fila por
 * nota y término: sumar dos términos cuenta dos veces la nota que nombra a los
 * dos. El cubo no lleva identificadores de nota, así que no hay forma de
 * descontarlo aquí — y la base sí lo descuenta, porque allá el recorte es sobre
 * la nota. La diferencia existe, es acotada y se nombra en pantalla en lugar de
 * presentar un techo como si fuera un total.
 */
export const isUpperBound = (selection: PressSelection): boolean => selection.term.size > 1;

/**
 * How many articles each value of one dimension accounts for, under every
 * selection but its own.
 *
 * Returns raw values (`SANTA_CRUZ`, `ALARMA`), not labels: naming belongs to
 * the view, and a count keyed by a display string cannot be clicked back into a
 * filter.
 */
export function countsFor(
  cube: PressCube,
  selection: PressSelection,
  except: PressDimension,
): Map<string, number> {
  const out = new Map<string, number>();
  const termChosen = selection.term.size > 0;
  const wanted = termChosen ? termIndices(cube, selection.term) : new Set<number>();

  // Counting the vocabulary itself, or counting anything under a chosen term:
  // either way the answer lives in the term rows.
  if (except === 'term' || termChosen) {
    for (const row of cube.termCells) {
      if (except !== 'term' && !wanted.has(row[0] ?? -1)) continue;
      let survives = true;
      for (const dimension of Object.keys(COLUMN) as Array<Exclude<PressDimension, 'term'>>) {
        if (dimension === except) continue;
        const value = (cube[VALUES[dimension]] as string[])[row[COLUMN[dimension] + 1] ?? -1] ?? '';
        if (!keeps(dimension, value, selection[dimension])) {
          survives = false;
          break;
        }
      }
      if (!survives) continue;
      const key =
        except === 'term'
          ? (cube.terms[row[0] ?? -1]?.term ?? '')
          : ((cube[VALUES[except]] as string[])[row[COLUMN[except] + 1] ?? -1] ?? '');
      out.set(key, (out.get(key) ?? 0) + (row[6] ?? 0));
    }
    return out;
  }

  for (const row of cube.cells) {
    let survives = true;
    for (const dimension of Object.keys(COLUMN) as Array<Exclude<PressDimension, 'term'>>) {
      if (dimension === except) continue;
      const value = (cube[VALUES[dimension]] as string[])[row[COLUMN[dimension]] ?? -1] ?? '';
      if (!keeps(dimension, value, selection[dimension])) {
        survives = false;
        break;
      }
    }
    if (!survives) continue;
    const key = (cube[VALUES[except]] as string[])[row[COLUMN[except]] ?? -1] ?? '';
    out.set(key, (out.get(key) ?? 0) + (row[5] ?? 0));
  }
  return out;
}

/** How many articles the whole selection leaves standing. */
export function totalFor(cube: PressCube, selection: PressSelection): number {
  let total = 0;
  const termChosen = selection.term.size > 0;
  const wanted = termChosen ? termIndices(cube, selection.term) : new Set<number>();
  const rows = termChosen ? cube.termCells : cube.cells;
  const shift = termChosen ? 1 : 0;

  for (const row of rows) {
    if (termChosen && !wanted.has(row[0] ?? -1)) continue;
    let survives = true;
    for (const dimension of Object.keys(COLUMN) as Array<Exclude<PressDimension, 'term'>>) {
      const value =
        (cube[VALUES[dimension]] as string[])[row[COLUMN[dimension] + shift] ?? -1] ?? '';
      if (!keeps(dimension, value, selection[dimension])) {
        survives = false;
        break;
      }
    }
    if (survives) total += row[5 + shift] ?? 0;
  }
  return total;
}

/**
 * How many slicers the reader has actually moved off their default.
 *
 * Una dimensión cuenta una vez, lleve un valor o cinco: lo que el lector movió
 * es un filtro, y decir «4 activos» porque eligió cuatro departamentos sugiere
 * cuatro recortes distintos donde hay uno solo más ancho.
 */
export function activeCount(selection: PressSelection, search: string): number {
  let active = search.trim() ? 1 : 0;
  for (const [dimension, value] of Object.entries(selection) as Array<[PressDimension, Choice]>) {
    active += counts(value, NO_SELECTION[dimension]);
  }
  return active;
}

/**
 * The address the export and the article page are both asked for.
 *
 * Varias categorías viajan separadas por coma bajo el mismo nombre de siempre,
 * así que una dirección vieja —`tono=ALARMA`— sigue queriendo decir lo mismo.
 */
export function pressQuery(selection: PressSelection, search: string): URLSearchParams {
  const params = new URLSearchParams();
  /*
   * Una dimensión vacía no viaja, porque vacía quiere decir «todas». El tema
   * sí viaja en su valor por omisión: «sólo económicos» es un recorte real que
   * la base tiene que aplicar, y omitirlo devolvería el residuo que la portada
   * dice estar dejando fuera.
   */
  const put = (name: string, dimension: PressDimension): void => {
    const value = param(selection[dimension]);
    if (value !== undefined) params.set(name, value);
  };
  put('anio', 'year');
  put('tono', 'tone');
  put('tema', 'topic');
  put('region', 'region');
  put('medio', 'outlet');
  put('termino', 'term');
  if (search.trim()) params.set('buscar', search.trim());
  return params;
}

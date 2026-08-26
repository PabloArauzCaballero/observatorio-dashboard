import type { PressCube } from './series';

/**
 * Cross-filtering, the way a report pane does it.
 *
 * Click a bar and every other visual narrows to it — but the bar you clicked
 * keeps showing all of its own options, because a slicer that hides the
 * alternatives the moment you choose one cannot be un-chosen. So each visual is
 * counted under every selection EXCEPT its own, which is the whole rule.
 *
 * All of it runs over the cross-tabulation the page was handed: about fourteen
 * hundred rows for the corpus and twenty-four hundred for the vocabulary, so a
 * click re-counts twenty-two thousand articles in well under a frame, without
 * asking the server anything.
 */

export type PressDimension = 'year' | 'tone' | 'topic' | 'region' | 'outlet' | 'term';

export type PressSelection = Record<PressDimension, string>;

/** Every subject except the residual bucket: the observatory's own remit. */
export const ECONOMIC_TOPICS = 'ECONOMICOS';

export const NO_SELECTION: PressSelection = {
  year: 'TODOS',
  tone: 'TODOS',
  topic: ECONOMIC_TOPICS,
  region: 'TODOS',
  outlet: 'TODOS',
  term: 'TODOS',
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

/** Whether a row's value for one dimension survives that dimension's selection. */
function keeps(dimension: Exclude<PressDimension, 'term'>, value: string, chosen: string): boolean {
  if (chosen === 'TODOS') return true;
  if (dimension === 'topic' && chosen === ECONOMIC_TOPICS) return value !== 'OTROS';
  return value === chosen;
}

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
  const termChosen = selection.term !== 'TODOS';
  const termIndex = termChosen
    ? cube.terms.findIndex((entry) => entry.term === selection.term)
    : -1;

  // Counting the vocabulary itself, or counting anything under a chosen term:
  // either way the answer lives in the term rows.
  if (except === 'term' || termChosen) {
    for (const row of cube.termCells) {
      if (except !== 'term' && row[0] !== termIndex) continue;
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
  const termChosen = selection.term !== 'TODOS';
  const termIndex = termChosen
    ? cube.terms.findIndex((entry) => entry.term === selection.term)
    : -1;
  const rows = termChosen ? cube.termCells : cube.cells;
  const shift = termChosen ? 1 : 0;

  for (const row of rows) {
    if (termChosen && row[0] !== termIndex) continue;
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

/** How many slicers the reader has actually moved off their default. */
export function activeCount(selection: PressSelection, search: string): number {
  let active = search.trim() ? 1 : 0;
  for (const [dimension, value] of Object.entries(selection) as Array<[PressDimension, string]>) {
    if (value !== NO_SELECTION[dimension]) active += 1;
  }
  return active;
}

/** The address the export and the article page are both asked for. */
export function pressQuery(selection: PressSelection, search: string): URLSearchParams {
  const params = new URLSearchParams();
  if (selection.year !== 'TODOS') params.set('anio', selection.year);
  if (selection.tone !== 'TODOS') params.set('tono', selection.tone);
  if (selection.topic !== 'TODOS') params.set('tema', selection.topic);
  if (selection.region !== 'TODOS') params.set('region', selection.region);
  if (selection.outlet !== 'TODOS') params.set('medio', selection.outlet);
  if (selection.term !== 'TODOS') params.set('termino', selection.term);
  if (search.trim()) params.set('buscar', search.trim());
  return params;
}

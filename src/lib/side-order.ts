import type { DailyPoint } from './series';

/**
 * The date on which the ordering of the two published sides reverses.
 *
 * A bid and an ask cannot swap places. That this happens in the series is the
 * evidence that the two fields do not carry the meaning a Spanish
 * «compra/venta» pair would.
 *
 * Vivía en la portada, que es donde se dibujaba. Ahora el capítulo del método
 * se pide aparte —era 778 KB de la primera página para una pestaña que casi
 * nadie abre— y esta fecha viaja con él, así que el cálculo tiene que estar
 * donde los dos puedan leerlo y no dentro de una página.
 */
export function sideOrderReversal(buy: readonly DailyPoint[], sell: readonly DailyPoint[]): string | null {
  const sellByDate = new Map(sell.map((point) => [point.date, point.value]));
  const dates = [...buy].sort((left, right) => left.date.localeCompare(right.date));

  let previous: boolean | null = null;
  for (const point of dates) {
    const other = sellByDate.get(point.date);
    if (other === undefined) continue;
    const buyAbove = point.value > other;
    if (previous !== null && buyAbove !== previous) return point.date;
    previous = buyAbove;
  }
  return null;
}

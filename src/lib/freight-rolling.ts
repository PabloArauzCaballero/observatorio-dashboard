/**
 * El flete implícito de la aduana en doce meses móviles, ponderado por el peso.
 *
 * Mes a mes, un departamento que importa poco —Pando, Beni, Chuquisaca— divide el flete de dos
 * o tres embarques entre su peso, y una sola carga liviana y cara dispara la razón a miles de
 * dólares por tonelada. Dibujado así, el gráfico era una maraña de picos. Cada punto suma ahora
 * los doce meses que terminan en él: flete total (CIF menos FOB) entre toneladas totales. Es la
 * misma razón, con el denominador de un año en vez del de un mes, y no un promedio de razones.
 *
 * Puro —sin base ni React— para poder probarse con `node --test`.
 */

export interface FreightMonth {
  year: number;
  month: number;
  /** CIF menos FOB, en dólares. */
  freightUsd: number;
  kg: number;
}

/** La ventana: doce meses de calendario que terminan en el punto. */
export const WINDOW_MONTHS = 12;
/** Meses con importaciones que la ventana necesita; con menos, el punto no se dibuja. */
export const MINIMUM_IN_WINDOW = 9;
/** Toneladas que la ventana necesita: por debajo, la razón sigue siendo de un puñado de embarques. */
export const MINIMUM_TONNES = 100;

const index = (year: number, month: number): number => year * 12 + (month - 1);
const periodOf = (at: number): string =>
  `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, '0')}`;

/** `[período, US$ por tonelada]` en doce meses móviles, desde el primer mes con ventana completa. */
export function rollingFreight(months: readonly FreightMonth[]): Array<[string, number]> {
  const byMonth = new Map<number, FreightMonth>();
  for (const one of months) {
    if (!(one.kg > 0) || !(one.freightUsd >= 0)) continue;
    const at = index(one.year, one.month);
    const prior = byMonth.get(at);
    byMonth.set(
      at,
      prior
        ? { ...prior, freightUsd: prior.freightUsd + one.freightUsd, kg: prior.kg + one.kg }
        : one,
    );
  }
  if (!byMonth.size) return [];
  const all = [...byMonth.keys()].sort((a, b) => a - b);
  const first = all[0] ?? 0;
  const last = all[all.length - 1] ?? 0;
  const out: Array<[string, number]> = [];
  for (let end = first + WINDOW_MONTHS - 1; end <= last; end += 1) {
    if (!byMonth.has(end)) continue;
    let freight = 0;
    let kg = 0;
    let present = 0;
    for (let at = end - WINDOW_MONTHS + 1; at <= end; at += 1) {
      const one = byMonth.get(at);
      if (!one) continue;
      freight += one.freightUsd;
      kg += one.kg;
      present += 1;
    }
    if (present < MINIMUM_IN_WINDOW || kg / 1000 < MINIMUM_TONNES) continue;
    out.push([periodOf(end), Math.round((freight / kg) * 1000 * 100) / 100]);
  }
  return out;
}

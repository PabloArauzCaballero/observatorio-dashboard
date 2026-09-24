'use client';

import { createContext, useContext, useMemo } from 'react';

/**
 * El «desde» de la barra de filtros, para los paneles que cuelgan de ella.
 *
 * La barra de «Series de Bolivia» y la de «Social Info» se quedan en pantalla
 * cuando se abre un panel invitado —Departamentos, Energía, Recursos naturales,
 * Medio ambiente, Instituciones—, y su deslizador de años seguía moviéndose sin
 * que ninguno de esos gráficos se enterara: cada panel pide su propio tablero y
 * lo dibujaba entero. Un control que se ve vivo y no hace nada es peor que no
 * tenerlo, porque el lector cree que la figura ya está recortada.
 *
 * Viaja por contexto y no por propiedad porque el invitado es un `ReactNode`
 * que la sección arma antes de saber qué año eligió el lector. `null` es «no
 * hay barra encima», y ahí el tablero pasa sin tocar.
 */
export const YearFloor = createContext<number | null>(null);

type Dated = { year: number };

const dated = (item: unknown): item is Dated =>
  typeof item === 'object' &&
  item !== null &&
  typeof (item as { year?: unknown }).year === 'number';

const plain = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

/**
 * El tablero con cada serie anual recortada desde `from`.
 *
 * Recorre el tablero entero en vez de nombrar sus campos: los cinco tableros
 * guardan sus series como listas de `{ year, value }` a distintas
 * profundidades —por código, por lugar, por producto, por actividad—, y una
 * lista nueva que alguien agregue mañana queda recortada sin acordarse de
 * este archivo. Lo que no es lista —la última lectura de cada lugar, el año
 * de corte, las conclusiones— pasa igual: es la cifra de hoy, y el «desde»
 * dice dónde empieza la historia, no cuál es el último dato.
 */
export function sinceYear<T>(value: T, from: number): T {
  if (Array.isArray(value)) {
    const kept = value.filter((item) => !dated(item) || item.year >= from);
    return kept.map((item) => sinceYear(item, from)) as T;
  }
  if (plain(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) out[key] = sinceYear(inner, from);
    return out as T;
  }
  return value;
}

/** El tablero que el panel tiene que dibujar, según el «desde» de encima. */
export function useSinceYear<T>(board: T): T {
  const from = useContext(YearFloor);
  return useMemo(() => (from === null ? board : sinceYear(board, from)), [board, from]);
}

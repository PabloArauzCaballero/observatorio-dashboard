'use client';

import { RankRibbons, shortPersonName } from './rank-ribbons';
import type { OwnerHistory } from '@/lib/business-owners-board';

/**
 * El puesto de cada empresario año a año: las cintas de `RankRibbons` con los
 * años del calendario, porque aquí un año sin estimación sí es un hueco y corta
 * la cinta.
 */

const usd = (value: number): string =>
  `$us ${value.toLocaleString('es-BO', { maximumFractionDigits: value < 10 ? 1 : 0 })} M`;

export function OwnerRankRibbons({
  histories,
  places,
  selected,
  onSelect,
}: {
  histories: readonly OwnerHistory[];
  /** Cuántos puestos se dibujan: los que el tablero publica por año. */
  places: number;
  selected: string | null;
  onSelect: (person: string, year: number) => void;
}) {
  const years = histories.flatMap((one) => one.years.map((row) => row.year));
  if (!years.length) return null;
  const first = Math.min(...years);
  const last = Math.max(...years);
  const periods = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const byPerson = new Map(histories.map((one) => [one.person, one]));

  return (
    <RankRibbons
      series={histories.map((one) => ({
        key: one.person,
        name: one.name,
        points: one.years.map((row) => ({ period: row.year, rank: row.rank })),
      }))}
      periods={periods}
      places={places}
      selected={selected}
      onSelect={onSelect}
      shorten={shortPersonName}
      describe={(person, year) => {
        const row = byPerson.get(person)?.years.find((one) => one.year === year);
        return row
          ? [
              `de ${row.population} personas calculables`,
              `Piso contable ${usd(row.book)}`,
              `Mayor empresa: ${row.leadingHolding}`,
            ]
          : [];
      }}
      subject="empresario"
      highlight="Persona resaltada"
      others="Las demás personas"
    />
  );
}

'use client';

import { useId, useMemo } from 'react';
import { ChipsHint } from '@/components/filters';
import { Icon } from '@/components/icons';
import { additive, toggle } from '@/lib/choice';
import type { SectorKey } from '@/lib/people-types';
import { usePeople } from './people-context';
import { SECTORS, applyFilters, isFiltered, num, type Only, type SortKey } from './people-model';
import s from './people.module.css';

const ONLY: ReadonlyArray<{ key: Only; label: string }> = [
  { key: 'views', label: 'Wikipedia' },
  { key: 'social', label: 'Audiencia verificada' },
  { key: 'merco', label: 'Puesto en Merco' },
  { key: 'talk', label: 'Sentimiento medido' },
];

const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'score', label: 'Índice de atención' },
  { key: 'views', label: 'Visitas a Wikipedia' },
  { key: 'social', label: 'Audiencia verificada' },
  { key: 'merco', label: 'Puesto en Merco' },
  { key: 'name', label: 'Nombre (A–Z)' },
];

/**
 * Los filtros de la pestaña, que se cruzan entre sí y con todos los paneles.
 *
 * Cada pastilla de sector cuenta a las personas que quedarían **con los demás filtros
 * puestos**: elegir «Con sentimiento» baja «Deporte» a cero antes de pulsarlo, en vez de
 * dejar que el lector descubra una pantalla vacía. El gesto es el de todo el tablero: clic
 * elige una, Ctrl/⌘ suma otra.
 */
export function FilterBar({
  withSort = false,
  hint = true,
  compact = false,
}: {
  withSort?: boolean;
  hint?: boolean;
  /** Solo búsqueda y sector: para páginas donde el índice o las fuentes no son la pregunta. */
  compact?: boolean;
}) {
  const { rows, filters, setFilters, clearFilters, filtered } = usePeople();
  const id = useId();
  const counts = useMemo(() => {
    const base = applyFilters(rows, { ...filters, sectors: [] });
    const by = new Map<SectorKey, number>();
    for (const row of base) by.set(row.sector, (by.get(row.sector) ?? 0) + 1);
    return by;
  }, [rows, filters]);
  const active = isFiltered(filters);

  const sectorChips = (
    <div className={s.facetChips} role="group" aria-labelledby={`${id}-sector`}>
      {SECTORS.map((sector) => {
        const on = filters.sectors.includes(sector.key);
        const n = counts.get(sector.key) ?? 0;
        return (
          <button
            key={sector.key}
            type="button"
            className={on ? 'chip chip-on' : 'chip'}
            aria-pressed={on}
            disabled={n === 0 && !on}
            onClick={(event) =>
              setFilters({
                sectors: [
                  ...toggle(new Set(filters.sectors), sector.key, additive(event)),
                ] as SectorKey[],
              })
            }
          >
            {sector.label} <span className={s.chipN}>{num(n)}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={s.filters} role="group" aria-label="Filtros de personalidades">
      <div className={s.filterTop}>
        <label className={s.search}>
          <span className={s.searchIcon} aria-hidden="true">
            <Icon name="buscar" size={15} />
          </span>
          <input
            type="search"
            aria-label="Buscar por nombre"
            value={filters.query}
            placeholder="Buscar por nombre…"
            onChange={(event) => setFilters({ query: event.target.value })}
            autoComplete="off"
          />
        </label>
        {withSort ? (
          <label className={s.inlineField}>
            <span className={s.filterLabel}>Ordenar por</span>
            <select
              value={filters.sort}
              onChange={(event) => setFilters({ sort: event.target.value as SortKey })}
            >
              {SORTS.map((sort) => (
                <option key={sort.key} value={sort.key}>
                  {sort.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {compact ? null : (
          <div className={s.inlineField}>
            <label className={s.filterLabel} htmlFor={`${id}-min`}>
              Índice desde
            </label>
            <input
              id={`${id}-min`}
              className={s.range}
              type="range"
              min={0}
              max={90}
              step={5}
              value={filters.min}
              onChange={(event) =>
                setFilters({
                  min: Number(event.target.value),
                  max: Math.max(filters.max, Number(event.target.value)),
                })
              }
            />
            <output className={s.rangeOut} htmlFor={`${id}-min`}>
              {filters.min === 0 ? 'todos' : `≥ ${filters.min}`}
            </output>
          </div>
        )}
        <div className={s.filterStatus}>
          <span className={s.filterCount} aria-live="polite">
            <strong>{num(filtered.length)}</strong> de {num(rows.length)} personas
          </span>
          {active ? (
            <button type="button" className={s.clear} onClick={clearFilters}>
              Quitar filtros
            </button>
          ) : null}
        </div>
      </div>

      <div className={s.facets}>
        <span className={s.facetLabel} id={`${id}-sector`}>
          Sector
        </span>
        {sectorChips}
        {compact ? null : (
          <>
            <span className={s.facetLabel} id={`${id}-only`}>
              Solo con
            </span>
            <div className={s.facetChips} role="group" aria-labelledby={`${id}-only`}>
              {ONLY.map((item) => {
                const on = filters.only.includes(item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={on ? 'chip chip-on' : 'chip'}
                    aria-pressed={on}
                    onClick={() =>
                      setFilters({
                        only: on
                          ? filters.only.filter((key) => key !== item.key)
                          : [...filters.only, item.key],
                      })
                    }
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {compact && (filters.min > 0 || filters.only.length > 0) ? (
        <p className={s.filterAlso}>
          También activo:{' '}
          {[
            filters.min > 0 ? `índice desde ${filters.min}` : null,
            ...filters.only.map(
              (key) => `con ${ONLY.find((item) => item.key === key)?.label.toLowerCase() ?? key}`,
            ),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
      {hint ? <ChipsHint /> : null}
    </div>
  );
}

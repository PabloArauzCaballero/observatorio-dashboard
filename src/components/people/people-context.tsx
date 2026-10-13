'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { anotar, navegar } from '@/lib/enlace-tablero';
import type { PeopleSummary, PersonRow } from '@/lib/people-types';
import {
  applyFilters,
  filtersFromParams,
  filtersToParams,
  sortRows,
  type Filters,
} from './people-model';

/**
 * El estado que comparten las cinco páginas: qué se filtró y a quién se eligió.
 *
 * Vive en la sección y no en cada página porque el filtro de «Atención medible» recorta la
 * lista de «Fichas», y porque tocar a alguien en cualquier gráfico abre su ficha. Se refleja
 * en la dirección (`?sector=…&persona=…`) para que un enlace copiado lleve al mismo recorte.
 */
interface PeopleState {
  summary: PeopleSummary;
  /** Las 298 en el orden del índice. */
  rows: PersonRow[];
  bySlug: Map<string, PersonRow>;
  filters: Filters;
  setFilters: (change: Partial<Filters>) => void;
  clearFilters: () => void;
  /** Quien pasa los filtros, en el orden que se pidió. */
  filtered: PersonRow[];
  /** Quien pasa los filtros, siempre por índice (para el «las diez primeras»). */
  byIndex: PersonRow[];
  selectedSlug: string | null;
  select: (slug: string | null) => void;
  /** Elige a alguien y lleva a «Fichas». */
  openProfile: (slug: string) => void;
  updated: string;
}

const Estado = createContext<PeopleState | null>(null);

export function usePeople(): PeopleState {
  const state = useContext(Estado);
  if (!state) throw new Error('usePeople fuera de PeopleProvider');
  return state;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «2026-10-06T04:02:29Z» → «6-oct-2026», como lo escribe el pie de cada panel. */
export function fechaCorta(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return `${date.getUTCDate()}-${MESES[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

const SLUG = /^P_[A-Z0-9_]{2,80}$/u;

export function PeopleProvider({
  summary,
  children,
}: {
  summary: PeopleSummary;
  children: ReactNode;
}) {
  const params = useSearchParams();
  const pagina = params.get('pagina');
  const [filters, setAll] = useState<Filters>(() => filtersFromParams((name) => params.get(name)));
  const [selectedSlug, setSelected] = useState<string | null>(() => {
    const value = params.get('persona');
    return value && SLUG.test(value) ? value : null;
  });

  const rows = useMemo(() => [...summary.people].sort((a, b) => a.rank - b.rank), [summary]);
  const bySlug = useMemo(() => new Map(rows.map((row) => [row.slug, row])), [rows]);
  const byIndex = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const filtered = useMemo(() => sortRows(byIndex, filters.sort), [byIndex, filters.sort]);

  const setFilters = useCallback(
    (change: Partial<Filters>) => setAll((current) => ({ ...current, ...change })),
    [],
  );
  const clearFilters = useCallback(
    () =>
      setAll((current) => ({
        sectors: [],
        min: 0,
        max: 100,
        only: [],
        query: '',
        sort: current.sort,
      })),
    [],
  );
  const select = useCallback((slug: string | null) => setSelected(slug), []);
  const openProfile = useCallback((slug: string) => {
    setSelected(slug);
    navegar({ pestana: 'Personalidades', pagina: 'Fichas' });
  }, []);

  // La dirección refleja el recorte y la persona; al cambiar de página se vuelve a escribir,
  // porque el índice lateral lleva a una dirección limpia.
  useEffect(() => {
    anotar({ ...filtersToParams(filters), persona: selectedSlug });
  }, [filters, selectedSlug, pagina]);

  const state = useMemo<PeopleState>(
    () => ({
      summary,
      rows,
      bySlug,
      filters,
      setFilters,
      clearFilters,
      filtered,
      byIndex,
      selectedSlug,
      select,
      openProfile,
      updated: fechaCorta(summary.generatedAt),
    }),
    [
      summary,
      rows,
      bySlug,
      filters,
      setFilters,
      clearFilters,
      filtered,
      byIndex,
      selectedSlug,
      select,
      openProfile,
    ],
  );

  return <Estado.Provider value={state}>{children}</Estado.Provider>;
}

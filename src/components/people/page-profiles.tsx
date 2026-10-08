'use client';

import { useEffect, useRef } from 'react';
import type { PersonRow } from '@/lib/people-types';
import { FilterBar } from './filter-bar';
import { usePeople } from './people-context';
import { dec, num, sectorLabel, talkState } from './people-model';
import { Avatar, Empty } from './people-ui';
import { Profile } from './person-profile';
import s from './people.module.css';

/**
 * «Fichas»: la lista a un lado y la ficha al otro.
 *
 * En escritorio las dos columnas se ven a la vez y la lista queda fija mientras se lee la ficha.
 * En un teléfono se ve una cosa a la vez: la lista, o la ficha con su «volver». Elegir a alguien
 * en cualquier otra página de la sección lleva aquí.
 */
export function ProfilesPage() {
  const { filtered, bySlug, selectedSlug, select, clearFilters } = usePeople();
  const explicit = selectedSlug ? bySlug.get(selectedSlug) : undefined;
  const shown = explicit ?? filtered[0];

  return (
    <>
      {/* En un teléfono, con la ficha abierta los filtros estorban: se ven al volver a la lista. */}
      <div className={s.pageTop} data-view={explicit ? 'profile' : 'list'}>
        <FilterBar withSort compact hint={false} />
      </div>
      <div className={s.master} data-view={explicit ? 'profile' : 'list'}>
        <div className={s.listCol}>
          <PeopleList rows={filtered} selectedSlug={shown?.slug ?? null} onPick={select} />
        </div>
        {shown ? (
          <Profile key={shown.slug} row={shown} />
        ) : (
          <Empty
            title="Nadie coincide con estos filtros"
            action={
              <button type="button" className="chip" onClick={clearFilters}>
                Quitar filtros
              </button>
            }
          >
            Prueba con otro nombre, otro sector o menos filtros.
          </Empty>
        )}
      </div>
    </>
  );
}

function PeopleList({
  rows,
  selectedSlug,
  onPick,
}: {
  rows: readonly PersonRow[];
  selectedSlug: string | null;
  onPick: (slug: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const selectedInList = rows.some((row) => row.slug === selectedSlug);

  // Al abrir con una persona elegida desde otra página, la lista la deja a la vista.
  useEffect(() => {
    const on = box.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    on?.scrollIntoView({ block: 'nearest' });
    // Solo al cambiar de persona o de lista, no en cada pintado.
  }, [selectedSlug]);

  const move = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key) || rows.length === 0) return;
    event.preventDefault();
    const at = rows.findIndex((row) => row.slug === selectedSlug);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? rows.length - 1
          : Math.min(rows.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)));
    const target = rows[next];
    if (!target) return;
    onPick(target.slug);
    requestAnimationFrame(() =>
      box.current?.querySelector<HTMLElement>(`[data-slug="${target.slug}"]`)?.focus(),
    );
  };

  if (rows.length === 0) return <p className={s.footnote}>0 personas con estos filtros.</p>;

  return (
    <>
      <p className={s.footnote} aria-live="polite">
        {num(rows.length)} personas · flechas para recorrer la lista
      </p>
      <div
        ref={box}
        className={s.listScroll}
        role="listbox"
        aria-label="Personas"
        aria-orientation="vertical"
        onKeyDown={move}
      >
        {rows.map((row) => {
          const on = row.slug === selectedSlug;
          const tabbable = on || (!selectedInList && row.slug === rows[0]?.slug);
          const marks = [
            { on: row.components.wikipediaViews12m !== null, label: 'Wikipedia' },
            { on: row.components.verifiedFollowers !== null, label: 'audiencia verificada' },
            { on: row.components.mercoRank !== null, label: 'Merco' },
            { on: talkState(row) === 'publishable', label: 'sentimiento' },
          ];
          return (
            <button
              key={row.slug}
              type="button"
              role="option"
              aria-selected={on}
              data-slug={row.slug}
              tabIndex={tabbable ? 0 : -1}
              className={on ? `${s.opt} ${s.optOn}` : s.opt}
              onClick={() => onPick(row.slug)}
            >
              <Avatar name={row.name} on={on} />
              <span className={s.optName}>{row.name}</span>
              <span className={s.optScore}>{row.measured ? dec(row.score) : '–'}</span>
              <span className={s.optSub}>
                {sectorLabel(row.sector)}
                {row.ipsos ? ` · Ipsos ${row.ipsos}.º` : ''}
                {row.measured ? ` · puesto ${num(row.rank)}` : ' · sin medición'}
              </span>
              <span
                className={s.optMarks}
                title={`Datos: ${
                  marks
                    .filter((m) => m.on)
                    .map((m) => m.label)
                    .join(', ') || 'ninguno'
                }`}
                aria-hidden="true"
              >
                {marks.map((mark) => (
                  <i key={mark.label} className={mark.on ? `${s.mark} ${s.markOn}` : s.mark} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

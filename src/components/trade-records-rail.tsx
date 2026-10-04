'use client';

import { useEffect, useState } from 'react';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import type { IconName } from './icons';
import { additive, list } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import type { TradeCodes } from '@/lib/trade-records';
import type { FilterKey } from '@/lib/trade-records-query';
import { sentenced, titled } from '@/lib/trade-text';

/**
 * El carril de filtros de «Detalle aduanero».
 *
 * Cada lista es una disyunción (Ctrl/⌘ suma) y todas se cruzan entre sí. El
 * producto se busca por nombre o por código —«litio», «2836», «quinua»—
 * porque la NANDINA tiene ocho mil partidas y ninguna lista las cabe.
 */

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const KINDS = [
  { code: '1', name: 'Exportaciones' },
  { code: '2', name: 'Reexportaciones' },
  { code: '3', name: 'Efectos personales' },
];

const FILTER_ICON: Record<FilterKey, IconName> = {
  product: 'cajas',
  section: 'capas',
  country: 'globo',
  department: 'mapa',
  activity: 'fabrica',
  traditional: 'etiqueta',
  use: 'etiqueta',
  kind: 'camion',
};

type Pick = (key: FilterKey, values: readonly string[], add: boolean, label?: string) => void;

function Items({
  entries,
  chosen,
  onPick,
  icon,
  cut = 9,
}: {
  entries: ReadonlyArray<{ code: string; name: string }>;
  chosen: Choice;
  onPick: (code: string, add: boolean, name: string) => void;
  icon: IconName;
  cut?: number;
}) {
  return (
    <div className={entries.length > cut ? 'rail-list rail-list-cut' : 'rail-list'}>
      {entries.map((entry) => {
        const on = chosen.has(entry.code);
        return (
          <button
            key={entry.code}
            type="button"
            className={on ? 'rail-item rail-item-on' : 'rail-item'}
            aria-pressed={on}
            onClick={(event) => onPick(entry.code, additive(event), entry.name)}
          >
            <Icon name={icon} size={16} />
            <span className="rail-name">{entry.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TradeRail({
  catalogue,
  flow,
  onFlow,
  bounds,
  from,
  to,
  onYears,
  sameMonths,
  onSameMonths,
  filters,
  names,
  onPick,
  onRemove,
  onClear,
}: {
  catalogue: TradeCodes;
  flow: 'X' | 'M';
  onFlow: (flow: 'X' | 'M') => void;
  bounds: { first: number; last: number; lastMonth: number };
  from: number;
  to: number;
  onYears: (from: number, to: number) => void;
  sameMonths: boolean;
  onSameMonths: (on: boolean) => void;
  filters: Record<FilterKey, Choice>;
  names: Record<string, string>;
  onPick: Pick;
  onRemove: (key: FilterKey, code: string) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<Array<{ code: string; name: string }>>([]);
  const [countryText, setCountryText] = useState('');

  useEffect(() => {
    const text = search.trim();
    if (text.length < 2) {
      setFound([]);
      return;
    }
    const control = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/comercio-exterior/aduana/catalogo?buscar=${encodeURIComponent(text)}`, {
        signal: control.signal,
      })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error('buscar'))))
        .then((body: { products: Array<{ code: string; name: string }> }) =>
          setFound(body.products),
        )
        .catch(() => undefined);
    }, 280);
    return () => {
      clearTimeout(timer);
      control.abort();
    };
  }, [search]);

  const codes = (dimension: string, tidy: (text: string) => string = titled) =>
    (catalogue.codes[dimension] ?? []).map((entry) => ({
      code: entry.code,
      name: tidy(entry.name),
      parent: entry.parent,
    }));
  const countries = codes('COUNTRY')
    .filter((entry) => !countryText || entry.name.toLowerCase().includes(countryText.toLowerCase()))
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));
  const sectionName = new Map(codes('SECTION', sentenced).map((entry) => [entry.code, entry.name]));
  const labelOf = (key: FilterKey, code: string): string => {
    const known = names[`${key}:${code}`];
    if (known) return known;
    const dimension: Partial<Record<FilterKey, string>> = {
      section: 'SECTION',
      country: 'COUNTRY',
      department: 'DEPARTMENT',
      activity: 'ACTIVITY',
      traditional: 'TRADITIONAL',
      use: 'USE',
    };
    const table = dimension[key];
    if (table) return codes(table).find((entry) => entry.code === code)?.name ?? code;
    if (key === 'kind') return KINDS.find((entry) => entry.code === code)?.name ?? code;
    return code.length === 2 ? `Capítulo ${code}` : `Partida ${code}`;
  };
  const active = (Object.keys(filters) as FilterKey[]).flatMap((key) =>
    list(filters[key]).map((code) => ({ key, code })),
  );

  return (
    <aside className="rail" id="aduana-filtros">
      <div className="rail-top">
        <Icon name="filtro" size={15} />
        <span className="rail-title">Filtros</span>
        <span className="rail-count">
          {active.length
            ? `${active.length} activo${active.length === 1 ? '' : 's'}`
            : 'sin filtro'}
        </span>
      </div>
      <FilterHint>Recortan todos los gráficos a la vez.</FilterHint>

      <div className="rail-sec">
        <div className="rail-head">
          <Icon name="balanza" size={13} />
          Flujo
        </div>
        <div className="rail-pills">
          {(['X', 'M'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={flow === option ? 'chip chip-on' : 'chip'}
              aria-pressed={flow === option}
              onClick={() => onFlow(option)}
            >
              {option === 'X' ? 'Exportaciones' : 'Importaciones'}
            </button>
          ))}
        </div>
      </div>

      {active.length ? (
        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="capas" size={13} />
            Selección activa
          </div>
          <div className="rail-pills">
            {active.map(({ key, code }) => (
              <button
                key={`${key}-${code}`}
                type="button"
                className="chip chip-on chip-wide"
                onClick={() => onRemove(key, code)}
                title="Quitar del filtro"
              >
                <Icon name={FILTER_ICON[key]} size={12} />
                <span className="chip-text">{labelOf(key, code)}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" className="chip" onClick={onClear}>
              Limpiar todo
            </button>
          </div>
        </div>
      ) : null}

      <div className="rail-sec">
        <div className="rail-head">
          <Icon name="calendario" size={13} />
          Años: {from}-{to}
        </div>
        <div className="rail-field">
          <input
            type="range"
            aria-label={`Desde qué año: ${from}`}
            min={bounds.first}
            max={to}
            value={from}
            onChange={(event) => onYears(Math.min(Number(event.target.value), to), to)}
          />
        </div>
        <div className="rail-field rail-field-next">
          <input
            type="range"
            aria-label={`Hasta qué año: ${to}`}
            min={from}
            max={bounds.last}
            value={to}
            onChange={(event) => onYears(from, Math.max(Number(event.target.value), from))}
          />
        </div>
        {bounds.lastMonth < 12 ? (
          <label className="rail-hint rail-check">
            <input
              type="checkbox"
              checked={sameMonths}
              onChange={(event) => onSameMonths(event.target.checked)}
            />
            Mismo periodo de cada año (enero-{MONTHS[bounds.lastMonth - 1]}), para comparar{' '}
            {bounds.last} con los anteriores
          </label>
        ) : null}
      </div>

      <div className="rail-sec">
        <div className="rail-head">
          <Icon name="buscar" size={13} />
          Buscar producto (nombre o código)
          <PickedCount choice={filters.product} />
        </div>
        <div className="rail-field">
          <input
            type="search"
            value={search}
            aria-label="Buscar una partida por nombre o código NANDINA"
            placeholder="litio, quinua, 2836, soya…"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {found.length ? (
          <Items
            entries={found.map((entry) => ({
              code: entry.code,
              name: `${entry.code} · ${entry.name}`,
            }))}
            chosen={filters.product}
            onPick={(code, add, name) => onPick('product', [code], add, name)}
            icon="cajas"
          />
        ) : search.trim().length >= 2 ? (
          <p className="rail-hint">Sin partidas con ese nombre o código.</p>
        ) : null}
      </div>

      <div className="rail-sec">
        <div className="rail-head">
          <Icon name="capas" size={13} />
          Sección del arancel
          <PickedCount choice={filters.section} />
        </div>
        <Items
          entries={codes('SECTION').map((entry) => ({
            code: entry.code,
            name: `${entry.code} · ${sectionName.get(entry.code) ?? ''}`,
          }))}
          chosen={filters.section}
          onPick={(code, add, name) => onPick('section', [code], add, name)}
          icon="capas"
        />
      </div>

      <div className="rail-sec">
        <div className="rail-head">
          <Icon name="globo" size={13} />
          País de {flow === 'X' ? 'destino' : 'origen'}
          <PickedCount choice={filters.country} />
        </div>
        <div className="rail-field">
          <input
            type="search"
            value={countryText}
            aria-label="Buscar un país"
            placeholder="China, Brasil…"
            onChange={(event) => setCountryText(event.target.value)}
          />
        </div>
        <Items
          entries={countries}
          chosen={filters.country}
          onPick={(code, add, name) => onPick('country', [code], add, name)}
          icon="globo"
        />
      </div>

      <div className="rail-sec">
        <div className="rail-head">
          <Icon name="mapa" size={13} />
          Departamento de {flow === 'X' ? 'origen' : 'destino'}
          <PickedCount choice={filters.department} />
        </div>
        <Items
          entries={codes('DEPARTMENT').sort(
            (left, right) => Number(left.code) - Number(right.code),
          )}
          chosen={filters.department}
          onPick={(code, add, name) => onPick('department', [code], add, name)}
          icon="mapa"
          cut={12}
        />
      </div>

      {flow === 'X' ? (
        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="camion" size={13} />
            Tipo de flujo
            <PickedCount choice={filters.kind} />
          </div>
          <Items
            entries={KINDS}
            chosen={filters.kind}
            onPick={(code, add, name) => onPick('kind', [code], add, name)}
            icon="camion"
          />
        </div>
      ) : (
        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="etiqueta" size={13} />
            Uso o destino económico (CUODE)
            <PickedCount choice={filters.use} />
          </div>
          <Items
            entries={codes('USE', sentenced)}
            chosen={filters.use}
            onPick={(code, add, name) => onPick('use', [code], add, name)}
            icon="etiqueta"
          />
        </div>
      )}
    </aside>
  );
}

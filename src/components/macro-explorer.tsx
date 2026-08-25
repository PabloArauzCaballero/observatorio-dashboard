'use client';

import { useMemo, useState } from 'react';
import { MacroChart } from './charts';
import type { MacroPoint } from '@/lib/series';

/**
 * The macroeconomic panel, filtered the way an analyst actually narrows a set.
 *
 * Eighty-six series is more than anyone reads at once, so the panel starts by
 * asking what the reader is looking at rather than showing everything. Three
 * slicers compose: sector, period, and a search over names. Each one narrows
 * what the others offer, so a combination that would return nothing cannot be
 * assembled — the same behaviour a cross-filtered report has, and the reason it
 * feels like exploring rather than guessing.
 *
 * The download follows the selection. Offering a filtered view and then a file
 * of everything is the quickest way to make a reader distrust both.
 */

const SECTOR_LABEL: Record<string, string> = {
  ACTIVIDAD: 'Actividad',
  SECTORIAL: 'Sectorial',
  RECURSOS: 'Recursos naturales',
  EXTERNO: 'Sector externo',
  PRECIOS: 'Precios',
  MONETARIO: 'Monetario y financiero',
  DEUDA: 'Deuda externa',
  SOCIAL: 'Social y laboral',
  OTROS: 'Otros',
};

const SECTOR_TONE: Record<string, string> = {
  ACTIVIDAD: 'var(--official)',
  SECTORIAL: 'var(--gap)',
  RECURSOS: 'var(--parallel)',
  EXTERNO: 'var(--official)',
  PRECIOS: 'var(--parallel)',
  MONETARIO: 'var(--gap)',
  DEUDA: 'var(--up)',
  SOCIAL: 'var(--down)',
  OTROS: 'var(--ink-soft)',
};

const UNIT_LABEL: Record<string, string> = {
  PERCENT: '%',
  PERCENT_OF_GDP: '% del PIB',
  USD: 'USD',
  INDEX: 'índice',
  MONTHS: 'meses',
  PEOPLE: 'personas',
  YEARS: 'años',
};

const number = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

function headline(point: MacroPoint): string {
  if (point.unit === 'USD') {
    const billions = point.value / 1_000_000_000;
    return Math.abs(billions) >= 1
      ? `${number(billions, 2)} mil M`
      : `${number(point.value / 1_000_000, 0)} M`;
  }
  if (point.unit === 'PEOPLE') return `${number(point.value / 1_000_000, 2)} M`;
  return number(point.value, 2);
}

export function MacroExplorer({ points }: { points: MacroPoint[] }) {
  const [sector, setSector] = useState<string>('TODOS');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState<number>(1990);

  const years = useMemo(() => points.map((point) => Number(point.period)), [points]);
  const minYear = years.length ? Math.min(...years) : 1960;
  const maxYear = years.length ? Math.max(...years) : 2025;

  const sectors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const point of points) {
      const codes = counts.get(point.sector) ?? 0;
      counts.set(point.sector, codes);
    }
    for (const sectorKey of counts.keys()) {
      counts.set(
        sectorKey,
        new Set(
          points.filter((point) => point.sector === sectorKey).map((point) => point.indicatorCode),
        ).size,
      );
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [points]);

  /** The selection, applied once and reused by the cards and the download. */
  const selected = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return points.filter(
      (point) =>
        (sector === 'TODOS' || point.sector === sector) &&
        Number(point.period) >= from &&
        (!term ||
          (point.name ?? '').toLocaleLowerCase('es').includes(term) ||
          point.indicatorCode.toLocaleLowerCase('es').includes(term)),
    );
  }, [points, sector, search, from]);

  /** Latest published year of each indicator that survived the filter. */
  const cards = useMemo(() => {
    const latest = new Map<string, MacroPoint>();
    for (const point of selected) {
      const current = latest.get(point.indicatorCode);
      if (!current || point.period > current.period) latest.set(point.indicatorCode, point);
    }
    return [...latest.values()].sort((left, right) =>
      (left.name ?? left.indicatorCode).localeCompare(right.name ?? right.indicatorCode),
    );
  }, [selected]);

  const query = new URLSearchParams({
    dataset: 'macro',
    ...(sector === 'TODOS' ? {} : { sector }),
    desde: String(from),
    ...(search.trim() ? { buscar: search.trim() } : {}),
  });

  return (
    <>
      <div className="slicers">
        <div className="slicer">
          <span className="slicer-label">Rubro</span>
          <div className="chips">
            <button
              type="button"
              className={sector === 'TODOS' ? 'chip chip-on' : 'chip'}
              onClick={() => setSector('TODOS')}
            >
              Todos
              <em>{new Set(points.map((point) => point.indicatorCode)).size}</em>
            </button>
            {sectors.map(([key, count]) => (
              <button
                key={key}
                type="button"
                className={sector === key ? 'chip chip-on' : 'chip'}
                onClick={() => setSector(sector === key ? 'TODOS' : key)}
              >
                {SECTOR_LABEL[key] ?? key}
                <em>{count}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="slicer-row">
          <label className="slicer">
            <span className="slicer-label">Desde</span>
            <input
              type="range"
              min={minYear}
              max={maxYear - 1}
              value={from}
              onChange={(event) => setFrom(Number(event.target.value))}
            />
            <output>{from}</output>
          </label>

          <label className="slicer slicer-grow">
            <span className="slicer-label">Buscar indicador</span>
            <input
              type="search"
              value={search}
              placeholder="inflación, reservas, gas…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="slicer-foot">
          <span>
            {cards.length} indicador{cards.length === 1 ? '' : 'es'} ·{' '}
            {selected.length.toLocaleString('es-BO')} observaciones desde {from}
          </span>
          <div className="download">
            <span className="download-label">Descargar la selección</span>
            <a className="download-btn" href={`/api/export?${query.toString()}&format=csv`}>
              CSV
            </a>
            <a className="download-btn" href={`/api/export?${query.toString()}&format=json`}>
              JSON
            </a>
          </div>
        </div>
      </div>

      {cards.length ? (
        <div className="card-grid">
          {cards.map((point) => (
            <article className="card" key={point.indicatorCode}>
              <header className="card-head">
                <span className="card-sector">{SECTOR_LABEL[point.sector] ?? point.sector}</span>
                <h3>{point.name ?? point.indicatorCode}</h3>
                <div className="card-figure">
                  <span className="card-value">{headline(point)}</span>
                  <span className="card-unit">{UNIT_LABEL[point.unit] ?? point.unit}</span>
                </div>
                <div className="card-meta">
                  <span>{point.period}</span>
                  {point.changePercent === null ? null : (
                    <span className={point.changePercent >= 0 ? 'delta-up' : 'delta-down'}>
                      {point.changePercent > 0 ? '+' : ''}
                      {number(point.changePercent)} % anual
                    </span>
                  )}
                </div>
              </header>
              <MacroChart
                data={selected
                  .filter((row) => row.indicatorCode === point.indicatorCode)
                  .map((row) => ({ period: row.period, value: row.value }))}
                unit={point.unit}
                tone={SECTOR_TONE[point.sector] ?? 'var(--ink-soft)'}
              />
            </article>
          ))}
        </div>
      ) : (
        <div className="callout">Ningún indicador coincide con esta selección.</div>
      )}
    </>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { MacroChart } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { MacroPoint } from '@/lib/series';

/**
 * The macroeconomic panel, filtered the way a report pane is.
 *
 * Eighty-six series is more than anyone reads at once, so the panel starts by
 * asking what the reader is looking at rather than showing everything. The
 * slicers are docked to the side instead of stacked above the cards: a pane
 * that scrolls away from what it is filtering stops being a control, and the
 * stacked version pushed every card below the fold.
 *
 * Three slicers compose: sector, period, and a search over names. Each one
 * narrows what the others offer, so a combination that would return nothing
 * cannot be assembled.
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

const SECTOR_ICON: Record<string, IconName> = {
  ACTIVIDAD: 'tendencia',
  SECTORIAL: 'cajas',
  RECURSOS: 'hoja',
  EXTERNO: 'globo',
  PRECIOS: 'etiqueta',
  MONETARIO: 'monedas',
  DEUDA: 'balanza',
  SOCIAL: 'personas',
  OTROS: 'cajas',
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
    const counts = new Map<string, Set<string>>();
    for (const point of points) {
      const codes = counts.get(point.sector) ?? new Set<string>();
      codes.add(point.indicatorCode);
      counts.set(point.sector, codes);
    }
    return [...counts.entries()]
      .map(([key, codes]): [string, number] => [key, codes.size])
      .sort((left, right) => right[1] - left[1]);
  }, [points]);

  const total = useMemo(() => new Set(points.map((point) => point.indicatorCode)).size, [points]);

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

  const active = (sector === 'TODOS' ? 0 : 1) + (search.trim() ? 1 : 0) + (from > minYear ? 1 : 0);
  const query = new URLSearchParams({
    dataset: 'macro',
    ...(sector === 'TODOS' ? {} : { sector }),
    desde: String(from),
    ...(search.trim() ? { buscar: search.trim() } : {}),
  });

  return (
    <div className="workspace">
      <aside className="rail">
        <div className="rail-top">
          <Icon name="filtro" size={15} />
          <span className="rail-title">Filtros</span>
          <span className="rail-count">{active ? `${active} activos` : 'sin filtro'}</span>
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="cajas" size={13} />
            Rubro
          </div>
          <button
            type="button"
            className={sector === 'TODOS' ? 'rail-item rail-item-on' : 'rail-item'}
            onClick={() => setSector('TODOS')}
          >
            <Icon name="cajas" size={16} />
            <span className="rail-name">Todos los rubros</span>
            <span className="rail-n">{total}</span>
          </button>
          {sectors.map(([key, count]) => (
            <button
              key={key}
              type="button"
              className={sector === key ? 'rail-item rail-item-on' : 'rail-item'}
              onClick={() => setSector(sector === key ? 'TODOS' : key)}
            >
              <Icon name={SECTOR_ICON[key] ?? 'cajas'} size={16} />
              <span className="rail-name">{SECTOR_LABEL[key] ?? key}</span>
              <span className="rail-n">{count}</span>
            </button>
          ))}
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="calendario" size={13} />
            Desde {from}
          </div>
          <div className="rail-field">
            <input
              type="range"
              min={minYear}
              max={maxYear - 1}
              value={from}
              onChange={(event) => setFrom(Number(event.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="rail-pills" style={{ marginTop: '0.4rem' }}>
            {[minYear, 1990, 2010, 2020].map((year) => (
              <button
                key={year}
                type="button"
                className={from === year ? 'chip chip-on' : 'chip'}
                onClick={() => setFrom(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="buscar" size={13} />
            Buscar indicador
          </div>
          <div className="rail-field">
            <input
              type="search"
              value={search}
              placeholder="inflación, reservas, gas…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="rail-foot">
          Selección: <b>{cards.length}</b> de <b>{total}</b> indicadores
          <br />
          <b>{selected.length.toLocaleString('es-BO')}</b> observaciones anuales
          <br />
          Desde <b>{from}</b>
        </div>
      </aside>

      <div className="workspace-main">
        <div className="briefcard">
          <span className="briefcard-mark">
            <Icon name="globo" size={20} />
          </span>
          <div>
            <h2>Contexto macroeconómico</h2>
            <p>
              Ochenta y seis series anuales del Banco Mundial, desde 1960 y hasta el último año
              publicado. Elegí un rubro a la izquierda: las tarjetas, el conteo y la descarga siguen
              esa selección.
            </p>
            <div className="brief-points">
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="balanza" size={17} />
                </span>
                <div>
                  <b>Deuda por acreedor</b>
                  <span>14 series: BM, BIRF, AIF, plazo y servicio</span>
                </div>
              </div>
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="reloj" size={17} />
                </span>
                <div>
                  <b>Desde 1960</b>
                  <span>toda la historia que publica la fuente</span>
                </div>
              </div>
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="descarga" size={17} />
                </span>
                <div>
                  <b>CSV con el filtro</b>
                  <span>se descarga lo que estás viendo</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="strap">
          <Icon name={SECTOR_ICON[sector] ?? 'cajas'} size={17} />
          <h2>{sector === 'TODOS' ? 'Todos los rubros' : (SECTOR_LABEL[sector] ?? sector)}</h2>
          <span className="tile-hint">
            {cards.length} indicador{cards.length === 1 ? '' : 'es'}
          </span>
          <div className="download">
            <a className="download-btn" href={`/api/export?${query.toString()}&format=csv`}>
              CSV
            </a>
            <a className="download-btn" href={`/api/export?${query.toString()}&format=json`}>
              JSON
            </a>
          </div>
        </div>

        {cards.length ? (
          <div className="card-grid">
            {cards.map((point) => (
              <article className="card" key={point.indicatorCode}>
                <header className="card-head">
                  <span className="card-sector">
                    <Icon name={SECTOR_ICON[point.sector] ?? 'cajas'} size={12} />{' '}
                    {SECTOR_LABEL[point.sector] ?? point.sector}
                  </span>
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
      </div>
    </div>
  );
}

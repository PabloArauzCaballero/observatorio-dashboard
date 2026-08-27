'use client';

import { useMemo, useState } from 'react';
import { MacroChart, YearCandles } from './charts';
import type { CandlePoint } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import { GLOSSARY, UNIT_MEANING } from '@/lib/indicator-glossary';
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
  CAMBIARIO: 'Tipo de cambio',
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
  CAMBIARIO: 'balanza',
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
  CAMBIARIO: 'var(--parallel)',
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
  /**
   * Cards or table.
   *
   * A card is how you read one indicator; a table is how you compare eighty.
   * The reader asking "what did every debt series do last year" cannot get that
   * from eighty little charts, and the answer is not to hide the filters to
   * make room — it is to lay the same selection out as rows.
   */
  const [asTable, setAsTable] = useState(false);
  const [sector, setSector] = useState<string>('TODOS');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState<number>(1990);

  const years = useMemo(() => points.map((point) => Number(point.period)), [points]);
  const minYear = years.length ? Math.min(...years) : 1960;
  const maxYear = years.length ? Math.max(...years) : 2025;

  /** Whether a reading survives every slicer but the one being counted. */
  const matches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return (point: MacroPoint, except: 'sector' | null): boolean =>
      (except === 'sector' || sector === 'TODOS' || point.sector === sector) &&
      Number(point.period) >= from &&
      (!term ||
        (point.name ?? '').toLocaleLowerCase('es').includes(term) ||
        point.indicatorCode.toLocaleLowerCase('es').includes(term));
  }, [sector, search, from]);

  /**
   * Industries counted under the search and the period, never under themselves.
   *
   * Counting them over the whole catalogue instead left the pane offering
   * "Sectorial 20" while a search for «reservas» had narrowed the panel to two
   * series — a number that describes nothing the reader is looking at, and that
   * sends them clicking into an empty result.
   */
  const sectors = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    for (const point of points) {
      if (!matches(point, 'sector')) continue;
      const codes = counts.get(point.sector) ?? new Set<string>();
      codes.add(point.indicatorCode);
      counts.set(point.sector, codes);
    }
    return [...counts.entries()]
      .map(([key, codes]): [string, number] => [key, codes.size])
      .sort((left, right) => right[1] - left[1]);
  }, [points, matches]);

  /** How many series the other slicers leave standing, whatever industry is on. */
  const total = useMemo(
    () =>
      new Set(
        points.filter((point) => matches(point, 'sector')).map((point) => point.indicatorCode),
      ).size,
    [points, matches],
  );

  /** How many the catalogue holds at all, so the pane can say "of". */
  const catalogue = useMemo(
    () => new Set(points.map((point) => point.indicatorCode)).size,
    [points],
  );

  /** The selection, applied once and reused by the cards and the download. */
  const selected = useMemo(() => points.filter((point) => matches(point, null)), [points, matches]);

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
          <span className="rail-count">
            {active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}
          </span>
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
              aria-label={`Año desde el que se muestran los indicadores: ${from}`}
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
              aria-label="Buscar un indicador por nombre o código"
              placeholder="inflación, reservas, gas…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="rail-foot">
          Selección: <b>{cards.length}</b> de <b>{catalogue}</b> indicadores
          <br />
          <b>{selected.length.toLocaleString('es-BO')}</b> observaciones anuales
          <br />
          Desde <b>{from}</b>
        </div>
      </aside>

      <div className="workspace-main" id="tablero" tabIndex={-1}>
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
            <button
              type="button"
              className={asTable ? 'download-btn' : 'download-btn download-btn-on'}
              onClick={() => setAsTable(false)}
              aria-pressed={!asTable}
            >
              <Icon name="cajas" size={13} /> Tarjetas
            </button>
            <button
              type="button"
              className={asTable ? 'download-btn download-btn-on' : 'download-btn'}
              onClick={() => setAsTable(true)}
              aria-pressed={asTable}
            >
              <Icon name="barras" size={13} /> Tabla
            </button>
            <a className="download-btn" href={`/api/export?${query.toString()}&format=csv`}>
              CSV
            </a>
            <a className="download-btn" href={`/api/export?${query.toString()}&format=json`}>
              JSON
            </a>
          </div>
        </div>

        {cards.length && asTable ? <MacroTable rows={cards} series={selected} /> : null}

        {cards.length && !asTable ? (
          <div className="card-grid">
            {cards.map((point) => (
              <MacroCard
                key={point.indicatorCode}
                point={point}
                series={selected.filter((row) => row.indicatorCode === point.indicatorCode)}
              />
            ))}
          </div>
        ) : null}

        {cards.length ? null : (
          <div className="callout">Ningún indicador coincide con esta selección.</div>
        )}
      </div>
    </div>
  );
}

/**
 * One indicator, read either as a level or as a year's change.
 *
 * The line answers "where is this number now"; the candles answer "what did
 * each year do to it", which for an annual series is usually the actual
 * question — a debt stock that rose every year for a decade looks like a smooth
 * climb on a line and like ten red bodies here. The toggle sits in the card's
 * top corner and is per card, because a reader comparing two indicators wants
 * one of them in each reading, not both in the same one.
 */
function MacroCard({ point, series }: { point: MacroPoint; series: MacroPoint[] }) {
  const [candles, setCandles] = useState(false);
  /** Whether the reader has asked what this indicator actually measures. */
  const [explained, setExplained] = useState(false);
  const definition = GLOSSARY[point.indicatorCode];
  const tone = SECTOR_TONE[point.sector] ?? 'var(--ink-soft)';

  /** A candle per year: it opens at the year before and closes at this one. */
  const ohlc = useMemo((): CandlePoint[] => {
    const ordered = [...series].sort((left, right) => left.period.localeCompare(right.period));
    const out: CandlePoint[] = [];
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (!previous || !current) continue;
      out.push({ period: current.period, open: previous.value, close: current.value });
    }
    return out;
  }, [series]);

  return (
    <article className="card">
      <header className="card-head">
        <span className="card-sector">
          <Icon name={SECTOR_ICON[point.sector] ?? 'cajas'} size={12} />{' '}
          {SECTOR_LABEL[point.sector] ?? point.sector}
        </span>
        <span className="card-tools">
          <button
            type="button"
            className={explained ? 'card-toggle card-toggle-on' : 'card-toggle'}
            onClick={() => setExplained(!explained)}
            title={explained ? 'Ocultar la explicación' : '¿Qué mide este indicador?'}
            aria-pressed={explained}
          >
            <Icon name="info" size={16} />
          </button>
          <button
            type="button"
            className={candles ? 'card-toggle card-toggle-on' : 'card-toggle'}
            onClick={() => setCandles(!candles)}
            title={candles ? 'Ver la serie como línea' : 'Ver la variación interanual en velas'}
            aria-pressed={candles}
          >
            <Icon name={candles ? 'linea' : 'velas'} size={16} />
          </button>
        </span>
        <h3>{point.name ?? point.indicatorCode}</h3>
        <div className="card-figure">
          <span className="card-value">{headline(point)}</span>
          <span className="card-unit">{UNIT_LABEL[point.unit] ?? point.unit}</span>
        </div>
        <div className="card-meta">
          <span>{candles ? `${ohlc.length} variaciones anuales` : point.period}</span>
          {point.changePercent === null ? null : (
            <span className={point.changePercent >= 0 ? 'delta-up' : 'delta-down'}>
              {point.changePercent > 0 ? '+' : ''}
              {number(point.changePercent)} % anual
            </span>
          )}
        </div>
      </header>
      {explained ? (
        <div className="card-note">
          {definition ? (
            <>
              <p>
                <b>Qué mide.</b> {definition.what}
              </p>
              <p>
                <b>Cómo leerlo.</b> {definition.howToRead}
              </p>
              {definition.caveat ? (
                <p className="card-note-caveat">
                  <Icon name="info" size={12} /> {definition.caveat}
                </p>
              ) : null}
            </>
          ) : (
            <p>
              El observatorio no escribió una definición propia para esta serie. La publica{' '}
              <b>{point.publisher ?? 'la fuente citada'}</b> bajo el nombre{' '}
              <b>{point.name ?? point.indicatorCode}</b>, y se mide en{' '}
              {UNIT_MEANING[point.unit] ?? UNIT_LABEL[point.unit] ?? point.unit}. Preferimos admitir
              el hueco antes que redactar una explicación que nadie verificó.
            </p>
          )}
          <p className="card-note-source">
            <code>{point.indicatorCode}</code> ·{' '}
            {UNIT_MEANING[point.unit] ?? UNIT_LABEL[point.unit] ?? point.unit}
            {point.sourceUrl ? (
              <>
                {' · '}
                <a href={point.sourceUrl} target="_blank" rel="noreferrer noopener">
                  ver la fuente
                </a>
              </>
            ) : null}
          </p>
        </div>
      ) : null}
      {candles ? (
        <YearCandles data={ohlc} unit={UNIT_LABEL[point.unit] ?? point.unit} />
      ) : (
        <MacroChart
          data={series.map((row) => ({ period: row.period, value: row.value }))}
          unit={point.unit}
          tone={tone}
        />
      )}
    </article>
  );
}

/**
 * The same selection laid out as rows.
 *
 * Every column is a fact the cards already show, put where it can be compared
 * down the page instead of hunted across eighty tiles: what the series
 * measures, its industry, the last year published, the figure, what it moved,
 * and how much history there is behind it. The figures are right-aligned and
 * tabular so the digits line up, which is the only reason a table beats a grid.
 *
 * It scrolls inside its own box, so the page never scrolls sideways and the
 * filter pane stays where it is — a reader comparing rows still needs to be
 * able to change what is in them.
 */
function MacroTable({ rows, series }: { rows: MacroPoint[]; series: MacroPoint[] }) {
  const history = new Map<string, { first: string; last: string; count: number }>();
  for (const point of series) {
    const held = history.get(point.indicatorCode);
    if (!held) {
      history.set(point.indicatorCode, { first: point.period, last: point.period, count: 1 });
      continue;
    }
    held.count += 1;
    if (point.period < held.first) held.first = point.period;
    if (point.period > held.last) held.last = point.period;
  }

  return (
    <div className="table-wrap">
      <table className="grid-table">
        <thead>
          <tr>
            <th>Indicador</th>
            <th>Rubro</th>
            <th>Último año</th>
            <th className="num">Valor</th>
            <th>Unidad</th>
            <th className="num">Var. anual</th>
            <th className="num">Años</th>
            <th>Desde → hasta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((point) => {
            const span = history.get(point.indicatorCode);
            return (
              <tr key={point.indicatorCode}>
                <td>
                  <span className="cell-name">{point.name ?? point.indicatorCode}</span>
                  <code className="cell-code">{point.indicatorCode}</code>
                </td>
                <td>{SECTOR_LABEL[point.sector] ?? point.sector}</td>
                <td className="num">{point.period}</td>
                <td className="num">{headline(point)}</td>
                <td>{UNIT_LABEL[point.unit] ?? point.unit}</td>
                <td className="num">
                  {point.changePercent === null ? (
                    '—'
                  ) : (
                    <span className={point.changePercent >= 0 ? 'delta-up' : 'delta-down'}>
                      {point.changePercent > 0 ? '+' : ''}
                      {number(point.changePercent)} %
                    </span>
                  )}
                </td>
                <td className="num">{span?.count ?? 0}</td>
                <td className="num">{span ? `${span.first} → ${span.last}` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              {rows.length} indicador{rows.length === 1 ? '' : 'es'}
            </td>
            <td colSpan={5} className="num">
              {series.length.toLocaleString('es-BO')} observaciones anuales en la selección
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

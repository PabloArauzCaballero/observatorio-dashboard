'use client';

import { useEffect, useMemo, useState } from 'react';
import { WorldLines } from './charts';
import type { WorldLinePoint, WorldLineSeries } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import { Pager } from './pager';
import { DEFINITION_AUTHOR } from '@/lib/indicator-glossary';
import type { WorldPoint } from '@/lib/series';
import {
  BOLIVIA,
  PLACE_LABEL,
  THEME_LABEL,
  WORLD,
  WORLD_INDICATORS,
  WORLD_PLACES,
  sayWorldFigure,
  sayWorldTick,
} from '@/lib/world-board';
import type { WorldIndicator, WorldTheme } from '@/lib/world-board';

/**
 * How the world economy is doing, with Bolivia beside it.
 *
 * The panel this replaces opened one World Bank series at a time for Bolivia
 * and thirty economies, which answers "how does Bolivia compare with Chile" and
 * leaves the question a reader of this tab actually brings unanswered: what is
 * happening in the world. The board answers that first — the world's own
 * figure for growth, prices, trade, work, what economies produce and how people
 * live — and puts the region and Bolivia on the same axis, so where Bolivia
 * sits is read off the chart rather than worked out.
 *
 * The filters are docked on the left like everywhere else in the report. The
 * region is a comparison and not a filter: every card always draws the world
 * and Bolivia, and the region chosen is the third line.
 */

const PAGE_SIZE = 20;
const DEFAULT_REGION = 'LCN';
const DEFAULT_FROM = 1990;

const THEME_ICON: Record<WorldTheme, IconName> = {
  CRECIMIENTO: 'tendencia',
  FINANZAS: 'monedas',
  COMERCIO: 'globo',
  POBLACION: 'personas',
  ESTRUCTURA: 'fabrica',
  BIENESTAR: 'corazon',
};

const THEMES = Object.keys(THEME_LABEL) as WorldTheme[];

/** One colour per role, the same on every card, so the legend is learned once. */
const TONE = {
  world: 'var(--official)',
  region: 'var(--gap)',
  bolivia: 'var(--parallel)',
} as const;

/** An index value, which has no unit and needs no decimals. */
const sayIndex = (value: number): string =>
  value.toLocaleString('es-BO', { maximumFractionDigits: 0 });

type YearValues = Map<number, number>;
type PlaceSeries = Map<string, YearValues>;

/**
 * Indicator → place → year → value.
 *
 * A figure the core registered twice — the World Bank revised it between two
 * collections — keeps the last row the query returned, so each year is drawn
 * once and never as two points on top of each other.
 */
function foldPoints(points: readonly WorldPoint[]): Map<string, PlaceSeries> {
  const out = new Map<string, PlaceSeries>();
  for (const point of points) {
    const byPlace = out.get(point.indicatorCode) ?? new Map<string, YearValues>();
    const byYear = byPlace.get(point.place) ?? new Map<number, number>();
    byYear.set(point.year, point.value);
    byPlace.set(point.place, byYear);
    out.set(point.indicatorCode, byPlace);
  }
  return out;
}

/** The most recent year a place has a figure for. */
function latest(values: YearValues | undefined): { year: number; value: number } | null {
  if (!values) return null;
  let best: { year: number; value: number } | null = null;
  for (const [year, value] of values) {
    if (!best || year > best.year) best = { year, value };
  }
  return best;
}

/** The most recent year both places published, which is the only fair comparison. */
function latestShared(left: YearValues | undefined, right: YearValues | undefined): number | null {
  if (!left || !right) return null;
  let best: number | null = null;
  for (const year of left.keys()) {
    if (right.has(year) && (best === null || year > best)) best = year;
  }
  return best;
}

export function WorldExplorer() {
  const [points, setPoints] = useState<WorldPoint[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [theme, setTheme] = useState<WorldTheme | 'TODOS'>('TODOS');
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let live = true;
    fetch('/api/mundo')
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)),
      )
      .then((body: { points?: WorldPoint[] }) => {
        if (!live) return;
        setPoints(body.points ?? []);
        setState('ready');
      })
      .catch(() => {
        if (live) setState('failed');
      });
    return () => {
      live = false;
    };
  }, []);

  const figures = useMemo(() => foldPoints(points), [points]);
  const hasWorld = useMemo(() => points.some((point) => point.place === WORLD), [points]);
  const lastYear = useMemo(
    () => points.reduce((highest, point) => Math.max(highest, point.year), 0) || 2024,
    [points],
  );

  if (state === 'loading') {
    return (
      <div className="loading-note" role="status" aria-live="polite">
        <span className="loading-spin" aria-hidden="true" />
        <div>
          <b>Leyendo la economía mundial…</b>
          <span>
            Veintiséis indicadores del Banco Mundial, para el mundo, sus regiones y Bolivia.
          </span>
        </div>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="callout">
        No fue posible leer el tablero mundial. El detalle queda en el registro del servidor; el
        resto del informe no depende de esta lectura.
      </div>
    );
  }

  const query = search.trim().toLocaleLowerCase('es');
  // Themes are counted under the search and never under themselves, so the
  // pane never offers a theme with a count the search has already emptied.
  const searched = WORLD_INDICATORS.filter(
    (indicator) =>
      !query ||
      indicator.label.toLocaleLowerCase('es').includes(query) ||
      indicator.code.toLocaleLowerCase('es').includes(query) ||
      indicator.what.toLocaleLowerCase('es').includes(query),
  );
  const themeCounts = new Map<WorldTheme, number>();
  for (const indicator of searched) {
    themeCounts.set(indicator.theme, (themeCounts.get(indicator.theme) ?? 0) + 1);
  }
  const visible = searched.filter((indicator) => theme === 'TODOS' || indicator.theme === theme);

  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(pages, Math.floor(offset / PAGE_SIZE) + 1);
  const shown = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const first = visible.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = (page - 1) * PAGE_SIZE + shown.length;

  const active = (theme === 'TODOS' ? 0 : 1) + (query ? 1 : 0) + (from === DEFAULT_FROM ? 0 : 1);
  const regionLabel = PLACE_LABEL[region] ?? region;

  const exportQuery = new URLSearchParams({ dataset: 'mundo', region, desde: String(from) });
  if (theme !== 'TODOS') exportQuery.set('tema', theme);
  if (query) exportQuery.set('buscar', search.trim());

  const goTo = (next: () => void): void => {
    setOffset(0);
    next();
  };

  /** A headline stat: the world's latest figure, with Bolivia's under it. */
  const headline = (code: string) => {
    const indicator = WORLD_INDICATORS.find((one) => one.code === code);
    if (!indicator) return null;
    const byPlace = figures.get(code);
    return {
      indicator,
      world: latest(byPlace?.get(WORLD)),
      bolivia: latest(byPlace?.get(BOLIVIA)),
    };
  };
  const stats = ['NY.GDP.MKTP.KD.ZG', 'FP.CPI.TOTL.ZG', 'SL.UEM.TOTL.ZS', 'SI.POV.DDAY']
    .map(headline)
    .filter((stat): stat is NonNullable<ReturnType<typeof headline>> => stat !== null);

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

        {active ? (
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="capas" size={13} />
              Selección activa
            </div>
            <div className="rail-pills">
              {theme === 'TODOS' ? null : (
                <button
                  type="button"
                  className="chip chip-on"
                  onClick={() => goTo(() => setTheme('TODOS'))}
                  title="Quitar este filtro"
                >
                  <Icon name={THEME_ICON[theme]} size={12} />
                  {THEME_LABEL[theme]} ×
                </button>
              )}
              {from === DEFAULT_FROM ? null : (
                <button
                  type="button"
                  className="chip chip-on"
                  onClick={() => goTo(() => setFrom(DEFAULT_FROM))}
                  title="Quitar este filtro"
                >
                  <Icon name="calendario" size={12} />
                  Desde {from} ×
                </button>
              )}
              {query ? (
                <button
                  type="button"
                  className="chip chip-on"
                  onClick={() => goTo(() => setSearch(''))}
                >
                  <Icon name="buscar" size={12} />«{search.trim()}» ×
                </button>
              ) : null}
              <button
                type="button"
                className="chip"
                onClick={() =>
                  goTo(() => {
                    setTheme('TODOS');
                    setFrom(DEFAULT_FROM);
                    setSearch('');
                  })
                }
              >
                Limpiar todo
              </button>
            </div>
          </div>
        ) : null}

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="cajas" size={13} />
            Tema
          </div>
          <button
            type="button"
            className={theme === 'TODOS' ? 'rail-item rail-item-on' : 'rail-item'}
            onClick={() => goTo(() => setTheme('TODOS'))}
          >
            <Icon name="globo" size={16} />
            <span className="rail-name">Todos los temas</span>
            <span className="rail-n">{searched.length}</span>
          </button>
          {THEMES.map((key) => (
            <button
              key={key}
              type="button"
              className={theme === key ? 'rail-item rail-item-on' : 'rail-item'}
              onClick={() => goTo(() => setTheme(theme === key ? 'TODOS' : key))}
            >
              <Icon name={THEME_ICON[key]} size={16} />
              <span className="rail-name">{THEME_LABEL[key]}</span>
              <span className="rail-n">{themeCounts.get(key) ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="mapa" size={13} />
            Comparar con la región
          </div>
          {WORLD_PLACES.filter((place) => place.code !== WORLD).map((place) => (
            <button
              key={place.code}
              type="button"
              className={region === place.code ? 'rail-item rail-item-on' : 'rail-item'}
              onClick={() => setRegion(place.code)}
            >
              <Icon name="mapa" size={16} />
              <span className="rail-name">{place.label}</span>
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
              aria-label={`Año desde el que se dibujan los gráficos: ${from}`}
              min={1960}
              max={lastYear - 1}
              value={from}
              onChange={(event) => goTo(() => setFrom(Number(event.target.value)))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="rail-pills" style={{ marginTop: '0.4rem' }}>
            {[1960, 1990, 2000, 2010].map((year) => (
              <button
                key={year}
                type="button"
                className={from === year ? 'chip chip-on' : 'chip'}
                onClick={() => goTo(() => setFrom(year))}
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
              aria-label="Buscar un indicador mundial"
              placeholder="inflación, pobreza, comercio…"
              onChange={(event) => goTo(() => setSearch(event.target.value))}
            />
          </div>
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="descarga" size={13} />
            Descargar la selección
          </div>
          <div className="rail-download">
            <a
              className="download-btn"
              href={`/api/export?${exportQuery.toString()}&format=csv`}
              download={`observatorio-mundo-${region.toLowerCase()}-desde-${from}.csv`}
            >
              CSV
            </a>
            <a
              className="download-btn"
              href={`/api/export?${exportQuery.toString()}&format=json`}
              download={`observatorio-mundo-${region.toLowerCase()}-desde-${from}.json`}
            >
              JSON
            </a>
          </div>
          <p className="rail-hint">
            Una fila por indicador, lugar y año, para el mundo, {regionLabel} y Bolivia.
          </p>
        </div>

        <div className="rail-foot">
          Selección: <b>{visible.length}</b> de <b>{WORLD_INDICATORS.length}</b> indicadores
          <br />
          Mundo, <b>{regionLabel}</b> y Bolivia
          <br />
          Desde <b>{from}</b> · Banco Mundial (WDI)
        </div>
      </aside>

      <div className="workspace-main" id="tablero" tabIndex={-1}>
        <div className="briefcard">
          <span className="briefcard-mark">
            <Icon name="globo" size={20} />
          </span>
          <div>
            <h2>Cómo está la economía mundial</h2>
            <p>
              Crecimiento, precios, comercio, trabajo y bienestar <strong>del mundo entero</strong>,
              con la región que elijas a la izquierda y <strong>Bolivia en la misma escala</strong>.
              Todas las cifras son del Banco Mundial y usan la misma definición para el mundo, las
              regiones y el país, así que las tasas se leen sobre un solo eje sin convertir nada.
              Los dos totales —el PIB en dólares y la población— se dibujan como índice, porque
              junto al mundo Bolivia no se vería.
            </p>
            <div className="brief-points">
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="globo" size={17} />
                </span>
                <div>
                  <b>El mundo y siete regiones</b>
                  <span>agregados que calcula el propio Banco Mundial</span>
                </div>
              </div>
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="diana" size={17} />
                </span>
                <div>
                  <b>Bolivia en la misma escala</b>
                  <span>la línea naranja de cada gráfico</span>
                </div>
              </div>
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="info" size={17} />
                </span>
                <div>
                  <b>Qué mide cada cifra</b>
                  <span>tocá la ⓘ de una tarjeta</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {hasWorld ? null : (
          <div className="callout">
            Las cifras del mundo y de las regiones todavía no están cargadas en la base: las carga
            el núcleo del observatorio en su próximo despliegue. Mientras tanto cada tarjeta muestra
            sólo a Bolivia.
          </div>
        )}

        <div className="stat-strip">
          {stats.map(({ indicator, world, bolivia }) => (
            <div className="stat" key={indicator.code}>
              <span className="stat-label">
                <Icon name={THEME_ICON[indicator.theme]} size={12} />
                {indicator.label} · mundo
              </span>
              <span className="stat-value">
                {world ? sayWorldFigure(world.value, indicator) : '—'}
              </span>
              <span className="stat-hint">
                {world ? `${world.year} · ` : ''}
                Bolivia:{' '}
                {bolivia
                  ? `${sayWorldFigure(bolivia.value, indicator)} (${bolivia.year})`
                  : 'sin dato'}
              </span>
            </div>
          ))}
        </div>

        <div className="strap">
          <Icon name={theme === 'TODOS' ? 'globo' : THEME_ICON[theme]} size={17} />
          <h2>{theme === 'TODOS' ? 'Todos los temas' : THEME_LABEL[theme]}</h2>
          <span className="tile-hint">
            {visible.length} indicador{visible.length === 1 ? '' : 'es'}
            {pages === 1 ? '' : ` · ${first}–${last} en pantalla`}
          </span>
          <div className="world-legend" aria-label="Qué es cada línea">
            <span>
              <i style={{ background: TONE.world }} aria-hidden="true" />
              Mundo
            </span>
            <span>
              <i
                className="world-legend-dash"
                style={{ borderColor: TONE.region }}
                aria-hidden="true"
              />
              {regionLabel}
            </span>
            <span>
              <i style={{ background: TONE.bolivia }} aria-hidden="true" />
              Bolivia
            </span>
          </div>
        </div>

        {visible.length ? (
          <>
            <Pager
              page={page}
              pages={pages}
              first={first}
              last={last}
              total={visible.length}
              pageSize={PAGE_SIZE}
              onGo={setOffset}
              where="arriba"
            />
            <div className="card-grid">
              {shown.map((indicator) => (
                <WorldCard
                  key={indicator.code}
                  indicator={indicator}
                  byPlace={figures.get(indicator.code)}
                  region={region}
                  from={from}
                />
              ))}
            </div>
            <Pager
              page={page}
              pages={pages}
              first={first}
              last={last}
              total={visible.length}
              pageSize={PAGE_SIZE}
              onGo={setOffset}
              where="abajo"
            />
          </>
        ) : (
          <div className="callout">Ningún indicador mundial coincide con esta búsqueda.</div>
        )}
      </div>
    </div>
  );
}

/**
 * One indicator: the world's latest figure, the region's and Bolivia's, and
 * the three on one axis of years.
 *
 * The distance to the world is stated only for rates, and only for a year both
 * published. A gap between Bolivia's 2024 and the world's 2025 is a gap between
 * two years, and «puntos» between two totals in dollars is not a quantity
 * anyone can use.
 */
function WorldCard({
  indicator,
  byPlace,
  region,
  from,
}: {
  indicator: WorldIndicator;
  byPlace: PlaceSeries | undefined;
  region: string;
  from: number;
}) {
  const [explained, setExplained] = useState(false);
  const world = byPlace?.get(WORLD);
  const zone = byPlace?.get(region);
  const bolivia = byPlace?.get(BOLIVIA);
  const regionLabel = PLACE_LABEL[region] ?? region;

  const years = new Set<number>();
  for (const values of [world, zone, bolivia]) {
    if (!values) continue;
    for (const year of values.keys()) if (year >= from) years.add(year);
  }
  const ordered = [...years].sort((left, right) => left - right);

  /**
   * Totals are drawn as an index, rates as themselves.
   *
   * A rate means the same thing in a small economy and a large one, so the
   * world's 3 % and Bolivia's 19 % belong on one axis. A total does not: on an
   * axis that reaches the world's hundred and eighteen trillion dollars,
   * Bolivia's sixty-five billion is a line lying on zero and the chart says
   * nothing about Bolivia at all. Each line is set to 100 in the first year it
   * has inside the range, which keeps what a reader can compare — who grew
   * faster — and drops what they cannot. The figures above the chart stay the
   * totals.
   */
  const indexed = indicator.format === 'usd' || indicator.format === 'people';
  const baseOf = (values: YearValues | undefined): number | null => {
    if (!values) return null;
    for (const year of ordered) {
      const value = values.get(year);
      if (value !== undefined && value !== 0) return value;
    }
    return null;
  };
  const drawn = (values: YearValues | undefined, year: number): number | null => {
    const value = values?.get(year);
    if (value === undefined) return null;
    if (!indexed) return value;
    const base = baseOf(values);
    return base === null ? null : (value / base) * 100;
  };
  const data: WorldLinePoint[] = ordered.map((year) => ({
    year: String(year),
    world: drawn(world, year),
    region: drawn(zone, year),
    bolivia: drawn(bolivia, year),
  }));

  const series: WorldLineSeries[] = [
    ...(world ? [{ key: 'world', label: 'Mundo', tone: TONE.world }] : []),
    ...(zone ? [{ key: 'region', label: regionLabel, tone: TONE.region, dashed: true }] : []),
    ...(bolivia ? [{ key: 'bolivia', label: 'Bolivia', tone: TONE.bolivia, emphasis: true }] : []),
  ];

  const readings = [
    { key: 'world', label: 'Mundo', reading: latest(world), tone: TONE.world },
    { key: 'region', label: regionLabel, reading: latest(zone), tone: TONE.region },
    { key: 'bolivia', label: 'Bolivia', reading: latest(bolivia), tone: TONE.bolivia },
  ];

  const shared = indicator.format === 'percent' ? latestShared(bolivia, world) : null;
  const gap = shared === null ? null : (bolivia?.get(shared) ?? 0) - (world?.get(shared) ?? 0);

  return (
    <article className="card world-card">
      <header className="card-head">
        <span className="card-sector">
          <Icon name={THEME_ICON[indicator.theme]} size={12} /> {THEME_LABEL[indicator.theme]}
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
        </span>
        <h3>{indicator.label}</h3>
        <p className="world-unit">{indicator.unit}</p>
      </header>

      <dl className="world-figures">
        {readings.map((one) => (
          <div className="world-figure" key={one.key}>
            <dt title={one.label}>
              <i style={{ background: one.tone }} aria-hidden="true" />
              {one.label}
            </dt>
            <dd>
              {one.reading ? sayWorldFigure(one.reading.value, indicator) : '—'}
              <span>{one.reading ? one.reading.year : 'sin dato'}</span>
            </dd>
          </div>
        ))}
      </dl>

      {gap !== null && shared !== null ? (
        <p className="world-gap">
          {Math.abs(gap) < 0.05
            ? `En ${shared}, Bolivia quedó a la par del mundo.`
            : `En ${shared}, Bolivia quedó ${Math.abs(gap).toLocaleString('es-BO', {
                maximumFractionDigits: 1,
              })} puntos porcentuales ${gap > 0 ? 'por encima' : 'por debajo'} del mundo.`}
        </p>
      ) : null}

      {explained ? (
        <div className="card-note">
          <p>
            <b>Qué mide.</b> {indicator.what}
          </p>
          <p>
            <b>Cómo leerlo.</b> {indicator.howToRead}
          </p>
          <p className="card-note-source">
            <b>Dato:</b> Banco Mundial, World Development Indicators · <code>{indicator.code}</code>
          </p>
          <p className="card-note-source">
            <b>Definición:</b> redactada por el {DEFINITION_AUTHOR} a partir del concepto estándar.
            No es la del publicador.
          </p>
        </div>
      ) : null}

      {series.length && data.length ? (
        <>
          <WorldLines
            data={data}
            series={series}
            format={
              indexed
                ? (value) => `índice ${sayIndex(value)}`
                : (value) => sayWorldFigure(value, indicator)
            }
            tick={indexed ? sayIndex : (value) => sayWorldTick(value, indicator)}
          />
          {indexed ? (
            <p className="world-index-note">
              Índice: cada línea vale 100 en el primer año que tiene desde {from}. Las cifras de
              arriba son los totales.
            </p>
          ) : null}
        </>
      ) : (
        <p className="panel-sub">Sin observaciones desde {from}.</p>
      )}
    </article>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { MacroChart, YearCandles } from './charts';
import type { CandlePoint } from './charts';
import { Icon } from './icons';
import { MacroAnalysis } from './macro-analysis';
import { DistributionStrip, TrendSpark } from './macro-analysis-charts';
import {
  SECTOR_ICON,
  SECTOR_LABEL,
  SECTOR_TONE,
  UNIT_LABEL,
  headline,
  headlineValue,
  number,
  sectorTone,
} from './macro-vocabulary';
import { Pager } from './pager';
import { DEFINITION_AUTHOR, GLOSSARY, UNIT_MEANING } from '@/lib/indicator-glossary';
import { unpackMacro } from '@/lib/macro-transport';
import type { MacroBundle } from '@/lib/macro-transport';
import { macroStats } from '@/lib/macro-stats';
import type { MacroStats } from '@/lib/macro-stats';
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

/**
 * How many indicator cards one page carries.
 *
 * Every card mounts its own chart, and the panel opens on eighty-six of them:
 * eighty-six plots laid out at once is a second of frozen scrolling on a laptop
 * and considerably worse on a phone, for a page nobody reads past the first
 * screenful of anyway. Twenty is the most that still draws at once without the
 * wait being felt, and it keeps a page short enough to scan whole.
 *
 * The table is paged by the same figure. Its rows carry no chart, so weight was
 * never the reason there — but a table 1.654 rows long is not read either, and
 * a reader who switches between the two views expects to be looking at the same
 * twenty indicators, not at twenty in one and every one of them in the other.
 */
const PAGE_SIZE = 20;

export function MacroExplorer({ bundle }: { bundle: MacroBundle }) {
  /**
   * Cards or table.
   *
   * A card is how you read one indicator; a table is how you compare eighty.
   * The reader asking "what did every debt series do last year" cannot get that
   * from eighty little charts, and the answer is not to hide the filters to
   * make room — it is to lay the same selection out as rows.
   */
  /**
   * Las lecturas, rearmadas a partir del catalogo que viajo aparte.
   *
   * De este punto hacia abajo el panel trabaja con los mismos
   * `MacroPoint` de siempre: el empaquetado existe para que la portada no
   * repita el nombre de cada indicador en sus treinta y seis lecturas, y
   * termina aqui.
   */
  const points = useMemo(() => unpackMacro(bundle), [bundle]);

  const [asTable, setAsTable] = useState(false);
  const [sector, setSector] = useState<string>('TODOS');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState<number>(1990);
  /**
   * Which page of cards is on screen, counted in indicators rather than pages.
   *
   * Every slicer resets it. A reader on page four who narrows to eight
   * indicators would otherwise land on a page that no longer exists and be told
   * their filter matched nothing.
   */
  const [offset, setOffset] = useState(0);
  /**
   * El indicador abierto en la vista de análisis, si hay alguno.
   *
   * Se guarda el código y no la fila: los filtros siguen vivos detrás de la
   * vista, y si el lector vuelve después de haber movido el «desde», lo que
   * tiene que reaparecer es la serie recortada, no la que estaba cuando entró.
   */
  const [opened, setOpened] = useState<string | null>(null);

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

  const pages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const page = Math.min(pages, Math.floor(offset / PAGE_SIZE) + 1);
  const shown = cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const first = cards.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = (page - 1) * PAGE_SIZE + shown.length;

  /**
   * La serie del indicador abierto, recortada por los mismos filtros.
   *
   * Si el filtro dejó de incluirlo —el lector movió el «desde» y el indicador
   * ya no tiene lecturas— la vista se cierra sola en vez de quedarse mostrando
   * un análisis de una serie vacía.
   */
  const analysed = useMemo(() => {
    if (!opened) return null;
    const rows = selected.filter((point) => point.indicatorCode === opened);
    const latest = rows.reduce<MacroPoint | null>(
      (newest, row) => (!newest || row.period > newest.period ? row : newest),
      null,
    );
    return latest ? { latest, rows } : null;
  }, [opened, selected]);

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
            onClick={() => {
              setOffset(0);
              setSector('TODOS');
            }}
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
              onClick={() => {
                setOffset(0);
                setSector(sector === key ? 'TODOS' : key);
              }}
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
              onChange={(event) => {
                setOffset(0);
                setFrom(Number(event.target.value));
              }}
              style={{ width: '100%' }}
            />
          </div>
          <div className="rail-pills" style={{ marginTop: '0.4rem' }}>
            {[minYear, 1990, 2010, 2020].map((year) => (
              <button
                key={year}
                type="button"
                className={from === year ? 'chip chip-on' : 'chip'}
                onClick={() => {
                  setOffset(0);
                  setFrom(year);
                }}
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
              onChange={(event) => {
                setOffset(0);
                setSearch(event.target.value);
              }}
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
        {/*
          Con un indicador abierto, el cuerpo del panel es su análisis y nada
          más. La barra de filtros queda a la izquierda, viva: es lo que
          convierte la vista en una lectura del mismo tablero y no en otra
          página a la que hay que volver.
        */}
        {analysed ? (
          <MacroAnalysis
            point={analysed.latest}
            series={analysed.rows}
            onBack={() => setOpened(null)}
          />
        ) : (
          <>
            <div className="briefcard">
              <span className="briefcard-mark">
                <Icon name="globo" size={20} />
              </span>
              <div>
                <h2>Contexto macroeconómico</h2>
                <p>
                  <b>{catalogue}</b> series anuales del Banco Mundial, desde 1960 y hasta el último
                  año publicado. Elegí un rubro a la izquierda: las tarjetas, el conteo y la
                  descarga siguen esa selección. Tocá el <b>ⓘ</b> de una tarjeta para saber qué
                  mide, y el <b>desplegar</b> para ver sus observaciones año por año.
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
                {pages === 1 ? '' : ` · ${first}–${last} en pantalla`}
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

            {cards.length && asTable ? (
              <>
                <Pager
                  page={page}
                  pages={pages}
                  first={first}
                  last={last}
                  total={cards.length}
                  onGo={setOffset}
                  pageSize={PAGE_SIZE}
                  where="arriba"
                />
                <MacroTable
                  rows={shown}
                  series={selected}
                  total={cards.length}
                  onOpen={setOpened}
                />
                <Pager
                  page={page}
                  pages={pages}
                  first={first}
                  last={last}
                  total={cards.length}
                  onGo={setOffset}
                  pageSize={PAGE_SIZE}
                  where="abajo"
                />
              </>
            ) : null}

            {cards.length && !asTable ? (
              <>
                {/*
              A pager above the cards as well as below them.
              Twenty charts is six thousand pixels of scrolling, so a control
              only at the bottom means the reader who wants the next page has to
              travel the whole page they already decided against to reach it.
            */}
                <Pager
                  page={page}
                  pages={pages}
                  first={first}
                  last={last}
                  total={cards.length}
                  onGo={setOffset}
                  pageSize={PAGE_SIZE}
                  where="arriba"
                />
                <div className="card-grid">
                  {shown.map((point) => (
                    <MacroCard
                      key={point.indicatorCode}
                      point={point}
                      series={selected.filter((row) => row.indicatorCode === point.indicatorCode)}
                    />
                  ))}
                </div>
                <Pager
                  page={page}
                  pages={pages}
                  first={first}
                  last={last}
                  total={cards.length}
                  onGo={setOffset}
                  pageSize={PAGE_SIZE}
                  where="abajo"
                />
              </>
            ) : null}

            {cards.length ? null : (
              <div className="callout">Ningún indicador coincide con esta selección.</div>
            )}
          </>
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
  /** Whether they have opened the readings behind the line. */
  const [expanded, setExpanded] = useState(false);
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
          <button
            type="button"
            className={expanded ? 'card-toggle card-toggle-on' : 'card-toggle'}
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Cerrar la tabla de observaciones' : 'Ver las observaciones en tabla'}
            aria-pressed={expanded}
          >
            <Icon name={expanded ? 'plegar' : 'desplegar'} size={16} />
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
          {/*
            Two provenances, and they are not the same one. The figure is the
            publisher's; the explanation is ours, written from the standard
            concept rather than copied from their metadata. One link standing
            for both would suggest they vouched for wording they never saw.
          */}
          <p className="card-note-source">
            <b>Dato:</b> {point.publisher ?? 'fuente citada'}
            {point.sourceUrl ? (
              <>
                {' · '}
                <a href={point.sourceUrl} target="_blank" rel="noreferrer noopener">
                  ver la serie publicada
                </a>
              </>
            ) : null}
          </p>
          <p className="card-note-source">
            <b>Definición:</b> redactada por el {DEFINITION_AUTHOR} a partir del concepto estándar.
            No es la del publicador.
          </p>
          <p className="card-note-source">
            <code>{point.indicatorCode}</code> ·{' '}
            {UNIT_MEANING[point.unit] ?? UNIT_LABEL[point.unit] ?? point.unit}
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
      {expanded ? <ObservationTable point={point} series={series} /> : null}
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
 *
 * A esas columnas se sumaron las que describen la serie entera y no solo su
 * último año: centro, dispersión, forma, extremos y atípicos. La razón es la
 * misma por la que existe la tabla. Un valor de 2024 no dice si es alto para
 * ese indicador, y averiguarlo abriendo ochenta tarjetas de una en una no es
 * comparar: es recordar. Puestos en columna se ordenan, se contrastan y se
 * leen de un vistazo.
 *
 * Los encabezados van en dos pisos porque quince columnas planas no se
 * navegan. El piso de arriba agrupa —tendencia central, dispersión, forma— y el
 * de abajo nombra cada cifra, que es como se lee un cuadro estadístico
 * publicado y no hay razón para inventar otra cosa.
 *
 * Todo se calcula sobre la selección filtrada, nunca sobre el catálogo entero:
 * una media que incluyera años que el gráfico de al lado no dibuja sería una
 * cifra imposible de comprobar.
 */
function MacroTable({
  rows,
  series,
  total,
  onOpen,
}: {
  rows: MacroPoint[];
  series: MacroPoint[];
  /** The whole selection, of which `rows` is the page on screen. */
  total: number;
  /** Abrir el análisis completo de un indicador. */
  onOpen: (code: string) => void;
}) {
  /**
   * Las descriptivas de las veinte filas en pantalla, y de ninguna más.
   *
   * Calcularlas para los 1.620 indicadores de la selección costaría casi un
   * segundo cada vez que el lector mueve un filtro, y mil seiscientas de ellas
   * no se verían. Se calculan por página; el resto se calcula cuando el lector
   * llegue a esa página, que es cuando importan.
   */
  const stats = useMemo(() => {
    const byCode = new Map<string, MacroPoint[]>();
    for (const point of series) {
      const held = byCode.get(point.indicatorCode);
      if (held) held.push(point);
      else byCode.set(point.indicatorCode, [point]);
    }
    const out = new Map<string, MacroStats>();
    for (const row of rows) {
      out.set(row.indicatorCode, macroStats(byCode.get(row.indicatorCode) ?? []));
    }
    return out;
  }, [rows, series]);

  return (
    <div className="table-wrap">
      <table className="grid-table grid-table-macro">
        <thead>
          <tr className="grid-table-group">
            <th rowSpan={2}>Indicador</th>
            <th rowSpan={2}>Rubro</th>
            <th colSpan={3}>Último año</th>
            <th colSpan={2}>Tendencia central</th>
            <th colSpan={3}>Dispersión</th>
            <th colSpan={2}>Forma</th>
            <th colSpan={3}>Extremos</th>
            <th colSpan={2}>Distribución</th>
          </tr>
          <tr>
            <th className="num">Año</th>
            <th className="num">Valor</th>
            <th className="num">Var.</th>
            <th className="num" title="Promedio aritmético de la serie filtrada">
              Media
            </th>
            <th className="num" title="Valor que parte la serie en dos mitades">
              Mediana
            </th>
            <th className="num" title="Desviación estándar muestral">
              σ
            </th>
            <th className="num" title="Coeficiente de variación: σ sobre la media, en porcentaje">
              CV
            </th>
            <th className="num" title="Rango intercuartílico: Q3 − Q1">
              RIC
            </th>
            <th className="num" title="Asimetría: positiva, cola derecha larga">
              Asim.
            </th>
            <th className="num" title="Curtosis en exceso: cero es la normal">
              Curt.
            </th>
            <th className="num">Máx.</th>
            <th className="num">Mín.</th>
            <th className="num" title="Años fuera de los bigotes de Tukey (1,5 × RIC)">
              Atíp.
            </th>
            <th>Serie</th>
            <th>Caja</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((point) => {
            const stat = stats.get(point.indicatorCode);
            const unit = UNIT_LABEL[point.unit] ?? point.unit;
            const tone = sectorTone(point.sector);
            if (!stat) return null;
            /*
              La fila entera abre el análisis, no solo el minigráfico. Es un
              blanco de veinte píxeles de alto contra uno de veintiséis por
              noventa, y el lector que quiere ver la distribución de una serie
              ya está apuntando a su fila.
            */
            const open = () => onOpen(point.indicatorCode);
            return (
              <tr
                key={point.indicatorCode}
                className="row-openable"
                onClick={open}
                tabIndex={0}
                role="button"
                aria-label={`Ver el análisis de distribución de ${point.name ?? point.indicatorCode}`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    open();
                  }
                }}
              >
                <td>
                  <span className="cell-name">{point.name ?? point.indicatorCode}</span>
                  <code className="cell-code">{point.indicatorCode}</code>
                </td>
                <td>{SECTOR_LABEL[point.sector] ?? point.sector}</td>
                <td className="num">{point.period}</td>
                <td className="num">{headline(point)}</td>
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
                <td className="num" title={`Media de ${stat.n} años, en ${unit}`}>
                  {headlineValue(stat.mean, point.unit)}
                </td>
                <td className="num" title={`Mediana de ${stat.n} años, en ${unit}`}>
                  {headlineValue(stat.median, point.unit)}
                </td>
                <td className="num" title={`Desviación estándar, en ${unit}`}>
                  {headlineValue(stat.sd, point.unit)}
                </td>
                <td
                  className="num"
                  title={
                    stat.cv === null
                      ? 'La media roza el cero: el coeficiente de variación no describe nada'
                      : `σ equivale al ${number(stat.cv * 100, 1)} % de la media`
                  }
                >
                  {stat.cv === null ? '—' : `${number(stat.cv * 100, 0)} %`}
                </td>
                <td
                  className="num"
                  title={`La mitad central de los años cabe entre ${headlineValue(stat.q1, point.unit)} y ${headlineValue(stat.q3, point.unit)} ${unit}`}
                >
                  {headlineValue(stat.iqr, point.unit)}
                </td>
                <td className="num" title={skewHint(stat.skewness)}>
                  {number(stat.skewness, 2)}
                </td>
                <td className="num" title={kurtosisHint(stat.kurtosis)}>
                  {number(stat.kurtosis, 2)}
                </td>
                {/*
                  El año va en el tooltip y no en la celda. Es el dato que
                  convierte un máximo en un hecho —«28 % en 1985» dice algo que
                  «28 %» no dice— pero escrito en la celda añade una columna de
                  años a una tabla que ya tiene quince y que se lee por cifras.
                */}
                <td
                  className="num cell-extreme"
                  title={`Máximo de la serie: ${headlineValue(stat.max.value, point.unit)} ${unit} en ${stat.max.period}`}
                >
                  {headlineValue(stat.max.value, point.unit)}
                  <span className="cell-year">{stat.max.period}</span>
                </td>
                <td
                  className="num cell-extreme"
                  title={`Mínimo de la serie: ${headlineValue(stat.min.value, point.unit)} ${unit} en ${stat.min.period}`}
                >
                  {headlineValue(stat.min.value, point.unit)}
                  <span className="cell-year">{stat.min.period}</span>
                </td>
                <td
                  className="num"
                  title={
                    stat.outliers.length
                      ? `Fuera de los bigotes: ${stat.outliers
                          .slice(0, 6)
                          .map((row) => row.period)
                          .join(', ')}${stat.outliers.length > 6 ? '…' : ''}`
                      : 'Ningún año cae fuera de los bigotes de Tukey'
                  }
                >
                  {stat.outliers.length ? (
                    <span className="delta-up">{stat.outliers.length}</span>
                  ) : (
                    '0'
                  )}
                </td>
                <td className="cell-figure">
                  <TrendSpark values={stat.spark} tone={tone} outlierAt={outlierIndexes(stat)} />
                </td>
                <td className="cell-figure cell-figure-open">
                  <DistributionStrip stats={stat} tone={tone} unit={unit} />
                  <span className="cell-open">
                    <Icon name="desplegar" size={12} /> analizar
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6}>
              {rows.length === total
                ? `${total} indicador${total === 1 ? '' : 'es'}`
                : `${rows.length} de ${total} indicadores en esta página`}
              {' · '}
              <b>Tocá una fila</b> para ver su distribución, sus atípicos y su correlación.
            </td>
            <td colSpan={10} className="num">
              {series.length.toLocaleString('es-BO')} observaciones anuales en la selección
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Dónde caen los años atípicos dentro de la serie, para marcarlos en el minigráfico. */
function outlierIndexes(stat: MacroStats): number[] {
  if (!stat.outliers.length) return [];
  const flagged = new Set(stat.outliers.map((row) => row.value));
  const out: number[] = [];
  stat.spark.forEach((value, index) => {
    if (flagged.has(value)) out.push(index);
  });
  return out;
}

/** Qué dice una asimetría, en palabras, para el tooltip de su celda. */
function skewHint(value: number): string {
  if (value > 1) return `Asimetría ${number(value, 2)}: cola derecha larga, unos pocos años altos`;
  if (value > 0.35) return `Asimetría ${number(value, 2)}: sesgo leve hacia arriba`;
  if (value < -1)
    return `Asimetría ${number(value, 2)}: cola izquierda larga, unos pocos años bajos`;
  if (value < -0.35) return `Asimetría ${number(value, 2)}: sesgo leve hacia abajo`;
  return `Asimetría ${number(value, 2)}: distribución prácticamente simétrica`;
}

/** Lo mismo para la curtosis, que va en exceso: cero es la normal. */
function kurtosisHint(value: number): string {
  if (value > 1)
    return `Curtosis en exceso ${number(value, 2)}: colas pesadas, años extremos frecuentes`;
  if (value > 0.3) return `Curtosis en exceso ${number(value, 2)}: algo más pesada que la normal`;
  if (value < -0.8)
    return `Curtosis en exceso ${number(value, 2)}: colas ligeras, valores repartidos`;
  return `Curtosis en exceso ${number(value, 2)}: cercana a la normal`;
}

/**
 * Every reading behind one card's line, as a table.
 *
 * A chart answers "what shape did this take"; only the numbers answer "what
 * was it in 2014, and by how much did it move". The card carries both because
 * the reader who asks the second question is looking at the first one when it
 * occurs to them, and sending them to a separate view loses the indicator they
 * were on.
 *
 * Newest first, because the last published year is what a reader checks before
 * anything else, and the change is computed against the year below it in the
 * same table — so a reader can verify the column by subtracting two rows.
 */
function ObservationTable({ point, series }: { point: MacroPoint; series: MacroPoint[] }) {
  const rows = [...series].sort((left, right) => right.period.localeCompare(left.period));
  const unit = UNIT_LABEL[point.unit] ?? point.unit;

  return (
    <div className="card-table">
      <div className="table-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Año</th>
              <th className="num">Valor</th>
              <th className="num">Var. anual</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.period}>
                <td className="num">{row.period}</td>
                <td className="num">
                  {number(row.value, 2)} <span className="cell-code">{unit}</span>
                </td>
                <td className="num">
                  {row.changePercent === null ? (
                    '—'
                  ) : (
                    <span className={row.changePercent >= 0 ? 'delta-up' : 'delta-down'}>
                      {row.changePercent > 0 ? '+' : ''}
                      {number(row.changePercent)} %
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>
                {rows.length} {rows.length === 1 ? 'observación' : 'observaciones'} ·{' '}
                {rows.at(-1)?.period} → {rows[0]?.period}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

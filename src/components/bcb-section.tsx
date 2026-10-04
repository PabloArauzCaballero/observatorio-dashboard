'use client';

import { useEffect, useMemo, useState } from 'react';
import { DatedLines, seriesTone } from './charts';
import type { DatedLineSeries } from './charts';
import { Icon } from './icons';
import { OnOpenNotice } from './on-open';
import { AUTO_DRAWN, FREQUENCY_LABEL, MAX_SELECTED, PAGE, shortLabels } from '@/lib/bcb-board';
import type { BcbCatalogPage, BcbSeriesData, BcbSeriesInfo } from '@/lib/bcb-board';
import { Panel } from '@/components/ui/panel';
import { celda } from '@/components/ui/panel-data';

/**
 * Las estadísticas del Banco Central, con la misma estructura que las otras pestañas.
 *
 * Gráfico primero: al abrir ya hay series dibujadas, y los filtros del riel —informe, hoja,
 * frecuencia, palabras— se recortan entre sí, así que elegir un informe deja solo sus hojas
 * y sus frecuencias. Doce mil series no caben en una lista: el lector no busca una serie
 * por su nombre crudo, entra por el informe y la hoja, que es cómo el BCB las publica.
 * Las series que se dibujan solas siguen al filtro hasta que el lector elige una a mano;
 * desde ahí mandan sus elecciones.
 */

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'] as const;
const monthFormat = new Intl.DateTimeFormat('es-BO', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const sayMonth = (value: string): string => monthFormat.format(new Date(`${value}T12:00:00Z`));

const figure = (value: number): string =>
  new Intl.NumberFormat('es-BO', {
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : Math.abs(value) >= 10 ? 1 : 2,
  }).format(value);

function useDebounced<T>(value: T, ms: number): T {
  const [later, setLater] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setLater(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return later;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url);
  return (await response.json()) as T;
}

/** Un texto como parte de un identificador: «Millones de Bs» → «millones-de-bs». */
const slug = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** La unidad dentro de un paréntesis: «En millones de dólares» → «en millones de dólares». */
const inParens = (unit: string): string =>
  /^\p{Lu}\p{Ll}/u.test(unit) ? unit.charAt(0).toLowerCase() + unit.slice(1) : unit;

/** El pie de un panel: el banco central y los cuadernos de los que salieron las series. */
function sourceOf(series: readonly BcbSeriesData[]): string {
  const titles = [...new Set(series.map((one) => one.workbookTitle))];
  if (!titles.length) return 'Banco Central de Bolivia';
  const shown = titles.slice(0, 2).join('; ');
  return `Banco Central de Bolivia (${shown}${titles.length > 2 ? ` y ${titles.length - 2} más` : ''})`;
}

/** Las series de una misma unidad como filas de un gráfico, por fecha. */
function rowsOf(group: readonly BcbSeriesData[]) {
  const byDate = new Map<string, { date: string; [code: string]: string | number | null }>();
  for (const one of group) {
    for (const [date, value] of one.points) {
      const row = byDate.get(date) ?? { date };
      row[one.code] = value;
      byDate.set(date, row);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Las series que se dibujan solas: las más largas de UNA hoja, la primera que tenga alguna.
 *
 * De una sola hoja y no de las primeras que salgan: mezclar las de un informe con las de
 * otro dibujaba juntas series que no tienen nada que ver, cada una en su propio gráfico.
 */
function autoPick(results: readonly BcbSeriesInfo[]): string[] {
  const usable = results.filter((one) => one.pointCount >= 8);
  const first = usable[0];
  if (!first) return [];
  const sheet = usable.filter(
    (one) => one.workbook === first.workbook && one.sheet === first.sheet,
  );
  // Los totales primero: «Billetes y monedas» o «Bóveda» son un componente, no la cifra
  // que alguien viene a buscar.
  const totals = sheet.filter((one) => /total|neta|neto|general/iu.test(one.name));
  return [...totals, ...sheet.filter((one) => !totals.includes(one))]
    .slice(0, AUTO_DRAWN)
    .map((one) => one.code);
}

/** El informe con el que se abre la pestaña: el de las reservas, que es lo que se busca primero. */
const FEATURED = /reservas internacionales netas/iu;

/** Un eje que arranca en cero cuando la serie no baja de cero: el mínimo negativo sobra. */
function floor(group: readonly BcbSeriesData[]): { domain?: [number, number] } {
  const values = group.flatMap((one) => one.points.map(([, value]) => value));
  if (!values.length || Math.min(...values) < 0) return {};
  return { domain: [0, Math.max(...values) * 1.08] };
}

/** La celda de una serie dicha en claro: «columna D, filas 8 a 303» o «fila 43, columnas D a V». */
function whereOf(locator: Record<string, string | number> | null): string {
  if (!locator) return 'celda no registrada';
  if (locator.orientation === 'columns') {
    return `columna ${locator.valueColumn}, filas ${locator.firstRow} a ${locator.lastRow}`;
  }
  if (locator.orientation === 'rows') {
    return `fila ${locator.row}, columnas ${locator.firstColumn} a ${locator.lastColumn}`;
  }
  if (locator.orientation === 'matrix') {
    return `matriz día × mes, columnas ${locator.firstColumn} a ${locator.lastColumn}, filas ${locator.firstRow} a ${locator.lastRow}`;
  }
  if (locator.cuadros) {
    return `«${locator.entidad}», columna «${locator.columna}»; ${locator.cuadros} cuadros publicados, del ${locator.primer_cuadro} al ${locator.ultimo_cuadro}`;
  }
  return `${locator.chart ?? 'gráfico'}${locator.page ? `, página ${locator.page}` : ''}`;
}

/** De dónde salió lo dibujado, una entrada por hoja con las celdas de cada serie. */
function provenance(series: readonly BcbSeriesData[]) {
  const byPlace = new Map<
    string,
    { key: string; title: string; sheet: string; url: string | null; cells: string[] }
  >();
  for (const one of series) {
    const key = `${one.workbook}|${one.sheet}`;
    const entry = byPlace.get(key) ?? {
      key,
      title: one.workbookTitle,
      sheet: one.sheet,
      url: one.sourceUrl,
      cells: [],
    };
    entry.cells.push(whereOf(one.locator));
    byPlace.set(key, entry);
  }
  return [...byPlace.values()].map((entry) => ({ ...entry, where: entry.cells.join('; ') }));
}

/** Lo último de cada serie elegida y cuánto cambió contra el dato anterior. */
function LatestReadings({ selected }: { selected: readonly BcbSeriesData[] }) {
  const labels = shortLabels(selected.map((entry) => entry.name));
  const rows = selected.flatMap((one, position) => {
    const last = one.points.at(-1);
    const before = one.points.at(-2);
    if (!last) return [];
    const change =
      before && before[1] !== 0 ? ((last[1] - before[1]) / Math.abs(before[1])) * 100 : null;
    return [{ one, short: labels[position] ?? one.name, last, change }];
  });
  if (!rows.length) return null;
  return (
    <Panel
      id="bcb-ultimo"
      title="Último dato de las series elegidas (cada una en su unidad)"
      lede="La cifra más reciente de cada serie y cuánto cambió contra el dato anterior."
      source={sourceOf(rows.map((row) => row.one))}
      data={() => ({
        unidad: 'cada serie en su unidad; la variación en %',
        columnas: [
          'Serie',
          'Código',
          'Unidad',
          'Fecha',
          'Último',
          'Variación contra el dato anterior (%)',
        ],
        filas: rows.map(({ one, last, change }) => [
          one.name,
          one.code,
          one.unit,
          last[0],
          celda(last[1]),
          celda(change),
        ]),
      })}
    >
      <div className="stat-strip">
        {rows.map(({ one, short, last, change }) => (
          <div className="stat" key={one.code} title={`${one.workbookTitle} · ${one.sheet}`}>
            <span className="stat-label">{short}</span>
            <span className="stat-value">{figure(last[1])}</span>
            <span className="stat-hint">
              {one.unit ?? 'sin unidad declarada'} · {sayMonth(last[0])}
              {change === null
                ? ''
                : ` · ${change >= 0 ? '+' : ''}${figure(change)} % contra el dato anterior`}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function BcbSection() {
  const [family, setFamily] = useState('');
  const [workbook, setWorkbook] = useState('');
  const [sheet, setSheet] = useState('');
  const [frequency, setFrequency] = useState('');
  const [text, setText] = useState('');
  const query = useDebounced(text, 350);
  const [page, setPage] = useState<BcbCatalogPage | null>(null);
  const [extra, setExtra] = useState<BcbSeriesInfo[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [manual, setManual] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, BcbSeriesData>>({});

  const search = useMemo(() => {
    const params = new URLSearchParams({ familia: family, informe: workbook, hoja: sheet });
    params.set('frecuencia', frequency);
    params.set('q', query);
    return `/api/bcb?${params.toString()}`;
  }, [family, workbook, sheet, frequency, query]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getJson<{ page: BcbCatalogPage }>(search)
      .then((body) => {
        if (!alive) return;
        setPage(body.page);
        setExtra([]);
        setFailed(false);
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [search]);

  // Al abrir, el informe de las reservas: una pestaña que abre en «todo» no dibuja nada con
  // sentido. Queda como un filtro más, a la vista y con «Limpiar todo» para quitarlo.
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (opened || !page) return;
    setOpened(true);
    const featured = page.workbooks.find((one) => FEATURED.test(one.label));
    if (featured) setWorkbook(featured.key);
  }, [page, opened]);

  // Mientras el lector no elija a mano, lo dibujado sigue al filtro.
  useEffect(() => {
    if (manual || !page) return;
    setPicked(autoPick(page.results));
  }, [page, manual]);

  useEffect(() => {
    const missing = picked.filter((code) => !loaded[code]);
    if (!missing.length) return;
    let alive = true;
    getJson<{ series: BcbSeriesData[] }>(`/api/bcb/serie?codigos=${missing.join(',')}`)
      .then((body) => {
        if (!alive) return;
        setLoaded((old) => ({
          ...old,
          ...Object.fromEntries(body.series.map((s) => [s.code, s])),
        }));
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [picked, loaded]);

  if (!page) return <OnOpenNotice what="las estadísticas del Banco Central" failed={failed} />;
  if (!page.families.length && !page.results.length && !family && !workbook && !text) {
    return (
      <div className="callout">
        Todavía no hay estadísticas del Banco Central cargadas. La pestaña se llena sola cuando el
        núcleo del observatorio tenga sembrado el catálogo «bcb-statistics» (migración 0091).
      </div>
    );
  }

  const shown = [...page.results, ...extra];
  const selected = picked.map((code) => loaded[code]).filter((s): s is BcbSeriesData => !!s);
  const groups = new Map<string, BcbSeriesData[]>();
  for (const one of selected) {
    const key = one.unit ?? 'sin unidad declarada en el cuaderno';
    groups.set(key, [...(groups.get(key) ?? []), one]);
  }
  // Las series de una misma hoja empiezan igual: en la tabla se lee solo lo que las distingue.
  const tableLabels = new Map<string, string>();
  const bySheet = new Map<string, BcbSeriesInfo[]>();
  for (const one of shown) {
    const key = `${one.workbook}|${one.sheet}`;
    bySheet.set(key, [...(bySheet.get(key) ?? []), one]);
  }
  for (const group of bySheet.values()) {
    const labels = shortLabels(group.map((one) => one.name));
    group.forEach((one, index) => tableLabels.set(one.code, labels[index] ?? one.name));
  }
  const active =
    Number(!!family) + Number(!!workbook) + Number(!!sheet) + Number(!!frequency) + Number(!!text);
  const totalSeries = page.families.reduce((sum, one) => sum + one.count, 0);

  const toggle = (code: string) => {
    setManual(true);
    setPicked((old) =>
      old.includes(code)
        ? old.filter((one) => one !== code)
        : old.length >= MAX_SELECTED
          ? old
          : [...old, code],
    );
  };
  const clear = () => {
    setFamily('');
    setWorkbook('');
    setSheet('');
    setFrequency('');
    setText('');
    setManual(false);
  };
  const pickWorkbook = (key: string) => {
    setWorkbook((current) => (current === key ? '' : key));
    setSheet('');
    setManual(false);
  };
  const more = async () => {
    const next = await getJson<{ page: BcbCatalogPage }>(`${search}&desde=${shown.length}`);
    setExtra((old) => [...old, ...next.page.results]);
  };

  return (
    <>
      <header className="page-intro">
        <h3 className="page-intro-title">Estadísticas del Banco Central de Bolivia</h3>
        <p className="page-intro-lede">
          Las series que el BCB publica en sus cuadernos de Excel: reservas, dinero y bancos,
          precios, tasas de interés, sector externo y sistema de pagos.
        </p>
        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>
            Entrá por el informe y la hoja en el riel de la izquierda; los filtros se recortan entre
            sí. Cada serie guarda el cuaderno, la hoja y la celda de la que salió.
          </p>
        </details>
        <div className="chips" role="tablist" aria-label="Familia">
          <button
            type="button"
            className={family === '' ? 'chip chip-on' : 'chip'}
            onClick={() => {
              setFamily('');
              setWorkbook('');
              setSheet('');
              setManual(false);
            }}
          >
            Todas <span className="chip-count">{totalSeries.toLocaleString('es-BO')}</span>
          </button>
          {page.families.map((one) => (
            <button
              key={one.key}
              type="button"
              className={family === one.key ? 'chip chip-on' : 'chip'}
              onClick={() => {
                setFamily(one.key);
                setWorkbook('');
                setSheet('');
                setManual(false);
              }}
            >
              {one.label} <span className="chip-count">{one.count.toLocaleString('es-BO')}</span>
            </button>
          ))}
        </div>
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">Series</span>
            <span className="stat-value">{page.total.toLocaleString('es-BO')}</span>
            <span className="stat-hint">con los filtros de abajo</span>
          </div>
          <div className="stat">
            <span className="stat-label">Informes</span>
            <span className="stat-value">{page.workbooks.length.toLocaleString('es-BO')}</span>
            <span className="stat-hint">cuadernos y reportes del BCB</span>
          </div>
          <div className="stat">
            <span className="stat-label">Dato más reciente</span>
            <span className="stat-value">{page.latest ? sayMonth(page.latest) : '—'}</span>
            <span className="stat-hint">entre las series a la vista</span>
          </div>
        </div>
      </header>

      <div className="workspace workspace-filters-first">
        <aside className="rail" id="bcb-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">
              {active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}
            </span>
          </div>
          <p className="rail-hint-top">
            Elegí una opción por filtro. Volvé a tocarla para quitarla. Cada filtro recorta los de abajo.
          </p>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="edificio" size={13} />
              Informe
            </div>
            <div className={page.workbooks.length > 9 ? 'rail-list rail-list-cut' : 'rail-list'}>
              {page.workbooks.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={workbook === option.key ? 'rail-item rail-item-on' : 'rail-item'}
                  aria-pressed={workbook === option.key}
                  title={option.label}
                  onClick={() => pickWorkbook(option.key)}
                >
                  <Icon name="edificio" size={16} />
                  <span className="rail-name">{option.label}</span>
                  <span className="rail-hint">{option.count}</span>
                </button>
              ))}
            </div>
          </div>

          {workbook && page.sheets.length > 1 ? (
            <div className="rail-sec">
              <div className="rail-head">
                <Icon name="capas" size={13} />
                Hoja
              </div>
              <div className={page.sheets.length > 9 ? 'rail-list rail-list-cut' : 'rail-list'}>
                {page.sheets.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={sheet === option.key ? 'rail-item rail-item-on' : 'rail-item'}
                    aria-pressed={sheet === option.key}
                    onClick={() => {
                      setSheet((current) => (current === option.key ? '' : option.key));
                      setManual(false);
                    }}
                  >
                    <Icon name="capas" size={16} />
                    <span className="rail-name">{option.label}</span>
                    <span className="rail-hint">{option.count}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} />
              Frecuencia
            </div>
            <div className="rail-pills">
              {FREQUENCIES.filter((key) => page.frequencies.some((one) => one.key === key)).map(
                (key) => {
                  const one = page.frequencies.find((entry) => entry.key === key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={frequency === key ? 'chip chip-wide chip-on' : 'chip chip-wide'}
                      aria-pressed={frequency === key}
                      onClick={() => {
                        setFrequency((current) => (current === key ? '' : key));
                        setManual(false);
                      }}
                    >
                      <span className="chip-text">{FREQUENCY_LABEL[key]}</span>
                      <span className="chip-count">{one?.count ?? 0}</span>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <label className="rail-field">
            <span className="rail-hint">Buscar en el nombre, la hoja o el informe</span>
            <input
              type="search"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setManual(false);
              }}
              placeholder="por ejemplo: oro, exportaciones"
            />
          </label>

          {active ? (
            <div className="rail-sec">
              <button type="button" className="chip" onClick={clear}>
                Limpiar todo
              </button>
            </div>
          ) : null}
        </aside>

        <div className="workspace-main stack">
          {loading && !shown.length ? <div className="callout">Buscando…</div> : null}
          {!loading && !shown.length ? (
            <div className="callout">
              Ninguna serie coincide con el recorte. Quitá un filtro de la izquierda.
            </div>
          ) : null}

          {selected.length ? (
            <div className="list-bar">
              <div className="list-bar-text">
                <h3>Series elegidas</h3>
                <span className="tile-hint">
                  {selected.length} de hasta {MAX_SELECTED}; cada gráfico se baja desde su menú
                </span>
              </div>
              <div className="download">
                <button
                  type="button"
                  className="download-btn"
                  onClick={() => {
                    setManual(true);
                    setPicked([]);
                  }}
                >
                  Quitar todas
                </button>
              </div>
            </div>
          ) : null}

          {selected.length ? <LatestReadings selected={selected} /> : null}

          {[...groups.entries()].map(([unit, group]) => {
            const labels = shortLabels(group.map((one) => one.name));
            const lines: DatedLineSeries[] = group.map((one, index) => ({
              key: one.code,
              label: (labels[index] ?? one.name).slice(0, 90),
              tone: seriesTone(index),
              emphasis: index === 0,
            }));
            const firstYear = Math.min(...group.map((one) => Number(one.firstPeriod.slice(0, 4))));
            const lastYear = Math.max(...group.map((one) => Number(one.lastPeriod.slice(0, 4))));
            return (
              <Panel
                key={unit}
                id={`bcb-grafico-${slug(unit)}`}
                title={`Series del Banco Central (${inParens(unit)})`}
                lede={group
                  .map((one) => `${one.workbookTitle} · ${one.sheet}`)
                  .filter((t, i, all) => all.indexOf(t) === i)
                  .join(' — ')}
                source={sourceOf(group)}
              >
                <DatedLines
                  data={rowsOf(group)}
                  series={lines}
                  unit={unit.slice(0, 24)}
                  decimals={2}
                  yearTicks={lastYear - firstYear >= 2}
                  {...floor(group)}
                />
                <details className="panel-note">
                  <summary>De dónde salió</summary>
                  <p>
                    {provenance(group).map((entry, index) => (
                      <span key={entry.key}>
                        {index ? ' · ' : ''}
                        {entry.url ? (
                          <a href={entry.url} target="_blank" rel="noreferrer">
                            {entry.title}
                          </a>
                        ) : (
                          entry.title
                        )}
                        {`, hoja «${entry.sheet}», ${entry.where}`}
                      </span>
                    ))}
                    .
                  </p>
                </details>
              </Panel>
            );
          })}

          <Panel
            id="bcb-series"
            title={`Series de este recorte (${page.total.toLocaleString('es-BO')} series)`}
            lede={`Elegí hasta ${MAX_SELECTED} para dibujarlas juntas. Las de distinta unidad van en gráficos separados.`}
            meta={
              loading ? 'Actualizando…' : `${shown.length} de ${page.total.toLocaleString('es-BO')}`
            }
            source="Banco Central de Bolivia (catálogo de cuadernos y hojas que recoge el Observatorio)"
            data={() => ({
              unidad: 'cada serie en su unidad; aquí solo el catálogo, sin los valores',
              columnas: [
                'Serie',
                'Código',
                'Informe',
                'Hoja',
                'Unidad',
                'Frecuencia',
                'Desde',
                'Hasta',
              ],
              filas: shown.map((one) => [
                one.name,
                one.code,
                one.workbookTitle,
                one.sheet,
                one.unit,
                FREQUENCY_LABEL[one.frequency] ?? one.frequency,
                celda(one.firstPeriod),
                celda(one.lastPeriod),
              ]),
            })}
          >
            <div className="table-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th />
                    <th>Serie</th>
                    <th>Informe · hoja</th>
                    <th>Frecuencia</th>
                    <th>Período</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((one) => {
                    const on = picked.includes(one.code);
                    const short = tableLabels.get(one.code) ?? one.name;
                    return (
                      <tr key={one.code}>
                        <td>
                          <button
                            type="button"
                            className={on ? 'chip chip-on' : 'chip'}
                            aria-pressed={on}
                            disabled={!on && picked.length >= MAX_SELECTED}
                            onClick={() => toggle(one.code)}
                          >
                            {on ? 'Quitar' : 'Elegir'}
                          </button>
                        </td>
                        <td title={one.name}>{short}</td>
                        <td className="stat-hint">
                          {one.workbookTitle} · {one.sheet}
                        </td>
                        <td>{FREQUENCY_LABEL[one.frequency] ?? one.frequency}</td>
                        <td>
                          {sayMonth(one.firstPeriod)} – {sayMonth(one.lastPeriod)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {shown.length < page.total ? (
              <p>
                <button type="button" className="chip" onClick={() => void more()}>
                  Ver {Math.min(PAGE, page.total - shown.length)} más
                </button>
              </p>
            ) : null}
          </Panel>
        </div>
      </div>
    </>
  );
}

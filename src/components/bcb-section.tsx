'use client';

import { useEffect, useMemo, useState } from 'react';
import { DatedLines, seriesTone } from './charts';
import type { DatedLinePoint, DatedLineSeries } from './charts';
import { Icon } from './icons';
import { OnOpenNotice } from './on-open';
import { FREQUENCY_LABEL, MAX_SELECTED, PAGE, familyLabel } from '@/lib/bcb-board';
import type { BcbCatalogPage, BcbSeriesData, BcbSeriesInfo } from '@/lib/bcb-board';

/**
 * Las estadísticas del Banco Central, serie por serie.
 *
 * Doce mil series de los cuadernos de Excel que el BCB publica —reservas, dinero, precios,
 * tasas, sector externo y sistema de pagos—. No caben en una lista: se busca por familia,
 * frecuencia y palabras, se eligen hasta cuatro y se dibujan, un gráfico por unidad (dos
 * series en millones de dólares y en porcentaje no comparten eje sin mentir). Cada serie
 * dice de qué cuaderno, hoja y celda salió.
 */

const FREQUENCIES = ['', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'] as const;
const dateFormat = new Intl.DateTimeFormat('es-BO', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const sayMonth = (value: string): string => dateFormat.format(new Date(`${value}T12:00:00Z`));

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

function csvOf(series: readonly BcbSeriesData[]): string {
  const quote = (text: string): string => `"${text.replace(/"/gu, '""')}"`;
  const lines = ['codigo,nombre,unidad,fecha,valor'];
  for (const one of series) {
    for (const [date, value] of one.points) {
      lines.push([one.code, quote(one.name), quote(one.unit ?? ''), date, value].join(','));
    }
  }
  return `${lines.join('\n')}\n`;
}

function download(series: readonly BcbSeriesData[]): void {
  const url = URL.createObjectURL(new Blob([csvOf(series)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'series-bcb.csv';
  link.click();
  URL.revokeObjectURL(url);
}

/** Las series de una misma unidad como filas de un gráfico, por fecha. */
function rowsOf(group: readonly BcbSeriesData[]): DatedLinePoint[] {
  const byDate = new Map<string, DatedLinePoint>();
  for (const one of group) {
    for (const [date, value] of one.points) {
      const row = byDate.get(date) ?? { date };
      row[one.code] = value;
      byDate.set(date, row);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function BcbSection() {
  const [family, setFamily] = useState('');
  const [frequency, setFrequency] = useState('');
  const [text, setText] = useState('');
  const query = useDebounced(text, 350);
  const [page, setPage] = useState<BcbCatalogPage | null>(null);
  const [extra, setExtra] = useState<BcbSeriesInfo[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<Record<string, BcbSeriesData>>({});

  const search = useMemo(
    () =>
      `/api/bcb?familia=${encodeURIComponent(family)}&frecuencia=${frequency}&q=${encodeURIComponent(query)}`,
    [family, frequency, query],
  );

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
  if (!page.families.length) {
    return (
      <div className="callout">
        Todavía no hay estadísticas del Banco Central cargadas. La pestaña se llena sola cuando el
        núcleo del observatorio tenga sembrado el catálogo «bcb-statistics» (migración 0091).
      </div>
    );
  }

  const shown = [...page.results, ...extra];
  const total = page.families.reduce((sum, one) => sum + one.series, 0);
  const selected = picked.map((code) => loaded[code]).filter((s): s is BcbSeriesData => !!s);
  const groups = new Map<string, BcbSeriesData[]>();
  for (const one of selected) {
    const key = one.unit ?? 'sin unidad declarada en el cuaderno';
    groups.set(key, [...(groups.get(key) ?? []), one]);
  }

  const toggle = (code: string) =>
    setPicked((old) =>
      old.includes(code)
        ? old.filter((one) => one !== code)
        : old.length >= MAX_SELECTED
          ? old
          : [...old, code],
    );

  const more = async () => {
    const next = await getJson<{ page: BcbCatalogPage }>(`${search}&desde=${shown.length}`);
    setExtra((old) => [...old, ...next.page.results]);
  };

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Series del Banco Central de Bolivia</h2>
          <p className="panel-sub">
            {total.toLocaleString('es-BO')} series de los cuadernos de Excel que el BCB publica:
            reservas, dinero y bancos, precios, tasas de interés, sector externo y sistema de pagos.
            Cada una dice de qué cuaderno, hoja y celda salió. Buscá por palabras, elegí hasta{' '}
            {MAX_SELECTED} y se dibujan juntas cuando comparten unidad.
          </p>
        </div>
        <div className="chips" role="tablist" aria-label="Familia">
          <button
            type="button"
            className={family === '' ? 'chip chip-on' : 'chip'}
            onClick={() => setFamily('')}
          >
            Todas <span className="chip-count">{total.toLocaleString('es-BO')}</span>
          </button>
          {page.families.map((one) => (
            <button
              key={one.family}
              type="button"
              className={family === one.family ? 'chip chip-on' : 'chip'}
              onClick={() => setFamily(one.family)}
            >
              {one.label} <span className="chip-count">{one.series.toLocaleString('es-BO')}</span>
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Frecuencia">
          {FREQUENCIES.map((key) => (
            <button
              key={key || 'todas'}
              type="button"
              className={frequency === key ? 'chip chip-on' : 'chip'}
              onClick={() => setFrequency(key)}
            >
              {key ? FREQUENCY_LABEL[key] : 'Toda frecuencia'}
            </button>
          ))}
        </div>
        <label className="rail-field">
          <span className="rail-hint">Buscar en el nombre, la hoja o el informe</span>
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="por ejemplo: reservas oro, exportaciones, tasa pasiva"
          />
        </label>
      </div>

      {selected.length ? (
        <div className="panel">
          <div className="panel-head">
            <h2>
              Series elegidas ({picked.length}/{MAX_SELECTED})
            </h2>
            <p className="panel-sub">
              <button type="button" className="chip" onClick={() => download(selected)}>
                <Icon name="descarga" size={13} /> Descargar CSV
              </button>{' '}
              <button type="button" className="chip" onClick={() => setPicked([])}>
                Quitar todas
              </button>
            </p>
          </div>
          {[...groups.entries()].map(([unit, group]) => {
            const series: DatedLineSeries[] = group.map((one, index) => ({
              key: one.code,
              label: one.name.length > 60 ? `${one.name.slice(0, 57)}…` : one.name,
              tone: seriesTone(index),
            }));
            const firstYear = Math.min(...group.map((one) => Number(one.firstPeriod.slice(0, 4))));
            const lastYear = Math.max(...group.map((one) => Number(one.lastPeriod.slice(0, 4))));
            return (
              <div key={unit} className="chart-block">
                <h3>{unit}</h3>
                <DatedLines
                  data={rowsOf(group)}
                  series={series}
                  unit={unit.slice(0, 24)}
                  decimals={2}
                  yearTicks={lastYear - firstYear >= 2}
                />
              </div>
            );
          })}
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Serie</th>
                  <th>De dónde salió</th>
                  <th>Período</th>
                  <th className="num">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((one) => (
                  <tr key={one.code}>
                    <td>{one.name}</td>
                    <td>
                      {one.sourceUrl ? (
                        <a href={one.sourceUrl} target="_blank" rel="noreferrer">
                          {decodeURIComponent(one.sourceUrl.split('/').pop() ?? '')}
                        </a>
                      ) : (
                        one.workbook
                      )}
                      <span className="stat-hint">
                        {' '}
                        · hoja «{one.sheet}» · {JSON.stringify(one.locator ?? {})}
                      </span>
                    </td>
                    <td>
                      {sayMonth(one.firstPeriod)} – {sayMonth(one.lastPeriod)}
                    </td>
                    <td className="num">{one.pointCount.toLocaleString('es-BO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <h2>
            {page.total.toLocaleString('es-BO')} serie{page.total === 1 ? '' : 's'}
            {loading ? ' …' : ''}
          </h2>
        </div>
        {shown.length ? (
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th />
                  <th>Serie</th>
                  <th>Familia · informe · hoja</th>
                  <th>Unidad</th>
                  <th>Frecuencia</th>
                  <th>Período</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((one) => {
                  const on = picked.includes(one.code);
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
                      <td>{one.name}</td>
                      <td className="stat-hint">
                        {familyLabel(one.family)} · {one.workbook.split('/').pop()} · {one.sheet}
                      </td>
                      <td>{one.unit ?? '—'}</td>
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
        ) : (
          <div className="callout">
            {loading ? 'Buscando…' : 'Ninguna serie coincide con esa búsqueda.'}
          </div>
        )}
        {shown.length < page.total ? (
          <p>
            <button type="button" className="chip" onClick={() => void more()}>
              Ver {Math.min(PAGE, page.total - shown.length)} más
            </button>
          </p>
        ) : null}
      </div>
    </>
  );
}

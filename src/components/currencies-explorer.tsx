'use client';

import { useMemo, useState } from 'react';
import { additive, toggle as toggleChoice } from '@/lib/choice';
import { CATALOG, DOLLAR, REGIONS, entryOf, measured, perDollar, sayDate, sayScale, scaleOf, summarize } from '@/lib/currencies-board';
import type { CurrencyBoard, CurrencySeries, Measure, Region } from '@/lib/currencies-board';
import { DatedLines, seriesTone } from './charts';
import type { DatedLinePoint } from './charts';
import { FilterHint } from './filters';
import { Icon } from './icons';

/**
 * El boliviano frente a las principales monedas, con filtros que se cruzan.
 *
 * Arranca con las cuatro que más pesan en el comercio de Bolivia —yuan, yen,
 * euro y real— y el lector suma o quita monedas y cambia entre tres lecturas:
 * el nivel en bolivianos, el índice base 100 y la variación interanual. Sólo
 * en índice o variación se comparan monedas de distinto tamaño en un mismo
 * eje: el yen y el euro en nivel no son comparables sin más.
 *
 * La historia anterior a 2026 es semanal y la reciente es diaria; el gráfico no
 * las empalma en silencio, lo dice debajo.
 */

const MEASURES: ReadonlyArray<{ key: Measure; label: string; hint: string }> = [
  { key: 'LEVEL', label: 'Nivel', hint: 'Bolivianos que vale la moneda (por la cantidad que dice cada una).' },
  { key: 'INDEX', label: 'Índice', hint: 'Base 100 en el primer dato visible de cada moneda.' },
  { key: 'YOY', label: 'Var. anual', hint: 'Cambio contra la misma fecha de un año antes, en %.' },
];

const START: readonly string[] = ['CNY', 'JPY', 'EUR', 'BRL'];
const MOST_DRAWN = 6;

const number = (value: number, decimals = 2): string =>
  new Intl.NumberFormat('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(value);

const decimalsFor = (values: readonly number[]): number => {
  const top = Math.max(...values.map((value) => Math.abs(value)), 0);
  return top >= 100 ? 1 : top >= 10 ? 2 : top >= 1 ? 3 : 4;
};

const signed = (value: number | null): string =>
  value === null ? '—' : `${value > 0 ? '+' : ''}${number(value, 1)} %`;

export function CurrenciesExplorer({ board }: { board: CurrencyBoard }) {
  const dollar = board.series.find((one) => one.iso === DOLLAR);
  const coins = useMemo(
    () => board.series.filter((one) => one.iso !== DOLLAR && entryOf(one.iso)),
    [board],
  );
  const [region, setRegion] = useState<Region | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    new Set(START.filter((iso) => coins.some((one) => one.iso === iso))),
  );
  const [measure, setMeasure] = useState<Measure>('LEVEL');
  const bounds = useMemo(() => {
    const years = coins.flatMap((one) => one.points.map(([date]) => Number(date.slice(0, 4))));
    return { min: Math.min(...years, 2010), max: Math.max(...years, 2010) };
  }, [coins]);
  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const from = yearFrom ?? Math.max(bounds.min, bounds.max - 3);
  const to = bounds.max;

  if (!coins.length) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Otras monedas: el boliviano frente al mundo</h2>
          <p className="panel-sub">
            Todavía no hay cotizaciones cargadas en esta base. Se llenan con la tabla de cotizaciones
            del Banco Central de Bolivia.
          </p>
        </div>
      </div>
    );
  }

  const listed = coins.filter((one) => region === null || entryOf(one.iso)?.region === region);
  const drawn = coins.filter((one) => chosen.has(one.iso)).slice(0, MOST_DRAWN);
  const focus = coins.filter((one) => entryOf(one.iso)?.focus);

  const rows = new Map<string, DatedLinePoint>();
  for (const one of drawn) {
    for (const [date, value] of measured(one.points, one.iso, measure, from, to)) {
      const row = rows.get(date) ?? { date };
      row[one.iso] = value;
      rows.set(date, row);
    }
  }
  const data = [...rows.values()].sort((left, right) => String(left.date).localeCompare(String(right.date)));
  const values = data.flatMap((row) =>
    drawn.map((one) => row[one.iso]).filter((value): value is number => typeof value === 'number'),
  );
  const unit = measure === 'LEVEL' ? 'Bs' : measure === 'INDEX' ? 'índice' : '%';
  const title =
    measure === 'LEVEL'
      ? 'El boliviano frente a las monedas elegidas (Bs por la cantidad indicada de cada una)'
      : measure === 'INDEX'
        ? `Las monedas elegidas en índice (base 100 = primer dato visible desde ${from})`
        : 'Variación interanual de cada moneda frente al boliviano (%)';
  const label = (one: CurrencySeries): string =>
    measure === 'LEVEL' && scaleOf(one.iso) !== 1 ? `${one.label} (${sayScale(one.iso)})` : one.label;

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Otras monedas: el boliviano frente a las principales del mundo</h2>
          <p className="panel-sub">
            {coins.length} monedas según la tabla de cotizaciones del Banco Central de Bolivia; la
            última es del {board.latestDate ? sayDate(board.latestDate) : '—'}. Bolivia vende y compra
            mucho con China: su moneda es el <b>yuan (CNY)</b>; el <b>yen (JPY)</b> es la de Japón. Las
            cotizaciones son indicativas salvo la del dólar, y los cruces salen del dólar oficial.
          </p>
        </div>
        <div className="stat-strip">
          {focus.map((one) => {
            const summary = summarize(one);
            if (!summary.last) return null;
            const scale = scaleOf(one.iso);
            return (
              <div className="stat" key={one.iso} title={one.note}>
                <span className="stat-label">{one.label}</span>
                <span className="stat-value">
                  {number(summary.last[1] * scale, decimalsFor([summary.last[1] * scale]))} Bs
                </span>
                <span className="stat-hint">
                  {sayScale(one.iso)} · {sayDate(summary.last[0])}
                  {summary.year === null ? '' : ` · ${signed(summary.year)} en un año`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="workspace workspace-filters-first">
        <aside className="rail" id="monedas-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">{chosen.size} moneda{chosen.size === 1 ? '' : 's'}</span>
          </div>
          <FilterHint>Ctrl+clic suma varias a la selección; se dibujan hasta {MOST_DRAWN}.</FilterHint>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="globo" size={13} />
              Región
            </div>
            <div className="rail-pills">
              <button
                type="button"
                className={region === null ? 'chip chip-on' : 'chip'}
                aria-pressed={region === null}
                onClick={() => setRegion(null)}
              >
                Todas
              </button>
              {REGIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={region === option.key ? 'chip chip-on' : 'chip'}
                  aria-pressed={region === option.key}
                  title={option.hint}
                  onClick={() => setRegion(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="linea" size={13} />
              Moneda ({listed.length})
            </div>
            <div className={listed.length > 9 ? 'rail-list rail-list-cut' : 'rail-list'}>
              {listed.map((one) => {
                const on = chosen.has(one.iso);
                return (
                  <button
                    key={one.iso}
                    type="button"
                    className={on ? 'rail-item rail-item-on' : 'rail-item'}
                    aria-pressed={on}
                    title={`${one.label} · ${one.country}`}
                    onClick={(event) =>
                      setChosen((current) => {
                        const next = toggleChoice(current, one.iso, additive(event));
                        // La última moneda visible no se quita: un gráfico vacío no dice nada.
                        return next.size ? next : current;
                      })
                    }
                  >
                    <Icon name="linea" size={16} />
                    <span className="rail-name">{one.label}</span>
                    <span className="rail-hint">{one.iso}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} />
              Desde: {from}
            </div>
            <div className="rail-field">
              <input
                type="range"
                aria-label={`Desde qué año se dibujan los gráficos: ${from}`}
                min={bounds.min}
                max={to}
                value={from}
                onChange={(event) => setYearFrom(Number(event.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="sigma" size={13} />
              Medida
            </div>
            <div className="rail-pills">
              {MEASURES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={option.key === measure ? 'chip chip-on' : 'chip'}
                  aria-pressed={option.key === measure}
                  title={option.hint}
                  onClick={() => setMeasure(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="workspace-main stack">
          <div className="panel">
            <div className="panel-head">
              <h2>{title}</h2>
              <p className="panel-sub">
                Cada línea es lo que vale la moneda en bolivianos según el BCB. La historia es
                semanal hasta fines de septiembre de 2026 y diaria desde entonces. El dólar oficial pasó de 6,96 a flotar
                el 27-jun-2026: antes, el boliviano frente a otra moneda sólo se movía con ella
                contra el dólar.
              </p>
            </div>
            {drawn
              .filter((one) => one.spliced)
              .map((one) => (
                <p className="panel-sub" key={one.iso}>
                  <Icon name="info" size={12} /> {one.label}: {one.spliced}
                </p>
              ))}
            {data.length > 1 ? (
              <DatedLines
                data={data}
                series={drawn.map((one, index) => ({
                  key: one.iso,
                  label: label(one),
                  tone: seriesTone(index),
                }))}
                unit={unit}
                decimals={decimalsFor(values)}
                yearTicks
                {...(measure === 'INDEX' ? { referenceLine: 100 } : {})}
                {...(measure === 'YOY' ? { referenceLine: 0 } : {})}
              />
            ) : (
              <div className="callout">No hay datos de estas monedas en los años elegidos.</div>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Las {coins.length} monedas del BCB frente al boliviano (Bs y variación en %)</h2>
              <p className="panel-sub">
                «Por» es la cantidad de moneda extranjera a la que se refiere la cifra: 100 yenes,
                1.000 wones. «Por US$» son las unidades que entran en un dólar oficial.
              </p>
            </div>
            <div className="table-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Moneda</th>
                    <th>País</th>
                    <th>Por</th>
                    <th className="num">Bs</th>
                    <th className="num">Por US$</th>
                    <th className="num">vs. anterior</th>
                    <th className="num">vs. un mes</th>
                    <th className="num">vs. un año</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {[...coins]
                    .sort((left, right) => Object.keys(CATALOG).indexOf(left.iso) - Object.keys(CATALOG).indexOf(right.iso))
                    .map((one) => {
                      const summary = summarize(one);
                      if (!summary.last) return null;
                      const units = perDollar(one, dollar);
                      const scale = scaleOf(one.iso);
                      return (
                        <tr key={one.iso} title={one.note}>
                          <td>
                            <b>{one.label}</b> <span className="muted">{one.iso}</span>
                          </td>
                          <td>{one.country}</td>
                          <td>{scale === 1 ? '1' : number(scale, 0)}</td>
                          <td className="num">
                            <b>{number(summary.last[1] * scale, decimalsFor([summary.last[1] * scale]))}</b>
                          </td>
                          <td className="num">{units === null ? '—' : number(units, units >= 100 ? 1 : 3)}</td>
                          <td className="num">{signed(summary.day)}</td>
                          <td className="num">{signed(summary.month)}</td>
                          <td className="num">{signed(summary.year)}</td>
                          <td>{sayDate(summary.last[0])}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="panel-sub">
            <Icon name="info" size={12} /> Fuente: tabla de cotizaciones del Banco Central de
            Bolivia (bcb.gob.bo). Cada cifra guarda la fila de la tabla de la que salió.
          </p>
        </div>
      </div>
    </>
  );
}

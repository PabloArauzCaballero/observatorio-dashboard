'use client';

import { useMemo, useState } from 'react';
import { additive, toggle as toggleChoice } from '@/lib/choice';
import {
  CATALOG,
  DOLLAR,
  REGIONS,
  entryOf,
  measured,
  perDollar,
  sayDate,
  sayScale,
  scaleOf,
  summarize,
} from '@/lib/currencies-board';
import type { CurrencyBoard, CurrencySeries, Measure, Region } from '@/lib/currencies-board';
import { DatedLines, DivergingBars, seriesTone } from './charts';
import type { DatedLinePoint } from './charts';
import { FilterHint } from './filters';
import { Icon } from './icons';
import { MAX_BARRAS, MacroViewChart } from './macro-view-chart';
import { Panel } from '@/components/ui/panel';
import { celda } from '@/components/ui/panel-data';
import { ViewToggle } from '@/components/ui/view-toggle';

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
  {
    key: 'LEVEL',
    label: 'Nivel',
    hint: 'Valor de la moneda en bolivianos, por la cantidad indicada para cada una.',
  },
  { key: 'INDEX', label: 'Índice', hint: 'Base 100 en el primer dato visible de cada moneda.' },
  { key: 'YOY', label: 'Var. anual', hint: 'Variación frente a la misma fecha del año anterior, en %.' },
];

const START: readonly string[] = ['CNY', 'JPY', 'EUR', 'BRL'];
const MOST_DRAWN = 6;

const number = (value: number, decimals = 2): string =>
  new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);

const decimalsFor = (values: readonly number[]): number => {
  const top = Math.max(...values.map((value) => Math.abs(value)), 0);
  return top >= 100 ? 1 : top >= 10 ? 2 : top >= 1 ? 3 : 4;
};

const signed = (value: number | null): string =>
  value === null ? '—' : `${value > 0 ? '+' : ''}${number(value, 1)} %`;

/** Una moneda con su última cifra y sus tres variaciones: lo que dice cada fila de la tabla. */
interface CoinRow {
  one: CurrencySeries;
  last: [string, number];
  scale: number;
  bs: number;
  units: number | null;
  day: number | null;
  month: number | null;
  year: number | null;
}

const CHANGES = [
  { key: 'year', label: 'Frente a hace un año' },
  { key: 'month', label: 'Frente a hace un mes' },
  { key: 'day', label: 'Frente al dato anterior' },
] as const;

/**
 * Cuánto se movió cada moneda frente al boliviano, como barras a un lado y otro del cero.
 *
 * Las cifras en bolivianos no se comparan —cien yenes, mil wones—, pero el cambio en porcentaje
 * sí. Arriba, las monedas que subieron frente al boliviano (el boliviano se debilitó frente a
 * ellas); abajo, las que bajaron. Se dibujan las doce que más se movieron en la lectura elegida;
 * la tabla trae todas con su cifra en bolivianos.
 */
function CoinChangeChart({ rows }: { rows: readonly CoinRow[] }) {
  const [key, setKey] = useState<(typeof CHANGES)[number]['key']>('year');
  const change = CHANGES.find((one) => one.key === key) ?? CHANGES[0];
  const moved = rows.flatMap((row) => {
    const value = row[change.key];
    return value === null ? [] : [{ row, value }];
  });
  const shown = [...moved]
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
    .slice(0, MAX_BARRAS);

  return (
    <>
      <div className="chips" role="group" aria-label="Periodo de comparación">
        {CHANGES.map((one) => (
          <button
            key={one.key}
            type="button"
            className={one.key === key ? 'chip chip-on' : 'chip'}
            aria-pressed={one.key === key}
            onClick={() => setKey(one.key)}
          >
            {one.label}
          </button>
        ))}
      </div>
      {shown.length ? (
        <MacroViewChart shown={shown.length} total={moved.length}>
          <DivergingBars
            signed
            data={shown.map(({ row, value }) => ({
              name: row.one.label,
              value,
              meta: `Bs ${number(row.bs, decimalsFor([row.bs]))} por ${
                row.scale === 1 ? '1' : number(row.scale, 0)
              } ${row.one.iso} · ${sayDate(row.last[0])}`,
            }))}
            unit="%"
            height={Math.max(140, shown.length * 28 + 56)}
          />
        </MacroViewChart>
      ) : (
        <div className="callout">Ninguna moneda tiene aún datos para esta comparación.</div>
      )}
    </>
  );
}

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
      <Panel
        id="monedas-sin-datos"
        title="El boliviano frente a otras monedas (Bs)"
        lede="Aún no hay cotizaciones disponibles. La serie se alimenta de la tabla de cotizaciones del Banco Central de Bolivia."
        source="Banco Central de Bolivia, tabla de cotizaciones (bcb.gob.bo)"
        downloadable={false}
      >
        {null}
      </Panel>
    );
  }

  const listed = coins.filter((one) => region === null || entryOf(one.iso)?.region === region);
  const drawn = coins.filter((one) => chosen.has(one.iso)).slice(0, MOST_DRAWN);
  const focus = coins.filter((one) => entryOf(one.iso)?.focus);
  /** Las monedas de foco con su última cifra en bolivianos, ya multiplicada por su escala. */
  const focusCards = focus.flatMap((one) => {
    const summary = summarize(one);
    if (!summary.last) return [];
    const scale = scaleOf(one.iso);
    return [{ one, summary, scale, bs: summary.last[1] * scale }];
  });

  const rows = new Map<string, DatedLinePoint>();
  for (const one of drawn) {
    for (const [date, value] of measured(one.points, one.iso, measure, from, to)) {
      const row = rows.get(date) ?? { date };
      row[one.iso] = value;
      rows.set(date, row);
    }
  }
  const data = [...rows.values()].sort((left, right) =>
    String(left.date).localeCompare(String(right.date)),
  );
  const values = data.flatMap((row) =>
    drawn.map((one) => row[one.iso]).filter((value): value is number => typeof value === 'number'),
  );
  const unit = measure === 'LEVEL' ? 'Bs' : measure === 'INDEX' ? 'índice' : '%';
  const title =
    measure === 'LEVEL'
      ? 'Monedas elegidas frente al boliviano (Bs por la cantidad indicada de cada una)'
      : measure === 'INDEX'
        ? `Monedas elegidas frente al boliviano (índice, base 100 = primer dato desde ${from})`
        : 'Variación interanual de cada moneda frente al boliviano (%)';
  /** Las monedas del cuadro, en el orden del catálogo, con la cifra que dice cada fila. */
  const coinRows: CoinRow[] = [...coins]
    .sort(
      (left, right) =>
        Object.keys(CATALOG).indexOf(left.iso) - Object.keys(CATALOG).indexOf(right.iso),
    )
    .flatMap((one) => {
      const summary = summarize(one);
      if (!summary.last) return [];
      const scale = scaleOf(one.iso);
      return [
        {
          one,
          last: summary.last,
          scale,
          bs: summary.last[1] * scale,
          units: perDollar(one, dollar),
          day: summary.day,
          month: summary.month,
          year: summary.year,
        },
      ];
    });
  const label = (one: CurrencySeries): string =>
    measure === 'LEVEL' && scaleOf(one.iso) !== 1
      ? `${one.label} (${sayScale(one.iso)})`
      : one.label;

  return (
    <>
      <Panel
        id="monedas-principales"
        title="Principales monedas del comercio exterior frente al boliviano (Bs)"
        lede={`Cotización en bolivianos de ${coins.length} monedas, según la tabla del Banco Central de Bolivia; último dato del ${board.latestDate ? sayDate(board.latestDate) : '—'}.`}
        source="Banco Central de Bolivia, tabla de cotizaciones (bcb.gob.bo)"
        data={{
          unidad: 'Bs',
          columnas: ['Moneda', 'Código', 'Por', 'Bs', 'Fecha', 'Variación en un año (%)'],
          filas: focusCards.map(({ one, summary, scale }) => [
            one.label,
            one.iso,
            scale,
            summary.last ? summary.last[1] * scale : null,
            summary.last ? summary.last[0] : null,
            summary.year,
          ]),
        }}
      >
        <div className="stat-strip">
          {focusCards.map(({ one, summary, bs }) => (
            <div className="stat" key={one.iso} title={one.note}>
              <span className="stat-label">{one.label}</span>
              <span className="stat-value">{number(bs, decimalsFor([bs]))} Bs</span>
              <span className="stat-hint">
                {sayScale(one.iso)} · {summary.last ? sayDate(summary.last[0]) : '—'}
                {summary.year === null ? '' : ` · ${signed(summary.year)} en un año`}
              </span>
            </div>
          ))}
        </div>
        <details className="panel-note">
          <summary>Cómo leer estas cifras</summary>
          <p>
            China es uno de los principales socios comerciales de Bolivia; su moneda es el{' '}
            <b>yuan (CNY)</b>. El <b>yen (JPY)</b> es la moneda de Japón. Las cotizaciones son
            indicativas, salvo la del dólar, y los tipos cruzados se calculan a partir del dólar
            oficial.
          </p>
        </details>
      </Panel>

      <div className="workspace workspace-filters-first">
        <aside className="rail" id="monedas-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">
              {chosen.size} moneda{chosen.size === 1 ? '' : 's'}
            </span>
          </div>
          <FilterHint>
            Ctrl+clic suma varias a la selección; se dibujan hasta {MOST_DRAWN}.
          </FilterHint>

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
          <Panel
            id="monedas-grafico"
            title={title}
            lede="Cada línea sigue una moneda frente al boliviano, según la tabla de cotizaciones del BCB."
            source="Banco Central de Bolivia, tabla de cotizaciones (bcb.gob.bo)"
          >
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
            {drawn
              .filter((one) => one.spliced)
              .map((one) => (
                <p className="panel-note" key={one.iso}>
                  <Icon name="info" size={12} /> {one.label}: {one.spliced}
                </p>
              ))}
            <details className="panel-note">
              <summary>Cómo leer este gráfico</summary>
              <p>
                La serie es semanal hasta fines de septiembre de 2026 y diaria desde entonces. El
                dólar oficial dejó el tipo fijo de 6,96 Bs y pasó a flotar el 27-jun-2026; hasta
                entonces, el boliviano solo se movía frente a otra moneda cuando esta se movía
                frente al dólar.
              </p>
            </details>
          </Panel>

          <Panel
            id="monedas-tabla"
            title={`Cotización de ${coins.length} monedas frente al boliviano (Bs y variación en %)`}
            lede="«Por» es la cantidad de moneda extranjera a la que se refiere la cifra: 100 yenes, 1.000 wones. «Por USD» son las unidades que equivalen a un dólar oficial."
            source="Banco Central de Bolivia, tabla de cotizaciones (bcb.gob.bo)"
            data={() => ({
              unidad: 'Bs por la cantidad de moneda que dice «Por»; variaciones en %',
              columnas: [
                'Moneda',
                'Código',
                'País',
                'Por (unidades de moneda)',
                'Bs',
                'Unidades por US$',
                'Variación contra el dato anterior (%)',
                'Variación contra hace un mes (%)',
                'Variación contra hace un año (%)',
                'Fecha',
              ],
              filas: coinRows.map((row) => [
                row.one.label,
                row.one.iso,
                row.one.country,
                row.scale,
                celda(row.bs),
                celda(row.units),
                celda(row.day),
                celda(row.month),
                celda(row.year),
                row.last[0],
              ]),
            })}
          >
            <ViewToggle
              chart={<CoinChangeChart rows={coinRows} />}
              table={
                <div className="table-wrap">
                  <table className="grid-table">
                    <thead>
                      <tr>
                        <th>Moneda</th>
                        <th>País</th>
                        <th>Por</th>
                        <th className="num">Bs</th>
                        <th className="num">Por USD</th>
                        <th className="num">Var. anterior</th>
                        <th className="num">Var. mes</th>
                        <th className="num">Var. año</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coinRows.map(({ one, last, scale, bs, units, day, month, year }) => (
                        <tr key={one.iso} title={one.note}>
                          <td>
                            <b>{one.label}</b> <span className="muted">{one.iso}</span>
                          </td>
                          <td>{one.country}</td>
                          <td>{scale === 1 ? '1' : number(scale, 0)}</td>
                          <td className="num">
                            <b>{number(bs, decimalsFor([bs]))}</b>
                          </td>
                          <td className="num">
                            {units === null ? '—' : number(units, units >= 100 ? 1 : 3)}
                          </td>
                          <td className="num">{signed(day)}</td>
                          <td className="num">{signed(month)}</td>
                          <td className="num">{signed(year)}</td>
                          <td>{sayDate(last[0])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

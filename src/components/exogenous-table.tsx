'use client';

import { useState } from 'react';
import { DivergingBars } from './charts';
import { MAX_BARRAS, MacroViewChart } from './macro-view-chart';
import { Panel } from '@/components/ui/panel';
import { celda } from '@/components/ui/panel-data';
import { ViewToggle } from '@/components/ui/view-toggle';
import { SCOPES, sayPeriod, summarize } from '@/lib/exogenous-board';
import type { ExogenousSeries } from '@/lib/exogenous-board';

/**
 * Todas las lecturas del recorte, con la última cifra y cómo se movió.
 *
 * El gráfico dibuja seis; la tabla no tiene tope, porque es donde el lector
 * compara de un vistazo el precio de la papa en cuatro ciudades o las cinco
 * resinas que el país importa. Las variaciones son contra el periodo anterior,
 * contra hace un año y contra el promedio de los cinco años previos: la
 * tercera dice si el precio de hoy es alto para su propia historia, que es lo
 * que la primera no dice.
 */

const SCOPE_LABEL = new Map(SCOPES.map((one) => [one.key, one.label]));

const number = (value: number): string => {
  const top = Math.abs(value);
  return new Intl.NumberFormat('es-BO', {
    maximumFractionDigits: top >= 1000 ? 0 : top >= 10 ? 1 : top >= 1 ? 2 : 3,
  }).format(value);
};

/** Quién publica las series de un panel, sin inventar: lo que cada serie declara. */
export function sourcesOf(series: readonly ExogenousSeries[]): string {
  const names = [
    ...new Set(series.map((one) => one.publisher).filter((name): name is string => Boolean(name))),
  ];
  if (names.length === 0) return 'Observatorio Económico de Bolivia (ver «Método»)';
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} y otras ${names.length - 3} fuentes`;
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <td className="num">—</td>;
  const sign = value > 0 ? '+' : '';
  return (
    <td className="num">
      {sign}
      {new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 }).format(value)} %
    </td>
  );
}

/** Contra qué se mide el cambio de cada lectura: las tres columnas de variación de la tabla. */
const COMPARISONS = [
  { key: 'yearChange', label: 'Contra hace un año' },
  { key: 'change', label: 'Contra el periodo anterior' },
  {
    key: 'versusFiveYears',
    label: 'Contra el promedio de 5 años',
  },
] as const;

/**
 * Las variaciones de la tabla como barras: cuánto se movió cada lectura, a un lado y otro del cero.
 *
 * Las lecturas no comparten unidad —dólares por tonelada, por barril, índices—, pero su cambio en
 * porcentaje sí; por eso se dibuja el cambio y no el precio, y el precio va en el emergente. Se
 * eligen las doce que más se movieron, y la tabla trae todas.
 */
function ChangeChart({ rows }: { rows: readonly ExogenousSeries[] }) {
  const [key, setKey] = useState<(typeof COMPARISONS)[number]['key']>('yearChange');
  const comparison = COMPARISONS.find((one) => one.key === key) ?? COMPARISONS[0];
  const moves = rows.flatMap((one) => {
    const summary = summarize(one);
    const value = summary[comparison.key];
    return summary.last && value !== null ? [{ one, summary, value }] : [];
  });
  const shown = [...moves]
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
    .slice(0, MAX_BARRAS);

  return (
    <>
      <div className="chips" role="group" aria-label="Contra qué se mide el cambio">
        {COMPARISONS.map((one) => (
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
        <MacroViewChart shown={shown.length} total={moves.length}>
          <DivergingBars
            data={shown.map(({ one, summary, value }) => ({
              name: one.name,
              value,
              meta: `${summary.last ? `${number(summary.last[1])} ${one.unit} · ${sayPeriod(summary.last[0])}` : ''} · ${one.market}`,
            }))}
            unit="%"
            height={Math.max(140, shown.length * 28 + 56)}
          />
        </MacroViewChart>
      ) : (
        <div className="callout">Ninguna lectura tiene esta comparación todavía.</div>
      )}
    </>
  );
}

export function ExogenousTable({ series }: { series: readonly ExogenousSeries[] }) {
  if (!series.length) return null;
  const rows = series.filter((one) => summarize(one).last);

  /** Lo que muestra la tabla, con el valor sin redondear, para el archivo que se baja. */
  const dataset = () => ({
    unidad: 'cada lectura en su unidad; las variaciones en %',
    columnas: [
      'Lectura',
      'Ámbito',
      'Mercado',
      'Unidad',
      'Periodo',
      'Último',
      'Variación contra el periodo anterior (%)',
      'Variación contra hace un año (%)',
      'Variación contra el promedio de 5 años (%)',
      'Publica',
    ],
    filas: rows.map((one) => {
      const summary = summarize(one);
      return [
        one.name,
        SCOPE_LABEL.get(one.scope) ?? one.scope,
        one.market,
        one.unit,
        summary.last ? sayPeriod(summary.last[0]) : null,
        celda(summary.last?.[1]),
        celda(summary.change),
        celda(summary.yearChange),
        celda(summary.versusFiveYears),
        one.publisher,
      ];
    }),
    nota: '«Anterior» es el mes pasado en las lecturas mensuales y el año pasado en las de aduana.',
  });

  return (
    <Panel
      id="exogenas-tabla"
      title="Último dato de cada lectura del recorte (precio y variación en %)"
      lede="Una fila por lectura, también las que el gráfico no dibuja."
      meta={`${rows.length} lectura${rows.length === 1 ? '' : 's'}`}
      source={sourcesOf(rows)}
      data={dataset}
    >
      <ViewToggle
        chart={<ChangeChart rows={rows} />}
        table={
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Lectura</th>
                  <th>Ámbito</th>
                  <th>Mercado</th>
                  <th className="num">Último</th>
                  <th>Unidad</th>
                  <th>Periodo</th>
                  <th className="num">vs. anterior</th>
                  <th className="num">vs. hace un año</th>
                  <th className="num">vs. promedio 5 años</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((one) => {
                  const summary = summarize(one);
                  if (!summary.last) return null;
                  return (
                    <tr key={one.code} title={one.note}>
                      <td>
                        {one.sourceUrl ? (
                          <a href={one.sourceUrl} target="_blank" rel="noreferrer">
                            {one.name}
                          </a>
                        ) : (
                          one.name
                        )}
                      </td>
                      <td>{SCOPE_LABEL.get(one.scope) ?? one.scope}</td>
                      <td>{one.market}</td>
                      <td className="num">
                        <b>{number(summary.last[1])}</b>
                      </td>
                      <td>{one.unit}</td>
                      <td>{sayPeriod(summary.last[0])}</td>
                      <Change value={summary.change} />
                      <Change value={summary.yearChange} />
                      <Change value={summary.versusFiveYears} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        }
      />
      <p className="panel-note">
        «Anterior» es el mes pasado en las lecturas mensuales y el año pasado en las de aduana.
      </p>
    </Panel>
  );
}

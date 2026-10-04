'use client';

import { Panel } from '@/components/ui/panel';
import { celda } from '@/components/ui/panel-data';
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
      <p className="panel-note">
        «Anterior» es el mes pasado en las lecturas mensuales y el año pasado en las de aduana.
      </p>
    </Panel>
  );
}

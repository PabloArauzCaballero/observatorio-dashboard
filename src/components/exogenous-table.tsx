'use client';

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
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Último dato de cada lectura del recorte (precio y variación en %)</h2>
        <p className="panel-sub">
          Una fila por lectura, también las que el gráfico no dibuja. «Anterior» es el mes pasado en
          las mensuales y el año pasado en las de aduana.
        </p>
      </div>
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
            {series.map((one) => {
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
    </div>
  );
}

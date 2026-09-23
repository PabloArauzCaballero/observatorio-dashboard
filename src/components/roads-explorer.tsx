'use client';

import { useMemo, useState } from 'react';
import { MacroChart } from './charts';
import { DerivedReading } from './derived-reading';
import { Icon } from './icons';
import type { IconName } from './icons';
import { RoadsMap } from './roads-map';
import type { RoadBoard } from '@/lib/roads-board';

/**
 * La red vial: mapa, tabla de rutas y cuadro de mando.
 *
 * Un solo filtro —departamento, ruta— gobierna el mapa y la tabla a la vez,
 * como en «Bolivia por departamento»: el lector elige dónde mirar y todo lo
 * de abajo habla de eso, en vez de tener que leer un mapa y una tabla que no
 * se corresponden.
 */

const CONCLUSION_ICON: Record<string, IconName> = {
  pavimento: 'capas',
  concentracion: 'mapa',
  sin_referencia: 'campana',
  ine: 'banco',
};

const number = (value: number, decimals = 0): string =>
  value.toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export function RoadsExplorer({ board }: { board: RoadBoard }) {
  const [department, setDepartment] = useState<string | null>(null);
  const [route, setRoute] = useState<string | null>(null);

  const routeOptions = useMemo(
    () =>
      board.routes
        .filter((one) => !department || one.departments.includes(department))
        .map((one) => one.route),
    [board.routes, department],
  );

  const visibleRoutes = useMemo(
    () =>
      board.routes.filter(
        (one) => (!department || one.departments.includes(department)) && (!route || one.route === route),
      ),
    [board.routes, department, route],
  );

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Red vial de Bolivia</h2>
          <p className="panel-sub">
            Las vías principales (motorway, trunk, primary, secondary) que OpenStreetMap traza dentro
            del país, cortadas por departamento y agrupadas en tramos que comparten ruta, rodadura y
            estado. El Sistema de Información Vial y la Transitabilidad de la ABC no respondieron al
            construir este corpus, así que la geometría viene de OpenStreetMap y el kilometraje
            oficial, por separado, del INE.
          </p>
        </div>
        <DerivedReading
          title="Qué dice esta red"
          note="Cada frase sale de los tramos y de la serie del INE de este capítulo. Dice cuánto hay y dónde se concentra; no dice el estado de transitabilidad del día."
          conclusions={board.conclusions}
          icons={CONCLUSION_ICON}
          defaultOpen={false}
        />
      </div>

      <div className="grid-three">
        <div className="panel stat">
          <span className="stat-label">Km trazados (red principal)</span>
          <span className="stat-value">{number(board.totalKm)} km</span>
          <span className="stat-hint">motorway, trunk, primary, secondary · OpenStreetMap</span>
        </div>
        <div className="panel stat">
          <span className="stat-label">Pavimentado</span>
          <span className="stat-value">{board.pavedShare.toFixed(1).replace('.', ',')} %</span>
          <span className="stat-hint">de lo trazado, no de la red total del país</span>
        </div>
        <div className="panel stat">
          <span className="stat-label">Longitud oficial (INE, {board.asOfPeriod ?? '—'})</span>
          <span className="stat-value">
            {board.annual.find((one) => one.surface === 'TOTAL')?.data.at(-1)
              ? number(board.annual.find((one) => one.surface === 'TOTAL')!.data.at(-1)!.value)
              : '—'}{' '}
            km
          </span>
          <span className="stat-hint">Red Fundamental y Departamental, ABC y SEDECA vía el INE</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Mapa por tipo de superficie</h2>
          <p className="panel-sub">
            El ancho de la línea marca la Red Fundamental frente a la Departamental y las vías sin
            referencia oficial; el trazo discontinuo marca lo que sigue en construcción.
          </p>
        </div>
        <div className="chips">
          <button
            type="button"
            aria-pressed={department === null}
            className={department === null ? 'chip chip-on' : 'chip'}
            onClick={() => setDepartment(null)}
          >
            Todo el país
          </button>
          {board.kmByDepartment.map((one) => (
            <button
              key={one.department}
              type="button"
              aria-pressed={department === one.department}
              className={department === one.department ? 'chip chip-on' : 'chip'}
              onClick={() => setDepartment(department === one.department ? null : one.department)}
            >
              <Icon name="mapa" size={13} /> {one.name}
            </button>
          ))}
        </div>
        {route ? (
          <div className="chips">
            <button type="button" className="chip chip-on" onClick={() => setRoute(null)}>
              Ruta {route} · quitar filtro
            </button>
          </div>
        ) : null}
        <RoadsMap sections={board.sections} department={department} route={route} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Rutas {department ? `en ${board.kmByDepartment.find((one) => one.department === department)?.name ?? department}` : '(todo el país)'}</h2>
          <p className="panel-sub">
            Longitud por rodadura de cada ruta con referencia F-n (Fundamental) o Dn (Departamental).
            Toca una fila para verla resaltada en el mapa.
          </p>
        </div>
        <div className="table-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Ruta</th>
                <th>Red</th>
                <th>Departamentos</th>
                <th className="num">Pavimento</th>
                <th className="num">Ripio</th>
                <th className="num">Tierra</th>
                <th className="num">Otra</th>
                <th className="num">Total km</th>
              </tr>
            </thead>
            <tbody>
              {visibleRoutes.slice(0, 80).map((one) => {
                const paved = one.bySurface.PAVIMENTO ?? 0;
                const gravel = one.bySurface.RIPIO ?? 0;
                const earth = one.bySurface.TIERRA ?? 0;
                const other = one.totalKm - paved - gravel - earth;
                return (
                  <tr key={one.route}>
                    <td>
                      <button
                        type="button"
                        className="chip"
                        aria-pressed={route === one.route}
                        onClick={() => setRoute(route === one.route ? null : one.route)}
                      >
                        {one.route}
                      </button>
                    </td>
                    <td>{one.network === 'FUNDAMENTAL' ? 'Fundamental' : 'Departamental'}</td>
                    <td>{one.departments.join(', ')}</td>
                    <td className="num">{number(paved, 1)}</td>
                    <td className="num">{number(gravel, 1)}</td>
                    <td className="num">{number(earth, 1)}</td>
                    <td className="num">{number(other, 1)}</td>
                    <td className="num">
                      <b>{number(one.totalKm, 1)}</b>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {routeOptions.length > 80 ? (
          <p className="panel-sub">Mostrando las 80 rutas más largas de {routeOptions.length}.</p>
        ) : null}
      </div>

      {board.annual.length ? (
        <div className="panel">
          <div className="panel-head">
            <h2>Longitud oficial de caminos, 2000-{board.asOfPeriod ?? '—'} (INE)</h2>
            <p className="panel-sub">
              Kilómetros de la Red Fundamental y Departamental juntas. No es la misma cifra que el
              mapa de arriba: ésta es el inventario oficial y aquélla, lo que OpenStreetMap ha
              trazado.
            </p>
          </div>
          <div className="grid-two">
            {board.annual.map((serie) => (
              <div key={serie.surface}>
                <p className="panel-sub">
                  {serie.surface === 'TOTAL'
                    ? 'Total'
                    : serie.surface === 'PAVIMENTO'
                      ? 'Pavimento'
                      : serie.surface === 'RIPIO'
                        ? 'Ripio'
                        : 'Tierra'}
                </p>
                {serie.data.length > 1 ? (
                  <MacroChart data={serie.data} unit="km" tone="var(--official)" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

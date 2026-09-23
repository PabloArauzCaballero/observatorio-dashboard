'use client';

import { useMemo, useState } from 'react';
import { percent } from './exporters-explorer';
import { Icon } from './icons';
import type { ExportersBoard, ReputationSeat } from '@/lib/exporters-board';

/**
 * Quién está mejor visto, y las pocas exportadoras que también lo están.
 *
 * Tres paneles en ese orden, y el orden es el argumento. Primero el ránking
 * general de Merco, que es lo que el público conoce. Después el sectorial, que
 * vale más para un tablero económico porque el general está dominado por
 * marcas de consumo. Y al final el cruce con las exportadoras, que es corto
 * —ocho empresas de cien— y es el hallazgo: lo que Bolivia vende lo extraen y
 * lo muelen empresas que ningún consumidor sabría nombrar, mientras las que el
 * país reconoce venden cerveza, gaseosa y crédito puertas adentro.
 *
 * Estaba en la misma página que el ránking de exportadoras
 * (`exporters-explorer.tsx`) y se separó. La reputación es **percibida**: se
 * mide con encuestas a públicos que conocen la marca, y un lector que la viera
 * pegada a un orden salido de registros aduaneros supondría un vínculo que no
 * existe entre puesto exportador y puesto de reputación. Dos pestañas dicen que
 * son dos medidas. El cruce vive aquí y no allá porque es esta lista la que
 * hace la pregunta —«¿cuántas de las que el país reconoce son las que venden
 * afuera?»— y la respuesta se lee sobre los puestos de reputación.
 *
 * Las dos páginas leen el mismo `/api/exportadoras`: el cuerpo viaja con
 * `Cache-Control: private, max-age=600`, así que cambiar de una a otra no
 * vuelve a consultar el servidor.
 */

/**
 * El ránking general, agrupado por edición.
 *
 * Dos ediciones y no una porque una posición sola no dice nada: que Embol
 * subiera del cuarto puesto al segundo y Sofía bajara del segundo al cuarto es
 * el dato, y hace falta el año anterior para verlo.
 */
function byEdition(seats: readonly ReputationSeat[]): Array<[number, ReputationSeat[]]> {
  const editions = new Map<number, ReputationSeat[]>();
  for (const seat of seats) {
    const own = editions.get(seat.year) ?? [];
    own.push(seat);
    editions.set(seat.year, own);
  }
  return [...editions.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([year, own]) => [year, own.sort((left, right) => left.rank - right.rank)]);
}

/** El movimiento de una empresa entre las dos ediciones publicadas. */
function movement(seats: readonly ReputationSeat[], slug: string, year: number): string | null {
  const before = seats
    .filter((seat) => seat.slug === slug && seat.year < year)
    .sort((left, right) => right.year - left.year)[0];
  const now = seats.find((seat) => seat.slug === slug && seat.year === year);
  if (!before || !now) return null;
  const change = before.rank - now.rank;
  if (change === 0) return 'se mantiene';
  return change > 0 ? `sube ${change}` : `baja ${Math.abs(change)}`;
}

export function ReputationExplorer({ board }: { board: ExportersBoard }) {
  const [sector, setSector] = useState<string | null>(null);

  const sectorNames = useMemo(
    () => [...new Set(board.sectors.map((seat) => seat.sector).filter(Boolean))] as string[],
    [board],
  );

  const shown = sector ? board.sectors.filter((seat) => seat.sector === sector) : board.sectors;
  const editions = byEdition(board.general);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Reputación empresarial: el ránking general</h2>
          <p className="panel-sub">
            Merco (Monitor Empresarial de Reputación Corporativa) publica cien empresas por edición,
            con cinco evaluaciones, trece fuentes de información, más de mil seiscientas encuestas y
            revisión independiente de KPMG bajo norma ISAE 3000. Mide{' '}
            <strong>reputación percibida</strong>: no es una medida de tamaño, de solvencia ni de
            conducta, y por eso su cabeza son marcas que el público conoce. Aquí van las diez
            primeras de cada edición publicada en abierto.
          </p>
        </div>
        {editions.length ? (
          <div className="grid-two">
            {editions.map(([year, seats]) => (
              <div key={year}>
                <h3 className="card-head">
                  <Icon name="calendario" size={15} /> Edición {year}
                </h3>
                <ol className="rank-list">
                  {seats.map((seat) => {
                    const move = movement(board.general, seat.slug, seat.year);
                    return (
                      <li key={seat.slug}>
                        <span className="rank-position">{seat.rank}</span>
                        <span>{seat.name}</span>
                        {move ? <span className="stat-hint"> · {move}</span> : null}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        ) : (
          <div className="callout">Todavía no hay ránking general de reputación cargado.</div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Reputación por sector ({board.reputationYear ?? '—'})</h2>
          <p className="panel-sub">
            El ránking sectorial vale más que el general para un tablero económico: el general está
            dominado por marcas de consumo y deja fuera media economía, mientras que aquí aparecen
            la primera minera, la primera aceitera, la primera constructora y la primera
            aseguradora.
          </p>
        </div>
        {board.sectors.length ? (
          <>
            <div className="chips">
              <button
                type="button"
                aria-pressed={sector === null}
                className={sector === null ? 'chip chip-on' : 'chip'}
                onClick={() => setSector(null)}
              >
                Todos los sectores
              </button>
              {sectorNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={sector === name}
                  className={sector === name ? 'chip chip-on' : 'chip'}
                  onClick={() => setSector(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sector</th>
                    <th>Puesto</th>
                    <th>Empresa</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((seat) => (
                    <tr key={`${seat.sector}-${seat.slug}`}>
                      <td>{seat.sector}</td>
                      <td>{seat.rank}</td>
                      <td>{seat.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="callout">Todavía no hay ránking sectorial de reputación cargado.</div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Las que están en las dos listas</h2>
          <p className="panel-sub">
            Empresas del monitor de reputación que además figuran entre las cien mayores
            exportadoras de la pestaña «Exportadoras». Son <strong>{board.crossings.length}</strong>{' '}
            de las {board.exporters.length} del ránking exportador, y esa escasez es el hallazgo del
            capítulo: lo que el país vende afuera lo producen empresas que el público no reconoce,
            y lo que el público reconoce se vende puertas adentro.
          </p>
        </div>
        {board.crossings.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Puesto en reputación</th>
                  <th>Sector</th>
                  <th>Puesto exportador</th>
                  <th>Cuota exportada</th>
                </tr>
              </thead>
              <tbody>
                {board.crossings.map((row) => (
                  <tr key={row.slug}>
                    <td>{row.name}</td>
                    <td>{row.reputationRank}</td>
                    <td>{row.sector ?? 'Ránking general'}</td>
                    <td>{row.exportRank}</td>
                    <td>{percent(row.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="callout">
            {board.exporters.length
              ? 'Ninguna de las exportadoras del ránking aparece en el monitor de reputación con los datos cargados hoy.'
              : 'El cruce se llena cuando el núcleo haya sembrado también el registro de exportadoras.'}
          </div>
        )}
      </div>
    </>
  );
}

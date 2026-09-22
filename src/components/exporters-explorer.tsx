'use client';

import { useMemo, useState } from 'react';
import { ShareBars } from './charts';
import { Icon } from './icons';
import { concentration } from '@/lib/exporters-board';
import type { ExportersBoard, ReputationSeat } from '@/lib/exporters-board';

/**
 * Quién exporta más, quién está mejor visto, y las pocas que son las dos cosas.
 *
 * Tres paneles en ese orden, y el orden es el argumento. Primero el ránking de
 * exportadoras, que es lo que se preguntó. Después el monitor de reputación,
 * que mide otra cosa con otro método. Y al final el cruce, que es corto —ocho
 * empresas de cien— y es el hallazgo: lo que Bolivia vende lo extraen y lo
 * muelen empresas que ningún consumidor sabría nombrar, mientras las que el
 * país reconoce venden cerveza, gaseosa y crédito puertas adentro.
 *
 * **Por qué no hay dólares en ninguna barra.** Bolivia no publica sus
 * exportaciones por empresa: la declaración aduanera individual está amparada
 * por reserva, y lo comprobamos en el INE, en la Aduana Nacional, en el portal
 * de comercio exterior del Ministerio de Desarrollo Productivo y en el Anuario
 * de Minería. La única lista completa con nombres es la de un agregador
 * comercial, y su total de 2024 no cuadra con el del INE sin que la fuente
 * declare sobre qué base está calculado. El orden y la cuota son consistentes
 * consigo mismos y se publican; los dólares no se sostienen y no se publican.
 * El aviso de arriba lo dice en el tablero, no sólo aquí.
 */

const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const percent = (value: number): string => `${number(value, 1)} %`;

/** Cuántas exportadoras entran en la figura sin que deje de leerse. */
const SHOWN = 20;

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

export function ExportersExplorer({ board }: { board: ExportersBoard }) {
  const [sector, setSector] = useState<string | null>(null);

  const bars = useMemo(
    () =>
      board.exporters.slice(0, SHOWN).map((row) => ({
        name: `${row.rank}. ${row.name}`,
        value: row.share,
        ...(board.crossings.some((cross) => cross.slug === row.slug) ? { emphasis: true } : {}),
      })),
    [board],
  );

  const sectorNames = useMemo(
    () => [...new Set(board.sectors.map((seat) => seat.sector).filter(Boolean))] as string[],
    [board],
  );

  const marked = bars.filter((bar) => 'emphasis' in bar).length;
  const shown = sector ? board.sectors.filter((seat) => seat.sector === sector) : board.sectors;
  const editions = byEdition(board.general);
  const topTen = concentration(board, 10);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Las mayores exportadoras de Bolivia</h2>
          <p className="panel-sub">
            Orden y cuota de las cien primeras en la gestión {board.exportYear ?? '—'}. Las diez
            primeras concentran el {percent(topTen)} de lo exportado.
          </p>
        </div>
        {/*
          El aviso va arriba del gráfico y no en un pie, porque es la condición
          bajo la cual hay que leer todo lo que sigue. Un lector que llegue a la
          figura sin él creerá que está viendo cifras oficiales.
        */}
        <div className="callout">
          <strong>Bolivia no publica sus exportaciones por empresa.</strong> El INE llega a
          producto, departamento y país de destino; la Aduana Nacional publica agregados; el Anuario
          de Minería separa por actor productivo —estatal, privado, cooperativo— pero nunca por
          razón social, porque la declaración aduanera individual está amparada por reserva. Esta
          lista viene de un agregador comercial de registros aduaneros, y de ella se publica{' '}
          <strong>el orden y la cuota, no los dólares</strong>: el total que esa misma fuente
          declara para {board.exportYear ?? 'la gestión'} no cuadra con el del INE y no dice sobre
          qué base está calculado.
        </div>
        {bars.length ? (
          <ShareBars data={bars} unit="%" height={520} />
        ) : (
          <div className="callout">Todavía no hay ránking de exportadoras cargado.</div>
        )}
        {/*
          El recuento dice cuántas de las barras DIBUJADAS van marcadas, y
          aparte cuántas hay en toda la lista. Decir sólo lo segundo dejaba al
          lector contando una marca en pantalla contra una promesa de ocho.
        */}
        <p className="panel-sub">
          Se dibujan las {Math.min(SHOWN, board.exporters.length)} primeras de{' '}
          {board.exporters.length}. Las barras marcadas son las que además están medidas por el
          monitor de reputación: {marked} aquí, {board.crossings.length} en la lista entera. El
          cruce completo está en el último panel.
        </p>
      </div>

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
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Las que están en las dos listas</h2>
          <p className="panel-sub">
            Exportadoras que además aparecen medidas por Merco. Son{' '}
            <strong>{board.crossings.length}</strong> de las {board.exporters.length} del ránking, y
            esa escasez es el hallazgo del capítulo: lo que el país vende afuera lo producen
            empresas que el público no reconoce, y lo que el público reconoce se vende puertas
            adentro.
          </p>
        </div>
        {board.crossings.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Puesto exportador</th>
                  <th>Cuota</th>
                  <th>Puesto en reputación</th>
                  <th>Sector</th>
                </tr>
              </thead>
              <tbody>
                {board.crossings.map((row) => (
                  <tr key={row.slug}>
                    <td>{row.name}</td>
                    <td>{row.exportRank}</td>
                    <td>{percent(row.share)}</td>
                    <td>{row.reputationRank}</td>
                    <td>{row.sector ?? 'Ránking general'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="callout">
            Ninguna de las exportadoras del ránking aparece en el monitor de reputación con los
            datos cargados hoy.
          </div>
        )}
      </div>
    </>
  );
}

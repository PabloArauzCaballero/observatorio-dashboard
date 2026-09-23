'use client';

import { useMemo, useState } from 'react';

import { CandleReading, DayCandles } from './charts';
import { CANDLE_DAILY_LIMIT, CANDLE_WEEK_LIMIT, sessionCandles } from '@/lib/candles';
import type { CandleSession } from '@/lib/candles';

/**
 * Una serie de nivel de precio leída como velas, con su ventana y su pie.
 *
 * El panel del paralelo ya sabe hacer esto, pero lo hace con su propio riel de
 * filtros, su zoom compartido con la línea y un pie escrito para el paralelo.
 * Las fichas por riel y el nivel real no tienen nada de eso: son paneles de
 * una sola serie sin filtros, y lo que necesitan es lo mínimo que hace útil
 * una vela para un análisis variacional: elegir la ventana, ver una vela por
 * jornada o por semana según quepan, y leer debajo cuánto se movió el precio
 * en ese tramo. Eso es lo que compone este componente, con las mismas piezas
 * que el paralelo —`sessionCandles`, `DayCandles`, `CandleReading`— para que
 * las tres vistas agrupen y resuman con la misma regla.
 *
 * Convención de la vela, que el pie repite: el cuerpo va del punto medio de
 * la jornada anterior al de esta; la mecha va del menor al mayor de los
 * precios publicados ese día —compra y venta, cuando la fuente los trae—.
 * Sin lados publicados la mecha es el propio cuerpo, y el pie lo dice en vez
 * de estirarla.
 */

const RANGES: ReadonlyArray<{ key: string; label: string; days: number | null }> = [
  { key: '90d', label: '90 días', days: 90 },
  { key: '1a', label: '1 año', days: 365 },
  { key: 'todo', label: 'Todo', days: null },
];

export interface LevelCandlesProps {
  sessions: readonly CandleSession[];
  unit: string;
  decimals?: number;
  /**
   * Qué son los lados que forman la mecha, dicho en el pie: «la compra y la
   * venta medianas de la jornada», por ejemplo. Sin él la serie no publica
   * lados y el pie explica que la mecha coincide con el cuerpo.
   */
  sidesNote?: string;
  /** La ventana con la que se abre; «todo» si no se dice. */
  defaultRange?: '90d' | '1a' | 'todo';
}

export function LevelCandles({
  sessions,
  unit,
  decimals = 2,
  sidesNote,
  defaultRange = 'todo',
}: LevelCandlesProps) {
  const [range, setRange] = useState<string>(defaultRange);

  /** El corte que la ventana implica, como fecha sobre la que se recorta la serie. */
  const floor = useMemo(() => {
    const days = RANGES.find((entry) => entry.key === range)?.days ?? null;
    const last = sessions.at(-1)?.date;
    if (days === null || !last) return null;
    const cut = new Date(`${last}T12:00:00Z`);
    cut.setUTCDate(cut.getUTCDate() - days);
    return cut.toISOString().slice(0, 10);
  }, [range, sessions]);

  const chosen = useMemo(
    () => (floor === null ? sessions : sessions.filter((session) => session.date >= floor)),
    [sessions, floor],
  );
  const set = useMemo(() => sessionCandles(chosen), [chosen]);
  const weekly = set.grouping === 'SEMANA';

  /** Cuántas jornadas dejaría cada ventana, para que ninguna se elija a ciegas. */
  const countFor = (days: number | null): number => {
    const last = sessions.at(-1)?.date;
    if (days === null || !last) return sessions.length;
    const cut = new Date(`${last}T12:00:00Z`);
    cut.setUTCDate(cut.getUTCDate() - days);
    const from = cut.toISOString().slice(0, 10);
    return sessions.filter((session) => session.date >= from).length;
  };

  return (
    <div className="chart-stack">
      <div className="candle-ranges" role="group" aria-label="Ventana de las velas">
        {RANGES.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={range === entry.key ? 'chip chip-on' : 'chip'}
            onClick={() => setRange(entry.key)}
            title={`${countFor(entry.days).toLocaleString('es-BO')} jornadas`}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <p className="panel-sub" style={{ marginBottom: 'var(--s1)' }}>
        {weekly ? (
          <>
            Una vela por <b>semana</b>: abre en el punto medio de su primera jornada, cierra en el
            de la última, y la mecha va del mínimo al máximo que el precio alcanzó dentro de esa
            semana. Con más de {CANDLE_DAILY_LIMIT} jornadas se agrupa así porque, con una
            cotización por día, el cierre de una vela diaria <b>es</b> la apertura de la siguiente
            y los cuerpos se pegan en una cinta continua.
            {set.clipped ? (
              <> Se dibujan las últimas {CANDLE_WEEK_LIMIT} semanas. </>
            ) : (
              ' '
            )}
            Elegí «90 días» para verlas jornada por jornada.
          </>
        ) : (
          <>
            Una vela por <b>jornada</b>. El cuerpo va del punto medio de la jornada anterior al de
            esta, así que su altura <b>es</b> la variación del día;{' '}
            {sidesNote ? (
              <>
                la mecha va del menor al mayor de los precios publicados ese día —{sidesNote}—, de
                modo que una mecha larga es una jornada en la que compra y venta se separaron.
              </>
            ) : (
              <>
                la serie no publica lados, así que la mecha coincide con el cuerpo en vez de
                estirarse con precios que nadie cotizó.
              </>
            )}
          </>
        )}{' '}
        <b>No es una vela intradía</b>: el observatorio guarda una lectura por día, y dibujar cuatro
        precios a partir de una sola cotización sería inventarlos.
      </p>
      <DayCandles data={set.candles} unit={unit} />
      <CandleReading data={set.candles} unit={unit} grouping={set.grouping} decimals={decimals} />
    </div>
  );
}

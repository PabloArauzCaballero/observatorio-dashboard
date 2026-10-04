'use client';

import { ChartLegend } from './charts';
import { CompanyLogo } from './company-logo';
import styles from './business.module.css';

/**
 * Los diez primeros de un ránking en un periodo: puesto, nombre, la cifra como
 * barra frente al primero y cuánto se movió cada uno desde el periodo anterior.
 *
 * Es la lista con la que abre «Empresarios», hecha pieza para que todo ránking
 * del tablero abra igual —contribuyentes, «Las 500», Merco, exportadoras— y
 * debajo lleve sus cintas (`RankRibbons`).
 */

export const TOP_TEN = 10;

export interface TopTenRow {
  key: string;
  rank: number;
  name: string;
  /** Lo que va debajo del nombre: el sector, la mayor empresa. */
  detail?: string | undefined;
  value: number;
  /** La cifra escrita con su unidad. */
  shown: string;
  /** El puesto en el periodo anterior; `undefined` si no estaba. */
  before?: number | undefined;
  /** El logotipo, cuando la fila es una empresa con marca conocida. */
  logo?: boolean | undefined;
}

export function TopTen({
  rows,
  periods,
  period,
  onPeriod,
  label = String,
  previous,
  selected,
  onPick,
  legend,
}: {
  rows: readonly TopTenRow[];
  /** Los periodos que se pueden elegir, del más nuevo al más viejo. */
  periods: readonly number[];
  period: number;
  onPeriod: (period: number) => void;
  label?: (period: number) => string;
  /** El periodo contra el que se mide el movimiento; `null` si es el primero. */
  previous: number | null;
  selected?: string | null;
  onPick?: (key: string) => void;
  /** Qué mide la barra, con su unidad: va en la leyenda. */
  legend: string;
}) {
  const peak = Math.max(...rows.map((row) => Math.abs(row.value)), 1e-9);
  return (
    <>
      {periods.length > 1 ? (
        <div className={styles.topBar}>
          <label className={styles.topYear}>
            <span>Año</span>
            <select value={period} onChange={(event) => onPeriod(Number(event.target.value))}>
              {periods.map((one) => (
                <option key={one} value={one}>
                  {label(one)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <ol className={styles.topList}>
        {rows.map((row) => {
          const moved = row.before === undefined ? null : row.before - row.rank;
          const who = (
            <>
              <strong>{row.name}</strong>
              {row.detail ? <small>{row.detail}</small> : null}
            </>
          );
          return (
            <li key={row.key} className={styles.topRow}>
              <span className={styles.topRank}>{row.rank}.º</span>
              <span className={styles.topWho}>
                {row.logo ? <CompanyLogo slug={row.key} name={row.name} size={28} /> : null}
                {onPick ? (
                  <button
                    type="button"
                    className={styles.personButton}
                    aria-pressed={selected === row.key}
                    onClick={() => onPick(row.key)}
                  >
                    {who}
                  </button>
                ) : (
                  <span className={styles.personButton}>{who}</span>
                )}
              </span>
              <span className={styles.topBarTrack} aria-hidden="true">
                <span style={{ width: `${Math.max(2, (Math.abs(row.value) / peak) * 100)}%` }} />
              </span>
              <span className={styles.topValue}>{row.shown}</span>
              <span
                className={styles.topMove}
                title={
                  previous === null
                    ? 'Primer periodo publicado'
                    : row.before === undefined
                      ? `No estaba entre los primeros en ${label(previous)}`
                      : `${row.before}.º en ${label(previous)}`
                }
              >
                {previous === null
                  ? ''
                  : moved === null
                    ? 'nuevo'
                    : moved > 0
                      ? `▲ ${moved}`
                      : moved < 0
                        ? `▼ ${-moved}`
                        : '='}
              </span>
            </li>
          );
        })}
      </ol>
      <ChartLegend items={[{ color: 'var(--official)', label: legend }]} />
    </>
  );
}

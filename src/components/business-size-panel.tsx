'use client';

import { useState } from 'react';
import { HeatGrid, ShareBars, WorldLines, seriesTone } from './charts';
import type { HeatCell, WorldLineSeries } from './charts';
import { InfoPopover } from './info-popover';
import styles from './business.module.css';
import { PLACES } from '@/lib/business-fabric-board';
import type { FabricBoard } from '@/lib/business-fabric-board';

/**
 * El tamaño de las empresas, contado de las dos únicas maneras públicas.
 *
 * Ninguna fuente pública cuenta empresas por tramo de facturación año a año, y
 * la página no lo finge. Lo que hay son dos lecturas distintas, cada una con su
 * nombre:
 *
 * - **La foto del registro** (julio de 2025): micro, pequeña, mediana y gran
 *   empresa según el tamaño declarado al registro, cruzado con el gran sector,
 *   el tipo societario, el departamento y el empleo. Es un solo corte.
 * - **El padrón de Impuestos**, cada año: qué parte de los contribuyentes es
 *   PRICO, GRACO o el resto, y qué parte de la recaudación aporta cada grupo.
 *   La categoría la asigna Impuestos por volumen de operaciones e importancia
 *   fiscal; no es un tramo de ventas, pero es lo más cerca de uno que se publica
 *   todos los años.
 */

const SIZES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'GRAN', label: 'Gran empresa' },
  { key: 'MEDIANA', label: 'Mediana' },
  { key: 'PEQUENA', label: 'Pequeña' },
  { key: 'MICRO', label: 'Micro' },
  { key: 'SIN_DESIGNAR', label: 'Sin tamaño declarado' },
];

const ROLL_DIMENSIONS: Record<string, string> = {
  CAT: 'Categoría tributaria',
  PERSON: 'Tipo de persona',
  DEPT: 'Departamento',
  ACT: 'Actividad',
  ACTD: 'Actividad (detalle)',
};

const say = (value: number, decimals = 0): string =>
  value.toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export function BusinessSizePanel({ board, place }: { board: FabricBoard; place: string }) {
  const [base, setBase] = useState<'ACT' | 'VIG'>('ACT');
  const [cross, setCross] = useState<'SECTOR' | 'FORM'>('SECTOR');
  const [declaredOnly, setDeclaredOnly] = useState(true);
  const dims = [...new Set(board.taxRoll.map((row) => row.dimension))].sort(
    (left, right) => Object.keys(ROLL_DIMENSIONS).indexOf(left) - Object.keys(ROLL_DIMENSIONS).indexOf(right),
  );
  const [rollDim, setRollDim] = useState<string>('CAT');
  const rollYears = [...new Set(board.taxRoll.map((row) => row.year))].sort((left, right) => right - left);
  const [rollYear, setRollYear] = useState<number | null>(null);
  const year = rollYear ?? rollYears[0] ?? null;

  const cells = board.size.filter((cell) => cell.base === base);
  const bySize = SIZES.map((size) => ({
    ...size,
    count: cells.find((cell) => cell.row === 'SIZE' && cell.rowKey === size.key && cell.column === 'TOTAL')?.count ?? 0,
  })).filter((size) => !declaredOnly || size.key !== 'SIN_DESIGNAR');
  const sizeTotal = bySize.reduce((sum, size) => sum + size.count, 0);
  const undeclared = cells.find((cell) => cell.row === 'SIZE' && cell.rowKey === 'SIN_DESIGNAR' && cell.column === 'TOTAL')?.count ?? 0;
  const allFirms = cells.find((cell) => cell.row === 'SIZE' && cell.rowKey === 'TOTAL' && cell.column === 'TOTAL')?.count ?? 0;

  const prefix = cross === 'SECTOR' ? 'SECTOR_' : 'FORM_';
  const columns = [...new Map(cells.filter((cell) => cell.column.startsWith(prefix) && cell.column !== 'FORM_TOTAL').map((cell) => [cell.column, cell.columnLabel])).entries()];
  const heat: HeatCell[] = cells
    .filter((cell) => cell.row === 'SIZE' && cell.column.startsWith(prefix) && bySize.some((size) => size.key === cell.rowKey))
    .map((cell) => ({ row: SIZES.find((size) => size.key === cell.rowKey)?.label ?? cell.rowLabel, column: cell.columnLabel, value: cell.count }));

  const jobs = bySize
    .map((size) => {
      const people = board.jobs.find((job) => job.base === base && job.dimension === 'TAMANIO' && job.key === size.key && job.kind === 'TOTAL')?.count ?? 0;
      return {
        name: size.label,
        value: size.count ? people / size.count : 0,
        parts: [
          { name: 'Personas empleadas', value: people, unit: 'personas' },
          { name: 'Empresas', value: size.count, unit: 'empresas' },
        ],
      };
    })
    .filter((row) => row.value > 0);

  const deptCells = place === 'BOLIVIA' ? [] : cells.filter((cell) => cell.row === 'DEPT' && cell.rowKey === place && cell.column.startsWith(prefix));
  const placeName = PLACES.find((one) => one.key === place)?.label ?? place;

  const roll = board.taxRoll.filter((row) => row.dimension === rollDim && row.year === year);
  const catYears = [...new Set(board.taxRoll.filter((row) => row.dimension === 'CAT').map((row) => row.year))].sort((a, b) => a - b);
  const catKeys = [...new Map(board.taxRoll.filter((row) => row.dimension === 'CAT').map((row) => [row.key, row.label])).entries()];
  const catSeries: WorldLineSeries[] = catKeys.map(([key, label], index) => ({ key, label, tone: seriesTone(index) }));
  const catData = catYears.map((when) => {
    const row: { year: string; [key: string]: string | number | null } = { year: String(when) };
    for (const [key] of catKeys) {
      row[key] = board.taxRoll.find((one) => one.dimension === 'CAT' && one.key === key && one.year === when)?.revenue ?? null;
    }
    return row;
  });
  const taxpayers = [...board.taxpayers].sort((left, right) => right.year - left.year)[0];

  return (
    <>
      {cells.length ? (
        <div className="panel">
          <div className="panel-head panel-head-kind">
            <div>
              <h2>
                Empresas por tamaño declarado, julio de 2025 ({base === 'ACT' ? 'activas' : 'vigentes'}, cantidad)
              </h2>
              <p className="panel-sub">
                Foto del registro publicada por el Ministerio de Desarrollo Productivo. De las {say(allFirms)}{' '}
                {base === 'ACT' ? 'activas' : 'vigentes'}, {say(undeclared)} no declaran tamaño
                ({allFirms ? say((undeclared / allFirms) * 100, 1) : '—'} %).{' '}
                <InfoPopover label="Qué es el tamaño declarado">
                  <p>
                    Es la categoría que cada empresa declara al registrarse o renovar su matrícula. La fuente no publica
                    el criterio (empleo, ventas o activos), así que no es un tramo de facturación. «Activas» son las que se
                    inscribieron o renovaron; «vigentes», toda matrícula no cancelada.
                  </p>
                </InfoPopover>
              </p>
            </div>
            <div className="chart-kind" role="group" aria-label="Base">
              {(['ACT', 'VIG'] as const).map((value) => (
                <button key={value} type="button" className={base === value ? 'chip chip-on' : 'chip'} aria-pressed={base === value} onClick={() => setBase(value)}>
                  {value === 'ACT' ? 'Activas' : 'Vigentes'}
                </button>
              ))}
              <button type="button" className={declaredOnly ? 'chip chip-on' : 'chip'} aria-pressed={declaredOnly} onClick={() => setDeclaredOnly((on) => !on)}>
                Sólo con tamaño
              </button>
            </div>
          </div>
          <div className="grid-two">
            <div>
              <ShareBars
                data={bySize.map((size) => ({
                  name: size.label,
                  value: sizeTotal ? (size.count / sizeTotal) * 100 : 0,
                  parts: [{ name: 'Empresas', value: size.count, unit: 'empresas' }],
                }))}
                height={230}
              />
              <p className={styles.foot}>% de las {declaredOnly ? 'que declaran tamaño' : 'empresas de la base'}.</p>
            </div>
            <div>
              <ShareBars data={jobs} unit=" personas por empresa" decimals={1} height={230} />
              <p className={styles.foot}>Personas empleadas por empresa, según lo que cada empresa declara.</p>
            </div>
          </div>
          <div className="panel-head panel-head-kind">
            <div>
              <h3>Tamaño por {cross === 'SECTOR' ? 'gran sector' : 'tipo societario'} (cantidad de empresas)</h3>
            </div>
            <div className="chart-kind" role="group" aria-label="Cruzar con">
              {(['SECTOR', 'FORM'] as const).map((value) => (
                <button key={value} type="button" className={cross === value ? 'chip chip-on' : 'chip'} aria-pressed={cross === value} onClick={() => setCross(value)}>
                  {value === 'SECTOR' ? 'Gran sector' : 'Tipo societario'}
                </button>
              ))}
            </div>
          </div>
          <HeatGrid rows={bySize.map((size) => size.label)} columns={columns.map(([, label]) => label)} cells={heat} unit="empresas" />
          {deptCells.length ? (
            <>
              <h3 className={styles.subhead}>
                {placeName}: empresas {base === 'ACT' ? 'activas' : 'vigentes'} por {cross === 'SECTOR' ? 'gran sector' : 'tipo societario'} (julio de 2025)
              </h3>
              <ShareBars
                data={deptCells.map((cell) => ({ name: cell.columnLabel, value: cell.count })).sort((a, b) => b.value - a.value)}
                unit=" empresas"
                decimals={0}
                height={220}
              />
              <p className={styles.foot}>El registro no publica el tamaño abierto por departamento; aquí va lo que sí abre.</p>
            </>
          ) : null}
        </div>
      ) : null}

      {board.taxRoll.length ? (
        <div className="panel">
          <div className="panel-head panel-head-kind">
            <div>
              <h2>
                Padrón de Impuestos por {ROLL_DIMENSIONS[rollDim]?.toLowerCase() ?? rollDim}, {year} (% de contribuyentes y % de la
                recaudación)
              </h2>
              <p className="panel-sub">
                Servicio de Impuestos Nacionales, Memoria anual.
                {taxpayers ? ` ${say(taxpayers.count)} contribuyentes activos en ${taxpayers.year}.` : ''} PRICO y GRACO son
                las categorías que Impuestos asigna a sus principales y grandes contribuyentes por volumen de operaciones
                e importancia fiscal: no son un tramo fijo de ventas.
              </p>
            </div>
            <div className="chart-kind" role="group" aria-label="Abrir el padrón por">
              {dims.map((value) => (
                <button key={value} type="button" className={rollDim === value ? 'chip chip-on' : 'chip'} aria-pressed={rollDim === value} onClick={() => setRollDim(value)}>
                  {ROLL_DIMENSIONS[value] ?? value}
                </button>
              ))}
              <select aria-label="Año del padrón" value={year ?? ''} onChange={(event) => setRollYear(Number(event.target.value))}>
                {rollYears.map((when) => (
                  <option key={when} value={when}>{when}</option>
                ))}
              </select>
            </div>
          </div>
          {roll.length ? (
            <div className="grid-two">
              <div>
                <h3 className={styles.subhead}>Parte del padrón</h3>
                <ShareBars data={roll.filter((row) => row.roll !== null).map((row) => ({ name: row.label, value: row.roll ?? 0 })).sort((a, b) => b.value - a.value)} height={Math.max(160, roll.length * 26)} />
              </div>
              <div>
                <h3 className={styles.subhead}>Parte de la recaudación</h3>
                <ShareBars data={roll.filter((row) => row.revenue !== null).map((row) => ({ name: row.label, value: row.revenue ?? 0 })).sort((a, b) => b.value - a.value)} tone="var(--series-2)" height={Math.max(160, roll.length * 26)} />
              </div>
            </div>
          ) : (
            <div className="callout">La memoria de {year} no abre el padrón por {ROLL_DIMENSIONS[rollDim]?.toLowerCase() ?? rollDim}.</div>
          )}
          {catData.length > 1 ? (
            <>
              <h3 className={styles.subhead}>Parte de la recaudación por categoría, {catYears[0]}–{catYears.at(-1)} (%)</h3>
              <WorldLines data={catData} series={catSeries} format={(value) => `${say(value, 2)} %`} tick={(value) => `${say(value)} %`} countsOnly />
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

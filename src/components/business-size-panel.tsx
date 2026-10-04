'use client';

import { useState } from 'react';
import { ChartLegend, HeatGrid, ShareBars, WorldLines, seriesTone } from './charts';
import type { HeatCell, WorldLineSeries } from './charts';
import { Panel } from '@/components/ui/panel';
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

const SIZE_SOURCE =
  'Ministerio de Desarrollo Productivo, foto del registro de comercio (SEPREC) de julio de 2025';
const TAX_SOURCE = 'Servicio de Impuestos Nacionales, Memoria anual';

const say = (value: number, decimals = 0): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export function BusinessSizePanel({ board, place }: { board: FabricBoard; place: string }) {
  const [base, setBase] = useState<'ACT' | 'VIG'>('ACT');
  const [cross, setCross] = useState<'SECTOR' | 'FORM'>('SECTOR');
  const [declaredOnly, setDeclaredOnly] = useState(true);
  const dims = [...new Set(board.taxRoll.map((row) => row.dimension))].sort(
    (left, right) =>
      Object.keys(ROLL_DIMENSIONS).indexOf(left) - Object.keys(ROLL_DIMENSIONS).indexOf(right),
  );
  const [rollDim, setRollDim] = useState<string>('CAT');
  const rollYears = [...new Set(board.taxRoll.map((row) => row.year))].sort(
    (left, right) => right - left,
  );
  const [rollYear, setRollYear] = useState<number | null>(null);
  const year = rollYear ?? rollYears[0] ?? null;

  const cells = board.size.filter((cell) => cell.base === base);
  const bySize = SIZES.map((size) => ({
    ...size,
    count:
      cells.find(
        (cell) => cell.row === 'SIZE' && cell.rowKey === size.key && cell.column === 'TOTAL',
      )?.count ?? 0,
  })).filter((size) => !declaredOnly || size.key !== 'SIN_DESIGNAR');
  const sizeTotal = bySize.reduce((sum, size) => sum + size.count, 0);
  const undeclared =
    cells.find(
      (cell) => cell.row === 'SIZE' && cell.rowKey === 'SIN_DESIGNAR' && cell.column === 'TOTAL',
    )?.count ?? 0;
  const allFirms =
    cells.find((cell) => cell.row === 'SIZE' && cell.rowKey === 'TOTAL' && cell.column === 'TOTAL')
      ?.count ?? 0;

  const prefix = cross === 'SECTOR' ? 'SECTOR_' : 'FORM_';
  const columns = [
    ...new Map(
      cells
        .filter((cell) => cell.column.startsWith(prefix) && cell.column !== 'FORM_TOTAL')
        .map((cell) => [cell.column, cell.columnLabel]),
    ).entries(),
  ];
  const heat: HeatCell[] = cells
    .filter(
      (cell) =>
        cell.row === 'SIZE' &&
        cell.column.startsWith(prefix) &&
        bySize.some((size) => size.key === cell.rowKey),
    )
    .map((cell) => ({
      row: SIZES.find((size) => size.key === cell.rowKey)?.label ?? cell.rowLabel,
      column: cell.columnLabel,
      value: cell.count,
    }));

  const jobs = bySize
    .map((size) => {
      const people =
        board.jobs.find(
          (job) =>
            job.base === base &&
            job.dimension === 'TAMANIO' &&
            job.key === size.key &&
            job.kind === 'TOTAL',
        )?.count ?? 0;
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

  const deptCells =
    place === 'BOLIVIA'
      ? []
      : cells.filter(
          (cell) => cell.row === 'DEPT' && cell.rowKey === place && cell.column.startsWith(prefix),
        );
  const placeName = PLACES.find((one) => one.key === place)?.label ?? place;

  const roll = board.taxRoll.filter((row) => row.dimension === rollDim && row.year === year);
  const catYears = [
    ...new Set(board.taxRoll.filter((row) => row.dimension === 'CAT').map((row) => row.year)),
  ].sort((a, b) => a - b);
  const catKeys = [
    ...new Map(
      board.taxRoll.filter((row) => row.dimension === 'CAT').map((row) => [row.key, row.label]),
    ).entries(),
  ];
  const catSeries: WorldLineSeries[] = catKeys.map(([key, label], index) => ({
    key,
    label,
    tone: seriesTone(index),
  }));
  const catData = catYears.map((when) => {
    const row: { year: string; [key: string]: string | number | null } = { year: String(when) };
    for (const [key] of catKeys) {
      row[key] =
        board.taxRoll.find((one) => one.dimension === 'CAT' && one.key === key && one.year === when)
          ?.revenue ?? null;
    }
    return row;
  });
  const taxpayers = [...board.taxpayers].sort((left, right) => right.year - left.year)[0];

  const baseName = base === 'ACT' ? 'activas' : 'vigentes';
  const crossName = cross === 'SECTOR' ? 'gran sector' : 'tipo societario';
  const rollName = ROLL_DIMENSIONS[rollDim]?.toLowerCase() ?? rollDim;

  return (
    <>
      {cells.length ? (
        <section className="panel-group" aria-labelledby="tejido-tamano-titulo">
          <header className="panel-group-head">
            <h3 id="tejido-tamano-titulo">Tamaño de las empresas, julio de 2025</h3>
            <p>
              Foto del registro publicada por el Ministerio de Desarrollo Productivo. De las{' '}
              {say(allFirms)} {baseName}, {say(undeclared)} no declaran tamaño (
              {allFirms ? say((undeclared / allFirms) * 100, 1) : '—'} %).
            </p>
            <details className="panel-note">
              <summary>Qué es el tamaño declarado</summary>
              <p>
                Es la categoría que cada empresa declara al registrarse o renovar su matrícula. La
                fuente no publica el criterio (empleo, ventas o activos), así que no es un tramo de
                facturación. «Activas» son las que se inscribieron o renovaron; «vigentes», toda
                matrícula no cancelada.
              </p>
            </details>
            <div className="chart-kind" role="group" aria-label="Base">
              {(['ACT', 'VIG'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={base === value ? 'chip chip-on' : 'chip'}
                  aria-pressed={base === value}
                  onClick={() => setBase(value)}
                >
                  {value === 'ACT' ? 'Activas' : 'Vigentes'}
                </button>
              ))}
              <button
                type="button"
                className={declaredOnly ? 'chip chip-on' : 'chip'}
                aria-pressed={declaredOnly}
                onClick={() => setDeclaredOnly((on) => !on)}
              >
                Sólo con tamaño
              </button>
            </div>
          </header>

          <div className="grid-pair">
            <Panel
              id="tejido-tamano-reparto"
              title={`Empresas ${baseName} por tamaño declarado, julio de 2025 (% de las ${declaredOnly ? 'que declaran tamaño' : 'empresas de la base'})`}
              lede="Cuántas son micro, pequeñas, medianas y grandes según lo que cada una declara al registro."
              source={SIZE_SOURCE}
            >
              <ShareBars
                data={bySize.map((size) => ({
                  name: size.label,
                  value: sizeTotal ? (size.count / sizeTotal) * 100 : 0,
                  parts: [{ name: 'Empresas', value: size.count, unit: 'empresas' }],
                }))}
                height={230}
              />
              <ChartLegend
                items={[
                  {
                    color: 'var(--official)',
                    label: `Parte de las empresas ${declaredOnly ? 'que declaran tamaño' : 'de la base'} (%)`,
                  },
                ]}
              />
            </Panel>
            <Panel
              id="tejido-tamano-empleo"
              title={`Empleo por empresa según el tamaño declarado, julio de 2025 (personas por empresa)`}
              lede="Personas empleadas por empresa, según lo que cada empresa declara."
              source={SIZE_SOURCE}
            >
              <ShareBars data={jobs} unit=" personas por empresa" decimals={1} height={230} />
              <ChartLegend
                items={[{ color: 'var(--official)', label: 'Personas empleadas por empresa' }]}
              />
            </Panel>
          </div>

          <Panel
            id="tejido-tamano-cruce"
            title={`Tamaño por ${crossName}, julio de 2025 (cantidad de empresas)`}
            lede={`Cuántas empresas ${baseName} hay en cada cruce de tamaño y ${crossName}.`}
            source={SIZE_SOURCE}
          >
            <div className="chart-kind" role="group" aria-label="Cruzar con">
              {(['SECTOR', 'FORM'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cross === value ? 'chip chip-on' : 'chip'}
                  aria-pressed={cross === value}
                  onClick={() => setCross(value)}
                >
                  {value === 'SECTOR' ? 'Gran sector' : 'Tipo societario'}
                </button>
              ))}
            </div>
            <HeatGrid
              rows={bySize.map((size) => size.label)}
              columns={columns.map(([, label]) => label)}
              cells={heat}
              unit="empresas"
            />
          </Panel>

          {deptCells.length ? (
            <Panel
              id="tejido-tamano-departamento"
              title={`${placeName}: empresas ${baseName} por ${crossName}, julio de 2025 (cantidad de empresas)`}
              lede="El registro no publica el tamaño abierto por departamento; aquí va lo que sí abre."
              source={SIZE_SOURCE}
            >
              <ShareBars
                data={deptCells
                  .map((cell) => ({ name: cell.columnLabel, value: cell.count }))
                  .sort((a, b) => b.value - a.value)}
                unit=" empresas"
                decimals={0}
                height={220}
              />
              <ChartLegend
                items={[
                  {
                    color: 'var(--official)',
                    label: `Empresas ${baseName} en ${placeName} (cantidad)`,
                  },
                ]}
              />
            </Panel>
          ) : null}
        </section>
      ) : null}

      {board.taxRoll.length ? (
        <section className="panel-group" aria-labelledby="tejido-padron-titulo">
          <header className="panel-group-head">
            <h3 id="tejido-padron-titulo">
              Padrón de Impuestos por {rollName}, {year}
            </h3>
            <p>
              Servicio de Impuestos Nacionales, Memoria anual.
              {taxpayers
                ? ` ${say(taxpayers.count)} contribuyentes activos en ${taxpayers.year}.`
                : ''}{' '}
              PRICO y GRACO son las categorías que Impuestos asigna a sus principales y grandes
              contribuyentes por volumen de operaciones e importancia fiscal: no son un tramo fijo
              de ventas.
            </p>
            <div className="chart-kind" role="group" aria-label="Abrir el padrón por">
              {dims.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={rollDim === value ? 'chip chip-on' : 'chip'}
                  aria-pressed={rollDim === value}
                  onClick={() => setRollDim(value)}
                >
                  {ROLL_DIMENSIONS[value] ?? value}
                </button>
              ))}
              <select
                aria-label="Año del padrón"
                value={year ?? ''}
                onChange={(event) => setRollYear(Number(event.target.value))}
              >
                {rollYears.map((when) => (
                  <option key={when} value={when}>
                    {when}
                  </option>
                ))}
              </select>
            </div>
          </header>

          {roll.length ? (
            <div className="grid-pair">
              <Panel
                id="tejido-padron-contribuyentes"
                title={`Parte del padrón por ${rollName}, ${year} (% de contribuyentes)`}
                lede="Qué parte de los contribuyentes cae en cada grupo."
                source={TAX_SOURCE}
              >
                <ShareBars
                  data={roll
                    .filter((row) => row.roll !== null)
                    .map((row) => ({ name: row.label, value: row.roll ?? 0 }))
                    .sort((a, b) => b.value - a.value)}
                  height={Math.max(160, roll.length * 26)}
                />
                <ChartLegend
                  items={[{ color: 'var(--official)', label: 'Parte de los contribuyentes (%)' }]}
                />
              </Panel>
              <Panel
                id="tejido-padron-recaudacion"
                title={`Parte de la recaudación por ${rollName}, ${year} (% de la recaudación)`}
                lede="Qué parte de lo recaudado aporta cada grupo."
                source={TAX_SOURCE}
              >
                <ShareBars
                  data={roll
                    .filter((row) => row.revenue !== null)
                    .map((row) => ({ name: row.label, value: row.revenue ?? 0 }))
                    .sort((a, b) => b.value - a.value)}
                  tone="var(--series-2)"
                  height={Math.max(160, roll.length * 26)}
                />
                <ChartLegend
                  items={[{ color: 'var(--series-2)', label: 'Parte de la recaudación (%)' }]}
                />
              </Panel>
            </div>
          ) : (
            <div className="callout">
              La memoria de {year} no abre el padrón por {rollName}.
            </div>
          )}

          {catData.length > 1 ? (
            <Panel
              id="tejido-padron-categorias"
              title={`Parte de la recaudación por categoría, ${catYears[0]}–${catYears.at(-1)} (% de la recaudación)`}
              lede="Cómo cambió el aporte de cada categoría tributaria a lo largo de las memorias."
              source={TAX_SOURCE}
            >
              <WorldLines
                data={catData}
                series={catSeries}
                format={(value) => `${say(value, 2)} %`}
                tick={(value) => `${say(value)} %`}
                countsOnly
              />
            </Panel>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

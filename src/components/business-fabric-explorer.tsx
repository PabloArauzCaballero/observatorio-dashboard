'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  ChartLegend,
  DivergingBars,
  HeatGrid,
  ShareBars,
  WorldLines,
  YearStackBars,
  seriesTone,
} from './charts';
import type {
  DivergingRow,
  HeatCell,
  LegendItem,
  StackPart,
  WorldLineSeries,
  YearStackRow,
} from './charts';
import { DepartmentsMap } from './departments-map';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import styles from './business.module.css';
import { BusinessSizePanel } from './business-size-panel';
import { BusinessDirectoryPanel } from './business-directory-panel';
import { Panel } from '@/components/ui/panel';
import { ProveedorDePanel, useAlmacenDePanel } from '@/components/ui/panel-data';
import { ViewToggle } from '@/components/ui/view-toggle';
import { ANY, additive, picked, toggle, without } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import {
  ACTIVITIES,
  FIRM_MEASURES,
  FORMS,
  PLACES,
  buildClosureSeries,
} from '@/lib/business-fabric-board';
import type {
  FabricBoard,
  FirmCount,
  FirmDimension,
  FirmMeasure,
} from '@/lib/business-fabric-board';

/**
 * Cuántas empresas tiene Bolivia, de qué tipo, dónde y de qué viven.
 *
 * La página lee el registro de comercio entero —la base empresarial de cada
 * cierre de gestión desde 2008, abierta por tipo societario, departamento y
 * actividad— y lo deja recortar como una tabla dinámica: el lugar, la
 * dimensión, las categorías, la medida y los años se cruzan, y cada panel
 * dibuja el mismo recorte desde otro ángulo. El mapa también filtra: tocar un
 * departamento lo elige.
 *
 * Dos quiebres de la serie van marcados y no suavizados: 2013, el año de la
 * depuración del registro, y 2025, que es el corte de noviembre del propio
 * SEPREC porque la cifra de cierre que publica el portal del Ministerio no la
 * reconoce el registro.
 */

const MARKS: Record<string, string> = {
  '2013':
    'Depuración del registro (2013): el salto desde 2012 sale de la regularización de matrículas, no de empresas nuevas.',
  '2025':
    'Corte a noviembre de 2025 del reporte del SEPREC. El portal del Ministerio publica 470.077 para 2025, cifra que el propio registro no sostiene.',
};

/** De dónde sale el registro, dicho una vez para todos los paneles de la página. */
const REGISTRY_SOURCE =
  'SEPREC (antes FUNDEMPRESA), registro de comercio: servido por el SIIP del Ministerio de Desarrollo Productivo para 2008–2024 y por el reporte del propio SEPREC para 2025';
const OWNERS_SOURCE =
  'SEPREC, registro de comercio (titular o representante legal de cada empresa)';

/** La clave de un reparto por departamento: qué mide la barra y, si hay uno elegido, cuál es. */
const departmentKey = (what: string, chosen: boolean): LegendItem[] =>
  chosen
    ? [
        { color: 'var(--official)', label: `${what}: el departamento elegido` },
        { color: 'var(--series-rest)', label: 'Los demás departamentos' },
      ]
    : [{ color: 'var(--official)', label: what }];

/**
 * Dibuja una figura sin que sus cifras lleguen al menú del panel.
 *
 * El panel de crecimiento ya declara la tabla completa en `data` (todas las categorías, con
 * el inicio, el fin, la tasa y la parte). `DivergingBars` declara además su propia hoja, y el
 * lector bajaría dos conjuntos según qué vista tenga abierta. Aquí las cifras de la figura caen
 * en un almacén que nadie lee: se baja lo mismo en las dos vistas.
 */
function SinCifrasPropias({ children }: { children: ReactNode }) {
  const aparte = useAlmacenDePanel();
  return <ProveedorDePanel almacen={aparte}>{children}</ProveedorDePanel>;
}

/** Cuántas categorías dibuja el gráfico de crecimiento; la tabla las trae todas. */
const GROWTH_BARS = 12;

const placeLabel = (key: string): string => PLACES.find((one) => one.key === key)?.label ?? key;
const say = (value: number, decimals = 0): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

function catalogue(dimension: FirmDimension): ReadonlyArray<{ key: string; label: string }> {
  return dimension === 'FORM'
    ? FORMS.map((one) => ({ key: one.key, label: one.short }))
    : ACTIVITIES;
}

/** Las cifras de un lugar y una dimensión, indexadas por categoría y año. */
function cube(rows: readonly FirmCount[]): Map<string, Map<number, number>> {
  const out = new Map<string, Map<number, number>>();
  for (const row of rows) {
    const byYear = out.get(row.key) ?? new Map<number, number>();
    byYear.set(row.year, row.count);
    out.set(row.key, byYear);
  }
  return out;
}

export function BusinessFabricExplorer({ board }: { board: FabricBoard }) {
  const [place, setPlace] = useState('BOLIVIA');
  const [dimension, setDimension] = useState<FirmDimension>('FORM');
  const [chosen, setChosen] = useState<Choice>(ANY);
  const [measure, setMeasure] = useState<FirmMeasure>('STOCK');
  const [mode, setMode] = useState<'count' | 'share'>('count');

  const measures = FIRM_MEASURES.filter((one) =>
    board.firms.some((row) => row.measure === one.value),
  );
  const ofMeasure = useMemo(
    () => board.firms.filter((row) => row.measure === measure),
    [board, measure],
  );
  const allYears = useMemo(
    () => [...new Set(ofMeasure.map((row) => row.year))].sort((left, right) => left - right),
    [ofMeasure],
  );
  const [since, setSince] = useState<number | null>(null);
  const [until, setUntil] = useState<number | null>(null);
  const from = since ?? allYears[0] ?? 0;
  const to = until ?? allYears.at(-1) ?? 0;
  const years = allYears.filter((year) => year >= from && year <= to);

  const here = ofMeasure.filter((row) => row.place === place && row.dimension === dimension);
  const byKey = cube(here);
  const totals = cube(ofMeasure.filter((row) => row.place === place && row.dimension === 'TOTAL'));
  const total = totals.get('TOTAL') ?? new Map<number, number>();
  const last = years.at(-1) ?? 0;
  const first = years[0] ?? 0;

  /*
   * Las categorías del carril, ordenadas por su peso en el último año del
   * rango y contadas en ese año: el número que se ve al lado de cada una es el
   * que el gráfico va a dibujar si se la elige.
   */
  const categories = catalogue(dimension)
    .map((one) => {
      const series = byKey.get(one.key);
      const latest = series
        ? ([...series.entries()]
            .filter(([year]) => year <= to)
            .sort((a, b) => b[0] - a[0])[0]?.[1] ?? 0)
        : 0;
      return { ...one, count: latest };
    })
    .filter((one) => byKey.has(one.key))
    .sort((left, right) => right.count - left.count);
  const visible = chosen.size ? categories.filter((one) => chosen.has(one.key)) : categories;

  const parts: StackPart[] = visible.map((one) => ({ key: one.key, label: one.label }));
  const rows: YearStackRow[] = years.map((year) => {
    const row: YearStackRow = { year: String(year) };
    for (const one of visible) {
      const value = byKey.get(one.key)?.get(year);
      if (value !== undefined) row[one.key] = value;
    }
    return row;
  });
  const marks =
    measure === 'STOCK'
      ? Object.entries(MARKS)
          .filter(([year]) => years.includes(Number(year)))
          .map(([year, label]) => ({ year, label }))
      : [];

  /*
   * El año de los paneles por departamento: el último del rango en que los
   * departamentos tienen cifra para esta dimensión. El corte de 2025 del
   * SEPREC abre el país por tipo y actividad pero no cada departamento.
   */
  const placeYear =
    [...years]
      .reverse()
      .find((year) =>
        ofMeasure.some(
          (row) =>
            row.place !== 'BOLIVIA' &&
            row.dimension === (chosen.size ? dimension : 'TOTAL') &&
            row.year === year,
        ),
      ) ?? last;
  const departmentValue = (code: string): number | null => {
    const pool = ofMeasure.filter((row) => row.place === code && row.year === placeYear);
    if (!chosen.size) return pool.find((row) => row.dimension === 'TOTAL')?.count ?? null;
    const picks = pool.filter((row) => row.dimension === dimension && chosen.has(row.key));
    return picks.length ? picks.reduce((sum, row) => sum + row.count, 0) : null;
  };
  const departments = PLACES.filter((one) => one.key !== 'BOLIVIA');
  const readings = departments.map((one) => ({ code: one.key, value: departmentValue(one.key) }));

  const heatColumns = departments.map((one) => one.label);
  const heatCells: HeatCell[] = [];
  for (const one of visible) {
    for (const dept of departments) {
      const row = ofMeasure.find(
        (candidate) =>
          candidate.place === dept.key &&
          candidate.dimension === dimension &&
          candidate.key === one.key &&
          candidate.year === placeYear,
      );
      if (row) heatCells.push({ row: one.label, column: dept.label, value: row.count });
    }
  }

  const lastTotal = total.get(last) ?? null;
  const prevTotal = total.get(years.at(-2) ?? -1) ?? null;
  const unipersonal =
    place === 'BOLIVIA'
      ? byKey.get('UNIPERSONAL')
      : cube(ofMeasure.filter((row) => row.place === place && row.dimension === 'FORM')).get(
          'UNIPERSONAL',
        );
  const shareUni =
    lastTotal && unipersonal?.get(last) ? (unipersonal.get(last)! / lastTotal) * 100 : null;
  const noun = FIRM_MEASURES.find((one) => one.value === measure)?.noun ?? 'empresas';

  const growth = visible.map((one) => {
    const start = byKey.get(one.key)?.get(first) ?? null;
    const end = byKey.get(one.key)?.get(last) ?? null;
    const span = last - first;
    const rate = start && end && span > 0 ? ((end / start) ** (1 / span) - 1) * 100 : null;
    const share = end !== null && lastTotal ? (end / lastTotal) * 100 : null;
    return { ...one, start, end, rate, share };
  });

  /*
   * El gráfico del crecimiento: las categorías más grandes (`growth` ya viene ordenado por
   * tamaño) con tasa calculable; la tabla de al lado trae todas.
   */
  const growthRated = growth.filter((one) => one.rate !== null);
  const growthShown = growthRated.slice(0, GROWTH_BARS);
  const growthBars: DivergingRow[] = growthShown.map((one) => ({
    name: one.label,
    value: one.rate ?? 0,
    meta: `${first}: ${one.start === null ? '—' : say(one.start)} · ${last}: ${one.end === null ? '—' : say(one.end)}${one.share === null ? '' : ` · ${say(one.share, 1)} % del total de ${last}`}`,
  }));

  const owners = board.owners;
  const ownerYear = owners[0]?.year ?? null;
  const ownerShare = (kind: 'WOMEN' | 'YOUTH', other: 'MEN' | 'ADULT') =>
    departments
      .map((dept) => {
        const mine = owners.find((row) => row.place === dept.key && row.kind === kind)?.count ?? 0;
        const rest = owners.find((row) => row.place === dept.key && row.kind === other)?.count ?? 0;
        return {
          name: dept.label,
          value: mine + rest ? (mine / (mine + rest)) * 100 : 0,
          parts: [
            { name: kind === 'WOMEN' ? 'Mujeres' : 'Jóvenes', value: mine, unit: 'empresas' },
            { name: kind === 'WOMEN' ? 'Hombres' : 'Adultos', value: rest, unit: 'empresas' },
          ],
          pick: dept.key,
          emphasis: place === dept.key,
        };
      })
      .filter((row) => row.value > 0);

  const flowSeries: WorldLineSeries[] = FIRM_MEASURES.filter(
    (one) =>
      (one.value === 'NEW' || one.value === 'RENEWED') &&
      board.firms.some(
        (row) => row.measure === one.value && row.place === place && row.dimension === 'TOTAL',
      ),
  ).map((one, index) => ({
    key: one.value,
    label: one.label,
    tone: seriesTone(index),
  }));
  const flowYears = [
    ...new Set(
      board.firms
        .filter(
          (row) =>
            flowSeries.some((series) => series.key === row.measure) &&
            row.place === place &&
            row.dimension === 'TOTAL',
        )
        .map((row) => row.year),
    ),
  ].sort((a, b) => a - b);
  const closures = buildClosureSeries(board.firms, place);
  const knownClosures = closures.filter(
    (row): row is { year: number; count: number } => row.count !== null,
  );
  const latestClosure = knownClosures.at(-1) ?? null;
  const previousClosure = knownClosures.at(-2) ?? null;
  /*
   * Entradas y salidas van lado a lado y se leen una contra otra, así que las
   * dos comparten el mismo eje de años, y ese eje no se salta ninguno: dibujar
   * sólo los años con cifra ponía 2010 y 2016 a un paso, como si fueran
   * seguidos. Un año sin publicar queda como hueco en la línea, no como cero.
   */
  const spanYears = [...flowYears, ...knownClosures.map((row) => row.year)];
  const spanFirst = spanYears.length ? Math.min(...spanYears) : 0;
  const span = spanYears.length
    ? Array.from(
        { length: Math.max(...spanYears) - spanFirst + 1 },
        (_, index) => spanFirst + index,
      )
    : [];
  const flowData = span.map((year) => {
    const row: Record<string, string | number | null> = { year: String(year) };
    for (const series of flowSeries) {
      row[series.key] =
        board.firms.find(
          (one) =>
            one.measure === series.key &&
            one.place === place &&
            one.dimension === 'TOTAL' &&
            one.year === year,
        )?.count ?? null;
    }
    return row as { year: string; [key: string]: string | number | null };
  });
  const hasFlow = flowSeries.length > 0 && flowYears.length > 0;
  const latestFlows = flowSeries.flatMap((series) => {
    const row = flowData.filter((one) => typeof one[series.key] === 'number').at(-1);
    return row
      ? [{ key: series.key, label: series.label, year: row.year, count: row[series.key] as number }]
      : [];
  });
  const closureCount = new Map(knownClosures.map((row) => [row.year, row.count]));
  const closureData = span.map((year) => ({
    year: String(year),
    CANCELLED: closureCount.get(year) ?? null,
  }));
  const closureLines: WorldLineSeries[] = [
    { key: 'CANCELLED', label: 'Cierres', tone: seriesTone(2) },
  ];

  const reset = (): void => {
    setPlace('BOLIVIA');
    setChosen(ANY);
    setSince(null);
    setUntil(null);
  };
  const active =
    (place !== 'BOLIVIA' ? 1 : 0) +
    (chosen.size ? 1 : 0) +
    (since !== null || until !== null ? 1 : 0);

  if (!board.firms.length) {
    return <div className="callout">Todavía no hay base empresarial cargada.</div>;
  }

  return (
    <>
      <Panel
        id="tejido-resumen"
        title={`Tejido empresarial de ${placeLabel(place)}: ${noun}, ${first}–${last} (cantidad de empresas)`}
        lede={`Cuántas empresas hay en el registro de comercio de ${placeLabel(place)}. «Vigente» es toda matrícula que no se canceló, no una empresa que funciona.`}
        source={REGISTRY_SOURCE}
        data={() => ({
          unidad: 'empresas',
          columnas: ['Cifra', 'Valor', 'Detalle'],
          filas: [
            [`${placeLabel(place)}, ${last}`, lastTotal, noun],
            [
              `Frente a ${years.at(-2) ?? '—'}`,
              lastTotal && prevTotal
                ? Number((((lastTotal - prevTotal) / prevTotal) * 100).toFixed(1))
                : null,
              'variación en %',
            ],
            [
              `Unipersonales, ${last}`,
              shareUni === null ? null : Number(shareUni.toFixed(1)),
              '% del total',
            ],
            [
              `Desde ${first}`,
              lastTotal && total.get(first)
                ? Number((lastTotal / (total.get(first) ?? 1)).toFixed(1))
                : null,
              `veces la base de ${first}`,
            ],
          ],
        })}
      >
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">
              {placeLabel(place)}, {last}
            </span>
            <span className="stat-value">{lastTotal === null ? '—' : say(lastTotal)}</span>
            <span className="stat-hint">{noun}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Frente a {years.at(-2) ?? '—'}</span>
            <span className="stat-value">
              {lastTotal && prevTotal
                ? `${lastTotal >= prevTotal ? '+' : ''}${say(((lastTotal - prevTotal) / prevTotal) * 100, 1)} %`
                : '—'}
            </span>
            <span className="stat-hint">
              {lastTotal && prevTotal
                ? `${say(lastTotal - prevTotal)} de diferencia`
                : 'sin año anterior'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Unipersonales</span>
            <span className="stat-value">{shareUni === null ? '—' : `${say(shareUni, 1)} %`}</span>
            <span className="stat-hint">del total de {last}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Desde {first}</span>
            <span className="stat-value">
              {lastTotal && total.get(first)
                ? `×${say(lastTotal / (total.get(first) ?? 1), 1)}`
                : '—'}
            </span>
            <span className="stat-hint">veces la base de {first}</span>
          </div>
        </div>
        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>
            Registro de comercio: SEPREC (antes FUNDEMPRESA), servido por el SIIP del Ministerio de
            Desarrollo Productivo para 2008–2024 y por el reporte del propio SEPREC para 2025.
            «Vigente» es toda matrícula que no se canceló, no una empresa que funciona: la parte que
            renueva su matrícula cada año es mucho menor.
          </p>
          <p>{MARKS['2013']}</p>
          <p>{MARKS['2025']}</p>
        </details>
      </Panel>

      <div className="workspace">
        <aside className="rail" id="tejido-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">
              {active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}
            </span>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="barras" size={13} />
              Medida
            </div>
            <div className="rail-pills">
              {measures.map((one) => (
                <button
                  key={one.value}
                  type="button"
                  className={measure === one.value ? 'chip chip-on' : 'chip'}
                  aria-pressed={measure === one.value}
                  onClick={() => {
                    setMeasure(one.value);
                    setSince(null);
                    setUntil(null);
                  }}
                >
                  {one.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="capas" size={13} />
              Abrir por
            </div>
            <div className="rail-pills">
              {(['FORM', 'CIIU'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={dimension === value ? 'chip chip-on' : 'chip'}
                  aria-pressed={dimension === value}
                  onClick={() => {
                    setDimension(value);
                    setChosen(ANY);
                  }}
                >
                  {value === 'FORM' ? 'Tipo societario' : 'Actividad (CIIU)'}
                </button>
              ))}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} />
              Años
            </div>
            <div className={`rail-field ${styles.pair}`}>
              <select
                aria-label="Desde"
                value={from}
                onChange={(event) => setSince(Number(event.target.value))}
              >
                {allYears
                  .filter((year) => year <= to)
                  .map((year) => (
                    <option key={year} value={year}>
                      Desde {year}
                    </option>
                  ))}
              </select>
              <select
                aria-label="Hasta"
                value={to}
                onChange={(event) => setUntil(Number(event.target.value))}
              >
                {allYears
                  .filter((year) => year >= from)
                  .map((year) => (
                    <option key={year} value={year}>
                      Hasta {year}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="mapa" size={13} />
              Lugar
            </div>
            <div className="rail-list">
              {PLACES.map((one) => {
                const count = cube(
                  ofMeasure.filter((row) => row.place === one.key && row.dimension === 'TOTAL'),
                )
                  .get('TOTAL')
                  ?.get(last);
                return (
                  <button
                    key={one.key}
                    type="button"
                    className={place === one.key ? 'rail-item rail-item-on' : 'rail-item'}
                    aria-pressed={place === one.key}
                    onClick={() => setPlace(one.key)}
                  >
                    <span className="rail-name">{one.label}</span>
                    <span className="rail-n">{count === undefined ? '—' : say(count)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="etiqueta" size={13} />
              {dimension === 'FORM' ? 'Tipo societario' : 'Actividad'} ({to})
              <PickedCount choice={chosen} />
            </div>
            <FilterHint />
            <div className="rail-list rail-list-cut">
              {categories.map((one) => {
                const on = picked(chosen, one.key);
                return (
                  <button
                    key={one.key}
                    type="button"
                    className={on ? 'rail-item rail-item-on' : 'rail-item'}
                    aria-pressed={on}
                    onClick={(event) =>
                      setChosen((current) => toggle(current, one.key, additive(event)))
                    }
                  >
                    <span className="rail-name">{one.label}</span>
                    <span className="rail-n">{say(one.count)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {active ? (
            <div className="rail-sec">
              <div className="rail-pills">
                {[...chosen].map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="chip chip-on chip-wide"
                    onClick={() => setChosen((current) => without(current, key))}
                  >
                    <span className="chip-text">
                      {catalogue(dimension).find((one) => one.key === key)?.label ?? key}
                    </span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
                <button type="button" className="chip" onClick={reset}>
                  Limpiar todo
                </button>
              </div>
            </div>
          ) : null}
        </aside>

        <div className={`workspace-main ${styles.board}`}>
          <Panel
            id="tejido-por-categoria"
            title={`${placeLabel(place)}: ${noun} por ${dimension === 'FORM' ? 'tipo societario' : 'actividad'}, ${first}–${last} (${mode === 'share' ? '% del total del año' : 'cantidad de empresas'})`}
            lede={`${chosen.size ? `${visible.length} categorías elegidas.` : 'Todas las categorías; las que pasan de seis se pliegan en «Otros».'} Pasa el cursor por una columna para ver cada tramo; el rombo marca un quiebre de la serie.`}
            source={REGISTRY_SOURCE}
          >
            <div className="chart-kind" role="group" aria-label="Escala">
              {(['count', 'share'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={mode === value ? 'chip chip-on' : 'chip'}
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                >
                  {value === 'count' ? 'Cantidad' : '% del año'}
                </button>
              ))}
            </div>
            {parts.length ? (
              <YearStackBars data={rows} parts={parts} mode={mode} marks={marks} />
            ) : (
              <div className="callout">
                {placeLabel(place)} no tiene esta medida abierta por{' '}
                {dimension === 'FORM' ? 'tipo societario' : 'actividad'}.
              </div>
            )}
          </Panel>

          <div className="grid-pair">
            <Panel
              id="tejido-mapa"
              title={`${chosen.size ? 'Lo elegido' : 'Todas'} por departamento, ${placeYear} (cantidad de empresas)`}
              lede="Toca un departamento para filtrar toda la página por él."
              source={REGISTRY_SOURCE}
              data={() => ({
                unidad: 'empresas',
                columnas: ['Departamento', `${noun}, ${placeYear} (cantidad de empresas)`],
                filas: readings.map((one) => [placeLabel(one.code), one.value]),
              })}
            >
              {readings.some((one) => one.value !== null) ? (
                <DepartmentsMap
                  readings={readings}
                  label={noun}
                  unit="empresas"
                  decimals={0}
                  chosen={place === 'BOLIVIA' ? null : place}
                  onPick={(code) => setPlace((current) => (current === code ? 'BOLIVIA' : code))}
                />
              ) : (
                <div className="callout">
                  El corte de {placeYear} no abre esta selección por departamento.
                </div>
              )}
            </Panel>
            <Panel
              id="tejido-ranking"
              title={`Ranking de departamentos, ${placeYear} (cantidad de empresas)`}
              lede="Misma selección que el mapa, ordenada."
              source={REGISTRY_SOURCE}
            >
              <ShareBars
                data={readings
                  .filter((one): one is { code: string; value: number } => one.value !== null)
                  .map((one) => ({
                    name: placeLabel(one.code),
                    value: one.value,
                    pick: one.code,
                    emphasis: place === one.code,
                  }))
                  .sort((left, right) => right.value - left.value)}
                unit=" empresas"
                decimals={0}
                height={300}
                onPick={(code) => setPlace((current) => (current === code ? 'BOLIVIA' : code))}
              />
              <ChartLegend
                items={departmentKey(
                  `${noun.charAt(0).toLocaleUpperCase('es')}${noun.slice(1)}, ${placeYear} (cantidad de empresas)`,
                  place !== 'BOLIVIA',
                )}
              />
            </Panel>
          </div>

          {heatCells.length ? (
            <Panel
              id="tejido-matriz"
              title={`${dimension === 'FORM' ? 'Tipo societario' : 'Actividad'} por departamento, ${placeYear} (cantidad de empresas)`}
              lede="Una celda vacía es una combinación sin empresas registradas, no un cero estimado."
              source={REGISTRY_SOURCE}
            >
              <HeatGrid
                rows={visible.map((one) => one.label)}
                columns={heatColumns}
                cells={heatCells}
                unit="empresas"
              />
            </Panel>
          ) : null}

          <Panel
            id="tejido-crecimiento"
            title={`Crecimiento por categoría, ${first}–${last}, ${placeLabel(place)} (% anual compuesto)`}
            lede="Tasa anual compuesta entre los dos extremos del rango elegido, calculada aquí sobre las cifras publicadas."
            source={`${REGISTRY_SOURCE}; cálculo del Observatorio`}
            data={() => ({
              columnas: [
                dimension === 'FORM' ? 'Tipo societario' : 'Actividad',
                `Cantidad ${first}`,
                `Cantidad ${last}`,
                'Tasa anual %',
                `Parte de ${last} %`,
              ],
              filas: growth.map((one) => [
                one.label,
                one.start,
                one.end,
                one.rate === null ? null : Number(one.rate.toFixed(2)),
                one.share === null ? null : Number(one.share.toFixed(2)),
              ]),
            })}
          >
            <ViewToggle
              chart={
                growthBars.length ? (
                  <>
                    {growthBars.some((row) => row.value < 0) ? (
                      /* Con caídas hay dos lados del cero: barras divergentes. */
                      <SinCifrasPropias>
                        <DivergingBars
                          signed
                          data={growthBars}
                          unit="% anual"
                          height={Math.max(220, growthBars.length * 30 + 40)}
                        />
                      </SinCifrasPropias>
                    ) : (
                      <>
                        <ShareBars
                          data={growthBars.map((row) => ({
                            name: row.name,
                            value: row.value,
                            ...(row.meta ? { note: row.meta } : {}),
                          }))}
                          unit="%"
                          decimals={1}
                          height={Math.max(220, growthBars.length * 30 + 40)}
                          declare={false}
                        />
                        <ChartLegend
                          items={[
                            {
                              color: 'var(--official)',
                              label: 'Crecimiento anual compuesto de la categoría (% anual)',
                            },
                          ]}
                        />
                      </>
                    )}
                    {growthRated.length > growthShown.length ? (
                      <p className="chart-note">
                        Se muestran {growthShown.length} de {growthRated.length} categorías, las más
                        grandes; la tabla trae todas.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="callout">
                    Ninguna categoría tiene cifra en los dos extremos del rango.
                  </div>
                )
              }
              table={
                <div className="table-wrap">
                  <table className="grid-table">
                    <thead>
                      <tr>
                        <th>{dimension === 'FORM' ? 'Tipo societario' : 'Actividad'}</th>
                        <th className="num">{first}</th>
                        <th className="num">{last}</th>
                        <th className="num">Tasa anual</th>
                        <th className="num">Parte de {last}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {growth.map((one) => (
                        <tr key={one.key}>
                          <td>{one.label}</td>
                          <td className="num">{one.start === null ? '—' : say(one.start)}</td>
                          <td className="num">{one.end === null ? '—' : say(one.end)}</td>
                          <td className="num">
                            {one.rate === null ? '—' : `${say(one.rate, 1)} %`}
                          </td>
                          <td className="num">
                            {one.share === null ? '—' : `${say(one.share, 1)} %`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            />
          </Panel>

          {owners.length ? (
            <div className="grid-pair">
              <Panel
                id="tejido-mujeres"
                title={`Empresas encabezadas por mujeres, por departamento, ${ownerYear} (% de las que declaran género)`}
                lede="Propietaria o representante legal según el SEPREC. Toca una barra para filtrar."
                source={OWNERS_SOURCE}
              >
                <ShareBars
                  data={ownerShare('WOMEN', 'MEN').sort((a, b) => b.value - a.value)}
                  height={300}
                  onPick={(code) => setPlace(code)}
                />
                <ChartLegend
                  items={departmentKey(
                    'Empresas encabezadas por mujeres (% de las que declaran género)',
                    place !== 'BOLIVIA',
                  )}
                />
              </Panel>
              <Panel
                id="tejido-jovenes"
                title={`Empresas encabezadas por jóvenes, por departamento, ${ownerYear} (% del total)`}
                lede="Según el grupo etario que el SEPREC asigna al titular."
                source={OWNERS_SOURCE}
              >
                <ShareBars
                  data={ownerShare('YOUTH', 'ADULT').sort((a, b) => b.value - a.value)}
                  height={300}
                  onPick={(code) => setPlace(code)}
                />
                <ChartLegend
                  items={departmentKey(
                    'Empresas encabezadas por jóvenes (% del total)',
                    place !== 'BOLIVIA',
                  )}
                />
              </Panel>
            </div>
          ) : null}

          <BusinessSizePanel board={board} place={place} />

          {/*
            Entradas y salidas del registro van al final de la página, una junto a la
            otra, y el directorio nominal cierra: son lo último que se lee, no lo primero.
          */}
          {hasFlow || latestClosure ? (
            <div className={hasFlow && latestClosure ? 'grid-pair' : undefined}>
              {hasFlow ? (
                <Panel
                  id="tejido-entradas"
                  title={`Entradas al registro en ${placeLabel(place)}: inscripciones y renovaciones por año (cantidad de empresas)`}
                  lede="Un año parcial lo dice su fuente; pasa el cursor para ver la cifra."
                  source={REGISTRY_SOURCE}
                >
                  <div className="stat-strip">
                    {latestFlows.map((one) => (
                      <div className="stat" key={one.key}>
                        <span className="stat-label">
                          {one.label} · {one.year}
                        </span>
                        <span className="stat-value">{say(one.count)}</span>
                        <span className="stat-hint">último dato publicado</span>
                      </div>
                    ))}
                    <div className="stat">
                      <span className="stat-label">Cobertura</span>
                      <span className="stat-value">
                        {flowYears[0]}–{flowYears.at(-1)}
                      </span>
                      <span className="stat-hint">años con alguna cifra</span>
                    </div>
                  </div>
                  <WorldLines
                    data={flowData}
                    series={flowSeries}
                    format={(value) => `${say(value)} empresas`}
                    tick={(value) => (value >= 1000 ? `${say(value / 1000)} mil` : say(value))}
                    countsOnly
                  />
                </Panel>
              ) : null}

              {latestClosure ? (
                <Panel
                  id="tejido-salidas"
                  title={`Salidas del registro en ${placeLabel(place)}: cancelaciones de matrícula por año (cantidad de matrículas)`}
                  lede="No es quiebra: incluye fusiones, transformaciones y otras bajas registrales."
                  source={REGISTRY_SOURCE}
                >
                  <div className="stat-strip">
                    <div className="stat">
                      <span className="stat-label">Cierres · {latestClosure.year}</span>
                      <span className="stat-value">{say(latestClosure.count)}</span>
                      <span className="stat-hint">matrículas canceladas</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Frente a {previousClosure?.year ?? '—'}</span>
                      <span className="stat-value">
                        {previousClosure
                          ? `${latestClosure.count >= previousClosure.count ? '+' : ''}${say(latestClosure.count - previousClosure.count)}`
                          : '—'}
                      </span>
                      <span className="stat-hint">variación en cantidad</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Cobertura</span>
                      <span className="stat-value">
                        {knownClosures[0]?.year}–{latestClosure.year}
                      </span>
                      <span className="stat-hint">los años no publicados quedan vacíos</span>
                    </div>
                  </div>
                  <WorldLines
                    data={closureData}
                    series={closureLines}
                    format={(value) => `${say(value)} cierres`}
                    tick={(value) => (value >= 1000 ? `${say(value / 1000)} mil` : say(value))}
                    countsOnly
                  />
                </Panel>
              ) : null}
            </div>
          ) : null}

          <BusinessDirectoryPanel />
        </div>
      </div>
    </>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ShareBars } from './charts';
import { Icon } from './icons';
import { Pager } from './pager';
import {
  STREET_LENGTH_LABEL,
  STREET_PAVEMENT_LABEL,
  filterStreetRows,
  streetBreakdown,
  streetLengthBand,
  streetPavementBand,
  streetCsv,
  streetExportAvailability,
  streetRowsForDownload,
  summarizeStreetRows,
} from '@/lib/street-analysis';
import type {
  StreetBreakdownDimension,
  StreetDataRow,
  StreetLengthBand,
  StreetPavementBand,
  StreetIndexState,
} from '@/lib/street-analysis';
import type { LonLatBox } from '@/lib/street-types';
import { departmentName } from '@/lib/roads-board';
import { reportDownloadIntent } from '@/lib/analytics';

const PAGE_SIZE = 20;

const number = (value: number, decimals = 0): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

type StreetSort =
  | 'name'
  | 'type'
  | 'city'
  | 'scope'
  | 'km'
  | 'paved'
  | 'remainder'
  | 'pavedShare'
  | 'sections';

const SORT_DEFAULT_DESCENDING = new Set<StreetSort>([
  'km',
  'paved',
  'remainder',
  'pavedShare',
  'sections',
]);

const readableDepartmentGroup = (key: string): string =>
  key === 'Sin departamento'
    ? key
    : key
        .split(' + ')
        .map(departmentName)
        .join(' + ');

function downloadStreetRows(rows: readonly StreetDataRow[]): void {
  reportDownloadIntent('calles-csv');
  const body = streetCsv(streetRowsForDownload(rows, departmentName));
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'observatorio-calles-bolivia.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function breakdownData(
  rows: readonly StreetDataRow[],
  dimension: StreetBreakdownDimension,
  metric: 'records' | 'km',
  limit: number,
  label: (key: string) => string = (key) => key,
) {
  return streetBreakdown(rows, dimension)
    .sort((left, right) => right[metric] - left[metric])
    .slice(0, limit)
    .map((row) => ({
      name: label(row.key),
      value: row[metric],
      parts: [
        { name: 'Registros', value: row.records },
        { name: 'Longitud', value: row.km, unit: 'km' },
        { name: 'Pavimento registrado', value: row.pavedKm, unit: 'km' },
        { name: 'Tramos o vías', value: row.ways },
      ],
    }));
}

function BreakdownCard({
  title,
  note,
  data,
  unit,
}: {
  title: string;
  note: string;
  data: ReturnType<typeof breakdownData>;
  unit: string;
}) {
  if (!data.length) return null;
  return (
    <div className="street-breakdown-card">
      <h4>{title}</h4>
      <p className="stat-hint">{note}</p>
      <ShareBars
        data={data}
        unit={unit}
        decimals={unit === 'registros' ? 0 : 1}
        height={Math.max(190, data.length * 36)}
      />
      <table className="street-breakdown-data">
        <caption>{title}: datos representados en el gráfico</caption>
        <thead>
          <tr>
            <th>Categoría</th>
            <th>Valor mostrado</th>
            <th>Registros</th>
            <th>Kilómetros</th>
            <th>Km pavimentados</th>
            <th>Tramos o vías</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.name}>
              <th>{row.name}</th>
              <td>{number(row.value, unit === 'registros' ? 0 : 1)} {unit}</td>
              <td>{number(row.parts[0]?.value ?? 0)}</td>
              <td>{number(row.parts[1]?.value ?? 0, 1)}</td>
              <td>{number(row.parts[2]?.value ?? 0, 1)}</td>
              <td>{number(row.parts[3]?.value ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * El catálogo profundo de calles: indicadores, distribuciones, filtros, tabla y descarga.
 *
 * Recibe filas ya recortadas por los filtros nacionales. Sus filtros propios no cambian el
 * mapa: sirven para estudiar el catálogo y el CSV sin convertir cinco dimensiones nuevas en
 * estados globales difíciles de deshacer.
 */
export function StreetDataExplorer({
  rows,
  street,
  where,
  unnamedKm,
  urbanIndexState,
  onSeen,
  onPick,
}: {
  rows: StreetDataRow[];
  street: { key: string; bounds: LonLatBox | null } | null;
  where: string;
  unnamedKm: number;
  urbanIndexState: StreetIndexState;
  /** Se avisa una vez, cuando el explorador entra en pantalla. */
  onSeen: () => void;
  onPick: (row: StreetDataRow) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<{ key: StreetSort; down: boolean }>({ key: 'km', down: true });
  const [scope, setScope] = useState<StreetDataRow['scope'] | 'TODAS'>('TODAS');
  const [type, setType] = useState('TODOS');
  const [pavement, setPavement] = useState<StreetPavementBand | 'TODOS'>('TODOS');
  const [length, setLength] = useState<StreetLengthBand | 'TODAS'>('TODAS');
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const watcher = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onSeen();
          watcher.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [onSeen]);

  const types = useMemo(
    () =>
      [...new Set(rows.map((row) => row.type ?? 'Sin tipo explícito'))].sort((left, right) =>
        left.localeCompare(right, 'es'),
      ),
    [rows],
  );
  const filtered = useMemo(
    () => filterStreetRows(rows, { scope, type, pavement, length }),
    [rows, scope, type, pavement, length],
  );
  const summary = useMemo(() => summarizeStreetRows(filtered), [filtered]);
  const exportAvailability = streetExportAvailability(urbanIndexState);

  const sorted = useMemo(() => {
    const value = (row: StreetDataRow): number | string => {
      switch (sort.key) {
        case 'name':
          return row.name;
        case 'type':
          return row.type ?? '';
        case 'city':
          return row.city ?? '';
        case 'scope':
          return row.scope;
        case 'paved':
          return row.paved;
        case 'remainder':
          return Math.max(row.km - row.paved, 0);
        case 'pavedShare':
          return row.km > 0 ? row.paved / row.km : 0;
        case 'sections':
          return row.sections;
        default:
          return row.km;
      }
    };
    return [...filtered].sort((left, right) => {
      const a = value(left);
      const b = value(right);
      const order =
        typeof a === 'number' && typeof b === 'number'
          ? a - b
          : String(a).localeCompare(String(b), 'es');
      return (sort.down ? -order : order) || right.km - left.km;
    });
  }, [filtered, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(pages, Math.floor(offset / PAGE_SIZE) + 1);
  const shown = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const first = sorted.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = (page - 1) * PAGE_SIZE + shown.length;
  const activeFilters = Number(scope !== 'TODAS') + Number(type !== 'TODOS') + Number(pavement !== 'TODOS') + Number(length !== 'TODAS');

  const chooseSort = (key: StreetSort): void => {
    setOffset(0);
    setSort((current) =>
      current.key === key ? { key, down: !current.down } : { key, down: SORT_DEFAULT_DESCENDING.has(key) },
    );
  };

  const head = (key: StreetSort, label: string, numeric = true) => {
    const active = sort.key === key;
    return (
      <th
        className={numeric ? 'num' : undefined}
        aria-sort={active ? (sort.down ? 'descending' : 'ascending') : 'none'}
      >
        <button
          type="button"
          className={active ? 'roads-sort roads-sort-on' : 'roads-sort'}
          onClick={() => chooseSort(key)}
        >
          {label}
          <span aria-hidden="true">{active ? (sort.down ? ' ↓' : ' ↑') : ''}</span>
        </button>
      </th>
    );
  };

  const clearLocalFilters = (): void => {
    setScope('TODAS');
    setType('TODOS');
    setPavement('TODOS');
    setLength('TODAS');
    setOffset(0);
  };

  const typesData = breakdownData(filtered, 'type', 'records', 10);
  const citiesData = breakdownData(filtered.filter((row) => row.scope === 'URBANA'), 'city', 'records', 10);
  const departmentsData = breakdownData(filtered, 'department', 'km', 10, readableDepartmentGroup);
  const pavementData = breakdownData(filtered, 'pavement', 'km', 4);
  const lengthData = breakdownData(filtered, 'length', 'records', 4);
  const scopeData = breakdownData(filtered, 'scope', 'km', 2);

  return (
    <section className="panel places-table roads-routes street-data" ref={sectionRef}>
      <div className="tile-head">
        <Icon name="mapa" size={14} />
        <h3 className="tile-title">Atlas de calles y vías con nombre ({where})</h3>
        <span className="places-table-count">
          {number(summary.records)} registros · {number(summary.totalKm)} km
        </span>
      </div>
      <p className="panel-sub">
        Reúne el callejero urbano y las vías con nombre de la red nacional. Cada registro suma los
        tramos con el mismo nombre dentro de una ciudad o del recorte nacional. OpenStreetMap no da
        nombre a {number(unnamedKm)} km de la red nacional seleccionada; se dibujan, pero no pueden
        entrar en este catálogo. {urbanIndexState === 'failed' ? 'No se pudieron leer las calles urbanas; el catálogo y la descarga contienen sólo la red nacional.' : ''}
      </p>

      <div className="street-filter-grid" role="group" aria-label="Filtros del atlas de calles">
        <div className="street-filter-group">
          <span className="street-filter-label" id="street-scope-label">Ámbito</span>
          <div className="chips" role="group" aria-labelledby="street-scope-label">
            {([
              ['TODAS', 'Todas'],
              ['URBANA', 'Urbanas'],
              ['RED_NACIONAL', 'Red nacional'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={scope === value ? 'chip chip-on' : 'chip'}
                aria-pressed={scope === value}
                onClick={() => {
                  setScope(value);
                  setOffset(0);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="street-filter-field">
          <span>Tipo de vía</span>
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setOffset(0);
            }}
          >
            <option value="TODOS">Todos los tipos</option>
            {types.map((one) => (
              <option key={one} value={one}>{one}</option>
            ))}
          </select>
        </label>
        <label className="street-filter-field">
          <span>Pavimento registrado</span>
          <select
            value={pavement}
            onChange={(event) => {
              setPavement(event.target.value as StreetPavementBand | 'TODOS');
              setOffset(0);
            }}
          >
            <option value="TODOS">Todos los estados</option>
            {Object.entries(STREET_PAVEMENT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="street-filter-field">
          <span>Longitud acumulada</span>
          <select
            value={length}
            onChange={(event) => {
              setLength(event.target.value as StreetLengthBand | 'TODAS');
              setOffset(0);
            }}
          >
            <option value="TODAS">Todas las longitudes</option>
            {Object.entries(STREET_LENGTH_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="street-actions">
        <span className="stat-hint">
          {activeFilters ? `${activeFilters} filtro${activeFilters === 1 ? '' : 's'} del atlas activo${activeFilters === 1 ? '' : 's'}` : 'Sin filtros adicionales'}
        </span>
        {activeFilters ? (
          <button type="button" className="chip" onClick={clearLocalFilters}>Quitar filtros del atlas</button>
        ) : null}
        <button
          type="button"
          className="download-btn"
          disabled={!sorted.length || !exportAvailability.enabled}
          onClick={() => downloadStreetRows(sorted)}
        >
          <Icon name="descarga" size={13} />{' '}
          {urbanIndexState === 'loading'
            ? 'Preparando catálogo completo…'
            : `Descargar ${number(sorted.length)} registros en CSV${urbanIndexState === 'failed' ? ' (sólo red nacional)' : ''}`}
        </button>
      </div>

      <div className="stat-strip street-stat-strip">
        <div className="stat">
          <span className="stat-label">Registros</span>
          <span className="stat-value">{number(summary.records)}</span>
          <span className="stat-hint">{number(summary.uniqueNames)} nombres distintos</span>
        </div>
        <div className="stat">
          <span className="stat-label">Cobertura territorial</span>
          <span className="stat-value">{number(summary.cities)} ciudades</span>
          <span className="stat-hint">{number(summary.departments)} departamentos</span>
        </div>
        <div className="stat">
          <span className="stat-label">Longitud acumulada</span>
          <span className="stat-value">{number(summary.totalKm, 1)} km</span>
          <span className="stat-hint">mediana {number(summary.medianKm, 2)} km · máxima {number(summary.longestKm, 1)} km</span>
        </div>
        <div className="stat">
          <span className="stat-label">Pavimento registrado</span>
          <span className="stat-value">{number(summary.pavedShare, 1)} %</span>
          <span className="stat-hint">
            {number(summary.pavedKm, 1)} km pavimentados · {number(summary.remainderKm, 1)} km sin desglose
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Tramos o vías</span>
          <span className="stat-value">{number(summary.ways)}</span>
          <span className="stat-hint">piezas originales agrupadas por nombre</span>
        </div>
        <div className="stat">
          <span className="stat-label">Composición</span>
          <span className="stat-value">{number(summary.urbanRecords)} urbanas</span>
          <span className="stat-hint">{number(summary.nationalRecords)} registros de red nacional</span>
        </div>
        <div className="stat">
          <span className="stat-label">Tipo identificable</span>
          <span className="stat-value">{summary.records ? number((summary.typedRecords / summary.records) * 100, 1) : '0,0'} %</span>
          <span className="stat-hint">avenida, calle, camino, pasaje y otros prefijos</span>
        </div>
        <div className="stat">
          <span className="stat-label">Nombres repetidos</span>
          <span className="stat-value">{number(summary.repeatedNames)}</span>
          <span className="stat-hint">aparecen en más de una ciudad o ámbito</span>
        </div>
      </div>

      <details className="street-insights">
        <summary>Ver distribuciones y diversidad del callejero</summary>
        <p className="panel-sub">
          Las barras se recalculan con todos los filtros, incluida la búsqueda general. La parte sin
          pavimento registrado mezcla superficie no pavimentada y superficie no informada: el índice
          disponible no permite separarlas honestamente.
        </p>
        <div className="grid-two street-breakdowns">
          <BreakdownCard title="Tipos de vía" note="Los diez prefijos más frecuentes." data={typesData} unit="registros" />
          <BreakdownCard title="Ciudades" note="Las diez ciudades con más nombres registrados." data={citiesData} unit="registros" />
          <BreakdownCard title="Departamentos" note="Longitud acumulada por cobertura departamental." data={departmentsData} unit="km" />
          <BreakdownCard title="Registro de pavimento" note="Cuántos kilómetros tienen cobertura completa, parcial o nula." data={pavementData} unit="km" />
          <BreakdownCard title="Escala de las calles" note="Distribución por longitud acumulada de cada nombre." data={lengthData} unit="registros" />
          <BreakdownCard title="Origen dentro del mapa" note="Callejero urbano frente a vías nombradas de la red nacional." data={scopeData} unit="km" />
        </div>
      </details>

      <p className="panel-sub street-method-note">
        <Icon name="info" size={12} /> Fuente: OpenStreetMap contributors, licencia ODbL 1.0. Los
        kilómetros son longitudes trazadas, no una certificación municipal. «Resto sin desglose» es
        la diferencia entre la longitud total y el pavimento identificado; no debe leerse automáticamente
        como tierra.
      </p>

      <Pager
        page={page}
        pages={pages}
        first={first}
        last={last}
        total={sorted.length}
        onGo={setOffset}
        pageSize={PAGE_SIZE}
        where="arriba"
        noun="calles"
      />

      {sorted.length === 0 ? (
        <div className="callout">Ninguna calle coincide con el recorte y los filtros del atlas.</div>
      ) : (
        <div className="table-wrap">
          <table className="grid-table roads-table street-table">
            <thead>
              <tr>
                {head('name', 'Calle o vía', false)}
                {head('type', 'Tipo', false)}
                {head('scope', 'Ámbito', false)}
                {head('city', 'Ciudad', false)}
                <th>Departamentos</th>
                <th>Rutas</th>
                {head('km', 'Km total')}
                {head('paved', 'Pavim. km')}
                {head('remainder', 'Resto km')}
                {head('pavedShare', '% pavim.')}
                <th>Escala</th>
                {head('sections', 'Tramos o vías')}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const on =
                  street !== null &&
                  row.key === street.key &&
                  (row.bounds?.join() ?? '') === (street.bounds?.join() ?? '');
                const pavedShare = row.km > 0 ? (row.paved / row.km) * 100 : 0;
                return (
                  <tr key={row.id} className={on ? 'roads-row-on' : undefined}>
                    <td>
                      <button
                        type="button"
                        className="table-link"
                        aria-pressed={on}
                        title={`${on ? 'Quitar del mapa' : 'Ver en el mapa'} ${row.name}`}
                        onClick={() => onPick(row)}
                      >
                        {row.name}
                      </button>
                      <span className="stat-hint street-proper-name">nombre propio: {row.properName}</span>
                    </td>
                    <td>{row.type ?? 'Sin tipo explícito'}</td>
                    <td>{row.scope === 'URBANA' ? 'Urbana' : 'Red nacional'}</td>
                    <td>{row.city ?? '—'}</td>
                    <td>{row.departments.length ? row.departments.map(departmentName).join(', ') : 'Sin asignar'}</td>
                    <td>{row.routes.length ? row.routes.join(', ') : '—'}</td>
                    <td className="num"><b>{number(row.km, 2)}</b></td>
                    <td className="num">{number(row.paved, 2)}</td>
                    <td className="num">{number(Math.max(row.km - row.paved, 0), 2)}</td>
                    <td className="num">
                      <span className="roads-share" title={STREET_PAVEMENT_LABEL[streetPavementBand(row)]}>
                        <span className="roads-share-bar" aria-hidden="true"><i style={{ width: `${pavedShare}%` }} /></span>
                        {number(pavedShare, 1)} %
                      </span>
                    </td>
                    <td>{STREET_LENGTH_LABEL[streetLengthBand(row.km)].split(' (')[0]}</td>
                    <td className="num">{number(row.sections)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager
        page={page}
        pages={pages}
        first={first}
        last={last}
        total={sorted.length}
        onGo={setOffset}
        pageSize={PAGE_SIZE}
        where="abajo"
        noun="calles"
      />
    </section>
  );
}

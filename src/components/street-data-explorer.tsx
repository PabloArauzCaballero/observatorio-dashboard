'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChartLegend, ShareBars } from './charts';
import { Pager } from './pager';
import { Panel } from '@/components/ui/panel';
import {
  STREET_LENGTH_LABEL,
  STREET_PAVEMENT_LABEL,
  filterStreetRows,
  streetBreakdown,
  streetLengthBand,
  streetPavementBand,
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

const PAGE_SIZE = 20;

const SOURCE = 'OpenStreetMap contributors (licencia ODbL 1.0)';

const number = (value: number, decimals = 0): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

type StreetSort =
  'name' | 'type' | 'city' | 'scope' | 'km' | 'paved' | 'remainder' | 'pavedShare' | 'sections';

const SORT_DEFAULT_DESCENDING = new Set<StreetSort>([
  'km',
  'paved',
  'remainder',
  'pavedShare',
  'sections',
]);

const readableDepartmentGroup = (key: string): string =>
  key === 'Sin departamento' ? key : key.split(' + ').map(departmentName).join(' + ');

/**
 * Los nombres con que se baja cada columna del atlas. Salen de las mismas filas que
 * armaba el CSV propio de esta tabla; `fuente` y `licencia` no van aquí porque el
 * menú del panel ya escribe la fuente en cada archivo.
 */
const COLUMNAS: Record<string, string> = {
  nombre: 'Nombre',
  nombre_propio: 'Nombre propio',
  tipo_via: 'Tipo de vía',
  ambito: 'Ámbito',
  ciudad: 'Ciudad',
  departamentos: 'Departamentos',
  rutas: 'Rutas',
  kilometros_totales: 'Km totales',
  kilometros_pavimentados_registrados: 'Km pavimentados registrados',
  kilometros_sin_desglose_de_superficie: 'Km sin desglose de superficie',
  porcentaje_pavimentado_registrado: 'Pavimentado registrado (%)',
  estado_del_registro_de_pavimento: 'Estado del registro de pavimento',
  categoria_de_longitud: 'Categoría de longitud',
  tramos_o_vias: 'Tramos o vías',
  longitud_minima: 'Longitud geográfica mínima',
  latitud_minima: 'Latitud mínima',
  longitud_maxima: 'Longitud geográfica máxima',
  latitud_maxima: 'Latitud máxima',
};

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

/** Una distribución del atlas: un panel propio, con su gráfico, su leyenda y su descarga. */
function BreakdownPanel({
  id,
  title,
  note,
  data,
  unit,
}: {
  id: string;
  title: string;
  note: string;
  data: ReturnType<typeof breakdownData>;
  unit: string;
}) {
  if (!data.length) return null;
  return (
    <Panel id={id} className="transp" title={`${title} (${unit})`} lede={note} source={SOURCE}>
      <ShareBars
        data={data}
        unit={unit}
        decimals={unit === 'registros' ? 0 : 1}
        height={Math.max(190, data.length * 36)}
      />
      <ChartLegend items={[{ label: `${title} (${unit})`, color: 'var(--official)' }]} />
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
              <td>
                {number(row.value, unit === 'registros' ? 0 : 1)} {unit}
              </td>
              <td>{number(row.parts[0]?.value ?? 0)}</td>
              <td>{number(row.parts[1]?.value ?? 0, 1)}</td>
              <td>{number(row.parts[2]?.value ?? 0, 1)}</td>
              <td>{number(row.parts[3]?.value ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/**
 * El catálogo profundo de calles: indicadores, distribuciones, filtros, tabla y descarga.
 *
 * Recibe filas ya recortadas por los filtros nacionales. Sus filtros propios no cambian el
 * mapa: sirven para estudiar el catálogo y la descarga sin convertir cinco dimensiones nuevas
 * en estados globales difíciles de deshacer.
 *
 * La descarga es la del menú del panel, y baja el atlas completo con los filtros puestos
 * (todas las filas, no solo la página que se ve). Antes la tabla tenía además un botón CSV
 * propio; dos puertas para lo mismo era confuso.
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
  const sectionRef = useRef<HTMLDivElement>(null);

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
  const activeFilters =
    Number(scope !== 'TODAS') +
    Number(type !== 'TODOS') +
    Number(pavement !== 'TODOS') +
    Number(length !== 'TODAS');

  const chooseSort = (key: StreetSort): void => {
    setOffset(0);
    setSort((current) =>
      current.key === key
        ? { key, down: !current.down }
        : { key, down: SORT_DEFAULT_DESCENDING.has(key) },
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

  /**
   * El atlas completo con los filtros puestos, ordenado como la tabla: lo que baja el menú
   * del panel. Mientras las calles urbanas no han llegado, o si fallaron, el archivo dice
   * que trae solo la red nacional.
   */
  const atlas = () => {
    const records = streetRowsForDownload(sorted, departmentName);
    const columns = Object.keys(COLUMNAS);
    const parcial =
      urbanIndexState === 'loading'
        ? 'Las calles urbanas aún se estaban leyendo: este archivo trae solo la red nacional. '
        : urbanIndexState === 'failed'
          ? 'No se pudieron leer las calles urbanas: este archivo trae solo la red nacional. '
          : '';
    return {
      etiqueta: 'Atlas de calles',
      unidad: 'km',
      columnas: columns.map((key) => COLUMNAS[key] ?? key),
      filas: records.map((record) => columns.map((key) => record[key] ?? null)),
      nota: `${parcial}Son todas las calles del recorte y de los filtros del atlas, no solo la página que se ve. Los kilómetros son longitudes trazadas en OpenStreetMap (licencia ODbL 1.0).`,
    };
  };

  const typesData = breakdownData(filtered, 'type', 'records', 10);
  const citiesData = breakdownData(
    filtered.filter((row) => row.scope === 'URBANA'),
    'city',
    'records',
    10,
  );
  const departmentsData = breakdownData(filtered, 'department', 'km', 10, readableDepartmentGroup);
  const pavementData = breakdownData(filtered, 'pavement', 'km', 4);
  const lengthData = breakdownData(filtered, 'length', 'records', 4);
  const scopeData = breakdownData(filtered, 'scope', 'km', 2);

  return (
    <div className="stack" ref={sectionRef}>
      <Panel
        id="atlas-de-calles"
        className="transp roads-routes"
        title={`Atlas de calles y vías con nombre, ${where} (registros y km)`}
        lede={`Reúne el callejero urbano y las vías con nombre de la red nacional. Cada registro suma los tramos con el mismo nombre dentro de una ciudad o del recorte nacional. OpenStreetMap no da nombre a ${number(unnamedKm)} km de la red nacional seleccionada; se dibujan, pero no pueden entrar en este catálogo.${urbanIndexState === 'failed' ? ' No se pudieron leer las calles urbanas; el catálogo y la descarga contienen solo la red nacional.' : ''}`}
        meta={`${number(summary.records)} registros · ${number(summary.totalKm)} km`}
        source={SOURCE}
        data={atlas}
      >
        <div className="street-filter-grid" role="group" aria-label="Filtros del atlas de calles">
          <div className="street-filter-group">
            <span className="street-filter-label" id="street-scope-label">
              Ámbito
            </span>
            <div className="chips" role="group" aria-labelledby="street-scope-label">
              {(
                [
                  ['TODAS', 'Todas'],
                  ['URBANA', 'Urbanas'],
                  ['RED_NACIONAL', 'Red nacional'],
                ] as const
              ).map(([value, label]) => (
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
                <option key={one} value={one}>
                  {one}
                </option>
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
                <option key={value} value={value}>
                  {label}
                </option>
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
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="street-actions">
          <span className="stat-hint">
            {activeFilters
              ? `${activeFilters} filtro${activeFilters === 1 ? '' : 's'} del atlas activo${activeFilters === 1 ? '' : 's'}`
              : 'Sin filtros adicionales'}
          </span>
          {activeFilters ? (
            <button type="button" className="chip" onClick={clearLocalFilters}>
              Quitar filtros del atlas
            </button>
          ) : null}
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
            <span className="stat-hint">
              mediana {number(summary.medianKm, 2)} km · máxima {number(summary.longestKm, 1)} km
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Pavimento registrado</span>
            <span className="stat-value">{number(summary.pavedShare, 1)} %</span>
            <span className="stat-hint">
              {number(summary.pavedKm, 1)} km pavimentados · {number(summary.remainderKm, 1)} km sin
              desglose
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
            <span className="stat-hint">
              {number(summary.nationalRecords)} registros de red nacional
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Tipo identificable</span>
            <span className="stat-value">
              {summary.records ? number((summary.typedRecords / summary.records) * 100, 1) : '0,0'}{' '}
              %
            </span>
            <span className="stat-hint">avenida, calle, camino, pasaje y otros prefijos</span>
          </div>
          <div className="stat">
            <span className="stat-label">Nombres repetidos</span>
            <span className="stat-value">{number(summary.repeatedNames)}</span>
            <span className="stat-hint">aparecen en más de una ciudad o ámbito</span>
          </div>
        </div>

        <p className="panel-note street-method-note">
          Los kilómetros son longitudes trazadas, no una certificación municipal. «Resto sin
          desglose» es la diferencia entre la longitud total y el pavimento identificado; no debe
          leerse automáticamente como tierra.
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
          <div className="callout">
            Ninguna calle coincide con el recorte y los filtros del atlas.
          </div>
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
                        <span className="stat-hint street-proper-name">
                          nombre propio: {row.properName}
                        </span>
                      </td>
                      <td>{row.type ?? 'Sin tipo explícito'}</td>
                      <td>{row.scope === 'URBANA' ? 'Urbana' : 'Red nacional'}</td>
                      <td>{row.city ?? '—'}</td>
                      <td>
                        {row.departments.length
                          ? row.departments.map(departmentName).join(', ')
                          : 'Sin asignar'}
                      </td>
                      <td>{row.routes.length ? row.routes.join(', ') : '—'}</td>
                      <td className="num">
                        <b>{number(row.km, 2)}</b>
                      </td>
                      <td className="num">{number(row.paved, 2)}</td>
                      <td className="num">{number(Math.max(row.km - row.paved, 0), 2)}</td>
                      <td className="num">
                        <span
                          className="roads-share"
                          title={STREET_PAVEMENT_LABEL[streetPavementBand(row)]}
                        >
                          <span className="roads-share-bar" aria-hidden="true">
                            <i style={{ width: `${pavedShare}%` }} />
                          </span>
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
      </Panel>

      <details className="street-insights" open>
        <summary>Ver distribuciones y diversidad del callejero</summary>
        <p className="panel-sub">
          Las barras se recalculan con todos los filtros, incluida la búsqueda general. La parte sin
          pavimento registrado mezcla superficie no pavimentada y superficie no informada: el índice
          disponible no permite separarlas honestamente.
        </p>
        <div className="grid-two street-breakdowns">
          <BreakdownPanel
            id="calles-tipos-de-via"
            title="Tipos de vía más frecuentes"
            note="Los diez prefijos más frecuentes."
            data={typesData}
            unit="registros"
          />
          <BreakdownPanel
            id="calles-ciudades"
            title="Ciudades con más calles registradas"
            note="Las diez ciudades con más nombres registrados."
            data={citiesData}
            unit="registros"
          />
          <BreakdownPanel
            id="calles-departamentos"
            title="Longitud por departamento"
            note="Longitud acumulada por cobertura departamental."
            data={departmentsData}
            unit="km"
          />
          <BreakdownPanel
            id="calles-pavimento"
            title="Km según el registro de pavimento"
            note="Cuántos kilómetros tienen cobertura completa, parcial o nula."
            data={pavementData}
            unit="km"
          />
          <BreakdownPanel
            id="calles-escala"
            title="Calles según su escala"
            note="Distribución por longitud acumulada de cada nombre."
            data={lengthData}
            unit="registros"
          />
          <BreakdownPanel
            id="calles-origen"
            title="Km según el origen dentro del mapa"
            note="Callejero urbano frente a vías nombradas de la red nacional."
            data={scopeData}
            unit="km"
          />
        </div>
      </details>
    </div>
  );
}

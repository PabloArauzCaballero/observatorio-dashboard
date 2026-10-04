'use client';

import { useCallback, useMemo, useState } from 'react';
import { ANY, accepts, describe } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import { WorldLines } from './charts';
import type { WorldLinePoint } from './charts';
import { FilterHint } from './filters';
import { Icon } from './icons';
import { NetworkMap } from './network-map';
import { Pager } from './pager';
import { Panel } from '@/components/ui/panel';
import type { MapLine, MapPoint } from './network-map';
import { FilterGroup, km, squash } from './transport-filters';
import { departmentName } from '@/lib/roads-board';
import { RAIL_NETWORKS, RAIL_STATUSES } from '@/lib/transport-board';
import type { FlowSeries, RailBoard } from '@/lib/transport-board';
import type { RailLine } from '@/lib/transport';

/**
 * La red ferroviaria: mapa, tabla de líneas y el tráfico del INE.
 *
 * Tres filtros —departamento, red, estado— y un buscador gobiernan a la vez
 * las cifras, el mapa y la tabla, y se cruzan como en «Carreteras». El tráfico
 * del INE sólo existe por red (Andina y Oriental), así que sus gráficos siguen
 * el filtro de red y dicen que no pueden seguir el de departamento.
 */

const NETWORK = Object.fromEntries(RAIL_NETWORKS.map((one) => [one.network, one])) as Record<
  RailLine['network'],
  (typeof RAIL_NETWORKS)[number]
>;
const STATUS = Object.fromEntries(RAIL_STATUSES.map((one) => [one.status, one])) as Record<
  RailLine['status'],
  (typeof RAIL_STATUSES)[number]
>;

type Skip = 'department' | 'network' | 'status';

const PAGE_SIZE = 20;

export function RailExplorer({ board }: { board: RailBoard }) {
  const [department, setDepartment] = useState<Choice>(ANY);
  const [network, setNetwork] = useState<Choice>(ANY);
  const [status, setStatus] = useState<Choice>(ANY);
  const [line, setLine] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [since, setSince] = useState(1999);
  const [offset, setOffset] = useState(0);
  const [grain, setGrain] = useState<'anual' | 'mensual'>('anual');

  const passes = useCallback(
    (one: RailLine, skip?: Skip): boolean =>
      (skip === 'department' || accepts(department, one.department)) &&
      (skip === 'network' || accepts(network, one.network)) &&
      (skip === 'status' || accepts(status, one.status)),
    [department, network, status],
  );

  const tally = useCallback(
    (skip: Skip, keyOf: (one: RailLine) => string) => {
      const totals = new Map<string, number>();
      for (const one of board.lines) {
        if (!passes(one, skip)) continue;
        totals.set(keyOf(one), (totals.get(keyOf(one)) ?? 0) + one.lengthKm);
      }
      return totals;
    },
    [board.lines, passes],
  );
  const byDepartment = useMemo(() => tally('department', (one) => one.department), [tally]);
  const byNetwork = useMemo(() => tally('network', (one) => one.network), [tally]);
  const byStatus = useMemo(() => tally('status', (one) => one.status), [tally]);

  const query = squash(search.trim());
  const inCut = useMemo(
    () =>
      board.lines.filter(
        (one) =>
          passes(one) &&
          (!query ||
            squash(one.line ?? 'sin nombre').includes(query) ||
            squash(departmentName(one.department)).includes(query) ||
            squash(one.operator ?? '').includes(query)),
      ),
    [board.lines, passes, query],
  );
  const liveLine = line && inCut.some((one) => one.line === line) ? line : null;
  const scope = liveLine ? inCut.filter((one) => one.line === liveLine) : inCut;
  const inCutIds = useMemo(() => new Set(scope.map((one) => one.lineId)), [scope]);

  const stations = useMemo(
    () =>
      board.stations.filter(
        (one) => accepts(department, one.department) && accepts(network, one.network),
      ),
    [board.stations, department, network],
  );

  const mapLines = useMemo<MapLine[]>(
    () =>
      board.lines.map((one) => ({
        id: one.lineId,
        pick: one.line,
        title: one.line ?? 'Vía férrea sin nombre en el mapa',
        subtitle: `${NETWORK[one.network].label} · ${STATUS[one.status].label}`,
        rows: [
          ['En este departamento', `${km(one.lengthKm, 1)} km`],
          ['Departamento', departmentName(one.department)],
          ...(one.operator
            ? ([['Operador (según el mapa)', one.operator]] as [string, string][])
            : []),
          ...(one.gauge
            ? ([['Trocha', `${Number(one.gauge) / 1000} m`]] as [string, string][])
            : []),
        ],
        color: one.status === 'ABANDONADA' ? 'var(--ink-faint)' : NETWORK[one.network].color,
        width: one.status === 'EN_SERVICIO' ? 2.6 : 1.6,
        layer: one.status === 'EN_SERVICIO' ? 2 : 1,
        dash: STATUS[one.status].dash,
        geometry: one.geometry,
      })),
    [board.lines],
  );
  const matches = useCallback((one: MapLine) => inCutIds.has(one.id), [inCutIds]);

  const totals = useMemo(() => {
    const byStatusKm = new Map<string, number>();
    for (const one of scope)
      byStatusKm.set(one.status, (byStatusKm.get(one.status) ?? 0) + one.lengthKm);
    return byStatusKm;
  }, [scope]);

  const rows = useMemo(() => {
    const byLine = new Map<
      string,
      {
        line: string | null;
        network: RailLine['network'];
        statuses: Set<string>;
        departments: Set<string>;
        km: number;
        service: number;
      }
    >();
    for (const one of inCut) {
      const key = `${one.network}|${one.line ?? ''}`;
      const row = byLine.get(key) ?? {
        line: one.line,
        network: one.network,
        statuses: new Set(),
        departments: new Set(),
        km: 0,
        service: 0,
      };
      row.statuses.add(one.status);
      row.departments.add(one.department);
      row.km += one.lengthKm;
      if (one.status === 'EN_SERVICIO') row.service += one.lengthKm;
      byLine.set(key, row);
    }
    return [...byLine.values()].sort((left, right) => right.km - left.km);
  }, [inCut]);

  const where = describe(department, departmentName, 'todo el país');
  /* Veinte líneas por página, y a la primera cuando cambia el recorte. */
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.floor(offset / PAGE_SIZE) + 1);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pager = (at: 'arriba' | 'abajo') => (
    <Pager
      page={page}
      pages={pages}
      first={rows.length ? (page - 1) * PAGE_SIZE + 1 : 0}
      last={(page - 1) * PAGE_SIZE + shown.length}
      total={rows.length}
      onGo={setOffset}
      pageSize={PAGE_SIZE}
      where={at}
      noun="líneas"
    />
  );
  const filtered = department.size + network.size + status.size > 0 || Boolean(query);
  const pickLine = (next: string): void => setLine((current) => (current === next ? null : next));

  /* El tráfico del INE sigue la red elegida; «metropolitana» no está en el cuadro. */
  const flowNetworks = (['ANDINA', 'ORIENTAL'] as const).filter((one) => accepts(network, one));
  const chartOf = (service: FlowSeries['service']) => {
    const mine = board.flows.filter(
      (one) => one.service === service && flowNetworks.includes(one.network as 'ANDINA'),
    );
    const periods = new Map<string, WorldLinePoint>();
    for (const one of mine) {
      const points = grain === 'anual' ? one.annual : one.monthly;
      for (const point of points) {
        if (Number(point.period.slice(0, 4)) < since) continue;
        const row = periods.get(point.period) ?? { year: point.period };
        row[one.network] = point.value;
        periods.set(point.period, row);
      }
    }
    return {
      data: [...periods.values()].sort((left, right) => left.year.localeCompare(right.year)),
      series: mine.map((one) => ({
        key: one.network,
        label: NETWORK[one.network].label,
        tone: NETWORK[one.network].color,
      })),
      last: mine.map((one) => ({ network: one.network, point: one.lastYear })),
    };
  };
  const years = [1999, 2005, 2010, 2015, 2020];

  /** Las tres cifras de cabecera: lo que se ve y, con el mismo orden, lo que se baja. */
  const cargoYear = board.flows.find((one) => one.service === 'CARGA')?.lastYear?.period ?? '—';
  const cargoTonnes = board.flows
    .filter((one) => one.service === 'CARGA' && flowNetworks.includes(one.network as 'ANDINA'))
    .reduce((sum, one) => sum + (one.lastYear?.value ?? 0), 0);
  const figures: ReadonlyArray<{
    label: string;
    shown: string;
    value: number;
    unit: string;
    hint: string;
  }> = [
    {
      label: `Vía en servicio${filtered || liveLine ? ' (selección)' : ''}`,
      shown: `${km(totals.get('EN_SERVICIO') ?? 0)} km`,
      value: totals.get('EN_SERVICIO') ?? 0,
      unit: 'km',
      hint: `${km(totals.get('EN_DESUSO') ?? 0)} km en desuso y ${km(totals.get('ABANDONADA') ?? 0)} km abandonados`,
    },
    {
      label: 'Estaciones y apeaderos con nombre',
      shown: km(stations.length),
      value: stations.length,
      unit: 'estaciones',
      hint: `${where} · OpenStreetMap`,
    },
    {
      label: `Carga transportada (${cargoYear}, INE)`,
      shown: `${km(cargoTonnes)} t`,
      value: cargoTonnes,
      unit: 'toneladas',
      hint: `${
        flowNetworks.map((one) => NETWORK[one].label).join(' + ') || 'Sin red con dato del INE'
      }${board.flows.some((one) => one.lastYear?.preliminary) ? ' · preliminar' : ''}`,
    },
  ];

  const trafficNote = `${
    board.lastMonth ? `${board.lastMonth.slice(0, 4)} llega solo hasta ${board.lastMonth}. ` : ''
  }Un año a medias aparece en la vista mensual y no en la anual.`;

  return (
    <>
      <Panel
        id="red-ferroviaria"
        className="transp"
        title="Red ferroviaria de Bolivia: vía, estaciones y carga (km, estaciones y toneladas)"
        lede="Las vías troncales que OpenStreetMap traza dentro del país, sin patios, desvíos ni ramales de servicio, cortadas por departamento y agrupadas por línea, red y estado. El tráfico es el que publica el INE."
        source="OpenStreetMap contributors (vías y estaciones) e Instituto Nacional de Estadística, con datos de la Empresa Ferroviaria Andina y la Oriental (carga)"
        data={() => ({
          etiqueta: 'Cifras de la selección',
          columnas: ['Cifra', 'Valor', 'Unidad', 'Detalle'],
          filas: figures.map((figure) => [figure.label, figure.value, figure.unit, figure.hint]),
        })}
      >
        <div className="stat-strip">
          {figures.map((figure) => (
            <div className="stat" key={figure.label}>
              <span className="stat-label">{figure.label}</span>
              <span className="stat-value">{figure.shown}</span>
              <span className="stat-hint">{figure.hint}</span>
            </div>
          ))}
        </div>
        <p className="panel-note">
          La Red Andina y la Oriental no se tocan; el tren metropolitano de Cochabamba es de trocha
          estándar.
        </p>
      </Panel>

      <div className="workspace">
        <aside className="rail">
          <FilterHint>
            La cifra de cada opción son los km que quedan con los demás filtros puestos.
          </FilterHint>
          <FilterGroup
            title="Departamento"
            icon="mapa"
            choice={department}
            onChange={setDepartment}
            allLabel="Todo el país"
            options={[...byDepartment.keys()]
              .sort((left, right) => (byDepartment.get(right) ?? 0) - (byDepartment.get(left) ?? 0))
              .map((key) => ({
                key,
                label: departmentName(key),
                count: byDepartment.get(key) ?? 0,
              }))}
          />
          <FilterGroup
            title="Red"
            icon="capas"
            choice={network}
            onChange={setNetwork}
            options={RAIL_NETWORKS.map((one) => ({
              key: one.network,
              label: one.label,
              count: byNetwork.get(one.network) ?? 0,
              color: one.color,
            }))}
          />
          <FilterGroup
            title="Estado"
            icon="pulso"
            choice={status}
            onChange={setStatus}
            options={RAIL_STATUSES.map((one) => ({
              key: one.status,
              label: one.label,
              count: byStatus.get(one.status) ?? 0,
            }))}
          />
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="buscar" size={13} />
              Buscar línea u operador
            </div>
            <div className="rail-field">
              <input
                type="search"
                aria-label="Buscar una línea, un operador o un departamento"
                placeholder="Arica, Quijarro, Uyuni…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="rail-input"
              />
            </div>
          </div>
          {filtered || liveLine ? (
            <div className="rail-sec">
              <button
                type="button"
                className="chip"
                onClick={() => {
                  setDepartment(ANY);
                  setNetwork(ANY);
                  setStatus(ANY);
                  setLine(null);
                  setSearch('');
                }}
              >
                <Icon name="refrescar" size={13} /> Quitar todos los filtros
              </button>
            </div>
          ) : null}
        </aside>

        <div className="workspace-main stack">
          <Panel
            id="mapa-ferroviario"
            className="transp"
            title={`Red ferroviaria por red y estado, ${where}${liveLine ? `, ${liveLine}` : ''} (km trazados)`}
            lede="Trazo lleno, en servicio; discontinuo, en construcción o en desuso; gris punteado, abandonada. Los rombos son estaciones y apeaderos."
            source="OpenStreetMap contributors (ODbL)"
          >
            {liveLine ? (
              <div className="chips roads-map-tools">
                <button type="button" className="chip chip-on" onClick={() => setLine(null)}>
                  {liveLine} ×
                </button>
              </div>
            ) : null}
            <NetworkMap
              lines={mapLines}
              points={stations.map<MapPoint>((one) => ({
                id: one.osmId,
                title: one.name,
                subtitle: `${one.kind === 'APEADERO' ? 'Apeadero' : 'Estación'} · ${NETWORK[one.network].label}`,
                lon: one.lon,
                lat: one.lat,
              }))}
              matches={matches}
              picked={liveLine}
              zoomTo={department.size > 0 || liveLine !== null}
              frameKey={`${[...department].join(',')}|${[...network].join(',')}|${[...status].join(',')}|${query}|${liveLine ?? ''}`}
              onPick={pickLine}
              legend={[
                ...RAIL_NETWORKS.map((one) => ({
                  key: one.network,
                  label: one.label,
                  color: one.color,
                  km: scope
                    .filter((line) => line.network === one.network)
                    .reduce((sum, line) => sum + line.lengthKm, 0),
                })),
                {
                  key: 'desuso',
                  label: 'En desuso o en construcción',
                  color: 'var(--ink-soft)',
                  dash: '4 3',
                },
                { key: 'abandonada', label: 'Abandonada', color: 'var(--ink-faint)', dash: '1 4' },
              ]}
              pointLabel="Estación o apeadero"
              ariaLabel="Red ferroviaria de Bolivia"
              foot="Pasa el cursor por una vía o una estación para ver qué es; haz clic en una vía para aislar su línea."
            />
          </Panel>

          <Panel
            id="lineas-ferroviarias"
            className="transp"
            title={`Km por línea ferroviaria, ${where} (km)`}
            lede="El nombre de la línea es el que le da OpenStreetMap a su relación de ruta o a la vía. Toca una línea para aislarla en el mapa."
            meta={`${km(rows.length)} líneas · ${km(rows.reduce((sum, row) => sum + row.km, 0))} km`}
            source="OpenStreetMap contributors (ODbL)"
            data={() => ({
              unidad: 'km',
              columnas: [
                'Línea',
                'Red',
                'Estado',
                'Departamentos',
                'En servicio (km)',
                'Total (km)',
              ],
              filas: rows.map((row) => [
                row.line ?? 'Vías sin nombre en el mapa',
                NETWORK[row.network].label,
                [...row.statuses].map((one) => STATUS[one as RailLine['status']].label).join(', '),
                [...row.departments].map(departmentName).join(', '),
                row.service,
                row.km,
              ]),
              nota: 'Son todas las líneas del recorte, no solo la página que se ve.',
            })}
          >
            {pager('arriba')}
            {rows.length === 0 ? (
              <div className="callout">Ninguna línea coincide con el recorte y la búsqueda.</div>
            ) : (
              <div className="table-wrap">
                <table className="grid-table roads-table">
                  <thead>
                    <tr>
                      <th>Línea</th>
                      <th>Red</th>
                      <th>Estado</th>
                      <th>Departamentos</th>
                      <th className="num">En servicio km</th>
                      <th className="num">Total km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((row) => {
                      const on = row.line !== null && row.line === liveLine;
                      return (
                        <tr
                          key={`${row.network}|${row.line}`}
                          className={on ? 'roads-row-on' : undefined}
                        >
                          <td>
                            {row.line ? (
                              <button
                                type="button"
                                className="table-link"
                                aria-pressed={on}
                                onClick={() => pickLine(row.line!)}
                              >
                                {row.line}
                              </button>
                            ) : (
                              'Vías sin nombre en el mapa'
                            )}
                          </td>
                          <td>{NETWORK[row.network].label}</td>
                          <td>
                            {[...row.statuses]
                              .map((one) => STATUS[one as RailLine['status']].label)
                              .join(', ')}
                          </td>
                          <td>{[...row.departments].map(departmentName).join(', ')}</td>
                          <td className="num">{row.service ? km(row.service, 1) : '—'}</td>
                          <td className="num">
                            <b>{km(row.km, 1)}</b>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {pager('abajo')}
          </Panel>
        </div>
      </div>

      {board.flows.length ? (
        <>
          <div className="transp-controls">
            <div
              className="chips roads-map-tools"
              role="group"
              aria-label="Vista del tráfico ferroviario"
            >
              <span className="roads-map-tools-label">Tráfico ferroviario: ver</span>
              {(['anual', 'mensual'] as const).map((one) => (
                <button
                  key={one}
                  type="button"
                  className={grain === one ? 'chip chip-on' : 'chip'}
                  aria-pressed={grain === one}
                  onClick={() => setGrain(one)}
                >
                  {one === 'anual' ? 'Por año' : 'Por mes'}
                </button>
              ))}
              <span className="roads-map-tools-label">Desde</span>
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={since === year ? 'chip chip-on' : 'chip'}
                  aria-pressed={since === year}
                  onClick={() => setSince(year)}
                >
                  {year}
                </button>
              ))}
            </div>
            <p className="panel-note">Los últimos años son preliminares. {trafficNote}</p>
          </div>
          <div className="grid-pair">
            {(['CARGA', 'PASAJEROS'] as const).map((service) => {
              const chart = chartOf(service);
              const porAno = grain === 'anual' ? 'por año' : 'por mes';
              return (
                <Panel
                  key={service}
                  id={service === 'CARGA' ? 'trafico-carga' : 'trafico-pasajeros'}
                  className="transp"
                  title={
                    service === 'CARGA'
                      ? `Carga por ferrocarril, ${porAno} (toneladas)`
                      : `Pasajeros por ferrocarril, ${porAno} (personas)`
                  }
                  lede="Sigue el filtro de red; el INE no lo da por departamento."
                  source="Instituto Nacional de Estadística, con datos de la Empresa Ferroviaria Andina y la Oriental"
                >
                  {chart.data.length > 1 ? (
                    <WorldLines
                      data={chart.data}
                      series={chart.series}
                      format={(value) => `${km(value)} ${service === 'CARGA' ? 't' : 'personas'}`}
                      countsOnly
                      tick={(value) =>
                        value >= 1_000_000
                          ? `${km(value / 1_000_000, 1)} M`
                          : value >= 1000
                            ? `${km(value / 1000)} mil`
                            : km(value)
                      }
                    />
                  ) : (
                    <div className="callout">Sin datos del INE para la red elegida.</div>
                  )}
                </Panel>
              );
            })}
          </div>
        </>
      ) : null}
    </>
  );
}

'use client';

import { useCallback, useMemo, useState } from 'react';
import { ANY, accepts, describe } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import { FilterHint } from './filters';
import { Icon } from './icons';
import { NetworkMap } from './network-map';
import type { MapLine, MapPoint } from './network-map';
import { Pager } from './pager';
import { Panel } from '@/components/ui/panel';
import { FilterGroup, km, squash } from './transport-filters';
import { departmentName } from '@/lib/roads-board';
import { WATERWAY_CATEGORIES } from '@/lib/transport-board';
import type { WaterBoard } from '@/lib/transport-board';
import type { Waterway, WaterwayCategory } from '@/lib/transport';

/**
 * La red fluvial: ríos, hidrovías, cruces en transbordador y puertos.
 *
 * La navegabilidad es lo que el lector viene a buscar y lo que OpenStreetMap
 * casi nunca dice, así que el filtro principal es la categoría —quién afirma
 * que un río se navega— y por omisión se muestran sólo las navegables: los
 * sesenta mil kilómetros de «otros ríos» están a un clic, dibujados finos y
 * grises, sin tapar la red que importa.
 */

const PAGE_SIZE = 20;

const CATEGORY = Object.fromEntries(
  WATERWAY_CATEGORIES.map((one) => [one.category, one]),
) as Record<WaterwayCategory, (typeof WATERWAY_CATEGORIES)[number]>;
const NAVIGABLE: Choice = new Set(
  WATERWAY_CATEGORIES.filter((one) => one.navigable || one.category === 'TRANSBORDADOR').map(
    (one) => one.category,
  ),
);

const WIDTH: Record<WaterwayCategory, number> = {
  HIDROVIA: 3,
  NAVEGABLE_EN_ESTUDIO: 2.4,
  NAVEGABLE_OSM: 1.8,
  TRANSBORDADOR: 1.6,
  RIO: 0.7,
};
const LAYER: Record<WaterwayCategory, number> = {
  RIO: 0,
  NAVEGABLE_OSM: 1,
  NAVEGABLE_EN_ESTUDIO: 2,
  HIDROVIA: 3,
  TRANSBORDADOR: 4,
};

type Skip = 'department' | 'category';

export function WaterwaysExplorer({ board }: { board: WaterBoard }) {
  const [department, setDepartment] = useState<Choice>(ANY);
  const [category, setCategory] = useState<Choice>(NAVIGABLE);
  const [river, setRiver] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const passes = useCallback(
    (one: Waterway, skip?: Skip): boolean =>
      (skip === 'department' || accepts(department, one.department)) &&
      (skip === 'category' || accepts(category, one.category)),
    [department, category],
  );
  const tally = useCallback(
    (skip: Skip, keyOf: (one: Waterway) => string) => {
      const totals = new Map<string, number>();
      for (const one of board.waterways) {
        if (passes(one, skip)) totals.set(keyOf(one), (totals.get(keyOf(one)) ?? 0) + one.lengthKm);
      }
      return totals;
    },
    [board.waterways, passes],
  );
  const byDepartment = useMemo(() => tally('department', (one) => one.department), [tally]);
  const byCategory = useMemo(() => tally('category', (one) => one.category), [tally]);

  const query = squash(search.trim());
  const inCut = useMemo(
    () =>
      board.waterways.filter(
        (one) =>
          passes(one) &&
          (!query ||
            squash(one.name ?? 'sin nombre').includes(query) ||
            squash(departmentName(one.department)).includes(query)),
      ),
    [board.waterways, passes, query],
  );
  const liveRiver = river && inCut.some((one) => one.name === river) ? river : null;
  const scope = liveRiver ? inCut.filter((one) => one.name === liveRiver) : inCut;
  const scopeIds = useMemo(() => new Set(scope.map((one) => one.waterwayId)), [scope]);

  /* Sólo se dibuja lo que la categoría deja: sesenta mil km de ríos atenuados pesan igual. */
  const mapLines = useMemo<MapLine[]>(
    () =>
      board.waterways
        .filter((one) => accepts(category, one.category))
        .map((one) => ({
          id: one.waterwayId,
          pick: one.name,
          title: one.name ?? 'Río sin nombre en el mapa',
          subtitle: CATEGORY[one.category].label,
          rows: [
            ['En este departamento', `${km(one.lengthKm, 1)} km`],
            ['Departamento', departmentName(one.department)],
            ...(one.boatYesKm > 0
              ? ([['Marcado navegable en OpenStreetMap', `${km(one.boatYesKm, 1)} km`]] as [
                  string,
                  string,
                ][])
              : []),
            ['Quién lo afirma', CATEGORY[one.category].hint],
          ],
          color: CATEGORY[one.category].color,
          width: WIDTH[one.category],
          layer: LAYER[one.category],
          dash: one.category === 'TRANSBORDADOR' ? '4 3' : undefined,
          opacity: one.category === 'RIO' ? 0.6 : 0.95,
          geometry: one.geometry,
        })),
    [board.waterways, category],
  );
  const matches = useCallback((one: MapLine) => scopeIds.has(one.id), [scopeIds]);

  const ports = useMemo(
    () => board.ports.filter((one) => accepts(department, one.department)),
    [board.ports, department],
  );

  const rows = useMemo(() => {
    const byRiver = new Map<
      string,
      {
        name: string | null;
        category: WaterwayCategory;
        departments: Set<string>;
        km: number;
        boat: number;
      }
    >();
    for (const one of inCut) {
      const key = `${one.category}|${one.name ?? ''}`;
      const row = byRiver.get(key) ?? {
        name: one.name,
        category: one.category,
        departments: new Set(),
        km: 0,
        boat: 0,
      };
      row.departments.add(one.department);
      row.km += one.lengthKm;
      row.boat += one.boatYesKm;
      byRiver.set(key, row);
    }
    return [...byRiver.values()].sort(
      (left, right) => LAYER[right.category] - LAYER[left.category] || right.km - left.km,
    );
  }, [inCut]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.floor(offset / PAGE_SIZE) + 1);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const navigableKm = scope
    .filter((one) => CATEGORY[one.category].navigable)
    .reduce((sum, one) => sum + one.lengthKm, 0);
  const hidroviaKm = scope
    .filter((one) => one.category === 'HIDROVIA')
    .reduce((sum, one) => sum + one.lengthKm, 0);
  const where = describe(department, departmentName, 'todo el país');
  const pickRiver = (next: string): void => setRiver((current) => (current === next ? null : next));

  /** Las tres cifras de cabecera: lo que se ve y, con el mismo orden, lo que se baja. */
  const figures: ReadonlyArray<{
    label: string;
    shown: string;
    value: number;
    unit: string;
    hint: string;
  }> = [
    {
      label: `Hidrovías (${where})`,
      shown: `${km(hidroviaKm)} km`,
      value: hidroviaKm,
      unit: 'km',
      hint: 'Ichilo, Mamoré, Iténez y Paraguay-Tamengo, dentro del país',
    },
    {
      label: 'Ríos navegables, las tres fuentes',
      shown: `${km(navigableKm)} km`,
      value: navigableKm,
      unit: 'km',
      hint: 'Hidrovías, afluentes en estudio y boat=yes de OpenStreetMap',
    },
    {
      label: 'Puertos y terminales fluviales',
      shown: km(ports.length),
      value: ports.length,
      unit: 'puertos y terminales',
      hint: `${km(ports.filter((one) => one.kind === 'PUERTO').length)} puertos · ${km(
        ports.filter((one) => one.kind === 'TERMINAL').length,
      )} terminales de balsa o lancha`,
    },
  ];

  return (
    <>
      <Panel
        id="red-fluvial"
        className="transp"
        title="Red fluvial de Bolivia: ríos navegables, hidrovías y puertos (km y cantidad)"
        lede="Los ríos que OpenStreetMap traza dentro del país, cortados por departamento. Qué se navega no lo dice el mapa, así que cada río dice quién lo afirma."
        source="OpenStreetMap contributors (trazado) y Ministerio de Obras Públicas, Servicios y Vivienda, 2024 (navegabilidad)"
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
          De once mil tramos de río, 241 llevan la etiqueta de navegable. Cada río dice quién lo
          afirma: las hidrovías y los afluentes que el Ministerio de Obras Públicas estudia como
          navegables, o la etiqueta de OpenStreetMap. El lago Titicaca se navega y no es un río: sus
          cruces aparecen como transbordador.
        </p>
      </Panel>

      <div className="workspace">
        <aside className="rail">
          <FilterHint>
            La cifra de cada opción son los km que quedan con los demás filtros puestos.
          </FilterHint>
          <FilterGroup
            title="Navegabilidad"
            icon="gota"
            choice={category}
            onChange={(next) =>
              setCategory(
                next.size ? next : new Set(WATERWAY_CATEGORIES.map((one) => one.category)),
              )
            }
            options={WATERWAY_CATEGORIES.map((one) => ({
              key: one.category,
              label: one.label,
              hint: one.hint,
              count: byCategory.get(one.category) ?? 0,
              color: one.color,
            }))}
          />
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
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="buscar" size={13} />
              Buscar río
            </div>
            <div className="rail-field">
              <input
                type="search"
                aria-label="Buscar un río o un departamento"
                placeholder="Mamoré, Beni, Pilcomayo…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="rail-input"
              />
            </div>
          </div>
          <div className="rail-sec">
            <button
              type="button"
              className="chip"
              onClick={() => {
                setDepartment(ANY);
                setCategory(NAVIGABLE);
                setRiver(null);
                setSearch('');
              }}
            >
              <Icon name="refrescar" size={13} /> Volver a los ríos navegables
            </button>
          </div>
        </aside>

        <div className="workspace-main stack">
          <Panel
            id="mapa-fluvial"
            className="transp"
            title={`Red fluvial por navegabilidad, ${where}${liveRiver ? `, ${liveRiver}` : ''} (km trazados)`}
            lede="Más grueso, más respaldo oficial de que el río se navega. Los rombos son puertos y terminales. Para ver todos los ríos, elige «Otros ríos» en Navegabilidad."
            source="OpenStreetMap contributors (trazado) y Ministerio de Obras Públicas, Servicios y Vivienda, 2024 (navegabilidad)"
          >
            {liveRiver ? (
              <div className="chips roads-map-tools">
                <button type="button" className="chip chip-on" onClick={() => setRiver(null)}>
                  {liveRiver} ×
                </button>
              </div>
            ) : null}
            <NetworkMap
              lines={mapLines}
              points={ports.map<MapPoint>((one) => ({
                id: one.osmId,
                title:
                  one.name ?? (one.kind === 'PUERTO' ? 'Puerto sin nombre' : 'Terminal sin nombre'),
                subtitle: `${one.kind === 'PUERTO' ? 'Puerto' : 'Terminal de balsa o lancha'} · ${departmentName(one.department)}`,
                lon: one.lon,
                lat: one.lat,
              }))}
              matches={matches}
              picked={liveRiver}
              zoomTo={department.size > 0 || liveRiver !== null}
              frameKey={`${[...department].join(',')}|${[...category].join(',')}|${query}|${liveRiver ?? ''}`}
              onPick={pickRiver}
              legend={WATERWAY_CATEGORIES.filter((one) => accepts(category, one.category)).map(
                (one) => ({
                  key: one.category,
                  label: one.label,
                  color: one.color,
                  dash: one.category === 'TRANSBORDADOR' ? '4 3' : undefined,
                  km: scope
                    .filter((line) => line.category === one.category)
                    .reduce((sum, line) => sum + line.lengthKm, 0),
                }),
              )}
              pointLabel="Puerto o terminal"
              ariaLabel="Red fluvial de Bolivia"
              foot="Pasa el cursor por un río o un puerto para ver qué es; haz clic en un río para aislarlo."
            />
          </Panel>

          <Panel
            id="km-por-rio"
            className="transp"
            title={`Km por río y navegabilidad, ${where} (km)`}
            lede="Cada cifra es la parte del río que cae en el recorte. Un río fronterizo (Iténez, Paraguay, Abuná) cuenta solo lo que el límite deja del lado boliviano. Toca un río para aislarlo en el mapa."
            meta={`${km(rows.length)} filas · ${km(rows.reduce((sum, row) => sum + row.km, 0))} km`}
            source="OpenStreetMap contributors (trazado) y Ministerio de Obras Públicas, Servicios y Vivienda, 2024 (navegabilidad)"
            data={() => ({
              unidad: 'km',
              columnas: [
                'Río o cruce',
                'Navegabilidad',
                'Departamentos',
                'boat=yes (km)',
                'Total (km)',
              ],
              filas: rows.map((row) => [
                row.name ?? 'Ríos sin nombre en el mapa',
                CATEGORY[row.category].label,
                [...row.departments].map(departmentName).join(', '),
                row.boat,
                row.km,
              ]),
              nota: 'Son todas las filas del recorte, no solo la página que se ve.',
            })}
          >
            <Pager
              page={page}
              pages={pages}
              first={rows.length ? (page - 1) * PAGE_SIZE + 1 : 0}
              last={(page - 1) * PAGE_SIZE + shown.length}
              total={rows.length}
              onGo={setOffset}
              pageSize={PAGE_SIZE}
              where="arriba"
              noun="ríos"
            />
            {rows.length === 0 ? (
              <div className="callout">Ningún río coincide con el recorte y la búsqueda.</div>
            ) : (
              <div className="table-wrap">
                <table className="grid-table roads-table">
                  <thead>
                    <tr>
                      <th>Río o cruce</th>
                      <th>Navegabilidad</th>
                      <th>Departamentos</th>
                      <th className="num">boat=yes km</th>
                      <th className="num">Total km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((row) => {
                      const on = row.name !== null && row.name === liveRiver;
                      return (
                        <tr
                          key={`${row.category}|${row.name}`}
                          className={on ? 'roads-row-on' : undefined}
                        >
                          <td>
                            {row.name ? (
                              <button
                                type="button"
                                className="table-link"
                                aria-pressed={on}
                                onClick={() => pickRiver(row.name!)}
                              >
                                {row.name}
                              </button>
                            ) : (
                              'Ríos sin nombre en el mapa'
                            )}
                          </td>
                          <td>{CATEGORY[row.category].label}</td>
                          <td>{[...row.departments].map(departmentName).join(', ')}</td>
                          <td className="num">{row.boat ? km(row.boat, 1) : '—'}</td>
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
          </Panel>
        </div>
      </div>
    </>
  );
}

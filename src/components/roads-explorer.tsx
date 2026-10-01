'use client';

import { useCallback, useMemo, useState } from 'react';
import { ANY, accepts, additive, describe, multiTitle, picked, toggle } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import { MacroChart } from './charts';
import { DerivedReading } from './derived-reading';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import type { IconName } from './icons';
import { Pager } from './pager';
import { RoadsMap } from './roads-map';
import type { RoadColorBy } from './roads-map';
import type { RoadSection } from '@/lib/roads';
import { NETWORKS, SURFACE_GROUP, SURFACE_GROUPS, departmentName } from '@/lib/roads-board';
import type { RoadBoard, SurfaceGroup } from '@/lib/roads-board';

/**
 * La red vial: mapa, tabla de rutas y cuadro de mando.
 *
 * Tres filtros —departamento, red, rodadura— y un buscador gobiernan a la vez
 * las cifras, el mapa y la tabla, como en «Ciudades»: el lector elige dónde
 * mirar y todo lo de abajo habla de eso. Se cruzan: la cifra al lado de cada
 * opción es lo que quedaría con los otros dos filtros puestos, así que nunca
 * se ofrece una opción que deja la pantalla vacía sin decirlo.
 *
 * La tabla vieja cortaba en las 80 rutas más largas, sumaba la ruta entera
 * aunque el filtro fuera un departamento, escribía los departamentos como
 * códigos («LA_PAZ») y escondía en «Otra» un tercio de la red. Ahora cada
 * cifra es la del recorte, pagina como el resto del tablero y se ordena por
 * cualquier columna.
 */

const PAGE_SIZE = 20;

const CONCLUSION_ICON: Record<string, IconName> = {
  pavimento: 'capas',
  concentracion: 'mapa',
  sin_referencia: 'campana',
  ine: 'banco',
};

const number = (value: number, decimals = 0): string =>
  value.toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const NETWORK_LABEL = Object.fromEntries(NETWORKS.map((one) => [one.network, one.label])) as Record<string, string>;
const NETWORK_SHORT: Record<RoadSection['network'], string> = {
  FUNDAMENTAL: 'Fundamental',
  DEPARTAMENTAL: 'Departamental',
  SIN_REFERENCIA: 'Sin código',
};

/**
 * La longitud oficial del recorte, del último año del INE.
 *
 * El INE publica tres cortes —país por red y rodadura, departamento por
 * rodadura, departamento por red— y ninguno cruza las tres cosas, así que la
 * cifra oficial sigue al departamento y a la red, no a la rodadura. Las vías
 * «sin código» no tienen contraparte oficial: si sólo se eligen ellas, no hay
 * cifra que comparar.
 */
function officialKm(
  official: RoadBoard['official'],
  department: Choice,
  network: Choice,
): { km: number; networks: string[] } | null {
  const geographies = department.size ? [...department] : ['BOLIVIA'];
  const wanted = network.size
    ? [...network].filter((one) => one === 'FUNDAMENTAL' || one === 'DEPARTAMENTAL')
    : ['TOTAL'];
  if (!wanted.length) return null;
  let km = 0;
  let found = false;
  for (const geography of geographies) {
    for (const one of wanted) {
      const point = official.find(
        (candidate) => candidate.geography === geography && candidate.network === one && candidate.surface === 'TOTAL',
      );
      if (point) {
        km += point.lengthKm;
        found = true;
      }
    }
  }
  return found ? { km, networks: wanted } : null;
}

/** «f4», «F 4» y «f-4» son la misma ruta que «F-4». */
const squash = (value: string): string =>
  value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/gu, '')
    .replaceAll(/[^a-z0-9]+/gu, '');

interface RouteRow {
  key: string;
  route: string | null;
  network: RoadSection['network'];
  departments: string[];
  names: string[];
  bySurface: Record<SurfaceGroup, number>;
  totalKm: number;
  pavedShare: number;
}

type SortKey = 'route' | 'network' | 'PAVIMENTADA' | 'RIPIO' | 'TIERRA' | 'SIN_DATO' | 'totalKm' | 'pavedShare';

/* Cortos, para que la tabla quepa; el nombre largo va en el `title`. */
const SORT_LABEL: Record<SortKey, string> = {
  route: 'Ruta',
  network: 'Red',
  PAVIMENTADA: 'Pavim. km',
  RIPIO: 'Ripio km',
  TIERRA: 'Tierra km',
  SIN_DATO: 'Sin dato km',
  totalKm: 'Total km',
  pavedShare: '% pavim.',
};

const SORT_TITLE: Record<SortKey, string> = {
  route: 'la ruta',
  network: 'la red',
  PAVIMENTADA: 'los km pavimentados',
  RIPIO: 'los km de ripio o empedrado',
  TIERRA: 'los km de tierra o sin pavimentar',
  SIN_DATO: 'los km sin dato de rodadura',
  totalKm: 'el total de km',
  pavedShare: 'la parte pavimentada',
};

/** El número de una ruta, para que F-9 vaya antes que F-10. */
const routeNumber = (route: string | null): number => Number(route?.replaceAll(/\D+/gu, '') || Infinity);

/**
 * Las filas de la tabla, sumadas sobre los tramos del recorte.
 *
 * Una fila por ruta, y las vías sin ruta asignada en una fila por
 * departamento: si no, la tabla sumaría menos que el mapa y el lector no
 * sabría dónde están los ocho mil kilómetros de diferencia.
 */
function rowsOf(sections: readonly RoadSection[]): RouteRow[] {
  const rows = new Map<string, RouteRow>();
  for (const section of sections) {
    const key = section.route ?? `sin-ruta:${section.department}`;
    const row = rows.get(key) ?? {
      key,
      route: section.route,
      network: section.network,
      departments: [],
      names: [],
      bySurface: { PAVIMENTADA: 0, RIPIO: 0, TIERRA: 0, SIN_DATO: 0 },
      totalKm: 0,
      pavedShare: 0,
    };
    row.totalKm += section.lengthKm;
    row.bySurface[SURFACE_GROUP[section.surface]] += section.lengthKm;
    if (!row.departments.includes(section.department)) row.departments.push(section.department);
    if (section.name && !row.names.includes(section.name) && row.names.length < 40) row.names.push(section.name);
    rows.set(key, row);
  }
  return [...rows.values()].map((row) => ({
    ...row,
    pavedShare: row.totalKm > 0 ? (row.bySurface.PAVIMENTADA / row.totalKm) * 100 : 0,
  }));
}

export function RoadsExplorer({ board }: { board: RoadBoard }) {
  const [department, setDepartment] = useState<Choice>(ANY);
  const [network, setNetwork] = useState<Choice>(ANY);
  const [surface, setSurface] = useState<Choice>(ANY);
  const [route, setRoute] = useState<string | null>(null);
  /* De dónde vino la ruta elegida: un clic en el mapa no debe mover la cámara que el lector acaba de acomodar. */
  const [routeFrom, setRouteFrom] = useState<'mapa' | 'tabla'>('tabla');
  const [search, setSearch] = useState('');
  const [colorBy, setColorBy] = useState<RoadColorBy>('red');
  const [sort, setSort] = useState<{ key: SortKey; down: boolean }>({ key: 'totalKm', down: true });

  /*
   * Un tramo pasa un filtro salvo el que se está contando: con eso se calcula
   * la cifra de cada opción del riel, que es la de «si además elijo esto».
   */
  const passes = useCallback(
    (section: RoadSection, skip?: 'department' | 'network' | 'surface'): boolean =>
      (skip === 'department' || accepts(department, section.department)) &&
      (skip === 'network' || accepts(network, section.network)) &&
      (skip === 'surface' || accepts(surface, SURFACE_GROUP[section.surface])),
    [department, network, surface],
  );

  const tally = useCallback(
    (skip: 'department' | 'network' | 'surface', keyOf: (section: RoadSection) => string) => {
      const totals = new Map<string, number>();
      for (const section of board.sections) {
        if (!passes(section, skip)) continue;
        const key = keyOf(section);
        totals.set(key, (totals.get(key) ?? 0) + section.lengthKm);
      }
      return totals;
    },
    [board.sections, passes],
  );

  const byDepartment = useMemo(() => tally('department', (section) => section.department), [tally]);
  const byNetwork = useMemo(() => tally('network', (section) => section.network), [tally]);
  const bySurface = useMemo(() => tally('surface', (section) => SURFACE_GROUP[section.surface]), [tally]);

  const inCut = useMemo(() => board.sections.filter((section) => passes(section)), [board.sections, passes]);

  const allRows = useMemo(() => rowsOf(inCut), [inCut]);

  const query = squash(search.trim());
  const rows = useMemo(() => {
    const found = query
      ? allRows.filter(
          (row) =>
            squash(row.route ?? 'sin ruta').includes(query) ||
            row.departments.some((one) => squash(departmentName(one)).includes(query)) ||
            row.names.some((name) => squash(name).includes(query)),
        )
      : allRows;
    const value = (row: RouteRow): number | string => {
      switch (sort.key) {
        case 'route':
          return routeNumber(row.route);
        case 'network':
          return NETWORK_SHORT[row.network];
        case 'totalKm':
          return row.totalKm;
        case 'pavedShare':
          return row.pavedShare;
        default:
          return row.bySurface[sort.key];
      }
    };
    return [...found].sort((left, right) => {
      const a = value(left);
      const b = value(right);
      const order = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'es');
      return (sort.down ? -order : order) || right.totalKm - left.totalKm;
    });
  }, [allRows, query, sort]);

  /* Una ruta que el nuevo recorte ya no tiene deja de estar elegida. */
  const liveRoute = route && allRows.some((row) => row.route === route) ? route : null;

  const matches = useCallback(
    (section: RoadSection): boolean => passes(section) && (!liveRoute || section.route === liveRoute),
    [passes, liveRoute],
  );

  const figures = useMemo(() => {
    const scope = liveRoute ? inCut.filter((section) => section.route === liveRoute) : inCut;
    const total = scope.reduce((sum, section) => sum + section.lengthKm, 0);
    const paved = scope
      .filter((section) => section.surface === 'PAVIMENTO')
      .reduce((sum, section) => sum + section.lengthKm, 0);
    return { total, paved, share: total > 0 ? (paved / total) * 100 : 0 };
  }, [inCut, liveRoute]);

  const official = officialKm(board.official, department, network);
  /* Un solo departamento elegido: su propia serie del INE; si no, la del país. */
  const onlyDepartment = department.size === 1 ? [...department][0]! : null;
  const annual = (onlyDepartment ? board.annualByGeography[onlyDepartment] : undefined) ?? board.annual;
  const annualWhere = onlyDepartment ? departmentName(onlyDepartment) : 'todo el país';
  const filtered = department.size + network.size + surface.size > 0 || Boolean(query);
  const framesRoute = liveRoute !== null && routeFrom === 'tabla';
  const zoomTo = department.size > 0 || framesRoute;
  /* Cambia con todo lo que pide un encuadre nuevo; sin él, la cámara del lector se queda donde está. */
  const frameKey = `${[...department].join(',')}|${[...network].join(',')}|${[...surface].join(',')}|${query}|${framesRoute ? liveRoute : ''}`;

  const clearAll = (): void => {
    setDepartment(ANY);
    setNetwork(ANY);
    setSurface(ANY);
    setRoute(null);
    setSearch('');
  };

  const pickRoute = (next: string, from: 'mapa' | 'tabla'): void => {
    setRouteFrom(from);
    setRoute((current) => (current === next ? null : next));
  };

  const where = describe(department, departmentName, 'todo el país');

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Red vial de Bolivia (km trazados por OpenStreetMap)</h2>
          <p className="panel-sub">
            Las vías troncales, primarias, secundarias y terciarias que OpenStreetMap traza dentro
            del país, y toda vía menor que lleve un código de ruta F o D propio o de su relación de
            ruta, cortadas por departamento y agrupadas en tramos que comparten ruta, rodadura y
            estado. El Sistema de Información Vial y la Transitabilidad de la ABC no respondieron al
            construir este corpus, así que la geometría viene de OpenStreetMap y el kilometraje
            oficial, por separado, del INE.
          </p>
        </div>
        <DerivedReading
          title="Qué dice esta red"
          note="Cada frase sale de los tramos y de la serie del INE de este capítulo. Dice cuánto hay y dónde se concentra; no dice el estado de transitabilidad del día."
          conclusions={board.conclusions}
          icons={CONCLUSION_ICON}
          defaultOpen={false}
        />
      </div>

      <div className="grid-three">
        <div className="panel stat">
          <span className="stat-label">
            Km trazados {liveRoute ? `(ruta ${liveRoute})` : filtered ? '(selección)' : '(red principal)'}
          </span>
          <span className="stat-value">{number(figures.total)} km</span>
          <span className="stat-hint">
            {filtered || liveRoute ? `de ${number(board.totalKm)} km en todo el país` : 'troncales a terciarias y toda vía con código · OpenStreetMap'}
          </span>
        </div>
        <div className="panel stat">
          <span className="stat-label">Pavimentado</span>
          <span className="stat-value">{figures.share.toFixed(1).replace('.', ',')} %</span>
          <span className="stat-hint">{number(figures.paved)} km de lo trazado, no de la red total del país</span>
        </div>
        <div className="panel stat">
          <span className="stat-label">Longitud oficial (INE, {board.asOfPeriod ?? '—'})</span>
          <span className="stat-value">{official ? `${number(official.km)} km` : '—'}</span>
          <span className="stat-hint">
            {official
              ? `${where} · ${
                  official.networks[0] === 'TOTAL'
                    ? 'Red Fundamental y Departamental'
                    : official.networks.map((one) => `Red ${NETWORK_SHORT[one as RoadSection['network']]}`).join(' y ')
                } · ABC y SEDECA vía el INE`
              : 'El INE no cuenta las vías sin código de ruta'}
          </span>
        </div>
      </div>

      <div className="workspace">
        <aside className="rail">
          <FilterHint>
            La cifra de cada opción es lo que queda con los demás filtros puestos.
          </FilterHint>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="mapa" size={13} />
              Departamento
              <PickedCount choice={department} />
            </div>
            <div className="rail-list">
              <button
                type="button"
                className={department.size === 0 ? 'rail-item rail-item-on' : 'rail-item'}
                aria-pressed={department.size === 0}
                onClick={() => setDepartment(ANY)}
              >
                <Icon name="globo" size={16} />
                <span className="rail-name">Todo el país</span>
                <span className="rail-n">
                  {number([...byDepartment.values()].reduce((sum, value) => sum + value, 0))}
                </span>
              </button>
              {board.kmByDepartment.map((one) => {
                const on = picked(department, one.department);
                return (
                  <button
                    key={one.department}
                    type="button"
                    className={on ? 'rail-item rail-item-on' : 'rail-item'}
                    aria-pressed={on}
                    title={multiTitle(one.name, on)}
                    onClick={(event) => setDepartment((current) => toggle(current, one.department, additive(event)))}
                  >
                    <Icon name="mapa" size={16} />
                    <span className="rail-name">{one.name}</span>
                    <span className="rail-n">{number(byDepartment.get(one.department) ?? 0)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="capas" size={13} />
              Red
              <PickedCount choice={network} />
            </div>
            <div className="rail-list">
              {NETWORKS.map((one) => {
                const on = picked(network, one.network);
                return (
                  <button
                    key={one.network}
                    type="button"
                    className={on ? 'rail-item rail-item-on' : 'rail-item'}
                    aria-pressed={on}
                    title={multiTitle(one.label, on)}
                    onClick={(event) => setNetwork((current) => toggle(current, one.network, additive(event)))}
                  >
                    <i className="roads-swatch" style={{ background: one.color }} aria-hidden="true" />
                    <span className="rail-name">{one.label}</span>
                    <span className="rail-n">{number(byNetwork.get(one.network) ?? 0)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="camion" size={13} />
              Rodadura
              <PickedCount choice={surface} />
            </div>
            <div className="rail-list">
              {SURFACE_GROUPS.map((one) => {
                const on = picked(surface, one.group);
                return (
                  <button
                    key={one.group}
                    type="button"
                    className={on ? 'rail-item rail-item-on' : 'rail-item'}
                    aria-pressed={on}
                    title={multiTitle(one.label, on)}
                    onClick={(event) => setSurface((current) => toggle(current, one.group, additive(event)))}
                  >
                    <i className="roads-swatch" style={{ background: one.color }} aria-hidden="true" />
                    <span className="rail-name">{one.label}</span>
                    <span className="rail-n">{number(bySurface.get(one.group) ?? 0)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="buscar" size={13} />
              Buscar ruta o tramo
            </div>
            <div className="rail-field">
              <input
                type="search"
                aria-label="Buscar una ruta, un tramo o un departamento"
                placeholder="F-4, Trinidad, Yucumo…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {filtered || liveRoute ? (
            <div className="rail-sec">
              <button type="button" className="chip" onClick={clearAll}>
                <Icon name="refrescar" size={13} /> Quitar todos los filtros
              </button>
            </div>
          ) : null}
        </aside>

        <div className="workspace-main stack">
          <div className="panel">
            <div className="panel-head">
              <h2>
                Mapa de la red vial por {colorBy === 'red' ? 'tipo de red' : 'rodadura'} ({where}
                {liveRoute ? `, ruta ${liveRoute}` : ''})
              </h2>
              <p className="panel-sub">
                La Red Fundamental va en trazo grueso, la Departamental en medio y las vías sin código de ruta
                asignada en fino, debajo. Cada escudo es el número de una ruta.
              </p>
            </div>
            <div className="chips roads-map-tools">
              <span className="roads-map-tools-label">Colorear por</span>
              <button
                type="button"
                className={colorBy === 'red' ? 'chip chip-on' : 'chip'}
                aria-pressed={colorBy === 'red'}
                onClick={() => setColorBy('red')}
              >
                Tipo de red
              </button>
              <button
                type="button"
                className={colorBy === 'superficie' ? 'chip chip-on' : 'chip'}
                aria-pressed={colorBy === 'superficie'}
                onClick={() => setColorBy('superficie')}
              >
                Rodadura
              </button>
              {liveRoute ? (
                <button type="button" className="chip chip-on" onClick={() => setRoute(null)}>
                  Ruta {liveRoute} ×
                </button>
              ) : null}
            </div>
            <RoadsMap
              sections={board.sections}
              matches={matches}
              route={liveRoute}
              colorBy={colorBy}
              zoomTo={zoomTo}
              frameKey={frameKey}
              onPickRoute={(next) => pickRoute(next, 'mapa')}
            />
            {liveRoute ? <RouteSections route={liveRoute} sections={inCut} /> : null}
          </div>

          <RoutesTable
            key={`${[...department].join(',')}|${[...network].join(',')}|${[...surface].join(',')}|${query}|${sort.key}${sort.down}`}
            rows={rows}
            route={liveRoute}
            where={where}
            sort={sort}
            onSort={(key) =>
              setSort((current) =>
                current.key === key ? { key, down: !current.down } : { key, down: key !== 'route' && key !== 'network' },
              )
            }
            onPick={(next) => pickRoute(next, 'tabla')}
          />
        </div>
      </div>

      <OfficialComparison board={board} />

      {annual.length ? (
        <div className="panel">
          <div className="panel-head">
            <h2>
              Longitud oficial de caminos por rodadura, {annualWhere}, 2000-{board.asOfPeriod ?? '—'} (km, INE)
            </h2>
            <p className="panel-sub">
              Kilómetros de la Red Fundamental y Departamental juntas. Sigue al filtro de
              departamento cuando se elige uno solo. No es la misma cifra que el mapa de arriba: ésta
              es el inventario oficial y aquélla, lo que OpenStreetMap ha trazado.
            </p>
          </div>
          <div className="grid-two">
            {annual.map((serie) => {
              const name =
                serie.surface === 'TOTAL'
                  ? 'Total'
                  : serie.surface === 'PAVIMENTO'
                    ? 'Pavimento'
                    : serie.surface === 'RIPIO'
                      ? 'Ripio'
                      : 'Tierra';
              return (
                <div key={serie.surface}>
                  <p className="panel-sub">{name} (km)</p>
                  {serie.data.length > 1 ? (
                    <MacroChart data={serie.data} unit="km" tone="var(--official)" label={`${name}, km (INE)`} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * Los tramos de la ruta aislada, uno por fila.
 *
 * Es el grano más fino que tiene el dato: un tramo es el pedazo de la ruta que
 * comparte departamento, rodadura y estado, así que una troncal de 380 km
 * pavimentada de punta a punta es un solo tramo. Verlos en fila deja ver dónde
 * cambia la rodadura o el departamento y cuánto pesa cada pedazo, sin tener que
 * adivinarlo pasando el cursor por el mapa.
 */
function RouteSections({ route, sections }: { route: string; sections: readonly RoadSection[] }) {
  const mine = sections
    .filter((section) => section.route === route)
    .sort((left, right) => right.lengthKm - left.lengthKm);
  if (!mine.length) return null;
  const total = mine.reduce((sum, section) => sum + section.lengthKm, 0);
  return (
    <div className="roads-sections">
      <h3 className="roads-sections-title">
        Tramos de la ruta {route} ({number(mine.length)} {mine.length === 1 ? 'tramo' : 'tramos'} · {number(total, 1)} km)
      </h3>
      <div className="table-wrap">
        <table className="grid-table roads-table">
          <thead>
            <tr>
              <th>Departamento</th>
              <th>Rodadura</th>
              <th>Estado</th>
              <th>Clase</th>
              <th>Nombre en OpenStreetMap</th>
              <th className="num">Km</th>
              <th className="num">% de la ruta</th>
            </tr>
          </thead>
          <tbody>
            {mine.map((section) => (
              <tr key={section.sectionId}>
                <td>{departmentName(section.department)}</td>
                <td>{SURFACE_GROUPS.find((one) => one.group === SURFACE_GROUP[section.surface])?.label}</td>
                <td>{section.status === 'EN_CONSTRUCCION' ? 'En construcción' : 'En servicio'}</td>
                <td>{section.highwayClass}</td>
                <td>{section.name ?? '—'}</td>
                <td className="num">{number(section.lengthKm, 1)}</td>
                <td className="num">{total > 0 ? number((section.lengthKm / total) * 100, 1) : '—'} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Lo trazado frente a lo oficial, departamento por departamento.
 *
 * Es la tabla que faltaba para leer el mapa: el INE cuenta 36.000 km de Red
 * Departamental y OpenStreetMap sólo le pone código a una parte; el resto está
 * dibujado como secundaria o terciaria sin código. Sin esta comparación, un
 * mapa con la Departamental casi vacía parecía decir que no existe.
 */
function OfficialComparison({ board }: { board: RoadBoard }) {
  if (!board.official.length) return null;
  const rows = board.kmByDepartment.map((department) => {
    const mine = board.sections.filter((section) => section.department === department.department);
    const traced = (network: RoadSection['network']) =>
      mine.filter((section) => section.network === network).reduce((sum, section) => sum + section.lengthKm, 0);
    const official = (network: 'FUNDAMENTAL' | 'DEPARTAMENTAL') =>
      board.official.find(
        (point) => point.geography === department.department && point.network === network && point.surface === 'TOTAL',
      )?.lengthKm ?? null;
    return {
      department: department.department,
      name: department.name,
      officialF: official('FUNDAMENTAL'),
      tracedF: traced('FUNDAMENTAL'),
      officialD: official('DEPARTAMENTAL'),
      tracedD: traced('DEPARTAMENTAL'),
      uncoded: traced('SIN_REFERENCIA'),
    };
  });
  const cell = (value: number | null) => (value === null ? '—' : number(value));
  return (
    <section className="panel places-table">
      <div className="tile-head">
        <Icon name="balanza" size={14} />
        <h3 className="tile-title">
          Red vial trazada frente a la oficial por departamento (km, INE {board.asOfPeriod ?? '—'} y OpenStreetMap)
        </h3>
      </div>
      <p className="panel-sub">
        «Oficial» es el inventario de la ABC y los SEDECA que publica el INE; «con código», lo que
        OpenStreetMap traza con su número de ruta F o D. La columna «sin código» son secundarias y
        terciarias trazadas sin número: ahí está la mayor parte de la Red Departamental que el mapa
        no nombra, y también caminos municipales que el INE no cuenta.
      </p>
      <div className="table-wrap">
        <table className="grid-table roads-table">
          <thead>
            <tr>
              <th>Departamento</th>
              <th className="num">Fundamental oficial</th>
              <th className="num">Fundamental con código</th>
              <th className="num">Departamental oficial</th>
              <th className="num">Departamental con código</th>
              <th className="num">Sin código en el mapa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.department}>
                <td>{row.name}</td>
                <td className="num">{cell(row.officialF)}</td>
                <td className="num">{number(row.tracedF)}</td>
                <td className="num">{cell(row.officialD)}</td>
                <td className="num">{number(row.tracedD)}</td>
                <td className="num">{number(row.uncoded)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Las rutas del recorte, veinte por página, con el `Pager` de todo el
 * tablero arriba y abajo. Se remonta al cambiar el recorte o el orden, para
 * que quien estaba en la página cuatro no aterrice en una página cuatro que
 * ya no existe.
 */
function RoutesTable({
  rows,
  route,
  where,
  sort,
  onSort,
  onPick,
}: {
  rows: RouteRow[];
  route: string | null;
  where: string;
  sort: { key: SortKey; down: boolean };
  onSort: (key: SortKey) => void;
  onPick: (route: string) => void;
}) {
  const [offset, setOffset] = useState(0);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.floor(offset / PAGE_SIZE) + 1);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const first = rows.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = (page - 1) * PAGE_SIZE + shown.length;
  const totalKm = rows.reduce((sum, row) => sum + row.totalKm, 0);

  const head = (key: SortKey, numeric = true) => {
    const active = sort.key === key;
    return (
      <th
        className={numeric ? 'num' : undefined}
        aria-sort={active ? (sort.down ? 'descending' : 'ascending') : 'none'}
      >
        <button
          type="button"
          className={active ? 'roads-sort roads-sort-on' : 'roads-sort'}
          onClick={() => onSort(key)}
          title={`Ordenar por ${SORT_TITLE[key]}`}
        >
          {SORT_LABEL[key]}
          <span aria-hidden="true">{active ? (sort.down ? ' ↓' : ' ↑') : ''}</span>
        </button>
      </th>
    );
  };

  return (
    <section className="panel places-table roads-routes">
      <div className="tile-head">
        <Icon name="cajas" size={14} />
        <h3 className="tile-title">Km por ruta y rodadura ({where})</h3>
        <span className="places-table-count">
          {number(rows.length)} {rows.length === 1 ? 'fila' : 'filas'} · {number(totalKm)} km
        </span>
      </div>
      <p className="panel-sub">
        Cada cifra es la parte de la ruta que cae en el recorte elegido, no la ruta entera. Las vías
        sin ruta F-n ni Dn van en una fila por departamento. Toca una ruta para aislarla en el mapa;
        toca un encabezado para ordenar.
      </p>

      <Pager
        page={page}
        pages={pages}
        first={first}
        last={last}
        total={rows.length}
        onGo={setOffset}
        pageSize={PAGE_SIZE}
        where="arriba"
        noun="rutas"
      />

      {rows.length === 0 ? (
        <div className="callout">Ninguna ruta coincide con el recorte y la búsqueda.</div>
      ) : (
        <div className="table-wrap">
          <table className="grid-table roads-table">
            <thead>
              <tr>
                {head('route', false)}
                {head('network', false)}
                <th>Departamentos</th>
                {head('PAVIMENTADA')}
                {head('RIPIO')}
                {head('TIERRA')}
                {head('SIN_DATO')}
                {head('totalKm')}
                {head('pavedShare')}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const on = row.route !== null && row.route === route;
                return (
                  <tr key={row.key} className={on ? 'roads-row-on' : undefined}>
                    <td>
                      {row.route ? (
                        <button
                          type="button"
                          className={on ? 'roads-shield roads-shield-on' : 'roads-shield'}
                          data-network={row.network}
                          aria-pressed={on}
                          title={`${on ? 'Quitar del mapa' : 'Ver en el mapa'} la ruta ${row.route}${row.names.length ? ` · tramos: ${row.names.slice(0, 6).join(' · ')}` : ''}`}
                          onClick={() => onPick(row.route!)}
                        >
                          {row.route}
                        </button>
                      ) : (
                        <span className="roads-shield roads-shield-none">sin ruta</span>
                      )}
                    </td>
                    <td title={NETWORK_LABEL[row.network]}>{NETWORK_SHORT[row.network]}</td>
                    <td>{row.departments.map(departmentName).join(', ')}</td>
                    <td className="num">{row.bySurface.PAVIMENTADA ? number(row.bySurface.PAVIMENTADA, 1) : '—'}</td>
                    <td className="num">{row.bySurface.RIPIO ? number(row.bySurface.RIPIO, 1) : '—'}</td>
                    <td className="num">{row.bySurface.TIERRA ? number(row.bySurface.TIERRA, 1) : '—'}</td>
                    <td className="num">{row.bySurface.SIN_DATO ? number(row.bySurface.SIN_DATO, 1) : '—'}</td>
                    <td className="num">
                      <b>{number(row.totalKm, 1)}</b>
                    </td>
                    <td className="num">
                      <span className="roads-share">
                        <span className="roads-share-bar" aria-hidden="true">
                          <i style={{ width: `${row.pavedShare}%` }} />
                        </span>
                        {Math.round(row.pavedShare)} %
                      </span>
                    </td>
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
        total={rows.length}
        onGo={setOffset}
        pageSize={PAGE_SIZE}
        where="abajo"
        noun="rutas"
      />
    </section>
  );
}

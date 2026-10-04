'use client';

import { useCallback, useMemo, useState } from 'react';
import { ANY, accepts, additive, describe, multiTitle, picked, toggle } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import { ChartLegend, HeatGrid, MacroChart, ShareBars, seriesTone } from './charts';
import type { HeatCell } from './charts';
import { DerivedReading } from './derived-reading';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import type { IconName } from './icons';
import { splitStreetType, streetKey } from '@/lib/street-names';
import type { StreetDataRow } from '@/lib/street-analysis';
import { useStreetIndex } from './use-street-index';
import { Pager } from './pager';
import { Panel } from '@/components/ui/panel';
import { SinDeclarar, TOP, TopNote, uniqueNames } from './transport-views';
import { ViewToggle } from '@/components/ui/view-toggle';
import { RoadsMap } from './roads-map';
import { StreetDataExplorer } from './street-data-explorer';
import type { RoadColorBy } from './roads-map';
import type { RoadSection } from '@/lib/roads';
import type { LonLatBox, StreetIndexEntry } from '@/lib/street-types';
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
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const NETWORK_LABEL = Object.fromEntries(NETWORKS.map((one) => [one.network, one.label])) as Record<
  string,
  string
>;
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
        (candidate) =>
          candidate.geography === geography &&
          candidate.network === one &&
          candidate.surface === 'TOTAL',
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

type SortKey =
  'route' | 'network' | 'PAVIMENTADA' | 'RIPIO' | 'TIERRA' | 'SIN_DATO' | 'totalKm' | 'pavedShare';

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
const routeNumber = (route: string | null): number =>
  Number(route?.replaceAll(/\D+/gu, '') || Infinity);

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
    if (section.name && !row.names.includes(section.name) && row.names.length < 40)
      row.names.push(section.name);
    rows.set(key, row);
  }
  return [...rows.values()].map((row) => ({
    ...row,
    pavedShare: row.totalKm > 0 ? (row.bySurface.PAVIMENTADA / row.totalKm) * 100 : 0,
  }));
}

/** Lo que se elige: una calle por su nombre, y en una ciudad concreta por la caja que la limita. */
interface StreetPick {
  key: string;
  label: string;
  bounds: LonLatBox | null;
  /** Si viene de las calles de ciudad: aunque ningún tramo nacional la lleve, sigue elegida. */
  urban: boolean;
}

/** Una calle de ciudad del índice, como fila de la tabla. */
function urbanRow(entry: StreetIndexEntry): StreetDataRow {
  const name = splitStreetType(entry.name);
  return {
    id: `${entry.key}@${entry.city}`,
    key: entry.key,
    name: entry.name,
    properName: name.proper,
    type: name.type,
    departments: entry.department ? [entry.department] : [],
    departmentKm: entry.department ? { [entry.department]: entry.km } : {},
    departmentPavedKm: entry.department ? { [entry.department]: entry.paved } : {},
    departmentWays: entry.department ? { [entry.department]: entry.ways } : {},
    routes: [],
    km: entry.km,
    paved: entry.paved,
    sections: entry.ways,
    city: entry.city,
    bounds: entry.bounds,
    scope: 'URBANA',
  };
}

/** Si algún vértice del tramo cae dentro de la caja: lo bastante para decir «es de esa ciudad». */
function touchesBox(section: RoadSection, box: LonLatBox): boolean {
  return section.geometry.some((line) =>
    line.some(([lon, lat]) => lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3]),
  );
}

/**
 * Las calles del recorte, una fila por nombre.
 *
 * Una calle llega partida en muchos tramos (por departamento, rodadura y estado, y
 * en las vías sin código por celda del mapa); el lector busca «Panamericana», no «el
 * tramo 3 de 11». Las vías sin nombre en OpenStreetMap no son una calle y quedan
 * fuera: se cuentan aparte, para decir cuánto falta y no esconderlo.
 */
function streetsOf(sections: readonly RoadSection[]): StreetDataRow[] {
  const rows = new Map<string, StreetDataRow>();
  for (const section of sections) {
    const key = streetKey(section.name);
    if (!key || !section.name) continue;
    const parsed = splitStreetType(section.name);
    const row = rows.get(key) ?? {
      id: key,
      key,
      name: section.name,
      properName: parsed.proper,
      type: parsed.type,
      departments: [],
      departmentKm: {},
      departmentPavedKm: {},
      departmentWays: {},
      routes: [],
      km: 0,
      paved: 0,
      sections: 0,
      city: null,
      bounds: null,
      scope: 'RED_NACIONAL',
    };
    row.km += section.lengthKm;
    row.sections += 1;
    if (section.surface === 'PAVIMENTO') row.paved += section.lengthKm;
    row.departmentKm[section.department] =
      (row.departmentKm[section.department] ?? 0) + section.lengthKm;
    row.departmentWays[section.department] = (row.departmentWays[section.department] ?? 0) + 1;
    if (section.surface === 'PAVIMENTO') {
      row.departmentPavedKm[section.department] =
        (row.departmentPavedKm[section.department] ?? 0) + section.lengthKm;
    }
    if (!row.departments.includes(section.department)) row.departments.push(section.department);
    if (section.route && !row.routes.includes(section.route)) row.routes.push(section.route);
    rows.set(key, row);
  }
  return [...rows.values()];
}

export function RoadsExplorer({ board }: { board: RoadBoard }) {
  const [department, setDepartment] = useState<Choice>(ANY);
  const [network, setNetwork] = useState<Choice>(ANY);
  const [surface, setSurface] = useState<Choice>(ANY);
  const [route, setRoute] = useState<string | null>(null);
  /* De dónde vino la ruta elegida: un clic en el mapa no debe mover la cámara que el lector acaba de acomodar. */
  const [routeFrom, setRouteFrom] = useState<'mapa' | 'tabla'>('tabla');
  /* La calle aislada (clave de búsqueda) y de dónde vino, igual que la ruta. */
  const [street, setStreet] = useState<StreetPick | null>(null);
  const [streetFrom, setStreetFrom] = useState<'mapa' | 'tabla'>('tabla');
  const [search, setSearch] = useState('');
  /* El índice de calles de ciudad pesa ~3,4 MB: se pide cuando la tabla entra en pantalla o se busca. */
  const [tableSeen, setTableSeen] = useState(false);
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
  const bySurface = useMemo(
    () => tally('surface', (section) => SURFACE_GROUP[section.surface]),
    [tally],
  );

  const inCut = useMemo(
    () => board.sections.filter((section) => passes(section)),
    [board.sections, passes],
  );

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
      const order =
        typeof a === 'number' && typeof b === 'number'
          ? a - b
          : String(a).localeCompare(String(b), 'es');
      return (sort.down ? -order : order) || right.totalKm - left.totalKm;
    });
  }, [allRows, query, sort]);

  /* Una ruta que el nuevo recorte ya no tiene deja de estar elegida. */
  const liveRoute = route && allRows.some((row) => row.route === route) ? route : null;

  const allStreets = useMemo(() => streetsOf(inCut), [inCut]);
  const { entries: cityStreets, failed: indexFailed } = useStreetIndex(tableSeen || Boolean(query));
  /*
   * Las calles de ciudad se suman a las del mapa nacional. Siguen los filtros de departamento y
   * de red (son «sin referencia»); no la rodadura, que el índice no desglosa.
   */
  const urbanRows = useMemo(() => {
    if (!cityStreets) return [];
    if (network.size && !network.has('SIN_REFERENCIA')) return [];
    return cityStreets
      .filter(
        (entry) =>
          !department.size || (entry.department !== null && department.has(entry.department)),
      )
      .map(urbanRow);
  }, [cityStreets, department, network]);
  const streetRows = useMemo(() => {
    const all = [...allStreets, ...urbanRows];
    return query
      ? all.filter((row) => squash(`${row.name} ${row.city ?? ''}`).includes(query))
      : all;
  }, [allStreets, urbanRows, query]);
  /* Lo que el mapa traza y OpenStreetMap no nombra: se dice, no se esconde. */
  const unnamedKm = useMemo(
    () =>
      inCut.filter((section) => !section.name).reduce((sum, section) => sum + section.lengthKm, 0),
    [inCut],
  );
  /* Una calle que el nuevo recorte ya no tiene deja de estar elegida. */
  const liveStreet =
    street && (street.urban || allStreets.some((row) => row.key === street.key)) ? street : null;

  const matches = useCallback(
    (section: RoadSection): boolean =>
      passes(section) &&
      (!liveRoute || section.route === liveRoute) &&
      (!liveStreet ||
        (streetKey(section.name) === liveStreet.key &&
          (!liveStreet.bounds || touchesBox(section, liveStreet.bounds)))),
    [passes, liveRoute, liveStreet],
  );

  const figures = useMemo(() => {
    const scope = liveStreet
      ? inCut.filter((section) => streetKey(section.name) === liveStreet.key)
      : liveRoute
        ? inCut.filter((section) => section.route === liveRoute)
        : inCut;
    const total = scope.reduce((sum, section) => sum + section.lengthKm, 0);
    const paved = scope
      .filter((section) => section.surface === 'PAVIMENTO')
      .reduce((sum, section) => sum + section.lengthKm, 0);
    return { total, paved, share: total > 0 ? (paved / total) * 100 : 0 };
  }, [inCut, liveRoute, liveStreet]);

  const official = officialKm(board.official, department, network);
  /* Un solo departamento elegido: su propia serie del INE; si no, la del país. */
  const onlyDepartment = department.size === 1 ? [...department][0]! : null;
  const annual =
    (onlyDepartment ? board.annualByGeography[onlyDepartment] : undefined) ?? board.annual;
  const annualWhere = onlyDepartment ? departmentName(onlyDepartment) : 'todo el país';
  const filtered = department.size + network.size + surface.size > 0 || Boolean(query);
  const framesRoute = liveRoute !== null && routeFrom === 'tabla';
  const framesStreet = liveStreet !== null && streetFrom === 'tabla';
  const zoomTo = department.size > 0 || framesRoute || framesStreet;
  /* Cambia con todo lo que pide un encuadre nuevo; sin él, la cámara del lector se queda donde está. */
  const frameKey = `${[...department].join(',')}|${[...network].join(',')}|${[...surface].join(',')}|${query}|${framesRoute ? liveRoute : ''}|${framesStreet ? `${liveStreet?.key}@${liveStreet?.bounds?.join(',') ?? ''}` : ''}`;

  const clearAll = (): void => {
    setDepartment(ANY);
    setNetwork(ANY);
    setSurface(ANY);
    setRoute(null);
    setStreet(null);
    setSearch('');
  };

  const pickRoute = (next: string, from: 'mapa' | 'tabla'): void => {
    setRouteFrom(from);
    setRoute((current) => (current === next ? null : next));
  };
  const pickStreet = (next: StreetPick, from: 'mapa' | 'tabla'): void => {
    setStreetFrom(from);
    setStreet((current) =>
      current && current.key === next.key && current.bounds?.join() === next.bounds?.join()
        ? null
        : next,
    );
  };

  const where = describe(department, departmentName, 'todo el país');

  /** Las tres cifras de cabecera: lo que se ve y, con el mismo orden, lo que se baja. */
  const headline: ReadonlyArray<{
    label: string;
    shown: string;
    value: number | null;
    unit: string;
    hint: string;
  }> = [
    {
      label: `Km trazados ${liveRoute ? `(ruta ${liveRoute})` : filtered ? '(selección)' : '(red principal)'}`,
      shown: `${number(figures.total)} km`,
      value: figures.total,
      unit: 'km',
      hint:
        filtered || liveRoute
          ? `de ${number(board.totalKm)} km en todo el país`
          : 'troncales a terciarias y toda vía con código · OpenStreetMap',
    },
    {
      label: 'Pavimentado',
      shown: `${figures.share.toFixed(1).replace('.', ',')} %`,
      value: figures.share,
      unit: '%',
      hint: `${number(figures.paved)} km de lo trazado, no de la red total del país`,
    },
    {
      label: `Longitud oficial (INE, ${board.asOfPeriod ?? '—'})`,
      shown: official ? `${number(official.km)} km` : '—',
      value: official?.km ?? null,
      unit: 'km',
      hint: official
        ? `${where} · ${
            official.networks[0] === 'TOTAL'
              ? 'Red Fundamental y Departamental'
              : official.networks
                  .map((one) => `Red ${NETWORK_SHORT[one as RoadSection['network']]}`)
                  .join(' y ')
          } · ABC y SEDECA vía el INE`
        : 'El INE no cuenta las vías sin código de ruta',
    },
  ];

  return (
    <>
      <Panel
        id="red-vial"
        className="transp"
        title="Red vial de Bolivia: km trazados y longitud oficial (km)"
        lede="Las vías troncales, primarias, secundarias y terciarias que OpenStreetMap traza dentro del país, y toda vía menor con código de ruta F o D, cortadas por departamento y agrupadas en tramos que comparten ruta, rodadura y estado."
        source="OpenStreetMap contributors (geometría) e Instituto Nacional de Estadística, con datos de la ABC y los SEDECA (longitud oficial)"
        data={() => ({
          etiqueta: 'Cifras de la selección',
          columnas: ['Cifra', 'Valor', 'Unidad', 'Detalle'],
          filas: headline.map((one) => [one.label, one.value, one.unit, one.hint]),
        })}
      >
        <div className="stat-strip">
          {headline.map((one) => (
            <div className="stat" key={one.label}>
              <span className="stat-label">{one.label}</span>
              <span className="stat-value">{one.shown}</span>
              <span className="stat-hint">{one.hint}</span>
            </div>
          ))}
        </div>
        <p className="panel-note">
          El Sistema de Información Vial y la Transitabilidad de la ABC no respondieron al construir
          este corpus, así que la geometría viene de OpenStreetMap y el kilometraje oficial, por
          separado, del INE.
        </p>
      </Panel>

      <DerivedReading
        title="Qué dice esta red"
        note="Cada frase sale de los tramos y de la serie del INE de este capítulo. Dice cuánto hay y dónde se concentra; no dice el estado de transitabilidad del día."
        conclusions={board.conclusions}
        icons={CONCLUSION_ICON}
        defaultOpen={false}
      />

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
                    onClick={(event) =>
                      setDepartment((current) => toggle(current, one.department, additive(event)))
                    }
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
                    onClick={(event) =>
                      setNetwork((current) => toggle(current, one.network, additive(event)))
                    }
                  >
                    <i
                      className="roads-swatch"
                      style={{ background: one.color }}
                      aria-hidden="true"
                    />
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
                    onClick={(event) =>
                      setSurface((current) => toggle(current, one.group, additive(event)))
                    }
                  >
                    <i
                      className="roads-swatch"
                      style={{ background: one.color }}
                      aria-hidden="true"
                    />
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
              Buscar ruta, calle o tramo
            </div>
            <div className="rail-field">
              <input
                type="search"
                aria-label="Buscar una ruta, una calle, un tramo o un departamento"
                placeholder="F-4, Panamericana, Yucumo…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="rail-input"
              />
            </div>
          </div>

          {filtered || liveRoute || liveStreet ? (
            <div className="rail-sec">
              <button type="button" className="chip" onClick={clearAll}>
                <Icon name="refrescar" size={13} /> Quitar todos los filtros
              </button>
            </div>
          ) : null}
        </aside>

        <div className="workspace-main stack">
          <Panel
            id="mapa-red-vial"
            className="transp"
            title={`Mapa de la red vial por ${colorBy === 'red' ? 'tipo de red' : 'rodadura'}, ${where}${liveRoute ? `, ruta ${liveRoute}` : ''} (km trazados)`}
            lede="La Red Fundamental va en trazo grueso, la Departamental en medio y las vías sin código de ruta asignada en fino, debajo. Cada escudo es el número de una ruta."
            source="OpenStreetMap contributors (ODbL)"
          >
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
              {liveStreet ? (
                <button type="button" className="chip chip-on" onClick={() => setStreet(null)}>
                  {liveStreet.label} ×
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
              street={liveStreet?.key ?? null}
              streetBounds={liveStreet?.bounds ?? null}
              focus={liveStreet?.bounds ?? null}
              onPickRoute={(next) => pickRoute(next, 'mapa')}
              onPickStreet={(next) =>
                pickStreet(
                  {
                    key: next,
                    label:
                      allStreets.find((row) => row.key === next)?.name ??
                      cityStreets?.find((one) => one.key === next)?.name ??
                      'Calle',
                    bounds: null,
                    urban: true,
                  },
                  'mapa',
                )
              }
            />
          </Panel>

          {liveRoute ? <RouteSections route={liveRoute} sections={inCut} /> : null}

          <RoutesTable
            cut={`${[...department].join(',')}|${[...network].join(',')}|${[...surface].join(',')}|${query}|${sort.key}${sort.down}`}
            rows={rows}
            route={liveRoute}
            where={where}
            sort={sort}
            onSort={(key) =>
              setSort((current) =>
                current.key === key
                  ? { key, down: !current.down }
                  : { key, down: key !== 'route' && key !== 'network' },
              )
            }
            onPick={(next) => pickRoute(next, 'tabla')}
          />

          <StreetDataExplorer
            key={`${[...department].join(',')}|${[...network].join(',')}|${[...surface].join(',')}|${query}`}
            rows={streetRows}
            street={liveStreet}
            where={where}
            unnamedKm={unnamedKm}
            urbanIndexState={indexFailed ? 'failed' : cityStreets ? 'ready' : 'loading'}
            onSeen={() => setTableSeen(true)}
            onPick={(row) =>
              pickStreet(
                {
                  key: row.key,
                  label: row.city ? `${row.name} (${row.city})` : row.name,
                  bounds: row.bounds,
                  urban: row.city !== null,
                },
                'tabla',
              )
            }
          />
        </div>
      </div>

      <OfficialComparison board={board} />

      {annual.length ? (
        <Panel
          id="longitud-oficial-por-rodadura"
          className="transp"
          title={`Longitud oficial de caminos por rodadura, ${annualWhere}, 2000-${board.asOfPeriod ?? '—'} (km)`}
          lede="Kilómetros de la Red Fundamental y Departamental juntas. Sigue al filtro de departamento cuando se elige uno solo. No es la misma cifra que el mapa de arriba: ésta es el inventario oficial y aquélla, lo que OpenStreetMap ha trazado."
          source="Instituto Nacional de Estadística, con datos de la ABC y los SEDECA"
        >
          <div className="grid-pair">
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
                  <h4>{name} (km)</h4>
                  {serie.data.length > 1 ? (
                    <MacroChart
                      data={serie.data}
                      unit="km"
                      tone="var(--official)"
                      label={`${name}, INE`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </Panel>
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
  const surfaceLabel = (section: RoadSection): string =>
    SURFACE_GROUPS.find((one) => one.group === SURFACE_GROUP[section.surface])?.label ?? '';
  const statusLabel = (section: RoadSection): string =>
    section.status === 'EN_CONSTRUCCION' ? 'En construcción' : 'En servicio';
  /* Un tramo por barra, rotulado por departamento y rodadura; los iguales se distinguen. */
  const top = mine.slice(0, TOP);
  const names = uniqueNames(
    top.map((section) => ({
      name: `${departmentName(section.department)} · ${surfaceLabel(section)}`,
      qualifier: statusLabel(section),
    })),
  );
  const bars = top.map((section, index) => ({
    name: names[index] ?? '',
    value: section.lengthKm,
    note: [
      `${departmentName(section.department)} · ${surfaceLabel(section)}`,
      statusLabel(section),
      section.highwayClass,
      section.name,
    ]
      .filter(Boolean)
      .join(' · '),
  }));
  return (
    <Panel
      id="tramos-de-la-ruta"
      className="transp"
      title={`Tramos de la ruta ${route} (km)`}
      lede="Es el grano más fino del dato: un tramo es el pedazo de la ruta que comparte departamento, rodadura y estado. Se ve dónde cambia la rodadura o el departamento y cuánto pesa cada pedazo."
      meta={`${number(mine.length)} ${mine.length === 1 ? 'tramo' : 'tramos'} · ${number(total, 1)} km`}
      source="OpenStreetMap contributors (ODbL)"
      data={() => ({
        unidad: 'km',
        columnas: [
          'Departamento',
          'Rodadura',
          'Estado',
          'Clase',
          'Nombre en OpenStreetMap',
          'Km',
          '% de la ruta',
        ],
        filas: mine.map((section) => [
          departmentName(section.department),
          surfaceLabel(section),
          statusLabel(section),
          section.highwayClass,
          section.name,
          section.lengthKm,
          total > 0 ? (section.lengthKm / total) * 100 : null,
        ]),
      })}
    >
      <ViewToggle
        chart={
          <>
            <SinDeclarar>
              <ShareBars
                data={bars}
                unit="km"
                decimals={1}
                tone={seriesTone(0)}
                height={Math.max(190, bars.length * 34 + 16)}
              />
            </SinDeclarar>
            <ChartLegend
              items={[
                { color: seriesTone(0), label: `Longitud de cada tramo de la ruta ${route} (km)` },
              ]}
            />
            <TopNote shown={bars.length} total={mine.length} noun="tramos" />
          </>
        }
        table={
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
                    <td>{surfaceLabel(section)}</td>
                    <td>{statusLabel(section)}</td>
                    <td>{section.highwayClass}</td>
                    <td>{section.name ?? '—'}</td>
                    <td className="num">{number(section.lengthKm, 1)}</td>
                    <td className="num">
                      {total > 0 ? number((section.lengthKm / total) * 100, 1) : '—'} %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      />
    </Panel>
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
      mine
        .filter((section) => section.network === network)
        .reduce((sum, section) => sum + section.lengthKm, 0);
    const official = (network: 'FUNDAMENTAL' | 'DEPARTAMENTAL') =>
      board.official.find(
        (point) =>
          point.geography === department.department &&
          point.network === network &&
          point.surface === 'TOTAL',
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
  /* El mapa de calor cruza departamento y medida; lo que el INE no publica queda como hueco. */
  const columns = [
    'Fundamental oficial',
    'Fundamental con código',
    'Departamental oficial',
    'Departamental con código',
    'Sin código en el mapa',
  ] as const;
  const cells = rows.flatMap((row) => {
    const values = [row.officialF, row.tracedF, row.officialD, row.tracedD, row.uncoded];
    return columns.flatMap((column, index): HeatCell[] => {
      const value = values[index];
      return value === null || value === undefined
        ? []
        : [{ row: row.name, column, value, hint: 'km' }];
    });
  });
  return (
    <Panel
      id="trazada-frente-a-oficial"
      className="transp"
      title={`Red vial trazada frente a la oficial por departamento (km, INE ${board.asOfPeriod ?? '—'} y OpenStreetMap)`}
      lede="«Oficial» es el inventario de la ABC y los SEDECA que publica el INE; «con código», lo que OpenStreetMap traza con su número de ruta F o D. La columna «sin código» son secundarias y terciarias trazadas sin número: ahí está la mayor parte de la Red Departamental que el mapa no nombra, y también caminos municipales que el INE no cuenta."
      source="Instituto Nacional de Estadística, con datos de la ABC y los SEDECA (oficial), y OpenStreetMap contributors (trazado)"
      data={{
        unidad: 'km',
        columnas: [
          'Departamento',
          'Fundamental oficial (km)',
          'Fundamental con código (km)',
          'Departamental oficial (km)',
          'Departamental con código (km)',
          'Sin código en el mapa (km)',
        ],
        filas: rows.map((row) => [
          row.name,
          row.officialF,
          row.tracedF,
          row.officialD,
          row.tracedD,
          row.uncoded,
        ]),
      }}
    >
      <ViewToggle
        chart={
          <SinDeclarar>
            <HeatGrid
              rows={rows.map((row) => row.name)}
              columns={columns}
              cells={cells}
              unit="km"
            />
          </SinDeclarar>
        }
        table={
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
        }
      />
    </Panel>
  );
}

/**
 * Las rutas del recorte: las más largas como barras apiladas por rodadura, o todas en tabla.
 *
 * El panel (y con él la vista elegida) no se remonta al cambiar el recorte o el orden; sí
 * la página de la tabla, que se vuelve a montar con `cut` para que quien estaba en la página
 * cuatro no aterrice en una página cuatro que ya no existe.
 */
function RoutesTable({
  rows,
  route,
  where,
  sort,
  cut,
  onSort,
  onPick,
}: {
  rows: RouteRow[];
  route: string | null;
  where: string;
  sort: { key: SortKey; down: boolean };
  /** Lo que define el recorte y el orden: cambia cuando la tabla debe volver a su primera página. */
  cut: string;
  onSort: (key: SortKey) => void;
  onPick: (route: string) => void;
}) {
  const totalKm = rows.reduce((sum, row) => sum + row.totalKm, 0);

  /* Las más largas del recorte; el reparto por rodadura va en el detalle de cada barra. */
  const longest = [...rows].sort((left, right) => right.totalKm - left.totalKm).slice(0, TOP);
  const names = uniqueNames(
    longest.map((row) => ({
      name: row.route ?? 'Sin ruta',
      qualifier: row.departments.map(departmentName).join(', '),
    })),
  );
  const bars = longest.map((row, index) => ({
    name: names[index] ?? '',
    value: row.totalKm,
    ...(route !== null ? { emphasis: row.route === route } : {}),
    ...(row.route ? { pick: row.route } : {}),
    parts: SURFACE_GROUPS.map((one) => ({
      name: one.label,
      value: row.bySurface[one.group],
      unit: 'km',
    })).filter((part) => part.value > 0),
    note: `${NETWORK_SHORT[row.network]} · ${Math.round(row.pavedShare)} % pavimentada`,
  }));

  return (
    <Panel
      id="km-por-ruta"
      className="transp"
      title={`Km por ruta y rodadura, ${where} (km)`}
      lede="Cada cifra es la parte de la ruta que cae en el recorte elegido, no la ruta entera. Las vías sin ruta F-n ni Dn van en una fila por departamento. Toca una ruta para aislarla en el mapa; en la tabla, un encabezado ordena."
      meta={`${number(rows.length)} ${rows.length === 1 ? 'fila' : 'filas'} · ${number(totalKm)} km`}
      source="OpenStreetMap contributors (ODbL)"
      data={() => ({
        unidad: 'km',
        columnas: [
          'Ruta',
          'Red',
          'Departamentos',
          'Pavimentada (km)',
          'Ripio (km)',
          'Tierra (km)',
          'Sin dato (km)',
          'Total (km)',
          'Pavimentado (%)',
        ],
        filas: rows.map((row) => [
          row.route ?? 'Sin ruta',
          NETWORK_LABEL[row.network] ?? null,
          row.departments.map(departmentName).join(', '),
          row.bySurface.PAVIMENTADA,
          row.bySurface.RIPIO,
          row.bySurface.TIERRA,
          row.bySurface.SIN_DATO,
          row.totalKm,
          row.pavedShare,
        ]),
        nota: 'Son todas las rutas del recorte, no solo la página que se ve.',
      })}
    >
      {rows.length === 0 ? (
        <div className="callout">Ninguna ruta coincide con el recorte y la búsqueda.</div>
      ) : (
        <ViewToggle
          chart={
            <>
              <SinDeclarar>
                <ShareBars
                  data={bars}
                  unit="km"
                  decimals={0}
                  tone={seriesTone(0)}
                  height={Math.max(220, bars.length * 34 + 16)}
                  onPick={onPick}
                />
              </SinDeclarar>
              <ChartLegend
                items={[{ color: seriesTone(0), label: `Km por ruta, ${where} (km)` }]}
              />
              <TopNote shown={longest.length} total={rows.length} noun="rutas" />
            </>
          }
          table={
            <RoutesPage
              key={cut}
              rows={rows}
              route={route}
              sort={sort}
              onSort={onSort}
              onPick={onPick}
            />
          }
        />
      )}
    </Panel>
  );
}

/** La tabla de rutas, veinte por página, con el `Pager` de todo el tablero arriba y abajo. */
function RoutesPage({
  rows,
  route,
  sort,
  onSort,
  onPick,
}: {
  rows: RouteRow[];
  route: string | null;
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
    <>
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
                  <td className="num">
                    {row.bySurface.PAVIMENTADA ? number(row.bySurface.PAVIMENTADA, 1) : '—'}
                  </td>
                  <td className="num">
                    {row.bySurface.RIPIO ? number(row.bySurface.RIPIO, 1) : '—'}
                  </td>
                  <td className="num">
                    {row.bySurface.TIERRA ? number(row.bySurface.TIERRA, 1) : '—'}
                  </td>
                  <td className="num">
                    {row.bySurface.SIN_DATO ? number(row.bySurface.SIN_DATO, 1) : '—'}
                  </td>
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
    </>
  );
}

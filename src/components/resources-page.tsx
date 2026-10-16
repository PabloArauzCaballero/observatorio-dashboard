'use client';

import { useMemo, useState } from 'react';
import {
  DivergingBars,
  MacroChart,
  SeriesChart,
  ShareBars,
  WorldLines,
  seriesTone,
} from './charts';
import type { DivergingRow, WorldLinePoint, WorldLineSeries } from './charts';
import { BarsKey } from './chart-kind';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import type { IconName } from './icons';
import { OnOpenNotice, useOnOpen } from './on-open';
import { EXPORT_WORDS, GrowthWorldMap, growthRows } from './growth-world-map';
import { ResourcesSection } from './resources-section';
import { useTradeViews } from './trade-records-fetch';
import { Headlines, SOURCE_ADUANA, say, useLabelRoom } from './trade-records-panels';
import { WorldTradeMap } from './world-trade-map';
import type { MapTrade } from './world-trade-map';
import { Panel } from '@/components/ui/panel';
import { ViewToggle } from '@/components/ui/view-toggle';
import { ANY, additive, choiceOf, list, toggle, without } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import {
  FAMILY_LABEL,
  RESOURCES,
  byResource,
  growth,
  productFilter,
} from '@/lib/resources-customs';
import type { ResourceFamily, ResourceTotal } from '@/lib/resources-customs';
import { COUNTRY_ISO3, countryMap, sameOutline } from '@/lib/trade-countries';
import type { TradeCodes, TradeItem, TradeView } from '@/lib/trade-records';
import { titled } from '@/lib/trade-text';

/**
 * «Recursos naturales»: a dónde va lo que Bolivia saca de su suelo, y cómo cambia.
 *
 * La página abre con el mismo mapa del mundo de «Sector externo», pero recortado
 * a los recursos del subsuelo —minería, hidrocarburos, litio y boratos— de la
 * base aduanera del INE (`/api/comercio-exterior/aduana`, ver
 * `resources-customs.ts` para qué partidas entran). Todo se cruza: el recurso,
 * los años, la medida, el departamento de origen y el país de destino recortan
 * a la vez el mapa, los ránkings y las series; cada ránking se cuenta sin su
 * propio filtro (lo hace la API), para que el lector vea las alternativas.
 *
 * **El crecimiento** es siempre el último año elegido contra el anterior, en la
 * medida elegida (valor o peso). El mapa lo pinta por clases —compró más,
 * compró menos, destino nuevo— y los ránkings lo dan en barras divergentes.
 *
 * **Lo que se pide.** Tres lecturas fijas por cada combinación de filtros —el
 * año, el año anterior y la serie del rango— y una serie por recurso para los
 * seis recursos que se dibujan. La API guarda cada respuesta diez minutos, y el
 * año en curso, que el INE publica hasta un mes, se compara con el mismo tramo
 * de meses del año anterior.
 *
 * Debajo sigue el capítulo que ya existía (`ResourcesSection`): rentas, ahorro
 * ajustado y la serie larga por producto de UN Comtrade.
 */

const API = '/api/comercio-exterior/aduana';
const VIEWS = 'paises:country:300,prods:nandina:300,deptos:department:12';
/** Cuántos recursos caben en el gráfico de líneas: las casillas de la paleta. */
const SLOTS = 6;
/** Cuántas barras de destino se dibujan; la tabla las tiene todas. */
const TOP_DESTINATIONS = 12;

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

type Measure = 'usd' | 'kg';

const FAMILY_ICON: Record<ResourceFamily, IconName> = {
  mineria: 'gema',
  minerales: 'capas',
  hidrocarburos: 'gota',
  salar: 'chip',
};

/** Millones de USD o toneladas, según la medida. */
const valueOf = (item: { usd: number; kg: number }, measure: Measure): number =>
  measure === 'usd' ? item.usd / 1_000_000 : item.kg / 1000;

const unitOf = (measure: Measure): { short: string; long: string } =>
  measure === 'usd'
    ? { short: 'millones de USD', long: 'millones de USD' }
    : { short: 't', long: 'toneladas' };

/** Más decimales donde la cifra es chica: un destino de 0,004 millones de USD no es «0». */
const smart = (value: number): string =>
  say(value, Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 1 ? 1 : 3);

const amount = (value: number, measure: Measure): string =>
  measure === 'usd'
    ? `USD ${say(value, value >= 100 ? 0 : 1)} millones`
    : `${say(value, 0)} toneladas`;

const signed = (value: number): string => `${value >= 0 ? '+' : ''}${say(value, 1)} %`;

/** «zinc, plata y oro». */
function joined(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
}

function urlOf(
  from: number,
  to: number,
  views: string,
  filters: { product: string; country: string; department: string; months: string | null },
): string {
  const params = new URLSearchParams({ flow: 'X', from: String(from), to: String(to), views });
  if (filters.product) params.set('product', filters.product);
  if (filters.country) params.set('country', filters.country);
  if (filters.department) params.set('department', filters.department);
  if (filters.months) params.set('months', filters.months);
  return `${API}?${params.toString()}`;
}

/**
 * Los países de una vista, sumados por contorno del mapa, en la medida elegida.
 * `countryMap` da millones de USD o miles de toneladas; aquí el peso va en toneladas,
 * la misma unidad que los ránkings y las cifras de arriba.
 */
function outlines(
  items: readonly TradeItem[],
  measure: Measure,
): { rows: MapTrade[]; unplaced: Array<{ label: string; value: number }> } {
  const map = countryMap(items, measure);
  if (measure === 'usd') return map;
  return {
    rows: map.rows.map((row) => ({ ...row, value: row.value * 1000 })),
    unplaced: map.unplaced.map((row) => ({ ...row, value: row.value * 1000 })),
  };
}

/** Una fila de ránking: el nivel, el año anterior y la variación. */
interface Ranked {
  key: string;
  name: string;
  value: number;
  now: number;
  before: number;
  change: number | null;
}

function ranked(
  level: readonly TradeItem[],
  now: readonly TradeItem[],
  before: readonly TradeItem[],
  measure: Measure,
): Ranked[] {
  const thisYear = new Map(now.map((item) => [item.key, valueOf(item, measure)]));
  const lastYear = new Map(before.map((item) => [item.key, valueOf(item, measure)]));
  return level
    .filter((item) => item.key !== null && valueOf(item, measure) > 0)
    .map((item) => {
      const current = thisYear.get(item.key) ?? 0;
      const prior = lastYear.get(item.key) ?? 0;
      return {
        key: item.key ?? '',
        name: item.label,
        value: valueOf(item, measure),
        now: current,
        before: prior,
        change: growth(current, prior),
      };
    })
    .sort((left, right) => right.value - left.value);
}

function Switch<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ by: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="chart-kind" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.by}
          type="button"
          className={option.by === value ? 'chip chip-on' : 'chip'}
          aria-pressed={option.by === value}
          onClick={() => onChange(option.by)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function RailItems({
  entries,
  chosen,
  onPick,
  icon,
  cut = 9,
}: {
  entries: ReadonlyArray<{ code: string; name: string }>;
  chosen: Choice;
  onPick: (code: string, add: boolean) => void;
  icon: IconName;
  cut?: number;
}) {
  return (
    <div className={entries.length > cut ? 'rail-list rail-list-cut' : 'rail-list'}>
      {entries.map((entry) => {
        const on = chosen.has(entry.code);
        return (
          <button
            key={entry.code}
            type="button"
            className={on ? 'rail-item rail-item-on' : 'rail-item'}
            aria-pressed={on}
            onClick={(event) => onPick(entry.code, additive(event))}
          >
            <Icon name={icon} size={16} />
            <span className="rail-name">{entry.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** La tabla de un ránking: nivel, año, año anterior y variación. */
function RankTable({
  rows,
  head,
  unit,
  year,
  ranged,
}: {
  rows: readonly Ranked[];
  head: string;
  unit: string;
  year: number;
  /** Si la columna de nivel es la suma de un rango y no el año. */
  ranged: string | null;
}) {
  return (
    <div className="table-wrap">
      <table className="grid-table">
        <thead>
          <tr>
            <th>{head}</th>
            {ranged ? <th className="num">{`${ranged} (${unit})`}</th> : null}
            <th className="num">{`${year} (${unit})`}</th>
            <th className="num">{`${year - 1} (${unit})`}</th>
            <th className="num">Variación</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.name}</td>
              {ranged ? <td className="num">{smart(row.value)}</td> : null}
              <td className="num">
                <b>{smart(row.now)}</b>
              </td>
              <td className="num">{smart(row.before)}</td>
              <td className="num">{row.change === null ? '—' : signed(row.change)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Las cifras completas de un ránking para la descarga, con lo que muestran las tres vistas. */
const rankData = (
  rows: readonly Ranked[],
  head: string,
  unit: string,
  year: number,
  ranged: string | null,
  nota: string,
) => ({
  unidad: unit,
  columnas: [
    head,
    ...(ranged ? [`${ranged} (${unit})`] : []),
    `${year} (${unit})`,
    `${year - 1} (${unit})`,
    `Variación frente a ${year - 1} (%)`,
  ],
  filas: rows.map((row) => [
    row.name,
    ...(ranged ? [row.value] : []),
    row.now,
    row.before,
    row.change,
  ]),
  nota,
});

const divergent = (rows: readonly Ranked[], unit: string, year: number): DivergingRow[] =>
  rows
    .filter((row) => row.change !== null)
    .map((row) => ({
      name: row.name,
      value: row.change ?? 0,
      meta: `${smart(row.before)} → ${smart(row.now)} ${unit} (${year - 1} → ${year})`,
    }));

function CustomsResources({ catalogue }: { catalogue: TradeCodes }) {
  const span = catalogue.coverage.find((entry) => entry.grain === 'X_DETAIL');
  const first = span?.first ?? 1992;
  const last = span?.last ?? 2025;
  const lastMonth = span?.lastMonth ?? 12;
  const lastFull = lastMonth < 12 ? last - 1 : last;
  const room = useLabelRoom();

  const [from, setFrom] = useState(first);
  const [year, setYear] = useState(lastFull);
  const [scope, setScope] = useState<'year' | 'range'>('year');
  const [measure, setMeasure] = useState<Measure>('usd');
  const [mapMode, setMapMode] = useState<'level' | 'growth'>('level');
  const [resources, setResources] = useState<Choice>(ANY);
  const [countries, setCountries] = useState<Choice>(ANY);
  const [departments, setDepartments] = useState<Choice>(ANY);
  const [lastCountry, setLastCountry] = useState<string | null>(null);
  const [countryText, setCountryText] = useState('');

  const partial = year === last && lastMonth < 12;
  const ranged = scope === 'range' && from < year;
  const unit = unitOf(measure);
  /* Las series van en miles de toneladas: un eje de cientos de miles no cabe en media columna. */
  const line =
    measure === 'kg'
      ? { short: 'mil t', long: 'miles de toneladas', scale: 0.001 }
      : { ...unit, scale: 1 };
  const months = partial ? `1-${lastMonth}` : null;
  const stretch = partial ? `enero-${MONTHS[lastMonth - 1]} ` : '';
  const period = ranged ? `${from}-${year}` : `${stretch}${year}`;

  const filters = useMemo(
    () => ({
      product: productFilter(resources).join(','),
      country: list(countries).join(','),
      department: list(departments).join(','),
      months,
    }),
    [resources, countries, departments, months],
  );

  const now = useTradeViews(urlOf(year, year, VIEWS, filters));
  const before = useTradeViews(
    year - 1 >= first ? urlOf(year - 1, year - 1, VIEWS, filters) : null,
  );
  const range = useTradeViews(
    urlOf(Math.min(from, year), year, ranged ? `serie:year,${VIEWS}` : 'serie:year', filters),
  );

  const nowViews = now.views;
  const levelViews = ranged ? range.views : nowViews;
  const view = (views: Record<string, TradeView> | null, name: string): TradeItem[] =>
    views?.[name]?.items ?? [];

  /* Recursos: el año, el anterior y el nivel del periodo. */
  const resourceNow = byResource(view(nowViews, 'prods'));
  const resourceBefore = new Map(
    byResource(view(before.views, 'prods')).map((entry) => [entry.resource.id, entry]),
  );
  const resourceLevel = ranged ? byResource(view(levelViews, 'prods')) : resourceNow;
  const resourceRows: Ranked[] = resourceLevel
    .map((entry: ResourceTotal) => {
      const current = resourceNow.find((one) => one.resource.id === entry.resource.id);
      const prior = resourceBefore.get(entry.resource.id);
      const thisYear = current ? valueOf(current, measure) : 0;
      const lastYear = prior ? valueOf(prior, measure) : 0;
      return {
        key: entry.resource.id,
        name: entry.resource.label,
        value: valueOf(entry, measure),
        now: thisYear,
        before: lastYear,
        change: growth(thisYear, lastYear),
      };
    })
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value);

  /* Los seis recursos de la serie: los elegidos, o los seis mayores del año. */
  const shown = (
    resources.size
      ? RESOURCES.filter((resource) => resources.has(resource.id)).sort(
          (left, right) =>
            (resourceNow.find((one) => one.resource.id === right.id)?.usd ?? 0) -
            (resourceNow.find((one) => one.resource.id === left.id)?.usd ?? 0),
        )
      : resourceNow.map((entry) => entry.resource)
  ).slice(0, SLOTS);
  const slotUrl = (index: number): string | null => {
    const resource = shown[index];
    if (!resource || !nowViews) return null;
    return urlOf(Math.min(from, year), year, 'serie:year', {
      ...filters,
      product: productFilter([resource.id]).join(','),
    });
  };
  const slot0 = useTradeViews(slotUrl(0));
  const slot1 = useTradeViews(slotUrl(1));
  const slot2 = useTradeViews(slotUrl(2));
  const slot3 = useTradeViews(slotUrl(3));
  const slot4 = useTradeViews(slotUrl(4));
  const slot5 = useTradeViews(slotUrl(5));
  const slots = [slot0, slot1, slot2, slot3, slot4, slot5];

  /* Totales del año y del anterior, con todos los filtros. */
  const total = (items: readonly TradeItem[]) =>
    items.reduce((sum, item) => sum + valueOf(item, measure), 0);
  const totalNow = total(view(nowViews, 'prods'));
  const totalBefore = total(view(before.views, 'prods'));
  const totalUsd = view(nowViews, 'prods').reduce((sum, item) => sum + item.usd, 0) / 1_000_000;
  const totalTons = view(nowViews, 'prods').reduce((sum, item) => sum + item.kg, 0) / 1000;
  const totalChange = growth(totalNow, totalBefore);

  /* Destinos: el mapa por contorno y el ránking por código. */
  const destinations = ranked(
    view(levelViews, 'paises'),
    view(nowViews, 'paises'),
    view(before.views, 'paises'),
    measure,
  );
  const allDestinations = total(view(levelViews, 'paises'));
  const levelMap = outlines(view(levelViews, 'paises'), measure);
  const growthMap = growthRows(
    outlines(view(nowViews, 'paises'), measure).rows,
    outlines(view(before.views, 'paises'), measure).rows,
  );
  const unplaced = levelMap.unplaced.reduce((sum, row) => sum + row.value, 0);
  const topDestination = destinations[0];

  const origins = ranked(
    view(levelViews, 'deptos'),
    view(nowViews, 'deptos'),
    view(before.views, 'deptos'),
    measure,
  );
  const allOrigins = origins.reduce((sum, row) => sum + row.value, 0);

  /* La serie del rango, y su variación año a año. */
  const series = view(range.views, 'serie')
    .map((item) => ({ year: Number(item.key), value: valueOf(item, measure) * line.scale }))
    .filter((point) => Number.isFinite(point.year))
    .sort((left, right) => left.year - right.year);
  const seriesChange = series
    .map((point, index) => {
      const prior = series[index - 1];
      const change =
        prior && prior.year === point.year - 1 ? growth(point.value, prior.value) : null;
      return { year: point.year, change };
    })
    .filter((point): point is { year: number; change: number } => point.change !== null);

  /* Una línea por recurso. */
  const lineSeries: WorldLineSeries[] = shown.map((resource, index) => ({
    key: resource.id,
    label: resource.label,
    tone: seriesTone(index),
    emphasis: index === 0,
  }));
  const years = new Set<number>();
  const perResource = shown.map((resource, index) => {
    const values = new Map<number, number>();
    for (const item of slots[index]?.views?.serie?.items ?? []) {
      const at = Number(item.key);
      if (!Number.isFinite(at)) continue;
      values.set(at, valueOf(item, measure) * line.scale);
      years.add(at);
    }
    return { resource, values };
  });
  const orderedYears = [...years].sort((left, right) => left - right);
  const resourceLines: WorldLinePoint[] = orderedYears.map((at) => {
    const row: WorldLinePoint = { year: String(at) };
    for (const { resource, values } of perResource) row[resource.id] = values.get(at) ?? null;
    return row;
  });
  const resourceChangeLines: WorldLinePoint[] = orderedYears.slice(1).map((at) => {
    const row: WorldLinePoint = { year: String(at) };
    for (const { resource, values } of perResource) {
      const current = values.get(at);
      const prior = values.get(at - 1);
      row[resource.id] =
        current !== undefined && prior !== undefined ? growth(current, prior) : null;
    }
    return row;
  });

  /* Nombres para la lectura y las pastillas. */
  const countryName = (code: string): string =>
    titled((catalogue.codes.COUNTRY ?? []).find((entry) => entry.code === code)?.name ?? code);
  const departmentName = (code: string): string =>
    titled((catalogue.codes.DEPARTMENT ?? []).find((entry) => entry.code === code)?.name ?? code);
  const chosenResources = RESOURCES.filter((resource) => resources.has(resource.id));
  const outlinesPicked = [...new Set(list(countries).map((code) => COUNTRY_ISO3[code] ?? code))];
  const focus =
    outlinesPicked.length === 1
      ? lastCountry && countries.has(lastCountry)
        ? lastCountry
        : (list(countries)[0] ?? null)
      : null;

  const pickCountry = (codes: readonly string[], add: boolean) => {
    setCountries((current) => {
      if (codes.length === 1) return toggle(current, codes[0]!, add);
      const all = codes.every((code) => current.has(code));
      return all ? ANY : add ? new Set([...current, ...codes]) : choiceOf(...codes);
    });
    if (codes.length) setLastCountry(codes[0]!);
  };
  const pickOutline = (token: string, add: boolean) => pickCountry(sameOutline(token), add);
  const clear = () => {
    setResources(ANY);
    setCountries(ANY);
    setDepartments(ANY);
  };

  /* La lectura simple de arriba. */
  const what = chosenResources.length
    ? joined(chosenResources.map((resource) => resource.label.toLowerCase()))
    : 'recursos naturales del subsuelo';
  const whence = departments.size ? ` desde ${joined(list(departments).map(departmentName))}` : '';
  const whither = countries.size
    ? ` a ${joined(
        outlinesPicked.map((iso) => {
          const code = list(countries).find((one) => (COUNTRY_ISO3[one] ?? one) === iso) ?? iso;
          return countryName(code);
        }),
      )}`
    : '';
  const when = partial ? `Entre enero y ${MONTHS[lastMonth - 1]} de ${year}` : `En ${year}`;
  const focusRank = focus
    ? destinations.findIndex((row) => sameOutline(focus).includes(row.key)) + 1
    : 0;
  const focusShare =
    focus && allDestinations
      ? (destinations
          .filter((row) => sameOutline(focus).includes(row.key))
          .reduce((sum, row) => sum + row.now, 0) /
          total(view(nowViews, 'paises'))) *
        100
      : null;
  const reading = !nowViews
    ? 'Cargando la base aduanera…'
    : totalNow > 0
      ? [
          `${when} Bolivia exportó ${amount(totalNow, measure)} ${measure === 'kg' ? 'de' : 'en'} ${what}${whence}${whither}.`,
          !countries.size && topDestination && allDestinations
            ? `El principal destino fue ${topDestination.name} (${say((topDestination.now / total(view(nowViews, 'paises'))) * 100, 1)} %).`
            : focus && focusRank > 0 && focusShare !== null
              ? `${countryName(focus)} fue el destino número ${focusRank}, con el ${say(focusShare, 1)} % del total.`
              : '',
          totalChange === null
            ? `No hay exportaciones de ${year - 1} con qué comparar.`
            : `Frente a ${partial ? `los mismos meses de ${year - 1}` : year - 1}, ${
                measure === 'usd' ? 'el valor' : 'el peso'
              } ${totalChange >= 0 ? 'creció' : 'cayó'} ${say(Math.abs(totalChange), 1)} %.`,
        ]
          .filter(Boolean)
          .join(' ')
      : `${when} no hay exportaciones declaradas de ${what}${whence}${whither}.`;

  const headlines = [
    {
      label: `Valor ${stretch}${year}`,
      value: nowViews ? `${say(totalUsd, totalUsd >= 100 ? 0 : 1)} millones de USD` : '—',
      hint: 'Valor FOB declarado en aduana',
    },
    {
      label: `Frente a ${year - 1}`,
      value: totalChange === null ? '—' : signed(totalChange),
      hint: measure === 'usd' ? 'Variación del valor' : 'Variación del peso',
    },
    {
      label: `Peso ${stretch}${year}`,
      value: nowViews ? `${say(totalTons, 0)} t` : '—',
      hint: 'Peso neto',
    },
    {
      label: 'Principal destino',
      value: topDestination?.name ?? '—',
      hint:
        topDestination && allDestinations
          ? `${say((topDestination.value / allDestinations) * 100, 1)} % ${measure === 'kg' ? 'del peso' : 'del valor'}, ${period}`
          : '',
    },
    {
      label: 'Principal recurso',
      value: resourceRows[0]?.name ?? '—',
      hint:
        resourceRows[0] && resourceRows.length
          ? `${say((resourceRows[0].value / resourceRows.reduce((sum, row) => sum + row.value, 0)) * 100, 1)} % del total, ${period}`
          : '',
    },
    {
      label: 'Principal origen',
      value: origins[0]?.name ?? '—',
      hint:
        origins[0] && allOrigins
          ? `${say((origins[0].value / allOrigins) * 100, 1)} % del total, ${period}`
          : '',
    },
  ];

  const focusItems = focus
    ? [
        {
          label: `${countryName(focus)}, ${stretch}${year}`,
          value: `${smart(totalNow)} ${unit.short}`,
          hint: 'Con los filtros de recurso y departamento',
        },
        {
          label: 'Parte del total',
          value: focusShare === null ? '—' : `${say(focusShare, 1)} %`,
          hint: `De todo lo exportado en ${year}`,
        },
        {
          label: 'Puesto entre destinos',
          value: focusRank > 0 ? String(focusRank) : '—',
          hint: `De ${destinations.length} destinos`,
        },
        {
          label: `Frente a ${year - 1}`,
          value: totalChange === null ? '—' : signed(totalChange),
          hint: measure === 'usd' ? 'Variación del valor' : 'Variación del peso',
        },
        {
          label: 'Principal recurso comprado',
          value: resourceRows[0]?.name ?? '—',
          hint: resourceRows[0] ? `${smart(resourceRows[0].value)} ${unit.short}, ${period}` : '',
        },
      ]
    : [];

  const context = `Exportaciones de recursos naturales, ${period}, INE; recursos: ${
    chosenResources.map((resource) => resource.label).join(', ') || 'todos'
  }; país: ${list(countries).map(countryName).join(', ') || 'todos'}; departamento: ${
    list(departments).map(departmentName).join(', ') || 'todos'
  }`;

  const loading = now.loading || before.loading || range.loading;
  const active = chosenResources.map((resource) => ({
    key: `r-${resource.id}`,
    label: resource.label,
    icon: FAMILY_ICON[resource.family],
    remove: () => setResources((current) => without(current, resource.id)),
  })) as Array<{ key: string; label: string; icon: IconName; remove: () => void }>;
  for (const code of list(departments)) {
    active.push({
      key: `d-${code}`,
      label: departmentName(code),
      icon: 'mapa',
      remove: () => setDepartments((current) => without(current, code)),
    });
  }
  for (const iso of outlinesPicked) {
    const codes = list(countries).filter((one) => (COUNTRY_ISO3[one] ?? one) === iso);
    active.push({
      key: `c-${iso}`,
      label: countryName(codes[0] ?? iso),
      icon: 'globo',
      remove: () =>
        setCountries((current) => codes.reduce((next, code) => without(next, code), current)),
    });
  }

  const countryEntries = (catalogue.codes.COUNTRY ?? [])
    .map((entry) => ({ code: entry.code, name: titled(entry.name) }))
    .filter(
      (entry) =>
        !countryText || entry.name.toLowerCase().includes(countryText.trim().toLowerCase()),
    )
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));
  const departmentEntries = (catalogue.codes.DEPARTMENT ?? [])
    .map((entry) => ({ code: entry.code, name: titled(entry.name) }))
    .sort((left, right) => Number(left.code) - Number(right.code));

  const cut = (text: string): string => (text.length > room ? `${text.slice(0, room - 1)}…` : text);
  const levelBars = (rows: readonly Ranked[], top: number, chosen: Choice, by: 'key' | 'outline') =>
    rows.slice(0, top).map((row) => ({
      name: cut(row.name),
      value: row.value,
      pick: row.key,
      ...((by === 'outline' ? sameOutline(row.key) : [row.key]).some((code) => chosen.has(code))
        ? { emphasis: true }
        : {}),
    }));

  return (
    <>
      <a className="jump-to-filters" href="#recursos-filtros">
        <Icon name="filtro" size={14} />
        Ir a los filtros
      </a>
      <div className="workspace">
        <aside className="rail" id="recursos-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">
              {active.length
                ? `${active.length} activo${active.length === 1 ? '' : 's'}`
                : 'sin filtro'}
            </span>
          </div>
          <FilterHint>Se aplican al mapa, a los ránkings y a las series a la vez.</FilterHint>

          {active.length ? (
            <div className="rail-sec">
              <div className="rail-head">
                <Icon name="capas" size={13} />
                Selección activa
              </div>
              <div className="rail-pills">
                {active.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className="chip chip-on chip-wide"
                    onClick={entry.remove}
                    title="Quitar del filtro"
                  >
                    <Icon name={entry.icon} size={12} />
                    <span className="chip-text">{entry.label}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
                <button type="button" className="chip" onClick={clear}>
                  Limpiar todo
                </button>
              </div>
            </div>
          ) : null}

          {(Object.keys(FAMILY_LABEL) as ResourceFamily[]).map((family) => (
            <div className="rail-sec" key={family}>
              <div className="rail-head">
                <Icon name={FAMILY_ICON[family]} size={13} />
                {FAMILY_LABEL[family]}
              </div>
              <RailItems
                entries={RESOURCES.filter((resource) => resource.family === family).map(
                  (resource) => ({ code: resource.id, name: resource.label }),
                )}
                chosen={resources}
                onPick={(code, add) => setResources((current) => toggle(current, code, add))}
                icon={FAMILY_ICON[family]}
                cut={12}
              />
            </div>
          ))}

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} />
              Años: {Math.min(from, year)}-{year}
            </div>
            <div className="rail-field">
              <input
                type="range"
                aria-label={`Desde: ${from}`}
                min={first}
                max={year}
                value={Math.min(from, year)}
                onChange={(event) => setFrom(Math.min(Number(event.target.value), year))}
              />
            </div>
            <div className="rail-field rail-field-next">
              <input
                type="range"
                aria-label={`Hasta: ${year}`}
                min={first}
                max={last}
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              />
            </div>
            <p className="rail-hint">
              Las series cubren todo el rango. El mapa, los ránkings y el crecimiento miran el
              último año ({year}) frente al anterior.
            </p>
            <div className="rail-pills">
              {(
                [
                  ['year', `Solo ${year}`],
                  ['range', `Suma ${Math.min(from, year)}-${year}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={scope === key ? 'chip chip-on' : 'chip'}
                  aria-pressed={scope === key}
                  disabled={key === 'range' && from >= year}
                  onClick={() => setScope(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="balanza" size={13} />
              Medida
            </div>
            <div className="rail-pills">
              {(
                [
                  ['usd', 'Valor (USD)'],
                  ['kg', 'Peso (toneladas)'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={measure === key ? 'chip chip-on' : 'chip'}
                  aria-pressed={measure === key}
                  onClick={() => setMeasure(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="mapa" size={13} />
              Departamento de origen
              <PickedCount choice={departments} />
            </div>
            <RailItems
              entries={departmentEntries}
              chosen={departments}
              onPick={(code, add) => setDepartments((current) => toggle(current, code, add))}
              icon="mapa"
              cut={12}
            />
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="globo" size={13} />
              País de destino
              <PickedCount choice={countries} />
            </div>
            <div className="rail-field">
              <input
                type="search"
                value={countryText}
                aria-label="Buscar un país"
                placeholder="China, India, Japón…"
                onChange={(event) => setCountryText(event.target.value)}
              />
            </div>
            <RailItems
              entries={countryEntries}
              chosen={countries}
              onPick={(code, add) => pickCountry([code], add)}
              icon="globo"
            />
          </div>
        </aside>

        <div
          className={
            loading ? 'workspace-main guest-board aduana-cargando' : 'workspace-main guest-board'
          }
        >
          {now.failed ? (
            <div className="callout">
              No se pudo leer la base aduanera. Recargar la página o volver en unos minutos.
            </div>
          ) : null}
          {partial ? (
            <div className="callout">
              <strong>{year} está incompleto:</strong> el INE publicó datos hasta{' '}
              {MONTHS[lastMonth - 1]}. Todas las cifras de esta parte comparan enero-
              {MONTHS[lastMonth - 1]} de cada año.
            </div>
          ) : null}

          <Panel
            id="recursos-lectura"
            title={`Exportaciones de recursos naturales en ${stretch}${year} (millones de USD, toneladas y %)`}
            lede={reading}
            source={SOURCE_ADUANA}
            data={() => ({
              columnas: ['Cifra', 'Valor', 'Nota'],
              filas: headlines.map((item) => [item.label, item.value, item.hint]),
              nota: context,
            })}
          >
            <Headlines items={headlines} />
          </Panel>

          <Panel
            id="recursos-mapa"
            title={
              mapMode === 'level'
                ? `A dónde van los recursos naturales de Bolivia (${unit.long}, ${period})`
                : `Crecimiento de las exportaciones de recursos naturales por destino (% frente a ${year - 1})`
            }
            lede={
              mapMode === 'level'
                ? 'Cuanto más intenso el tono, más compró ese país. Al seleccionar un país, toda la página pasa a mostrar lo que se le vende.'
                : `Cada país según compró más o menos que en ${year - 1}. La cifra exacta aparece al pasar sobre el país y en el ránking de destinos.`
            }
            source={SOURCE_ADUANA}
          >
            <div className="fx-filters">
              <Switch
                label="Qué pinta el mapa"
                options={[
                  { by: 'level' as const, label: 'Cuánto compra' },
                  { by: 'growth' as const, label: `Crecimiento frente a ${year - 1}` },
                ]}
                value={mapMode}
                onChange={setMapMode}
              />
            </div>
            {!nowViews ? (
              <OnOpenNotice what="el mapa" failed={now.failed} />
            ) : mapMode === 'level' ? (
              levelMap.rows.length ? (
                <WorldTradeMap
                  rows={levelMap.rows}
                  unit={unit.short}
                  label={`exportaciones de recursos naturales por país, ${period}`}
                  picked={countries}
                  onPick={pickOutline}
                  absent="sin compras declaradas con estos filtros"
                  absentKey="sin compras declaradas"
                  format={smart}
                  exact={smart}
                />
              ) : (
                <div className="callout">No hay exportaciones declaradas con estos filtros.</div>
              )
            ) : growthMap.length ? (
              <GrowthWorldMap
                rows={growthMap}
                unit={unit.short}
                year={year}
                words={EXPORT_WORDS}
                label={`crecimiento de las exportaciones de recursos naturales por país, ${year} frente a ${year - 1}`}
                picked={countries}
                onPick={pickOutline}
                exact={smart}
              />
            ) : (
              <div className="callout">No hay exportaciones declaradas con estos filtros.</div>
            )}
            {mapMode === 'level' && levelMap.unplaced.length ? (
              <p className="chart-note">
                No figura en el mapa por no ser un territorio con contorno:{' '}
                {levelMap.unplaced
                  .slice(0, 3)
                  .map((row) => `${row.label} (${smart(row.value)} ${unit.short})`)
                  .join(', ')}
                {levelMap.unplaced.length > 3 ? ` y ${levelMap.unplaced.length - 3} más` : ''}
                {levelMap.unplaced.length > 1 ? `; en total ${smart(unplaced)} ${unit.short}` : ''}.
                Sí se cuenta en los ránkings y en las cifras de arriba.
              </p>
            ) : null}
            <details className="panel-note">
              <summary>Cómo leerlo</summary>
              <p>
                El mapa aplica el recurso, el departamento y los años elegidos, pero no el filtro de
                país, para que siempre se vean todos los compradores. Al seleccionar un país se
                añade al filtro y el resto de la página muestra solo lo que se le vende; con Ctrl/⌘
                se suman varios. En «Crecimiento» cada país compara {year} con {year - 1} en{' '}
                {measure === 'usd' ? 'valor' : 'peso'}: el color dice si compró más o menos, y un
                destino nuevo —que no compró nada el año anterior— cuenta como «compró más». Un país
                chico puede «crecer» mucho con poco: la magnitud se lee en el ránking de destinos.
              </p>
            </details>
          </Panel>

          {focus ? (
            <Panel
              id="recursos-ficha"
              title={`Ficha de ${countryName(focus)} como destino (${unit.long}, % y puesto, ${stretch}${year})`}
              lede={`Cuánto compra ${countryName(focus)}, qué parte del total se lleva y cómo cambió. Los ránkings y las series de abajo ya muestran solo lo que se le vende.`}
              source={SOURCE_ADUANA}
              data={() => ({
                columnas: ['Cifra', 'Valor', 'Nota'],
                filas: focusItems.map((item) => [item.label, item.value, item.hint]),
                nota: context,
              })}
            >
              <Headlines items={focusItems} />
              <div className="fx-filters">
                <button type="button" className="chip" onClick={() => setCountries(ANY)}>
                  Quitar el filtro de país
                </button>
              </div>
            </Panel>
          ) : null}

          <div className="grid-pair">
            <Panel
              id="recursos-destinos"
              title={`Principales destinos (${unit.long}, ${period})`}
              lede="Los países que más compran, con los filtros de recurso y departamento. «Crecimiento» compara el último año con el anterior para los doce mayores."
              source={SOURCE_ADUANA}
              data={() =>
                rankData(destinations, 'País', unit.short, year, ranged ? period : null, context)
              }
            >
              {destinations.length ? (
                <ViewToggle
                  label="Vista de los destinos"
                  variationLabel="Crecimiento"
                  chart={
                    <>
                      <ShareBars
                        data={levelBars(destinations, TOP_DESTINATIONS, countries, 'outline')}
                        tone="var(--series-1)"
                        unit={` ${unit.short}`}
                        onPick={(code, add) => pickCountry(sameOutline(code), add)}
                        declare={false}
                        {...(measure === 'kg' ? { decimals: 0 } : {})}
                      />
                      <BarsKey
                        label={`${measure === 'usd' ? 'Valor FOB' : 'Peso neto'}, ${unit.long}${
                          destinations.length > TOP_DESTINATIONS
                            ? `; ${destinations.length - TOP_DESTINATIONS} ${destinations.length - TOP_DESTINATIONS === 1 ? 'destino' : 'destinos'} más en la tabla`
                            : ''
                        }`}
                        tone="var(--series-1)"
                      />
                    </>
                  }
                  variation={
                    <DivergingBars
                      data={divergent(destinations.slice(0, TOP_DESTINATIONS), unit.short, year)}
                      unit="%"
                      signed
                    />
                  }
                  table={
                    <RankTable
                      rows={destinations}
                      head="País"
                      unit={unit.short}
                      year={year}
                      ranged={ranged ? period : null}
                    />
                  }
                />
              ) : (
                <div className="callout">No hay exportaciones declaradas con estos filtros.</div>
              )}
            </Panel>

            <Panel
              id="recursos-departamentos"
              title={`Departamento de origen (${unit.long}, ${period})`}
              lede="De qué departamento sale lo exportado, con todos los filtros salvo el de departamento. Al seleccionar una barra se filtra por ese departamento."
              source={SOURCE_ADUANA}
              data={() =>
                rankData(origins, 'Departamento', unit.short, year, ranged ? period : null, context)
              }
            >
              {origins.length ? (
                <ViewToggle
                  label="Vista de los departamentos"
                  variationLabel="Crecimiento"
                  chart={
                    <>
                      <ShareBars
                        data={levelBars(origins, 12, departments, 'key')}
                        tone="var(--series-1)"
                        unit={` ${unit.short}`}
                        onPick={(code, add) =>
                          setDepartments((current) => toggle(current, code, add))
                        }
                        declare={false}
                        {...(measure === 'kg' ? { decimals: 0 } : {})}
                      />
                      <BarsKey
                        label={`${measure === 'usd' ? 'Valor FOB' : 'Peso neto'}, ${unit.long}`}
                        tone="var(--series-1)"
                      />
                    </>
                  }
                  variation={
                    <DivergingBars data={divergent(origins, unit.short, year)} unit="%" signed />
                  }
                  table={
                    <RankTable
                      rows={origins}
                      head="Departamento"
                      unit={unit.short}
                      year={year}
                      ranged={ranged ? period : null}
                    />
                  }
                />
              ) : (
                <div className="callout">No hay exportaciones declaradas con estos filtros.</div>
              )}
            </Panel>
          </div>

          <Panel
            id="recursos-por-recurso"
            title={`Exportaciones por recurso (${unit.long}, ${period})`}
            lede="Cada recurso junta el mineral concentrado y el metal que sale de fundición o refinería. Al seleccionar una barra se filtra la página por ese recurso; con Ctrl/⌘ se suman varios."
            source={SOURCE_ADUANA}
            data={() =>
              rankData(resourceRows, 'Recurso', unit.short, year, ranged ? period : null, context)
            }
          >
            {resourceRows.length ? (
              <ViewToggle
                label="Vista de los recursos"
                variationLabel="Crecimiento"
                chart={
                  <>
                    <ShareBars
                      data={resourceRows.map((row) => ({
                        name: row.name,
                        value: row.value,
                        pick: row.key,
                        ...(resources.has(row.key) ? { emphasis: true } : {}),
                      }))}
                      tone="var(--series-1)"
                      unit={` ${unit.short}`}
                      onPick={(code, add) => setResources((current) => toggle(current, code, add))}
                      declare={false}
                      {...(measure === 'kg' ? { decimals: 0 } : {})}
                    />
                    <BarsKey
                      label={`${measure === 'usd' ? 'Valor FOB' : 'Peso neto'}, ${unit.long}`}
                      tone="var(--series-1)"
                    />
                  </>
                }
                variation={
                  <DivergingBars data={divergent(resourceRows, unit.short, year)} unit="%" signed />
                }
                table={
                  <RankTable
                    rows={resourceRows}
                    head="Recurso"
                    unit={unit.short}
                    year={year}
                    ranged={ranged ? period : null}
                  />
                }
              />
            ) : (
              <div className="callout">No hay exportaciones declaradas con estos filtros.</div>
            )}
            <details className="panel-note">
              <summary>Qué partidas entran en cada recurso</summary>
              <ul>
                {RESOURCES.map((resource) => (
                  <li key={resource.id}>
                    <b>{resource.label}:</b> {resource.note}.
                  </li>
                ))}
              </ul>
              <p>
                El litio se exporta como carbonato o cloruro, que el arancel clasifica como
                productos químicos y no como minerales. La soya, la castaña y la madera también son
                recursos naturales, pero no del subsuelo: se ven en «Sector externo». Tampoco entran
                los desperdicios de metales preciosos (7112), que son chatarra y no extracción.
              </p>
            </details>
          </Panel>

          <div className="grid-pair">
            <Panel
              id="recursos-serie"
              title={`Exportaciones de recursos naturales por año (${line.long})`}
              lede={`${partial ? `Enero-${MONTHS[lastMonth - 1]} de cada año, ` : ''}${Math.min(from, year)}-${year}, con todos los filtros. «Crecimiento» da la variación de cada año frente al anterior.`}
              source={SOURCE_ADUANA}
            >
              {series.length > 1 ? (
                <ViewToggle
                  label="Vista de la serie"
                  variationLabel="Crecimiento"
                  chart={
                    <MacroChart
                      data={series.map((point) => ({
                        period: String(point.year),
                        value: point.value,
                      }))}
                      unit={line.long}
                      tone="var(--series-1)"
                      label={measure === 'usd' ? 'Valor FOB' : 'Peso neto'}
                    />
                  }
                  variation={
                    <SeriesChart
                      data={seriesChange.map((point) => ({
                        date: `${point.year}-01-01`,
                        value: point.change,
                      }))}
                      kind="bar"
                      tone="var(--series-1)"
                      unit="%"
                      label="Variación frente al año anterior"
                      decimals={1}
                      zeroLine
                    />
                  }
                  table={
                    <div className="table-wrap">
                      <table className="grid-table">
                        <thead>
                          <tr>
                            <th>Año</th>
                            <th className="num">{line.long}</th>
                            <th className="num">Variación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...series].reverse().map((point) => {
                            const change = seriesChange.find((one) => one.year === point.year);
                            return (
                              <tr key={point.year}>
                                <td>{point.year}</td>
                                <td className="num">{smart(point.value)}</td>
                                <td className="num">{change ? signed(change.change) : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  }
                />
              ) : (
                <div className="callout">
                  {range.views
                    ? 'Para ver la serie hace falta un rango de al menos dos años con exportaciones.'
                    : 'Cargando la serie…'}
                </div>
              )}
            </Panel>

            <Panel
              id="recursos-serie-recurso"
              title={`Exportaciones por recurso y año (${line.long})`}
              lede={
                resources.size
                  ? 'Los recursos elegidos, uno por línea, con los filtros de país y departamento.'
                  : `Los ${shown.length} recursos con más valor en ${year}, uno por línea. Elegir recursos en los filtros cambia cuáles se dibujan.`
              }
              source={SOURCE_ADUANA}
            >
              {resourceLines.length > 1 ? (
                <ViewToggle
                  label="Vista de la serie por recurso"
                  variationLabel="Crecimiento"
                  chart={
                    <WorldLines
                      data={resourceLines}
                      series={lineSeries}
                      format={(value) => `${smart(value)} ${line.short}`}
                      tick={(value) => say(value, 0)}
                      countsOnly
                    />
                  }
                  variation={
                    <WorldLines
                      data={resourceChangeLines}
                      series={lineSeries}
                      format={(value) => signed(value)}
                      tick={(value) => `${say(value, 0)} %`}
                    />
                  }
                  table={
                    <div className="table-wrap">
                      <table className="grid-table">
                        <thead>
                          <tr>
                            <th>Año</th>
                            {shown.map((resource) => (
                              <th key={resource.id} className="num">
                                {resource.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...resourceLines].reverse().map((row) => (
                            <tr key={row.year}>
                              <td>{row.year}</td>
                              {shown.map((resource) => {
                                const value = row[resource.id];
                                return (
                                  <td key={resource.id} className="num">
                                    {typeof value === 'number' ? smart(value) : '—'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  }
                />
              ) : (
                <div className="callout">
                  {slots.some((slot) => slot.loading) || !nowViews
                    ? 'Cargando las series por recurso…'
                    : 'Para ver la serie hace falta un rango de al menos dos años con exportaciones.'}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * La página entera: cabecera, la parte aduanera con su carril de filtros y,
 * debajo, el capítulo de rentas y patrimonio natural que ya existía.
 */
export function ResourcesPage() {
  const { payload, failed } = useOnOpen<TradeCodes>(`${API}/catalogo`);
  return (
    <div className="stack">
      {/* Entrada de página, como las demás: la sección ya lleva su título y su informe. */}
      <header className="page-intro">
        <h3 className="page-intro-title">
          Lo que Bolivia saca de su suelo: a dónde va y cómo crece
        </h3>
        <p className="page-intro-lede">
          Lo que Bolivia saca de su suelo y vende afuera —minerales, gas, petróleo, litio y
          boratos—, a dónde va y cómo cambia de un año a otro. El mapa y los ránkings salen de la
          base aduanera del INE, con cada exportación por producto, país de destino y departamento
          de origen desde 1992. Debajo, la renta y el patrimonio natural que mide el Banco Mundial.
        </p>
      </header>
      {payload ? (
        payload.coverage.some((entry) => entry.grain === 'X_DETAIL') ? (
          <CustomsResources catalogue={payload} />
        ) : (
          <div className="callout">
            La base aduanera del INE aún no está disponible en este servidor; el resto de la página
            sí.
          </div>
        )
      ) : (
        <OnOpenNotice what="la base aduanera del INE" failed={failed} />
      )}
      <ResourcesSection embedded />
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { MacroChart } from './charts';
import { Icon } from './icons';
import { ANY, choiceOf, list, toggle, without } from '@/lib/choice';
import { titled } from '@/lib/trade-text';
import type { Choice } from '@/lib/choice';
import type { TradeCodes, TradeView } from '@/lib/trade-records';
import type { Dimension, FilterKey } from '@/lib/trade-records-query';
import { TradeRail } from './trade-records-rail';
import { useTradeViews } from './trade-records-fetch';
import { TradeWorld } from './trade-records-world';
import {
  DownloadViews,
  Headlines,
  RankingPanel,
  change,
  millions,
  say,
  weightName,
} from './trade-records-panels';

/**
 * «Detalle aduanero»: la base de comercio exterior del INE, filtrable.
 *
 * Todo lo que el lector elige —flujo, años, producto, país, departamento,
 * clasificación— recorta a la vez la serie, los tres ránkings y las cifras de
 * arriba. Tocar una barra la pone en el filtro (Ctrl/⌘ suma) y cada ránking se
 * sigue contando sin su propio filtro, para que la alternativa quede a la
 * vista. En producto, tocar un capítulo baja un nivel: capítulo → partida →
 * subpartida → NANDINA. El mapa del mundo de arriba pinta a qué países va (o de
 * cuáles viene) lo que quedó filtrado, y tocar un país abre su ficha.
 */

export type Filters = Record<FilterKey, Choice>;

/**
 * Los filtros que significan lo mismo en las dos direcciones del comercio: al
 * pasar de exportaciones a importaciones —con el mapa o con el carril— el país,
 * el departamento y el producto siguen elegidos. La actividad, el grupo
 * tradicional y el tipo de flujo son de las exportaciones; el uso económico, de
 * las importaciones: esos no tienen equivalente y se sueltan.
 */
const SHARED_FILTERS: readonly FilterKey[] = ['product', 'section', 'country', 'department'];

export const NO_FILTERS: Filters = {
  product: ANY,
  section: ANY,
  country: ANY,
  department: ANY,
  activity: ANY,
  traditional: ANY,
  use: ANY,
  kind: ANY,
};

const LEVELS: ReadonlyArray<{ by: Dimension; label: string }> = [
  { by: 'section', label: 'Sección' },
  { by: 'chapter', label: 'Capítulo' },
  { by: 'heading', label: 'Partida (4)' },
  { by: 'subheading', label: 'Subpartida (6)' },
  { by: 'nandina', label: 'NANDINA (10)' },
];

const CLASSES: Record<'X' | 'M', ReadonlyArray<{ by: Dimension; label: string }>> = {
  X: [
    { by: 'traditionalGroup', label: 'Tradicional / no tradicional' },
    { by: 'traditional', label: 'Grupo de producto' },
    { by: 'activityGroup', label: 'Sector' },
    { by: 'activity', label: 'Actividad' },
  ],
  M: [
    { by: 'useGroup', label: 'Gran categoría' },
    { by: 'use', label: 'Uso o destino económico' },
  ],
};

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

function Switch<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ by: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="chart-kind" role="group" style={{ flexWrap: 'wrap', marginBottom: '0.6rem' }}>
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

/** Mil millones o más sin decimales: en una cifra clave el decimal sólo ocupa sitio. */
const headline = (usd: number): string => (usd >= 1e9 ? say(usd / 1_000_000, 0) : millions(usd));

/** «26 · Minerales, escorias y cenizas» → «Minerales, escorias y cenizas», recortado. */
function shortName(label: string): string {
  const name = label.replace(/^\d+ · /u, '');
  return name.length > 34 ? `${name.slice(0, 33)}…` : name;
}

/** Los códigos que forman un grupo (zona, sector, clase) según el catálogo. */
function membersOf(codes: TradeCodes['codes'], dimension: string, group: string): string[] {
  return (codes[dimension] ?? [])
    .filter((entry) => entry.parent === group)
    .map((entry) => entry.code);
}

export function TradeRecordsExplorer({ catalogue }: { catalogue: TradeCodes }) {
  const coverage = (grain: string) => catalogue.coverage.find((entry) => entry.grain === grain);
  const [flow, setFlow] = useState<'X' | 'M'>('X');
  const span = flow === 'X' ? coverage('X_DETAIL') : coverage('M_DETAIL');
  const monthly = flow === 'X' ? coverage('X_DETAIL') : coverage('M_MONTHLY');
  const first = span?.first ?? 2010;
  const last = span?.last ?? 2025;
  const lastMonth = monthly?.lastMonth ?? 12;
  const lastFull = lastMonth < 12 ? last - 1 : last;

  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);
  const to = Math.min(Math.max(yearTo ?? lastFull, first), last);
  const from = Math.min(Math.max(yearFrom ?? to - 9, first), to);
  const [sameMonths, setSameMonths] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [names, setNames] = useState<Record<string, string>>({});
  const [level, setLevel] = useState<Dimension>('chapter');
  const [geo, setGeo] = useState<Dimension>('country');
  const [classBy, setClassBy] = useState<Dimension>('traditionalGroup');
  const [seriesBy, setSeriesBy] = useState<Dimension>('year');
  /** El último país tocado, para la ficha del mapa; sólo cuenta mientras siga en el filtro. */
  const [lastCountry, setLastCountry] = useState<string | null>(null);
  const [measure, setMeasure] = useState<'usd' | 'kg' | 'unit'>('usd');
  const shownClass = CLASSES[flow].some((option) => option.by === classBy)
    ? classBy
    : CLASSES[flow][0]!.by;

  const url = useMemo(() => {
    const params = new URLSearchParams({
      flow,
      from: String(from),
      to: String(to),
      views:
        `serie:${seriesBy},productos:${level}:30,geo:${geo}:${geo === 'country' ? 300 : 30},` +
        `deptos:department:12,clase:${shownClass}:25${geo === 'country' ? '' : ',mapa:country:300'}`,
    });
    if (sameMonths && lastMonth < 12) params.set('months', `1-${lastMonth}`);
    for (const [key, choice] of Object.entries(filters)) {
      if (choice.size) params.set(key, list(choice).join(','));
    }
    return `/api/comercio-exterior/aduana?${params.toString()}`;
  }, [flow, from, to, seriesBy, level, geo, shownClass, sameMonths, lastMonth, filters]);

  const { views, loading, failed } = useTradeViews(url);

  const pickInto = (key: FilterKey, values: readonly string[], add: boolean, label?: string) => {
    setFilters((current) => {
      let next = current[key];
      if (values.length === 1) next = toggle(next, values[0]!, add);
      else {
        const all = values.every((value) => next.has(value));
        next = all ? ANY : add ? new Set([...next, ...values]) : choiceOf(...values);
      }
      return { ...current, [key]: next };
    });
    if (label && values.length === 1)
      setNames((current) => ({ ...current, [`${key}:${values[0]}`]: label }));
  };

  const pickProduct = (code: string, add: boolean) => {
    const label = views?.productos?.items.find((item) => item.key === code)?.label;
    if (level === 'section') pickInto('section', [code], add, label);
    else pickInto('product', [code], add, label);
    const next = LEVELS.findIndex((entry) => entry.by === level) + 1;
    if (!add && next < LEVELS.length) setLevel(LEVELS[next]!.by);
  };
  const pickGeo = (code: string, add: boolean) => {
    if (geo === 'zone') pickInto('country', membersOf(catalogue.codes, 'COUNTRY', code), add);
    else pickCountry([code], add);
  };
  /** Del mapa, del ránking o del carril: un país tocado es el de la ficha. */
  const pickCountry = (codes: readonly string[], add: boolean, label?: string) => {
    pickInto('country', codes, add, label);
    if (codes.length) setLastCountry(codes[0]!);
  };
  const countryName = (code: string): string =>
    names[`country:${code}`] ??
    titled((catalogue.codes.COUNTRY ?? []).find((entry) => entry.code === code)?.name ?? code);
  const focus =
    lastCountry && filters.country.has(lastCountry)
      ? lastCountry
      : ([...filters.country].sort()[0] ?? null);
  /** Pasa de exportaciones a importaciones sin perder lo que significa lo mismo en las dos. */
  const changeFlow = (next: 'X' | 'M') => {
    if (next === flow) return;
    setFlow(next);
    setFilters((current) => ({
      ...NO_FILTERS,
      ...Object.fromEntries(SHARED_FILTERS.map((key) => [key, current[key]])),
    }));
    setLevel('chapter');
    setYearFrom(null);
    setYearTo(null);
  };
  const pickClass = (code: string, add: boolean) => {
    if (shownClass === 'activityGroup')
      pickInto('activity', membersOf(catalogue.codes, 'ACTIVITY', code), add);
    else if (shownClass === 'traditionalGroup')
      pickInto('traditional', membersOf(catalogue.codes, 'TRADITIONAL', code), add);
    else if (shownClass === 'activity') pickInto('activity', [code], add);
    else if (shownClass === 'traditional') pickInto('traditional', [code], add);
    else if (shownClass === 'useGroup') {
      const members = (catalogue.codes.USE ?? [])
        .map((entry) => entry.code)
        .filter((use) => use.startsWith(code));
      pickInto('use', members, add);
    } else pickInto('use', [code], add);
  };

  const verb = flow === 'X' ? 'Exportaciones' : 'Importaciones';
  const value = flow === 'X' ? 'FOB' : 'CIF frontera';
  const who = flow === 'X' ? 'destino' : 'origen';
  const period = sameMonths && lastMonth < 12 ? `enero-${MONTHS[lastMonth - 1]}` : null;
  const series = views?.serie;
  const byYear = new Map<number, { usd: number; kg: number }>();
  for (const item of series?.items ?? []) {
    const year = Number(item.key?.slice(0, 4));
    const entry = byYear.get(year) ?? { usd: 0, kg: 0 };
    entry.usd += item.usd;
    entry.kg += item.kg;
    byYear.set(year, entry);
  }
  const total = [...byYear.values()].reduce((sum, entry) => sum + entry.usd, 0);
  const current = byYear.get(to);
  const prior = byYear.get(to - 1);
  /** La vista por país trae todos; el ránking dibuja los treinta primeros. */
  const geoView = views?.geo ? { ...views.geo, items: views.geo.items.slice(0, 30) } : undefined;
  const mapView = geo === 'country' ? views?.geo : views?.mapa;
  const topGeo = geoView?.items[0];
  const geoTotal = (geoView?.items ?? []).reduce((sum, item) => sum + item.usd, 0);
  const topProduct = views?.productos?.items[0];
  const productTotal = (views?.productos?.items ?? []).reduce((sum, item) => sum + item.usd, 0);
  const growth = change(current?.usd ?? null, prior?.usd ?? null);
  const partialLast = to === last && lastMonth < 12 && !period;

  const seriesData = (series?.items ?? []).map((item) => ({
    period: item.key ?? '',
    value:
      measure === 'usd'
        ? item.usd / 1_000_000
        : measure === 'kg'
          ? item.kg / 1_000_000
          : item.kg > 0
            ? item.usd / item.kg
            : 0,
  }));
  const measureUnit =
    measure === 'usd' ? 'millones de USD' : measure === 'kg' ? 'miles de toneladas' : 'USD por kg';
  const context = `${verb} de Bolivia ${from}-${to}${period ? ` (${period})` : ''}, INE; filtros: ${
    Object.entries(filters)
      .filter(([, choice]) => choice.size)
      .map(([key, choice]) => `${key}=${list(choice).join('|')}`)
      .join('; ') || 'ninguno'
  }`;

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>
            Comercio exterior registro por registro: partida, país, departamento y mes (millones de
            USD)
          </h2>
          <p className="panel-sub">
            La base de datos que el INE arma con cada declaración de aduana: exportaciones desde{' '}
            {coverage('X_DETAIL')?.first ?? 1992} por partida NANDINA de diez dígitos, país de
            destino, departamento de origen y mes (valor FOB); importaciones desde{' '}
            {coverage('M_DETAIL')?.first ?? 2010} por partida y país de origen cada año, y por uso
            económico, capítulo y departamento cada mes (valor CIF en frontera). Los totales cuadran
            al centavo con los cuadros oficiales del INE; los años más recientes son preliminares y
            el INE los revisa. El mapa del mundo pinta a qué países va, o de cuáles viene, lo que
            los filtros dejan, y tocar un país abre su ficha con los productos y los
            departamentos.
          </p>
        </div>
        <div
          className="panel-head-kind"
          style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
        >
          <a className="jump-to-filters" href="#aduana-filtros">
            <Icon name="filtro" size={14} />
            Ir a los filtros
          </a>
          <DownloadViews
            views={views}
            names={{
              serie: 'Serie',
              productos: 'Productos',
              geo: 'Países',
              mapa: 'Países (todos)',
              deptos: 'Departamentos',
              clase: 'Clasificación',
            }}
            context={context}
          />
        </div>
      </div>

      <div className="workspace">
        <TradeRail
          catalogue={catalogue}
          flow={flow}
          onFlow={changeFlow}
          bounds={{ first, last, lastMonth }}
          from={from}
          to={to}
          onYears={(nextFrom, nextTo) => {
            setYearFrom(nextFrom);
            setYearTo(nextTo);
          }}
          sameMonths={sameMonths}
          onSameMonths={setSameMonths}
          filters={filters}
          names={names}
          onPick={(key, values, add, label) =>
            key === 'country' && values.length === 1
              ? pickCountry(values, add, label)
              : pickInto(key, values, add, label)
          }
          onRemove={(key, code) =>
            setFilters((current) => ({ ...current, [key]: without(current[key], code) }))
          }
          onClear={() => setFilters(NO_FILTERS)}
        />

        <div
          className="workspace-main"
          style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 120ms' }}
        >
          {failed ? (
            <div className="callout">
              No se pudo leer la base aduanera. El resto del informe sigue al día.
            </div>
          ) : null}
          {partialLast ? (
            <div className="callout">
              <strong>{to} está incompleto:</strong> el INE publicó hasta {MONTHS[lastMonth - 1]}.
              Para comparar con el año anterior sin esa trampa, marca «Mismo periodo de cada año» en
              los filtros.
            </div>
          ) : null}

          <Headlines
            items={[
              {
                label: `${verb} ${from}-${to}${period ? ` (${period})` : ''}`,
                value: `${headline(total)} M USD`,
                hint: `Valor ${value}, suma del periodo`,
              },
              {
                label: `${verb} ${to}`,
                value: current ? `${headline(current.usd)} M USD` : '—',
                hint:
                  growth === null
                    ? 'Sin año anterior para comparar'
                    : `${growth >= 0 ? '+' : ''}${say(growth, 1)} % frente a ${to - 1}`,
              },
              {
                label: `Toneladas ${to}`,
                value: current ? say(current.kg / 1000, 0) : '—',
                hint: weightName(flow),
              },
              {
                label: `USD por kg ${to}`,
                value: current && current.kg > 0 ? say(current.usd / current.kg, 2) : '—',
                hint: 'Valor unitario medio de lo filtrado',
              },
              {
                label: `Principal ${geo === 'zone' ? 'zona' : 'país'} de ${who}`,
                value: topGeo?.label ?? '—',
                hint:
                  topGeo && geoTotal
                    ? `${say((topGeo.usd / geoTotal) * 100, 1)} % de lo dibujado`
                    : '',
              },
              {
                label: 'Principal producto',
                value: topProduct ? shortName(topProduct.label) : '—',
                hint:
                  topProduct && productTotal
                    ? `${say((topProduct.usd / productTotal) * 100, 1)} % de lo dibujado`
                    : '',
              },
            ]}
          />

          <TradeWorld
            flow={flow}
            onFlow={changeFlow}
            view={mapView}
            from={from}
            to={to}
            period={period}
            country={filters.country}
            focus={focus}
            nameOf={countryName}
            onPick={(members, add, label) => pickCountry(members, add, label)}
          />

          <div className="panel">
            <div className="panel-head panel-head-kind">
              <div>
                <h2>
                  {verb} de Bolivia por {seriesBy === 'year' ? 'año' : 'mes'} ({measureUnit})
                </h2>
                <p className="panel-sub">
                  Con todos los filtros aplicados. El peso es {weightName(flow)}; el valor unitario
                  divide el valor entre el peso, así que sube por precio o por mezcla de productos.
                </p>
              </div>
            </div>
            <Switch
              options={[
                { by: 'year' as Dimension, label: 'Por año' },
                { by: 'month' as Dimension, label: 'Por mes' },
              ]}
              value={seriesBy}
              onChange={setSeriesBy}
            />
            <Switch
              options={[
                { by: 'usd' as const, label: 'Valor' },
                { by: 'kg' as const, label: 'Peso' },
                { by: 'unit' as const, label: 'USD por kg' },
              ]}
              value={measure}
              onChange={setMeasure}
            />
            {series?.unavailable ? (
              <div className="callout">{series.unavailable}</div>
            ) : seriesData.length > 1 ? (
              <MacroChart
                data={seriesData}
                unit={measureUnit}
                tone={flow === 'X' ? 'var(--official)' : 'var(--parallel)'}
                label={verb}
              />
            ) : (
              <div className="callout">Sin comercio declarado con estos filtros.</div>
            )}
          </div>

          <RankingPanel
            title={`Qué ${flow === 'X' ? 'exporta' : 'importa'} Bolivia, por ${LEVELS.find((entry) => entry.by === level)?.label.toLowerCase()} (millones de USD, ${from}-${to})`}
            sub="Toca una barra para filtrar por ella y bajar un nivel (capítulo → partida → subpartida → NANDINA); Ctrl/⌘ suma sin bajar. Los niveles de arriba que elegiste siguen aplicados."
            view={views?.productos}
            chosen={level === 'section' ? filters.section : filters.product}
            onPick={pickProduct}
            flow={flow}
            lastYear={to}
            controls={<Switch options={LEVELS} value={level} onChange={setLevel} />}
          />

          <div className="grid-pair">
            <RankingPanel
              title={`${flow === 'X' ? 'A quién le vende' : 'A quién le compra'} Bolivia (millones de USD, ${from}-${to})`}
              sub={`Por ${geo === 'zone' ? 'zona económica' : `país de ${who}`}, con todos los filtros menos el de país. Toca uno para filtrar.`}
              view={geoView}
              chosen={filters.country}
              onPick={pickGeo}
              flow={flow}
              lastYear={to}
              controls={
                <Switch
                  options={[
                    { by: 'country' as Dimension, label: 'País' },
                    { by: 'zone' as Dimension, label: 'Zona económica' },
                  ]}
                  value={geo}
                  onChange={setGeo}
                />
              }
            />
            <RankingPanel
              title={`${flow === 'X' ? 'De qué departamento sale' : 'A qué departamento entra'} (millones de USD, ${from}-${to})`}
              sub={
                flow === 'X'
                  ? 'Departamento de origen de la mercancía, con todos los filtros menos el de departamento.'
                  : 'Departamento de destino declarado. Las importaciones por departamento no llevan país: con un país elegido esta vista no tiene respuesta.'
              }
              view={views?.deptos}
              chosen={filters.department}
              onPick={(code, add) => pickInto('department', [code], add)}
              flow={flow}
              lastYear={to}
            />
          </div>

          <RankingPanel
            title={`${verb} por ${CLASSES[flow].find((entry) => entry.by === shownClass)?.label.toLowerCase()} (millones de USD, ${from}-${to})`}
            sub={
              flow === 'X'
                ? 'Las clasificaciones que el INE da a cada partida: tradicionales (minerales e hidrocarburos) frente a no tradicionales, y la actividad económica que la produce.'
                : 'La CUODE del INE: bienes de consumo, materias primas y bienes intermedios, bienes de capital y combustibles.'
            }
            view={views?.clase}
            chosen={
              shownClass === 'use' || shownClass === 'useGroup'
                ? filters.use
                : shownClass.startsWith('activity')
                  ? filters.activity
                  : filters.traditional
            }
            onPick={pickClass}
            flow={flow}
            lastYear={to}
            controls={<Switch options={CLASSES[flow]} value={shownClass} onChange={setClassBy} />}
          />
        </div>
      </div>
    </>
  );
}

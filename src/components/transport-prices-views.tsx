'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChartLegend, DatedLines, DivergingBars, ShareBars, seriesTone } from './charts';
import type { DatedLinePoint, DatedLineSeries } from './charts';
import { ChipPicker, SinDeclarar, TOP, TopNote, clip, uniqueNames } from './transport-views';
import { Panel } from '@/components/ui/panel';
import { ViewToggle } from '@/components/ui/view-toggle';
import type { Celda } from '@/lib/export/datos';
import type { VehicleOffer, comparableModelYears } from '@/lib/vehicle-price-analysis';

/**
 * Piezas de presentación de las tres páginas de precios de «Transporte» (vehículos 0 km,
 * carburantes y tarifas publicadas): los gráficos que antes eran tablas, cada uno con su
 * tabla a un clic. Los cálculos de los filtros siguen en `transport-prices-explorer.tsx`.
 */

export const format = (value: number) =>
  value.toLocaleString('es-BO', { maximumFractionDigits: 2 });

export const money = (value: number, currency: string) =>
  `${currency === 'USD' ? 'US$' : currency === 'BOB' ? 'Bs' : currency} ${format(value)}`;

/** «+12,5 %» o «−3 %»: el signo siempre dicho. */
export const signedPercent = (value: number) =>
  `${value >= 0 ? '+' : '−'}${format(Math.abs(value))} %`;

/** Los archivos completos que arma el servidor, con su procedencia (CSV y JSON). */
export const datasetDownloads = (dataset: 'vehiculos' | 'carburantes' | 'pasajes') =>
  [
    {
      etiqueta: 'Conjunto completo, con procedencia (CSV)',
      href: `/api/transporte/precios?conjunto=${dataset}&formato=csv`,
    },
    {
      etiqueta: 'Conjunto completo, con procedencia (JSON)',
      href: `/api/transporte/precios?conjunto=${dataset}`,
    },
  ] as const;

/** El mismo vacío para todas las figuras. */
const Empty = ({ children }: { children: ReactNode }) => <div className="callout">{children}</div>;

/** Los elementos de `rows` agrupados por `key`, en el orden en que aparecen. */
function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
}

/** Las opciones de `rows` por `field`, la de más filas primero (con ella arranca el gráfico). */
function mostFrequent<T>(rows: readonly T[], field: (row: T) => string): string[] {
  return [...groupBy(rows, field)]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'es'))
    .map(([id]) => id);
}

/** Un selector de una fila que se esconde cuando solo hay una opción. */
function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  onChange: (next: string) => void;
}) {
  if (options.length < 2) return null;
  return <ChipPicker label={label} value={value} options={options} onChange={onChange} />;
}

/** La opción elegida si sigue disponible; si no (cambió un filtro), la primera. */
const validChoice = (chosen: string, options: readonly string[]): string =>
  options.includes(chosen) ? chosen : (options[0] ?? '');

/* -------------------------------------------------------------------------- */
/* Carburantes                                                                */
/* -------------------------------------------------------------------------- */

export interface FuelObservation {
  date: string;
  product: string;
  unit: string;
  price: number;
  market: string;
  kind: string;
}

const UNIT_NAME: Record<string, string> = {
  'Bs/l': 'Litro',
  'Bs/kg': 'Kilo',
  'Bs/m³': 'Metro cúbico',
};

export interface UnitPick {
  unit: string;
  units: ReadonlyArray<{ id: string; label: string }>;
  setUnit: (unit: string) => void;
}

/**
 * La unidad que se dibuja. Litros, kilos y metros cúbicos no se mezclan en un eje: arranca por la
 * unidad con más variedades en la selección y, si un filtro la deja sin datos, pasa a la primera.
 */
export function useFuelUnit(rows: readonly FuelObservation[]): UnitPick {
  const [chosen, setChosen] = useState('');
  const varieties = new Map<string, Set<string>>();
  for (const row of rows)
    varieties.set(row.unit, (varieties.get(row.unit) ?? new Set()).add(row.product));
  const ids = [...varieties.keys()].sort(
    (a, b) =>
      (varieties.get(b)?.size ?? 0) - (varieties.get(a)?.size ?? 0) || a.localeCompare(b, 'es'),
  );
  return {
    unit: validChoice(chosen, ids),
    units: ids.map((id) => ({
      id,
      label: `${UNIT_NAME[id] ?? id} (${varieties.get(id)?.size ?? 0})`,
    })),
    setUnit: setChosen,
  };
}

const UnitChips = ({ pick }: { pick: UnitPick }) => (
  <Picker label="Unidad" value={pick.unit} options={pick.units} onChange={pick.setUnit} />
);

/** «Último precio por variedad»: barras horizontales, con la tabla a un clic. */
export function FuelLatestFigure({
  latest,
  pick,
  table,
}: {
  latest: readonly FuelObservation[];
  pick: UnitPick;
  table: ReactNode;
}) {
  const inUnit = latest.filter((row) => row.unit === pick.unit);
  const ranked = [...inUnit].sort((a, b) => b.price - a.price).slice(0, TOP);
  const names = uniqueNames(
    ranked.map((row) => ({ name: row.product, qualifier: row.market })),
    34,
  );
  return (
    <ViewToggle
      chart={
        <>
          <UnitChips pick={pick} />
          <SinDeclarar>
            <ShareBars
              data={ranked.map((row, index) => ({
                name: names[index] ?? row.product,
                value: row.price,
                note: `Corte del ${row.date} · ${row.kind} · ${row.market}`,
              }))}
              unit={pick.unit}
              decimals={2}
              tone={seriesTone(0)}
              height={Math.max(190, ranked.length * 34 + 16)}
            />
          </SinDeclarar>
          <ChartLegend
            items={[
              {
                color: seriesTone(0),
                label: `Último precio publicado de cada variedad (${pick.unit})`,
              },
            ]}
          />
          <TopNote shown={ranked.length} total={inUnit.length} noun="variedades" />
          <p className="panel-note">
            Cada variedad toma su propia fecha más reciente (se dice al pasar el cursor): los
            productos no necesariamente comparten corte.
          </p>
        </>
      }
      table={table}
    />
  );
}

/** Hasta cuántas variedades dibuja la serie: la paleta de series tiene seis casillas. */
const LINES = 6;

/** Una línea por variedad, con las de corte más reciente primero; los cortes de cada una, sin rellenar. */
function fuelLines(rows: readonly FuelObservation[], unit: string) {
  const inUnit = rows.filter((row) => row.unit === unit);
  const ranked = [...groupBy(inUnit, (row) => row.product)]
    .map(([product, observed]) => ({
      product,
      last: observed.reduce((late, row) => (row.date > late ? row.date : late), ''),
      count: observed.length,
    }))
    .sort(
      (a, b) =>
        b.last.localeCompare(a.last) ||
        b.count - a.count ||
        a.product.localeCompare(b.product, 'es'),
    );
  const kept = ranked.slice(0, LINES);
  const keys = new Map(kept.map((one, index) => [one.product, `v${index}`]));
  const byDate = new Map<string, DatedLinePoint>();
  for (const row of inUnit) {
    const key = keys.get(row.product);
    if (!key) continue;
    const point: DatedLinePoint = byDate.get(row.date) ?? { date: row.date };
    point[key] = row.price;
    byDate.set(row.date, point);
  }
  const series: DatedLineSeries[] = kept.map((one, index) => ({
    key: `v${index}`,
    label: one.product,
    tone: seriesTone(index),
  }));
  return {
    data: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    series,
    total: ranked.length,
  };
}

/** Primer y último corte de cada variedad de la unidad, con el cambio entre ellos. */
function fuelChanges(rows: readonly FuelObservation[], unit: string) {
  return [
    ...groupBy(
      rows.filter((row) => row.unit === unit),
      (row) => row.product,
    ).values(),
  ].flatMap((observed) => {
    const sorted = [...observed].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last || first.date === last.date || first.price <= 0) return [];
    return [{ first, last, change: (last.price / first.price - 1) * 100 }];
  });
}

/**
 * «Serie histórica»: líneas en el tiempo, la variación entre el primer y el último corte, y la
 * tabla paginada. Los cortes son los publicados; entre ellos no se estima nada.
 */
export function FuelHistoryFigure({
  rows,
  pick,
  table,
}: {
  rows: readonly FuelObservation[];
  pick: UnitPick;
  table: ReactNode;
}) {
  const lines = fuelLines(rows, pick.unit);
  const changes = fuelChanges(rows, pick.unit);
  const biggest = [...changes]
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, TOP);
  const names = uniqueNames(
    biggest.map(({ last }) => ({ name: last.product, qualifier: last.market })),
    34,
  );
  return (
    <ViewToggle
      chart={
        <>
          <UnitChips pick={pick} />
          {lines.series.length ? (
            <SinDeclarar>
              <DatedLines
                data={lines.data}
                series={lines.series}
                unit={pick.unit}
                decimals={2}
                yearTicks
              />
            </SinDeclarar>
          ) : (
            <Empty>No hay cortes publicados en esta unidad.</Empty>
          )}
          {lines.total > lines.series.length ? (
            <p className="panel-note">
              Se dibujan {lines.series.length} de {lines.total} variedades, las de corte más
              reciente; fija «Variedad» en el carril para ver otras. La tabla trae todas.
            </p>
          ) : null}
          <p className="panel-note">
            Cada punto es un corte publicado por ANH; la línea los une, pero no estima precios entre
            cortes. Hasta 2024 los cortes son de cierre anual y desde 2025 son más frecuentes, y el
            eje los reparte a igual distancia. Donde una variedad no tiene corte, la línea se corta.
          </p>
        </>
      }
      variation={
        <>
          <UnitChips pick={pick} />
          {biggest.length ? (
            <SinDeclarar>
              <DivergingBars
                signed
                unit="%"
                data={biggest.map(({ first, last, change }, index) => ({
                  name: names[index] ?? last.product,
                  value: change,
                  meta: `${format(first.price)} ${pick.unit} (${first.date}) → ${format(last.price)} ${pick.unit} (${last.date})`,
                }))}
                height={Math.max(190, biggest.length * 34 + 56)}
              />
            </SinDeclarar>
          ) : (
            <Empty>Ninguna variedad tiene dos cortes distintos en esta selección.</Empty>
          )}
          <TopNote shown={biggest.length} total={changes.length} noun="variedades con dos cortes" />
          <p className="panel-note">
            Cambio entre el primer y el último corte de cada variedad en la selección. Cada una
            parte de su propio primer corte, así que las que nacieron después cuentan menos
            historia; un cambio no dice cuándo comenzó a regir el precio.
          </p>
        </>
      }
      table={table}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Tarifas publicadas                                                         */
/* -------------------------------------------------------------------------- */

export interface FareObservation {
  mode: string;
  origin: string;
  destination: string;
  service: string;
  maximum: number;
  dua: number;
  period: string;
}

/** Una ruta y su dirección, sin el código de aeropuerto: «La Paz → Oruro». */
const leg = (row: FareObservation) =>
  `${row.origin.replace(/ \([A-Z]{3,4}\)$/, '')} → ${row.destination.replace(/ \([A-Z]{3,4}\)$/, '')}`;

/** El máximo de la tarifa; en aéreo incluye el DUA (cero en los demás medios). */
const fareTotal = (row: FareObservation) => row.maximum + row.dua;

/** «Cambio del máximo en la misma ruta y clase»: barras con signo, con la tabla a un clic. */
export function FareChangesFigure<T extends FareObservation>({
  comparisons,
  routeName,
  table,
}: {
  comparisons: ReadonlyArray<{ before: T; after: T }>;
  routeName: (row: T) => string;
  table: ReactNode;
}) {
  const changes = comparisons.flatMap(({ before, after }) =>
    fareTotal(before) > 0
      ? [{ before, after, change: (fareTotal(after) / fareTotal(before) - 1) * 100 }]
      : [],
  );
  const biggest = [...changes]
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, TOP);
  const names = uniqueNames(
    biggest.map(({ before }) => ({
      name: `${routeName(before)} · ${before.service}`,
      qualifier: before.mode,
    })),
    36,
  );
  return (
    <ViewToggle
      chart={
        <>
          <SinDeclarar>
            <DivergingBars
              signed
              unit="%"
              data={biggest.map(({ before, after, change }, index) => ({
                name: names[index] ?? routeName(before),
                value: change,
                meta: `${before.mode} · ${before.period}: Bs ${format(fareTotal(before))} → ${after.period}: Bs ${format(fareTotal(after))}`,
              }))}
              height={Math.max(190, biggest.length * 34 + 56)}
            />
          </SinDeclarar>
          <TopNote shown={biggest.length} total={changes.length} noun="rutas y clases" />
          <p className="panel-note">
            Entre el primer y el último tarifario disponible para cada ruta y clase; en aéreo
            incluye el DUA en ambos años. Los montos en Bs van en el detalle al pasar el cursor.
          </p>
        </>
      }
      table={table}
    />
  );
}

const MODE_LEGEND = (mode: string) =>
  mode === 'Aéreo' ? 'Tarifa máxima más DUA' : 'Tarifa máxima o referencia regulatoria';

/**
 * «Tarifa máxima por ruta»: las rutas más caras del medio y la clase elegidos, en el tarifario más
 * reciente de la selección. La tabla trae todas las rutas del medio y la clase; el detalle de 11
 * columnas, con resolución y vigencia, queda en su propio panel.
 */
export function FareTopPanel({ rows }: { rows: readonly FareObservation[] }) {
  const [modeChoice, setMode] = useState('');
  const [serviceChoice, setService] = useState('');
  const modes = mostFrequent(rows, (row) => row.mode);
  const mode = validChoice(modeChoice, modes);
  const inMode = rows.filter((row) => row.mode === mode);
  const services = mostFrequent(inMode, (row) => row.service);
  const service = validChoice(serviceChoice, services);
  const inService = inMode.filter((row) => row.service === service);
  const period = inService.reduce((late, row) => (row.period > late ? row.period : late), '');
  const ranked = inService
    .filter((row) => row.period === period)
    .sort((a, b) => fareTotal(b) - fareTotal(a) || leg(a).localeCompare(leg(b), 'es'));
  const bars = ranked.slice(0, TOP);
  const names = uniqueNames(
    bars.map((row) => ({ name: leg(row), qualifier: row.period })),
    34,
  );
  const unitLabel = mode === 'Aéreo' ? 'Bs, con DUA' : 'Bs';
  return (
    <Panel
      id="pasajes-maximo-por-ruta"
      className="transp"
      title="Tarifa máxima por ruta (Bs por pasajero)"
      lede="Las rutas más caras del medio y la clase elegidos, en el tarifario más reciente de la selección."
      source="Autoridad de Regulación y Fiscalización de Telecomunicaciones y Transportes (ATT)"
      data={{
        unidad: 'Bs por pasajero',
        columnas: [
          'Origen',
          'Destino',
          'Medio',
          'Clase',
          'Año del tarifario',
          'Máximo (Bs)',
          'DUA (Bs)',
          'Total (Bs)',
        ],
        filas: ranked.map((row): Celda[] => [
          row.origin,
          row.destination,
          row.mode,
          row.service,
          row.period,
          row.maximum,
          row.dua || null,
          fareTotal(row),
        ]),
        nota: 'El DUA solo existe en el medio aéreo; el total es el máximo más el DUA.',
      }}
    >
      <ViewToggle
        chart={
          <>
            <Picker
              label="Medio"
              value={mode}
              options={modes.map((id) => ({ id, label: id }))}
              onChange={setMode}
            />
            <Picker
              label="Clase"
              value={service}
              options={services.map((id) => ({ id, label: id }))}
              onChange={setService}
            />
            <SinDeclarar>
              <ShareBars
                data={bars.map((row, index) => ({
                  name: names[index] ?? leg(row),
                  value: fareTotal(row),
                  note: `${row.mode} · ${row.service} · tarifario ${row.period}`,
                }))}
                unit={unitLabel}
                decimals={0}
                tone={seriesTone(0)}
                height={Math.max(190, bars.length * 34 + 16)}
              />
            </SinDeclarar>
            <ChartLegend
              items={[
                {
                  color: seriesTone(0),
                  label: `${MODE_LEGEND(mode)}, ${service.toLowerCase()}, tarifario ${period} (Bs por pasajero)`,
                },
              ]}
            />
            <TopNote shown={bars.length} total={ranked.length} noun="rutas" />
          </>
        }
        table={
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th>Año</th>
                  <th className="num">Máximo</th>
                  <th className="num">DUA</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row, index) => (
                  <tr key={`${row.origin}-${row.destination}-${index}`}>
                    <td>{row.origin}</td>
                    <td>{row.destination}</td>
                    <td>{row.period}</td>
                    <td className="num">{format(row.maximum)}</td>
                    <td className="num">{row.dua ? format(row.dua) : '—'}</td>
                    <td className="num">{format(fareTotal(row))}</td>
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

/* -------------------------------------------------------------------------- */
/* Vehículos 0 km                                                             */
/* -------------------------------------------------------------------------- */

export type YearGap = ReturnType<typeof comparableModelYears>[number];

/** «Cobertura por tipo»: versiones con precio por tipo de carrocería, con la tabla a un clic. */
export function VehicleCoverageFigure({
  coverage,
  table,
}: {
  coverage: ReadonlyArray<{ type: string; brands: number; models: number; versions: number }>;
  table: ReactNode;
}) {
  const bars = [...coverage].sort((a, b) => b.versions - a.versions).slice(0, TOP);
  return (
    <ViewToggle
      chart={
        <>
          <SinDeclarar>
            <ShareBars
              data={bars.map((row) => ({
                name: row.type,
                value: row.versions,
                note: `${row.brands} marcas · ${row.models} modelos`,
              }))}
              unit="versiones"
              decimals={0}
              tone={seriesTone(0)}
              height={Math.max(190, bars.length * 34 + 16)}
            />
          </SinDeclarar>
          <ChartLegend
            items={[
              {
                color: seriesTone(0),
                label: 'Versiones con precio por tipo de carrocería (versiones)',
              },
            ]}
          />
          <TopNote shown={bars.length} total={coverage.length} noun="tipos" />
        </>
      }
      table={table}
    />
  );
}

/** «Diferencia entre años modelo»: barras con signo en %, con los montos al pasar el cursor. */
export function VehicleYearGapFigure({
  comparisons,
  table,
}: {
  comparisons: readonly YearGap[];
  table: ReactNode;
}) {
  const gaps = comparisons.flatMap((one) =>
    one.before.price > 0 ? [{ ...one, percent: (one.difference / one.before.price) * 100 }] : [],
  );
  const biggest = [...gaps].sort((a, b) => Math.abs(b.percent) - Math.abs(a.percent)).slice(0, TOP);
  const names = uniqueNames(
    biggest.map(({ before, after }) => ({
      // Los años van al final y completos: el rótulo recorta la versión, no el par de años.
      name: `${clip(`${before.brand} ${before.model} ${before.version}`, 26)} ’${String(before.modelYear).slice(-2)}→’${String(after.modelYear).slice(-2)}`,
      qualifier: `${before.currency} ${before.observedAt}`,
    })),
    60,
  );
  return (
    <ViewToggle
      chart={
        <>
          <SinDeclarar>
            <DivergingBars
              signed
              unit="%"
              data={biggest.map(({ before, after, difference, percent }, index) => ({
                name: names[index] ?? `${before.brand} ${before.model}`,
                value: percent,
                meta: `${before.modelYear}: ${money(before.price, before.currency)} → ${after.modelYear}: ${money(after.price, after.currency)} (${difference >= 0 ? '+' : '−'}${money(Math.abs(difference), before.currency)})`,
              }))}
              height={Math.max(190, biggest.length * 34 + 56)}
            />
          </SinDeclarar>
          <TopNote shown={biggest.length} total={gaps.length} noun="comparaciones" />
          <p className="panel-note">
            Las monedas se mezclan en la selección, por eso el gráfico usa el % de diferencia; los
            montos de cada año van al pasar el cursor y en la tabla.
          </p>
        </>
      }
      table={table}
    />
  );
}

/** Mediana por marca y moneda: la cifra del gráfico y de su tabla. */
export function brandPrices(rows: readonly VehicleOffer[]) {
  return [...groupBy(rows, (row) => `${row.brand}|${row.currency}`).values()]
    .map((offers) => {
      const prices = offers.map((row) => row.price).sort((a, b) => a - b);
      const middle = Math.floor(prices.length / 2);
      const median =
        prices.length % 2
          ? (prices[middle] ?? 0)
          : ((prices[middle - 1] ?? 0) + (prices[middle] ?? 0)) / 2;
      return {
        brand: offers[0]?.brand ?? '',
        currency: offers[0]?.currency ?? '',
        offers: offers.length,
        median,
        min: prices[0] ?? 0,
        max: prices[prices.length - 1] ?? 0,
      };
    })
    .sort((a, b) => a.brand.localeCompare(b.brand, 'es') || a.currency.localeCompare(b.currency));
}

/**
 * «Precio anunciado por marca»: la mediana de las versiones con precio de cada marca, en la
 * moneda elegida (sin selector si el conjunto trae una sola). La tabla trae todas las marcas
 * y monedas.
 */
export function VehicleBrandPricePanel({ rows }: { rows: readonly VehicleOffer[] }) {
  const [chosen, setChosen] = useState('');
  const table = brandPrices(rows);
  const currency = validChoice(
    chosen,
    mostFrequent(rows, (row) => row.currency),
  );
  const bars = table
    .filter((row) => row.currency === currency)
    .sort((a, b) => b.median - a.median)
    .slice(0, TOP);
  const unit = currency === 'USD' ? 'US$' : currency === 'BOB' ? 'Bs' : currency;
  return (
    <Panel
      id="vehiculos-precio-por-marca"
      className="transp"
      title="Precio anunciado por marca (mediana, en la moneda elegida)"
      lede="La mediana de las versiones con precio de cada marca en la selección. Es el precio anunciado, no el de venta."
      source="Representantes de marca en Bolivia"
      data={{
        unidad: 'precio anunciado por vehículo, en la moneda de cada fila',
        columnas: ['Marca', 'Moneda', 'Versiones con precio', 'Mediana', 'Mínimo', 'Máximo'],
        filas: table.map((row): Celda[] => [
          row.brand,
          row.currency,
          row.offers,
          row.median,
          row.min,
          row.max,
        ]),
        nota: 'Una fila por marca y moneda: los montos de monedas distintas no se suman ni se comparan.',
      }}
    >
      <ViewToggle
        chart={
          <>
            <Picker
              label="Moneda"
              value={currency}
              options={mostFrequent(rows, (row) => row.currency).map((id) => ({
                id,
                label: id === 'USD' ? 'US$' : id === 'BOB' ? 'Bs' : id,
              }))}
              onChange={setChosen}
            />
            <SinDeclarar>
              <ShareBars
                data={bars.map((row) => ({
                  name: row.brand,
                  value: row.median,
                  note: `${row.offers} versiones con precio · de ${money(row.min, row.currency)} a ${money(row.max, row.currency)}`,
                }))}
                unit={unit}
                decimals={0}
                tone={seriesTone(0)}
                height={Math.max(190, bars.length * 34 + 16)}
              />
            </SinDeclarar>
            <ChartLegend
              items={[
                {
                  color: seriesTone(0),
                  label: `Mediana del precio anunciado por marca (${unit} por vehículo)`,
                },
              ]}
            />
            <TopNote
              shown={bars.length}
              total={table.filter((row) => row.currency === currency).length}
              noun="marcas"
            />
          </>
        }
        table={
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Marca</th>
                  <th>Moneda</th>
                  <th className="num">Versiones con precio</th>
                  <th className="num">Mediana</th>
                  <th className="num">Mínimo</th>
                  <th className="num">Máximo</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row) => (
                  <tr key={`${row.brand}-${row.currency}`}>
                    <td>{row.brand}</td>
                    <td>{row.currency}</td>
                    <td className="num">{row.offers}</td>
                    <td className="num">{money(row.median, row.currency)}</td>
                    <td className="num">{money(row.min, row.currency)}</td>
                    <td className="num">{money(row.max, row.currency)}</td>
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

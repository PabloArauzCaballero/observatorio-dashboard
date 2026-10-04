'use client';

import { useState } from 'react';
import { ANY, accepts, additive, picked, toggle } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import { Panel } from '@/components/ui/panel';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import { Pager } from './pager';
import { OnOpenNotice, useOnOpen } from './on-open';
import {
  FareChangesFigure,
  FareTopPanel,
  FuelHistoryFigure,
  FuelLatestFigure,
  VehicleBrandPricePanel,
  VehicleCoverageFigure,
  VehicleYearGapFigure,
  datasetDownloads,
  format,
  money,
  signedPercent,
  useFuelUnit,
} from './transport-prices-views';
import fuelsJson from '@/data/fuel-prices.json';
import faresJson from '@/data/passenger-fares.json';
import {
  comparableModelYears,
  priceRangeCurrency,
  vehicleCoverage,
} from '@/lib/vehicle-price-analysis';
import type { VehicleOffer } from '@/lib/vehicle-price-analysis';

type Vehicle = VehicleOffer & { source: string; transmission: string; traction: string; dealer?: string | null; conditions?: string; availability?: string };
type Fuel = (typeof fuelsJson)[number];
type Fare = (typeof faresJson)[number];
type Field<T> = (row: T) => string;

const SOURCE_VEHICLES = 'Representantes de marca en Bolivia';
const SOURCE_FUELS = 'Agencia Nacional de Hidrocarburos (ANH)';
const SOURCE_FARES =
  'Autoridad de Regulación y Fiscalización de Telecomunicaciones y Transportes (ATT)';

function RailGroup<T>({
  title,
  rows,
  field,
  selected,
  onChange,
}: {
  title: string;
  rows: T[];
  field: Field<T>;
  selected: Choice;
  onChange: (choice: Choice) => void;
}) {
  const options = [...new Set(rows.map(field))].sort((a, b) => a.localeCompare(b, 'es'));
  return (
    <div className="rail-sec">
      <div className="rail-head">
        <Icon name="capas" size={13} />
        {title}
        <PickedCount choice={selected} />
      </div>
      <div className="rail-list">
        <button
          type="button"
          className={selected.size ? 'rail-item' : 'rail-item rail-item-on'}
          aria-pressed={!selected.size}
          onClick={() => onChange(ANY)}
        >
          <span className="rail-name">Todos</span>
          <span className="rail-n">{rows.length}</span>
        </button>
        {options.map((option) => {
          const on = picked(selected, option);
          return (
            <button
              key={option}
              type="button"
              className={on ? 'rail-item rail-item-on' : 'rail-item'}
              aria-pressed={on}
              onClick={(event) => onChange(toggle(selected, option, additive(event)))}
            >
              <span className="rail-name">{option}</span>
              <span className="rail-n">{rows.filter((row) => field(row) === option).length}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterRail({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <aside className="rail">
      <div className="rail-top">
        <Icon name="filtro" size={15} />
        <span className="rail-title">Filtros</span>
        <span className="rail-count">
          {count ? `${count} ${count === 1 ? 'activo' : 'activos'}` : 'sin filtro'}
        </span>
      </div>
      <FilterHint>Las opciones se ajustan a las otras dimensiones elegidas.</FilterHint>
      {children}
    </aside>
  );
}

/** Las tres cifras que abren cada página, dentro de su panel de cabecera. */
function StatStrip({
  stats,
}: {
  stats: ReadonlyArray<{ label: string; value: string | number; hint?: string }>;
}) {
  return (
    <div className="stat-strip">
      {stats.map((stat) => (
        <div className="stat" key={stat.label}>
          <span className="stat-label">{stat.label}</span>
          <span className="stat-value">{stat.value}</span>
          {stat.hint ? <span className="stat-hint">{stat.hint}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function VehiclePricesExplorer() {
  const { payload, failed } = useOnOpen<{
    rows: Vehicle[];
    observedAt: string;
    catalogOrigin: 'core' | 'snapshot';
  }>('/api/transporte/precios?conjunto=vehiculos');
  if (!payload) return <OnOpenNotice what="los precios de vehículos" failed={failed} />;
  return (
    <VehiclePriceBoard
      rows={payload.rows}
      observedAt={payload.observedAt}
      catalogOrigin={payload.catalogOrigin}
    />
  );
}

function VehiclePriceBoard({
  rows,
  observedAt,
  catalogOrigin,
}: {
  rows: Vehicle[];
  observedAt: string;
  catalogOrigin: 'core' | 'snapshot';
}) {
  const [type, setType] = useState<Choice>(ANY);
  const [brand, setBrand] = useState<Choice>(ANY);
  const [model, setModel] = useState<Choice>(ANY);
  const [version, setVersion] = useState<Choice>(ANY);
  const [year, setYear] = useState<Choice>(ANY);
  const [currency, setCurrency] = useState<Choice>(ANY);
  const [transmission, setTransmission] = useState<Choice>(ANY);
  const [traction, setTraction] = useState<Choice>(ANY);
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const currencies = new Set(rows.map((row) => row.currency));
  const rangeCurrency = priceRangeCurrency(rows, currency);
  const chooseCurrency = (next: Choice) => {
    setCurrency(next);
    if (currencies.size > 1 && next.size !== 1) {
      setPriceFrom('');
      setPriceTo('');
    }
  };
  const match = (row: Vehicle, except = '') =>
    (except === 'type' || accepts(type, row.type)) &&
    (except === 'brand' || accepts(brand, row.brand)) &&
    (except === 'model' || accepts(model, row.model)) &&
    (except === 'version' || accepts(version, row.version)) &&
    (except === 'year' || accepts(year, String(row.modelYear))) &&
    (except === 'currency' || accepts(currency, row.currency)) &&
    (except === 'transmission' || accepts(transmission, row.transmission)) &&
    (except === 'traction' || accepts(traction, row.traction)) &&
    (except === 'currency' ||
      !rangeCurrency ||
      ((!priceFrom || row.price >= Number(priceFrom)) &&
        (!priceTo || row.price <= Number(priceTo))));
  const selected = rows.filter((row) => match(row));
  const models = new Set(selected.map((row) => `${row.brand} ${row.model}`)).size;
  const coverage = vehicleCoverage(selected);
  const comparisons = comparableModelYears(selected);
  const detail = [...selected].sort(
    (a, b) =>
      a.brand.localeCompare(b.brand, 'es') ||
      a.model.localeCompare(b.model, 'es') ||
      a.version.localeCompare(b.version, 'es') ||
      a.modelYear - b.modelYear,
  );
  const stats = [
    { label: 'Versiones con precio', value: selected.length, hint: 'Ofertas de la selección' },
    { label: 'Modelos observados', value: models, hint: 'Marca y modelo distintos' },
    {
      label: 'Tipos con ofertas',
      value: coverage.length,
      hint: 'Sólo carrocerías con precio verificable',
    },
  ];
  return (
    <>
      <Panel
        id="vehiculos-resumen"
        className="transp"
        title="Precios de vehículos 0 km por versión (US$ y Bs por vehículo)"
        lede="Precios anunciados por representantes de marca en Bolivia; la disponibilidad se confirma con el vendedor."
        source={SOURCE_VEHICLES}
        {...(observedAt ? { updated: observedAt } : {})}
        extraDownloads={datasetDownloads('vehiculos')}
        data={{
          columnas: ['Indicador', 'Valor'],
          filas: stats.map((stat) => [stat.label, stat.value]),
          nota: 'Cifras de la selección vigente en los filtros.',
        }}
      >
        <StatStrip stats={stats} />
        <p className="panel-note">Ofertas observadas, sin cuota de mercado. La investigación ampliada de redes, conflictos y equivalencia por país está en las páginas Competencia automotriz y Precios internacionales. Impuestos finales, vigencia y disponibilidad requieren confirmación.</p>
        <details className="panel-note">
          <summary>Cómo leer estos precios</summary>
          <p>
            Última captura del conjunto: {observedAt || 'sin datos'}. Elegí tipo, marca, modelo,
            versión, año modelo, moneda y rango de precio; transmisión y tracción se muestran cuando
            constan en la versión. Los montos son anuncios y la disponibilidad se confirma con el
            vendedor.
            {catalogOrigin === 'snapshot'
              ? ' Esta vista usa la captura archivada mientras se habilita el catálogo del núcleo.'
              : ''}
          </p>
        </details>
      </Panel>
      <div className="workspace">
        <FilterRail
          count={
            [type, brand, model, version, year, currency, transmission, traction].filter(
              (choice) => choice.size,
            ).length + Number(Boolean(rangeCurrency && (priceFrom || priceTo)))
          }
        >
          <RailGroup
            title="Tipo"
            rows={rows.filter((row) => match(row, 'type'))}
            field={(row) => row.type}
            selected={type}
            onChange={setType}
          />
          <RailGroup
            title="Marca"
            rows={rows.filter((row) => match(row, 'brand'))}
            field={(row) => row.brand}
            selected={brand}
            onChange={setBrand}
          />
          <RailGroup
            title="Modelo"
            rows={rows.filter((row) => match(row, 'model'))}
            field={(row) => row.model}
            selected={model}
            onChange={setModel}
          />
          <RailGroup
            title="Versión"
            rows={rows.filter((row) => match(row, 'version'))}
            field={(row) => row.version}
            selected={version}
            onChange={setVersion}
          />
          <RailGroup
            title="Año modelo"
            rows={rows.filter((row) => match(row, 'year'))}
            field={(row) => String(row.modelYear)}
            selected={year}
            onChange={setYear}
          />
          <RailGroup
            title="Moneda"
            rows={rows.filter((row) => match(row, 'currency'))}
            field={(row) => row.currency}
            selected={currency}
            onChange={chooseCurrency}
          />
          <RailGroup
            title="Transmisión declarada"
            rows={rows.filter((row) => match(row, 'transmission'))}
            field={(row) => row.transmission}
            selected={transmission}
            onChange={setTransmission}
          />
          <RailGroup
            title="Tracción declarada"
            rows={rows.filter((row) => match(row, 'traction'))}
            field={(row) => row.traction}
            selected={traction}
            onChange={setTraction}
          />
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="monedas" size={13} />
              Precio anunciado {rangeCurrency ? `(${rangeCurrency})` : ''}
            </div>
            {!rangeCurrency ? (
              <FilterHint>Elegí una moneda para fijar un rango de precio.</FilterHint>
            ) : null}
            <div className="transport-price-range">
              <label>
                Desde
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={priceFrom}
                  disabled={!rangeCurrency}
                  onChange={(event) => setPriceFrom(event.target.value)}
                  aria-label={`Precio mínimo en ${rangeCurrency ?? 'la moneda seleccionada'}`}
                />
              </label>
              <label>
                Hasta
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={priceTo}
                  disabled={!rangeCurrency}
                  onChange={(event) => setPriceTo(event.target.value)}
                  aria-label={`Precio máximo en ${rangeCurrency ?? 'la moneda seleccionada'}`}
                />
              </label>
            </div>
          </div>
        </FilterRail>
        <div className="workspace-main">
          <Panel
            id="vehiculos-cobertura"
            className="transp"
            title="Cobertura por tipo de carrocería (versiones con precio)"
            lede="Recuento de ofertas verificadas en esta selección. La presencia de una marca o tipo no mide sus ventas ni su cuota de mercado."
            source={SOURCE_VEHICLES}
            data={{
              columnas: ['Tipo de carrocería', 'Marcas', 'Modelos', 'Versiones con precio'],
              filas: coverage.map((row) => [row.type, row.brands, row.models, row.versions]),
            }}
          >
            {coverage.length ? (
              <VehicleCoverageFigure
                coverage={coverage}
                table={
                  <div className="table-wrap">
                    <table className="grid-table">
                      <thead>
                        <tr>
                          <th>Tipo de carrocería</th>
                          <th className="num">Marcas</th>
                          <th className="num">Modelos</th>
                          <th className="num">Versiones con precio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coverage.map((row) => (
                          <tr key={row.type}>
                            <td>{row.type}</td>
                            <td className="num">{row.brands}</td>
                            <td className="num">{row.models}</td>
                            <td className="num">{row.versions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                }
              />
            ) : (
              <div className="callout">No hay ofertas para esta selección.</div>
            )}
          </Panel>
          {comparisons.length ? (
            <Panel
              id="vehiculos-diferencia-anios"
              className="transp"
              title="Diferencia entre años modelo de la misma versión (% de diferencia)"
              lede="Ofertas observadas el mismo día y en la misma moneda. No mide inflación ni un cambio de precio en el tiempo; el equipamiento puede variar."
              source={SOURCE_VEHICLES}
              data={{
                columnas: [
                  'Marca y modelo',
                  'Versión',
                  'Año anterior',
                  'Precio año anterior',
                  'Año posterior',
                  'Precio año posterior',
                  'Moneda',
                  'Diferencia',
                  'Diferencia (%)',
                ],
                filas: comparisons.map(({ before, after, difference }) => [
                  `${before.brand} ${before.model}`,
                  before.version,
                  before.modelYear,
                  before.price,
                  after.modelYear,
                  after.price,
                  before.currency,
                  difference,
                  before.price > 0 ? (difference / before.price) * 100 : null,
                ]),
              }}
            >
              <VehicleYearGapFigure
                comparisons={comparisons}
                table={
                  <div className="table-wrap">
                    <table className="grid-table">
                      <thead>
                        <tr>
                          <th>Marca y modelo</th>
                          <th>Versión</th>
                          <th className="num">Año anterior</th>
                          <th className="num">Año posterior</th>
                          <th className="num">Diferencia</th>
                          <th className="num">Diferencia (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisons.map(({ before, after, difference }) => (
                          <tr
                            key={`${before.brand}-${before.model}-${before.version}-${before.modelYear}-${after.modelYear}-${before.currency}`}
                          >
                            <td>
                              {before.brand} {before.model}
                            </td>
                            <td>{before.version}</td>
                            <td className="num">
                              {before.modelYear}: {money(before.price, before.currency)}
                            </td>
                            <td className="num">
                              {after.modelYear}: {money(after.price, after.currency)}
                            </td>
                            <td className="num">
                              {difference >= 0 ? '+' : '−'}
                              {money(Math.abs(difference), before.currency)}
                            </td>
                            <td className="num">
                              {before.price > 0
                                ? signedPercent((difference / before.price) * 100)
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                }
              />
            </Panel>
          ) : null}
          {selected.length ? <VehicleBrandPricePanel rows={selected} /> : null}
          <Panel
            id="vehiculos-detalle"
            className="transp"
            title="Detalle por versión (precio anunciado, US$ o Bs)"
            lede="La tabla conserva versiones y años por separado; un precio menor no implica un vehículo comparable."
            source={SOURCE_VEHICLES}
            extraDownloads={datasetDownloads('vehiculos')}
            data={{
              columnas: [
                'Tipo',
                'Marca',
                'Modelo',
                'Versión',
                'Año modelo',
                'Transmisión',
                'Tracción',
                'Precio anunciado',
                'Moneda',
                'Clase',
                'Observado',
                'Oferta',
                'Vendedor',
                'Condiciones',
              ],
              filas: detail.map((row) => [
                row.type,
                row.brand,
                row.model,
                row.version,
                row.modelYear,
                row.transmission,
                row.traction,
                row.price,
                row.currency,
                row.priceType,
                row.observedAt,
                row.source,
                row.dealer ?? 'No identificado',
                row.conditions ?? 'No informadas',
              ]),
            }}
          >
            {selected.length ? (
              <div className="table-wrap">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Marca</th>
                      <th>Modelo</th>
                      <th>Versión</th>
                      <th>Año modelo</th>
                      <th>Transmisión</th>
                      <th>Tracción</th>
                      <th className="num">Precio anunciado</th>
                      <th>Clase</th>
                      <th>Observado</th>
                      <th>Oferta</th>
                      <th>Vendedor / condiciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map((row, index) => (
                      <tr
                        key={`${row.brand}-${row.model}-${row.version}-${row.modelYear}-${index}`}
                      >
                        <td>{row.type}</td>
                        <td>{row.brand}</td>
                        <td>{row.model}</td>
                        <td>{row.version}</td>
                        <td>{row.modelYear}</td>
                        <td>{row.transmission}</td>
                        <td>{row.traction}</td>
                        <td className="num">{money(row.price, row.currency)}</td>
                        <td>{row.priceType}</td>
                        <td>{row.observedAt}</td>
                        <td>
                          <a href={row.source} target="_blank" rel="noreferrer">
                            Ver anuncio
                          </a>
                        </td>
                        <td>{row.dealer ?? 'No identificado'}<br />{row.conditions ?? 'No informadas'}<br />Stock: {row.availability ?? 'No verificada'}.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="callout">
                No hay versiones con precio publicado para esta combinación de filtros.
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

export function FuelPricesExplorer() {
  const rows = fuelsJson as Fuel[];
  const [market, setMarket] = useState<Choice>(ANY);
  const [product, setProduct] = useState<Choice>(ANY);
  const [unit, setUnit] = useState<Choice>(ANY);
  const [year, setYear] = useState<Choice>(ANY);
  const [offset, setOffset] = useState(0);
  const match = (row: Fuel, except = '') =>
    (except === 'market' || accepts(market, row.market)) &&
    (except === 'product' || accepts(product, row.product)) &&
    (except === 'unit' || accepts(unit, row.unit)) &&
    (except === 'year' || accepts(year, row.date.slice(0, 4)));
  const selected = rows.filter((row) => match(row));
  const latest = [...selected].sort((a, b) => b.date.localeCompare(a.date));
  const byProduct = [...new Map(latest.map((row) => [row.product, row])).values()].sort((a, b) =>
    a.product.localeCompare(b.product, 'es'),
  );
  const unitPick = useFuelUnit(selected);
  const pageSize = 30;
  const safeOffset = Math.min(
    offset,
    Math.max(0, Math.ceil(latest.length / pageSize) - 1) * pageSize,
  );
  const page = Math.floor(safeOffset / pageSize) + 1;
  const pages = Math.max(1, Math.ceil(latest.length / pageSize));
  const historyPager = (where: string) => (
    <Pager
      page={page}
      pages={pages}
      first={safeOffset + 1}
      last={Math.min(safeOffset + pageSize, latest.length)}
      total={latest.length}
      pageSize={pageSize}
      onGo={setOffset}
      where={where}
      noun="observaciones"
    />
  );
  const stats = [
    { label: 'Variedades observadas', value: byProduct.length },
    { label: 'Observaciones', value: selected.length },
    { label: 'Último corte en la selección', value: latest[0]?.date ?? '—' },
  ];
  return (
    <>
      <Panel
        id="carburantes-resumen"
        className="transp"
        title="Carburantes: precios publicados por ANH (Bs por litro, kilo o m³)"
        lede="Precios de mercado interno y precios internacionales publicados por ANH, de 2010 a agosto de 2026."
        source={SOURCE_FUELS}
        extraDownloads={datasetDownloads('carburantes')}
        data={{
          columnas: ['Indicador', 'Valor'],
          filas: stats.map((stat) => [stat.label, stat.value]),
          nota: 'Cifras de la selección vigente en los filtros.',
        }}
      >
        <StatStrip stats={stats} />
        <details className="panel-note">
          <summary>Cómo leer estos precios</summary>
          <p>
            Los regímenes se filtran por separado. Los años anteriores a 2025 son cortes de cierre
            anual; una fecha de corte no demuestra cuándo comenzó a regir el precio. Litros, kilos y
            metros cúbicos se mantienen separados.
          </p>
        </details>
      </Panel>
      <div className="workspace">
        <FilterRail count={[market, product, unit, year].filter((choice) => choice.size).length}>
          <RailGroup
            title="Régimen"
            rows={rows.filter((row) => match(row, 'market'))}
            field={(row) => row.market}
            selected={market}
            onChange={setMarket}
          />
          <RailGroup
            title="Variedad"
            rows={rows.filter((row) => match(row, 'product'))}
            field={(row) => row.product}
            selected={product}
            onChange={setProduct}
          />
          <RailGroup
            title="Unidad"
            rows={rows.filter((row) => match(row, 'unit'))}
            field={(row) => row.unit}
            selected={unit}
            onChange={setUnit}
          />
          <RailGroup
            title="Año del corte"
            rows={rows.filter((row) => match(row, 'year'))}
            field={(row) => row.date.slice(0, 4)}
            selected={year}
            onChange={setYear}
          />
        </FilterRail>
        <div className="workspace-main">
          <Panel
            id="carburantes-ultimo-precio"
            className="transp"
            title="Último precio por variedad (Bs por litro, kilo o m³)"
            lede="Cada variedad toma su propia fecha más reciente; los productos no necesariamente comparten corte."
            source={SOURCE_FUELS}
            data={{
              unidad: 'Bs por unidad de cada fila',
              columnas: [
                'Variedad',
                'Fecha de corte',
                'Precio',
                'Unidad',
                'Tipo de corte',
                'Régimen',
              ],
              filas: byProduct.map((row) => [
                row.product,
                row.date,
                row.price,
                row.unit,
                row.kind,
                row.market,
              ]),
            }}
          >
            {byProduct.length ? (
              <FuelLatestFigure
                latest={byProduct}
                pick={unitPick}
                table={
                  <div className="table-wrap">
                    <table className="grid-table">
                      <thead>
                        <tr>
                          <th>Variedad</th>
                          <th>Fecha de corte</th>
                          <th className="num">Precio</th>
                          <th>Unidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byProduct.map((row) => (
                          <tr key={row.product}>
                            <td>{row.product}</td>
                            <td>{row.date}</td>
                            <td className="num">{format(row.price)}</td>
                            <td>{row.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                }
              />
            ) : (
              <div className="callout">No hay observaciones para esta selección.</div>
            )}
          </Panel>
          <Panel
            id="carburantes-serie"
            className="transp"
            title="Serie histórica por corte publicado (Bs por litro, kilo o m³)"
            lede="Se muestran los cortes originales. No se estiman precios para los intervalos entre cortes."
            source={SOURCE_FUELS}
            extraDownloads={datasetDownloads('carburantes')}
            data={{
              unidad: 'Bs por unidad de cada fila',
              columnas: ['Fecha', 'Variedad', 'Precio', 'Unidad', 'Tipo de corte', 'Régimen'],
              filas: latest.map((row) => [
                row.date,
                row.product,
                row.price,
                row.unit,
                row.kind,
                row.market,
              ]),
            }}
          >
            {latest.length ? (
              <FuelHistoryFigure
                rows={selected}
                pick={unitPick}
                table={
                  <>
                    {historyPager('arriba')}
                    <div className="table-wrap">
                      <table className="grid-table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Variedad</th>
                            <th className="num">Precio</th>
                            <th>Unidad</th>
                            <th>Tipo de corte</th>
                          </tr>
                        </thead>
                        <tbody>
                          {latest.slice(safeOffset, safeOffset + pageSize).map((row, index) => (
                            <tr key={`${row.date}-${row.product}-${index}`}>
                              <td>{row.date}</td>
                              <td>{row.product}</td>
                              <td className="num">{format(row.price)}</td>
                              <td>{row.unit}</td>
                              <td>{row.kind}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {historyPager('abajo')}
                  </>
                }
              />
            ) : (
              <div className="callout">No hay observaciones para esta selección.</div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

export function PassengerFaresExplorer() {
  const rows = faresJson as Fare[];
  const routeName = (row: Fare) =>
    [row.origin.replace(/ \([A-Z]{3,4}\)$/, ''), row.destination.replace(/ \([A-Z]{3,4}\)$/, '')]
      .sort((a, b) => a.localeCompare(b, 'es'))
      .join(' – ');
  const [period, setPeriod] = useState<Choice>(ANY);
  const [mode, setMode] = useState<Choice>(ANY);
  const [route, setRoute] = useState<Choice>(ANY);
  const [origin, setOrigin] = useState<Choice>(ANY);
  const [destination, setDestination] = useState<Choice>(ANY);
  const [service, setService] = useState<Choice>(ANY);
  const [offset, setOffset] = useState(0);
  const match = (row: Fare, except = '') =>
    (except === 'period' || accepts(period, row.period)) &&
    (except === 'mode' || accepts(mode, row.mode)) &&
    (except === 'route' || accepts(route, routeName(row))) &&
    (except === 'origin' || accepts(origin, row.origin)) &&
    (except === 'destination' || accepts(destination, row.destination)) &&
    (except === 'service' || accepts(service, row.service));
  const selected = rows.filter((row) => match(row));
  const ordered = [...selected].sort(
    (a, b) => b.period.localeCompare(a.period) || a.origin.localeCompare(b.origin, 'es'),
  );
  const pairs = new Map<string, Fare[]>();
  for (const row of selected) {
    const key = [row.mode, routeName(row), row.service].join('|');
    pairs.set(key, [...(pairs.get(key) ?? []), row]);
  }
  const comparisons = [...pairs.values()]
    .filter((group) => new Set(group.map((row) => row.period)).size > 1)
    .map((group) => {
      const sorted = [...group].sort((a, b) => a.period.localeCompare(b.period));
      return { before: sorted[0]!, after: sorted[sorted.length - 1]! };
    });
  const pageSize = 30;
  const safeOffset = Math.min(
    offset,
    Math.max(0, Math.ceil(ordered.length / pageSize) - 1) * pageSize,
  );
  const page = Math.floor(safeOffset / pageSize) + 1;
  const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const farePager = (where: string) => (
    <Pager
      page={page}
      pages={pages}
      first={safeOffset + 1}
      last={Math.min(safeOffset + pageSize, ordered.length)}
      total={ordered.length}
      pageSize={pageSize}
      onGo={setOffset}
      where={where}
      noun="tarifas"
    />
  );
  const stats = [
    { label: 'Registros de tarifa', value: selected.length },
    { label: 'Medios en la selección', value: new Set(selected.map((row) => row.mode)).size },
    { label: 'Unidad', value: 'Bs', hint: 'Por pasajero y trayecto publicado' },
  ];
  return (
    <>
      <Panel
        id="pasajes-resumen"
        className="transp"
        title="Pasajes: tarifas de referencia por ruta (Bs por pasajero)"
        lede="Máximos y referencias regulatorias publicados por ATT; no son pagos observados."
        source={SOURCE_FARES}
        extraDownloads={datasetDownloads('pasajes')}
        data={{
          columnas: ['Indicador', 'Valor'],
          filas: stats.map((stat) => [stat.label, stat.value]),
          nota: 'Cifras de la selección vigente en los filtros.',
        }}
      >
        <StatStrip stats={stats} />
        <details className="panel-note">
          <summary>Cómo leer estas tarifas</summary>
          <p>
            Historia publicada por ATT: máximos terrestres de 2016, tarifas aéreas de 2025, y
            cuadros terrestre, aéreo y ferroviario de 2025–2026. Son límites o referencias
            regulatorias, no pagos observados. El plazo formal de varios cuadros de 2026 ya
            concluyó; se muestran como antecedentes tarifarios.
          </p>
        </details>
      </Panel>
      <div className="workspace">
        <FilterRail
          count={
            [period, mode, route, origin, destination, service].filter((choice) => choice.size)
              .length
          }
        >
          <RailGroup
            title="Año del tarifario"
            rows={rows.filter((row) => match(row, 'period'))}
            field={(row) => row.period}
            selected={period}
            onChange={setPeriod}
          />
          <RailGroup
            title="Medio"
            rows={rows.filter((row) => match(row, 'mode'))}
            field={(row) => row.mode}
            selected={mode}
            onChange={setMode}
          />
          <RailGroup
            title="Ruta"
            rows={rows.filter((row) => match(row, 'route'))}
            field={routeName}
            selected={route}
            onChange={setRoute}
          />
          <RailGroup
            title="Origen"
            rows={rows.filter((row) => match(row, 'origin'))}
            field={(row) => row.origin}
            selected={origin}
            onChange={setOrigin}
          />
          <RailGroup
            title="Destino"
            rows={rows.filter((row) => match(row, 'destination'))}
            field={(row) => row.destination}
            selected={destination}
            onChange={setDestination}
          />
          <RailGroup
            title="Clase o servicio"
            rows={rows.filter((row) => match(row, 'service'))}
            field={(row) => row.service}
            selected={service}
            onChange={setService}
          />
        </FilterRail>
        <div className="workspace-main">
          {comparisons.length ? (
            <Panel
              id="pasajes-cambio-maximo"
              className="transp"
              title="Cambio del máximo en la misma ruta y clase (% de cambio)"
              lede="Comparación entre el primer y el último tarifario disponible para cada ruta y clase. No mide el precio efectivamente pagado."
              source={SOURCE_FARES}
              data={{
                columnas: [
                  'Medio',
                  'Ruta',
                  'Clase',
                  'Año antes',
                  'Antes (Bs)',
                  'Año después',
                  'Después (Bs)',
                  'Cambio (%)',
                ],
                filas: comparisons.map(({ before, after }) => {
                  const oldValue = before.maximum + before.dua;
                  const newValue = after.maximum + after.dua;
                  return [
                    before.mode,
                    routeName(before),
                    before.service,
                    before.period,
                    oldValue,
                    after.period,
                    newValue,
                    oldValue > 0 ? (newValue / oldValue - 1) * 100 : null,
                  ];
                }),
                nota: 'En aéreo incluye el DUA en ambos años; en terrestre compara el máximo.',
              }}
            >
              <FareChangesFigure
                comparisons={comparisons}
                routeName={routeName}
                table={
                  <div className="table-wrap">
                    <table className="grid-table">
                      <thead>
                        <tr>
                          <th>Medio</th>
                          <th>Ruta</th>
                          <th>Clase</th>
                          <th className="num">Antes</th>
                          <th className="num">Después</th>
                          <th className="num">Cambio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisons.map(({ before, after }) => {
                          const oldValue = before.maximum + before.dua;
                          const newValue = after.maximum + after.dua;
                          return (
                            <tr key={`${before.mode}-${routeName(before)}-${before.service}`}>
                              <td>{before.mode}</td>
                              <td>{routeName(before)}</td>
                              <td>{before.service}</td>
                              <td className="num">
                                {before.period}: Bs {format(oldValue)}
                              </td>
                              <td className="num">
                                {after.period}: Bs {format(newValue)}
                              </td>
                              <td className="num">{`${newValue >= oldValue ? '+' : ''}${format((newValue / oldValue - 1) * 100)} %`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                }
              />
            </Panel>
          ) : null}
          {selected.length ? <FareTopPanel rows={selected} /> : null}
          <Panel
            id="pasajes-detalle"
            className="transp"
            title="Detalle tarifario (Bs por pasajero)"
            lede="La banda terrestre de 2026 incluye mínimo y máximo; el folleto de 2016 publica sólo máximos. En aéreo se distingue la tarifa del DUA y su suma."
            source={SOURCE_FARES}
            extraDownloads={datasetDownloads('pasajes')}
            data={{
              unidad: 'Bs por pasajero',
              columnas: [
                'Año',
                'Medio',
                'Origen',
                'Destino',
                'Clase',
                'Mínimo',
                'Máximo / TMR',
                'DUA',
                'Total aéreo',
                'Vigencia documentada',
                'Resolución',
              ],
              filas: ordered.map((row) => [
                row.period,
                row.mode,
                row.origin,
                row.destination,
                row.service,
                row.minimum,
                row.maximum,
                row.dua || null,
                row.mode === 'Aéreo' ? row.maximum + row.dua : null,
                row.validity,
                row.reference,
              ]),
            }}
          >
            {selected.length ? (
              <>
                {farePager('arriba')}
                <div className="table-wrap">
                  <table className="grid-table">
                    <thead>
                      <tr>
                        <th>Año</th>
                        <th>Medio</th>
                        <th>Origen</th>
                        <th>Destino</th>
                        <th>Clase</th>
                        <th className="num">Mínimo</th>
                        <th className="num">Máximo / TMR</th>
                        <th className="num">DUA</th>
                        <th className="num">Total aéreo</th>
                        <th>Vigencia documentada</th>
                        <th>Resolución</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordered.slice(safeOffset, safeOffset + pageSize).map((row, index) => (
                        <tr
                          key={`${row.mode}-${row.origin}-${row.destination}-${row.service}-${row.period}-${index}`}
                        >
                          <td>{row.period}</td>
                          <td>{row.mode}</td>
                          <td>{row.origin}</td>
                          <td>{row.destination}</td>
                          <td>{row.service}</td>
                          <td className="num">
                            {row.minimum === null ? '—' : format(row.minimum)}
                          </td>
                          <td className="num">{format(row.maximum)}</td>
                          <td className="num">{row.dua ? format(row.dua) : '—'}</td>
                          <td className="num">
                            {row.mode === 'Aéreo' ? format(row.maximum + row.dua) : '—'}
                          </td>
                          <td>{row.validity}</td>
                          <td>{row.reference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {farePager('abajo')}
              </>
            ) : (
              <div className="callout">No hay rutas para esta selección.</div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

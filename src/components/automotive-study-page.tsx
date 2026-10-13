'use client';

import { useState, type ReactNode } from 'react';
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AXIS,
  BAR_CAP,
  ChartLegend,
  MOTION,
  MacroChart,
  TooltipShell,
  framed,
  seriesTone,
  type TooltipRender,
} from './charts';
import { Panel } from './ui/panel';
import { celda, useDatosDeFigura } from './ui/panel-data';
import { ViewToggle } from './ui/view-toggle';
import { Evidence, StudyBars, StudyLoader, num, price, studyDownloads } from './automotive-shared';
import {
  fleetSignals,
  inventoryScenario,
  offerStatus,
  ownershipCost,
  type AutomotiveStudy,
  type InventoryInputs,
} from '@/lib/automotive-analysis';

/**
 * El estudio automotor en una sola página: parque, importaciones, competencia, precios
 * en el exterior y escenarios. Antes eran cuatro páginas de texto; aquí cada idea es una
 * figura y el texto largo queda plegado al final, a un clic.
 */
export function AutomotiveStudyPage() {
  return <StudyLoader>{(study) => <Study study={study} />}</StudyLoader>;
}

function Study({ study }: { study: AutomotiveStudy }) {
  return (
    <>
      <p className="panel-note">
        <strong>Corte {study.observedAt}.</strong> Anuncios y registros oficiales de períodos
        distintos: no miden stock, precio final ni ventas.{' '}
        <a href="/api/transporte/estudio">Descargar evidencia y condiciones</a>.
      </p>
      <h3 className="automotive-band">Parque y comercio exterior</h3>
      <Fleet study={study} />
      <Trade study={study} />
      <h3 className="automotive-band">Competencia en Bolivia</h3>
      <Competition study={study} />
      <h3 className="automotive-band">El mismo modelo en otros mercados</h3>
      <Abroad study={study} />
      <h3 className="automotive-band">Escenarios de costo</h3>
      <Scenarios />
      <h3 className="automotive-band">Para leer con calma</h3>
      <Reading study={study} />
    </>
  );
}

const Chips = ({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
  onPick: (id: string) => void;
}) => (
  <div className="chart-kind" role="group" aria-label={label}>
    {options.map(([id, text]) => (
      <button
        key={id}
        className={value === id ? 'chip chip-on' : 'chip'}
        aria-pressed={value === id}
        onClick={() => onPick(id)}
      >
        {text}
      </button>
    ))}
  </div>
);

const Table = ({ head, children }: { head: string[]; children: ReactNode }) => (
  <div className="table-wrap">
    <table className="table">
      <thead>
        <tr>
          {head.map((text) => (
            <th key={text}>{text}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

/* ───────────────────────────── Parque ───────────────────────────── */

function Fleet({ study }: { study: AutomotiveStudy }) {
  const signals = fleetSignals(study);
  const [dimension, setDimension] = useState('departments');
  const rows =
    dimension === 'classes'
      ? study.fleet.classes
      : dimension === 'ages'
        ? study.fleet.ages
        : study.fleet.departments;
  const dimensionName =
    dimension === 'classes' ? 'clase' : dimension === 'ages' ? 'año modelo' : 'departamento';
  return (
    <>
      <div className="automotive-kpis">
        <article>
          <small>Parque registrado · 2025</small>
          <strong>{num(signals.total)}</strong>
          <span>+{num(signals.growth, 2)}% anual, con motos.</span>
        </article>
        <article>
          <small>Sin motocicletas</small>
          <strong>{num(signals.nonMotorcycle)}</strong>
          <span>+{num(signals.nonMotorcycleGrowth, 2)}% anual.</span>
        </article>
        <article>
          <small>Motos en el aumento neto</small>
          <strong>{num(signals.motorcycleContribution, 1)}%</strong>
          <span>De {num(signals.increase)} registros nuevos.</span>
        </article>
        <article>
          <small>Modelos hasta 2015</small>
          <strong>{num((signals.through2015 / signals.total) * 100, 1)}%</strong>
          <span>Señal para posventa, no ventas.</span>
        </article>
      </div>
      <div className="grid-pair">
        <Panel
          id="automotor-parque-serie"
          title="Parque registrado de Bolivia, 2003–2025 (vehículos)"
          source="INE, boletín Parque Automotor 2025; fuente primaria RUAT"
          updated="Cierre 2025"
        >
          <ViewToggle
            chart={
              <MacroChart
                data={study.fleet.annual.map((row) => ({
                  year: row.year,
                  period: String(row.year),
                  value: row.value,
                }))}
                unit="vehículos"
                tone="var(--official)"
                label="Parque registrado por año"
              />
            }
            table={
              <Table head={['Año', 'Vehículos registrados', 'Variación anual']}>
                {study.fleet.annual.map((row, i, all) => (
                  <tr key={row.year}>
                    <td>{row.year}</td>
                    <td>{num(row.value)}</td>
                    <td>{i ? `${num((row.value / all[i - 1]!.value - 1) * 100, 2)}%` : '—'}</td>
                  </tr>
                ))}
              </Table>
            }
          />
        </Panel>
        <Panel
          id="automotor-parque-composicion"
          title={`Parque registrado 2025 por ${dimensionName} (vehículos)`}
          source="INE/RUAT, cuadros 2, 3 y 4 del boletín 2025"
          updated="Cierre 2025"
        >
          <Chips
            label="Composición del parque"
            options={[
              ['departments', 'Departamento'],
              ['classes', 'Clase'],
              ['ages', 'Año modelo'],
            ]}
            value={dimension}
            onPick={setDimension}
          />
          <ViewToggle
            chart={
              <StudyBars
                data={rows.map((row) => ({ name: row.name, value: row.value }))}
                unit="vehículos"
                legend={`Vehículos registrados 2025, por ${dimensionName}`}
                height={Math.max(280, rows.length * 32)}
              />
            }
            table={
              <Table head={['Grupo', 'Registros 2025', '% del total', '2024']}>
                {rows.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{num(row.value)}</td>
                    <td>{num((row.value / signals.total) * 100, 2)}%</td>
                    <td>{'prior' in row ? num(row.prior as number) : 'Ver fuente'}</td>
                  </tr>
                ))}
              </Table>
            }
          />
        </Panel>
      </div>
    </>
  );
}

/* ─────────────────────────── Importaciones ─────────────────────────── */

const HEADINGS = [
  ['8702', 'Buses · 8702'],
  ['8703', 'Pasajeros · 8703'],
  ['8704', 'Carga · 8704'],
] as const;

function Trade({ study }: { study: AutomotiveStudy }) {
  const [heading, setHeading] = useState('8703');
  const full = study.trade.annual.filter(
    (row) => row.heading === heading && row.months.length === 12,
  );
  const latest = full.at(-1);
  const prior = full.at(-2);
  const partial = study.trade.annual.find(
    (row) => row.heading === heading && row.months.length < 12,
  );
  const passengers = study.trade.annual
    .filter((row) => row.heading === '8703' && row.months.length === 12)
    .at(-1);
  const origins = study.trade.origins;
  const topShare = passengers
    ? (origins.slice(0, 3).reduce((sum, row) => sum + row.usd, 0) / passengers.usd) * 100
    : 0;
  return (
    <div className="grid-pair">
      <Panel
        id="automotor-importaciones"
        title={`Importaciones anuales, partida ${heading} (millones USD CIF)`}
        lede="8702: 10 o más personas · 8703: personas · 8704: mercancías. Sin motos ni repuestos."
        {...(latest && prior
          ? {
              meta: `${latest.year}: USD ${num(latest.usd / 1e6, 1)} M (${num((latest.usd / prior.usd - 1) * 100, 1)}%)`,
            }
          : {})}
        source="Base aduanera INE del núcleo, grano M_DETAIL; valores anuales por NANDINA y país"
      >
        <Chips label="Partida arancelaria" options={HEADINGS} value={heading} onPick={setHeading} />
        <ViewToggle
          chart={
            <MacroChart
              data={full.map((row) => ({
                year: row.year,
                period: `${row.year}${row.provisional ? ' (p)' : ''}`,
                value: row.usd / 1e6,
              }))}
              unit="millones USD CIF"
              tone="var(--official)"
              label={`Importaciones, partida ${heading}`}
            />
          }
          table={
            <Table head={['Año', 'USD CIF', 'kg', 'Estado']}>
              {full.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td>{num(row.usd)}</td>
                  <td>{num(row.kg)}</td>
                  <td>{row.provisional ? 'Provisional' : 'Sin marca provisional'}</td>
                </tr>
              ))}
            </Table>
          }
        />
        {partial && (
          <p className="panel-note">
            Año parcial {partial.year} (meses {partial.months[0]}–{partial.months.at(-1)}): USD{' '}
            {num(partial.usd / 1e6, 1)} M, provisional; no se anualiza.
          </p>
        )}
      </Panel>
      <Panel
        id="automotor-importaciones-origen"
        title="Origen de las importaciones de pasajeros (8703), 2025 (millones USD CIF)"
        lede={`China, Japón e India concentran ${num(topShare, 1)}% del valor. País de origen no es nacionalidad de la marca.`}
        source="Base aduanera INE del núcleo; ocho principales orígenes, provisional"
      >
        <ViewToggle
          chart={
            <StudyBars
              data={origins.map((row) => ({ name: row.name, value: row.usd / 1e6 }))}
              unit="millones USD CIF"
              decimals={1}
              legend="Principales países de origen, 2025 (p)"
              height={320}
            />
          }
          table={
            <Table head={['Origen', 'USD CIF', '% de 8703']}>
              {origins.map((row) => (
                <tr key={row.code}>
                  <td>{row.name}</td>
                  <td>{num(row.usd)}</td>
                  <td>{passengers ? `${num((row.usd / passengers.usd) * 100, 2)}%` : '—'}</td>
                </tr>
              ))}
            </Table>
          }
        />
      </Panel>
    </div>
  );
}

/* ───────────────────────────── Competencia ───────────────────────────── */

function Competition({ study }: { study: AutomotiveStudy }) {
  const [brand, setBrand] = useState('Todas');
  const [rail, setRail] = useState('brands');
  const domestic = study.offers.filter((row) => row.country === 'Bolivia');
  const brands = ['Todas', ...new Set(domestic.map((row) => row.brand))];
  const rows = domestic.filter((row) => brand === 'Todas' || row.brand === brand);
  const quoted = rows.filter(
    (row) =>
      row.currency === 'USD' && !row.status.startsWith('Conflicto') && row.modelYear !== null,
  );
  // Sin marca elegida se dibuja el piso de gama de cada una; con una, sus versiones.
  const floors = [
    ...quoted
      .reduce((map, row) => {
        const low = map.get(row.brand);
        return map.set(row.brand, low === undefined ? row.price : Math.min(low, row.price));
      }, new Map<string, number>())
      .entries(),
  ].map(([name, value]) => ({ name, value }));
  const bars =
    brand === 'Todas'
      ? floors
      : quoted.map((row) => ({
          name: `${row.model} ${row.version} ${row.modelYear}`,
          value: row.price,
          note: row.conditions,
        }));
  const missing = brands.slice(1).filter((name) => !floors.some((floor) => floor.name === name));
  const dealerRows = study.dealers.map((dealer) => ({
    name: dealer.name,
    value: rail === 'brands' ? dealer.brands.length : dealer.cities.length,
  }));
  return (
    <div className="grid-pair">
      <Panel
        id="automotor-oferta-nacional"
        title={
          brand === 'Todas'
            ? 'Precio de entrada anunciado por marca en Bolivia (USD)'
            : `Precios anunciados de ${brand} en Bolivia, por versión (USD)`
        }
        lede={`${quoted.length} de ${rows.length} registros con USD, versión y año confirmados${missing.length ? `; sin precio comparable: ${missing.join(', ')} (ver tabla)` : ''}. No es participación de mercado.`}
        source="Capturas directas de los sitios oficiales; ver condiciones por fila"
        updated={study.observedAt}
        extraDownloads={studyDownloads}
      >
        <label className="automotive-select">
          Marca
          <select value={brand} onChange={(event) => setBrand(event.target.value)}>
            {brands.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <ViewToggle
          chart={
            bars.length ? (
              <StudyBars
                data={bars}
                unit="USD anunciados"
                decimals={0}
                legend={brand === 'Todas' ? 'Precio mínimo anunciado por marca' : 'Precio anunciado por versión'}
                height={Math.max(250, bars.length * 34)}
              />
            ) : (
              <p className="callout">Esta marca solo tiene precios sin moneda o con conflicto: ver la tabla.</p>
            )
          }
          table={
            <Table head={['Modelo / versión', 'Año', 'Precio', 'Estado', 'Vendedor y condiciones']}>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.brand} {row.model}
                    <br />
                    {row.version}
                  </td>
                  <td>{row.modelYear ?? 'No informado'}</td>
                  <td>{price(row)}</td>
                  <td>
                    {row.priceType}
                    <br />
                    {offerStatus(row, study.observedAt)}
                  </td>
                  <td>
                    {row.dealer ?? 'No identificado'}
                    <br />
                    {row.conditions}
                    <Evidence study={study} ids={[row.sourceId]} />
                  </td>
                </tr>
              ))}
            </Table>
          }
        />
      </Panel>
      <Panel
        id="automotor-redes"
        title={`Redes comerciales documentadas: ${rail === 'brands' ? 'marcas' : 'ciudades publicadas'} por red`}
        lede="No es un censo vigente ni un ranking de ventas."
        source="Sitios y documentos oficiales de cada red"
        updated={study.observedAt}
        extraDownloads={studyDownloads}
        data={{
          columnas: ['Red', 'Marcas', 'Ciudades publicadas', 'Estado', 'Límites'],
          filas: study.dealers.map((d) => [
            d.name,
            d.brands.join(', '),
            d.cities.join(', '),
            d.status,
            d.caveat,
          ]),
        }}
      >
        <Chips
          label="Qué contar"
          options={[
            ['brands', 'Marcas'],
            ['cities', 'Ciudades'],
          ]}
          value={rail}
          onPick={setRail}
        />
        <StudyBars
          data={dealerRows}
          unit={rail === 'brands' ? 'marcas' : 'ciudades'}
          decimals={0}
          legend={rail === 'brands' ? 'Marcas documentadas por red' : 'Ciudades publicadas por red'}
          height={Math.max(220, dealerRows.length * 40)}
        />
      </Panel>
    </div>
  );
}

/* ───────────────────────────── Exterior ───────────────────────────── */

interface PairRow {
  name: string;
  bolivia: number;
  abroad: number;
  note: string;
}

/** Dos barras por fila (Bolivia y el otro mercado), en una sola moneda. */
function PairBars({ data, unit, abroadLabel }: { data: PairRow[]; unit: string; abroadLabel: string }) {
  useDatosDeFigura(
    () => ({
      etiqueta: 'Precio anunciado por modelo',
      unidad: unit,
      columnas: ['Modelo', `Bolivia (${unit})`, `${abroadLabel} (${unit})`],
      filas: data.map((row) => [row.name, celda(row.bolivia), celda(row.abroad)]),
    }),
    [data, unit, abroadLabel],
  );
  const peak = data.reduce((high, row) => Math.max(high, row.bolivia, row.abroad), 0);
  const renderTooltip = ({ active, payload }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as PairRow | undefined;
    if (!row) return null;
    return (
      <TooltipShell
        label={row.name}
        rows={[
          { name: 'Bolivia', value: `${num(row.bolivia)} ${unit}`, color: seriesTone(0) },
          { name: abroadLabel, value: `${num(row.abroad)} ${unit}`, color: seriesTone(1) },
        ]}
        note={row.note}
      />
    );
  };
  const label = (value: unknown) => (typeof value === 'number' ? num(value) : '');
  return (
    <div className="chart-stack">
      <div className="chart-frame" style={{ height: framed(Math.max(240, data.length * 64)) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, bottom: 0, left: 4 }}>
            <XAxis type="number" domain={[0, peak > 0 ? peak : 1]} hide />
            <YAxis type="category" dataKey="name" interval={0} width="auto" {...AXIS} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
            {(['bolivia', 'abroad'] as const).map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={seriesTone(index)}
                maxBarSize={BAR_CAP}
                radius={[0, 4, 4, 0]}
                animationDuration={MOTION.duration}
                animationEasing={MOTION.easing}
              >
                <LabelList dataKey={key} position="right" offset={8} fontSize={11} fill="var(--ink-soft)" formatter={label} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={[
          { color: seriesTone(0), label: 'Bolivia' },
          { color: seriesTone(1), label: abroadLabel },
        ]}
      />
    </div>
  );
}

function Abroad({ study }: { study: AutomotiveStudy }) {
  const markets = [...new Set(study.offers.filter((row) => row.country !== 'Bolivia').map((row) => row.country))];
  const [market, setMarket] = useState(markets.includes('Perú') ? 'Perú' : (markets[0] ?? ''));
  const foreign = study.offers.filter((row) => row.country === market);
  const currency = foreign[0]?.currency ?? '';
  const byId = new Map(study.offers.map((row) => [row.id, row]));
  const pairs = study.comparisons.flatMap((pair) => {
    const bolivia = byId.get(pair.boliviaId);
    const abroad = byId.get(pair.foreignId);
    return bolivia && abroad ? [{ pair, bolivia, abroad }] : [];
  });
  const comparable = pairs.filter(({ bolivia, abroad }) => bolivia.currency === 'USD' && abroad.currency === 'USD');
  const apart = pairs.length - comparable.length;
  const countries = [...new Set(comparable.map(({ abroad }) => abroad.country))];
  return (
    <div className="grid-pair">
      <Panel
        id="automotor-internacional"
        title="Mismo modelo: precio anunciado en Bolivia y en el exterior (USD)"
        lede={`Letra = comparabilidad (A: ficha equivalente · B: familia próxima · C: solo el nombre). Ningún par es A: no se calcula sobreprecio.${apart ? ` ${apart} par(es) en otra moneda, en la tabla.` : ''}`}
        source="Ofertas oficiales de Bolivia, Perú, Chile y Paraguay; Argentina excluida por precio no reproducible"
        updated={study.observedAt}
        extraDownloads={studyDownloads}
        data={{
          columnas: ['Modelo', 'Comparabilidad', 'Diferencias'],
          filas: study.comparisons.map((d) => [d.model, d.grade, d.reason]),
        }}
      >
        <ViewToggle
          chart={
            comparable.length ? (
              <PairBars
                data={comparable.map(({ pair, bolivia, abroad }) => ({
                  name: `${pair.model} · ${pair.grade}`,
                  bolivia: bolivia.price,
                  abroad: abroad.price,
                  note: `${abroad.country}, ${offerStatus(abroad, study.observedAt)}. ${pair.reason}`,
                }))}
                unit="USD"
                abroadLabel={countries.join(' / ') || 'Exterior'}
              />
            ) : (
              <p className="callout">Ningún par tiene los dos precios en dólares.</p>
            )
          }
          table={
            <Table head={['Modelo', 'Comp.', 'Bolivia', 'Exterior', 'Qué falta']}>
              {pairs.map(({ pair, bolivia, abroad }) => (
                <tr key={pair.id}>
                  <td>{pair.model}</td>
                  <td>{pair.grade}</td>
                  <td>
                    {price(bolivia)}
                    <br />
                    {offerStatus(bolivia, study.observedAt)}
                  </td>
                  <td>
                    {abroad.country}: {price(abroad)}
                    <br />
                    {offerStatus(abroad, study.observedAt)}
                  </td>
                  <td>{pair.reason}</td>
                </tr>
              ))}
            </Table>
          }
        />
      </Panel>
      <Panel
        id="automotor-ofertas-exterior"
        title={`Precios anunciados en ${market} (${currency})`}
        lede="Modelos y condiciones distintos: describe anuncios, no un ranking de vehículos equivalentes."
        source="Listas oficiales y campañas enlazadas en cada registro"
        updated={study.observedAt}
        extraDownloads={studyDownloads}
      >
        <Chips
          label="Mercado"
          options={markets.map((country) => [country, country] as const)}
          value={market}
          onPick={setMarket}
        />
        <ViewToggle
          chart={
            <StudyBars
              data={foreign.map((row) => ({
                name: `${row.model} ${row.version} ${row.modelYear ?? ''} · ${offerStatus(row, study.observedAt)}`,
                value: row.price,
                note: `${row.priceType}. ${row.conditions}`,
              }))}
              unit={currency}
              decimals={0}
              legend={`Precio anunciado (${currency}); las vencidas son antecedente`}
              height={Math.max(240, foreign.length * 40)}
            />
          }
          table={
            <Table head={['Modelo / versión', 'Año', 'Precio', 'Vigencia', 'Condiciones']}>
              {foreign.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.brand} {row.model} · {row.version}
                  </td>
                  <td>{row.modelYear ?? 'No informado'}</td>
                  <td>{price(row)}</td>
                  <td>
                    {row.priceType} · {offerStatus(row, study.observedAt)} {row.validUntil ?? ''}
                  </td>
                  <td>
                    {row.conditions}
                    <Evidence study={study} ids={[row.sourceId]} />
                  </td>
                </tr>
              ))}
            </Table>
          }
        />
      </Panel>
    </div>
  );
}

/* ───────────────────────────── Escenarios ───────────────────────────── */

const initial: InventoryInputs = { purchaseUsd: 15000, freightUsd: 1000, fx: 7, taxesBob: 28000, recoverableTaxBob: 0, localBob: 3000, units: 10, days: 90, annualRate: 15, targetMargin: 18, fixedMonthlyBob: 40000 };
const labels: Record<keyof InventoryInputs, string> = {
  purchaseUsd: 'Compra FOB por unidad (USD)', freightUsd: 'Flete y seguro por unidad (USD)', fx: 'Costo efectivo de USD (Bs/USD)', taxesBob: 'Tributos no recuperables por unidad (Bs)', recoverableTaxBob: 'Tributos recuperables adelantados (Bs)', localBob: 'Logística local por unidad (Bs)', units: 'Unidades compradas', days: 'Días de caja inmovilizada', annualRate: 'Costo financiero simple anual (%)', targetMargin: 'Margen objetivo sobre venta neta (%)', fixedMonthlyBob: 'Costos fijos mensuales (Bs)',
};

function Scenarios() {
  const [inputs, setInputs] = useState(initial);
  const baseline = inventoryScenario(inputs);
  const scenarios = [
    { name: 'Supuestos ingresados', input: inputs },
    { name: 'USD +20%; tributos constantes', input: { ...inputs, fx: inputs.fx * 1.2 } },
    { name: '60 días más de inventario', input: { ...inputs, days: inputs.days + 60 } },
    { name: 'Financiación +5 puntos', input: { ...inputs, annualRate: inputs.annualRate + 5 } },
  ].flatMap((row) => {
    const result = inventoryScenario(row.input);
    return result ? [{ name: row.name, result }] : [];
  });
  const parts = baseline
    ? [
        { name: 'Compra, flete y seguro', value: (inputs.purchaseUsd + inputs.freightUsd) * inputs.fx },
        { name: 'Tributos no recuperables', value: inputs.taxesBob },
        { name: 'Logística local', value: inputs.localBob },
        { name: 'Financiación', value: baseline.financing },
        { name: 'Margen', value: baseline.targetPrice - baseline.costWithFinance },
      ]
    : [];
  return (
    <>
      <Panel
        id="automotor-inventario"
        title="Inventario y precio objetivo: supuestos del simulador (Bs)"
        lede="Valores de ejemplo, no tasas vigentes ni márgenes observados. Cambiá cualquiera y las figuras se recalculan."
        source="Modelo explícito del Observatorio; entradas del usuario"
        downloadable={false}
      >
        <div className="automotive-inputs">
          {(Object.keys(labels) as Array<keyof InventoryInputs>).map((key) => (
            <label key={key}>
              {labels[key]}
              <input
                type="number"
                min="0"
                step={key === 'units' || key === 'days' ? '1' : '0.01'}
                max={key === 'targetMargin' ? '99.99' : undefined}
                value={Number.isFinite(inputs[key]) ? inputs[key] : ''}
                onChange={(event) =>
                  setInputs((value) => ({ ...value, [key]: event.target.value === '' ? NaN : Number(event.target.value) }))
                }
              />
            </label>
          ))}
        </div>
        <button className="chip" onClick={() => setInputs(initial)}>
          Restablecer ejemplo
        </button>
        {baseline ? (
          <div className="automotive-kpis">
            <article>
              <small>Caja comprometida en el lote</small>
              <strong>Bs {num(baseline.workingCapital)}</strong>
            </article>
            <article>
              <small>Financiación por unidad</small>
              <strong>Bs {num(baseline.financing)}</strong>
              <span>{inputs.days} días, interés simple.</span>
            </article>
            <article>
              <small>Precio neto objetivo por unidad</small>
              <strong>Bs {num(baseline.targetPrice)}</strong>
            </article>
            <article>
              <small>Unidades/mes para cubrir costos fijos</small>
              <strong>{baseline.breakEvenUnits === null ? 'No definido' : num(baseline.breakEvenUnits)}</strong>
            </article>
          </div>
        ) : (
          <p role="alert" className="callout">
            Completá valores no negativos, tipo de cambio mayor que cero y margen menor que 100%.
          </p>
        )}
        <details>
          <summary>Fórmulas y límites</summary>
          <p>Costo económico = (FOB + flete + seguro) × Bs/USD + tributos no recuperables + gastos locales. Caja = costo económico + tributos recuperables adelantados. Interés = caja × tasa × días / 365. Precio objetivo neto = (costo + interés) / (1 − margen). Equilibrio = costos fijos mensuales / contribución unitaria, hacia arriba.</p>
          <p>El margen es sobre ventas, no recargo sobre costo. Se financia toda la caja sin anticipo del cliente. El escenario de divisas deja los tributos en Bs constantes: es una sensibilidad parcial, no una liquidación aduanera.</p>
        </details>
      </Panel>
      {baseline && (
        <div className="grid-pair">
          <Panel
            id="automotor-inventario-escenarios"
            title="Precio neto objetivo por escenario (Bs por unidad)"
            source="Modelo explícito del Observatorio; entradas del usuario"
          >
            <ViewToggle
              chart={
                <StudyBars
                  legend="Precio neto objetivo simulado (Bs por unidad)"
                  data={scenarios.map((row) => ({ name: row.name, value: row.result.targetPrice }))}
                  unit="Bs netos por unidad"
                  decimals={0}
                  height={260}
                />
              }
              table={
                <Table head={['Escenario', 'Costo/unidad', 'Financiación/unidad', 'Precio objetivo', 'Caja lote']}>
                  {scenarios.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{num(row.result.economicCost)}</td>
                      <td>{num(row.result.financing)}</td>
                      <td>{num(row.result.targetPrice)}</td>
                      <td>{num(row.result.workingCapital)}</td>
                    </tr>
                  ))}
                </Table>
              }
            />
          </Panel>
          <Panel
            id="automotor-inventario-composicion"
            title="De qué se compone el precio neto objetivo (Bs por unidad)"
            source="Modelo explícito del Observatorio; entradas del usuario"
          >
            <StudyBars
              legend="Parte del precio neto objetivo (Bs por unidad)"
              data={parts}
              unit="Bs por unidad"
              decimals={0}
              height={260}
            />
          </Panel>
        </div>
      )}
      <Ownership />
    </>
  );
}

function Ownership() {
  const [values, setValues] = useState([150000, 75000, 5, 15000, 8, 7, 6000]);
  const names = ['Compra (Bs)', 'Reventa esperada (Bs)', 'Años de uso', 'Kilómetros por año', 'Litros o kWh / 100 km', 'Bs por litro o kWh', 'Seguro, mantenimiento y otros (Bs/año)'];
  const [purchase, resale, years, km, use, rate, other] = values as [number, number, number, number, number, number, number];
  const cost = ownershipCost(purchase, resale, years, km, use, rate, other);
  return (
    <Panel
      id="automotor-costo-uso"
      title="Costo de uso: compra, energía, mantenimiento y reventa (Bs)"
      lede="Ejemplo editable. Usá una tecnología a la vez: litros para combustión, kWh para eléctrico."
      source="Supuestos del usuario; cálculo sin financiación ni descuento temporal"
      data={() =>
        cost
          ? {
              columnas: ['Indicador', 'Valor'],
              filas: [['Costo neto (Bs)', cost.total], ['Energía (Bs)', cost.energy], ['Costo/km (Bs)', cost.perKm], ...names.map((n, i) => [n, values[i]!])],
            }
          : undefined
      }
    >
      <div className="automotive-inputs">
        {names.map((label, index) => (
          <label key={label}>
            {label}
            <input
              type="number"
              min="0"
              step="0.1"
              value={Number.isFinite(values[index]) ? values[index] : ''}
              onChange={(event) =>
                setValues((old) => old.map((v, i) => (i === index ? (event.target.value === '' ? NaN : Number(event.target.value)) : v)))
              }
            />
          </label>
        ))}
      </div>
      {cost ? (
        <>
          <div className="automotive-kpis">
            <article>
              <small>Costo neto del período</small>
              <strong>Bs {num(cost.total)}</strong>
            </article>
            <article>
              <small>Costo por kilómetro</small>
              <strong>Bs {num(cost.perKm, 2)}</strong>
            </article>
          </div>
          <StudyBars
            legend="Costo neto del período, por componente (Bs)"
            data={[
              { name: 'Depreciación (compra − reventa)', value: purchase - resale },
              { name: 'Energía', value: cost.energy },
              { name: 'Seguro, mantenimiento y otros', value: years * other },
            ]}
            unit="Bs"
            decimals={0}
            height={200}
          />
        </>
      ) : (
        <p role="alert" className="callout">
          Revisá los valores: años y kilómetros deben ser positivos; la reventa no puede superar la compra.
        </p>
      )}
      <details>
        <summary>Fórmula y límites</summary>
        <p>Costo = compra − reventa + años × (km/año × consumo/100 × precio de energía + otros costos anuales). No incluye costo de capital, cargador, batería ni reparaciones extraordinarias. Para comparar dos tecnologías conservá horizonte y kilometraje y cambiá solo sus costos documentados.</p>
      </details>
    </Panel>
  );
}

/* ───────────────────── Lectura para el negocio (plegada) ───────────────────── */

const RESPONSES = [
  ['Presión de divisas', 'Señales: costo efectivo del dólar, plazo del giro y costo de reposición. Respuesta: acortar la vigencia de cotización, escalonar pedidos y medir la caja necesaria para reponer cada venta.'],
  ['Inventario más lento', 'Señales: días de stock, reservas y descuentos por año modelo. Respuesta: reducir profundidad por versión, negociar lote y fecha de pago, comparar liquidar contra el costo financiero de esperar.'],
  ['Híbridos y eléctricos', 'Señales: costo de uso por recorrido real, acceso a carga, garantía y repuestos. Respuesta: probar unidades y capacidad de servicio antes de subir volumen; revisar vigencia tributaria al nacionalizar.'],
  ['Competencia por crédito', 'Señales: inicial, tasa efectiva, seguros, cuota final y aprobación. Respuesta: cotizar costo total financiado y precio al contado por separado.'],
] as const;

function Reading({ study }: { study: AutomotiveStudy }) {
  return (
    <Panel
      id="automotor-decision"
      title="Decisiones, entorno, fichas y fuentes del estudio"
      lede="Todo el texto de la investigación, plegado: abrí solo lo que necesites."
      source="INE/RUAT, sitios oficiales de marcas, ASFI y Aduana; elaboración del Observatorio"
      updated={study.observedAt}
      extraDownloads={studyDownloads}
      data={{
        columnas: ['Decisión', 'Evidencia', 'Acción', 'Indicador', 'Límite'],
        filas: study.decisions.map((d) => [d.title, d.evidence, d.action, d.trigger, d.limit]),
      }}
    >
      <details>
        <summary>Decisiones para el negocio ({study.decisions.length})</summary>
        <div className="automotive-cards">
          {study.decisions.map((decision) => (
            <article key={decision.title}>
              <h4>{decision.title}</h4>
              <p><strong>Evidencia:</strong> {decision.evidence}</p>
              <p><strong>Acción:</strong> {decision.action}</p>
              <p><strong>Medir:</strong> {decision.trigger}</p>
              <p className="panel-note">{decision.limit}</p>
              <Evidence study={study} ids={decision.sourceIds} />
            </article>
          ))}
        </div>
      </details>
      <details>
        <summary>Entorno externo y abastecimiento ({study.environment.length})</summary>
        <div className="automotive-cards">
          {study.environment.map((row) => (
            <article key={row.topic}>
              <h4>{row.topic}</h4>
              <p>{row.fact}</p>
              <p><strong>Para el negocio:</strong> {row.implication}</p>
              <p className="panel-note">{row.status}</p>
              <Evidence study={study} ids={row.sourceIds} />
            </article>
          ))}
        </div>
      </details>
      <details>
        <summary>Respuestas ante cambios del entorno ({RESPONSES.length})</summary>
        <div className="automotive-cards">
          {RESPONSES.map(([title, text]) => (
            <article key={title}>
              <h4>{title}</h4>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </details>
      <details>
        <summary>Fichas de las redes comerciales ({study.dealers.length})</summary>
        <div className="automotive-cards">
          {study.dealers.map((dealer) => (
            <article key={dealer.id}>
              <span className="automotive-badge">{dealer.status}</span>
              <h4>{dealer.name}</h4>
              <p><strong>Marcas:</strong> {dealer.brands.join(', ')}.</p>
              <p><strong>Ciudades:</strong> {dealer.cities.join(', ') || 'Sin lista comprobada en este corte'}.</p>
              <p>{dealer.positioning}</p>
              <p>{dealer.services}</p>
              <p className="panel-note">{dealer.caveat}</p>
              <Evidence study={study} ids={dealer.sourceIds} />
            </article>
          ))}
        </div>
        <p><strong>Padrón histórico AEMP ({study.historicalDealers.length} empresas, 2023–junio 2024):</strong> sirve para detectar empresas que requieren verificación; las representaciones pueden haber cambiado.</p>
        <ul>
          {study.historicalDealers.map((row) => (
            <li key={row.name}><strong>{row.name}:</strong> {row.brands}. {row.period}.</li>
          ))}
        </ul>
        <Evidence study={study} ids={['aemp']} />
      </details>
      <details>
        <summary>Conflictos y vacíos de la investigación ({study.conflicts.length + study.gaps.length})</summary>
        {study.conflicts.map((row) => (
          <article className="automotive-note" key={row.subject}>
            <h4>{row.subject}</h4>
            <p>{row.detail}</p>
            <Evidence study={study} ids={row.sourceIds} />
          </article>
        ))}
        <h4>Datos que aún limitan las decisiones</h4>
        <ul>
          {study.gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </details>
      <details>
        <summary>{num(study.sources.length)} fuentes y huellas de archivo</summary>
        <p>Una respuesta HTTP exitosa acredita la captura del documento; no confirma la vigencia comercial.</p>
        {study.sources.map((source) => (
          <p className="automotive-source" key={source.id}>
            <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
            <br />
            Captura: {source.capturedAt}; HTTP {source.httpStatus}; {num(source.bytes)} bytes.
            <br />
            <code>SHA-256: {source.sha256}</code>
          </p>
        ))}
        <details>
          <summary>Proveniencia de las importaciones</summary>
          {study.trade.sources.map((source) => (
            <p key={source.year}>
              <a href={source.sourceUrl}>{source.title}</a> · captura {source.retrievedAt} · meses {source.months.join(', ')}.
              <br />
              <code>SHA-256 fuente: {source.upstreamSha256}</code>
            </p>
          ))}
          <p>Agregación reproducible: scripts/automotor/aggregate-trade.py. No se suman M_DETAIL y M_MONTHLY.</p>
        </details>
      </details>
    </Panel>
  );
}

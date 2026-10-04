'use client';

import { useState } from 'react';
import { ChartLegend, SeriesChart, ShareBars, seriesTone } from './charts';
import { Download } from './download';
import { SubTabs } from './tabs';
import { ChipPicker, SinDeclarar, TOP, TopNote } from './transport-views';
import { Panel } from '@/components/ui/panel';
import { ViewToggle } from '@/components/ui/view-toggle';
import type { FleetPoint } from '@/lib/transport';
import type { RoadTransportBoard } from '@/lib/road-transport-board';
import { departmentName } from '@/lib/roads-board';

const count = (value: number | null): string =>
  value === null ? '—' : value.toLocaleString('es-BO');
const pct = (value: number | null): string =>
  value === null ? '—' : `${value.toLocaleString('es-BO', { maximumFractionDigits: 1 })} %`;

/** Las clases con tilde o con nombre compuesto, como las escribe un lector. */
const PALABRAS: Record<string, string> = {
  AUTOMOVIL: 'automóvil',
  MICROBUS: 'microbús',
  MINIBUS: 'minibús',
  CAMION: 'camión',
  FURGON: 'furgón',
  PUBLICO: 'público',
  TRACTO_CAMION: 'tractocamión',
  MAQUINARIA_PESADA: 'maquinaria pesada',
  TRIMOVIL_CAMION: 'trimóvil camión',
  UNSPECIFIED: 'sin especificar',
};

/** Las bandas de capacidad de carga (toneladas): «GT_3_LE_5» es «más de 3 hasta 5». */
const CAPACIDAD: Record<string, string> = {
  LE_1_4: 'Hasta 1,4 t',
  GT_1_4_LE_3: 'Más de 1,4 hasta 3 t',
  GT_3_LE_5: 'Más de 3 hasta 5 t',
  GT_5_LE_11: 'Más de 5 hasta 11 t',
  GT_11_LE_13: 'Más de 11 hasta 13 t',
  GT_13: 'Más de 13 t',
};

/** Un código del registro, en minúscula de oración: «TRACTO_CAMION» pasa a «Tractocamión». */
const label = (value: string | null): string => {
  const code = value ?? 'TOTAL';
  const known = CAPACIDAD[code] ?? PALABRAS[code];
  const text = known ?? code.replaceAll('_', ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Quién publica el parque automotor y de dónde sale su registro. */
const FLEET_SOURCE = 'Instituto Nacional de Estadística, con datos del RUAT';
const GNV_SOURCE = 'Instituto Nacional de Estadística (cuadros EEC-GNV)';

/** Los servicios del registro, en el orden en que se leen: el total y sus tres partes. */
const SERVICES: ReadonlyArray<{ id: FleetPoint['service']; label: string }> = [
  { id: 'TOTAL', label: 'Total' },
  { id: 'PARTICULAR', label: 'Particular' },
  { id: 'PUBLICO', label: 'Público' },
  { id: 'OFICIAL', label: 'Oficial' },
];

/** Las bandas de capacidad de carga, de menor a mayor, con la que el registro no especifica al final. */
const BANDS = [
  'LE_1_4',
  'GT_1_4_LE_3',
  'GT_3_LE_5',
  'GT_5_LE_11',
  'GT_11_LE_13',
  'GT_13',
  'UNSPECIFIED',
] as const;

/** Los años que el último tablero cubre, para no escribirlos a mano en los títulos. */
const span = (first: string | null, latest: string | null): string =>
  `${first ?? '—'}–${latest ?? '—'}`;

function Panorama({ board }: { board: RoadTransportBoard }) {
  const { summary } = board;
  const series = board.fleet.filter(
    (point) =>
      point.dimension === 'DEPARTMENT_SERVICE' &&
      point.department === 'BOLIVIA' &&
      point.service === 'TOTAL',
  );
  /** Las cifras de cabecera: lo que se ve y, con el mismo orden, lo que se baja. */
  const figures: ReadonlyArray<{
    label: string;
    shown: string;
    value: number | null;
    unit: string;
    hint: string;
  }> = [
    {
      label: `Parque automotor ${summary.latestYear}`,
      shown: count(summary.latestFleet),
      value: summary.latestFleet,
      unit: 'vehículos',
      hint: 'vehículos registrados · preliminar',
    },
    {
      label: `Desde ${summary.firstYear}`,
      shown: `+${pct(summary.growthPercent)}`,
      value: summary.growthPercent,
      unit: '%',
      hint: `base: ${count(summary.firstFleet)}`,
    },
    {
      label: 'Servicio público',
      shown: count(summary.publicFleet),
      value: summary.publicFleet,
      unit: 'vehículos',
      hint: 'todos los tipos',
    },
    {
      label: 'Bus + micro + minibús público',
      shown: count(summary.publicPassengerFleet),
      value: summary.publicPassengerFleet,
      unit: 'vehículos',
      hint: `detalle ${summary.latestYear}`,
    },
    {
      label: 'Conversiones GNV',
      shown: count(summary.gnvConversions),
      value: summary.gnvConversions,
      unit: 'operaciones',
      hint: 'último año publicado',
    },
    {
      label: 'Cilindros recalificados',
      shown: count(summary.gnvRequalifications),
      value: summary.gnvRequalifications,
      unit: 'operaciones',
      hint: 'último año publicado',
    },
  ];
  return (
    <Panel
      id="parque-automotor"
      className="transp"
      title={`Parque automotor nacional, ${span(summary.firstYear, summary.latestYear)} (vehículos registrados)`}
      lede="Stock registrado al cierre de cada gestión; el último año es preliminar."
      source={FLEET_SOURCE}
      data={{
        etiqueta: 'Cifras clave',
        columnas: ['Cifra', 'Valor', 'Unidad', 'Detalle'],
        filas: figures.map((figure) => [figure.label, figure.value, figure.unit, figure.hint]),
      }}
    >
      <div className="stat-strip">
        <div className="stat">
          <span className="stat-label">{figures[0]?.label}</span>
          <span className="stat-value">{figures[0]?.shown}</span>
          <span className="stat-hint">{figures[0]?.hint}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{figures[1]?.label}</span>
          <span className="stat-value">{figures[1]?.shown}</span>
          <span className="stat-hint">{figures[1]?.hint}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{figures[2]?.label}</span>
          <span className="stat-value">{figures[2]?.shown}</span>
          <span className="stat-hint">{figures[2]?.hint}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{figures[3]?.label}</span>
          <span className="stat-value">{figures[3]?.shown}</span>
          <span className="stat-hint">{figures[3]?.hint}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{figures[4]?.label}</span>
          <span className="stat-value">{figures[4]?.shown}</span>
          <span className="stat-hint">{figures[4]?.hint}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{figures[5]?.label}</span>
          <span className="stat-value">{figures[5]?.shown}</span>
          <span className="stat-hint">{figures[5]?.hint}</span>
        </div>
      </div>
      <SeriesChart
        data={series.map((point) => ({ date: `${point.period}-01-01`, value: point.value }))}
        kind="area"
        tone="var(--series-1)"
        unit="vehículos"
        label="Parque automotor"
        decimals={0}
        height="tall"
      />
    </Panel>
  );
}

function Departments({ fleet }: { fleet: FleetPoint[] }) {
  const years = [
    ...new Set(
      fleet
        .filter((point) => point.dimension === 'DEPARTMENT_SERVICE')
        .map((point) => point.period),
    ),
  ].sort();
  const [year, setYear] = useState(years.at(-1) ?? '2025');
  const [measure, setMeasure] = useState<FleetPoint['service']>('TOTAL');
  const rows = fleet.filter(
    (point) =>
      point.dimension === 'DEPARTMENT_SERVICE' &&
      point.period === year &&
      point.department !== 'BOLIVIA',
  );
  const departments = [...new Set(rows.map((point) => point.department ?? ''))].sort();
  const at = (department: string, service: FleetPoint['service']) =>
    rows.find((point) => point.department === department && point.service === service)?.value ??
    null;
  /** Una barra por departamento con el servicio elegido; las demás partes van en el detalle. */
  const bars = departments.flatMap((department) => {
    const value = at(department, measure);
    if (value === null) return [];
    const parts = SERVICES.filter((one) => one.id !== measure).flatMap((one) => {
      const part = at(department, one.id);
      return part === null ? [] : [{ name: one.label, value: part, unit: 'vehículos' }];
    });
    return [{ name: departmentName(department), value, parts }];
  });
  return (
    <Panel
      id="parque-por-departamento"
      className="transp"
      title={`Parque automotor por departamento y servicio, ${year} (vehículos)`}
      lede="Total, particular, público y oficial para cada gestión publicada."
      source={FLEET_SOURCE}
      data={() => ({
        unidad: 'vehículos',
        columnas: ['Departamento', 'Total', 'Particular', 'Público', 'Oficial'],
        filas: departments.map((department) => [
          departmentName(department),
          at(department, 'TOTAL'),
          at(department, 'PARTICULAR'),
          at(department, 'PUBLICO'),
          at(department, 'OFICIAL'),
        ]),
      })}
    >
      <label className="field-label">
        Gestión{' '}
        <select value={year} onChange={(event) => setYear(event.target.value)}>
          {years.map((one) => (
            <option key={one}>{one}</option>
          ))}
        </select>
      </label>
      <ViewToggle
        chart={
          <>
            <ChipPicker label="Servicio" value={measure} options={SERVICES} onChange={setMeasure} />
            <SinDeclarar>
              <ShareBars
                data={bars}
                unit="vehículos"
                decimals={0}
                tone={seriesTone(0)}
                height={Math.max(220, bars.length * 34 + 16)}
              />
            </SinDeclarar>
            <ChartLegend
              items={[
                {
                  color: seriesTone(0),
                  label: `Parque ${label(measure).toLowerCase()}, ${year} (vehículos)`,
                },
              ]}
            />
          </>
        }
        table={
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Departamento</th>
                  <th>Total</th>
                  <th>Particular</th>
                  <th>Público</th>
                  <th>Oficial</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr key={department}>
                    <th>{departmentName(department)}</th>
                    <td>{count(at(department, 'TOTAL'))}</td>
                    <td>{count(at(department, 'PARTICULAR'))}</td>
                    <td>{count(at(department, 'PUBLICO'))}</td>
                    <td>{count(at(department, 'OFICIAL'))}</td>
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

function Classes({ fleet }: { fleet: FleetPoint[] }) {
  const [service, setService] = useState<FleetPoint['service']>('PUBLICO');
  const [vehicleClass, setVehicleClass] = useState('MICROBUS');
  const points = fleet.filter((point) => point.dimension === 'SERVICE_CLASS');
  const classes = [
    ...new Set(
      points
        .filter((point) => point.vehicleClass && point.vehicleClass !== 'TOTAL')
        .map((point) => point.vehicleClass as string),
    ),
  ];
  const annual = points.filter(
    (point) => point.service === service && point.vehicleClass === vehicleClass,
  );
  const latest = points
    .filter(
      (point) =>
        point.service === service && point.period === '2025' && point.vehicleClass !== 'TOTAL',
    )
    .sort((a, b) => b.value - a.value);
  return (
    <div className="grid-two">
      <Panel
        id="parque-por-clase"
        className="transp"
        title={`${label(vehicleClass)}, servicio ${label(service).toLowerCase()}, por gestión (vehículos)`}
        lede="Elige el servicio y la clase de vehículo: automóvil, bus, microbús, minibús, camión, tractocamión, moto y más."
        source={FLEET_SOURCE}
      >
        <div className="chips">
          <select
            aria-label="Tipo de servicio"
            value={service}
            onChange={(event) => setService(event.target.value as FleetPoint['service'])}
          >
            {['PARTICULAR', 'PUBLICO', 'OFICIAL'].map((one) => (
              <option key={one} value={one}>
                {label(one)}
              </option>
            ))}
          </select>
          <select
            aria-label="Clase de vehículo"
            value={vehicleClass}
            onChange={(event) => setVehicleClass(event.target.value)}
          >
            {classes.map((one) => (
              <option key={one} value={one}>
                {label(one)}
              </option>
            ))}
          </select>
        </div>
        <SeriesChart
          data={annual.map((point) => ({ date: `${point.period}-01-01`, value: point.value }))}
          kind="line"
          tone="var(--series-2)"
          unit="vehículos"
          label={`${label(vehicleClass)} · ${label(service)}`}
          decimals={0}
        />
      </Panel>
      <Panel
        id="parque-composicion"
        className="transp"
        title={`Composición del parque ${label(service).toLowerCase()} por clase, 2025 (vehículos)`}
        source={FLEET_SOURCE}
        data={() => ({
          unidad: 'vehículos',
          columnas: ['Clase', 'Vehículos'],
          filas: latest.map((point) => [label(point.vehicleClass), point.value]),
        })}
      >
        <ViewToggle
          chart={
            <>
              <SinDeclarar>
                <ShareBars
                  data={latest.slice(0, TOP).map((point) => ({
                    name: label(point.vehicleClass),
                    value: point.value,
                  }))}
                  unit="vehículos"
                  decimals={0}
                  tone={seriesTone(0)}
                  height={Math.max(220, Math.min(latest.length, TOP) * 30 + 16)}
                />
              </SinDeclarar>
              <ChartLegend
                items={[
                  {
                    color: seriesTone(0),
                    label: `Parque ${label(service).toLowerCase()} por clase, 2025 (vehículos)`,
                  },
                ]}
              />
              <TopNote shown={Math.min(latest.length, TOP)} total={latest.length} noun="clases" />
            </>
          }
          table={
            <div className="table-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Clase</th>
                    <th>Vehículos</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.map((point) => (
                    <tr key={point.vehicleClass}>
                      <th>{label(point.vehicleClass)}</th>
                      <td>{count(point.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        />
      </Panel>
    </div>
  );
}

function CapacityGnv({ board }: { board: RoadTransportBoard }) {
  const capacity = board.fleet.filter(
    (point) =>
      point.dimension === 'SERVICE_CLASS_CAPACITY' &&
      point.period === '2025' &&
      point.capacityBand !== 'TOTAL',
  );
  const [service, setService] = useState<FleetPoint['service']>('TOTAL');
  /* Las clases del cuadro, de la más numerosa a la menos; el camión abre porque es donde la capacidad importa. */
  const classes = [
    ...capacity
      .reduce((totals, point) => {
        const code = point.vehicleClass ?? '';
        return totals.set(code, (totals.get(code) ?? 0) + point.value);
      }, new Map<string, number>())
      .entries(),
  ]
    .sort(([, left], [, right]) => right - left)
    .map(([code]) => code);
  const [vehicleClass, setVehicleClass] = useState(
    classes.includes('CAMION') ? 'CAMION' : (classes[0] ?? ''),
  );
  /*
   * Las bandas de capacidad de la clase elegida, sumando los servicios (o el elegido). La tabla
   * conserva las filas por servicio, clase y banda, tal cual.
   */
  const bands = BANDS.map((band) => ({
    name: label(band),
    value: capacity
      .filter(
        (point) =>
          point.vehicleClass === vehicleClass &&
          point.capacityBand === band &&
          (service === 'TOTAL' || point.service === service),
      )
      .reduce((sum, point) => sum + point.value, 0),
  }));
  /*
   * El total anual lleva `TOTAL` como clase (el trimestral, `null`). El filtro pedía solo
   * `null` con año de cuatro cifras, que no existe: las dos gráficas salían vacías.
   */
  const annual = board.gnv.filter(
    (point) =>
      point.department === 'BOLIVIA' &&
      (point.vehicleClass === null || point.vehicleClass === 'TOTAL') &&
      point.period.length === 4,
  );
  return (
    <>
      <Panel
        id="parque-capacidad"
        className="transp"
        title="Parque automotor por servicio, clase y capacidad de carga, 2025 (vehículos)"
        lede="Bandas de capacidad en toneladas."
        source={FLEET_SOURCE}
        data={() => ({
          unidad: 'vehículos',
          columnas: ['Servicio', 'Clase', 'Capacidad', 'Vehículos'],
          filas: capacity.map((point) => [
            label(point.service),
            label(point.vehicleClass),
            label(point.capacityBand),
            point.value,
          ]),
        })}
      >
        <ViewToggle
          chart={
            <>
              <div className="chips">
                <select
                  aria-label="Tipo de servicio"
                  value={service}
                  onChange={(event) => setService(event.target.value as FleetPoint['service'])}
                >
                  {SERVICES.map((one) => (
                    <option key={one.id} value={one.id}>
                      {one.id === 'TOTAL' ? 'Todos los servicios' : one.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Clase de vehículo"
                  value={vehicleClass}
                  onChange={(event) => setVehicleClass(event.target.value)}
                >
                  {classes.map((one) => (
                    <option key={one} value={one}>
                      {label(one)}
                    </option>
                  ))}
                </select>
              </div>
              <SinDeclarar>
                <ShareBars
                  data={bands}
                  unit="vehículos"
                  decimals={0}
                  tone={seriesTone(0)}
                  height={Math.max(220, bands.length * 34 + 16)}
                />
              </SinDeclarar>
              <ChartLegend
                items={[
                  {
                    color: seriesTone(0),
                    label: `${label(vehicleClass)} por capacidad de carga, 2025 (vehículos)`,
                  },
                ]}
              />
            </>
          }
          table={
            <div className="table-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th>Clase</th>
                    <th>Capacidad</th>
                    <th>Vehículos</th>
                  </tr>
                </thead>
                <tbody>
                  {capacity.map((point) => (
                    <tr key={`${point.service}-${point.vehicleClass}-${point.capacityBand}`}>
                      <td>{label(point.service)}</td>
                      <td>{label(point.vehicleClass)}</td>
                      <td>{label(point.capacityBand)}</td>
                      <td>{count(point.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        />
      </Panel>
      <Panel
        id="actividad-gnv"
        className="transp"
        title="Conversiones a GNV y recalificación de cilindros por año (operaciones)"
        lede="Total nacional. El detalle trimestral, departamental y por clase está en la descarga de «Fuentes»."
        source={GNV_SOURCE}
      >
        <div className="grid-pair">
          {(['CONVERSION', 'CYLINDER_REQUALIFICATION'] as const).map((metric, index) => (
            <div key={metric}>
              <h4>{metric === 'CONVERSION' ? 'Conversiones' : 'Recalificaciones'}</h4>
              <SeriesChart
                data={annual
                  .filter((point) => point.metric === metric)
                  .map((point) => ({ date: `${point.period}-01-01`, value: point.value }))}
                kind="bar"
                tone={`var(--series-${index + 1})`}
                unit="operaciones"
                label={
                  metric === 'CONVERSION' ? 'Conversiones a GNV' : 'Recalificaciones de cilindros'
                }
                decimals={0}
                height="small"
              />
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function Sources({ board }: { board: RoadTransportBoard }) {
  return (
    <Panel
      id="fuentes-transporte-terrestre"
      className="transp"
      title="Fuentes, cobertura y límites del transporte terrestre (cantidad de fuentes)"
      lede="Cada fila conserva editor, enlace y SHA-256; no se completan vacíos con estimaciones."
      meta={`${board.sources.length} fuentes`}
      source="Instituto Nacional de Estadística, Autoridad de Regulación y Fiscalización de Telecomunicaciones y Transportes (ATT) y las demás fuentes de la tabla"
      data={{
        unidad: 'fuentes',
        columnas: ['Editor', 'Conjunto', 'Enlace', 'Huella SHA-256'],
        filas: board.sources.map((source) => [
          source.publisher,
          source.sourceTitle,
          source.sourceUrl,
          source.evidenceSha256,
        ]),
      }}
    >
      <div className="table-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Editor</th>
              <th>Conjunto</th>
              <th>Huella</th>
            </tr>
          </thead>
          <tbody>
            {board.sources.map((source) => (
              <tr key={source.sourceKey}>
                <td>{source.publisher}</td>
                <th>
                  <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                    {source.sourceTitle}
                  </a>
                </th>
                <td>
                  <code>{source.evidenceSha256.slice(0, 12)}…</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="callout">
        Cobertura pendiente: modelo/año, cilindrada y municipio. Los libros oficiales recuperados
        para esos cuadros llegaron vacíos; quedan identificados para incorporarlos cuando el editor
        repare la descarga.
      </div>
      <Download dataset="transporte-terrestre" label="Descargar todo el dato terrestre" />
    </Panel>
  );
}

export function RoadTransportExplorer({ board }: { board: RoadTransportBoard }) {
  return (
    <SubTabs
      labels={['Panorama', 'Departamentos', 'Clases y micros', 'Capacidad y GNV', 'Fuentes']}
      icons={['linea', 'mapa', 'camion', 'cajas', 'hoja']}
    >
      <Panorama board={board} />
      <Departments fleet={board.fleet} />
      <Classes fleet={board.fleet} />
      <CapacityGnv board={board} />
      <Sources board={board} />
    </SubTabs>
  );
}

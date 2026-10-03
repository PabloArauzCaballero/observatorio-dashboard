'use client';

import { useMemo, useState } from 'react';
import { SeriesChart } from './charts';
import { Download } from './download';
import { SubTabs } from './tabs';
import type { FareBand, FleetPoint } from '@/lib/transport';
import type { RoadTransportBoard } from '@/lib/road-transport-board';

const count = (value: number | null): string =>
  value === null ? '—' : value.toLocaleString('es-BO');
const pct = (value: number | null): string =>
  value === null ? '—' : `${value.toLocaleString('es-BO', { maximumFractionDigits: 1 })} %`;
const label = (value: string | null): string => (value ?? 'TOTAL').replaceAll('_', ' ');
const fare = (min: number | null, max: number | null): string =>
  min === null || max === null ? '—' : `Bs ${min}–${max}`;

function Panorama({ board }: { board: RoadTransportBoard }) {
  const series = board.fleet.filter(
    (point) =>
      point.dimension === 'DEPARTMENT_SERVICE' &&
      point.department === 'BOLIVIA' &&
      point.service === 'TOTAL',
  );
  return (
    <>
      <div className="stat-strip">
        <div className="stat">
          <span className="stat-label">Parque automotor {board.summary.latestYear}</span>
          <span className="stat-value">{count(board.summary.latestFleet)}</span>
          <span className="stat-hint">vehículos registrados · preliminar</span>
        </div>
        <div className="stat">
          <span className="stat-label">Desde {board.summary.firstYear}</span>
          <span className="stat-value">+{pct(board.summary.growthPercent)}</span>
          <span className="stat-hint">base: {count(board.summary.firstFleet)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Servicio público</span>
          <span className="stat-value">{count(board.summary.publicFleet)}</span>
          <span className="stat-hint">todos los tipos</span>
        </div>
        <div className="stat">
          <span className="stat-label">Bus + micro + minibús público</span>
          <span className="stat-value">{count(board.summary.publicPassengerFleet)}</span>
          <span className="stat-hint">detalle {board.summary.latestYear}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Conversiones GNV</span>
          <span className="stat-value">{count(board.summary.gnvConversions)}</span>
          <span className="stat-hint">último año publicado</span>
        </div>
        <div className="stat">
          <span className="stat-label">Cilindros recalificados</span>
          <span className="stat-value">{count(board.summary.gnvRequalifications)}</span>
          <span className="stat-hint">último año publicado</span>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h3>Parque automotor nacional, 2003–2025</h3>
          <p className="panel-sub">
            Stock registrado al cierre de cada gestión; el último año es preliminar.
          </p>
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
      </div>
    </>
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
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Por departamento y servicio</h3>
        <p className="panel-sub">
          Total, particular, público y oficial para cada gestión publicada.
        </p>
      </div>
      <label className="field-label">
        Gestión{' '}
        <select value={year} onChange={(event) => setYear(event.target.value)}>
          {years.map((one) => (
            <option key={one}>{one}</option>
          ))}
        </select>
      </label>
      <div className="table-wrap">
        <table>
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
                <th>{label(department)}</th>
                <td>{count(at(department, 'TOTAL'))}</td>
                <td>{count(at(department, 'PARTICULAR'))}</td>
                <td>{count(at(department, 'PUBLICO'))}</td>
                <td>{count(at(department, 'OFICIAL'))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
      <div className="panel">
        <div className="panel-head">
          <h3>Historia por clase</h3>
          <p className="panel-sub">
            Automóvil, bus, microbús, minibús, camión, tractocamión, moto y más.
          </p>
        </div>
        <div className="chips">
          <select
            value={service}
            onChange={(event) => setService(event.target.value as FleetPoint['service'])}
          >
            {['PARTICULAR', 'PUBLICO', 'OFICIAL'].map((one) => (
              <option key={one}>{label(one)}</option>
            ))}
          </select>
          <select value={vehicleClass} onChange={(event) => setVehicleClass(event.target.value)}>
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
      </div>
      <div className="panel">
        <div className="panel-head">
          <h3>Composición {label(service)}, 2025</h3>
        </div>
        <div className="table-wrap">
          <table>
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
      </div>
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
  const annual = board.gnv.filter(
    (point) =>
      point.department === 'BOLIVIA' && point.vehicleClass === null && point.period.length === 4,
  );
  return (
    <div className="grid-two">
      <div className="panel">
        <div className="panel-head">
          <h3>Capacidad de carga, 2025</h3>
          <p className="panel-sub">Bandas en toneladas por servicio y clase.</p>
        </div>
        <div className="table-wrap">
          <table>
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
      </div>
      <div className="panel">
        <div className="panel-head">
          <h3>Actividad GNV</h3>
          <p className="panel-sub">
            Conversiones y recalificación de cilindros; también hay detalle trimestral,
            departamental y por clase en la descarga.
          </p>
        </div>
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
              label={metric}
              decimals={0}
              height="small"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Fares({ fares }: { fares: FareBand[] }) {
  const [regulation, setRegulation] = useState<FareBand['regulation']>('ATT_0032_2025');
  const [query, setQuery] = useState('');
  const shown = useMemo(
    () =>
      fares.filter(
        (band) =>
          band.regulation === regulation &&
          `${band.origin} ${band.destination}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [fares, regulation, query],
  );
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Pasajes interdepartamentales por ruta</h3>
        <p className="panel-sub">
          Bandas mínima/máxima de normal, semicama y cama. “—” significa no publicado, no cero.
        </p>
      </div>
      <div className="chips">
        <select
          value={regulation}
          onChange={(event) => setRegulation(event.target.value as FareBand['regulation'])}
        >
          <option value="ATT_0032_2025">ATT 32/2025 · 30 rutas</option>
          <option value="ATT_0178_2013">ATT 178/2013 · histórico</option>
        </select>
        <input
          aria-label="Buscar ruta"
          placeholder="Buscar origen o destino"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {regulation === 'ATT_0032_2025' ? (
        <div className="callout">
          La resolución fijó aplicación del 2 de enero al 30 de junio de 2026. La ATT aún la
          mostraba al recuperar su pizarra; se exponen ambas fechas sin presumir una vigencia
          posterior.
        </div>
      ) : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ruta</th>
              <th>Vía</th>
              <th>Normal</th>
              <th>Semicama</th>
              <th>Cama</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((band) => (
              <tr key={`${band.origin}-${band.destination}-${band.road}`}>
                <th>
                  {label(band.origin)} → {label(band.destination)}
                </th>
                <td>{label(band.road)}</td>
                <td>{fare(band.normalMin, band.normalMax)}</td>
                <td>{fare(band.semicamaMin, band.semicamaMax)}</td>
                <td>{fare(band.camaMin, band.camaMax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Sources({ board }: { board: RoadTransportBoard }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Fuentes, cobertura y límites</h3>
        <p className="panel-sub">
          Cada fila conserva editor, enlace y SHA-256; no se completan vacíos con estimaciones.
        </p>
      </div>
      <div className="table-wrap">
        <table>
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
    </div>
  );
}

export function RoadTransportExplorer({ board }: { board: RoadTransportBoard }) {
  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Transporte automotor y pasajes de Bolivia</h2>
          <p className="panel-sub">
            Parque 2003–2025, servicios, clases, buses, micros, minibuses, capacidad, GNV y tarifas
            oficiales.
          </p>
        </div>
        <Download dataset="transporte-terrestre" label="Descargar todo el dato terrestre" />
      </div>
      <SubTabs
        labels={[
          'Panorama',
          'Departamentos',
          'Clases y micros',
          'Capacidad y GNV',
          'Pasajes',
          'Fuentes',
        ]}
        icons={['linea', 'mapa', 'camion', 'cajas', 'etiqueta', 'hoja']}
      >
        <Panorama board={board} />
        <Departments fleet={board.fleet} />
        <Classes fleet={board.fleet} />
        <CapacityGnv board={board} />
        <Fares fares={board.fares} />
        <Sources board={board} />
      </SubTabs>
    </>
  );
}

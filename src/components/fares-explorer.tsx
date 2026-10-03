'use client';

import { useMemo, useState } from 'react';
import { Download } from './download';
import type { FareBand } from '@/lib/transport';

const label = (value: string | null): string => (value ?? 'TOTAL').replaceAll('_', ' ');
const fare = (min: number | null, max: number | null): string =>
  min === null || max === null ? '—' : `Bs ${min}–${max}`;

export function FaresExplorer({ fares }: { fares: FareBand[] }) {
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
  const currentCount = fares.filter((band) => band.regulation === 'ATT_0032_2025').length;
  const historicalCount = fares.filter((band) => band.regulation === 'ATT_0178_2013').length;

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Pasajes interdepartamentales por ruta</h2>
          <p className="panel-sub">
            Histórico oficial de la ATT: {historicalCount} rutas de 2013 y {currentCount} rutas de
            2025, con bandas mínima y máxima para servicio normal, semicama y cama.
          </p>
        </div>
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">Tarifario histórico</span>
            <span className="stat-value">2013</span>
            <span className="stat-hint">{historicalCount} rutas · ATT 178/2013</span>
          </div>
          <div className="stat">
            <span className="stat-label">Último tarifario publicado</span>
            <span className="stat-value">2025</span>
            <span className="stat-hint">{currentCount} rutas · ATT 32/2025</span>
          </div>
          <div className="stat">
            <span className="stat-label">Filas oficiales disponibles</span>
            <span className="stat-value">{fares.length}</span>
            <span className="stat-hint">sin completar vacíos con estimaciones</span>
          </div>
        </div>
        <Download dataset="transporte-terrestre" label="Descargar pasajes y transporte terrestre" />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Consultar precios de pasajes</h3>
          <p className="panel-sub">
            “—” significa no publicado, no cero. La vía nueva y la vía antigua se mantienen como
            filas separadas cuando la resolución fija precios distintos.
          </p>
        </div>
        <div className="chips">
          <select
            aria-label="Tarifario de pasajes"
            value={regulation}
            onChange={(event) => setRegulation(event.target.value as FareBand['regulation'])}
          >
            <option value="ATT_0032_2025">ATT 32/2025 · {currentCount} rutas</option>
            <option value="ATT_0178_2013">ATT 178/2013 · histórico · {historicalCount} rutas</option>
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
        ) : (
          <div className="callout">
            La resolución ATT 178/2013 comenzó a aplicarse el 2 de enero de 2014. Se conserva como
            antecedente histórico y no se presenta como tarifa vigente.
          </div>
        )}
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
                <tr key={`${band.regulation}-${band.origin}-${band.destination}-${band.road}`}>
                  <th>{label(band.origin)} → {label(band.destination)}</th>
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
    </>
  );
}

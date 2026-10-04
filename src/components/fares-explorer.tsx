'use client';

import { useMemo, useState } from 'react';
import { Panel } from '@/components/ui/panel';
import type { FareBand } from '@/lib/transport';

const SMALL = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

/** «SANTA_CRUZ» pasa a «Santa Cruz»: los nombres del tarifario llegan en mayúsculas y con guiones bajos. */
const label = (value: string | null): string =>
  (value ?? 'TOTAL')
    .replaceAll('_', ' ')
    .toLowerCase()
    .split(' ')
    .map((word, index) =>
      index > 0 && SMALL.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');

const ROAD: Record<FareBand['road'], string> = {
  DEFAULT: 'Única',
  NEW: 'Vía nueva',
  OLD: 'Vía antigua',
};

const fare = (min: number | null, max: number | null): string =>
  min === null || max === null ? '—' : `Bs ${min}–${max}`;

/** Quién fija cada tarifario: lo que dicen las propias filas, no un nombre supuesto. */
const SOURCE: Record<FareBand['regulation'], string> = {
  ATT_0032_2025:
    'Autoridad de Regulación y Fiscalización de Telecomunicaciones y Transportes (ATT), resolución LP 32/2025 y su anexo tarifario',
  ATT_0178_2013:
    'Bolivia es Turismo, transcripción de la resolución ATT 178/2013 (Autoridad de Regulación y Fiscalización de Telecomunicaciones y Transportes)',
};

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
  const year = regulation === 'ATT_0032_2025' ? '2025' : '2013';

  return (
    <Panel
      id="pasajes-por-ruta"
      className="transp"
      title={`Pasajes interdepartamentales por ruta, tarifario ${year} (Bs por pasaje)`}
      lede="Bandas mínima y máxima de la ATT para servicio normal, semicama y cama. «—» significa no publicado, no cero."
      meta={`${shown.length} de ${regulation === 'ATT_0032_2025' ? currentCount : historicalCount} filas`}
      source={SOURCE[regulation]}
      data={() => ({
        unidad: 'Bs por pasaje',
        columnas: [
          'Origen',
          'Destino',
          'Vía',
          'Normal mínimo (Bs)',
          'Normal máximo (Bs)',
          'Semicama mínimo (Bs)',
          'Semicama máximo (Bs)',
          'Cama mínimo (Bs)',
          'Cama máximo (Bs)',
          'Aplicación desde',
          'Aplicación hasta',
        ],
        filas: shown.map((band) => [
          label(band.origin),
          label(band.destination),
          ROAD[band.road],
          band.normalMin,
          band.normalMax,
          band.semicamaMin,
          band.semicamaMax,
          band.camaMin,
          band.camaMax,
          band.effectiveFrom,
          band.effectiveUntil,
        ]),
        nota: 'Un valor vacío es «no publicado», no cero.',
      })}
    >
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
      <p className="panel-note">
        La vía nueva y la vía antigua se mantienen como filas separadas cuando la resolución fija
        precios distintos.
      </p>
      <div className="table-wrap">
        <table className="grid-table">
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
                <th>
                  {label(band.origin)} → {label(band.destination)}
                </th>
                <td>{ROAD[band.road]}</td>
                <td>{fare(band.normalMin, band.normalMax)}</td>
                <td>{fare(band.semicamaMin, band.semicamaMax)}</td>
                <td>{fare(band.camaMin, band.camaMax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

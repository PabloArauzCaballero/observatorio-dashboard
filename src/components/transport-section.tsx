'use client';

import { OnOpenNotice, useOnOpen } from './on-open';
import { RailExplorer } from './rail-explorer';
import { RoadsSection } from './roads-section';
import { SubSections } from './site-layout';
import { WaterwaysExplorer } from './waterways-explorer';
import { TabHeader } from '@/components/ui/tab-header';
import { RoadTransportSection } from './road-transport-section';
import { FreightSection } from './freight-section';
import { FaresSection } from './fares-section';
import type { RailBoard, WaterBoard } from '@/lib/transport-board';

/**
 * El capítulo de transporte: automotor, pasajes, infraestructura y fletes, seis páginas.
 *
 * Cada página pide su tablero al abrirse y no antes, como hacía «Carreteras»
 * sola: `SubSections` monta cada página al acercarse, así que abrir el capítulo no
 * trae la red fluvial de nadie que no la mire.
 */
export function TransportSection() {
  return (
    <>
      <TabHeader
        id="transporte"
        title="Transporte"
        lede="Vehículos, pasajes, carreteras, trenes, ríos y fletes de Bolivia. Las cifras de vehículos y tarifas son oficiales; los mapas muestran lo que OpenStreetMap ha trazado, que no es un inventario oficial."
      />
      <SubSections
        labels={['Automotor', 'Pasajes', 'Carreteras', 'Ferrocarriles', 'Ríos y puertos', 'Fletes']}
        icons={['camion', 'etiqueta', 'mapa', 'linea', 'gota', 'cajas']}
        enlace
      >
        <RoadTransportSection />
        <FaresSection />
        <RoadsSection />
        <RailSection />
        <WaterwaysSection />
        <FreightSection />
      </SubSections>
    </>
  );
}

function RailSection() {
  const { payload, failed } = useOnOpen<{ board: RailBoard }>('/api/ferrocarriles');
  if (!payload) return <OnOpenNotice what="la red ferroviaria" failed={failed} />;
  if (!payload.board.lines.length) {
    return (
      <div className="callout">
        Todavía no hay vías férreas cargadas. La página se llena cuando el núcleo haya sembrado la
        red ferroviaria (catálogo «bolivia-transport-network»).
      </div>
    );
  }
  return <RailExplorer board={payload.board} />;
}

function WaterwaysSection() {
  const { payload, failed } = useOnOpen<{ board: WaterBoard }>('/api/rios');
  if (!payload) return <OnOpenNotice what="la red fluvial" failed={failed} />;
  if (!payload.board.waterways.length) {
    return (
      <div className="callout">
        Todavía no hay ríos cargados. La página se llena cuando el núcleo haya sembrado la red
        fluvial (catálogo «bolivia-transport-network»).
      </div>
    );
  }
  return <WaterwaysExplorer board={payload.board} />;
}

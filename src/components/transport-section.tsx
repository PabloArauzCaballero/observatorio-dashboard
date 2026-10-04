'use client';

import { OnOpenNotice, useOnOpen } from './on-open';
import { RailExplorer } from './rail-explorer';
import { RoadsSection } from './roads-section';
import { SubSections } from './site-layout';
import { FuelPricesExplorer, PassengerFaresExplorer, VehiclePricesExplorer } from './transport-prices-explorer';
import { TabHeader } from '@/components/ui/tab-header';
import { WaterwaysExplorer } from './waterways-explorer';
import type { RailBoard, WaterBoard } from '@/lib/transport-board';

/**
 * El capítulo de transporte: carreteras, ferrocarriles y ríos, tres páginas.
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
        lede="Precios de vehículos, carburantes y pasajes, junto a carreteras, trenes y ríos de Bolivia. Cada precio conserva su fuente y fecha."
      />
      <SubSections
        labels={['Carreteras', 'Ferrocarriles', 'Ríos y puertos', 'Vehículos 0 km', 'Carburantes', 'Pasajes']}
        icons={['camion', 'linea', 'gota', 'camion', 'gota', 'etiqueta']}
        enlace
      >
        <RoadsSection />
        <RailSection />
        <WaterwaysSection />
        <VehiclePricesExplorer />
        <FuelPricesExplorer />
        <PassengerFaresExplorer />
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

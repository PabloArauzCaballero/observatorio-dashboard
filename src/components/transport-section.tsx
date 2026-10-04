'use client';

import { OnOpenNotice, useOnOpen } from './on-open';
import { RailExplorer } from './rail-explorer';
import { RoadsSection } from './roads-section';
import { SubSections } from './site-layout';
import { FuelPricesExplorer, PassengerFaresExplorer, VehiclePricesExplorer } from './transport-prices-explorer';
import { WaterwaysExplorer } from './waterways-explorer';
import { TabHeader } from '@/components/ui/tab-header';
import { RoadTransportSection } from './road-transport-section';
import { FreightSection } from './freight-section';
import { FaresSection } from './fares-section';
import { AutomotiveMarket } from './automotive-market';
import { AutomotiveCompetition } from './automotive-competition';
import { AutomotiveInternational } from './automotive-international';
import { AutomotiveScenarios } from './automotive-scenarios';
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
        lede="Mercado automotor, pasajes e infraestructura de Bolivia. Parque y tarifas de fuentes oficiales; precios de anuncios comerciales y análisis empresarial con sus condiciones. Los mapas recogen lo trazado en OpenStreetMap."
      />
      <SubSections
        labels={['Automotor', 'Vehículos 0 km', 'Estudio automotor', 'Competencia automotriz', 'Precios internacionales', 'Escenarios automotores', 'Carburantes', 'Pasajes', 'Tarifas publicadas', 'Carreteras', 'Ferrocarriles', 'Ríos y puertos', 'Fletes']}
        icons={['camion', 'camion', 'camion', 'camion', 'etiqueta', 'barras', 'gota', 'etiqueta', 'etiqueta', 'mapa', 'linea', 'gota', 'cajas']}
        enlace
      >
        <RoadTransportSection />
        <VehiclePricesExplorer />
        <AutomotiveMarket />
        <AutomotiveCompetition />
        <AutomotiveInternational />
        <AutomotiveScenarios />
        <FuelPricesExplorer />
        <FaresSection />
        <PassengerFaresExplorer />
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

'use client';

import { OnOpenNotice, useOnOpen } from './on-open';
import { RailExplorer } from './rail-explorer';
import { RoadsSection } from './roads-section';
import { SubSections } from './site-layout';
import { SubTabs } from './tabs';
import {
  FuelPricesExplorer,
  PassengerFaresExplorer,
  VehiclePricesExplorer,
} from './transport-prices-explorer';
import { WaterwaysExplorer } from './waterways-explorer';
import { TabHeader } from '@/components/ui/tab-header';
import { RoadTransportSection } from './road-transport-section';
import { FreightSection } from './freight-section';
import { FaresSection } from './fares-section';
import { AutomotiveStudyPage } from './automotive-study-page';
import type { RailBoard, WaterBoard } from '@/lib/transport-board';

/**
 * El capítulo de transporte: cuatro páginas en el índice y, dentro de cada una, sus pestañas.
 *
 * Eran diez entradas en el índice lateral, que era más lista que capítulo. Ahora el índice dice
 * «qué hay» en cuatro líneas y cada página abre en la pestaña de siempre; una barra de pestañas
 * monta solo la activa, así que agrupar no trae más datos de una vez. Los enlaces viejos
 * (`?pagina=pasajes`) siguen valiendo: el mapa los lleva a la página que los absorbió y su barra
 * los reconoce por alias.
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
        labels={['Parque y mercado', 'Combustible y pasajes', 'Infraestructura', 'Fletes']}
        icons={['camion', 'gota', 'mapa', 'cajas']}
        enlace
      >
        <ParqueYMercado />
        <CombustibleYPasajes />
        <Infraestructura />
        <FreightSection />
      </SubSections>
    </>
  );
}

function ParqueYMercado() {
  return (
    <SubTabs
      labels={['Automotor', 'Vehículos 0 km', 'Estudio automotor']}
      icons={['camion', 'camion', 'barras']}
      enlace
      alias={{
        'competencia-automotriz': 'Estudio automotor',
        'precios-internacionales': 'Estudio automotor',
        'escenarios-automotores': 'Estudio automotor',
      }}
    >
      <RoadTransportSection />
      <VehiclePricesExplorer />
      <AutomotiveStudyPage />
    </SubTabs>
  );
}

function CombustibleYPasajes() {
  return (
    <SubTabs
      labels={['Carburantes', 'Pasajes', 'Tarifas publicadas']}
      icons={['gota', 'etiqueta', 'etiqueta']}
      enlace
    >
      <FuelPricesExplorer />
      <FaresSection />
      <PassengerFaresExplorer />
    </SubTabs>
  );
}

function Infraestructura() {
  return (
    <SubTabs
      labels={['Carreteras', 'Ferrocarriles', 'Ríos y puertos']}
      icons={['mapa', 'linea', 'gota']}
      enlace
    >
      <RoadsSection />
      <RailSection />
      <WaterwaysSection />
    </SubTabs>
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

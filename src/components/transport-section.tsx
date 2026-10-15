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
import { ROAD_PAGES, RoadTransportPage } from './road-transport-explorer';
import { FreightSection } from './freight-section';
import { FaresSection } from './fares-section';
import { AutomotiveStudyPage } from './automotive-study-page';
import type { RoadTransportBoard } from '@/lib/road-transport-board';
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
        lede="Parque automotor, precios de vehículos y combustibles, pasajes, fletes e infraestructura de Bolivia. El parque y las tarifas provienen de fuentes oficiales; los precios de vehículos, de anuncios comerciales, y los mapas de la red, de OpenStreetMap."
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

/**
 * Parque y mercado: una sola fila de pestañas.
 *
 * El parque automotor (Panorama, Departamentos, Clases, Capacidad, Fuentes) tenía sus
 * propias pestañas bajo la barra de página, y la página enseñaba dos filas apiladas. Ahora
 * son siete pestañas de una barra: las del parque, y junto a ellas «Vehículos 0 km» y
 * «Estudio automotor». El tablero del parque se lee una vez aquí y cada pestaña dibuja la
 * suya; las otras dos no lo necesitan y no esperan por él.
 */
function ParqueYMercado() {
  const { payload, failed } = useOnOpen<{ board: RoadTransportBoard }>('/api/transporte-terrestre');
  const parque = (page: (typeof ROAD_PAGES)[number]['key']) => {
    if (!payload) return <OnOpenNotice what="el parque automotor" failed={failed} />;
    if (!payload.board.fleet.length) {
      return (
        <div className="callout">
          Todavía no hay datos históricos del parque automotor.
        </div>
      );
    }
    return <RoadTransportPage board={payload.board} page={page} />;
  };
  return (
    <SubTabs
      labels={[
        'Panorama',
        'Departamentos',
        'Clases y micros',
        'Capacidad y GNV',
        'Vehículos 0 km',
        'Estudio automotor',
        'Fuentes del parque',
      ]}
      icons={['linea', 'mapa', 'camion', 'cajas', 'camion', 'barras', 'hoja']}
      enlace
      alias={{
        automotor: 'Panorama',
        'competencia-automotriz': 'Estudio automotor',
        'precios-internacionales': 'Estudio automotor',
        'escenarios-automotores': 'Estudio automotor',
      }}
    >
      {parque('panorama')}
      {parque('departamentos')}
      {parque('clases')}
      {parque('capacidad')}
      <VehiclePricesExplorer />
      <AutomotiveStudyPage />
      {parque('fuentes')}
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
        Todavía no hay datos de la red ferroviaria. La página se completará cuando se cargue su
        trazado.
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
        Todavía no hay datos de la red fluvial. La página se completará cuando se cargue su
        trazado.
      </div>
    );
  }
  return <WaterwaysExplorer board={payload.board} />;
}

'use client';

import { AccountsSection } from './accounts-section';
import { BcbSection } from './bcb-section';
import { DepartmentsSection } from './departments-section';
import { EnergySection } from './energy-section';
import { EnvironmentSection } from './environment-section';
import dynamic from 'next/dynamic';
import { ExogenousSection } from './exogenous-section';
import { ForeignTradeSection } from './foreign-trade-section';
import { InstitutionsExplorer } from './institutions-explorer';
import { MacroExplorer } from './macro-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import { PanelSection } from './panel-section';
import { ResourcesSection } from './resources-section';
import { SubSections } from './site-layout';
import { TradeRecordsSection } from './trade-records-section';
import { WorldExplorer } from './world-explorer';
import { TabHeader } from '@/components/ui/tab-header';
import type { InstitutionsBoard } from '@/lib/institutions-board';
import type { MacroBundle } from '@/lib/macro-transport';

/**
 * El capítulo de macroeconomía y del sector externo.
 *
 * Tres y no una. «Series de Bolivia» son las que el observatorio mide una por
 * una; «Social Info» es el WDI entero recortado a Bolivia —salud, educación,
 * pobreza, empleo—, para la cifra que las primeras no tienen; «Bolivia ante
 * el mundo» pone a Bolivia al lado del mundo y de su región —el nombre dice
 * desde dónde se mira: es la lectura de Bolivia frente al mundo, no la del
 * mundo a secas—. Las dos primeras
 * estuvieron mezcladas —promediadas, de hecho— hasta la migración 0077.
 *
 * La matriz energética y los índices que califican la libertad tuvieron su
 * propia pestaña arriba durante un día. No la necesitan: cada uno es una lectura
 * del corpus que su panel ya recorre, así que entran como el último rubro de la
 * lista de la izquierda, donde el lector ya está eligiendo de qué quiere leer.
 * Nueve pestañas arriba eran más de las que caben en una pantalla, y las dos
 * nuevas —las que nadie sabía que existían— eran justo las que se perdían.
 *
 * «Variables exógenas» es la cuarta: los precios que Bolivia no fija —crudo,
 * metales, granos, carne, resinas, cemento— y que le mueven la economía desde
 * fuera. Es una pestaña y no un rubro invitado porque no lee el panel de
 * medidas: trae su propio corpus mensual y sus propios filtros.
 *
 * «Comercio exterior» resume qué vende y compra Bolivia, con quién comercia
 * y quién exporta; «Detalle aduanero (INE)» permite cruzar partida, país,
 * departamento y mes. Ambas pertenecen aquí porque describen el sector
 * externo de la economía, no el registro o la reputación de las empresas.
 *
 * Las páginas se piden solas al acercarse. `SubSections` monta únicamente la página
 * que el lector alcanza, así que abrir «Macroeconomía» pide las medidas de Bolivia y nada más:
 * el panel del Banco Mundial y el tablero mundial esperan a que alguien los
 * elija, como ya hacían, y ahora las medidas también.
 */
export function MacroSection() {
  return (
    <>
      <TabHeader
        id="macroeconomia"
        title="Macroeconomía"
        lede="Las series anuales de Bolivia, su comparación con el mundo y su comercio exterior. Cada cifra dice quién la publica; lo que calcula el Observatorio se dice aparte."
      />
      <SubSections
        enlace
        labels={[
          'Series de Bolivia',
          'Social Info',
          'Bolivia ante el mundo',
          'Variables exógenas',
          'Factores externos',
          'Series del BCB',
          'Comercio exterior',
          'Detalle aduanero (INE)',
        ]}
        icons={['linea', 'capas', 'globo', 'monedas', 'linea', 'banco', 'globo', 'cajas']}
      >
        <MeasuresPanel />
        <PanelSection
          guests={[{ label: 'Instituciones', icon: 'escudo', panel: <InstitutionsPanel /> }]}
        />
        <WorldExplorer />
        <ExogenousSection />
        <ExogenousFactorsExplorer />
        <BcbSection />
        <ForeignTradeSection />
        <TradeRecordsSection />
      </SubSections>
    </>
  );
}

/** Las series de factores externos y su comparación; pesan (gráficos), así que se piden al abrir la página. */
const ExogenousFactorsExplorer = dynamic(
  () => import('./exogenous-factors-explorer').then((module) => module.ExogenousFactorsExplorer),
  { loading: () => <OnOpenNotice what="los factores externos" failed={false} /> },
);

/**
 * Lo que el observatorio mide de Bolivia, con tres rubros invitados.
 *
 * Los tres cuelgan juntos porque son tres preguntas sobre la misma cosa: qué
 * saca el país de su territorio, qué quema con ello y qué deja a cambio. Un
 * lector que encuentra uno encuentra los otros dos, que es exactamente lo que
 * no pasaba cuando la energía vivía en una pestaña propia arriba.
 *
 * Los tres leen el panel del Banco Mundial y ninguno toca el paquete de
 * medidas anuales que este panel dibuja: cada uno pide su propia dirección al
 * abrirse, y la lectura del panel está sostenida en memoria con una clave que
 * lleva los códigos pedidos, así que no se pisan entre ellos.
 */
function MeasuresPanel() {
  const { payload, failed } = useOnOpen<{ bundle: MacroBundle }>('/api/medidas');

  if (!payload) return <OnOpenNotice what="las medidas anuales" failed={failed} />;

  return (
    <MacroExplorer
      bundle={payload.bundle}
      guests={[
        /*
         * «Departamentos» va primero de los cuatro, y no por orden alfabético.
         * Los otros tres son recortes temáticos del panel del Banco Mundial
         * sobre el mismo país; este cambia la unidad de análisis. Un lector que
         * llega a «Series de Bolivia» y no encuentra arriba la pregunta «¿dónde?»
         * asume que el tablero no la contesta, que es lo que pasaba hasta hoy.
         */
        { label: 'Departamentos', icon: 'mapa', panel: <DepartmentsSection /> },
        /*
         * «Cuentas públicas» va segundo: es el otro rubro que mira al Estado y no al territorio.
         * Lee su propia vista y no el panel del Banco Mundial, pero cuelga de la misma barra de
         * «Desde» y de la misma lista donde el lector ya está eligiendo de qué quiere leer.
         */
        { label: 'Cuentas públicas', icon: 'balanza', panel: <AccountsSection /> },
        { label: 'Energía', icon: 'rayo', panel: <EnergySection /> },
        { label: 'Recursos naturales', icon: 'gema', panel: <ResourcesSection /> },
        { label: 'Medio ambiente', icon: 'hoja', panel: <EnvironmentSection /> },
      ]}
    />
  );
}

/**
 * Los índices que califican la libertad, invitados en «Social Info».
 *
 * Pide la misma dirección que las medidas y toma de ella otra mitad: el tablero
 * se construye de las filas del sector `INSTITUCIONAL`, que son de esa misma
 * lectura. Dos peticiones a una dirección que se deja guardar diez minutos son
 * una sola consulta, así que abrir los dos rubros no cuesta el doble.
 */
function InstitutionsPanel() {
  const { payload, failed } = useOnOpen<{ institutions: InstitutionsBoard }>('/api/medidas');

  if (!payload) return <OnOpenNotice what="los índices institucionales" failed={failed} />;

  return <InstitutionsExplorer board={payload.institutions} />;
}

'use client';

import { DepartmentsSection } from './departments-section';
import { EnergySection } from './energy-section';
import { EnvironmentSection } from './environment-section';
import { ExogenousSection } from './exogenous-section';
import { InstitutionsExplorer } from './institutions-explorer';
import { MacroExplorer } from './macro-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import { PanelSection } from './panel-section';
import { ResourcesSection } from './resources-section';
import { SubTabs } from './tabs';
import { WorldExplorer } from './world-explorer';
import type { InstitutionsBoard } from '@/lib/institutions-board';
import type { MacroBundle } from '@/lib/macro-transport';

/**
 * El capítulo de macroeconomía, con sus tres lecturas.
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
 * Las cuatro se piden solas al abrirse. `SubTabs` monta únicamente la página
 * activa, así que abrir «Macroeconomía» pide las medidas de Bolivia y nada más:
 * el panel del Banco Mundial y el tablero mundial esperan a que alguien los
 * elija, como ya hacían, y ahora las medidas también.
 */
export function MacroSection() {
  return (
    <SubTabs
      labels={['Series de Bolivia', 'Social Info', 'Bolivia ante el mundo', 'Variables exógenas']}
      icons={['linea', 'capas', 'globo', 'monedas']}
    >
      <MeasuresPanel />
      <PanelSection
        guests={[{ label: 'Instituciones', icon: 'escudo', panel: <InstitutionsPanel /> }]}
      />
      <WorldExplorer />
      <ExogenousSection />
    </SubTabs>
  );
}

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

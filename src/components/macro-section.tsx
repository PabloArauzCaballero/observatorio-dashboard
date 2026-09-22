'use client';

import { EnergySection } from './energy-section';
import { InstitutionsExplorer } from './institutions-explorer';
import { MacroExplorer } from './macro-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import { PanelSection } from './panel-section';
import { SubTabs } from './tabs';
import { WorldExplorer } from './world-explorer';
import type { InstitutionsBoard } from '@/lib/institutions-board';
import type { MacroBundle } from '@/lib/macro-transport';

/**
 * El capítulo de macroeconomía, con sus tres lecturas.
 *
 * Tres y no una. «Series de Bolivia» son las que el observatorio mide una por
 * una; «Social Info» es el WDI entero recortado a Bolivia —salud, educación,
 * pobreza, empleo—, para la cifra que las primeras no tienen; «Economía
 * mundial» pone a Bolivia al lado del mundo y de su región. Las dos primeras
 * estuvieron mezcladas —promediadas, de hecho— hasta la migración 0077.
 *
 * La matriz energética y los índices que califican la libertad tuvieron su
 * propia pestaña arriba durante un día. No la necesitan: cada uno es una lectura
 * del corpus que su panel ya recorre, así que entran como el último rubro de la
 * lista de la izquierda, donde el lector ya está eligiendo de qué quiere leer.
 * Nueve pestañas arriba eran más de las que caben en una pantalla, y las dos
 * nuevas —las que nadie sabía que existían— eran justo las que se perdían.
 *
 * Las tres se piden solas al abrirse. `SubTabs` monta únicamente la página
 * activa, así que abrir «Macroeconomía» pide las medidas de Bolivia y nada más:
 * el panel del Banco Mundial y el tablero mundial esperan a que alguien los
 * elija, como ya hacían, y ahora las medidas también.
 */
export function MacroSection() {
  return (
    <SubTabs
      labels={['Series de Bolivia', 'Social Info', 'Economía mundial']}
      icons={['linea', 'capas', 'globo']}
    >
      <MeasuresPanel />
      <PanelSection guest={{ label: 'Instituciones', icon: 'escudo', panel: <InstitutionsPanel /> }} />
      <WorldExplorer />
    </SubTabs>
  );
}

/** Lo que el observatorio mide de Bolivia, con la energía como rubro invitado. */
function MeasuresPanel() {
  const { payload, failed } = useOnOpen<{ bundle: MacroBundle }>('/api/medidas');

  if (!payload) return <OnOpenNotice what="las medidas anuales" failed={failed} />;

  return (
    <MacroExplorer
      bundle={payload.bundle}
      guest={{ label: 'Energía', icon: 'rayo', panel: <EnergySection /> }}
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

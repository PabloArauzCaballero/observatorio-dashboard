'use client';

import { RoadsExplorer } from './roads-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { RoadBoard } from '@/lib/roads-board';

/**
 * El capítulo de carreteras, pedido al abrirse.
 *
 * Componente de cliente y no de servidor, por la razón que da `on-open`: un
 * panel escondido se dibuja en el servidor igual que uno visible, así que
 * escrito como componente de servidor su consulta correría en cada carga de
 * la portada aunque nadie abriera «Carreteras».
 */
export function RoadsSection() {
  const { payload, failed } = useOnOpen<{ board: RoadBoard }>('/api/carreteras');

  if (!payload) return <OnOpenNotice what="la red vial" failed={failed} />;

  if (!payload.board.sections.length) {
    return (
      <div className="callout">
        Todavía no hay tramos de la red vial cargados. El capítulo se llena solo cuando el núcleo
        haya sembrado la siembra de la red vial.
      </div>
    );
  }

  return <RoadsExplorer board={payload.board} />;
}

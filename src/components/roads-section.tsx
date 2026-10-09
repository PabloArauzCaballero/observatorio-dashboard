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
        No hay tramos de la red vial disponibles en este momento.
      </div>
    );
  }

  return <RoadsExplorer board={payload.board} />;
}

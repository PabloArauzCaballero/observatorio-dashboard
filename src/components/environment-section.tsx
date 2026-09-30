'use client';

import { EnvironmentExplorer } from './environment-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { EnvironmentBoard } from '@/lib/environment-board';

/**
 * El capítulo ambiental, pedido al abrirse.
 *
 * Mismo trato que el de recursos: componente de cliente, una sola petición al
 * montarse, y lo que viaja es el tablero ya armado y no las filas del panel.
 */
export function EnvironmentSection() {
  const { payload, failed } = useOnOpen<{ board: EnvironmentBoard }>('/api/ambiente');

  if (!payload) return <OnOpenNotice what="el capítulo de medio ambiente" failed={failed} />;

  if (!Object.keys(payload.board.series).length) {
    return (
      <div className="callout">
        Todavía no hay series ambientales leídas del panel del Banco Mundial. El capítulo se llena
        solo cuando el núcleo las tenga cargadas.
      </div>
    );
  }

  return <EnvironmentExplorer board={payload.board} />;
}

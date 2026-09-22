'use client';

import { OnOpenNotice, useOnOpen } from './on-open';
import { ResourcesExplorer } from './resources-explorer';
import type { ResourceBoard } from '@/lib/resources-board';

/**
 * El capítulo de recursos naturales, pedido al abrirse.
 *
 * Componente de cliente y no de servidor, por la razón que da `on-open`: un
 * panel escondido se dibuja en el servidor igual que uno visible, así que
 * escrito como componente de servidor su consulta correría en cada carga de la
 * portada aunque nadie abriera la pestaña de Macroeconomía.
 *
 * El tablero llega ya armado desde `/api/recursos`: lo que viaja son las
 * cifras del capítulo y no las filas del panel del Banco Mundial que las arman.
 */
export function ResourcesSection() {
  const { payload, failed } = useOnOpen<{ board: ResourceBoard }>('/api/recursos');

  if (!payload) return <OnOpenNotice what="el capítulo de recursos naturales" failed={failed} />;

  if (!Object.keys(payload.board.series).length) {
    return (
      <div className="callout">
        Todavía no hay series de recursos naturales leídas del panel del Banco Mundial. El capítulo
        se llena solo cuando el núcleo las tenga cargadas.
      </div>
    );
  }

  return <ResourcesExplorer board={payload.board} />;
}

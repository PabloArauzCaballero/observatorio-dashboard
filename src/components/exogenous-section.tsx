'use client';

import { ExogenousExplorer } from './exogenous-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { ExogenousBoard } from '@/lib/exogenous-board';

/**
 * La pestaña de variables exógenas, pedida al abrirse.
 *
 * Como el resto de las páginas de Macroeconomía, no se pide hasta que el
 * lector la elige: `SubTabs` monta sólo la página activa.
 */
export function ExogenousSection() {
  const { payload, failed } = useOnOpen<{ board: ExogenousBoard }>('/api/exogenas');

  if (!payload) return <OnOpenNotice what="las variables exógenas" failed={failed} />;

  if (!payload.board.series.length) {
    return (
      <div className="callout">
        Todavía no hay precios cargados. La pestaña se llena sola cuando el núcleo del observatorio
        tenga sembradas las variables exógenas (migración 0086 y catálogo «exogenous-prices»).
      </div>
    );
  }

  return <ExogenousExplorer board={payload.board} />;
}

'use client';

import { BusinessOwnersExplorer } from './business-owners-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { OwnersBoard } from '@/lib/business-owners-board';

/** «Empresas › Empresarios», pedido al abrir su página. */
export function BusinessOwnersSection() {
  const { payload, failed } = useOnOpen<{ board: OwnersBoard }>('/api/empresarios');
  if (!payload) return <OnOpenNotice what="el registro de empresarios" failed={failed} />;
  const board = payload.board;
  if (!board.estimates.length && !board.forbes.length && !board.wealthTax.length) {
    return (
      <div className="callout">
        Todavía no hay datos de empresarios. La página se completa cuando se cargan las participaciones
        accionarias, «Las 500» y las fortunas publicadas.
      </div>
    );
  }
  return <BusinessOwnersExplorer board={board} />;
}

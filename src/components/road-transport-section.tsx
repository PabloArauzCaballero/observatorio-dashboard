'use client';

import { OnOpenNotice, useOnOpen } from './on-open';
import { RoadTransportExplorer } from './road-transport-explorer';
import type { RoadTransportBoard } from '@/lib/road-transport-board';

export function RoadTransportSection() {
  const { payload, failed } = useOnOpen<{ board: RoadTransportBoard }>('/api/transporte-terrestre');
  if (!payload) return <OnOpenNotice what="el parque automotor" failed={failed} />;
  if (!payload.board.fleet.length)
    return (
      <div className="callout">
        Todavía no se cargó la fotografía histórica del transporte terrestre.
      </div>
    );
  return <RoadTransportExplorer board={payload.board} />;
}

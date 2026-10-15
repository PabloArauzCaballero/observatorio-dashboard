'use client';

import { FaresExplorer } from './fares-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { RoadTransportBoard } from '@/lib/road-transport-board';

export function FaresSection() {
  const { payload, failed } = useOnOpen<{ board: RoadTransportBoard }>('/api/transporte-terrestre');
  if (!payload) return <OnOpenNotice what="los precios históricos de pasajes" failed={failed} />;
  if (!payload.board.fares.length) {
    return <div className="callout">No hay tarifarios de pasajes disponibles.</div>;
  }
  return <FaresExplorer fares={payload.board.fares} />;
}

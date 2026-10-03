'use client';

import { ExogenousExplorer } from './exogenous-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { ExogenousBoard } from '@/lib/exogenous-board';

export function FreightSection() {
  const { payload, failed } = useOnOpen<{ board: ExogenousBoard }>('/api/exogenas');
  if (!payload) return <OnOpenNotice what="los precios y referencias de fletes" failed={failed} />;
  return <ExogenousExplorer board={payload.board} fixedGroup="FREIGHT" />;
}

'use client';

import { LargestCompaniesExplorer } from './largest-companies-explorer';
import type { CrossLinks } from './largest-companies-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { LargestBoard } from '@/lib/largest-companies-board';

/** «Empresas › Principales empresas», pedido al abrir su página. */
export function LargestCompaniesSection() {
  const { payload, failed } = useOnOpen<{ board: LargestBoard; links: Record<string, CrossLinks>; exportYear: number | null }>(
    '/api/principales-empresas',
  );
  if (!payload) return <OnOpenNotice what="el ránking de empresas" failed={failed} />;
  if (!payload.board.companies.length) {
    return (
      <div className="callout">
        Todavía no hay ránking de empresas cargado. La página se llena sola cuando el núcleo haya sembrado las memorias de
        Impuestos y «Las 500».
      </div>
    );
  }
  return <LargestCompaniesExplorer board={payload.board} links={payload.links} exportYear={payload.exportYear} />;
}

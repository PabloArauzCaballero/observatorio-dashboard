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
  if (!payload) return <OnOpenNotice what="la clasificación de empresas" failed={failed} />;
  if (!payload.board.companies.length) {
    return (
      <div className="callout">
        Todavía no hay datos de las principales empresas. La página se completa cuando se cargan las memorias de
        Impuestos Nacionales y «Las 500».
      </div>
    );
  }
  return <LargestCompaniesExplorer board={payload.board} links={payload.links} exportYear={payload.exportYear} />;
}

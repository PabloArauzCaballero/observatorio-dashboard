'use client';

import { BusinessFabricExplorer } from './business-fabric-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { FabricBoard } from '@/lib/business-fabric-board';

/**
 * «Empresas › Tejido empresarial», pedido al abrir su página.
 *
 * Vacío no es un fallo: el tablero se despliega desde un repositorio distinto
 * del que migra y siembra, y entre un despliegue y el otro el registro puede no
 * estar todavía.
 */
export function BusinessFabricSection() {
  const { payload, failed } = useOnOpen<{ board: FabricBoard }>('/api/tejido-empresarial');
  if (!payload) return <OnOpenNotice what="el tejido empresarial" failed={failed} />;
  if (!payload.board.firms.length && !payload.board.taxRoll.length) {
    return (
      <div className="callout">
        Todavía no hay base empresarial cargada. La página se llena sola cuando el núcleo haya sembrado el registro de
        comercio y el padrón de Impuestos.
      </div>
    );
  }
  return <BusinessFabricExplorer board={payload.board} />;
}

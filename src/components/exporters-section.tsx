'use client';

import { OnOpenNotice, useOnOpen } from './on-open';
import { ReputationExplorer } from './reputation-explorer';
import type { ExportersBoard } from '@/lib/exporters-board';

/**
 * El monitor de reputación empresarial.
 *
 * Antes compartía archivo con «Exportadoras», que ahora vive fusionada en
 * «Comercio exterior» (`foreign-trade-section.tsx`, `foreign-trade-explorer.tsx`)
 * porque exportar y comerciar son la misma pregunta para el lector. La
 * reputación queda aparte porque mide otra cosa —percepción, por encuestas—
 * y no comercio; pero sigue pidiendo `/api/exportadoras`, la misma dirección,
 * porque el cruce entre las dos listas se calcula en el núcleo con las dos
 * mitades a la vez y no vale la pena abrir dos rutas para repartirlas. Con
 * `Cache-Control: private, max-age=600`, si «Comercio exterior» ya se abrió
 * primero esta página sale de la caché del navegador sin volver al servidor.
 *
 * Vacío no es un fallo: el tablero se despliega desde un repositorio distinto
 * del que migra y siembra, y entre un despliegue y el otro esta serie puede
 * no estar todavía.
 */

const ROUTE = '/api/exportadoras';

/** El monitor de reputación, pedido al abrir su página. */
export function ReputationSection() {
  const { payload, failed } = useOnOpen<{ board: ExportersBoard }>(ROUTE);

  if (!payload) return <OnOpenNotice what="el monitor de reputación empresarial" failed={failed} />;

  if (!payload.board.general.length && !payload.board.sectors.length) {
    return (
      <div className="callout">
        Todavía no hay monitor de reputación cargado. La página se llena sola cuando el núcleo haya
        sembrado las ediciones de Merco.
      </div>
    );
  }

  return <ReputationExplorer board={payload.board} />;
}

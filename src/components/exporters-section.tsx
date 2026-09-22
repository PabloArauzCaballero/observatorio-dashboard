'use client';

import { ExportersExplorer } from './exporters-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { ExportersBoard } from '@/lib/exporters-board';

/**
 * Las exportadoras y su reputación, pedidas al abrir su página.
 *
 * Es la segunda página de «Empresas» y la mayoría de las visitas no llega a
 * ella, así que se pide cuando alguien la elige y no antes: `SubTabs` monta
 * únicamente la página activa, que es lo que permite que esto no cueste nada
 * mientras nadie mire.
 *
 * Vacío no es un fallo. El tablero se despliega desde un repositorio distinto
 * del que migra y siembra: entre un despliegue y el otro estas series no están
 * todavía, y el lector merece saber que el capítulo espera datos en vez de
 * encontrarse una pantalla en blanco que parece rota.
 */
export function ExportersSection() {
  const { payload, failed } = useOnOpen<{ board: ExportersBoard }>('/api/exportadoras');

  if (!payload) return <OnOpenNotice what="el registro de exportadoras" failed={failed} />;

  if (!payload.board.exporters.length && !payload.board.general.length) {
    return (
      <div className="callout">
        Todavía no hay registro de exportadoras ni de reputación cargado. El capítulo se llena solo
        cuando el núcleo haya sembrado las dos listas.
      </div>
    );
  }

  return <ExportersExplorer board={payload.board} />;
}

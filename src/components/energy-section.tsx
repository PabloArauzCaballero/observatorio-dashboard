'use client';

import { EnergyExplorer } from './energy-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { EnergyBoard } from '@/lib/energy-board';

/**
 * The energy chapter, read from the World Bank panel the core already holds.
 *
 * One query for the codes and places the board names; the rows were in the
 * database all along, filed under fifteen hundred other series nobody had
 * drawn together. The board is built on the server, so what reaches the browser
 * is the chapter's figures and not the whole panel.
 *
 * Se pide al abrirlo y no antes. Era un componente de servidor, y eso quería
 * decir que su consulta corría en **cada** carga de la portada aunque nadie
 * abriera la pestaña de Macroeconomía —un panel escondido se dibuja en el
 * servidor igual que uno visible—. Es el último rubro de la lista de la
 * izquierda de una de siete pestañas.
 */
export function EnergySection() {
  const { payload, failed } = useOnOpen<{ board: EnergyBoard }>('/api/energia');

  if (!payload) return <OnOpenNotice what="la matriz energética" failed={failed} />;

  if (!Object.keys(payload.board.series).length) {
    return (
      <div className="callout">
        Todavía no hay series de energía leídas del panel del Banco Mundial. El capítulo se llena
        solo cuando el núcleo las tenga cargadas.
      </div>
    );
  }

  return <EnergyExplorer board={payload.board} />;
}

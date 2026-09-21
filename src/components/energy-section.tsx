import { EnergyExplorer } from './energy-explorer';
import { ENERGY_CODES, ENERGY_PLACE_CODES, buildEnergyBoard } from '@/lib/energy-board';
import { readWorldBoard } from '@/lib/series';

/**
 * The energy chapter, read from the World Bank panel the core already holds.
 *
 * One query for the codes and places the board names; the rows were in the
 * database all along, filed under fifteen hundred other series nobody had
 * drawn together. Read on the server so the page ships the figures and not
 * the whole panel.
 */
export async function EnergySection() {
  const points = await readWorldBoard(ENERGY_CODES, ENERGY_PLACE_CODES);
  const board = buildEnergyBoard(points);
  if (!Object.keys(board.series).length) {
    return (
      <div className="callout">
        Todavía no hay series de energía leídas del panel del Banco Mundial. El capítulo se llena
        solo cuando el núcleo las tenga cargadas.
      </div>
    );
  }
  return <EnergyExplorer board={board} />;
}

import { CurrenciesExplorer } from './currencies-explorer';
import { readCurrencyBoard } from '@/lib/currencies';

/**
 * El capítulo «Otras monedas», armado donde viven los datos.
 *
 * Sin propiedades, como `FxSection`: la página renderiza un elemento y éste lee
 * lo que necesita. La lectura se sostiene en memoria, así que pedirla otra vez
 * desde otra superficie cuesta una búsqueda y no otra consulta.
 */
export async function CurrenciesSection() {
  const board = await readCurrencyBoard();
  return <CurrenciesExplorer board={board} />;
}

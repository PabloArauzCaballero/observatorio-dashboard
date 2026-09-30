import { MULTI_HINT } from '@/lib/choice';
import type { Choice } from '@/lib/choice';

/**
 * Las dos piezas que el filtro múltiple añade a cada panel.
 *
 * Son dos porque son dos las cosas que el lector no puede deducir mirando: que
 * el gesto existe, y cuántas categorías lleva puestas en una lista que ya no
 * cabe entera en la pantalla. Viven aquí y no copiadas en cada explorador
 * porque el texto del gesto tiene que ser el mismo en las siete secciones —
 * siete redacciones del mismo atajo es lo mismo que siete atajos distintos.
 */

/** El aviso del gesto, una sola vez por panel de filtros. */
export function FilterHint({ children }: { children?: React.ReactNode }) {
  return (
    <p className="rail-hint-top">
      {MULTI_HINT}
      {children ? <> {children}</> : null}
    </p>
  );
}

/** El mismo aviso donde no hay riel, sobre una fila de pastillas. */
export function ChipsHint({ children }: { children?: React.ReactNode }) {
  return (
    <p className="chips-hint">
      {MULTI_HINT}
      {children ? <> {children}</> : null}
    </p>
  );
}

/**
 * Cuántas categorías lleva elegidas una dimensión.
 *
 * Calla cuando hay una o ninguna: ahí el resalte de la propia lista ya lo dice,
 * y un «1 elegida» al lado de cada encabezado es ruido en el noventa por ciento
 * de las visitas.
 */
export function PickedCount({ choice, base }: { choice: Choice; base?: Choice }) {
  const extra = base ? [...choice].filter((value) => !base.has(value)).length : choice.size;
  if (choice.size < 2 || extra === 0) return null;
  return <span className="rail-picked">{choice.size} elegidas</span>;
}

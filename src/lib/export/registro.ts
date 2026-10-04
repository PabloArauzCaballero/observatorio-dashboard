/**
 * Qué cifras tiene cada panel de la pantalla, consultable desde el elemento.
 *
 * El informe de una pestaña recorre los paneles que hay montados y necesita, de
 * cada uno, las mismas cifras que su menú «Descargar» ofrece. Cada `Panel` se
 * registra aquí con la función que las arma; el informe pregunta por el
 * elemento. Una `WeakMap` para que un panel que desaparece no deje nada atrás.
 */
import type { DatosDeFigura } from '@/components/ui/panel-data';

const paneles = new WeakMap<Element, () => DatosDeFigura[]>();

export function registrarPanel(elemento: Element, cifras: () => DatosDeFigura[]): void {
  paneles.set(elemento, cifras);
}

export function cifrasDelPanel(elemento: Element): DatosDeFigura[] {
  return paneles.get(elemento)?.() ?? [];
}

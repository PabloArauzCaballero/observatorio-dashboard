'use client';

import type { ReactNode } from 'react';
import { ChartLegend } from './charts';
import type { LegendItem } from './charts';
import { ProveedorDePanel } from '@/components/ui/panel-data';
import type { Almacen } from '@/components/ui/panel-data';

/**
 * El gráfico de una tabla de Macroeconomía, con lo que todos tienen en común.
 *
 * Una tabla que pasa a ser gráfico (`ViewToggle`) sigue bajando los mismos datos en las dos
 * vistas. Los gráficos de `charts.tsx` declaran solos sus cifras al panel que los envuelve, y
 * lo que declaran es el recorte que dibujan —las primeras barras, los nombres cortos—, no la
 * tabla entera. Con el panel dando ya sus cifras completas, dejar que además las declare el
 * gráfico sumaba un segundo archivo que solo existía mirando el gráfico. Aquí se apaga: el
 * panel baja su tabla, siempre la misma, y el gráfico se dibuja y se imprime como figura.
 *
 * Trae también la leyenda (todo gráfico lleva una, aun con una sola serie) y, cuando la
 * tabla tiene más filas de las que se leen en barras, la nota que lo dice.
 */

/** Una figura que no declara cifras al panel: las del panel son las de la tabla. */
const SIN_CIFRAS: Almacen = {
  poner: () => undefined,
  todos: () => [],
  ponerImagen: () => undefined,
  imagen: () => undefined,
};

/** Cuántas barras se leen de corrido; más que esto es una tabla, y la tabla trae todas. */
export const MAX_BARRAS = 12;

export function MacroViewChart({
  legend,
  shown,
  total,
  children,
}: {
  /** Sin leyenda propia cuando el gráfico ya la dibuja (`DivergingBars`). */
  legend?: ReadonlyArray<LegendItem>;
  /** Cuántas filas dibuja el gráfico, si son menos que las de la tabla. */
  shown?: number;
  total?: number;
  children: ReactNode;
}) {
  return (
    <div className="chart-stack">
      <ProveedorDePanel almacen={SIN_CIFRAS}>{children}</ProveedorDePanel>
      {legend ? <ChartLegend items={legend} /> : null}
      {shown !== undefined && total !== undefined && shown < total ? (
        <p className="chart-note">
          Se muestran {shown} de {total}; la tabla trae todas.
        </p>
      ) : null}
    </div>
  );
}

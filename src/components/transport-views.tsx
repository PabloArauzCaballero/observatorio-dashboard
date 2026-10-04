'use client';

import type { ReactNode } from 'react';
import { ProveedorDePanel } from '@/components/ui/panel-data';
import type { Almacen } from '@/components/ui/panel-data';

/**
 * Piezas de presentación que comparten los paneles de «Transporte» cuando una tabla
 * pasa a verse como gráfico (con la tabla a un clic, en `ViewToggle`).
 */

/** Hasta cuántas categorías dibuja un gráfico de clasificación; la tabla trae todas. */
export const TOP = 12;

/**
 * Un almacén que no guarda nada.
 *
 * Los gráficos de `charts.tsx` declaran sus cifras al panel que los envuelve. Estos
 * paneles ya declaran las suyas con `data` (las filas completas, que son las de la
 * tabla), y un gráfico que muestra solo las primeras filas no debe sumar una segunda
 * descarga distinta de lo mismo.
 */
const SIN_CIFRAS: Almacen = {
  poner: () => undefined,
  todos: () => [],
  ponerImagen: () => undefined,
  imagen: () => undefined,
};

/** Dibuja el gráfico sin que declare cifras al panel: las del panel son las de la tabla. */
export function SinDeclarar({ children }: { children: ReactNode }) {
  return <ProveedorDePanel almacen={SIN_CIFRAS}>{children}</ProveedorDePanel>;
}

/** Un selector de una fila para el gráfico («Medida», «Clase»), con los chips del tablero. */
export function ChipPicker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="chips roads-map-tools" role="group" aria-label={label}>
      <span className="roads-map-tools-label">{label}</span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={option.id === value ? 'chip chip-on' : 'chip'}
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** «Se muestran 12 de 40»: lo que el gráfico recorta, dicho, porque la tabla las trae todas. */
export function TopNote({ shown, total, noun }: { shown: number; total: number; noun: string }) {
  if (shown >= total) return null;
  return (
    <p className="panel-note">
      Se muestran {shown} de {total} {noun}; la tabla trae todas.
    </p>
  );
}

/**
 * Un rótulo largo recortado con puntos suspensivos: en una pantalla estrecha la columna de
 * nombres se come el ancho y las barras desaparecen. El nombre entero va en el detalle.
 */
export const clip = (text: string, max = 30): string =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/**
 * Nombres que no se repiten: un gráfico indexa sus barras por el nombre, y dos filas
 * con el mismo rótulo (una ruta en dos tramos, un río en dos categorías) se pisarían.
 */
export function uniqueNames(
  items: ReadonlyArray<{ name: string; qualifier: string }>,
  max = 30,
): string[] {
  const clipped = items.map((item) => ({ ...item, name: clip(item.name, max) }));
  const seen = new Map<string, number>();
  for (const item of clipped) seen.set(item.name, (seen.get(item.name) ?? 0) + 1);
  const used = new Set<string>();
  return clipped.map((item) => {
    let name = (seen.get(item.name) ?? 0) > 1 ? `${item.name} · ${item.qualifier}` : item.name;
    for (let n = 2; used.has(name); n += 1) name = `${item.name} · ${item.qualifier} (${n})`;
    used.add(name);
    return name;
  });
}

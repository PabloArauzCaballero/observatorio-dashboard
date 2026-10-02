'use client';

import { useContext } from 'react';
import { ChipsHint } from './filters';
import { YearFloor } from './year-floor';
import { additive, toggle } from '@/lib/choice';
import type { Choice } from '@/lib/choice';

/**
 * Los controles de los paneles de cuentas públicas.
 *
 * Los mismos gestos del resto del informe: un clic elige una opción, Ctrl o ⌘ clic suma otra,
 * y volver a tocar la única elegida la suelta. Las pastillas, el selector y el deslizador de
 * años usan las clases de siempre; lo único propio es que cada control dice qué recorta y
 * que los paneles los cruzan —elegir otro país cambia las medidas, elegir otro año cambia
 * todos los gráficos— en vez de dibujar series fijas.
 */

export interface Option {
  key: string;
  label: string;
  hint?: string;
}

/** Pastillas de una dimensión; con `multi`, Ctrl/⌘/Mayús suma y la × de volver no hace falta. */
export function ChipPicker({
  label,
  options,
  value,
  onChange,
  multi = false,
  base,
}: {
  label: string;
  options: readonly Option[];
  value: Choice;
  onChange: (next: Choice) => void;
  multi?: boolean;
  /** Lo que queda elegido si se suelta todo; sin él, se queda la última. */
  base?: Choice;
}) {
  return (
    <div className="slicer">
      <span className="slicer-label">{label}</span>
      <div className="chips" role={multi ? 'group' : 'radiogroup'} aria-label={label}>
        {options.map((option) => {
          const on = value.has(option.key);
          return (
            <button
              key={option.key}
              type="button"
              className={on ? 'chip chip-on' : 'chip'}
              aria-pressed={on}
              title={option.hint}
              onClick={(event) =>
                onChange(
                  multi
                    ? toggle(value, option.key, additive(event), base ?? new Set([option.key]))
                    : new Set([option.key]),
                )
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {multi ? <ChipsHint /> : null}
    </div>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (next: string) => void;
}) {
  return (
    <label className="slicer">
      <span className="slicer-label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * «Desde qué año», que respeta el «Desde» de la barra de arriba.
 *
 * El año que elige el lector aquí no puede ser anterior al de la barra: la barra es el
 * recorte general del capítulo de Macroeconomía y este es uno más fino. `null` en la barra
 * es «no hay barra», y ahí el deslizador usa todo el rango.
 */
export function useFloor(min: number): number {
  const floor = useContext(YearFloor);
  return floor === null ? min : Math.max(min, floor);
}

export function YearSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="slicer">
      <span className="slicer-label">
        {label}: <output>{value}</output>
      </span>
      <input
        type="range"
        aria-label={`${label}: ${value}`}
        min={min}
        max={max}
        value={Math.min(Math.max(value, min), max)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

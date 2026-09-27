'use client';

import { additive, multiTitle, picked, toggle, ANY } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import { PickedCount } from './filters';
import { Icon } from './icons';
import type { IconName } from './icons';

/**
 * Un grupo de filtros del riel lateral, como los de «Carreteras»: cada opción
 * con la cifra que quedaría si además se eligiera (la de los otros filtros
 * puestos), Ctrl+clic para sumar varias y «Todos» para soltar el grupo.
 */
export function FilterGroup({
  title,
  icon,
  choice,
  onChange,
  options,
  allLabel,
  unit = 'km',
}: {
  title: string;
  icon: IconName;
  choice: Choice;
  onChange: (next: Choice) => void;
  options: readonly { key: string; label: string; count: number; color?: string; hint?: string }[];
  /** Si se ofrece una opción «todos» arriba, su rótulo. */
  allLabel?: string;
  unit?: string;
}) {
  const number = (value: number): string => Math.round(value).toLocaleString('es-BO');
  return (
    <div className="rail-sec">
      <div className="rail-head">
        <Icon name={icon} size={13} />
        {title}
        <PickedCount choice={choice} />
      </div>
      <div className="rail-list">
        {allLabel ? (
          <button
            type="button"
            className={choice.size === 0 ? 'rail-item rail-item-on' : 'rail-item'}
            aria-pressed={choice.size === 0}
            onClick={() => onChange(ANY)}
          >
            <Icon name="globo" size={16} />
            <span className="rail-name">{allLabel}</span>
            <span className="rail-n">
              {number(options.reduce((sum, one) => sum + one.count, 0))}
            </span>
          </button>
        ) : null}
        {options.map((one) => {
          const on = picked(choice, one.key);
          return (
            <button
              key={one.key}
              type="button"
              className={on ? 'rail-item rail-item-on' : 'rail-item'}
              aria-pressed={on}
              title={
                one.hint ? `${one.hint}. ${multiTitle(one.label, on)}` : multiTitle(one.label, on)
              }
              onClick={(event) => onChange(toggle(choice, one.key, additive(event)))}
            >
              {one.color ? (
                <i className="roads-swatch" style={{ background: one.color }} aria-hidden="true" />
              ) : (
                <Icon name={icon} size={16} />
              )}
              <span className="rail-name">{one.label}</span>
              <span className="rail-n" title={unit}>
                {number(one.count)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** «f4», «F 4», «Mamore» y «Mamoré» se buscan igual. */
export const squash = (value: string): string =>
  value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/gu, '')
    .replaceAll(/[^a-z0-9]+/gu, '');

export const km = (value: number, decimals = 0): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

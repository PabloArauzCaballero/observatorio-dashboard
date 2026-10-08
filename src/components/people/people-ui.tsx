'use client';

import type { ReactNode } from 'react';
import { initials } from './people-model';
import s from './people.module.css';

/**
 * El monograma: las iniciales en un círculo neutro.
 *
 * Es decoración —el nombre siempre va escrito al lado—, así que se oculta a los lectores de
 * pantalla. Sin foto a propósito: una foto exige licencia y crédito por imagen, y un
 * círculo de color por sector sería una escala categórica de ocho tonos que la paleta
 * validada no admite.
 */
export function Avatar({
  name,
  size = 'md',
  on = false,
}: {
  name: string;
  size?: 'md' | 'lg';
  on?: boolean;
}) {
  const className = [s.avatar, size === 'lg' ? s.avatarLg : '', on ? s.avatarOn : '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={className} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** Lo que no hay, dicho con su motivo y con una salida. */
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={s.empty} role="status">
      <strong>{title}</strong>
      {children ? <span>{children}</span> : null}
      {action}
    </div>
  );
}

/** Reserva el lugar del panel mientras llegan los datos, para que nada salte al llegar. */
export function Skeleton({ rows = 5, label }: { rows?: number; label: string }) {
  return (
    <div className={s.skel} role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div className={s.skelBar} key={index} />
      ))}
    </div>
  );
}

/** Las cifras de apertura de una página: una línea tipográfica, no cuatro tarjetas. */
export function Facts({ items }: { items: ReadonlyArray<{ value: string; label: string }> }) {
  return (
    <ul className={s.facts}>
      {items.map((item) => (
        <li className={s.fact} key={item.label}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

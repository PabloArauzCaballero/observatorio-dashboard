'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Icon } from './icons';

/**
 * The card's "what does this measure" note, floating over the card.
 *
 * It behaves like a tooltip that waits to be asked: nothing happens on hover,
 * it opens on a click, and it closes the moment the reader is done with it —
 * a click anywhere else, the pointer leaving the note, or Escape. The note
 * used to open inside the card and push every figure below it down the page,
 * which moved the number the reader was looking at while they were looking at
 * it; floating it leaves the card still.
 *
 * The pointer leaves through a small gap between the button and the note, so
 * the close waits a beat and is cancelled if the pointer lands back inside.
 * Without that grace the note would close on the way to being read.
 */
export function InfoPopover({
  label = '¿Qué mide este indicador?',
  children,
}: {
  /** What the button says it will show, for the title and the screen reader. */
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const note = useRef<HTMLDivElement>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** A pointer on its way back into the note must not find it closing. */
  const hold = () => {
    if (closing.current) clearTimeout(closing.current);
    closing.current = null;
  };

  /*
   * Solo el ratón cierra al salir. Un dedo «sale» del botón en cuanto se
   * levanta —el `pointerleave` llega pegado al `pointerup`—, así que en un
   * teléfono la nota se abría y se cerraba sola en el mismo toque. Ahí la
   * cierran el toque fuera y Escape, que es lo que hay.
   */
  const leave = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.pointerType !== 'mouse') return;
    hold();
    closing.current = setTimeout(() => setOpen(false), 160);
  };

  useEffect(() => {
    if (!open) return undefined;

    const away = (event: PointerEvent) => {
      const node = anchor.current;
      if (node && !node.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  /* A note left open by an unmounting card would leave its timer behind. */
  useEffect(() => () => hold(), []);

  /*
   * La nota cuelga hacia la izquierda del botón, que es lo que casi siempre
   * cabe; en una tarjeta estrecha —un teléfono— eso la sacaba media pantalla
   * fuera. Al abrirse se mide dónde cayó y se la empuja: dentro de la tarjeta
   * si cabe en ella, centrada sobre la tarjeta si es más ancha que ella, y en
   * todo caso dentro de la ventana. El CSS solo no puede: depende del ancho
   * que la tarjeta tenga en ese momento.
   */
  useLayoutEffect(() => {
    const node = note.current;
    if (!open || !node) return;
    node.style.setProperty('--pop-nudge', '0px');

    const box = node.getBoundingClientRect();
    const card = node.closest('.card')?.getBoundingClientRect();
    const edge = 8;
    let left = box.left;
    if (card) {
      left =
        box.width <= card.width
          ? Math.min(Math.max(left, card.left), card.right - box.width)
          : card.left + (card.width - box.width) / 2;
    }
    left = Math.max(edge, Math.min(left, window.innerWidth - edge - box.width));

    const nudge = Math.round(left - box.left);
    if (nudge) node.style.setProperty('--pop-nudge', `${nudge}px`);
  }, [open]);

  return (
    <span className="info-pop" ref={anchor} onPointerEnter={hold} onPointerLeave={leave}>
      <button
        type="button"
        className={open ? 'card-toggle card-toggle-on' : 'card-toggle'}
        onClick={() => setOpen(!open)}
        title={open ? 'Ocultar la explicación' : label}
        aria-expanded={open}
        aria-label={label}
      >
        <Icon name="info" size={16} />
      </button>
      {open ? (
        <div className="card-note info-pop-note" role="dialog" aria-label={label} ref={note}>
          {children}
        </div>
      ) : null}
    </span>
  );
}

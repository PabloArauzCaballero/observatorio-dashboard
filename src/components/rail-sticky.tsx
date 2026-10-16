'use client';

import { useEffect } from 'react';

/**
 * El carril de filtros acompaña a la página sin desplazarse por dentro.
 *
 * Antes era una caja con tope de alto y barra propia: en «Otras monedas» el encabezado
 * «Filtros» tapaba la ayuda de arriba, la última opción («Medida») quedaba cortada abajo
 * y había dos barras de desplazamiento una dentro de otra. Ahora el carril mide lo que
 * mide y se pega con un `top` que depende de su altura (ver `.rail` en globals.css):
 *
 *   - si cabe en la pantalla, se queda fijo justo debajo de la franja de secciones;
 *   - si es más alto, se desplaza con la página hasta mostrar su final y ahí se queda.
 *
 * Esta pieza sólo publica dos medidas: `--nav-h` (la franja de secciones, que también
 * es pegajosa) en la raíz y `--rail-h` en cada carril. Sin ellas el CSS cae en valores
 * que valen para un carril corto.
 */

/** ¿Ya hidrató React este nodo? Escribir un estilo antes provocaría un desajuste de hidratación. */
const hydrated = (node: Element): boolean =>
  Object.keys(node).some((key) => key.startsWith('__reactFiber$'));

export function RailSticky(): null {
  useEffect(() => {
    const root = document.documentElement;
    const measure = (el: HTMLElement) => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      if (el.classList.contains('site-sections')) {
        root.style.setProperty('--nav-h', `${height}px`);
      } else {
        el.style.setProperty('--rail-h', `${height}px`);
      }
    };
    const sizes = new ResizeObserver((entries) => {
      for (const entry of entries) measure(entry.target as HTMLElement);
    });
    const seen = new WeakSet<Element>();
    let frame = 0;
    let retry = 0;
    const scan = () => {
      let pending = false;
      for (const el of document.querySelectorAll<HTMLElement>('.rail, .site-sections')) {
        if (seen.has(el)) continue;
        if (el.classList.contains('rail') && !hydrated(el)) {
          pending = true;
          continue;
        }
        seen.add(el);
        sizes.observe(el);
        measure(el);
      }
      window.clearTimeout(retry);
      if (pending) retry = window.setTimeout(schedule, 400);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    };
    schedule();
    const watcher = new MutationObserver(schedule);
    watcher.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(retry);
      watcher.disconnect();
      sizes.disconnect();
    };
  }, []);
  return null;
}

'use client';

import { useEffect } from 'react';

/**
 * El buscador de toda lista larga del carril de filtros.
 *
 * Una lista de más de ocho opciones (el emisor de la bolsa, los 351 informes del BCB,
 * las ciudades, el sector de Merco) obligaba a recorrerla entera con el dedo para llegar
 * a la que se venía a buscar, y la mitad de ellas ni siquiera se desplazaba por dentro:
 * empujaba el carril. Esta pieza las recoge a todas en un solo sitio en vez de repetir el
 * mismo campo en los veinticinco exploradores que arman un carril:
 *
 *   - le pone un campo de búsqueda encima (sin tildes ni mayúsculas) y esconde las
 *     opciones que no coinciden, salvo la que está elegida: ocultar lo que está puesto
 *     deja un filtro activo que no se ve ni se puede soltar;
 *   - le da un tope de altura y desplazamiento propio, como a `.rail-list`;
 *   - no toca las listas que ya traen su buscador en la misma sección.
 *
 * Trabaja sobre el DOM y no sobre React porque las listas las pinta cada explorador con su
 * propio estado. Sólo escribe `hidden` en las opciones y un campo hermano de la lista:
 * ninguna de las dos cosas es algo que React gestione, y un observador reaplica el filtro
 * cuando el explorador vuelve a pintar las opciones.
 */

/** Desde cuántas opciones merece buscador; es el mismo umbral que ya pone el recorte de `.rail-list-cut`. */
const MIN_OPTIONS = 9;

const fold = (value: string): string =>
  value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();

interface Enhanced {
  wrap: HTMLElement;
  input: HTMLInputElement;
  empty: HTMLElement;
  watcher: MutationObserver;
}

const enhanced = new WeakMap<HTMLElement, Enhanced>();

function optionsOf(list: HTMLElement): HTMLElement[] {
  return [...list.children].filter((child): child is HTMLElement =>
    child.classList.contains('rail-item'),
  );
}

function labelOf(option: HTMLElement): string {
  return fold((option.querySelector('.rail-name') ?? option).textContent ?? '');
}

function apply(list: HTMLElement, state: Enhanced): void {
  const query = fold(state.input.value);
  let matches = 0;
  for (const option of optionsOf(list)) {
    const matched = !query || labelOf(option).includes(query);
    if (matched) matches += 1;
    // La opción elegida no se esconde, aunque no coincida: sería un filtro activo que no se ve.
    option.hidden = !matched && option.getAttribute('aria-pressed') !== 'true';
  }
  state.empty.hidden = !query || matches > 0;
}

function enhance(list: HTMLElement, title: string): void {
  const wrap = document.createElement('div');
  wrap.className = 'rail-list-find';
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'Buscar…';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', title ? `Buscar en ${title}` : 'Buscar en la lista');
  const empty = document.createElement('p');
  empty.className = 'rail-list-empty';
  empty.textContent = 'Sin coincidencias.';
  empty.hidden = true;
  wrap.append(input);
  list.before(wrap);
  list.after(empty);

  const state: Enhanced = { wrap, input, empty, watcher: new MutationObserver(() => {}) };
  state.watcher.disconnect();
  // Sólo hijos y texto: escribir `hidden` es un cambio de atributo y no vuelve a disparar esto.
  state.watcher = new MutationObserver(() => apply(list, state));
  state.watcher.observe(list, { childList: true, subtree: true, characterData: true });

  input.addEventListener('input', () => apply(list, state));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && input.value) {
      event.stopPropagation();
      input.value = '';
      apply(list, state);
    }
  });
  list.dataset.railFind = '';
  list.dataset.railScroll = '';
  enhanced.set(list, state);
}

function release(list: HTMLElement): void {
  const state = enhanced.get(list);
  if (!state) return;
  state.watcher.disconnect();
  state.wrap.remove();
  state.empty.remove();
  enhanced.delete(list);
}

/** Las listas que ya tienen su buscador propio en la misma sección no necesitan el de aquí. */
function hasOwnSearch(section: Element): boolean {
  return Boolean(
    section.querySelector(
      'input:not(.rail-list-find input)[type="search"], input:not(.rail-list-find input)[type="text"], input:not(.rail-list-find input):not([type])',
    ),
  );
}

const tracked = new Set<HTMLElement>();

function scan(): void {
  for (const list of tracked) {
    if (!list.isConnected) {
      release(list);
      tracked.delete(list);
    }
  }
  for (const section of document.querySelectorAll('.rail-sec')) {
    const parents = new Set<HTMLElement>();
    for (const option of section.querySelectorAll('.rail-item')) {
      if (option.parentElement) parents.add(option.parentElement);
    }
    for (const list of parents) {
      // Las opciones colgadas de la propia sección no tienen dónde llevar el campo: se envuelven en `.rail-list`.
      if (enhanced.has(list) || list === section || list.classList.contains('rail-tree')) continue;
      if (optionsOf(list).length < MIN_OPTIONS || hasOwnSearch(section)) continue;
      const title = section.querySelector('.rail-head')?.textContent?.trim() ?? '';
      enhance(list, title);
      tracked.add(list);
    }
  }
}

export function RailListSearch(): null {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    };
    schedule();
    const watcher = new MutationObserver(schedule);
    watcher.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      watcher.disconnect();
      for (const list of tracked) release(list);
      tracked.clear();
    };
  }, []);
  return null;
}

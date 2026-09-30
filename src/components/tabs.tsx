'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';
import { EVENTO_ENLACE, PARAM_PAGINA, PARAM_PESTANA, anotar, indicePorSlug, leerParametro, slug } from '@/lib/enlace-tablero';

/**
 * Sigue la dirección: al montar, cuando el asistente pide un destino y cuando
 * el lector usa «atrás». Así `/?pestana=…&pagina=…` abre el lugar exacto.
 * La clave es el texto de los rótulos y no el arreglo, que llega nuevo en cada
 * render del padre.
 */
function useSeguirDireccion(labels: readonly string[], parametro: string, setActive: (index: number) => void, activo: boolean) {
  const clave = labels.join('|');
  useEffect(() => {
    if (!activo) return;
    const rotulos = clave.split('|');
    const sincronizar = () => {
      const index = indicePorSlug(rotulos, leerParametro(parametro));
      if (index >= 0) setActive(index);
    };
    sincronizar();
    window.addEventListener(EVENTO_ENLACE, sincronizar);
    window.addEventListener('popstate', sincronizar);
    return () => {
      window.removeEventListener(EVENTO_ENLACE, sincronizar);
      window.removeEventListener('popstate', sincronizar);
    };
  }, [clave, parametro, setActive, activo]);
}

/**
 * Roving-tabindex keyboard behaviour shared by Tabs and SubTabs: arrow keys
 * move focus and selection together (automatic activation), Home/End jump to
 * the ends, and focus always lands on a real button so screen readers and
 * keyboard users never lose their place in the tablist.
 */
function useTablistKeyboard(count: number, setActive: (index: number) => void) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const focusAndActivate = (index: number) => {
    const wrapped = (index + count) % count;
    setActive(wrapped);
    buttonsRef.current[wrapped]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusAndActivate(index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusAndActivate(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAndActivate(0);
        break;
      case 'End':
        event.preventDefault();
        focusAndActivate(count - 1);
        break;
      default:
        break;
    }
  };

  return { buttonsRef, onKeyDown };
}

/**
 * Section switcher.
 *
 * Only the active panel is rendered, rather than hidden with CSS: a chart
 * measured inside a hidden container comes out zero-width and would need a
 * resize it never receives. Remounting also replays the draw animation, so a
 * section arrives rather than appears.
 */
export function Tabs({
  labels,
  icons,
  children,
}: {
  labels: string[];
  icons: IconName[];
  children: React.ReactNode[];
}) {
  const [active, setActive] = useState(0);
  const baseId = useId();
  // Elegir una pestaña la anota en la dirección y olvida la página de la anterior.
  const elegir = (index: number) => {
    setActive(index);
    const label = labels[index];
    if (label) anotar({ [PARAM_PESTANA]: slug(label), [PARAM_PAGINA]: null });
  };
  const { buttonsRef, onKeyDown } = useTablistKeyboard(labels.length, elegir);

  /*
   * El asistente remite a una pestaña con un enlace (`/?pestana=…`). Un evento
   * de ventana y no un contexto, porque el chat vive fuera del árbol de las
   * pestañas.
   */
  useSeguirDireccion(labels, PARAM_PESTANA, setActive, true);

  return (
    <>
      <nav className="tabs" role="tablist" aria-label="Secciones del informe">
        {labels.map((label, index) => (
          <button
            key={label}
            ref={(el) => {
              buttonsRef.current[index] = el;
            }}
            id={`${baseId}-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-controls={`${baseId}-panel`}
            tabIndex={index === active ? 0 : -1}
            className={index === active ? 'tab tab-active' : 'tab'}
            onClick={() => elegir(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <Icon name={icons[index] ?? 'cajas'} size={15} />
            {label}
          </button>
        ))}
      </nav>
      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active}`}
        key={active}
        className="panel-enter"
      >
        {children[active]}
      </div>
    </>
  );
}

/**
 * Navigation inside a section.
 *
 * The trade chapter asks one question three ways — how the country trades, what
 * it settles with, where it was measured — and each answer is a screenful. As
 * top-level tabs they read as three subjects; stacked in one they read as an
 * endless scroll. Sub-tabs keep them one chapter with three pages.
 *
 * Like the tabs above it, only the active page is rendered: a chart measured
 * inside a hidden container comes out zero-width and never receives the resize
 * that would fix it.
 */
export function SubTabs({
  labels,
  icons,
  children,
  enlace = false,
}: {
  labels: string[];
  icons: IconName[];
  children: React.ReactNode[];
  /**
   * Si esta barra es la que nombra `pagina=` en la dirección. Solo la de
   * primer nivel de cada pestaña: una anidada («Comercio», «Pagos») pisaría la
   * página de su madre.
   */
  enlace?: boolean;
}) {
  const [active, setActive] = useState(0);
  const baseId = useId();
  const elegir = (index: number) => {
    setActive(index);
    const label = labels[index];
    if (enlace && label) anotar({ [PARAM_PAGINA]: slug(label) });
  };
  const { buttonsRef, onKeyDown } = useTablistKeyboard(labels.length, elegir);
  useSeguirDireccion(labels, PARAM_PAGINA, setActive, enlace);

  return (
    <>
      <nav className="subtabs" role="tablist" aria-label="Páginas de la sección">
        {labels.map((label, index) => (
          <button
            key={label}
            ref={(el) => {
              buttonsRef.current[index] = el;
            }}
            id={`${baseId}-subtab-${index}`}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-controls={`${baseId}-subpanel`}
            tabIndex={index === active ? 0 : -1}
            className={index === active ? 'subtab subtab-active' : 'subtab'}
            onClick={() => elegir(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <Icon name={icons[index] ?? 'cajas'} size={13} />
            {label}
          </button>
        ))}
      </nav>
      <div
        id={`${baseId}-subpanel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-subtab-${active}`}
        key={active}
        className="stack panel-enter"
      >
        {children[active]}
      </div>
    </>
  );
}

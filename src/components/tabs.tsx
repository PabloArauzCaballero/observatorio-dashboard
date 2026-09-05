'use client';

import { useState } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';

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

  return (
    <>
      <nav className="tabs" role="tablist" aria-label="Secciones del informe">
        {labels.map((label, index) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={index === active}
            className={index === active ? 'tab tab-active' : 'tab'}
            onClick={() => setActive(index)}
          >
            <Icon name={icons[index] ?? 'cajas'} size={15} />
            {label}
          </button>
        ))}
      </nav>
      <div role="tabpanel" key={active} className="panel-enter">
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
}: {
  labels: string[];
  icons: IconName[];
  children: React.ReactNode[];
}) {
  const [active, setActive] = useState(0);

  return (
    <>
      <nav className="subtabs" role="tablist" aria-label="Páginas de la sección">
        {labels.map((label, index) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={index === active}
            className={index === active ? 'subtab subtab-active' : 'subtab'}
            onClick={() => setActive(index)}
          >
            <Icon name={icons[index] ?? 'cajas'} size={13} />
            {label}
          </button>
        ))}
      </nav>
      <div role="tabpanel" key={active} className="stack panel-enter">
        {children[active]}
      </div>
    </>
  );
}

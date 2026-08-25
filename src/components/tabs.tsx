'use client';

import { useState } from 'react';

/**
 * Section switcher.
 *
 * Only the active panel is rendered, rather than hidden with CSS: a chart
 * measured inside a hidden container comes out zero-width and would need a
 * resize it never receives. Remounting also replays the draw animation, so a
 * section arrives rather than appears.
 */
export function Tabs({ labels, children }: { labels: string[]; children: React.ReactNode[] }) {
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

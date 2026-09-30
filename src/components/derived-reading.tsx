'use client';

import { useState } from 'react';

import { Icon } from './icons';
import type { IconName } from './icons';
import type { FxConclusion } from '@/lib/fx-snapshot';

/**
 * A list of derived sentences with the figure that carries each one.
 *
 * The exchange-rate chapter established the form: a claim in words, the
 * number that is the news, and what qualifies it — against what, since when,
 * from which test. Three chapters now speak this way, so the markup lives
 * once. What differs per chapter is the heading, the icon each key carries and
 * whether the list opens folded, and those are the props.
 *
 * Plegada por defecto, en todas las vistas y sobre todo en un teléfono. Abierta
 * ocupa la primera pantalla entera del capítulo y empuja por debajo del pliegue
 * a los gráficos de los que sale: en un móvil eso son seis párrafos antes de la
 * primera serie. La cabecera plegada dice cuántas lecturas hay y el lector
 * decide, que es lo mismo que ya hacía la lectura del tipo de cambio
 * (`FxConclusions`). Ninguna vista pasa `defaultOpen`; la prop queda para que
 * abrir sea una decisión explícita y justificada, no un olvido.
 */

const toneClass = (tone: FxConclusion['tone']): string =>
  tone === 'adverse' ? 'up' : tone === 'favourable' ? 'down' : 'flat';

export function DerivedReading({
  title,
  note,
  conclusions,
  icons,
  defaultOpen = false,
  unit = 'lectura',
}: {
  title: string;
  /** What the sentences are and are not, said once above them. */
  note: string;
  conclusions: readonly FxConclusion[];
  icons: Readonly<Record<string, IconName>>;
  defaultOpen?: boolean;
  /** The noun the folded header counts: «6 lecturas», «7 pruebas». */
  unit?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!conclusions.length) return null;
  const plural = conclusions.length === 1 ? unit : `${unit}s`;
  return (
    <div className={open ? 'analysis' : 'analysis analysis-folded'}>
      <div className="tile-head card-head">
        <Icon name="sigma" size={17} />
        <h2>{title}</h2>
        <span className="tile-hint">
          {open ? 'derivado, no redactado' : `${conclusions.length} ${plural}`}
        </span>
        <button
          type="button"
          className={open ? 'card-toggle card-toggle-on' : 'card-toggle'}
          onClick={() => setOpen(!open)}
          title={open ? 'Plegar la lectura' : 'Ver la lectura'}
          aria-expanded={open}
        >
          <Icon name={open ? 'plegar' : 'desplegar'} size={16} />
        </button>
      </div>
      {!open ? null : (
        <>
          <p className="analysis-note">{note}</p>
          <ul className="bullets">
            {conclusions.map((conclusion) => (
              <li className="bullet" key={conclusion.key}>
                <span className={`bullet-mark bullet-mark-${toneClass(conclusion.tone)}`}>
                  <Icon name={icons[conclusion.key] ?? 'info'} size={16} />
                </span>
                <div className="bullet-body">
                  <div className="bullet-line">
                    <b className="bullet-label">{conclusion.claim}</b>
                    <span className={`bullet-value bullet-value-${toneClass(conclusion.tone)}`}>
                      {conclusion.figure}
                    </span>
                  </div>
                  <p className="bullet-detail">{conclusion.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

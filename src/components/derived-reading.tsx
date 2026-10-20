'use client';

import { useState } from 'react';

import { Icon } from './icons';
import type { IconName } from './icons';
import { Panel } from '@/components/ui/panel';
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
 *
 * Se dibuja siempre como un `Panel` del tablero —título con su cuenta, botón para
 * plegar a la derecha y menú «Descargar» con las lecturas—. La caja marfil de antes
 * (sin `id`) quedó en seis capítulos sin migrar y se retiró el 20-oct-2026: el `id`
 * es obligatorio.
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
  id,
  source = 'Series de esta sección; cálculo de DatosBolivia.com, actualizado con cada carga',
}: {
  title: string;
  /** What the sentences are and are not, said once above them. */
  note: string;
  conclusions: readonly FxConclusion[];
  icons: Readonly<Record<string, IconName>>;
  defaultOpen?: boolean;
  /** The noun the folded header counts: «6 lecturas», «7 pruebas». */
  unit?: string;
  /** Clave estable del panel (ancla, enlace y nombre de archivo de la descarga). */
  id: string;
  /** Quién publica las cifras de las que salen las frases. */
  source?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!conclusions.length) return null;
  const plural = conclusions.length === 1 ? unit : `${unit}s`;

  const bullets = (
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
  );

  return (
    <Panel
      id={id}
      title={`${title} (${conclusions.length} ${plural})`}
      lede={open ? note : undefined}
      meta={
        <button
          type="button"
          className="menu-btn"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          {open ? 'Plegar' : `Ver ${conclusions.length} ${plural}`}
        </button>
      }
      source={source}
      data={{
        columnas: ['Lectura', 'Cifra', 'Detalle'],
        filas: conclusions.map((one) => [one.claim, one.figure, one.detail]),
        nota: 'Derivado de las observaciones, no redactado: cada frase se recalcula con cada carga.',
      }}
      className="derived-reading"
    >
      {open ? bullets : null}
    </Panel>
  );
}

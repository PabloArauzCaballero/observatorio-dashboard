import type { ReactNode } from 'react';
import { Monogram } from '@/components/brand/monogram';
import { Donate } from '@/components/donate';
import { TodayDate } from '@/components/today-date';
import { ThemeToggle } from '@/components/theme-toggle';

/**
 * La cabecera del sitio, como la portada de un diario.
 *
 * Arriba, una franja fina con la fecha del día y las dos acciones que siempre
 * están (tema y donación). En medio, la marca del manual de identidad: el
 * monograma DB, «DatosBolivia.com» en serif con el punto en oro y el
 * descriptor entre filetes. Debajo, el sello de cuándo se cargó el último dato,
 * que es la única cifra de la cabecera y la que dice cuánto confiar en las
 * demás. La barra de secciones la pone `SiteLayout`, justo después.
 */
export function Masthead({ stamp }: { stamp: ReactNode }) {
  return (
    <header className="masthead" role="banner">
      <div className="masthead-strip">
        <TodayDate />
        <div className="masthead-actions">
          <ThemeToggle />
          <Donate />
        </div>
      </div>
      <a className="masthead-brand" href="/">
        <Monogram size={64} title="" className="masthead-mono" />
        <div className="masthead-lockup">
          <h1 className="masthead-word">
            DatosBolivia<span className="masthead-dot">.</span>com
          </h1>
          <span className="masthead-sub">
            <span className="masthead-sub-rule" aria-hidden="true" />
            Centro de Datos de Bolivia
            <span className="masthead-sub-rule" aria-hidden="true" />
          </span>
        </div>
      </a>
      <p className="masthead-stamp">{stamp}</p>
    </header>
  );
}

import type { ReactNode } from 'react';
import { TabReportButton } from '@/components/ui/tab-report-button';

/**
 * La cabecera de una pestaña: el único gesto grande de cada capítulo.
 *
 * Todo lo demás en la página es silencioso a propósito; esto no. Un título en
 * serif y una entradilla que dice, en una frase, qué se va a encontrar el lector
 * y cuánto confiar en ello. Es el nivel dos del documento —el uno es la marca—,
 * y los paneles de debajo son nivel tres.
 */
export function TabHeader({
  id,
  title,
  lede,
  actions,
}: {
  id: string;
  title: string;
  lede?: ReactNode;
  /** A la derecha del título: el informe de la pestaña, por ejemplo. */
  actions?: ReactNode;
}) {
  return (
    <header className="tab-head" data-tab-head={id}>
      <div className="tab-head-text">
        <h2 className="tab-title">{title}</h2>
        {lede ? <p className="tab-lede">{lede}</p> : null}
      </div>
      <div className="tab-head-side">
        {actions}
        <TabReportButton />
      </div>
    </header>
  );
}

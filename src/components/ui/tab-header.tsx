import type { ReactNode } from 'react';
import { TabReportButton } from '@/components/ui/tab-report-button';

/**
 * El antetítulo de cada cabecera: el área del diario y, detrás, el tema. Sale de
 * aquí y no lo escribe cada sección, para que el sitio entero use las mismas
 * cuatro áreas del manual (Economía · Sociedad · Territorio · Institucional).
 */
const ANTETITULO: Readonly<Record<string, string>> = {
  hoy: 'Economía · Coyuntura',
  'tipo-de-cambio': 'Economía · Mercado cambiario',
  macroeconomia: 'Economía',
  energia: 'Economía · Energía',
  recursos: 'Economía · Recursos naturales',
  empresas: 'Economía · Empresas',
  departamentos: 'Territorio · Economía regional',
  ambiente: 'Territorio · Ambiente',
  ciudades: 'Territorio',
  transporte: 'Territorio · Infraestructura',
  personalidades: 'Sociedad',
  instituciones: 'Sociedad · Instituciones',
  prensa: 'Sociedad · Medios',
  metodo: 'Institucional · Metodología',
};

/**
 * La cabecera de una sección: el único gesto grande de cada capítulo, compuesta
 * como la apertura de una nota de diario.
 *
 *   ECONOMÍA · MERCADO CAMBIARIO        ← antetítulo (versalitas, oro profundo)
 *   Tipo de cambio                      ← título en serif
 *   Bajada: qué hay y cuánto confiar.   ← una o dos frases
 *
 * Es el nivel dos del documento —el uno es la marca—, y los paneles de debajo
 * son nivel tres.
 */
export function TabHeader({
  id,
  title,
  lede,
  kicker,
  actions,
}: {
  id: string;
  title: string;
  lede?: ReactNode;
  /** El antetítulo, si no es el que corresponde a `id`. */
  kicker?: string;
  /** A la derecha del título: el informe de la pestaña, por ejemplo. */
  actions?: ReactNode;
}) {
  const antetitulo = kicker ?? ANTETITULO[id];
  return (
    <header className="tab-head" data-tab-head={id}>
      <div className="tab-head-text">
        {antetitulo ? <p className="tab-kicker">{antetitulo}</p> : null}
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

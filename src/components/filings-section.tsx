'use client';

import { ExportersSection, ReputationSection } from './exporters-section';
import { FilingExplorer } from './filing-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import { SubTabs } from './tabs';
import type { CompanyFiling } from '@/lib/series';

/**
 * El capítulo de empresas, con sus tres registros.
 *
 * Tres y no uno, y la separación es el punto. El primero es el registro de la
 * **Bolsa Boliviana de Valores**: lo que sus emisores están obligados a
 * comunicar, que no es el universo de empresas del país sino las que acuden al
 * mercado de valores. El segundo es el comercio exterior por empresa —orden y
 * cuota, nunca dólares—, que cubre a compañías enteramente distintas: de las
 * cien mayores exportadoras, casi ninguna cotiza. El tercero es el monitor de
 * **reputación**, que mide percepción con encuestas y cuya cabeza son marcas
 * de consumo que ni cotizan ni exportan.
 *
 * Estaban a punto de quedar en una sola página y habría sido un error de
 * lectura: un lector que viera hechos relevantes, ránking de exportadoras y
 * puestos de reputación en el mismo panel supondría que las filas de uno
 * explican las del otro, y no hay una sola empresa cuya posición exportadora
 * se deduzca de sus comunicados a la bolsa ni de lo que el público opina de
 * ella. Exportadoras y reputación compartieron pestaña una temporada, con el
 * cruce entre ambas al pie; el cruce sigue —en «Reputación empresarial», que es
 * la lista que hace la pregunta— pero cada medida tiene ahora su página.
 *
 * `SubTabs` monta sólo la página activa, así que abrir «Empresas» sigue pidiendo
 * únicamente los hechos relevantes; las otras dos esperan a que alguien las
 * elija, y como leen la misma dirección, la segunda sale de la caché.
 */
export function FilingsSection() {
  return (
    <SubTabs
      labels={['Bolsa de valores (BBV)', 'Exportadoras', 'Reputación empresarial']}
      icons={['velas', 'camion', 'escudo']}
    >
      <FilingsPage />
      <ExportersSection />
      <ReputationSection />
    </SubTabs>
  );
}

/**
 * Los hechos relevantes, pedidos al abrir la pestaña de Empresas.
 *
 * Mil comunicados con su texto completo: 1,43 MB del informe, medidos el
 * 2026-09-22. La portada los sigue leyendo —el análisis del día cita el último
 * y el resumen los cuenta— pero lo que viajaba con ella era el corpus entero
 * para una pestaña que la mayoría de las visitas no abre. Ahora viaja la cifra
 * y el corpus espera a que alguien lo pida.
 */
function FilingsPage() {
  const { payload, failed } = useOnOpen<{ filings: CompanyFiling[] }>('/api/empresas');

  if (!payload) {
    return (
      <OnOpenNotice what="los hechos relevantes de la Bolsa Boliviana de Valores" failed={failed} />
    );
  }

  if (!payload.filings.length) {
    return <div className="callout">Todavía no hay hechos relevantes cargados.</div>;
  }

  return <FilingExplorer filings={payload.filings} />;
}

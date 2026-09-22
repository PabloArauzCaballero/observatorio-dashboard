'use client';

import { ExportersSection } from './exporters-section';
import { FilingExplorer } from './filing-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import { SubTabs } from './tabs';
import type { CompanyFiling } from '@/lib/series';

/**
 * El capítulo de empresas, con sus dos registros.
 *
 * Dos y no uno, y la separación es el punto. Uno es el registro de la **Bolsa
 * Boliviana de Valores**: lo que sus emisores están obligados a comunicar, que
 * no es el universo de empresas del país sino las que acuden al mercado de
 * valores. El otro es el comercio exterior por empresa, con el monitor de
 * reputación al lado, que cubre a otras compañías enteramente distintas —de las
 * cien mayores exportadoras, casi ninguna cotiza—.
 *
 * Estaban a punto de quedar en una sola página y habría sido un error de
 * lectura: un lector que viera hechos relevantes y ránking de exportadoras en
 * el mismo panel supondría que las filas de uno explican las del otro, y no hay
 * una sola empresa cuya posición exportadora se deduzca de sus comunicados a la
 * bolsa. Dos páginas dicen que son dos corpus.
 *
 * `SubTabs` monta sólo la página activa, así que abrir «Empresas» sigue pidiendo
 * únicamente los hechos relevantes; el registro de exportadoras espera a que
 * alguien lo elija.
 */
export function FilingsSection() {
  return (
    <SubTabs
      labels={['Bolsa de valores (BBV)', 'Exportadoras y reputación']}
      icons={['velas', 'camion']}
    >
      <FilingsPage />
      <ExportersSection />
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

'use client';

import { ReputationSection } from './exporters-section';
import { FilingExplorer } from './filing-explorer';
import { ForeignTradeSection } from './foreign-trade-section';
import { OnOpenNotice, useOnOpen } from './on-open';
import { SubTabs } from './tabs';
import type { CompanyFiling } from '@/lib/series';

/**
 * El capítulo de empresas, con sus tres registros.
 *
 * El primero es el registro de la **Bolsa Boliviana de Valores**: lo que sus
 * emisores están obligados a comunicar, que no es el universo de empresas del
 * país sino las que acuden al mercado de valores. El segundo es **comercio
 * exterior**: qué vende Bolivia, a quién, qué compra y quién lo vende —una
 * sola pregunta con cuatro fuentes: el total nacional por producto (INE), el
 * agregado y el detalle por socio y por capítulo ante Naciones Unidas
 * (Comtrade), y el ránking de quién exporta más (un agregador comercial, en
 * orden y cuota, nunca en dólares). Antes eran dos pestañas —«Exportadoras» y
 * «Comercio exterior»— separadas por una distinción metodológica real, pero
 * el lector las lee como una sola historia y las dos pedían dos clics para
 * contarla; ahora es una. El tercero es el monitor de **reputación**, que
 * mide percepción con encuestas y cuya cabeza son marcas de consumo que ni
 * cotizan ni exportan: se queda aparte porque mide algo distinto, no comercio.
 *
 * `SubTabs` monta sólo la página activa, así que abrir «Empresas» sigue pidiendo
 * únicamente los hechos relevantes; las otras dos esperan a que alguien las
 * elija, y «Comercio exterior» y «Reputación empresarial» leen la misma
 * dirección de exportadoras, así que la segunda que se abra sale de la caché.
 */
export function FilingsSection() {
  return (
    <SubTabs
      labels={['Bolsa de valores (BBV)', 'Comercio exterior', 'Reputación empresarial']}
      icons={['velas', 'globo', 'escudo']}
    >
      <FilingsPage />
      <ForeignTradeSection />
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

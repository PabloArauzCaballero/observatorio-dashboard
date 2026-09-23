'use client';

import { ExportersSection, ReputationSection } from './exporters-section';
import { FilingExplorer } from './filing-explorer';
import { ForeignTradeSection } from './foreign-trade-section';
import { OnOpenNotice, useOnOpen } from './on-open';
import { SubTabs } from './tabs';
import type { CompanyFiling } from '@/lib/series';

/**
 * El capítulo de empresas, con sus cuatro registros.
 *
 * Cuatro y no uno, y la separación es el punto. El primero es el registro de
 * la **Bolsa Boliviana de Valores**: lo que sus emisores están obligados a
 * comunicar, que no es el universo de empresas del país sino las que acuden al
 * mercado de valores. El segundo es **quién exporta más** —el ránking de un
 * agregador comercial, en orden y cuota, nunca en dólares—, que cubre a
 * compañías enteramente distintas: de las cien mayores exportadoras, casi
 * ninguna cotiza. El tercero es **qué se exporta**: producto y país, con las
 * fuentes oficiales —INE y Comtrade— y no con un agregador, y por eso sí trae
 * dólares donde el ránking de al lado no puede. El cuarto es el monitor de
 * **reputación**, que mide percepción con encuestas y cuya cabeza son marcas
 * de consumo que ni cotizan ni exportan.
 *
 * «Exportadoras» y «Comercio exterior» van una al lado de la otra a propósito
 * y contestan preguntas distintas con métodos distintos: la primera es quién
 * vende más —una posición relativa, sin cifra en dólares porque la fuente no
 * la sostiene— y la segunda es qué se vende y a quién —cifras oficiales, sin
 * nombre de empresa porque esa declaración está amparada por reserva—.
 * Ninguna fila de una se deduce de una fila de la otra, y cada página lo dice
 * en su propio aviso.
 *
 * `SubTabs` monta sólo la página activa, así que abrir «Empresas» sigue pidiendo
 * únicamente los hechos relevantes; las otras tres esperan a que alguien las
 * elija, y «Exportadoras» y «Reputación empresarial» leen la misma dirección,
 * así que la segunda sale de la caché.
 */
export function FilingsSection() {
  return (
    <SubTabs
      labels={['Bolsa de valores (BBV)', 'Exportadoras', 'Comercio exterior', 'Reputación empresarial']}
      icons={['velas', 'camion', 'globo', 'escudo']}
    >
      <FilingsPage />
      <ExportersSection />
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

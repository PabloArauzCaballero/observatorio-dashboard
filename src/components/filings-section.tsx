'use client';

import { BusinessFabricSection } from './business-fabric-section';
import { BusinessOwnersSection } from './business-owners-section';
import { CompanySocialSection } from './company-social-explorer';
import { LiveCommerceSection } from './live-commerce-section';
import { ReputationSection } from './exporters-section';
import { FilingExplorer } from './filing-explorer';
import { ForeignTradeSection } from './foreign-trade-section';
import { LargestCompaniesSection } from './largest-companies-section';
import { OnOpenNotice, useOnOpen } from './on-open';
import { SubSections } from './site-layout';
import { TabHeader } from '@/components/ui/tab-header';
import { TradeRecordsSection } from './trade-records-section';
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
 * «Detalle aduanero (INE)» es la base de datos del INE, declaración por
 * declaración resumida a partida × país × departamento × mes: el detalle que
 * «Comercio exterior» no puede cruzar. Va en su propia página porque se lee
 * distinto —se filtra y se desglosa, no se recorre— y porque pide su dato a
 * cada cambio de filtro, que no tiene por qué pagar quien sólo abre la otra.
 *
 * «Redes sociales» son las cuentas oficiales de esas mismas empresas del
 * ránking Merco: seguidores, interacción, sentimiento de los comentarios y
 * palabras más repetidas, leídos de sus perfiles públicos (ADR 0027 del
 * núcleo). Va junto a la reputación porque mira a las mismas empresas, y
 * aparte porque mide otra cosa: lo que declara una red, no una encuesta.
 *
 * Las tres primeras miran al tejido entero y no a un registro en particular.
 * **Tejido empresarial** cuenta cuántas empresas hay —por tipo societario,
 * departamento, actividad y tamaño, desde 2008— y cómo se reparte el padrón de
 * Impuestos. **Principales empresas** ordena a las más grandes año a año con
 * dos varas, una oficial y otra privada: el impuesto que pagan y lo que
 * facturan.
 * **Empresarios** sigue a sus dueños: las fortunas que publica Forbes y la
 * estimación del observatorio, construida con el patrimonio de cada empresa y
 * la participación que los documentos públicos atribuyen a cada accionista.
 *
 * `SubSections` monta cada página al acercarse, así que abrir «Empresas» pide sólo el
 * tejido empresarial; las demás esperan a que alguien las elija, y «Comercio
 * exterior» y «Reputación empresarial» leen la misma dirección de exportadoras,
 * así que la segunda que se abra sale de la caché.
 */
export function FilingsSection() {
  return (
    <>
      <TabHeader
        id="empresas"
        title="Empresas"
        lede="Cuántas empresas hay, cuáles son las más grandes, quiénes son sus dueños, qué comunican a la bolsa, cómo comercia Bolivia con el mundo, cómo las ve el público y qué publican en sus redes. Cada página dice quién mide y cuánto confiar."
      />
      <SubSections
        enlace
        labels={[
          'Tejido empresarial',
          'Principales empresas',
          'Empresarios',
          'Bolsa de valores (BBV)',
          'Comercio exterior',
          'Detalle aduanero (INE)',
          'Reputación empresarial',
          'Redes sociales',
          'Ventas en vivo',
        ]}
        icons={['capas', 'barras', 'maletin', 'velas', 'globo', 'cajas', 'escudo', 'personas', 'tienda']}
      >
        <BusinessFabricSection />
        <LargestCompaniesSection />
        <BusinessOwnersSection />
        <FilingsPage />
        <ForeignTradeSection />
        <TradeRecordsSection />
        <ReputationSection />
        <CompanySocialSection />
        <LiveCommerceSection />
      </SubSections>
    </>
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

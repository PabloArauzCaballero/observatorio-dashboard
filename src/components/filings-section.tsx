'use client';

import { BusinessFabricSection } from './business-fabric-section';
import { BusinessOwnersSection } from './business-owners-section';
import { CompanySocialSection } from './company-social-explorer';
import { ReputationSection } from './exporters-section';
import { BbvCompanyPage } from './bbv-company-page';
import { LargestCompaniesSection } from './largest-companies-section';
import { SubSections } from './site-layout';
import { TabHeader } from '@/components/ui/tab-header';

/**
 * El capítulo de empresas, con sus tres registros.
 *
 * El primero es el registro de la **Bolsa Boliviana de Valores**: lo que sus
 * emisores están obligados a comunicar, que no es el universo de empresas del
 * país sino las que acuden al mercado de valores. Otra página es el monitor de
 * **reputación**, que
 * mide percepción con encuestas y cuya cabeza son marcas de consumo que ni
 * cotizan ni exportan: se queda aparte porque mide algo distinto.
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
 * tejido empresarial; las demás esperan a que el lector llegue a ellas.
 */
export function FilingsSection() {
  return (
    <>
      <TabHeader
        id="empresas"
        title="Empresas"
        lede="Cuántas empresas hay, cuáles son las más grandes, quiénes son sus dueños, qué comunican a la bolsa, cómo las ve el público y qué publican en sus redes. Cada página dice quién mide y cuánto confiar."
      />
      <SubSections
        enlace
        labels={[
          'Tejido empresarial',
          'Principales empresas',
          'Empresarios',
          'Bolsa de valores (BBV)',
          'Reputación empresarial',
          'Redes sociales',
        ]}
        icons={['capas', 'barras', 'maletin', 'velas', 'escudo', 'personas']}
      >
        <BusinessFabricSection />
        <LargestCompaniesSection />
        <BusinessOwnersSection />
        <BbvCompanyPage />
        <ReputationSection />
        <CompanySocialSection />
      </SubSections>
    </>
  );
}

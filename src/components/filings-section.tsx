'use client';

import { CompanySocialSection } from './company-social-explorer';
import { ReputationSection } from './exporters-section';
import { BbvCompanyPage } from './bbv-company-page';
import { SubTabs } from './tabs';

/**
 * El capítulo de empresas, con sus tres lecturas.
 *
 * El primero es el registro de la **Bolsa Boliviana de Valores**: lo que sus
 * emisores están obligados a comunicar, que no es el universo de empresas del
 * país sino las que acuden al mercado de valores. El segundo es el monitor de
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
 * `SubTabs` monta sólo la página activa, así que abrir «Empresas» sigue pidiendo
 * únicamente los hechos relevantes; las otras dos esperan a que alguien las
 * elija.
 */
export function FilingsSection() {
  return (
    <SubTabs
      enlace
      labels={[
        'Bolsa de valores (BBV)',
        'Reputación empresarial',
        'Redes sociales',
      ]}
      icons={['velas', 'escudo', 'personas']}
    >
      <BbvCompanyPage />
      <ReputationSection />
      <CompanySocialSection />
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

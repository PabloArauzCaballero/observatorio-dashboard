'use client';

import { OnOpenNotice, useOnOpen } from './on-open';
import { PressExplorer } from './press-explorer';
import { SubjectsExplorer } from './subjects-explorer';
import { SubTabs } from './tabs';
import type { PressArticle, PressCube, TermMonth, TermTotal } from '@/lib/series';

/**
 * El archivo de prensa, con sus dos lecturas.
 *
 * Dos lecturas de un mismo archivo: las notas, y de qué habló el país en ellas
 * mes a mes. Entre las dos pesaban **2,75 MB** del informe —medidos el
 * 2026-09-22, y de ellos 1,85 los temas, que es la sección más pesada de las
 * siete pestañas— para un capítulo que hay que abrir a propósito.
 *
 * Cada página se pide al montarse, y `SubTabs` monta sólo la activa: abrir
 * «Prensa» trae la cobertura, y los temas esperan al segundo clic. Los que nunca
 * lo dan no los descargan nunca.
 */
export function PressSection() {
  return (
    <SubTabs labels={['Cobertura', 'Temas']} icons={['ventana', 'etiqueta']}>
      <CoveragePanel />
      <SubjectsPanel />
    </SubTabs>
  );
}

/** Las notas: el cubo que responde «cuántas» y la primera página de tarjetas. */
function CoveragePanel() {
  const { payload, failed } = useOnOpen<{
    cube: PressCube;
    articles: PressArticle[];
    span: {
      total: number;
      outlets: number;
      firstDay: string | null;
      lastDay: string | null;
      unmarked: { archive: number; live: number; archiveLength: number; liveLength: number };
    };
  }>('/api/archivo');

  if (!payload) return <OnOpenNotice what="el archivo de prensa" failed={failed} />;

  if (!payload.articles.length) {
    return <div className="callout">Todavía no hay cobertura de prensa cargada.</div>;
  }

  return <PressExplorer cube={payload.cube} initialArticles={payload.articles} span={payload.span} />;
}

/** De qué se habló: cada término, mes a mes, con el tono con que se escribió. */
function SubjectsPanel() {
  const { payload, failed } = useOnOpen<{ months: TermMonth[]; totals: TermTotal[] }>('/api/temas');

  if (!payload) return <OnOpenNotice what="los temas de prensa" failed={failed} />;

  return <SubjectsExplorer months={payload.months} totals={payload.totals} />;
}

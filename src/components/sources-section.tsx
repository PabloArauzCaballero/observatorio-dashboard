'use client';

import { OnOpenNotice, useOnOpen } from './on-open';
import { SourcesExplorer } from './sources-explorer';
import type { SourceNote } from '@/lib/series';

/**
 * El capítulo del método, pedido al abrir su pestaña.
 *
 * Mil seiscientas ochenta notas de fuente con su dirección de publicación: 778
 * KB del informe, en la séptima de siete pestañas. Es lo que hay que leer para
 * comprobar de dónde sale cada cifra, y casi nunca lo primero que alguien abre.
 */
export function SourcesSection() {
  const { payload, failed } = useOnOpen<{
    sources: SourceNote[];
    readingCount: number;
    /** The day the parallel source swapped its two labels, when it did. */
    reversal: string | null;
  }>('/api/fuentes');

  if (!payload) return <OnOpenNotice what="las fuentes" failed={failed} />;

  return (
    <SourcesExplorer
      sources={payload.sources}
      readingCount={payload.readingCount}
      reversal={payload.reversal}
    />
  );
}

'use client';

import { OnOpenNotice, useOnOpen } from './on-open';
import { TradeRecordsExplorer } from './trade-records-explorer';
import type { TradeCodes } from '@/lib/trade-records';

/**
 * «Detalle aduanero (INE)», pedida al abrir su página dentro de «Macroeconomía».
 *
 * Primero el catálogo —los nombres de países, departamentos y clasificaciones,
 * y qué años trae cada flujo— y después, ya dentro del explorador, una lectura
 * por cada cambio de filtro. Si el núcleo aún no construyó la base en este
 * servidor, el catálogo llega vacío y se dice, en vez de dibujar ceros.
 */
export function TradeRecordsSection() {
  const { payload, failed } = useOnOpen<TradeCodes>('/api/comercio-exterior/aduana/catalogo');
  if (!payload) {
    return <OnOpenNotice what="la base aduanera del INE" failed={failed} />;
  }
  if (!payload.coverage.length) {
    return (
      <div className="callout">
        No hay declaraciones aduaneras disponibles en este momento.
      </div>
    );
  }
  return <TradeRecordsExplorer catalogue={payload} />;
}

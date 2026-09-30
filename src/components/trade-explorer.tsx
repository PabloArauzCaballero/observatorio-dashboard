'use client';

import { MarketsExplorer } from './markets-explorer';
import { PaymentsExplorer } from './payments-explorer';
import { SubTabs } from './tabs';
import { TerritoryExplorer } from './territory-explorer';
import type { ChannelMix, TradeCoverage, TradeGap, TradeReading } from '@/lib/series';

/**
 * The trade chapter: one subject, three pages.
 *
 * Commerce, settlement and territory are the same question asked three times —
 * how does this country buy and sell, what does it pay with, and where was any
 * of that measured. They were three top-level tabs for an afternoon and read as
 * three subjects, which they are not: a reader who opens «Mercados» and never
 * clicks «Pagos» misses the half that says whether a sale left a record.
 */
export function TradeExplorer({
  coverage,
  mix,
  readings,
  gap,
}: {
  coverage: TradeCoverage[];
  mix: ChannelMix[];
  readings: TradeReading[];
  gap: TradeGap[];
}) {
  return (
    <SubTabs labels={['Comercio', 'Pagos', 'Territorio']} icons={['tienda', 'monedas', 'capas']}>
      <MarketsExplorer coverage={coverage} mix={mix} readings={readings} gap={gap} />
      <PaymentsExplorer readings={readings} />
      <TerritoryExplorer readings={readings} />
    </SubTabs>
  );
}

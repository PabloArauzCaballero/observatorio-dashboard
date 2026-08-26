'use client';

import { Sparkline } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { MarketSeries } from '@/lib/series';

/**
 * The markets a Bolivian reader has to watch, and why each one is here.
 *
 * Colour is doing work rather than decoration. Each card carries the hue of
 * what it measures — gold warm, the market rate orange, the administered blue —
 * and the tint is the same one that hue has everywhere else in the report, so a
 * reader who has learned the palette on the exchange-rate charts does not have
 * to learn it again here.
 *
 * Tether is the card that needs its caption most. A stablecoin sitting at one
 * dollar looks like no news, and that is exactly the news: with the official
 * rate rationed, USDT is a channel through which dollars are actually obtained,
 * so the peg holding is a fact about the parallel market. The card states the
 * deviation in basis points rather than a percentage that would round to zero.
 */

const TONE: Record<string, { accent: string; tint: string; icon: IconName }> = {
  XAU_USD: { accent: 'var(--parallel)', tint: 'rgb(194 85 31 / 0.07)', icon: 'gema' },
  BTC_USD: { accent: 'var(--gap)', tint: 'rgb(122 81 151 / 0.07)', icon: 'monedas' },
  USDT_USD: { accent: 'var(--official)', tint: 'rgb(27 79 156 / 0.07)', icon: 'balanza' },
};

const CAPTION: Record<string, string> = {
  XAU_USD: 'Token redimible por una onza asignada; sigue al contado',
  BTC_USD: 'Cierre diario en dólares',
  USDT_USD: 'Dos estables anclados al dólar; su desvío mide tensión en el canal cripto',
};

const number = (value: number, decimals: number): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

function headline(series: MarketSeries): string {
  if (series.code === 'USDT_USD') return number(series.latest, 4);
  if (series.latest >= 1_000) return number(series.latest, 0);
  return number(series.latest, 2);
}

/** A peg is read in basis points; a percentage of a percent rounds to nothing. */
function deviation(series: MarketSeries): string | null {
  if (series.code !== 'USDT_USD') return null;
  const points = (series.latest - 1) * 10_000;
  return `${points > 0 ? '+' : ''}${number(points, 1)} pb entre estables`;
}

export function MarketCards({ markets }: { markets: MarketSeries[] }) {
  if (!markets.length) return null;

  return (
    <div className="market-grid">
      {markets.map((series) => {
        const tone = TONE[series.code] ?? {
          accent: 'var(--ink-soft)',
          tint: 'transparent',
          icon: 'monedas' as IconName,
        };
        const drift = deviation(series);
        return (
          <article
            className="market-card"
            key={series.code}
            style={{ background: tone.tint, borderColor: tone.accent }}
          >
            <div className="market-top" style={{ color: tone.accent }}>
              <Icon name={tone.icon} size={15} />
              <span>{series.name}</span>
              <span className="market-unit">{series.unit}</span>
            </div>
            <div className="market-figure">
              <span className="market-value">{headline(series)}</span>
              {series.changePercent === null ? null : (
                <span className={series.changePercent >= 0 ? 'delta-up' : 'delta-down'}>
                  {series.changePercent > 0 ? '+' : ''}
                  {number(series.changePercent, 2)} %
                </span>
              )}
            </div>
            <div className="market-meta">
              {drift ?? CAPTION[series.code] ?? ''}
              {series.windowPercent === null ? null : (
                <>
                  <br />
                  {series.points.length} días ·{' '}
                  <b>
                    {series.windowPercent > 0 ? '+' : ''}
                    {number(series.windowPercent, 1)} %
                  </b>{' '}
                  desde {series.points[0]?.date}
                </>
              )}
            </div>
            <Sparkline data={series.points.map((point) => point.value)} tone={tone.accent} />
          </article>
        );
      })}
    </div>
  );
}

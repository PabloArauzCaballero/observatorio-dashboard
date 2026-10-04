'use client';

import { Sparkline } from './charts';
import { Panel } from '@/components/ui/panel';
import type { MarketCard } from '@/lib/market-transport';

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

/*
 * Tres fichas, tres casillas de identidad: son exactamente las tres que la
 * paleta garantiza distinguibles una contra otra en los dos modos, que es la
 * prueba dura —la que aplica cuando dos marcas cualesquiera pueden quedar lado
 * a lado, como aquí—.
 *
 * El lavado del fondo se saca del propio acento en vez de estar escrito a mano
 * en rgb. Los tres rgb que había eran los hexadecimales viejos copiados a mano:
 * al re-escalar la paleta se quedaron apuntando a colores que ya no existen, y
 * además no cambiaban en modo oscuro, así que el lavado claro seguía ahí sobre
 * un panel negro. Derivado del token, el lavado sigue al acento a donde vaya.
 */
const TONE: Record<string, { accent: string }> = {
  XAU_USD: { accent: 'var(--parallel)' },
  BTC_USD: { accent: 'var(--gap)' },
  USDT_USD: { accent: 'var(--official)' },
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

function headline(series: MarketCard): string {
  if (series.code === 'USDT_USD') return number(series.latest, 4);
  if (series.latest >= 1_000) return number(series.latest, 0);
  return number(series.latest, 2);
}

/** A peg is read in basis points; a percentage of a percent rounds to nothing. */
function deviation(series: MarketCard): string | null {
  if (series.code !== 'USDT_USD') return null;
  const points = (series.latest - 1) * 10_000;
  return `${points > 0 ? '+' : ''}${number(points, 1)} pb entre estables`;
}

export function MarketCards({ markets }: { markets: MarketCard[] }) {
  if (!markets.length) return null;

  return (
    <Panel
      id="mercados-dolar"
      title="Oro, bitcoin y estables frente al dólar (USD)"
      lede="Tres mercados cotizados en dólares. No se suman ni se comparan entre sí: cada tarjeta se lee contra su propia historia."
      source="cierre diario de cada mercado (mediana de las lecturas que guarda el Observatorio); el catálogo de fuentes está en «Método»"
      data={{
        unidad: 'USD',
        columnas: [
          'Mercado',
          'Unidad',
          'Último (USD)',
          'Fecha',
          'Cambio del día (%)',
          'Cambio en la ventana (%)',
          'Jornadas',
          'Desde',
        ],
        filas: markets.map((series) => [
          series.name,
          series.unit,
          series.latest,
          series.latestDate,
          series.changePercent,
          series.windowPercent,
          series.days,
          series.firstDate,
        ]),
      }}
    >
      <div className="market-grid">
        {markets.map((series) => {
          const tone = TONE[series.code] ?? { accent: 'var(--ink-soft)' };
          const drift = deviation(series);
          return (
            <article
              className="market-card"
              key={series.code}
              style={{ '--quote-accent': tone.accent } as React.CSSProperties}
            >
              <div className="market-top">
                <span className="quote-dot" aria-hidden="true" />
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
                    {series.days} días ·{' '}
                    <b>
                      {series.windowPercent > 0 ? '+' : ''}
                      {number(series.windowPercent, 1)} %
                    </b>{' '}
                    desde {series.firstDate}
                  </>
                )}
              </div>
              <Sparkline data={series.spark} tone={tone.accent} />
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

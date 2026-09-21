/**
 * Las fichas estables cuyo mercado en bolivianos se comprueba, y qué se halló.
 *
 * Esto existe porque una ficha que no tiene línea en el gráfico no se distingue,
 * a ojo, de una ficha que nadie se molestó en mirar. Las dos se ven igual: no
 * están. Y la diferencia importa más que la línea, porque «USDe no cotiza en
 * bolivianos» es un dato sobre el mercado boliviano, mientras que «USDe falta»
 * es un dato sobre este tablero.
 *
 * El recolector del núcleo pide **todas** estas fichas en cada corrida y publica
 * las que devuelven libro, de modo que ninguna depende de esta tabla para
 * aparecer: el día que una de las vacías abra mercado, su línea se dibuja sola y
 * su entrada de aquí deja de usarse porque ya habrá serie. Esta tabla solo dice
 * lo que hay que contarle al lector mientras tanto.
 *
 * Espeja `STABLECOIN_MARKET_SURVEY` del núcleo (`indicator-codes.ts`). Son dos
 * repositorios y por eso son dos copias; la del núcleo manda, y la fecha de
 * abajo dice de cuándo es este recuento.
 */
export type StablecoinMarketState = 'QUOTED' | 'QUOTED_THIN' | 'ONE_SIDED' | 'NO_MARKET';

export interface StablecoinMarketEntry {
  /** La ficha, como la escribe quien la nombra: USDe, no USDE. */
  readonly label: string;
  readonly state: StablecoinMarketState;
  /** Avisos que devolvió cada lado del libro el día del recuento. */
  readonly bids: number;
  readonly asks: number;
}

/**
 * El recuento, por ficha y por lado, del día que se miró.
 *
 * Las cifras están porque son la prueba. «No hay mercado» dicho sin número es
 * una opinión; dicho como «cero avisos en los dos lados de tres plazas» es una
 * comprobación que cualquiera puede repetir.
 */
export const STABLECOIN_MARKET_SURVEY: Readonly<Record<string, StablecoinMarketEntry>> = {
  USDT: { label: 'USDT', state: 'QUOTED', bids: 146, asks: 266 },
  USDC: { label: 'USDC', state: 'QUOTED_THIN', bids: 13, asks: 33 },
  FDUSD: { label: 'FDUSD', state: 'ONE_SIDED', bids: 0, asks: 7 },
  USDS: { label: 'USDS', state: 'NO_MARKET', bids: 0, asks: 0 },
  USDE: { label: 'USDe', state: 'NO_MARKET', bids: 0, asks: 0 },
  PYUSD: { label: 'PYUSD', state: 'NO_MARKET', bids: 0, asks: 0 },
  DAI: { label: 'DAI', state: 'NO_MARKET', bids: 0, asks: 0 },
  TUSD: { label: 'TUSD', state: 'NO_MARKET', bids: 0, asks: 0 },
};

/** El día del recuento, que es lo que se cita junto a las cifras. */
export const STABLECOIN_MARKET_SURVEY_DATE = '2026-09-21';

/** Las plazas donde se buscó cada libro, dichas para que el lector las repita. */
export const STABLECOIN_MARKET_SURVEY_VENUES = ['Binance', 'Bybit', 'OKX'] as const;

/**
 * Las fichas comprobadas que hoy no tienen línea, y por qué no la tienen.
 *
 * Se calcula contra las fichas que sí trajeron datos, no contra una lista fija:
 * si mañana USDS empieza a cotizar y su serie aparece, sale de esta frase sin
 * que nadie edite nada. Al revés también — una ficha que deje de cotizar entra
 * aquí sola.
 */
export function stablecoinsWithoutSeries(
  plotted: readonly string[],
): readonly StablecoinMarketEntry[] {
  const drawn = new Set(plotted.map((token) => token.toLocaleUpperCase('en')));
  return Object.entries(STABLECOIN_MARKET_SURVEY)
    .filter(([token]) => !drawn.has(token))
    .map(([, entry]) => entry);
}

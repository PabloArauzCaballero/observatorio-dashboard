import type { MarketSeries } from './series';

/**
 * Una tarjeta de mercado, con lo que la tarjeta dibuja y nada más.
 *
 * Las tres tarjetas mandaban sus series enteras —**259 KB**, la sección más
 * pesada de lo que queda de la portada tras la carga diferida del 2026-09-22— y
 * eran unas dos mil cuatrocientas jornadas por serie para una chispa de ciento
 * veinte píxeles de ancho. Ni el lector puede resolver ese detalle ni la tarjeta
 * lo usa: de los puntos sólo saca cuántos son, en qué día empieza la ventana y
 * la forma. Las tres cosas caben en un número, una fecha y una lista corta.
 *
 * No es un recorte de la ventana. La tarjeta dice «+1.091 % desde 2019» y la
 * chispa tiene que abarcar eso mismo, así que se muestrea a lo largo de toda la
 * serie en vez de quedarse con la cola: el recuento y la fecha siguen siendo los
 * de la serie completa, que es lo que la tarjeta afirma.
 *
 * Quien quiera las jornadas una por una las tiene en la descarga, que sale de la
 * base y no de esto.
 */
export interface MarketCard {
  code: string;
  name: string;
  unit: string;
  latest: number;
  latestDate: string;
  changePercent: number | null;
  /** Change over the whole window held, which is what a two-year series is for. */
  windowPercent: number | null;
  /** Cuántas jornadas hay detrás, que es lo que la tarjeta declara. */
  days: number;
  /** El día en que empieza la ventana, para la frase «desde». */
  firstDate: string | null;
  /** La forma, muestreada a lo ancho de toda la ventana. */
  spark: number[];
}

/**
 * Cuántos puntos dibuja una chispa de tarjeta.
 *
 * Ciento veinte, que es aproximadamente un punto por píxel de ancho: por debajo
 * la línea empieza a perder giros que se ven, y por encima se dibujan dos puntos
 * en el mismo píxel.
 */
const SPARK_POINTS = 120;

/** Muestrea a lo ancho, conservando el primero y el último. */
function sample(values: readonly number[], count: number): number[] {
  if (values.length <= count) return [...values];
  const out: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = Math.round((index * (values.length - 1)) / (count - 1));
    out.push(values[at] as number);
  }
  return out;
}

export function packMarketCards(markets: readonly MarketSeries[]): MarketCard[] {
  return markets.map((series) => ({
    code: series.code,
    name: series.name,
    unit: series.unit,
    latest: series.latest,
    latestDate: series.latestDate,
    changePercent: series.changePercent,
    windowPercent: series.windowPercent,
    days: series.points.length,
    firstDate: series.points[0]?.date ?? null,
    spark: sample(
      series.points.map((point) => point.value),
      SPARK_POINTS,
    ),
  }));
}

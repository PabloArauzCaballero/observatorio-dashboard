import 'server-only';
import { pool } from './db';
import { held } from './hold';
import type { CurrencyBoard, CurrencySeries } from './currencies-board';

/**
 * El boliviano frente a las monedas del BCB, leído de `read_models.exogenous_price`.
 *
 * Es la misma vista de las variables exógenas —el sembrador es el mismo—, con
 * el grupo `CURRENCY` y una lectura por moneda y día. El tablero de exógenas
 * los excluye porque son veintitrés líneas de quince años que no le piden; éste
 * los lee solos.
 *
 * Los puntos viajan como pares `[fecha, valor]`, y la respuesta se sostiene en
 * memoria diez minutos: el BCB publica una tabla por día.
 */

interface Row {
  indicator_code: string;
  product: string;
  product_label: string;
  market: string;
  note: string;
  source_url: string | null;
  period: string;
  value: string;
}

export function readCurrencyBoard(): Promise<CurrencyBoard> {
  return held('currencies', buildCurrencyBoard);
}

async function buildCurrencyBoard(): Promise<CurrencyBoard> {
  let rows: Row[];
  try {
    ({ rows } = await pool().query<Row>(
      `SELECT indicator_code, product, product_label, market, note, source_url, period, value::text
       FROM read_models.exogenous_price
       WHERE exogenous_group = 'CURRENCY'
       ORDER BY indicator_code, period`,
    ));
  } catch (error) {
    // Un modelo que todavía no existe es un capítulo vacío que lo dice, no un informe caído.
    const code = (error as { code?: string }).code;
    if (code === '42P01' || code === '42501' || code === '42703') {
      console.warn(`[observatorio] modelo ilegible: monedas (${code})`);
      return { series: [], latestDate: null };
    }
    throw error;
  }

  const byCode = new Map<string, CurrencySeries>();
  let latestDate: string | null = null;
  for (const row of rows) {
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    let series = byCode.get(row.indicator_code);
    if (!series) {
      series = {
        iso: row.product,
        label: row.product_label,
        country: row.market,
        note: row.note,
        sourceUrl: row.source_url,
        points: [],
      };
      byCode.set(row.indicator_code, series);
    }
    series.points.push([row.period, value]);
    series.sourceUrl = row.source_url;
    if (!latestDate || row.period > latestDate) latestDate = row.period;
  }
  const series = [...byCode.values()];
  spliceYuan(series);
  return { series, latestDate };
}

/**
 * Entre 2017 y 2024 el BCB dejó vacía la fila del yuan (CNY) y publicó sólo la
 * del yuan que se negocia fuera de China (CNH). Son la misma moneda y se
 * mueven en décimas, y un gráfico del yuan con siete años en blanco no sirve a
 * quien comercia con China. Los días sin CNY se llenan con el CNH, y la serie
 * lo dice; ningún otro día se toca.
 */
function spliceYuan(series: CurrencySeries[]): void {
  const onshore = series.find((one) => one.iso === 'CNY');
  const offshore = series.find((one) => one.iso === 'CNH');
  if (!onshore || !offshore) return;
  const have = new Set(onshore.points.map(([date]) => date));
  const first = onshore.points[0]?.[0] ?? '';
  const borrowed = offshore.points.filter(([date]) => !have.has(date) && date >= first);
  if (!borrowed.length) return;
  onshore.points = [...onshore.points, ...borrowed].sort((left, right) =>
    left[0].localeCompare(right[0]),
  );
  onshore.spliced = `Entre ${borrowed[0]?.[0].slice(0, 4)} y ${borrowed.at(-1)?.[0].slice(0, 4)} el BCB dejó vacía la fila del yuan (CNY) y publicó sólo la del yuan offshore (CNH); en esos ${borrowed.length} días la línea usa el CNH, que difiere en décimas.`;
}

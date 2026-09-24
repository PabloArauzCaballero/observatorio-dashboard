import 'server-only';
import { pool } from './db';
import { held } from './hold';
import type { ExogenousBoard, ExogenousSeries } from './exogenous-board';

/**
 * Los precios que Bolivia no fija, leídos de `read_models.exogenous_price`.
 *
 * Una sola consulta y el tablero entero: son unas cien series y veinticinco mil
 * puntos, y la vista ya deja una fila por serie y periodo —la revisión más
 * reciente de cada mes—. Se sostiene en memoria diez minutos como el resto de
 * los capítulos que se piden al abrirse; los publicadores actualizan una vez al
 * mes.
 *
 * Los puntos viajan como pares `[periodo, valor]` y no como objetos: el tablero
 * entero son veinticinco mil, y el nombre de dos campos repetido en cada uno
 * era la mitad del peso de la respuesta.
 */

interface Row {
  indicator_code: string;
  exogenous_group: ExogenousSeries['group'];
  product: string;
  product_label: string;
  name: string;
  scope: ExogenousSeries['scope'];
  market: string;
  unit: string;
  kind: ExogenousSeries['kind'];
  frequency: ExogenousSeries['frequency'];
  publisher: string;
  note: string;
  source_url: string | null;
  period: string;
  value: string;
}

export function readExogenousBoard(): Promise<ExogenousBoard> {
  return held('exogenous', buildExogenousBoard);
}

async function buildExogenousBoard(): Promise<ExogenousBoard> {
  let rows: Row[];
  try {
    ({ rows } = await pool().query<Row>(
      `SELECT indicator_code, exogenous_group, product, product_label, name, scope, market,
              unit, kind, frequency, publisher, note, source_url, period, value::text
       FROM read_models.exogenous_price
       ORDER BY indicator_code, period`,
    ));
  } catch (error) {
    /*
     * La misma regla que las carreteras y los lugares: un modelo que todavía no
     * existe —el tablero se despliega antes que la migración del núcleo— es un
     * capítulo vacío que lo dice, no un informe que se cae.
     */
    const code = (error as { code?: string }).code;
    if (code === '42P01' || code === '42501' || code === '42703') {
      console.warn(`[observatorio] modelo ilegible: read_models.exogenous_price (${code})`);
      return { series: [], latestMonth: null };
    }
    throw error;
  }

  const bySeries = new Map<string, ExogenousSeries>();
  let latestMonth: string | null = null;
  for (const row of rows) {
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    let series = bySeries.get(row.indicator_code);
    if (!series) {
      series = {
        code: row.indicator_code,
        group: row.exogenous_group,
        product: row.product,
        productLabel: row.product_label,
        name: row.name,
        scope: row.scope,
        market: row.market,
        unit: row.unit,
        kind: row.kind,
        frequency: row.frequency,
        publisher: row.publisher,
        note: row.note,
        sourceUrl: row.source_url,
        points: [],
      };
      bySeries.set(row.indicator_code, series);
    }
    series.points.push([row.period, value]);
    if (row.frequency === 'MONTHLY' && (!latestMonth || row.period > latestMonth)) {
      latestMonth = row.period;
    }
  }
  return { series: [...bySeries.values()], latestMonth };
}

import 'server-only';
import { pool } from './db';
import { held } from './hold';
import type { MacroPoint } from './series';

/**
 * Las series anuales del tejido empresarial, leídas por rubro y aparte.
 *
 * La migración 0097 del núcleo archiva en tres rubros propios —
 * `TEJIDO_EMPRESARIAL`, `RANKING_EMPRESARIAL` y `FORTUNAS`— unas cuarenta mil
 * lecturas: el registro de comercio abierto por tipo, departamento y
 * actividad, el padrón y el ránking de Impuestos, «Las 500» y las
 * participaciones accionarias. Son más que todo el resto de la lectura anual
 * junta, y esa lectura se sostiene en memoria para «Macroeconomía», el
 * asistente y media docena de rutas que no las necesitan. Por eso
 * `readMacroAnnual` las deja fuera y estas páginas las piden con su propio
 * filtro: cada una paga sólo lo suyo, y lo de las demás no viaja.
 *
 * La copia guardada primero y la vista después, como el resto de las lecturas
 * anuales. Un modelo que todavía no existe —el tablero se despliega a veces
 * antes que la migración— vuelve vacío en vez de tumbar la página.
 */

export const BUSINESS_SECTORS = ['TEJIDO_EMPRESARIAL', 'RANKING_EMPRESARIAL', 'FORTUNAS'] as const;
export type BusinessSector = (typeof BUSINESS_SECTORS)[number];

interface Row {
  indicator_code: string;
  indicator_name: string;
  sector: string;
  period: string;
  unit: string;
  value: string;
  publisher: string | null;
  source_url: string | null;
}

const UNREADABLE = new Set(['42P01', '42501', '42703']);

async function readFrom(relation: string, sectors: readonly string[]): Promise<Row[]> {
  const { rows } = await pool().query<Row>(
    `SELECT indicator_code, indicator_name, sector, period, unit, value::text AS value,
            publisher, source_url
     FROM ${relation}
     WHERE sector = ANY($1::text[])
     ORDER BY indicator_code, period`,
    [sectors],
  );
  return rows;
}

async function build(sectors: readonly BusinessSector[]): Promise<MacroPoint[]> {
  let rows: Row[];
  try {
    rows = await readFrom('read_models.macro_indicator_annual_snapshot', sectors);
    /*
     * La copia guardada se llena en el arranque del núcleo. Recién migrada
     * existe pero está vacía —`WITH NO DATA`— y leerla da un error y no cero
     * filas; vacía después de llenarse sí puede estar si el refresco todavía no
     * corrió con estas series, y entonces la vista es la verdad.
     */
    if (!rows.length) rows = await readFrom('read_models.macro_indicator_annual', sectors);
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code !== '55000' && !UNREADABLE.has(code)) throw error;
    try {
      rows = await readFrom('read_models.macro_indicator_annual', sectors);
    } catch (fallback) {
      const second = (fallback as { code?: string }).code ?? '';
      if (!UNREADABLE.has(second)) throw fallback;
      console.warn(`[observatorio] lectura anual ilegible para ${sectors.join(', ')} (${second})`);
      return [];
    }
  }
  return rows.map((row) => ({
    indicatorCode: row.indicator_code,
    name: row.indicator_name,
    sector: row.sector,
    period: row.period,
    unit: row.unit,
    value: Number(row.value),
    previousValue: null,
    changePercent: null,
    publisher: row.publisher,
    sourceUrl: row.source_url,
  }));
}

/** Las lecturas de uno o varios rubros del tejido empresarial, sostenidas en memoria. */
export function readBusinessAnnual(...sectors: BusinessSector[]): Promise<MacroPoint[]> {
  const wanted = [...sectors].sort();
  return held(`business-annual:${wanted.join('+')}`, () => build(wanted));
}

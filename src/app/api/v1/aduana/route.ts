import {
  paginate,
  parseListParam,
  parseMonthRange,
  parseYearParam,
} from '@/lib/api-v1/contrato';
import { BadParam, OPTIONS, accept, serve } from '@/lib/api-v1/responder';
import { readTradeCodes, readTradeViews } from '@/lib/trade-records';
import { DIMENSIONS, parseQuery, type Dimension, type FilterKey } from '@/lib/trade-records-query';

/**
 * La base aduanera del INE sumada por una dimensión, con la misma lectura que
 * «Detalle aduanero»: `por=country&flujo=X&desde=2020&hasta=2025` da las
 * exportaciones por país. Los filtros se validan contra la lista blanca de
 * `trade-records-query.ts` y viajan como parámetros de la consulta.
 *
 * Como en el panel, el filtro de la misma dimensión no recorta su propio
 * desglose; y una combinación que el INE no publica (importaciones por país y
 * departamento a la vez) vuelve con el motivo, no vacía.
 *
 * El panel descarta en silencio un código mal escrito; la API no: un filtro
 * que se ignora da una suma que parece la pedida y no lo es, así que es un 400.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { OPTIONS };

/** Cuántas filas suma la base por pedido; la página se corta después. */
const MAX_ITEMS = 5_000;

/** Códigos por filtro, los mismos que admite el panel. */
const MAX_CODES = 40;

const FIRST_YEAR = 1990;
const LAST_YEAR = 2100;

/** Los nombres de la API, en castellano, hacia los de la lectura del panel. */
const FILTERS: ReadonlyArray<readonly [string, FilterKey]> = [
  ['producto', 'product'],
  ['seccion', 'section'],
  ['pais', 'country'],
  ['departamento', 'department'],
  ['actividad', 'activity'],
  ['tradicional', 'traditional'],
  ['uso', 'use'],
  ['tipo', 'kind'],
];

export function GET(request: Request): Promise<Response> {
  return serve(request, 'aduana', async ({ params, offset, pageSize }) => {
    const by = (params.get('por') ?? '').trim();
    if (!by) throw BadParam.missing('por', `la dimensión del desglose, una de: ${DIMENSIONS.join(', ')}`);
    if (!(DIMENSIONS as readonly string[]).includes(by)) {
      throw BadParam.invalid('por', `es una de: ${DIMENSIONS.join(', ')}`);
    }
    const flujo = (params.get('flujo') ?? 'X').trim() || 'X';
    if (flujo !== 'X' && flujo !== 'M') {
      throw BadParam.invalid('flujo', 'es «X» (exportaciones) o «M» (importaciones)');
    }
    const desde = accept(parseYearParam('desde', params.get('desde'), FIRST_YEAR, LAST_YEAR));
    const hasta = accept(parseYearParam('hasta', params.get('hasta'), FIRST_YEAR, LAST_YEAR));
    if (desde !== undefined && hasta !== undefined && desde > hasta) {
      throw BadParam.invalid('desde', 'no puede ser posterior a «hasta»');
    }
    const meses = accept(parseMonthRange('meses', params.get('meses')));

    const translated = new URLSearchParams({ flow: flujo });
    if (desde !== undefined) translated.set('from', String(desde));
    if (hasta !== undefined) translated.set('to', String(hasta));
    if (meses !== undefined) translated.set('months', meses);
    const asked = new Map<string, string[]>();
    for (const [mine, theirs] of FILTERS) {
      const values = accept(parseListParam(mine, params.get(mine), { limit: MAX_CODES, maxLength: 12 }));
      asked.set(mine, values);
      if (values.length) translated.set(theirs, values.join(','));
    }
    const query = parseQuery(translated);
    // `parseQuery` deja fuera lo que no tiene la forma de un código del INE.
    for (const [mine, theirs] of FILTERS) {
      const kept = new Set(query.filters[theirs]);
      const dropped = (asked.get(mine) ?? []).find((value) => !kept.has(value));
      if (dropped !== undefined) {
        throw BadParam.invalid(mine, `«${dropped.slice(0, 12)}» no es un código del INE para este filtro`);
      }
    }

    const [views, codes] = await Promise.all([
      readTradeViews(query, [{ name: 'v', by: by as Dimension, limit: MAX_ITEMS }]),
      readTradeCodes(),
    ]);
    const view = views['v'];
    if (view?.unavailable) throw new BadParam('por', view.unavailable);
    const rows = (view?.items ?? []).map((item) => ({
      codigo: item.key,
      nombre: item.label,
      usd: item.usd,
      kg: item.kg,
      kg_finos: item.fineKg,
      usd_ultimo_anio: item.lastUsd,
      usd_anio_anterior: item.priorUsd,
    }));
    // El último mes que la base tiene para el grano que respondió: el INE
    // publica una vez al mes y la base no guarda la hora de carga.
    const coverage = codes.coverage.find((one) => one.grain === view?.grain);
    // El tramo que de verdad se sumó: el pedido, recortado a los años que hay.
    const from = coverage ? Math.max(query.from, coverage.first) : query.from;
    const to = coverage ? Math.min(query.to, coverage.last) : query.to;
    const { data, siguiente } = paginate(rows, offset, pageSize);
    return {
      data,
      siguiente,
      fuente: `Instituto Nacional de Estadística, base aduanera (${flujo === 'X' ? 'exportaciones' : 'importaciones'}, ${from}-${to})`,
      actualizado: coverage ? `${coverage.last}-${String(coverage.lastMonth).padStart(2, '0')}` : null,
    };
  });
}

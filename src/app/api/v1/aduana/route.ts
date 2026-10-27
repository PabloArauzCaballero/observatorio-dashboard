import { paginate, parseList } from '@/lib/api-v1/contrato';
import { BadParam, OPTIONS, serve } from '@/lib/api-v1/responder';
import { readTradeViews } from '@/lib/trade-records';
import { DIMENSIONS, parseQuery, type Dimension } from '@/lib/trade-records-query';

/**
 * La base aduanera del INE sumada por una dimensión, con la misma lectura que
 * «Detalle aduanero»: `por=country&flujo=X&desde=2020&hasta=2025` da las
 * exportaciones por país. Los filtros se validan contra la lista blanca de
 * `trade-records-query.ts` y viajan como parámetros de la consulta.
 *
 * Como en el panel, el filtro de la misma dimensión no recorta su propio
 * desglose; y una combinación que el INE no publica (importaciones por país y
 * departamento a la vez) vuelve con el motivo, no vacía.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { OPTIONS };

/** Cuántas filas suma la base por pedido; la página se corta después. */
const MAX_ITEMS = 5_000;

/** Los nombres de la API, en castellano, hacia los de la lectura del panel. */
const FILTERS: ReadonlyArray<[string, string]> = [
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
    const by = params.get('por') ?? '';
    if (!DIMENSIONS.includes(by as Dimension)) {
      throw new BadParam(`por es una de: ${DIMENSIONS.join(', ')}.`);
    }
    const flujo = params.get('flujo') ?? 'X';
    if (flujo !== 'X' && flujo !== 'M') throw new BadParam('flujo es X (exportaciones) o M (importaciones).');

    const translated = new URLSearchParams({ flow: flujo });
    for (const [mine, theirs] of [['desde', 'from'], ['hasta', 'to'], ['meses', 'months']] as const) {
      const value = params.get(mine);
      if (value) translated.set(theirs, value.slice(0, 10));
    }
    for (const [mine, theirs] of FILTERS) {
      const values = parseList(params.get(mine), 40, 12);
      if (values.length) translated.set(theirs, values.join(','));
    }
    const query = parseQuery(translated);
    const views = await readTradeViews(query, [{ name: 'v', by: by as Dimension, limit: MAX_ITEMS }]);
    const view = views['v'];
    if (view?.unavailable) throw new BadParam(view.unavailable);
    const rows = (view?.items ?? []).map((item) => ({
      codigo: item.key,
      nombre: item.label,
      usd: item.usd,
      kg: item.kg,
      kg_finos: item.fineKg,
      usd_ultimo_anio: item.lastUsd,
      usd_anio_anterior: item.priorUsd,
    }));
    return {
      ...paginate(rows, offset, pageSize),
      fuente: `Instituto Nacional de Estadística, base aduanera (${flujo === 'X' ? 'exportaciones' : 'importaciones'}, ${query.from}-${query.to})`,
      actualizado: null,
    };
  });
}

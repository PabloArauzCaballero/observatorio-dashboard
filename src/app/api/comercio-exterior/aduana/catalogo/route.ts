import { jsonResponse } from '@/lib/respond';
import { isUnaffordableRead } from '@/lib/series';
import { readTradeCodes, searchProducts } from '@/lib/trade-records';

/**
 * Los nombres y la cobertura de la base aduanera, para los filtros.
 *
 * Sin parámetros: las listas de códigos (países, departamentos, capítulos,
 * clasificaciones) y qué años y meses trae cada grano. Con `?buscar=litio` o
 * `?buscar=2836`: las partidas NANDINA cuyo nombre o código coincide, para el
 * buscador de productos.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const text = new URL(request.url).searchParams.get('buscar');
  try {
    const body = text === null ? await readTradeCodes() : { products: await searchProducts(text) };
    return jsonResponse(request, body, { headers: { 'Cache-Control': 'private, max-age=600' } });
  } catch (error) {
    console.error('[observatorio] catálogo aduanero ilegible', error);
    return Response.json(
      { error: 'No se pudo leer el catálogo aduanero' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

import { buildForeignTradeBoard } from '@/lib/foreign-trade-board';
import { isUnaffordableRead, readMacroAnnual } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * El comercio exterior agregado ante Naciones Unidas, pedido al abrir
 * «Comercio exterior», la cuarta página de «Empresas».
 *
 * Se filtra por el prefijo del código y no por el sector: hoy las dos series
 * agregadas están en el sector EXTERNO, que también lleva deuda, remesas e
 * inversión extranjera directa, y el desglose por producto y por socio que
 * está sembrando el núcleo puede llegar filiado distinto. El prefijo
 * `COMTRADE_` es lo único de lo que este archivo puede estar seguro.
 *
 * Lee la misma vista anual que «Macroeconomía» y «Bolivia por departamento»,
 * sostenida en memoria por `readMacroAnnual`: abrir esta pestaña no añade una
 * consulta si alguna de las otras dos ya la hizo.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const macro = await readMacroAnnual();
    const board = buildForeignTradeBoard(
      macro.filter((point) => point.indicatorCode.startsWith('COMTRADE_')),
    );
    return jsonResponse(
      request,
      { board },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] comercio exterior ilegible', error);
    return Response.json(
      { error: 'No se pudo leer el comercio exterior' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

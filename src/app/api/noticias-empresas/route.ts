import { readAbiNews } from '@/lib/abi-news';
import { abiCsv, abiSelection } from '@/lib/abi-news-query';
import { FREE_ROW_CAP, freeCut, freeCutNote } from '@/lib/plans';
import { jsonResponse } from '@/lib/respond';

export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  let selection;
  try { selection = abiSelection(params); }
  catch { return Response.json({ error: 'Los filtros de noticias no son válidos.' }, { status: 400 }); }
  const format = params.get('formato');
  if (format && !['csv', 'json'].includes(format)) return Response.json({ error: 'Formato inválido.' }, { status: 400 });
  try {
    const page = await readAbiNews(selection, Boolean(format));
    // Las descargas, sin un plan, llevan quinientas noticias; la vista de la página no cambia.
    const cut = format ? freeCut(page.articles) : null;
    const note = cut?.recortado ? freeCutNote(cut.total) : null;
    if (format === 'csv') return new Response(abiCsv(cut?.filas ?? page.articles), { headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="noticias-abi.csv"',
      'Cache-Control': 'no-store', 'X-Total-Count': String(page.total),
      ...(note ? { 'X-Plan-Limit': String(FREE_ROW_CAP) } : {}),
    } });
    const body = format === 'json' && cut ? { ...page, articles: cut.filas, ...(note ? { plan_gratuito: { tope: FREE_ROW_CAP, aviso: note } } : {}) } : page;
    return jsonResponse(request, body, { headers: { 'Cache-Control': 'private, max-age=60',
      ...(format === 'json' ? { 'Content-Disposition': 'attachment; filename="noticias-abi.json"' } : {}) } });
  } catch (error) {
    if (error instanceof Error && error.message === 'ABI_EXPORT_TOO_LARGE')
      return Response.json({ error: 'La exportación admite hasta 10.000 noticias: acotar el periodo o el emisor.' }, { status: 422 });
    console.error('[observatorio] noticias ABI no disponibles', (error as { code?: string }).code ?? 'READ_FAILED');
    return Response.json({ error: 'Las noticias ABI no están disponibles en este momento.' }, { status: 503 });
  }
}

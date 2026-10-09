import { readAbiNews } from '@/lib/abi-news';
import { abiCsv, abiSelection } from '@/lib/abi-news-query';
import { jsonResponse } from '@/lib/respond';

export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  let selection;
  try { selection = abiSelection(params); }
  catch { return Response.json({ error: 'Revisa los filtros de noticias.' }, { status: 400 }); }
  const format = params.get('formato');
  if (format && !['csv', 'json'].includes(format)) return Response.json({ error: 'Formato inválido.' }, { status: 400 });
  try {
    const page = await readAbiNews(selection, Boolean(format));
    if (format === 'csv') return new Response(abiCsv(page.articles), { headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="noticias-abi.csv"',
      'Cache-Control': 'no-store', 'X-Total-Count': String(page.total),
    } });
    return jsonResponse(request, page, { headers: { 'Cache-Control': 'private, max-age=60',
      ...(format === 'json' ? { 'Content-Disposition': 'attachment; filename="noticias-abi.json"' } : {}) } });
  } catch (error) {
    if (error instanceof Error && error.message === 'ABI_EXPORT_TOO_LARGE')
      return Response.json({ error: 'Elige un periodo o emisor para exportar hasta 10.000 noticias.' }, { status: 422 });
    console.error('[observatorio] noticias ABI no disponibles', (error as { code?: string }).code ?? 'READ_FAILED');
    return Response.json({ error: 'Las noticias ABI no están disponibles en este momento.' }, { status: 503 });
  }
}

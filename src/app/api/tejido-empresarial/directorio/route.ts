import { readBusinessDirectory } from '@/lib/business-directory';
import { jsonResponse } from '@/lib/respond';
import { isUnaffordableRead } from '@/lib/series';

export const dynamic = 'force-dynamic';

function pageNumber(value: string | null): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  try {
    const result = await readBusinessDirectory({
      department: url.searchParams.get('departamento') ?? '',
      municipality: url.searchParams.get('municipio') ?? '',
      search: url.searchParams.get('buscar') ?? '',
      word: url.searchParams.get('palabra') ?? '',
      page: pageNumber(url.searchParams.get('pagina')),
      pageSize: 10,
    });
    return jsonResponse(request, result, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (error) {
    console.error('[observatorio] directorio empresarial ilegible', error);
    return Response.json(
      { error: 'No se pudo leer el directorio empresarial' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

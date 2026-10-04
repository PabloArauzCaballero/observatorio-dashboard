import { PassThrough, Readable } from 'node:stream';
import { readBusinessDirectoryForExport } from '@/lib/business-directory';
import { writeBusinessDirectoryWorkbook } from '@/lib/business-directory-workbook';
import { isUnaffordableRead } from '@/lib/series';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  try {
    const { rows, meta } = await readBusinessDirectoryForExport({
      department: url.searchParams.get('departamento') ?? '',
      municipality: url.searchParams.get('municipio') ?? '',
      search: url.searchParams.get('buscar') ?? '',
      word: url.searchParams.get('palabra') ?? '',
    });
    if (rows.length === 0) return Response.json({ error: 'La selección no contiene empresas' }, { status: 404 });
    if (!meta.redistributable) {
      return Response.json({ error: 'La fuente no autoriza esta descarga' }, { status: 403 });
    }

    const stream = new PassThrough();
    void writeBusinessDirectoryWorkbook(stream, rows, meta).catch((error: unknown) => stream.destroy(error as Error));
    const date = new Date().toISOString().slice(0, 10);
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="tejido-empresarial-${date}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error) {
    console.error('[observatorio] no se pudo construir el Excel empresarial', error);
    return Response.json(
      { error: 'No se pudo construir el Excel empresarial' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

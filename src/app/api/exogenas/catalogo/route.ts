import { readFactorCatalogue } from '@/lib/exogenous-factors';
import { FactorQueryError } from '@/lib/exogenous-factor-query';
import { jsonResponse } from '@/lib/respond';
export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> {
  try {
    return jsonResponse(request, await readFactorCatalogue(new URL(request.url).searchParams), {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof FactorQueryError
            ? error.message
            : 'No se pudo consultar el catálogo de factores.',
      },
      { status: error instanceof FactorQueryError ? 400 : 503 },
    );
  }
}

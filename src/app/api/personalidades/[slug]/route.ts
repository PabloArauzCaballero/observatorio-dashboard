import { personDetail } from '@/lib/people-data';
import { jsonResponse } from '@/lib/respond';

const SLUG = /^P_[A-Z0-9_]{2,80}$/u;

/** La ficha de una persona: evidencia, cuentas con su dirección, videos y palabras. */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params;
  const detail = SLUG.test(slug) ? personDetail(slug) : null;
  if (!detail) {
    return jsonResponse(
      request,
      { error: { code: 'NOT_FOUND', message: 'No hay ficha con ese identificador' } },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return jsonResponse(request, detail, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600' },
  });
}

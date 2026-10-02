import { readBusinessAnnual } from '@/lib/business-annual';
import { buildExportersBoard } from '@/lib/exporters-board';
import { buildLargestBoard } from '@/lib/largest-companies-board';
import { jsonResponse } from '@/lib/respond';
import { isUnaffordableRead, readMacroAnnual } from '@/lib/series';

/**
 * Las principales empresas, pedidas al abrir su página de «Empresas».
 *
 * Además del ránking manda, por empresa, dónde aparece en las otras listas del
 * capítulo —el monitor Merco y las exportadoras—, que ya están en memoria por
 * «Reputación empresarial»: cruzar no cuesta otra consulta.
 */

export const dynamic = 'force-dynamic';

/** El código de Merco o Datasur sin la forma societaria que a veces arrastra. */
const bare = (slug: string): string => slug.replace(/_(S_A|SA|S_R_L|SRL|LTDA|S_A_M|R_L)$/u, '');

export async function GET(request: Request): Promise<Response> {
  try {
    const [points, macro] = await Promise.all([readBusinessAnnual('RANKING_EMPRESARIAL'), readMacroAnnual()]);
    const board = buildLargestBoard(points);
    const others = buildExportersBoard(macro.filter((point) => point.sector === 'EMPRESARIAL'));
    const links: Record<string, { merco?: { rank: number; year: number }; exporter?: { rank: number; share: number } }> = {};
    const wanted = new Set(board.companies.map((company) => company.slug));
    const latest = others.reputationYear;
    for (const seat of others.general) {
      const slug = wanted.has(seat.slug) ? seat.slug : bare(seat.slug);
      if (!wanted.has(slug) || seat.year !== latest) continue;
      links[slug] = { ...links[slug], merco: { rank: seat.rank, year: seat.year } };
    }
    for (const row of others.exporters) {
      const slug = wanted.has(row.slug) ? row.slug : bare(row.slug);
      if (!wanted.has(slug)) continue;
      links[slug] = { ...links[slug], exporter: { rank: row.rank, share: row.share } };
    }
    return jsonResponse(
      request,
      { board, links, exportYear: others.exportYear },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] principales empresas ilegibles', error);
    return Response.json(
      { error: 'No se pudo leer el ránking de empresas' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}

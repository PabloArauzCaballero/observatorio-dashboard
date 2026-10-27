import { readAutomotiveStudy } from '@/lib/automotive-study';
import { freeCut, freeCutNote } from '@/lib/plans';

export async function GET(request: Request) {
  const payload = await readAutomotiveStudy();
  const params = new URL(request.url).searchParams;
  const name = params.get('conjunto') ?? 'offers';
  const datasets: Record<string, unknown[]> = {
    offers: payload.study.offers, dealers: payload.study.dealers,
    comparisons: payload.study.comparisons, sources: payload.study.sources,
    fleet: payload.study.fleet.departments,
  };
  if (params.get('formato') === 'csv') {
    const all = datasets[name] as Record<string, unknown>[] | undefined;
    if (!all) return Response.json({ error: 'Conjunto desconocido' }, { status: 400 });
    // Sin un plan, quinientas filas, y una columna `aviso` que lo dice.
    const cut = freeCut(all);
    const note = cut.recortado ? freeCutNote(cut.total) : null;
    const rows = note ? cut.filas.map(row => ({ ...row, aviso: note })) : cut.filas;
    const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const cell = (v: unknown) => {
      const value = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
      return `"${(/^[=+@\-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
    };
    return new Response('\uFEFF' + [columns.map(cell).join(';'), ...rows.map(row => columns.map(key => cell(row[key])).join(';'))].join('\r\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="automotor-${name}-${payload.study.observedAt}.csv"` },
    });
  }
  return Response.json(payload, { headers: { 'Cache-Control': 'public, max-age=300' } });
}

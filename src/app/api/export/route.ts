import {
  readCompanyFilings,
  readMacroAnnual,
  readObservatory,
  readPressArticles,
} from '@/lib/series';

/**
 * Every dataset the report draws, in either format.
 *
 * One route rather than six: an analyst who wants the macro series in JSON
 * should not have to learn a different address from the one that gave them the
 * exchange rates in CSV. Every row states how it was measured, so a file cannot
 * be read as one homogeneous series when it is not.
 */

export const dynamic = 'force-dynamic';

type Row = Record<string, string | number | boolean | null>;

const DATASETS = ['series', 'macro', 'filings', 'prensa'] as const;
type Dataset = (typeof DATASETS)[number];

const UNITS: Record<string, string> = {
  FX_OFFICIAL_USD_BOB: 'BOB/USD',
  FX_PARALLEL_USD_BOB: 'BOB/USD',
  UFV_BOB: 'BOB/UFV',
};

/**
 * The filters a reader had applied when they asked for the file.
 *
 * Offering a filtered view and then a file of everything is the quickest way to
 * make a reader distrust both, so the export takes the same selection the panel
 * was showing.
 */
interface Selection {
  sector?: string | undefined;
  topic?: string | undefined;
  outlet?: string | undefined;
  /** A year on the macro panel, a calendar date on the exchange-rate one. */
  from?: string | undefined;
  search?: string | undefined;
}

async function collect(dataset: Dataset, selection: Selection): Promise<Row[]> {
  if (dataset === 'macro') {
    const term = selection.search?.trim().toLocaleLowerCase('es');
    return (await readMacroAnnual())
      .filter(
        (point) =>
          (!selection.sector || point.sector === selection.sector) &&
          (selection.from === undefined || Number(point.period) >= Number(selection.from)) &&
          (!term ||
            (point.name ?? '').toLocaleLowerCase('es').includes(term) ||
            point.indicatorCode.toLocaleLowerCase('es').includes(term)),
      )
      .map((point) => ({
        rubro: point.sector,
        indicador: point.indicatorCode,
        nombre: point.name,
        periodo: point.period,
        valor: point.value,
        unidad: point.unit,
        valor_anterior: point.previousValue,
        variacion_pct: point.changePercent,
        editor: point.publisher,
        fuente: point.sourceUrl,
      }));
  }

  if (dataset === 'prensa') {
    const term = selection.search?.trim().toLocaleLowerCase('es');
    return (await readPressArticles(3_000))
      .filter(
        (article) =>
          (!selection.topic || article.topic === selection.topic) &&
          (!selection.outlet || article.outlet === selection.outlet) &&
          (selection.from === undefined || article.eventDate >= selection.from) &&
          (!term ||
            article.headline.toLocaleLowerCase('es').includes(term) ||
            (article.summary ?? '').toLocaleLowerCase('es').includes(term)),
      )
      .map((article) => ({
        fecha: article.eventDate,
        medio: article.outlet,
        seccion: article.section,
        tema: article.topic,
        titular: article.headline,
        entradilla: article.summary,
        enlace: article.url,
        obtencion: article.retrievalMethod,
        evidencia_sha256: article.evidenceSha256,
      }));
  }

  if (dataset === 'filings') {
    const term = selection.search?.trim().toLocaleLowerCase('es');
    return (await readCompanyFilings(5_000))
      .filter(
        (filing) =>
          (!selection.sector || filing.sector === selection.sector) &&
          (selection.from === undefined || filing.eventDate >= selection.from) &&
          (!term ||
            filing.subject.toLocaleLowerCase('es').includes(term) ||
            filing.filer.toLocaleLowerCase('es').includes(term)),
      )
      .map((filing) => ({
        fecha: filing.eventDate,
        sello: filing.statedInstant,
        rubro: filing.sector,
        codigo_emisor: filing.filerCode,
        emisor: filing.filer,
        asunto: filing.subject,
        fecha_verificada_por_ficha: filing.instantStatedInDocument,
        fuente: filing.sourceUrl,
        evidencia_sha256: filing.evidenceSha256,
      }));
  }

  const observatory = await readObservatory();
  const rows: Row[] = [];
  for (const [key, points] of observatory.series) {
    const [indicator = key, side = ''] = key.split(':');
    for (const point of points) {
      if (selection.from !== undefined && point.date < selection.from) continue;
      rows.push({
        fecha: point.date,
        indicador: indicator,
        lado: side,
        agregacion: point.aggregation,
        valor: point.value,
        unidad: UNITS[indicator] ?? '',
        dispersion: point.spread,
        plazas: point.venues,
        variacion_pct: point.changePercent,
      });
    }
  }
  return rows.sort((left, right) => String(left['fecha']).localeCompare(String(right['fecha'])));
}

/** Quotes a field only when it needs it, so the file stays readable. */
function csvField(value: Row[string]): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

function toCsv(rows: Row[]): string {
  const first = rows[0];
  if (!first) return '';
  const headers = Object.keys(first);
  const lines = [headers.join(',')];
  for (const row of rows)
    lines.push(headers.map((header) => csvField(row[header] ?? null)).join(','));
  return `${lines.join('\n')}\n`;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const dataset = (url.searchParams.get('dataset') ?? 'series') as Dataset;
  const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv';

  if (!DATASETS.includes(dataset)) {
    return new Response(`Conjunto desconocido. Disponibles: ${DATASETS.join(', ')}.\n`, {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const from = url.searchParams.get('desde')?.trim();
    const rows = await collect(dataset, {
      sector: url.searchParams.get('sector') ?? undefined,
      topic: url.searchParams.get('tema') ?? undefined,
      outlet: url.searchParams.get('medio') ?? undefined,
      from: from && /^\d{4}(-\d{2}-\d{2})?$/u.test(from) ? from : undefined,
      search: url.searchParams.get('buscar') ?? undefined,
    });
    const body =
      format === 'json'
        ? `${JSON.stringify({ dataset, generado: new Date().toISOString(), filas: rows.length, datos: rows }, null, 2)}\n`
        : toCsv(rows);

    return new Response(body, {
      headers: {
        'Content-Type':
          format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="observatorio-${dataset}.${format}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    // The detail belongs in the log: a connection message can carry the host.
    console.error('[observatorio] exportación fallida', error);
    return new Response('No fue posible leer los datos.\n', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

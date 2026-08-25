import { readCompanyFilings, readMacroAnnual, readObservatory } from '@/lib/series';

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

const DATASETS = ['series', 'macro', 'filings'] as const;
type Dataset = (typeof DATASETS)[number];

const UNITS: Record<string, string> = {
  FX_OFFICIAL_USD_BOB: 'BOB/USD',
  FX_PARALLEL_USD_BOB: 'BOB/USD',
  UFV_BOB: 'BOB/UFV',
};

async function collect(dataset: Dataset): Promise<Row[]> {
  if (dataset === 'macro') {
    return (await readMacroAnnual()).map((point) => ({
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

  if (dataset === 'filings') {
    return (await readCompanyFilings(500)).map((filing) => ({
      fecha: filing.eventDate,
      sello: filing.statedInstant,
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
    const rows = await collect(dataset);
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

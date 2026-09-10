import { readPlacesForExport } from '@/lib/places';
import {
  readCompanyFilings,
  readMacroAnnual,
  readObservatory,
  readPressPage,
  readTermMonths,
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

const DATASETS = ['series', 'macro', 'filings', 'prensa', 'temas', 'lugares'] as const;
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
  tone?: string | undefined;
  region?: string | undefined;
  /** Filings only: the issuer and the kind of filing the panel was slicing by. */
  filer?: string | undefined;
  category?: string | undefined;
  /**
   * The calendar year the panel was slicing by, on press and on subjects.
   *
   * A single year is the filter a reader reaches for — "what was said in 2024" —
   * and a «desde» alone cannot express it: that gives everything from 2024
   * onwards. It stays its own field so the file and the panel agree exactly.
   */
  year?: string | undefined;
  term?: string | undefined;
  /** Subjects only: the family of watched terms the panel was slicing by. */
  family?: string | undefined;
  /** Places only: the city the map was showing. The family is `family` above. */
  city?: string | undefined;
  /** A year on the macro panel, a calendar date on the exchange-rate one. */
  from?: string | undefined;
  /** The far end of the same range, inclusive, where the panel offers one. */
  until?: string | undefined;
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

  if (dataset === 'lugares') {
    // The map draws at most four thousand premises because past that a drawing
    // is a blot; the file has no such reason to stop, so it carries the whole
    // selection. The panel says which of the two the reader is looking at.
    if (!selection.city) return [];
    return (await readPlacesForExport(selection.city, selection.family ?? null)).map((place) => ({
      ciudad: place.city,
      nombre: place.name,
      grupo: place.entityGroup,
      familia: place.entityFamily,
      barrio: place.zone,
      direccion: place.address,
      marca: place.brand,
      latitud: place.latitude,
      longitud: place.longitude,
      actividad_regulada: place.isRegulated,
      registro_que_lo_confirmaria: place.officialValidationSource,
      confianza: place.confidence,
      grado_de_calidad: place.qualityGrade,
      id_de_lugar: place.placeId,
    }));
  }

  if (dataset === 'temas') {
    // The dated table the subjects panel draws every one of its charts from:
    // one row per watched subject per month, with the tone counts that make up
    // the adverse share. Taking the same selection the panel was showing means
    // the file and the chart above it cannot disagree.
    const search = selection.search?.trim().toLocaleLowerCase('es');
    // A year is a legal «desde» here and a month is what the rows are dated by.
    const since = selection.from?.slice(0, 7);
    // «hasta» includes the month it names, so a bare year has to be widened to
    // its December: «hasta=2024» means all of 2024, and '2024-07' <= '2024' is
    // false.
    const until =
      selection.until === undefined
        ? undefined
        : selection.until.length === 4
          ? `${selection.until}-12`
          : selection.until.slice(0, 7);
    const year = selection.year?.trim();
    return (await readTermMonths())
      .filter(
        (row) =>
          (!selection.family || row.family === selection.family) &&
          (!selection.term || row.term === selection.term) &&
          (!year || row.month.slice(0, 4) === year) &&
          (since === undefined || row.month >= since) &&
          (until === undefined || row.month <= until) &&
          (!search ||
            row.label.toLocaleLowerCase('es').includes(search) ||
            row.term.toLocaleLowerCase('es').includes(search)),
      )
      .map((row) => ({
        tema: row.term,
        nombre: row.label,
        familia: row.family,
        mes: row.month,
        menciones: row.mentions,
        medios: row.outlets,
        alarma: row.alarma,
        deterioro: row.deterioro,
        conflicto: row.conflicto,
        incertidumbre: row.incertidumbre,
        mejora: row.mejora,
        medida: row.medida,
        sin_marca: row.neutro,
        cobertura_adversa_pct: row.adverseShare,
      }));
  }

  if (dataset === 'prensa') {
    // The same predicate the panel counts with, run in the database. Filtering a
    // cached corpus here instead would let the file and the figure on screen
    // disagree, which is the one thing a download must never do.
    const { articles } = await readPressPage(
      {
        year: selection.year,
        tone: selection.tone,
        topic: selection.topic,
        region: selection.region,
        outlet: selection.outlet,
        term: selection.term,
        search: selection.search?.trim(),
      },
      60_000,
    );
    return articles
      .filter((article) => selection.from === undefined || article.eventDate >= selection.from)
      .map((article) => ({
        fecha: article.eventDate,
        medio: article.outlet,
        seccion: article.section,
        tema: article.topic,
        tono: article.tone,
        region: article.region,
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
          (!selection.category || filing.category === selection.category) &&
          (!selection.filer || filing.filer === selection.filer) &&
          (selection.from === undefined || filing.eventDate >= selection.from) &&
          (!term ||
            filing.subject.toLocaleLowerCase('es').includes(term) ||
            filing.filer.toLocaleLowerCase('es').includes(term)),
      )
      .map((filing) => ({
        fecha: filing.eventDate,
        sello: filing.statedInstant,
        rubro: filing.sector,
        tipo_de_hecho: filing.category,
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
    // A month is a legal end of a range: the subjects panel is dated by month,
    // and refusing «2024-07» would silently widen the file to the whole year.
    const dated = /^\d{4}(-\d{2}(-\d{2})?)?$/u;
    const from = url.searchParams.get('desde')?.trim();
    const until = url.searchParams.get('hasta')?.trim();
    const rows = await collect(dataset, {
      sector: url.searchParams.get('sector') ?? undefined,
      topic: url.searchParams.get('tema') ?? undefined,
      outlet: url.searchParams.get('medio') ?? undefined,
      tone: url.searchParams.get('tono') ?? undefined,
      region: url.searchParams.get('region') ?? undefined,
      filer: url.searchParams.get('emisor') ?? undefined,
      category: url.searchParams.get('categoria') ?? undefined,
      year: url.searchParams.get('anio') ?? undefined,
      term: url.searchParams.get('termino') ?? undefined,
      family: url.searchParams.get('familia') ?? undefined,
      city: url.searchParams.get('ciudad') ?? undefined,
      from: from && dated.test(from) ? from : undefined,
      until: until && dated.test(until) ? until : undefined,
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

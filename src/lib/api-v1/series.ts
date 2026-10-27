import 'server-only';
import { readBcbSeries, searchBcb } from '@/lib/bcb';
import { readBoliviaPanel, readMacroAnnual, readObservatory, type MacroPoint } from '@/lib/series';
import { encodeCursor, paginate, parseSeriesCode, withinRange, type SeriesSource } from './contrato';
import { BadParam, type ApiPage, type ApiRow } from './responder';

/**
 * Las series de `/api/v1/series`, leídas con las mismas funciones que dibujan
 * el tablero y arman `/api/export`: el dólar y la UFV diarios, las series
 * anuales de Bolivia, el panel del Banco Mundial recortado a Bolivia y las
 * estadísticas del Banco Central.
 *
 * Ninguna tabla nueva: si una cifra sale distinta aquí que en la página, es la
 * misma lectura mal recortada, no otra fuente.
 */

/** Nombre y unidad de las series diarias que el sitio publica. */
const DAILY: Record<string, { nombre: string; unidad: string; fuente: string }> = {
  FX_OFFICIAL_USD_BOB: {
    nombre: 'Tipo de cambio oficial del dólar',
    unidad: 'BOB/USD',
    fuente: 'Banco Central de Bolivia',
  },
  'FX_PARALLEL_USD_BOB:BUY': {
    nombre: 'Dólar paralelo, compra (mediana de cotizaciones)',
    unidad: 'BOB/USD',
    fuente: 'DatosBolivia.com, a partir de cotizaciones publicadas',
  },
  'FX_PARALLEL_USD_BOB:SELL': {
    nombre: 'Dólar paralelo, venta (mediana de cotizaciones)',
    unidad: 'BOB/USD',
    fuente: 'DatosBolivia.com, a partir de cotizaciones publicadas',
  },
  UFV_BOB: {
    nombre: 'Unidad de Fomento de Vivienda',
    unidad: 'BOB/UFV',
    fuente: 'Banco Central de Bolivia',
  },
};

function dailyInfo(key: string): { nombre: string; unidad: string; fuente: string } {
  const known = DAILY[key];
  if (known) return known;
  const [indicator = key] = key.split(':');
  return {
    nombre: key,
    unidad: DAILY[indicator]?.unidad ?? '',
    fuente: 'DatosBolivia.com',
  };
}

const SOURCE_LABEL: Record<SeriesSource, string> = {
  diario: 'DatosBolivia.com: tipo de cambio y UFV diarios',
  macro: 'DatosBolivia.com: series anuales de Bolivia (fuentes por serie)',
  panel: 'Banco Mundial, World Development Indicators (Bolivia)',
  bcb: 'Banco Central de Bolivia, estadísticas publicadas',
};

/** Una fila del catálogo por indicador anual. */
function annualCatalogue(points: readonly MacroPoint[], fuente: 'macro' | 'panel'): ApiRow[] {
  const byCode = new Map<string, { first: MacroPoint; desde: string; hasta: string; n: number }>();
  for (const point of points) {
    const current = byCode.get(point.indicatorCode);
    if (!current) {
      byCode.set(point.indicatorCode, { first: point, desde: point.period, hasta: point.period, n: 1 });
    } else {
      current.n += 1;
      if (point.period < current.desde) current.desde = point.period;
      if (point.period > current.hasta) current.hasta = point.period;
    }
  }
  return [...byCode.values()].map(({ first, desde, hasta, n }) => ({
    codigo: `${fuente}.${first.indicatorCode}`,
    nombre: first.name ?? first.indicatorCode,
    fuente,
    rubro: first.sector,
    unidad: first.unit,
    frecuencia: 'anual',
    desde,
    hasta,
    observaciones: n,
    editor: first.publisher,
  }));
}

async function dailyCatalogue(): Promise<ApiRow[]> {
  const observatory = await readObservatory();
  return [...observatory.series.entries()].map(([key, points]) => {
    const info = dailyInfo(key);
    return {
      codigo: `diario.${key}`,
      nombre: info.nombre,
      fuente: 'diario',
      rubro: 'TIPO_DE_CAMBIO',
      unidad: info.unidad,
      frecuencia: 'diaria',
      desde: points[0]?.date ?? null,
      hasta: points.at(-1)?.date ?? null,
      observaciones: points.length,
      editor: info.fuente,
    };
  });
}

function textMatches(row: ApiRow, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const haystack = `${String(row['codigo'])} ${String(row['nombre'])}`.toLocaleLowerCase('es');
  return words.every((word) => haystack.includes(word));
}

/**
 * El catálogo. Sin `fuente`, las series diarias, las anuales y el panel; las
 * diecisiete mil del Banco Central se piden con `fuente=bcb`, porque mezclarlas
 * hundiría las otras en la paginación.
 */
export async function seriesCatalogue(
  params: URLSearchParams,
  offset: number,
  pageSize: number,
): Promise<ApiPage> {
  const raw = params.get('fuente')?.trim() ?? '';
  const buscar = (params.get('buscar') ?? '').trim().slice(0, 120);
  if (raw && !['diario', 'macro', 'panel', 'bcb'].includes(raw)) {
    throw new BadParam('fuente es diario, macro, panel o bcb.');
  }

  if (raw === 'bcb') {
    // El catálogo del Banco Central se pagina en la base, de a cuarenta: son
    // diecisiete mil series y no se leen enteras para servir una página.
    const page = await searchBcb({
      family: (params.get('familia') ?? '').slice(0, 120),
      workbook: '',
      sheet: '',
      frequency: '',
      text: buscar,
      offset,
    });
    const end = offset + page.results.length;
    return {
      data: page.results.map((info) => ({
        codigo: `bcb.${info.code}`,
        nombre: info.name,
        fuente: 'bcb',
        rubro: info.family,
        informe: info.workbookTitle,
        hoja: info.sheet,
        unidad: info.unit,
        frecuencia: info.frequency,
        desde: info.firstPeriod,
        hasta: info.lastPeriod,
        observaciones: info.pointCount,
        editor: 'Banco Central de Bolivia',
      })),
      siguiente:
        page.results.length > 0 && end < page.total
          ? encodeCursor({ o: end })
          : null,
      fuente: SOURCE_LABEL.bcb,
      actualizado: page.latest,
    };
  }

  const wanted = raw ? [raw] : ['diario', 'macro', 'panel'];
  const parts = await Promise.all([
    wanted.includes('diario') ? dailyCatalogue() : Promise.resolve([]),
    wanted.includes('macro')
      ? readMacroAnnual().then((points) => annualCatalogue(points, 'macro'))
      : Promise.resolve([]),
    wanted.includes('panel')
      ? readBoliviaPanel().then((points) => annualCatalogue(points, 'panel'))
      : Promise.resolve([]),
  ]);
  const words = buscar.toLocaleLowerCase('es').split(/\s+/u).filter(Boolean).slice(0, 5);
  const rows = parts.flat().filter((row) => textMatches(row, words));
  const actualizado = wanted.includes('diario') ? (await readObservatory()).lastReceivedAt : null;
  return {
    ...paginate(rows, offset, pageSize),
    fuente: raw ? SOURCE_LABEL[raw as SeriesSource] : 'DatosBolivia.com',
    actualizado,
  };
}

/** Las observaciones de una serie, entre `desde` y `hasta`. */
export async function seriesObservations(
  codigo: string,
  range: { desde?: string | undefined; hasta?: string | undefined },
  offset: number,
  pageSize: number,
): Promise<ApiPage | null> {
  const parsed = parseSeriesCode(codigo);
  if (!parsed) return null;
  const { fuente, clave } = parsed;

  if (fuente === 'diario') {
    const observatory = await readObservatory();
    const points = observatory.series.get(clave);
    if (!points) return null;
    const info = dailyInfo(clave);
    const rows: ApiRow[] = points
      .filter((point) => withinRange(point.date, range.desde, range.hasta))
      .map((point) => ({
        fecha: point.date,
        valor: point.value,
        unidad: info.unidad,
        agregacion: point.aggregation,
        dispersion: point.spread,
        plazas: point.venues,
        variacion_pct: point.changePercent,
      }));
    return { ...paginate(rows, offset, pageSize), fuente: info.fuente, actualizado: observatory.lastReceivedAt };
  }

  if (fuente === 'macro' || fuente === 'panel') {
    const all = await (fuente === 'macro' ? readMacroAnnual() : readBoliviaPanel());
    const points = all.filter((point) => point.indicatorCode === clave);
    if (points.length === 0) return null;
    const rows: ApiRow[] = points
      .filter((point) => withinRange(point.period, range.desde, range.hasta))
      .map((point) => ({
        periodo: point.period,
        valor: point.value,
        unidad: point.unit,
        valor_anterior: point.previousValue,
        variacion_pct: point.changePercent,
      }));
    const first = points[0];
    return {
      ...paginate(rows, offset, pageSize),
      fuente: [first?.publisher, first?.sourceUrl].filter(Boolean).join(' · ') || SOURCE_LABEL[fuente],
      actualizado: points.at(-1)?.period ?? null,
    };
  }

  const [series] = await readBcbSeries([clave]);
  if (!series) return null;
  const rows: ApiRow[] = series.points
    .filter(([date]) => withinRange(date, range.desde, range.hasta))
    .map(([date, value]) => ({ periodo: date, valor: value, unidad: series.unit }));
  return {
    ...paginate(rows, offset, pageSize),
    fuente: ['Banco Central de Bolivia', series.sourceUrl].filter(Boolean).join(' · '),
    actualizado: series.lastPeriod,
  };
}

import 'server-only';
import {
  officialSeries,
  readBoliviaPanel,
  readMacroAnnual,
  readObservatory,
  readSources,
  type DailyPoint,
  type MacroPoint,
  type Observatory,
} from '@/lib/series';
import { STABLECOIN_MARKET_SURVEY } from '@/lib/stablecoin-market-survey';
import { readBcbCataloguePage, readBcbObservations } from './bcb';
import {
  SERIES_SOURCES,
  dailySeriesLabel,
  encodeCursor,
  latestOf,
  paginate,
  parseSeriesCode,
  parseTextParam,
  withinRange,
  type DailyRegistryEntry,
  type SeriesSource,
} from './contrato';
import { BadParam, accept, type ApiPage, type ApiRow } from './responder';

/**
 * Las series de `/api/v1/series`, leídas con las mismas funciones que dibujan
 * el tablero y arman `/api/export`: las series diarias (dólar, UFV, mercados),
 * las series anuales de Bolivia, el panel del Banco Mundial recortado a Bolivia
 * y las estadísticas del Banco Central.
 *
 * Ninguna tabla nueva: si una cifra sale distinta aquí que en la página, es la
 * misma lectura mal recortada, no otra fuente.
 */

const SOURCE_LABEL: Record<SeriesSource, string> = {
  diario: 'DatosBolivia.com: series diarias (tipo de cambio, UFV y mercados)',
  macro: 'DatosBolivia.com: series anuales de Bolivia (fuentes por serie)',
  panel: 'Banco Mundial, World Development Indicators (Bolivia)',
  bcb: 'Banco Central de Bolivia, estadísticas publicadas',
};

const BCB_EDITOR = 'Banco Central de Bolivia';

/** La clave del tipo de cambio oficial como una sola serie, la que dibuja el tablero. */
const OFFICIAL = 'FX_OFFICIAL_USD_BOB';

/**
 * Las series diarias por clave, en orden de clave, con el tipo de cambio
 * oficial además como una sola serie.
 *
 * El diario guarda el oficial por lado (`:OFFICIAL`, `:BUY`, `:SELL`); el
 * tablero lo dibuja como una línea con la precedencia de `officialSeries` —la
 * tasa publicada, luego la venta, luego la compra—, y esa línea es la que se
 * cita. Va con la clave sin lado; los lados siguen disponibles por separado.
 * El orden por clave hace que el catálogo no cambie de un pedido a otro.
 */
function dailySeries(observatory: Observatory): Map<string, DailyPoint[]> {
  const series = new Map(observatory.series);
  if (!series.has(OFFICIAL)) {
    const official = officialSeries(observatory);
    if (official.length > 0) series.set(OFFICIAL, official);
  }
  return new Map([...series.entries()].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)));
}

const labelOf = (key: string, registry: ReadonlyMap<string, DailyRegistryEntry>) =>
  dailySeriesLabel(key, registry, STABLECOIN_MARKET_SURVEY);

/**
 * Lo que el registro de fuentes del tablero (la página de Fuentes) dice de cada
 * indicador: su nombre publicado, su unidad y quiénes lo publican.
 *
 * Es el respaldo del nombre de las series diarias que el sitio no nombra por
 * su cuenta. Si el registro no responde, la serie sale con el nombre del sitio
 * o con su clave: el nombre no puede tumbar los datos.
 */
async function dailyRegistry(): Promise<Map<string, DailyRegistryEntry>> {
  const registry = new Map<string, { name: string | null; unit: string | null; publishers: string[] }>();
  try {
    for (const note of await readSources()) {
      const entry = registry.get(note.indicator) ?? { name: null, unit: null, publishers: [] };
      entry.name ??= note.name;
      entry.unit ??= note.unit;
      if (!entry.publishers.includes(note.publisher)) entry.publishers.push(note.publisher);
      registry.set(note.indicator, entry);
    }
  } catch (error) {
    console.warn('[observatorio] api-v1: el registro de fuentes no respondió; nombres por clave', error);
  }
  return registry;
}

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

async function dailyCatalogue(): Promise<{ rows: ApiRow[]; actualizado: string | null }> {
  const [observatory, registry] = await Promise.all([readObservatory(), dailyRegistry()]);
  const rows = [...dailySeries(observatory).entries()].map(([key, points]) => {
    const info = labelOf(key, registry);
    return {
      codigo: `diario.${key}`,
      nombre: info.nombre,
      fuente: 'diario',
      rubro: info.rubro,
      unidad: info.unidad,
      frecuencia: 'diaria',
      desde: points[0]?.date ?? null,
      hasta: points.at(-1)?.date ?? null,
      observaciones: points.length,
      editor: info.editor,
    };
  });
  return { rows, actualizado: observatory.lastReceivedAt };
}

async function annualPart(fuente: 'macro' | 'panel'): Promise<{ rows: ApiRow[]; actualizado: string | null }> {
  const rows = annualCatalogue(await (fuente === 'macro' ? readMacroAnnual() : readBoliviaPanel()), fuente);
  // Las anuales no registran cuándo llegaron: su frescura es su último periodo.
  return { rows, actualizado: latestOf(rows.map((row) => row['hasta'] as string | null)) };
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
  const raw = (params.get('fuente') ?? '').trim();
  if (raw && !(SERIES_SOURCES as readonly string[]).includes(raw)) {
    throw BadParam.invalid('fuente', 'es «diario», «macro», «panel» o «bcb»');
  }
  const fuente = raw ? (raw as SeriesSource) : null;
  const buscar = accept(parseTextParam('buscar', params.get('buscar')));
  const familia = accept(parseTextParam('familia', params.get('familia')));
  if (familia && fuente !== 'bcb') {
    throw BadParam.invalid('familia', 'solo se usa junto con fuente=bcb');
  }

  if (fuente === 'bcb') {
    const page = await readBcbCataloguePage({ family: familia, text: buscar }, offset, pageSize);
    return {
      data: page.entries.map((info) => ({
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
        editor: BCB_EDITOR,
      })),
      siguiente: page.more ? encodeCursor({ o: offset + page.entries.length }) : null,
      fuente: SOURCE_LABEL.bcb,
      actualizado: page.receivedAt,
    };
  }

  const wanted: ReadonlyArray<'diario' | 'macro' | 'panel'> = fuente ? [fuente] : ['diario', 'macro', 'panel'];
  const parts = await Promise.all(
    wanted.map((one) => (one === 'diario' ? dailyCatalogue() : annualPart(one))),
  );
  const words = buscar.toLocaleLowerCase('es').split(/\s+/u).filter(Boolean).slice(0, 5);
  const rows = parts.flatMap((part) => part.rows).filter((row) => textMatches(row, words));
  const { data, siguiente } = paginate(rows, offset, pageSize);
  return {
    data,
    siguiente,
    fuente: fuente ? SOURCE_LABEL[fuente] : 'DatosBolivia.com',
    actualizado: latestOf(parts.map((part) => part.actualizado)),
  };
}

/** Las observaciones de una serie, entre `desde` y `hasta`; `null` si el código no existe. */
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
    const [observatory, registry] = await Promise.all([readObservatory(), dailyRegistry()]);
    const points = dailySeries(observatory).get(clave);
    if (!points) return null;
    const info = labelOf(clave, registry);
    const rows: ApiRow[] = points
      .filter((point) => withinRange(point.date, range.desde, range.hasta))
      .map((point) => ({
        fecha: point.date,
        valor: point.value,
        unidad: info.unidad,
        lado: point.side,
        agregacion: point.aggregation,
        dispersion: point.spread,
        plazas: point.venues,
        variacion_pct: point.changePercent,
      }));
    const { data, siguiente } = paginate(rows, offset, pageSize);
    return {
      data,
      siguiente,
      fuente: info.editor,
      // El diario no guarda la hora de llegada por serie: su frescura es su último día.
      actualizado: points.at(-1)?.date ?? null,
    };
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
    const { data, siguiente } = paginate(rows, offset, pageSize);
    return {
      data,
      siguiente,
      fuente: [first?.publisher, first?.sourceUrl].filter(Boolean).join(' · ') || SOURCE_LABEL[fuente],
      actualizado: latestOf(points.map((point) => point.period)),
    };
  }

  const series = await readBcbObservations(clave);
  if (!series) return null;
  const rows: ApiRow[] = series.points
    .filter(([date]) => withinRange(date, range.desde, range.hasta))
    .map(([date, value]) => ({ periodo: date, valor: value, unidad: series.unit }));
  const { data, siguiente } = paginate(rows, offset, pageSize);
  return {
    data,
    siguiente,
    fuente: [BCB_EDITOR, series.sourceUrl].filter(Boolean).join(' · '),
    actualizado: series.receivedAt,
  };
}

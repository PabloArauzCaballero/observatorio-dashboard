import 'server-only';

import { buildDepartmentBoard, topProducts } from '@/lib/departments-board';
import type { DepartmentBoard, YearValue } from '@/lib/departments-board';
import { activityStructure } from '@/lib/department-activities';
import { DEPARTMENTS, MEASURES } from '@/lib/departments';
import { ENERGY_CODES, ENERGY_INDICATORS, ENERGY_PLACE_CODES, buildEnergyBoard } from '@/lib/energy-board';
import {
  ENVIRONMENT_CODES,
  ENVIRONMENT_INDICATORS,
  ENVIRONMENT_PLACE_CODES,
  buildEnvironmentBoard,
} from '@/lib/environment-board';
import { buildExportersBoard, concentration } from '@/lib/exporters-board';
import { readExogenousBoard } from '@/lib/exogenous';
import { summarize } from '@/lib/exogenous-board';
import { assembleEconometrics } from '@/lib/fx-econometrics-report';
import { econometricConclusions } from '@/lib/fx-econometrics-reading';
import { readFxSnapshot } from '@/lib/fx-reader';
import type { FxConclusion } from '@/lib/fx-snapshot';
import { buildForeignTradeBoard, foreignTradeConclusions } from '@/lib/foreign-trade-board';
import { held } from '@/lib/hold';
import { SECTOR_LABEL } from '@/components/macro-vocabulary';
import { GLOSSARY } from '@/lib/indicator-glossary';
import { buildInstitutionsBoard } from '@/lib/institutions-board';
import { readPlaceFamilies } from '@/lib/places';
import { RESOURCE_CODES, RESOURCE_INDICATORS, RESOURCE_PLACE_CODES, buildResourceBoard } from '@/lib/resources-board';
import { buildRoadBoard } from '@/lib/roads-board';
import { readRoadLengths, readRoadSections } from '@/lib/roads';
import {
  officialSeries,
  readCompanyFilings,
  readGap,
  readMacroAnnual,
  readMarkets,
  readObservatory,
  readPressPage,
  readSources,
  readWorldBoard,
} from '@/lib/series';
import type { DailyPoint, MacroPoint, PressArticle } from '@/lib/series';
import { buildTodayBoard } from '@/lib/today-board';
import { PLACE_LABEL, WORLD_CODES, WORLD_INDICATORS, WORLD_PLACE_CODES, sayWorldFigure } from '@/lib/world-board';
import { nombreDepartamento, type PaqueteId } from './alcance';
import { guiaCompleta } from './guia';

/**
 * Los datos con que se contesta, leídos en el momento.
 *
 * Cada paquete es texto plano y corto —una línea por hecho, con su cifra, su
 * periodo y su fuente— armado con los mismos lectores y los mismos tableros
 * que dibuja cada pestaña. Así el asistente no puede decir un paralelo distinto
 * del que muestra «Hoy»: sale del mismo `readFxSnapshot`.
 *
 * Las lecturas están sostenidas cinco minutos por `held`, así que una pregunta
 * cuesta lo que cuesta una visita con la memoria caliente. Un paquete que no
 * llega a tiempo se dice («no se pudo leer») en vez de dejar al modelo sin
 * saber que falta algo y tentado a llenarlo.
 */

const TIME_ZONE = 'America/La_Paz';

/**
 * Cuánto espera cada paquete. Con la memoria caliente todos llegan en uno o dos
 * segundos; el plazo es para el servidor recién arrancado, donde la brecha sola
 * tarda cerca de treinta en Contabo. Lo que no llega sigue leyéndose por detrás
 * y queda sostenido para la pregunta siguiente.
 */
const PAQUETE_MS = 18_000;

export interface Paquete {
  id: PaqueteId;
  texto: string;
  leido: boolean;
}

export interface Contexto {
  departamento: string | null;
  busqueda: string | null;
}

/* ------------------------------------------------------------------ formato */

const num = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const entero = (value: number): string => value.toLocaleString('es-BO', { maximumFractionDigits: 0 });

const pct = (value: number | null | undefined, decimals = 1): string =>
  value === null || value === undefined || !Number.isFinite(value) ? 's/d' : `${num(value, decimals)} %`;

const signo = (value: number | null | undefined, decimals = 1): string =>
  value === null || value === undefined || !Number.isFinite(value)
    ? 's/d'
    : `${value > 0 ? '+' : ''}${num(value, decimals)} %`;

/** Una cifra con su unidad, legible: 579.906.699 USD se dice «579,9 millones de US$». */
function cifra(value: number, unit: string): string {
  const grande = (v: number, sufijo: string): string => {
    const abs = Math.abs(v);
    if (abs >= 1e9) return `${num(v / 1e9, 2)} mil millones${sufijo}`;
    if (abs >= 1e6) return `${num(v / 1e6, 1)} millones${sufijo}`;
    return `${entero(v)}${sufijo}`;
  };
  switch (unit) {
    case 'PERCENT':
      return `${num(value, 2)} %`;
    case 'PERCENT_OF_GDP':
      return `${num(value, 2)} % del PIB`;
    case 'USD':
      return grande(value, ' US$');
    case 'USD_MILLIONS':
      return `${num(value, 1)} millones de US$`;
    case 'BOB':
      return grande(value, ' Bs');
    case 'BOB_THOUSANDS':
      return `${entero(value)} miles de Bs`;
    case 'BOB_THOUSANDS_1990':
      return `${entero(value)} miles de Bs de 1990`;
    case 'TONNES':
      return `${entero(value)} t`;
    case 'MONTHS':
      return `${num(value, 1)} meses`;
    case 'YEARS':
      return `${num(value, 1)} años`;
    case 'RANK':
      return `puesto ${entero(value)}`;
    default:
      return `${num(value, Math.abs(value) >= 100 ? 0 : 2)} ${unit.toLowerCase()}`;
  }
}

const conclusion = (c: FxConclusion): string => `- ${c.claim}: ${c.figure}. ${c.detail}`;

function hoyEnLaPaz(): { fecha: string; anio: number } {
  const fecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return { fecha, anio: Number(fecha.slice(0, 4)) };
}

export function fechaDeHoy(): string {
  return hoyEnLaPaz().fecha;
}

const nota = (a: PressArticle): string =>
  `- ${a.eventDate} · ${a.outlet} · tema ${a.topic} · tono ${a.tone}${a.region && a.region !== 'NACIONAL' ? ` · ${a.region}` : ''}: «${a.headline}»`;

/* ---------------------------------------------------------------- lecturas */

/** Solo los puntos macro que no son de otro capítulo. */
const SECTORES_MACRO = new Set([
  'ACTIVIDAD', 'PRECIOS', 'MONETARIO', 'FINANCIERO', 'FISCAL', 'DEUDA', 'EXTERNO', 'TRABAJO',
  'POBREZA', 'SALUD', 'EDUCACION', 'POBLACION', 'SECTORIAL', 'INFRAESTRUCTURA', 'CAMBIARIO', 'SOCIAL',
]);

function ultimos(points: readonly MacroPoint[]): MacroPoint[] {
  const porCodigo = new Map<string, MacroPoint>();
  for (const p of points) {
    const actual = porCodigo.get(p.indicatorCode);
    if (!actual || p.period > actual.period) porCodigo.set(p.indicatorCode, p);
  }
  return [...porCodigo.values()];
}

function departmentBoard(macro: readonly MacroPoint[]): DepartmentBoard {
  return buildDepartmentBoard(macro.filter((p) => p.sector === 'DEPARTAMENTAL'));
}

function midSeries(series: Map<string, DailyPoint[]>): Array<{ date: string; value: number }> {
  const sell = new Map((series.get('FX_PARALLEL_USD_BOB:SELL') ?? []).map((p) => [p.date, p.value]));
  return (series.get('FX_PARALLEL_USD_BOB:BUY') ?? []).flatMap((p) => {
    const other = sell.get(p.date);
    return other === undefined ? [] : [{ date: p.date, value: (p.value + other) / 2 }];
  });
}

/** El valor en o antes de una fecha, para medir cuánto se movió algo. */
function enFecha(serie: ReadonlyArray<{ date: string; value: number }>, fecha: string): { date: string; value: number } | undefined {
  let found: { date: string; value: number } | undefined;
  for (const p of serie) {
    if (p.date <= fecha) found = p;
    else break;
  }
  return found;
}

function haceDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** Las pruebas econométricas son cálculo puro; se sostienen igual que las lecturas. */
function econometria(): Promise<FxConclusion[]> {
  return held('asistenteEconometria', async () => {
    const [observatory, gap] = await Promise.all([readObservatory(), readGap()]);
    const plain = (key: string) =>
      (observatory.series.get(key) ?? []).map((p) => ({ date: p.date, value: p.value }));
    const result = assembleEconometrics({
      official: officialSeries(observatory).map((p) => ({ date: p.date, value: p.value })),
      parallelBuy: plain('FX_PARALLEL_USD_BOB:BUY'),
      parallelSell: plain('FX_PARALLEL_USD_BOB:SELL'),
      ufv: plain('UFV_BOB'),
      gap: gap.map((p) => ({ date: p.date, gapPercent: p.gapPercent })),
    });
    return result ? econometricConclusions(result) : [];
  });
}

/* ---------------------------------------------------------------- paquetes */

async function hoy(): Promise<string> {
  const { anio } = hoyEnLaPaz();
  const [macro, gap, press] = await Promise.all([
    readMacroAnnual(),
    readGap(),
    readPressPage({}, 120).then((page) => page.articles),
  ]);
  const board = buildTodayBoard({ macro, gap, press, currentYear: anio });
  const lineas = board.blocks.map(
    (b) =>
      `- ${b.title} [${b.verdict}]: ${b.reading} Cifra: ${b.value}${b.unit ? ` ${b.unit}` : ''} (${b.measure}, ${b.asOf}${b.lag >= 2 ? `, dato de hace ${b.lag} años` : ''}). Regla: ${b.rule}${b.publisher ? ` Fuente: ${b.publisher}.` : ''}`,
  );
  const novedades = board.changes.slice(0, 8).map((c) => `- ${c.date} · ${c.outlet} · ${c.topic}: «${c.headline}»`);
  return [
    'CUADRO DE MANDO (pestaña «Hoy»; veredictos favorable / vigilar / adverso / sin-lectura):',
    ...lineas,
    novedades.length ? `NOVEDADES DE PRENSA del ${board.changesDate ?? 's/f'} (${board.changesOutlets} medios):` : '',
    ...novedades,
  ].filter(Boolean).join('\n');
}

async function dolar(): Promise<string> {
  const [fx, observatory, pruebas] = await Promise.all([
    readFxSnapshot(),
    readObservatory(),
    econometria().catch(() => [] as FxConclusion[]),
  ]);
  const mid = midSeries(observatory.series);
  const official = officialSeries(observatory).map((p) => ({ date: p.date, value: p.value }));
  const ultimo = mid.at(-1);
  const movimientos = ultimo
    ? [7, 30, 90, 365].map((dias) => {
        const antes = enFecha(mid, haceDias(ultimo.date, dias));
        return antes ? `${dias} días: ${signo((ultimo.value / antes.value - 1) * 100)} (desde ${num(antes.value)} el ${antes.date})` : null;
      }).filter(Boolean)
    : [];
  const ultimoOficial = official.at(-1);
  const oficialAnio = ultimoOficial ? enFecha(official, haceDias(ultimoOficial.date, 365)) : undefined;

  const lineas = [
    `Datos al ${fx.asOf ?? 's/f'} (se recogen tres veces al día).`,
    fx.official ? `- Dólar oficial (BCB): ${num(fx.official.value, 2)} Bs por dólar, el ${fx.official.date}.${oficialAnio ? ` Hace un año: ${num(oficialAnio.value, 2)} (${signo((fx.official.value / oficialAnio.value - 1) * 100)}).` : ''}` : '- Dólar oficial: sin lectura.',
    fx.parallelMid ? `- Dólar paralelo, punto medio entre compra y venta: ${num(fx.parallelMid.value, 2)} Bs por dólar, el ${fx.parallelMid.date}.` : '- Dólar paralelo: sin lectura.',
    movimientos.length ? `- Variación del paralelo en ${movimientos.join('; ')}.` : '',
    fx.gap.current ? `- Brecha cambiaria (paralelo sobre oficial): ${pct(fx.gap.current.gapPercent)} el ${fx.gap.current.date}; máximo del periodo ${pct(fx.gap.peak?.gapPercent)} el ${fx.gap.peak?.date ?? 's/f'}; ${fx.gap.daysInverted} días con el oficial por encima del paralelo, de ${fx.gap.observations} observados.` : '',
    `- Régimen del oficial: ${fx.regime === 'FIJO' ? 'fijo (no se movió en los últimos 30 días)' : 'en movimiento (se movió en los últimos 30 días)'}.`,
    ...fx.regimes.slice(-3).map((r) => `  · tramo ${r.regime === 'FIJO' ? 'fijo' : 'en movimiento'} del ${r.from} al ${r.to} (${r.days} días), de ${num(r.rateFrom)} a ${num(r.rateTo)}`),
    fx.real ? `- Nivel real (deflactado por la UFV, base 100 = ${fx.real.base}): oficial ${num(fx.real.officialIndex, 1)}, paralelo ${num(fx.real.parallelIndex, 1)}. Cada índice se mide contra su propio arranque; no se comparan entre sí.` : '',
    fx.impliedInflationAnnual !== null ? `- Inflación anual implícita en la UFV (últimos doce meses): ${pct(fx.impliedInflationAnnual)}.` : '',
    ...fx.stablecoins.map((s) => `- ${s.token} en bolivianos (${s.venues} plazas P2P, ${s.date}): medio ${num(s.mid)}${s.ask !== null ? `, venta ${num(s.ask)}` : ''}${s.bid !== null ? `, compra ${num(s.bid)}` : ''}; prima para comprar frente al riel más barato ${pct(s.premiumAskPercent, 2)}.`),
    'CONCLUSIONES DEL CAPÍTULO CAMBIARIO:',
    ...fx.conclusions.map(conclusion),
    pruebas.length ? 'PRUEBAS ECONOMÉTRICAS (informe PDF de «Tipo de cambio»):' : '',
    ...pruebas.slice(0, 8).map(conclusion),
  ];
  return lineas.filter(Boolean).join('\n');
}

/** Los códigos con definición en el glosario llevan su lectura; el resto, solo la cifra. */
async function macro(): Promise<string> {
  const puntos = ultimos((await readMacroAnnual()).filter((p) => SECTORES_MACRO.has(p.sector)));
  const porSector = new Map<string, MacroPoint[]>();
  for (const p of puntos) porSector.set(p.sector, [...(porSector.get(p.sector) ?? []), p]);
  const lineas: string[] = ['INDICADORES ANUALES DE BOLIVIA (último dato de cada serie; entre paréntesis el anterior):'];
  for (const [sector, lista] of [...porSector.entries()].sort()) {
    // El rótulo es el del botón del rubro en «Series de Bolivia»: así la ruta
    // que cite la respuesta existe de verdad.
    lineas.push(`[rubro «${SECTOR_LABEL[sector] ?? sector}» en «Macroeconomía» › «Series de Bolivia»]`);
    for (const p of lista.sort((a, b) => a.indicatorCode.localeCompare(b.indicatorCode))) {
      const glosa = GLOSSARY[p.indicatorCode];
      lineas.push(
        `- ${p.name ?? p.indicatorCode} (${p.indicatorCode}), ${p.period}: ${cifra(p.value, p.unit)}${p.previousValue !== null ? ` (antes ${cifra(p.previousValue, p.unit)})` : ''}${p.publisher ? ` · ${p.publisher}` : ''}${glosa ? ` · Cómo leerlo: ${glosa.howToRead}` : ''}`,
      );
    }
  }
  return lineas.join('\n');
}

function valorDepto(board: DepartmentBoard, medida: string, lugar: string): YearValue | undefined {
  return board.series[medida]?.[lugar]?.at(-1);
}

function crecimientoDecada(board: DepartmentBoard, lugar: string): { desde: number; hasta: number; cambio: number } | null {
  const serie = board.series.GDP_CONSTANT?.[lugar];
  const fin = serie?.at(-1);
  const inicio = fin ? serie?.find((p) => p.year === fin.year - 10) : undefined;
  if (!fin || !inicio || inicio.value === 0) return null;
  return { desde: inicio.year, hasta: fin.year, cambio: (fin.value / inicio.value - 1) * 100 };
}

async function departamento(slug: string): Promise<string> {
  const nombre = nombreDepartamento(slug) ?? slug;
  const [macroPoints, prensa, sections, lengths] = await Promise.all([
    readMacroAnnual(),
    readPressPage({ region: [slug] }, 12).catch(() => null),
    readRoadSections().catch(() => null),
    readRoadLengths().catch(() => null),
  ]);
  const board = departmentBoard(macroPoints);
  const lineas: string[] = [`DEPARTAMENTO DE ${nombre.toUpperCase()} (cuentas regionales del INE):`];

  for (const medida of MEASURES) {
    const v = valorDepto(board, medida.slug, slug);
    if (v) lineas.push(`- ${medida.label} (${medida.unit}), ${v.year}: ${num(v.value, medida.decimals)}`);
  }
  const growth = board.series.GDP_GROWTH?.[slug]?.slice(-5);
  if (growth?.length) lineas.push(`- Crecimiento anual de los últimos años: ${growth.map((g) => `${g.year} ${signo(g.value)}`).join(', ')}`);
  const decada = crecimientoDecada(board, slug);
  if (decada) lineas.push(`- Crecimiento acumulado del producto real ${decada.desde}-${decada.hasta}: ${signo(decada.cambio)}`);

  // Dónde queda entre los nueve.
  const ranking = (medida: string) =>
    DEPARTMENTS.map((d) => ({ slug: d.slug, v: valorDepto(board, medida, d.slug)?.value }))
      .filter((r): r is { slug: string; v: number } => r.v !== undefined)
      .sort((a, b) => b.v - a.v);
  const puesto = (medida: string, etiqueta: string) => {
    const lista = ranking(medida);
    const i = lista.findIndex((r) => r.slug === slug);
    if (i >= 0) lineas.push(`- Puesto ${i + 1} de ${lista.length} departamentos en ${etiqueta}.`);
  };
  puesto('GDP_SHARE', 'participación en el PIB');
  puesto('GDP_PER_CAPITA', 'PIB por habitante');
  puesto('EXPORTS_USD', 'exportaciones');
  puesto('GDP_GROWTH', 'crecimiento del último año');

  const actividades = activityStructure(board.activities, slug, board.activityYear)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  if (actividades.length) {
    lineas.push(`- Producto por actividad en ${board.activityYear}: ${actividades.map((a) => `${a.name} ${pct(a.value)}`).join('; ')}`);
  }
  const productos = topProducts(board, slug, board.tradeYear, 5);
  if (productos.length && board.tradeYear !== null) {
    const año = board.tradeYear;
    lineas.push(`- Principales exportaciones en ${año}: ${productos.map((p) => `${p.label} ${num(p.usd.find((u) => u.year === año)?.value ?? 0, 1)} millones de US$`).join('; ')}`);
  }

  if (sections && lengths) {
    const roads = buildRoadBoard(sections, lengths);
    const i = roads.kmByDepartment.findIndex((d) => d.department === slug || d.name === nombre);
    const d = roads.kmByDepartment[i];
    if (d) lineas.push(`- Red vial mapeada: ${entero(d.totalKm)} km (puesto ${i + 1} de ${roads.kmByDepartment.length}).`);
  }

  lineas.push('CONCLUSIONES DEL CAPÍTULO DEPARTAMENTAL (todo el país):', ...board.conclusions.map(conclusion));
  if (prensa?.articles.length) {
    lineas.push(`NOTICIAS RECIENTES QUE NOMBRAN A ${nombre.toUpperCase()} (las más recientes; no es el total del archivo):`, ...prensa.articles.slice(0, 10).map(nota));
  }
  return lineas.join('\n');
}

async function departamentos(): Promise<string> {
  const board = departmentBoard(await readMacroAnnual());
  const filas = DEPARTMENTS.map((d) => {
    const share = valorDepto(board, 'GDP_SHARE', d.slug);
    const growth = valorDepto(board, 'GDP_GROWTH', d.slug);
    const pc = valorDepto(board, 'GDP_PER_CAPITA', d.slug);
    const exp = valorDepto(board, 'EXPORTS_USD', d.slug);
    const decada = crecimientoDecada(board, d.slug);
    return `- ${d.name}: participación ${pct(share?.value)} (${share?.year ?? 's/f'}); crecimiento ${signo(growth?.value)} (${growth?.year ?? 's/f'}); en diez años ${signo(decada?.cambio)}; PIB por habitante ${pc ? `${entero(pc.value)} Bs (${pc.year})` : 's/d'}; exportaciones ${exp ? `${num(exp.value, 1)} millones de US$ (${exp.year})` : 's/d'}`;
  });
  return ['LOS NUEVE DEPARTAMENTOS (INE):', ...filas, 'CONCLUSIONES:', ...board.conclusions.map(conclusion)].join('\n');
}

const TEMAS_POLITICOS = ['POLITICA', 'CONFLICTO', 'JUDICIAL', 'SOCIAL'];

async function politica(): Promise<string> {
  const [macroPoints, prensa] = await Promise.all([
    readMacroAnnual(),
    readPressPage({ topic: TEMAS_POLITICOS }, 60).catch(() => null),
  ]);
  const inst = buildInstitutionsBoard(macroPoints.filter((p) => p.sector === 'INSTITUCIONAL'));
  const lineas = [
    `ÍNDICES INSTITUCIONALES (V-Dem, Freedom House, Fraser, Banco Mundial WGI, Transparencia; último año ${inst.asOfYear ?? 's/f'}):`,
    ...inst.conclusions.map(conclusion),
  ];
  if (prensa?.articles.length) {
    const ultimo = prensa.articles[0]?.eventDate ?? '';
    const desde = haceDias(ultimo, 14);
    const recientes = prensa.articles.filter((a) => a.eventDate >= desde);
    const tonos = new Map<string, number>();
    for (const a of recientes) tonos.set(a.tone, (tonos.get(a.tone) ?? 0) + 1);
    lineas.push(
      `PRENSA POLÍTICA Y DE CONFLICTO: ${recientes.length} notas entre el ${desde} y el ${ultimo} en la muestra leída; por tono: ${[...tonos.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ') || 's/d'}. El tono se deriva del titular por léxico, no lo publica el medio.`,
      'TITULARES RECIENTES:',
      ...prensa.articles.slice(0, 14).map(nota),
    );
  }
  return lineas.join('\n');
}

async function prensa(busqueda: string | null): Promise<string> {
  const page = await readPressPage(busqueda ? { search: busqueda } : {}, 30);
  const temas = new Map<string, number>();
  for (const a of page.articles) temas.set(a.topic, (temas.get(a.topic) ?? 0) + 1);
  return [
    busqueda
      ? `PRENSA QUE MENCIONA «${busqueda}»: las ${page.articles.length} más recientes (no es el total del archivo; para contar, usar la búsqueda de «Prensa»):`
      : `PRENSA RECIENTE (las últimas ${page.articles.length} notas de todos los temas; por tema: ${[...temas.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ')}):`,
    ...page.articles.slice(0, 20).map(nota),
  ].join('\n');
}

function bolivia(latest: Record<string, Record<string, YearValue>>, indicators: ReadonlyArray<{ code: string; label: string; unit: string }>): string[] {
  return indicators.flatMap((i) => {
    const v = latest[i.code]?.BOL;
    return v ? [`- ${i.label} (${i.unit}), ${v.year}: ${num(v.value, Math.abs(v.value) >= 100 ? 0 : 2)}`] : [];
  });
}

async function energia(): Promise<string> {
  const board = buildEnergyBoard(await readWorldBoard(ENERGY_CODES, ENERGY_PLACE_CODES));
  return ['ENERGÍA (Banco Mundial):', ...board.conclusions.map(conclusion), 'ÚLTIMOS DATOS DE BOLIVIA:', ...bolivia(board.latest, ENERGY_INDICATORS)].join('\n');
}

async function recursos(): Promise<string> {
  const [points, measured] = await Promise.all([readWorldBoard(RESOURCE_CODES, RESOURCE_PLACE_CODES), readMacroAnnual()]);
  const board = buildResourceBoard(points, measured);
  const partidas = board.commodities
    .map((c) => ({ c, v: c.value.at(-1) }))
    .filter((x): x is { c: typeof x.c; v: YearValue } => x.v !== undefined)
    .sort((a, b) => b.v.value - a.v.value)
    .slice(0, 12)
    .map(({ c, v }) => `- ${c.label}, ${v.year}: ${num(v.value / 1e6, 1)} millones de US$${c.weight.at(-1) ? `, ${entero((c.weight.at(-1)?.value ?? 0) / 1000)} t` : ''}`);
  return [
    'RECURSOS NATURALES:',
    ...board.conclusions.map(conclusion),
    'ÚLTIMOS DATOS DE BOLIVIA:',
    ...bolivia(board.latest, RESOURCE_INDICATORS),
    partidas.length ? 'EXPORTACIONES POR PARTIDA DE MATERIA PRIMA:' : '',
    ...partidas,
  ].filter(Boolean).join('\n');
}

async function ambiente(): Promise<string> {
  const board = buildEnvironmentBoard(await readWorldBoard(ENVIRONMENT_CODES, ENVIRONMENT_PLACE_CODES));
  return ['MEDIO AMBIENTE (Banco Mundial):', ...board.conclusions.map(conclusion), 'ÚLTIMOS DATOS DE BOLIVIA:', ...bolivia(board.latest, ENVIRONMENT_INDICATORS)].join('\n');
}

async function comercio(): Promise<string> {
  const macroPoints = await readMacroAnnual();
  const depts = departmentBoard(macroPoints);
  const trade = buildForeignTradeBoard(macroPoints.filter((p) => p.indicatorCode.startsWith('COMTRADE_')));
  const exporters = buildExportersBoard(macroPoints.filter((p) => p.sector === 'EMPRESARIAL'));
  const top = exporters.exporters
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10)
    .map((e) => `- ${e.rank}. ${e.name}: ${pct(e.share)} de las exportaciones`);
  return [
    'COMERCIO EXTERIOR:',
    ...foreignTradeConclusions(depts, trade).map(conclusion),
    top.length ? `PRINCIPALES EXPORTADORAS (${exporters.exportYear ?? 's/f'}; las diez primeras suman ${pct(concentration(exporters, 10))}; ranking de fuente privada, no oficial):` : '',
    ...top,
  ].filter(Boolean).join('\n');
}

async function empresas(): Promise<string> {
  const [filings, macroPoints] = await Promise.all([readCompanyFilings(200), readMacroAnnual()]);
  const exporters = buildExportersBoard(macroPoints.filter((p) => p.sector === 'EMPRESARIAL'));
  const edicion = exporters.reputationYear;
  const merco = exporters.general
    .filter((s) => s.year === edicion)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10)
    .map((s) => `- ${s.rank}. ${s.name}${s.score !== null ? ` (${entero(s.score)} puntos)` : ''}`);
  const recientes = filings
    .slice()
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
    .slice(0, 12)
    .map((f) => `- ${f.eventDate} · ${f.filer} (${f.sector}) · ${f.category}: ${f.subject}`);
  return [
    `HECHOS RELEVANTES RECIENTES EN LA BOLSA BOLIVIANA DE VALORES (${filings.length} leídos):`,
    ...recientes,
    merco.length ? `MONITOR MERCO DE REPUTACIÓN, edición ${edicion}:` : '',
    ...merco,
  ].filter(Boolean).join('\n');
}

async function exogenas(): Promise<string> {
  const board = await readExogenousBoard();
  const lineas = board.series.map((s) => {
    const r = summarize(s);
    if (!r.last) return null;
    return `- ${s.name} (${s.market}; ${s.unit}; ${s.publisher}): ${r.last[0]} ${num(r.last[1], Math.abs(r.last[1]) >= 100 ? 0 : 2)}; contra hace un año ${signo(r.yearChange)}; contra el promedio de cinco años ${signo(r.versusFiveYears)}`;
  });
  return [`PRECIOS INTERNACIONALES QUE AFECTAN A BOLIVIA (último mes ${board.latestMonth ?? 's/f'}):`, ...lineas.filter(Boolean)].join('\n');
}

async function mercados(): Promise<string> {
  const markets = await readMarkets();
  return [
    'MERCADOS (Binance):',
    ...markets.map((m) => `- ${m.name} (${m.unit}): ${num(m.latest, m.latest >= 100 ? 0 : 4)} el ${m.latestDate}; día ${signo(m.changePercent)}; en toda la ventana ${signo(m.windowPercent)} desde ${m.points[0]?.date ?? 's/f'}`),
  ].join('\n');
}

async function mundo(): Promise<string> {
  const points = await readWorldBoard(WORLD_CODES, WORLD_PLACE_CODES);
  const ultimo = new Map<string, { year: number; value: number }>();
  for (const p of points) {
    const key = `${p.indicatorCode}|${p.place}`;
    const actual = ultimo.get(key);
    if (!actual || p.year > actual.year) ultimo.set(key, { year: p.year, value: p.value });
  }
  const lineas = WORLD_INDICATORS.flatMap((i) => {
    const bol = ultimo.get(`${i.code}|BOL`);
    if (!bol) return [];
    const otros = WORLD_PLACE_CODES.filter((c) => c !== 'BOL')
      .map((c) => ({ c, v: ultimo.get(`${i.code}|${c}`) }))
      .filter((x): x is { c: string; v: { year: number; value: number } } => x.v !== undefined)
      .map(({ c, v }) => `${PLACE_LABEL[c] ?? c} ${sayWorldFigure(v.value, i)}`);
    return [`- ${i.label} (${i.unit}), Bolivia ${bol.year}: ${sayWorldFigure(bol.value, i)}; ${otros.join('; ')}`];
  });
  return ['BOLIVIA ANTE EL MUNDO (Banco Mundial; mundo y regiones):', ...lineas].join('\n');
}

async function carreteras(): Promise<string> {
  const [sections, lengths] = await Promise.all([readRoadSections(), readRoadLengths()]);
  const board = buildRoadBoard(sections, lengths);
  return [
    `RED VIAL: ${entero(board.totalKm)} km mapeados, ${pct(board.pavedShare)} pavimentados${board.asOfPeriod ? `; longitud oficial del INE al ${board.asOfPeriod}` : ''}.`,
    ...board.conclusions.map(conclusion),
    'POR DEPARTAMENTO:',
    ...board.kmByDepartment.map((d) => `- ${d.name}: ${entero(d.totalKm)} km`),
  ].join('\n');
}

async function ciudades(): Promise<string> {
  const families = await readPlaceFamilies();
  const porCiudad = new Map<string, Map<string, number>>();
  for (const f of families) {
    const grupos = porCiudad.get(f.city) ?? new Map<string, number>();
    grupos.set(f.entityGroup, (grupos.get(f.entityGroup) ?? 0) + f.places);
    porCiudad.set(f.city, grupos);
  }
  const lineas = [...porCiudad.entries()]
    .map(([ciudad, grupos]) => ({ ciudad, total: [...grupos.values()].reduce((a, b) => a + b, 0), grupos }))
    .sort((a, b) => b.total - a.total)
    .map(({ ciudad, total, grupos }) => `- ${ciudad}: ${entero(total)} lugares; ${[...grupos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g, n]) => `${g} ${entero(n)}`).join(', ')}`);
  return ['LUGARES Y NEGOCIOS MAPEADOS POR CIUDAD (OpenStreetMap y Overture; conteos de lo mapeado, no un censo):', ...lineas].join('\n');
}

async function metodo(): Promise<string> {
  const sources = await readSources();
  const porFuente = new Map<string, number>();
  for (const s of sources) porFuente.set(s.publisher, (porFuente.get(s.publisher) ?? 0) + 1);
  return [
    'FUENTES DE LAS SERIES DIARIAS Y SU COBERTURA:',
    ...sources.slice(0, 25).map((s) => `- ${s.name ?? s.indicator} · ${s.publisher} · ${s.frequency ?? 's/f'} · del ${s.firstDay} al ${s.lastDay} (${entero(s.readings)} lecturas)`),
    `Editoriales: ${[...porFuente.keys()].join(', ')}.`,
    'Los indicadores anuales vienen del Banco Mundial, el FMI, el INE, V-Dem, Freedom House, Fraser y Transparencia Internacional; cada serie cita su fuente en el tablero.',
  ].join('\n');
}

/* ---------------------------------------------------------------- armado */

function armar(id: PaqueteId, ctx: Contexto): Promise<string> {
  switch (id) {
    case 'HOY': return hoy();
    case 'DOLAR': return dolar();
    case 'MACRO': return macro();
    case 'DEPTO': return ctx.departamento ? departamento(ctx.departamento) : departamentos();
    case 'DEPTOS': return departamentos();
    case 'POLITICA': return politica();
    case 'PRENSA': return prensa(ctx.busqueda);
    case 'ENERGIA': return energia();
    case 'RECURSOS': return recursos();
    case 'AMBIENTE': return ambiente();
    case 'COMERCIO': return comercio();
    case 'EMPRESAS': return empresas();
    case 'EXOGENAS': return exogenas();
    case 'MERCADOS': return mercados();
    case 'MUNDO': return mundo();
    case 'CARRETERAS': return carreteras();
    case 'CIUDADES': return ciudades();
    case 'METODO': return metodo();
    case 'GUIA': return Promise.resolve(guiaCompleta());
  }
}

function conPlazo<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<never>((_, reject) => {
    reloj = setTimeout(() => reject(new Error('plazo')), ms);
  });
  return Promise.race([promesa, plazo]).finally(() => clearTimeout(reloj));
}

export async function leerPaquetes(ids: readonly PaqueteId[], ctx: Contexto): Promise<Paquete[]> {
  return Promise.all(
    ids.map(async (id) => {
      try {
        return { id, texto: await conPlazo(armar(id, ctx), PAQUETE_MS), leido: true };
      } catch (error) {
        const code = (error as { code?: string } | null)?.code ?? (error instanceof Error ? error.message : 'sin codigo');
        console.warn(`[asistente] paquete ${id} sin leer (${code})`);
        return { id, texto: 'No se pudo leer a tiempo. Decí que ese dato no está disponible ahora y no lo reemplaces por otro.', leido: false };
      }
    }),
  );
}

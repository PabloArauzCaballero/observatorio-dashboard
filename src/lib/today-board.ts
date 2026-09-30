import type { GapPoint, MacroPoint, PressArticle } from '@/lib/series';

/**
 * Bolivia hoy, en cinco lecturas y un veredicto por lectura.
 *
 * Quien entra a este informe por primera vez no llega con una pregunta sobre
 * una serie: llega con la pregunta de si el pais esta para poner dinero. Las
 * pestañas responden lo primero y no responden lo segundo, porque una cifra
 * suelta no dice si es buena o mala — y el lector que no conoce Bolivia no
 * tiene con que compararla.
 *
 * Asi que cada bloque lleva un veredicto. La regla que lo decide es una
 * funcion pura con umbrales fijos, y **el umbral se publica junto al
 * veredicto**: el lector ve «0,52 meses de importaciones» y, al lado, «por
 * debajo de 1 mes = adverso», de modo que puede discrepar del corte sin tener
 * que dudar de la cifra. Un tablero que opina sin enseñar su regla pide fe; uno
 * que la enseña pide revision, que es lo unico que esta pagina puede pedir.
 *
 * Dos cosas que la regla NO hace, a proposito:
 *
 * - No promedia los cinco bloques en una nota global. Reservas y estado de
 *   derecho no se suman, y el numero que saliera de sumarlos no seria mas
 *   preciso que sus partes, solo mas dificil de auditar.
 * - No emite veredicto sobre un dato viejo. Lo macro de este archivo es anual y
 *   varias series se publican con dos años de retraso; un semaforo verde sobre
 *   una cifra de 2022 se lee como si fuera de hoy. Cuando el dato tiene tres
 *   años o mas, el bloque dice su edad y se queda sin color.
 */

/** Cuanto se aleja un bloque de lo deseable, o el hecho de que no se puede decir. */
export type Verdict = 'favorable' | 'vigilar' | 'adverso' | 'sin-lectura';

/** Un dato de apoyo: la cifra y el periodo al que corresponde. */
export interface BoardFact {
  label: string;
  value: string;
  /** El periodo del dato. Va siempre: es lo que separa un dato de una creencia. */
  meta: string;
}

export interface BoardBlock {
  key: string;
  title: string;
  icon: string;
  verdict: Verdict;
  /** Una frase, derivada de la misma regla que el color. */
  reading: string;
  /** La cifra que manda en el bloque. */
  value: string;
  unit: string;
  /** Que mide esa cifra. */
  measure: string;
  /** El periodo de la cifra principal, tal como lo publica la fuente. */
  asOf: string;
  /** Años entre el periodo del dato y el año en curso. */
  lag: number;
  /** El umbral que se aplico, escrito para que el lector pueda discrepar. */
  rule: string;
  facts: BoardFact[];
  /** La historia de la cifra principal, para que el nivel se lea como trayecto. */
  spark: number[];
  publisher: string | null;
  sourceUrl: string | null;
  /** La pestaña donde esta el detalle de este bloque. */
  goesTo: string;
}

/** Una novedad del archivo de prensa, con su medio y su fecha. */
export interface BoardChange {
  id: string;
  date: string;
  outlet: string;
  headline: string;
  summary: string | null;
  url: string;
  topic: string;
}

export interface TodayBoard {
  blocks: BoardBlock[];
  changes: BoardChange[];
  /** El dia del que son las novedades, que no es necesariamente hoy. */
  changesDate: string | null;
  /** Cuantos medios distintos publicaron ese dia. */
  changesOutlets: number;
  /** El año contra el que se midio la edad de cada dato. */
  currentYear: number;
}

/**
 * A partir de cuantos años de retraso un dato deja de sostener un veredicto.
 *
 * Tres, y no dos, porque varias series del Banco Mundial cierran el año con un
 * año de demora y el tablero se quedaria sin decir nada sobre casi todo. Tres
 * años es el punto en que la cifra describe otro gobierno, otro precio del gas
 * y otra cuenta de reservas.
 */
const MAX_LAG = 3;

const DECIMALS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

const num = (value: number, options: Intl.NumberFormatOptions = DECIMALS): string =>
  value.toLocaleString('es-BO', options);

const pct = (value: number, decimals = 1): string =>
  `${num(value, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} %`;

const signedPct = (value: number, decimals = 1): string =>
  `${value > 0 ? '+' : ''}${pct(value, decimals)}`;

/** Dolares en la escala en que la cifra se lee de un vistazo. */
function usd(value: number): string {
  const millions = value / 1_000_000;
  if (Math.abs(millions) >= 1000) {
    return `${num(millions / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil M`;
  }
  return `${num(millions, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} M`;
}

/** El ultimo valor publicado de un indicador, y su historia para la chispa. */
interface Reading {
  value: number;
  period: string;
  year: number;
  publisher: string | null;
  sourceUrl: string | null;
  history: number[];
  /** La serie completa, para poder buscar un maximo con ventana. */
  points: ReadonlyArray<{ period: string; value: number }>;
  /** El maximo de toda la serie, con su periodo: de donde viene la caida. */
  peak: { value: number; period: string } | null;
}

/**
 * El maximo de una serie dentro de una ventana, no en toda su historia.
 *
 * `FUEL_EXPORTS_PCT` llega hasta 1985 y su maximo absoluto cae ahi, cuando lo
 * que Bolivia exportaba era estaño y el gas todavia no tenia mercado. Medir la
 * caida del gas contra 1985 da un porcentaje correcto debajo de una frase
 * falsa. La ventana obliga a nombrar contra que periodo se compara.
 */
function peakSince(
  reading: Reading,
  firstPeriod: string,
): { value: number; period: string } | null {
  return reading.points
    .filter((point) => point.period >= firstPeriod)
    .reduce<{ value: number; period: string } | null>(
      (best, point) => (!best || point.value > best.value ? point : best),
      null,
    );
}

/**
 * Un indice de los indicadores que este tablero mira.
 *
 * Se construye una vez sobre las sesenta y ocho mil filas anuales en lugar de
 * recorrerlas una vez por bloque, que es la diferencia entre un recorrido y
 * catorce sobre el mismo arreglo en cada peticion.
 */
function indexReadings(macro: MacroPoint[], codes: readonly string[]): Map<string, Reading> {
  const wanted = new Set(codes);
  const rows = new Map<string, MacroPoint[]>();

  for (const point of macro) {
    if (!wanted.has(point.indicatorCode)) continue;
    if (!Number.isFinite(point.value)) continue;
    const list = rows.get(point.indicatorCode);
    if (list) list.push(point);
    else rows.set(point.indicatorCode, [point]);
  }

  const readings = new Map<string, Reading>();
  for (const [code, list] of rows) {
    list.sort((left, right) => left.period.localeCompare(right.period));
    const last = list.at(-1);
    if (!last) continue;
    const peak = list.reduce<MacroPoint | null>(
      (best, point) => (!best || point.value > best.value ? point : best),
      null,
    );
    readings.set(code, {
      value: last.value,
      period: last.period,
      year: Number(last.period.slice(0, 4)),
      publisher: last.publisher,
      sourceUrl: last.sourceUrl,
      history: list.slice(-16).map((point) => point.value),
      points: list.map((point) => ({ period: point.period, value: point.value })),
      peak: peak ? { value: peak.value, period: peak.period } : null,
    });
  }
  return readings;
}

/**
 * El veredicto de un nivel contra dos cortes, en el sentido que corresponda.
 *
 * `direction` dice de que lado esta lo deseable: `'low'` cuando lo bueno es una
 * cifra pequeña (inflacion, brecha) y `'high'` cuando lo bueno es una grande
 * (meses de reservas, estado de derecho). Es un parametro y no dos funciones
 * porque el error que se quiere evitar — leer al reves un indicador cuyo signo
 * no es obvio — se evita nombrandolo en la llamada.
 */
function judge(
  value: number,
  good: number,
  bad: number,
  direction: 'low' | 'high',
): Exclude<Verdict, 'sin-lectura'> {
  if (direction === 'low') {
    if (value <= good) return 'favorable';
    if (value < bad) return 'vigilar';
    return 'adverso';
  }
  if (value >= good) return 'favorable';
  if (value > bad) return 'vigilar';
  return 'adverso';
}

/** El veredicto que sobrevive a la edad del dato. */
function withLag(verdict: Exclude<Verdict, 'sin-lectura'>, lag: number): Verdict {
  return lag >= MAX_LAG ? 'sin-lectura' : verdict;
}

/** Los codigos que el tablero lee. Uno solo por hecho, para no contradecirse. */
const CODES = [
  'CPI_INFLATION_ANNUAL_PCT',
  'BROAD_MONEY_GROWTH_PCT',
  'REAL_INTEREST_RATE_PCT',
  'LENDING_RATE_PCT',
  'RESERVES_IN_IMPORT_MONTHS',
  'INTERNATIONAL_RESERVES_USD',
  'CURRENT_ACCOUNT_PCT_GDP',
  'FDI_NET_INFLOWS_USD',
  'FUEL_EXPORTS_PCT',
  'EG.IMP.CONS.ZS',
  'VDEM_RULE_OF_LAW_INDEX',
  'POLITICAL_STABILITY_SCORE',
  'CONTROL_OF_CORRUPTION_SCORE',
  'REGULATORY_QUALITY_SCORE',
  'GDP_GROWTH_ANNUAL_PCT',
  'IMF_GROSS_PUBLIC_DEBT_PCT_GDP',
] as const;

/**
 * Los temas que cuentan como politica en el archivo de prensa.
 *
 * El clasificador marca el tema por el titular, no por la seccion del medio, y
 * una medida de combustible con bloqueo es tan politica como economica. El
 * pulso cuenta los dos y lo dice, en vez de elegir por el lector.
 */
const POLITICAL_TOPICS = new Set(['POLITICA', 'SOCIAL', 'JUSTICIA', 'SEGURIDAD']);

/**
 * Desde cuando se mide el auge del gas.
 *
 * El contrato con Brasil empieza a exportar en 1999 y el mercado que sostuvo
 * las cuentas externas es el que arranca ahi. Antes de esa fecha la serie
 * habla de otra economia.
 */
const GAS_ERA = '2000';

/** Cuantos dias de prensa entran en el pulso politico. */
const PULSE_DAYS = 7;

/** El dia anterior, en la misma escala de fecha que usa el archivo. */
function daysBefore(date: string, days: number): string {
  const moment = new Date(`${date}T12:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() - days);
  return moment.toISOString().slice(0, 10);
}

export interface TodayBoardInput {
  macro: MacroPoint[];
  gap: GapPoint[];
  press: PressArticle[];
  /** El año contra el que se mide la edad de cada dato. Se inyecta para que la
   *  funcion siga siendo pura y su prueba no dependa del reloj. */
  currentYear: number;
}

export function buildTodayBoard({
  macro,
  gap,
  press,
  currentYear,
}: TodayBoardInput): TodayBoard {
  const readings = indexReadings(macro, CODES);
  const read = (code: string): Reading | null => readings.get(code) ?? null;
  const lagOf = (reading: Reading | null): number =>
    reading ? currentYear - reading.year : MAX_LAG;

  const blocks: BoardBlock[] = [];

  /* ------------------------------------------------------------------ dolar */

  /*
   * El unico bloque con dato de ayer, y el unico que un inversor puede
   * comprobar por su cuenta esta misma tarde. Va primero por las dos razones.
   */
  const lastGap = gap.at(-1);
  if (lastGap) {
    const monthAgoDate = daysBefore(lastGap.date, 30);
    const monthAgo = [...gap].reverse().find((point) => point.date <= monthAgoDate) ?? null;
    const move = monthAgo ? lastGap.gapPercent - monthAgo.gapPercent : null;
    const peak = gap.reduce<GapPoint | null>(
      (best, point) => (!best || point.gapPercent > best.gapPercent ? point : best),
      null,
    );

    blocks.push({
      key: 'dolar',
      title: 'Situación del dólar',
      icon: 'monedas',
      verdict: judge(lastGap.gapPercent, 2, 10, 'low'),
      reading:
        lastGap.gapPercent <= 2
          ? 'El tipo oficial y el paralelo están prácticamente en el mismo precio.'
          : lastGap.gapPercent < 10
            ? 'Hay dos precios del dólar, y la diferencia entre ellos ya no cabe en el costo de cambiarlo.'
            : 'El tipo de cambio oficial no es el precio al que se consigue el dólar.',
      value: signedPct(lastGap.gapPercent, 2),
      unit: 'sobre el oficial',
      measure: 'Brecha entre el dólar oficial y el paralelo',
      asOf: lastGap.date,
      lag: 0,
      rule: 'Umbrales: hasta 2 % favorable, hasta 10 % vigilar, por encima adverso. El 2 % es el orden del costo de cambiar moneda: por debajo de ahí las dos cotizaciones son la misma. Por encima del 10 % el tipo oficial deja de describir el mercado.',
      facts: [
        { label: 'Oficial', value: num(lastGap.official, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), meta: 'Bs/USD' },
        { label: 'Paralelo', value: num(lastGap.parallelMid, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), meta: 'punto medio, Bs/USD' },
        ...(move !== null
          ? [
              {
                label: 'En 30 días',
                value: `${move > 0 ? '+' : ''}${num(move, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts`,
                meta: `desde el ${monthAgo?.date ?? '—'}`,
              },
            ]
          : []),
        ...(peak && peak.date !== lastGap.date
          ? [{ label: 'Máximo histórico', value: signedPct(peak.gapPercent, 0), meta: `el ${peak.date}` }]
          : []),
      ],
      spark: gap.slice(-90).map((point) => point.gapPercent),
      publisher: null,
      sourceUrl: null,
      goesTo: 'Tipo de cambio',
    });
  }

  /* ------------------------------------------------------------- monetaria */

  const inflation = read('CPI_INFLATION_ANNUAL_PCT');
  if (inflation) {
    const money = read('BROAD_MONEY_GROWTH_PCT');
    const realRate = read('REAL_INTEREST_RATE_PCT');
    const lending = read('LENDING_RATE_PCT');
    const lag = lagOf(inflation);

    blocks.push({
      key: 'monetaria',
      title: 'Situación monetaria',
      icon: 'banco',
      verdict: withLag(judge(inflation.value, 5, 10, 'low'), lag),
      reading:
        inflation.value >= 10
          ? 'La inflación es de dos dígitos por primera vez en dos décadas; el interés real es negativo, así que ahorrar en bolivianos pierde poder de compra.'
          : inflation.value > 5
            ? 'La inflación se salió del rango en que estuvo una década, sin llegar a dos dígitos.'
            : 'Los precios crecen dentro del rango en que Bolivia los mantuvo durante una década.',
      value: pct(inflation.value),
      unit: 'anual',
      measure: 'Inflación al consumidor',
      asOf: inflation.period,
      lag,
      rule: 'Umbrales: hasta 5 % favorable, hasta 10 % vigilar, por encima adverso. El 5 % es el techo del rango en que Bolivia sostuvo los precios entre 2012 y 2023; los dos dígitos son el corte con el que se llama alta a una inflación.',
      facts: [
        ...(realRate
          ? [{ label: 'Interés real', value: signedPct(realRate.value), meta: realRate.period }]
          : []),
        ...(money
          ? [{ label: 'Dinero en circulación', value: signedPct(money.value), meta: money.period }]
          : []),
        ...(lending
          ? [{ label: 'Tasa activa', value: pct(lending.value), meta: lending.period }]
          : []),
      ],
      spark: inflation.history,
      publisher: inflation.publisher,
      sourceUrl: inflation.sourceUrl,
      goesTo: 'Macroeconomía',
    });
  }

  /* --------------------------------------------------------------- externa */

  const months = read('RESERVES_IN_IMPORT_MONTHS');
  if (months) {
    const reserves = read('INTERNATIONAL_RESERVES_USD');
    const current = read('CURRENT_ACCOUNT_PCT_GDP');
    const fdi = read('FDI_NET_INFLOWS_USD');
    const lag = lagOf(months);

    blocks.push({
      key: 'externa',
      title: 'Situación externa',
      icon: 'globo',
      verdict: withLag(judge(months.value, 3, 1, 'high'), lag),
      reading:
        months.value < 1
          ? 'Las reservas no cubren un mes de importaciones. Es la restricción que está detrás de la escasez de dólares y de combustible.'
          : months.value < 3
            ? 'Las reservas cubren menos de los tres meses de importaciones que se consideran suficientes.'
            : 'Las reservas cubren el colchón de importaciones que se considera suficiente.',
      value: num(months.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      unit: 'meses de importación',
      measure: 'Reservas internacionales, medidas en importaciones que cubren',
      asOf: months.period,
      lag,
      rule: 'Umbrales: 3 meses o más favorable, entre 1 y 3 vigilar, menos de 1 adverso. Tres meses de importaciones es la regla de adecuación de reservas de uso corriente.',
      facts: [
        ...(reserves
          ? [{ label: 'Reservas', value: `${usd(reserves.value)} USD`, meta: reserves.period }]
          : []),
        ...(months.peak
          ? [
              {
                label: 'Máximo',
                value: `${num(months.peak.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses`,
                meta: `en ${months.peak.period}`,
              },
            ]
          : []),
        ...(current
          ? [{ label: 'Cuenta corriente', value: signedPct(current.value), meta: `del PIB, ${current.period}` }]
          : []),
        ...(fdi
          ? [{ label: 'Inversión extranjera', value: `${usd(fdi.value)} USD`, meta: fdi.period }]
          : []),
      ],
      spark: months.history,
      publisher: months.publisher,
      sourceUrl: months.sourceUrl,
      goesTo: 'Macroeconomía',
    });
  }

  /* ------------------------------------------------------------- energetica */

  /*
   * De las dos series que dicen medir «combustible como % de lo exportado»,
   * esta publica la serie larga y coherente; la otra (`TX.VAL.FUEL.ZS.UN`) da
   * cifras distintas para los mismos años. El tablero publica una sola, porque
   * dos cifras que se contradicen no informan mejor que una.
   */
  const fuelShare = read('FUEL_EXPORTS_PCT');
  const fuelPeak = fuelShare ? peakSince(fuelShare, GAS_ERA) : null;
  if (fuelShare && fuelPeak) {
    const dependence = read('EG.IMP.CONS.ZS');
    const lag = lagOf(fuelShare);
    const ofPeak = (fuelShare.value / fuelPeak.value) * 100;

    blocks.push({
      key: 'energetica',
      title: 'Situación energética',
      icon: 'rayo',
      verdict: withLag(judge(ofPeak, 75, 50, 'high'), lag),
      reading:
        ofPeak < 50
          ? `El gas dejó de ser lo que Bolivia vende: era el ${pct(fuelPeak.value, 1)} de las exportaciones en ${fuelPeak.period} y hoy es menos de la mitad de eso. Con él se fueron los dólares que sostenían el tipo de cambio.`
          : ofPeak < 75
            ? 'La exportación de combustible perdió peso frente a su máximo, sin llegar a la mitad.'
            : 'El combustible sigue pesando en las exportaciones lo que pesaba en su mejor año.',
      value: pct(fuelShare.value),
      unit: 'de lo exportado',
      measure: 'Combustible como parte de las exportaciones',
      asOf: fuelShare.period,
      lag,
      rule: `Umbrales medidos contra el máximo de la propia serie desde ${GAS_ERA} (${pct(fuelPeak.value, 1)} en ${fuelPeak.period}): 75 % de ese máximo o más favorable, entre 50 % y 75 % vigilar, por debajo de la mitad adverso. Se mide contra su historia y no contra un nivel absoluto porque lo que importa aquí no es cuánto combustible exporta un país, sino que Bolivia construyó sus cuentas externas sobre el que exportaba.`,
      facts: [
        {
          label: 'Frente a su máximo',
          value: pct(ofPeak, 0),
          meta: `máximo ${pct(fuelPeak.value, 1)} en ${fuelPeak.period}`,
        },
        ...(dependence
          ? [
              {
                label: 'Energía importada neta',
                value: pct(dependence.value),
                meta: `del consumo, ${dependence.period}`,
              },
            ]
          : []),
      ],
      spark: fuelShare.history,
      publisher: fuelShare.publisher,
      sourceUrl: fuelShare.sourceUrl,
      goesTo: 'Macroeconomía',
    });
  }

  /* --------------------------------------------------------------- politica */

  /*
   * El unico bloque sin serie economica propia. Se arma con los indices que
   * tienen editor citable y fecha — V-Dem y el Banco Mundial — y se acompaña
   * del pulso de prensa, que es lo unico de esta seccion que esta al dia. El
   * pulso va como dato de apoyo y no como veredicto: mide cuanto se habla de
   * algo, que no es como esta.
   */
  const ruleOfLaw = read('VDEM_RULE_OF_LAW_INDEX');
  if (ruleOfLaw) {
    const stability = read('POLITICAL_STABILITY_SCORE');
    const corruption = read('CONTROL_OF_CORRUPTION_SCORE');
    const regulatory = read('REGULATORY_QUALITY_SCORE');
    const lag = lagOf(ruleOfLaw);

    const lastPressDay = press.reduce<string | null>(
      (latest, article) => (!latest || article.eventDate > latest ? article.eventDate : latest),
      null,
    );
    const pulseFloor = lastPressDay ? daysBefore(lastPressDay, PULSE_DAYS - 1) : null;
    const recent = pulseFloor ? press.filter((article) => article.eventDate >= pulseFloor) : [];
    const political = recent.filter((article) => POLITICAL_TOPICS.has(article.topic));

    blocks.push({
      key: 'politica',
      title: 'Situación política',
      icon: 'escudo',
      verdict: withLag(judge(ruleOfLaw.value, 0.5, 0.35, 'high'), lag),
      reading:
        ruleOfLaw.value < 0.35
          ? 'El estado de derecho medido por V-Dem lleva cuatro años cayendo. Para un inversor externo, eso es la fuerza con que se hace cumplir un contrato.'
          : ruleOfLaw.value < 0.5
            ? 'El estado de derecho se sostiene por debajo del punto medio de la escala.'
            : 'El estado de derecho se mantiene en la mitad alta de la escala.',
      value: num(ruleOfLaw.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      unit: 'de 0 a 1',
      measure: 'Índice de estado de derecho (V-Dem)',
      asOf: ruleOfLaw.period,
      lag,
      rule: 'Umbrales sobre la escala del propio índice, que va de 0 a 1: 0,50 o más favorable, por encima de 0,35 vigilar, por debajo adverso. El corte alto es el punto medio de la escala; el bajo es el tercio inferior.',
      facts: [
        ...(stability
          ? [{ label: 'Estabilidad política', value: num(stability.value), meta: `escala −2,5 a 2,5 · ${stability.period}` }]
          : []),
        ...(corruption
          ? [{ label: 'Control de la corrupción', value: num(corruption.value), meta: `escala −2,5 a 2,5 · ${corruption.period}` }]
          : []),
        ...(regulatory
          ? [{ label: 'Calidad regulatoria', value: num(regulatory.value), meta: `escala −2,5 a 2,5 · ${regulatory.period}` }]
          : []),
        /*
         * Se dice «de las ultimas N», y no «del archivo»: esto cuenta sobre la
         * pagina de titulares que la portada ya tenia leida, no sobre las
         * treinta y ocho mil notas del corpus. Decirlo de la otra forma
         * convertiria un tamaño de pagina en un hallazgo.
         */
        ...(lastPressDay && recent.length
          ? [
              {
                label: 'Pulso de prensa',
                value: `${political.length} de ${recent.length}`,
                meta: `últimas notas del archivo, hasta el ${lastPressDay}`,
              },
            ]
          : []),
      ],
      spark: ruleOfLaw.history,
      publisher: ruleOfLaw.publisher,
      sourceUrl: ruleOfLaw.sourceUrl,
      goesTo: 'Prensa',
    });
  }

  /* --------------------------------------------------------- lo que cambio */

  /*
   * El ultimo dia que el archivo alcanzo, no «hoy»: el raspado corre de
   * madrugada y un titulo fechado hoy a las nueve de la mañana todavia no esta.
   * La fecha se publica para que la diferencia se vea en lugar de disimularse.
   */
  const changesDate = press.reduce<string | null>(
    (latest, article) => (!latest || article.eventDate > latest ? article.eventDate : latest),
    null,
  );
  const sameDay = changesDate ? press.filter((article) => article.eventDate === changesDate) : [];
  const changes: BoardChange[] = sameDay
    .slice()
    .sort((left, right) => (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''))
    .slice(0, 6)
    .map((article) => ({
      id: article.factClaimId,
      date: article.eventDate,
      outlet: article.outlet,
      headline: article.headline,
      summary: article.summary,
      url: article.url,
      topic: article.topic,
    }));

  return {
    blocks,
    changes,
    changesDate,
    changesOutlets: new Set(sameDay.map((article) => article.outlet)).size,
    currentYear,
  };
}

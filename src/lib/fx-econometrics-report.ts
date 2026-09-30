/**
 * Las pruebas del tipo de cambio, compuestas para papel.
 *
 * La batería formal (`fx-econometrics.ts`) se leía en la pestaña del tipo de
 * cambio como un panel de cuatro cajas debajo de los gráficos: frases, una
 * tabla de dieciocho filas con t y F, los momentos por régimen y tres figuras.
 * Es material de consulta —se lee una vez, se cita, se manda a alguien— y en
 * la pantalla empujaba el resto del capítulo hacia abajo para quien solo
 * quería el precio. El 2026-09-23 pasó a ser un informe que se descarga, y
 * esto lo arma.
 *
 * Sin gráficos a propósito. El informe del análisis macro los tiene porque
 * copia los SVG que ya están dibujados en la pantalla del lector; este se
 * compone en el servidor, donde no hay figura que copiar, y dibujar una a mano
 * sería otro motor de gráficos que mantener. Las tablas dicen lo mismo con el
 * número exacto, y la fecha del quiebre —la única que una figura aportaba— va
 * en las notas, que es donde tiene que ir (ver `methodNotes`).
 *
 * Nada de lo que se lee aquí se redacta en este archivo. Las conclusiones son
 * las de `econometricConclusions`; las filas, las de `tabulate`; las notas se
 * arman con las cifras del resultado y cambian cuando él cambia. Es una
 * función pura sobre el resultado, así que el mismo documento sale de la ruta
 * y de un script que lea el CSV público.
 */

import { detectRegimes, realIndex } from './fx-macro';
import type { GapReading, MacroPoint } from './fx-macro';
import { fxEconometrics } from './fx-econometrics';
import type { FxEconometrics } from './fx-econometrics';
import { econometricConclusions } from './fx-econometrics-reading';
import { FAMILY_LABEL, number, regimeRows, signed, tabulate } from './fx-econometrics-table';
import type { TestFamily } from './fx-econometrics-table';
import type { FxConclusion } from './fx-snapshot';
import { INK, Sheet } from './pdf-sheet';
import type { TableColumn, TextStyle } from './pdf-sheet';

/* ---------------------------------------------------------------- entrada */

export interface EconometricsSeries {
  /** El oficial ya resuelto con la precedencia de la vista: publicado, vendedor, comprador. */
  official: readonly MacroPoint[];
  parallelBuy: readonly MacroPoint[];
  parallelSell: readonly MacroPoint[];
  ufv: readonly MacroPoint[];
  gap: readonly GapReading[];
}

/**
 * La batería sobre las series tal como las lee el capítulo.
 *
 * Devuelve `null` con menos de sesenta jornadas del paralelo, que es el mismo
 * umbral por debajo del cual el panel de pantalla no se mostraba.
 */
export function assembleEconometrics(series: EconometricsSeries): FxEconometrics | null {
  const sellByDate = new Map(series.parallelSell.map((point) => [point.date, point.value]));
  const parallelMid: MacroPoint[] = series.parallelBuy.flatMap((point) => {
    const other = sellByDate.get(point.date);
    return other === undefined ? [] : [{ date: point.date, value: (point.value + other) / 2 }];
  });
  if (parallelMid.length < 60) return null;

  const base = parallelMid[0]?.date;
  return fxEconometrics({
    official: series.official,
    parallelMid,
    ufv: series.ufv,
    gap: series.gap,
    regimes: detectRegimes(series.official),
    realParallel: base ? realIndex(parallelMid, series.ufv, base) : [],
  });
}

/* ------------------------------------------------------------------ texto */

const longDate = (value: string): string =>
  new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));

const STYLE = {
  brand: { font: 'serif-bold', size: 13, color: INK.official, tracking: 1.4 },
  brandSmall: { font: 'sans', size: 6.5, color: INK.faint, tracking: 1 },
  issued: { font: 'sans', size: 7.5, color: INK.faint, align: 'right' },
  kicker: { font: 'sans-bold', size: 7, color: INK.parallel, tracking: 1.1 },
  title: { font: 'serif-bold', size: 20, color: INK.ink, leading: 24 },
  subtitle: { font: 'mono', size: 7.5, color: INK.faint },
  lede: { font: 'serif', size: 10.5, color: INK.soft, leading: 15 },
  h2: { font: 'serif-bold', size: 12, color: INK.ink, leading: 15 },
  h3: { font: 'sans-bold', size: 7, color: INK.faint, tracking: 0.9, leading: 11 },
  claim: { font: 'serif-bold', size: 10.5, color: INK.ink, leading: 13.5 },
  figure: { font: 'mono', size: 8.5, color: INK.official, leading: 11 },
  body: { font: 'sans', size: 8.5, color: INK.soft, leading: 12.3 },
  note: { font: 'sans', size: 7.5, color: INK.faint, leading: 10.5 },
} satisfies Record<string, TextStyle>;

/* ------------------------------------------------------------------ notas */

/**
 * Lo que un lector tiene que saber para no leer mal la tabla.
 *
 * Cada nota depende del resultado: la del GARCH integrado solo aparece si la
 * persistencia tocó el borde, la del traspaso negativo solo si el signo salió
 * negativo, y todas llevan la cifra que las justifica.
 */
export function methodNotes(result: FxEconometrics): Array<{ title: string; text: string }> {
  const notes: Array<{ title: string; text: string }> = [];

  notes.push({
    title: 'Ventanas',
    text:
      'Ninguna prueba cruza el cambio de régimen salvo la que lo mide: las que hablan de la ' +
      'relación oficial–paralelo usan solo el tramo en que el oficial se mueve' +
      (result.moving
        ? `, desde el ${longDate(result.moving.from)} (${number(result.moving.n, 0)} jornadas).`
        : '; en esta muestra ese tramo todavía no alcanza las cuarenta jornadas y esas pruebas no se corren.'),
  });

  notes.push({
    title: 'Valores críticos',
    text:
      'Los de Dickey–Fuller y de Engle–Granger son los de la superficie de respuesta de ' +
      'MacKinnon para el tamaño de muestra usado; los del quiebre, los de Andrews para una ' +
      'restricción y recorte del 15 %. Cada fila trae el estadístico y la referencia para que ' +
      'quien prefiera otro nivel de significación la relea al suyo.',
  });

  const g = result.volatility.garch;
  if (g) {
    notes.push({
      title: g.integrated ? 'GARCH integrado' : 'GARCH',
      text: g.integrated
        ? `La persistencia estimada es ${number(g.persistence, 3)}, en el borde de la unidad: la ` +
          'muestra junta un tramo con el oficial fijo y otro en movimiento, y la verosimilitud ' +
          'prefiere recordar cada choque para siempre. La volatilidad condicional de la última ' +
          `jornada (${number(g.currentVolAnnual, 1)} % anualizada) sigue siendo válida; el nivel de ` +
          'largo plazo no lo es y se retiene. Como control sin modelo va la lectura RiskMetrics ' +
          `(λ = 0,94): ${number(g.ewmaVolAnnual, 1)} %.`
        : `La persistencia estimada es ${number(g.persistence, 3)}` +
          (g.unconditionalVolAnnual !== null
            ? `, con un nivel de largo plazo de ${number(g.unconditionalVolAnnual, 1)} % anualizado`
            : '') +
          `. Control sin modelo (RiskMetrics, λ = 0,94): ${number(g.ewmaVolAnnual, 1)} %.`,
    });
  }

  const horizon = result.passThrough?.cumulative.at(-1);
  if (result.passThrough && horizon && horizon.value < 0) {
    notes.push({
      title: 'Traspaso negativo',
      text:
        `El coeficiente acumulado a ${horizon.months} meses sale ${signed(horizon.value)} ± ` +
        `${number(horizon.standardError)}. No es un error de cálculo: en la muestra ` +
        `(${result.passThrough.from} a ${result.passThrough.to}) la brecha se cerró —el paralelo ` +
        'bajó— mientras la inflación de la UFV subía. El regresor no se cambia al oficial porque ' +
        'el oficial estuvo fijo la mayor parte de la muestra y no tiene varianza con que explicar nada.',
    });
  }

  const search = result.breaks.search;
  if (search && search.date) {
    const peak = result.breaks.gapPeak;
    notes.push({
      title: 'Fecha del quiebre',
      text:
        `El mayor F de Quandt–Andrews cae el ${longDate(search.date)} (sup F = ${number(search.supF)}).` +
        (peak
          ? ` La brecha tocó su máximo de ${signed(peak.gapPercent)} % el ${longDate(peak.date)}.`
          : '') +
        (result.moving ? ` El oficial empezó a moverse el ${longDate(result.moving.from)}.` : '') +
        ' La fecha se da aquí y no se marca sobre un gráfico de la serie: la marca vertical del ' +
        'tablero significa «cambio de método» y ponerla ahí diría algo que no pasó.',
    });
  }

  return notes;
}

/* ---------------------------------------------------------------- informe */

const TEST_COLUMNS: readonly TableColumn[] = [
  { head: 'Prueba', width: 0.19 },
  { head: 'Serie', width: 0.15 },
  { head: 'Ventana', width: 0.14 },
  { head: 'n', width: 0.05, numeric: true },
  { head: 'Estadístico', width: 0.15 },
  { head: 'Valor crítico / p', width: 0.16 },
  { head: 'Decisión', width: 0.16 },
];

const REGIME_COLUMNS: readonly TableColumn[] = [
  { head: 'Régimen', width: 0.15 },
  { head: 'Tramo', width: 0.18 },
  { head: 'Jornadas', width: 0.1, numeric: true },
  { head: 'Retorno medio', width: 0.14, numeric: true },
  { head: 'Vol. anual', width: 0.1, numeric: true },
  { head: 'VaR 95 %', width: 0.1, numeric: true },
  { head: 'Peor jornada', width: 0.22 },
];

export interface ReportOptions {
  /** La fecha de emisión; se pasa desde fuera para que el documento sea reproducible. */
  issuedAt?: Date;
  /** Quién firma el cálculo. */
  author?: string;
}

/** El nombre del archivo que se propone al descargar. */
export function reportFileName(result: FxEconometrics): string {
  return `econometria-tipo-de-cambio-${result.asOf ?? 'sin-fecha'}.pdf`;
}

/** El informe entero, en bytes de PDF. */
export function econometricsReport(
  result: FxEconometrics,
  options: ReportOptions = {},
): Uint8Array<ArrayBuffer> {
  const conclusions: FxConclusion[] = econometricConclusions(result);
  const rows = tabulate(result);
  const author = options.author ?? 'Observatorio Económico';
  const issued = new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/La_Paz',
  }).format(options.issuedAt ?? new Date());
  const asOf = result.asOf ? longDate(result.asOf) : 'sin fecha';

  const sheet = new Sheet({
    title: 'Análisis econométrico del tipo de cambio — Observatorio Económico',
    author,
    subject: `Pruebas formales sobre el dólar en Bolivia, último dato del ${asOf}`,
  });

  /*
   * La marca de agua y el pie, en cada página. Se dibujan al cerrar el
   * documento porque solo entonces se sabe cuántas páginas hay.
   */
  sheet.decorate((page, index, count) => {
    const centre = { x: page.width / 2 - 195, y: page.height / 2 - 120 };
    page.text(
      'OBSERVATORIO',
      centre.x,
      centre.y + 60,
      { font: 'serif-bold', size: 58, color: INK.official, tracking: 3 },
      { rotate: 28, opacity: true },
    );
    page.text(
      'ECONÓMICO',
      centre.x + 30,
      centre.y - 6,
      { font: 'serif-bold', size: 58, color: INK.official, tracking: 3 },
      { rotate: 28, opacity: true },
    );

    const base = page.margin.bottom - 22;
    page.line(page.left, base + 11, page.right, base + 11, INK.rule, 0.6);
    const foot: TextStyle = { font: 'sans', size: 6.5, color: INK.faint, tracking: 0.5 };
    page.text('OBSERVATORIO ECONÓMICO · TIPO DE CAMBIO', page.left, base, foot);
    page.text('Observatorio Económico', page.width / 2, base, {
      font: 'serif-bold',
      size: 8.5,
      color: INK.official,
      tracking: 0.8,
      align: 'center',
    });
    page.text(`${issued.toUpperCase()} · ${index} / ${count}`, page.right, base, {
      ...foot,
      align: 'right',
    });
  });

  /* Cabecera ----------------------------------------------------------- */

  const top = sheet.y;
  sheet.text('OBSERVATORIO ECONÓMICO', sheet.left, top - 13, STYLE.brand);
  sheet.text('PRUEBAS ECONOMÉTRICAS DEL TIPO DE CAMBIO', sheet.left, top - 23, STYLE.brandSmall);
  sheet.text(`Emitido el ${issued}`, sheet.right, top - 12, STYLE.issued);
  sheet.text(`Último dato: ${asOf}`, sheet.right, top - 22, STYLE.issued);
  sheet.space(28);
  sheet.rule(INK.ink, 2, 0, 14);

  sheet.paragraph('TIPO DE CAMBIO · PRUEBAS FORMALES', STYLE.kicker, { after: 2 });
  sheet.paragraph('Análisis econométrico del tipo de cambio', STYLE.title, { after: 2 });
  const facts = [
    result.full ? `${longDate(result.full.from)} – ${longDate(result.full.to)}` : null,
    result.full ? `${number(result.full.n, 0)} jornadas del paralelo` : null,
    result.moving ? `${number(result.moving.n, 0)} con el oficial en movimiento` : null,
    'BOB por USD',
  ].filter((entry): entry is string => entry !== null);
  sheet.paragraph(facts.join('   ·   '), STYLE.subtitle, { after: 8 });

  // La entradilla con su barra a la izquierda, como en el informe macro.
  const ledeTop = sheet.y;
  sheet.paragraph(
    'Las preguntas que la lectura del capítulo deja abiertas, sometidas a prueba: si el ' +
      'paralelo revierte o acumula, si la brecha se cierra sola y a qué velocidad, si el oficial ' +
      'sigue al mercado o lo lidera, dónde se quiebra la serie, si la volatilidad viene en rachas ' +
      'y cuánto de una depreciación llega a los precios.',
    STYLE.lede,
    { x: sheet.left + 10 },
  );
  sheet.line(sheet.left + 1, ledeTop, sheet.left + 1, sheet.y - 2, INK.rule, 2);

  const heading = (text: string): void => {
    sheet.ensure(60);
    sheet.space(10);
    sheet.paragraph(text, STYLE.h2);
    sheet.rule(INK.rule, 0.6, 2, 5);
  };
  const subheading = (text: string): void => {
    // Lo bastante para el rótulo, la cabecera de la tabla y su primera fila:
    // un rótulo al pie de una página y su tabla en la siguiente no se leen juntos.
    sheet.ensure(85);
    sheet.space(6);
    sheet.paragraph(text.toUpperCase(), STYLE.h3, { after: 1 });
  };

  /* Lectura derivada --------------------------------------------------- */

  heading('Qué dicen las pruebas');
  sheet.paragraph(
    'Cada frase sale de una prueba con nombre, un estadístico y un valor crítico, y todos están ' +
      'en las tablas de abajo. Se dice qué se rechaza y a qué nivel; no se dice por qué pasó ni qué ' +
      'va a pasar.',
    STYLE.note,
    { after: 4 },
  );
  conclusions.forEach((conclusion, index) => {
    sheet.ensure(58);
    sheet.space(index === 0 ? 2 : 8);
    sheet.paragraph(`${index + 1}. ${conclusion.claim}`, STYLE.claim, { keep: 3 });
    sheet.paragraph(conclusion.figure, STYLE.figure, { x: sheet.left + 12, after: 1 });
    sheet.paragraph(conclusion.detail, STYLE.body, { x: sheet.left + 12 });
  });

  /* Una tabla por prueba ---------------------------------------------- */

  heading('Las pruebas, una por fila');
  sheet.paragraph(
    'Estadístico, muestra y referencia de cada prueba, para leer las frases contra su número. ' +
      'La columna de decisión dice qué hipótesis nula se rechaza y a qué nivel.',
    STYLE.note,
    { after: 2 },
  );
  const families = [...new Set(rows.map((row) => row.family))] as TestFamily[];
  for (const family of families) {
    subheading(FAMILY_LABEL[family]);
    sheet.table({
      columns: TEST_COLUMNS,
      size: 7.5,
      rows: rows
        .filter((row) => row.family === family)
        .map((row) => [
          row.test,
          row.series,
          row.window,
          number(row.n, 0),
          row.statistic,
          row.reference,
          row.verdict,
        ]),
    });
  }

  /* Momentos por régimen ---------------------------------------------- */

  const parallelMoments = regimeRows(result.regimeMoments.parallel);
  const officialMoments = regimeRows(result.regimeMoments.official);
  if (parallelMoments.length || officialMoments.length) {
    heading('Cada régimen con su estadística');
    sheet.paragraph(
      'Los momentos de las variaciones diarias, calculados dentro de cada tramo y nunca a través ' +
        'del cambio: un promedio que cruza la fecha en que el oficial se soltó describe un mercado ' +
        'que no existió.',
      STYLE.note,
      { after: 2 },
    );
    if (parallelMoments.length) {
      subheading('Paralelo');
      sheet.table({ columns: REGIME_COLUMNS, size: 7.5, rows: parallelMoments });
    }
    if (officialMoments.length) {
      subheading('Oficial');
      sheet.table({ columns: REGIME_COLUMNS, size: 7.5, rows: officialMoments });
    }
  }

  /* Notas -------------------------------------------------------------- */

  heading('Notas metodológicas');
  for (const note of methodNotes(result)) {
    sheet.ensure(40);
    sheet.space(1);
    sheet.paragraph(note.title, { ...STYLE.body, font: 'sans-bold', color: INK.ink });
    sheet.paragraph(note.text, STYLE.body, { after: 2 });
  }

  /* Colofón ------------------------------------------------------------ */

  // Compacto a propósito: en tres líneas cabe al pie de la última página de
  // notas, y no se queda solo en una hoja en blanco.
  sheet.ensure(40);
  sheet.space(6);
  sheet.rule(INK.rule, 0.6, 0, 3);
  sheet.paragraph(
    'Dato: series diarias del Observatorio Económico —oficial publicado, paralelo como punto ' +
      'medio de compra y venta, UFV del Banco Central de Bolivia y la brecha que calcula el ' +
      `núcleo—. Cálculos: ${author}, sobre las mismas series que el capítulo del tipo de cambio ` +
      'muestra en pantalla; el CSV de esas series se descarga en /api/export?dataset=series.',
    { ...STYLE.note, size: 7, leading: 9.5 },
  );

  return sheet.bytes();
}

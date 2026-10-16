/**
 * El análisis de un indicador, compuesto para papel.
 *
 * Un lector que revisa una serie termina queriendo mandarla a alguien, y lo que
 * hoy podía mandar era una captura de pantalla o un CSV: la captura pierde los
 * números y el CSV pierde el análisis. Esto arma el documento entero —portada,
 * estadísticos, figuras, atípicos y procedencia— y lo entrega a la impresora
 * del navegador, que es la que sabe hacer un PDF.
 *
 * Sin librería de PDF a propósito. Las figuras ya existen como SVG en la
 * pantalla, así que se copian tal cual: el documento sale vectorial, pesa unos
 * kilobytes, el texto se puede buscar y seleccionar, y el tablero no engorda
 * medio megabyte de dependencia para una descarga.
 *
 * Dos detalles que no son adorno. El primero: la paleta va escrita aquí en
 * claro y no leída del navegador, porque un lector con el sistema en oscuro
 * imprimiría gris sobre blanco. El segundo: el documento se escribe en un
 * `iframe` oculto en vez de una ventana nueva, que es lo que evita que el
 * bloqueador de ventanas emergentes se coma la descarga sin avisar.
 */

import { hojaDeFuentes } from './export/afiche';
import { imprimirDocumento } from './export/informe';
import { cssPapel, papelHtml } from './export/membrete';
import type { MacroStats } from './macro-stats';

/**
 * La paleta del tablero, fijada en su versión clara.
 *
 * Son los mismos valores que `globals.css` declara en `:root`. Repetirlos aquí
 * es una duplicación consciente: el documento impreso no hereda el tema del
 * lector y tiene que verse igual salga de donde salga.
 */
const PALETTE: Record<string, string> = {
  '--ink': '#17191a',
  '--ink-soft': '#4d4a44',
  '--ink-faint': '#69655d',
  '--rule': '#dcd5c8',
  '--rule-soft': '#e8e2d6',
  '--paper': '#fffefb',
  '--panel': '#fffefb',
  '--panel-tint': '#efe9dd',

  /*
   * Las casillas de identidad y los tres personajes del informe, en su versión
   * clara. Un token que falte aquí no se rompe de forma visible: se sustituye
   * por `currentColor`, así que la figura sale impresa en el color del texto y
   * nadie se entera hasta que mira el PDF. Por eso esta lista tiene que cubrir
   * todos los tokens de color que una figura pueda usar, no solo los cinco
   * primeros.
   */
  '--series-1': '#3963b2',
  '--series-2': '#ba813d',
  '--series-3': '#921e2c',
  '--series-4': '#159ca9',
  '--series-5': '#64378d',
  '--series-6': '#388f66',
  '--series-rest': '#7e7a73',
  '--official': '#3963b2',
  '--parallel': '#ba813d',
  '--gap': '#921e2c',

  '--up': '#a83634',
  '--down': '#00787d',
  '--mid': '#e9e4da',

  '--good': '#376a50',
  '--warning': '#a97416',
  '--serious': '#ae5528',
  '--critical': '#9a3130',

  '--seq-100': '#dfecff',
  '--seq-200': '#bbd3f6',
  '--seq-300': '#90b3e7',
  '--seq-400': '#6793d5',
  '--seq-500': '#4071b9',
  '--seq-600': '#295494',
  '--seq-700': '#1a3a68',

  '--ord-1': '#6793d5',
  '--ord-2': '#4071b9',
  '--ord-3': '#1a3a68',

  '--adv-0': '#7e7a73',
  '--adv-1': '#ab413a',
  '--adv-2': '#8c2d2b',
  '--adv-3': '#6b1e21',

  '--chart-surface': '#fffefb',
  '--grid': '#e6dfd2',
  '--axis-ink': '#69655d',

  /*
   * Gelasio y Libre Franklin, incrustadas por `hojaDeFuentes()`. Las cifras van
   * siempre en Franklin con cifras tabulares: en papel tampoco hay monoespaciada.
   */
  '--serif': "'ObsSerif', Georgia, 'Times New Roman', serif",
  '--sans': "'ObsSans', 'Libre Franklin', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
  '--mono': "'ObsSans', 'Libre Franklin', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
};

/** El oro del membrete: filetes y volantas, como en `export/membrete.ts`. */
const GOLD = '#aa884d';
const GOLD_DEEP = '#806337';

/** `var(--x)` y `var(--x, respaldo)` sustituidos por su valor impreso. */
function resolveTokens(markup: string): string {
  return markup.replace(
    /var\(\s*(--[a-z0-9-]+)\s*(?:,([^()]*))?\)/gi,
    (_whole, token, fallback) => {
      const value = PALETTE[String(token)];
      if (value) return value;
      return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : 'currentColor';
    },
  );
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * El gráfico de una caja, y no el primer SVG que haya dentro.
 *
 * Cada figura va dentro de una sección que empieza por su encabezado, y ese
 * encabezado lleva un icono —que es un SVG de diecisiete píxeles—. Tomando el
 * primero, el informe salía con tres iconos estirados al ancho de la página en
 * el sitio de las tres primeras figuras: perfectamente visible en el PDF y
 * perfectamente invisible en la pantalla de la que se copió.
 *
 * Se busca por lo que distingue a un gráfico: la superficie que dibuja la
 * librería, el violín que se dibuja a mano, y como último recurso cualquier SVG
 * que no sea un icono.
 */
function chartIn(host: Element | null | undefined): SVGElement | null {
  if (!host) return null;
  const surface = host.querySelector('svg.recharts-surface, .violin-frame > svg');
  if (surface) return surface as SVGElement;
  for (const candidate of host.querySelectorAll('svg')) {
    if (!candidate.classList.contains('ic')) return candidate;
  }
  return null;
}

/**
 * Una figura de la pantalla, lista para el papel.
 *
 * Recharts dibuja su SVG con un alto y un ancho en píxeles, así que copiado tal
 * cual sale del tamaño que tenía la ventana en la que se pulsó el botón. Aquí
 * se le asegura el `viewBox` y se le quitan las medidas fijas: la figura pasa a
 * ocupar el ancho de la caja de texto y a conservar su proporción, que es lo
 * que hace que dos gráficos impresos uno debajo del otro se vean del mismo
 * tamaño.
 *
 * Devuelve cadena vacía cuando no hay nada que copiar, y quien llama decide si
 * la figura se omite. Es preferible un informe sin una figura a un hueco con un
 * pie que promete algo que no está.
 */
export function captureFigure(host: Element | null | undefined): string {
  const svg = chartIn(host);
  if (!svg) return '';

  const clone = svg.cloneNode(true) as SVGElement;
  const width = Number(svg.getAttribute('width')) || (svg as SVGGraphicsElement).clientWidth || 0;
  const height =
    Number(svg.getAttribute('height')) || (svg as SVGGraphicsElement).clientHeight || 0;
  if (!clone.getAttribute('viewBox') && width > 0 && height > 0) {
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  clone.removeAttribute('width');
  clone.removeAttribute('height');
  clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  clone.setAttribute('style', 'width:100%;height:auto;overflow:visible');

  return resolveTokens(new XMLSerializer().serializeToString(clone));
}

/** Un bloque de HTML de la pantalla —la retícula de años, por ejemplo— para el papel. */
export function captureBlock(host: Element | null | undefined): string {
  if (!host) return '';
  return resolveTokens(host.outerHTML);
}

export interface PdfFigure {
  caption: string;
  /** El SVG o el HTML ya serializado. Una figura vacía se omite. */
  markup: string;
  note?: string;
  /**
   * Una figura alta —el violín— que no debe estirarse a toda la caja de texto.
   *
   * Las demás se dibujan apaisadas y ganan al ocupar el ancho entero. El violín
   * mide 340 px de lienzo y estirado a 190 mm se convierte en una mancha de
   * media página, así que se queda en una columna y centrado.
   */
  portrait?: boolean;
}

export interface PdfTable {
  caption: string;
  head: readonly string[];
  rows: ReadonlyArray<readonly string[]>;
  /** Índices de columna que se alinean a la derecha por llevar cifras. */
  numeric?: readonly number[];
  note?: string;
}

export interface PdfStat {
  label: string;
  value: string;
  hint?: string;
}

export interface AnalysisReport {
  title: string;
  code: string;
  sector: string;
  unit: string;
  publisher: string | null;
  sourceUrl: string | null;
  span: string;
  stats: MacroStats;
  /** El párrafo que interpreta la fila: se redacta fuera y llega hecho. */
  reading: string;
  groups: ReadonlyArray<{ heading: string; items: readonly PdfStat[] }>;
  figures: readonly PdfFigure[];
  tables: readonly PdfTable[];
  definition?: { what: string; howToRead: string; caveat?: string } | null;
  /** Quién firma la definición, para que no se confunda con la de la fuente. */
  definitionAuthor: string;
}

const PRINT_CSS = `
  * { box-sizing: border-box; }

  /* La hoja, la orla, el membrete y el pie vienen de membrete.ts. */
  body {
    color: ${PALETTE['--ink']};
    font-family: ${PALETTE['--sans']};
    font-size: 10pt;
    line-height: 1.55;
  }

  h1 {
    font-family: ${PALETTE['--serif']};
    font-size: 24pt;
    line-height: 1.12;
    font-weight: 700;
    margin: 3pt 0 4pt;
    letter-spacing: -0.015em;
  }
  .kicker {
    font-size: 6.8pt;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${GOLD_DEEP};
    font-weight: 700;
  }
  .subtitle {
    display: flex;
    flex-wrap: wrap;
    gap: 0 6pt;
    font-size: 8.5pt;
    color: ${PALETTE['--ink-faint']};
    font-variant-numeric: tabular-nums;
  }
  .subtitle span + span::before { content: '·'; margin-right: 6pt; }
  .lede {
    margin: 12pt 0 0;
    font-family: ${PALETTE['--serif']};
    font-size: 11.5pt;
    line-height: 1.55;
    color: ${PALETTE['--ink-soft']};
    border-left: 1.5pt solid ${GOLD};
    padding-left: 10pt;
  }

  /* Estadísticos ------------------------------------------------------ */

  h2 {
    font-family: ${PALETTE['--serif']};
    font-size: 13pt;
    font-weight: 700;
    margin: 16pt 0 6pt;
    padding-bottom: 3pt;
    border-bottom: 0.6pt solid ${PALETTE['--rule']};
  }
  h3 {
    font-size: 7.5pt;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${PALETTE['--ink-faint']};
    font-weight: 600;
    margin: 10pt 0 4pt;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5pt;
  }
  .stat {
    border-top: 0.8pt solid ${PALETTE['--ink']};
    padding: 4pt 2pt 5pt;
    break-inside: avoid;
  }
  .stat span {
    display: block;
    font-size: 7pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${PALETTE['--ink-faint']};
  }
  .stat b {
    display: block;
    font-family: ${PALETTE['--sans']};
    font-variant-numeric: tabular-nums;
    font-size: 12pt;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin-top: 1pt;
  }
  .stat i {
    display: block;
    font-style: normal;
    font-size: 7pt;
    color: ${PALETTE['--ink-faint']};
  }

  /* Figuras ----------------------------------------------------------- */

  /*
   * Una figura por fila, y la razón es de lectura, no de maquetación.
   *
   * Dos por fila entraban a un tercio del ancho que tenían en pantalla, y los
   * rótulos de los ejes —fijados por la librería a once píxeles contra una caja
   * de mil cien— llegaban al papel por debajo de los tres puntos. Agrandarlos
   * no servía: la librería reparte las marcas del eje contra el tamaño original,
   * así que el texto crecido se pisaba consigo mismo. A ancho completo la
   * reducción es de siete décimas y un retoque pequeño basta.
   */
  .figures { display: flex; flex-direction: column; gap: 10pt; }
  figure {
    margin: 8pt 0 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  figure.portrait .plot { max-width: 82mm; margin-inline: auto; }
  figcaption {
    font-size: 7.5pt;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${PALETTE['--ink-faint']};
    font-weight: 600;
    margin-bottom: 4pt;
  }
  figure .plot {
    border-top: 0.6pt solid ${PALETTE['--rule']};
    border-bottom: 0.6pt solid ${PALETTE['--rule']};
    padding: 6pt 0;
  }
  figure .plot svg { display: block; width: 100%; height: auto; font-family: ${PALETTE['--sans']}; }

  /*
   * Los rótulos de los ejes, recuperados de la reducción.
   *
   * La figura se copia de una pantalla de unos 1.100 px y se imprime en una
   * caja de 190 mm, o de 92 mm cuando van dos por fila: el texto de 11 px que
   * en pantalla se lee cómodo llega al papel a menos de tres puntos. Se
   * reescala en el origen —una regla de CSS gana a un atributo de presentación,
   * que es como la librería fija el tamaño— y el factor es el inverso de la
   * reducción de cada caso. Solo afecta a los gráficos de la librería: el
   * violín se dibuja a mano en un lienzo de 340 px y llega al papel casi a
   * tamaño natural.
   */
  figure .plot svg.recharts-surface text { font-size: 15px; }
  figure p {
    margin: 4pt 0 0;
    font-size: 8pt;
    color: ${PALETTE['--ink-soft']};
    line-height: 1.45;
  }

  /* La retícula de años, copiada de la pantalla y vuelta a vestir. */
  .heat-scroll { overflow: visible; }
  .heat-grid { display: grid; gap: 1.5pt; font-size: 7pt; }
  .heat-head, .heat-row {
    font-family: ${PALETTE['--sans']};
    font-variant-numeric: tabular-nums;
    font-size: 6.5pt;
    color: ${PALETTE['--ink-faint']};
    text-align: center;
    align-self: center;
  }
  .heat-row { text-align: right; padding-right: 3pt; }
  .heat-cell {
    border-radius: 2pt;
    padding: 3pt 1pt;
    text-align: center;
    font-family: ${PALETTE['--sans']};
    font-variant-numeric: tabular-nums;
    font-size: 6.5pt;
    color: ${PALETTE['--ink']};
    background: ${PALETTE['--rule-soft']};
  }
  .chart-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8pt;
    list-style: none;
    margin: 4pt 0 0;
    padding: 0;
    font-size: 7pt;
    color: ${PALETTE['--ink-faint']};
  }
  .chart-legend li { display: flex; align-items: center; gap: 3pt; }
  .chart-legend-mark {
    width: 7pt;
    height: 7pt;
    border-radius: 2pt;
    display: inline-block;
  }
  .chart-note { font-size: 7.5pt; color: ${PALETTE['--ink-faint']}; margin: 3pt 0 0; }

  /* Tablas ------------------------------------------------------------ */

  table.datos {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    margin-top: 4pt;
    break-inside: avoid;
  }
  table.datos thead th {
    text-align: left;
    font-size: 6.8pt;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${PALETTE['--ink-faint']};
    font-weight: 600;
    padding: 3pt 5pt;
    border-bottom: 0.8pt solid ${PALETTE['--ink']};
    white-space: nowrap;
  }
  table.datos tbody td {
    padding: 3pt 5pt;
    border-bottom: 0.4pt solid ${PALETTE['--rule']};
    color: ${PALETTE['--ink-soft']};
    vertical-align: top;
  }
  table.datos tbody tr:nth-child(even) td { background: ${PALETTE['--panel-tint']}; }
  table.datos th.num,
  table.datos td.num {
    text-align: right;
    font-family: ${PALETTE['--sans']};
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: ${PALETTE['--ink']};
  }

  .prose p { margin: 5pt 0 0; font-size: 9.5pt; color: ${PALETTE['--ink-soft']}; }
  .prose b { color: ${PALETTE['--ink']}; }

  .colophon {
    margin-top: 14pt;
    padding-top: 6pt;
    border-top: 0.6pt solid ${PALETTE['--rule']};
    font-size: 7.5pt;
    color: ${PALETTE['--ink-faint']};
    line-height: 1.5;
    break-inside: avoid;
  }
  .colophon b { color: ${PALETTE['--ink-soft']}; }
  code {
    font-family: ${PALETTE['--sans']};
    font-size: 7.5pt;
    letter-spacing: 0.02em;
    color: ${PALETTE['--ink']};
  }
`;

/** El nombre del archivo que propone el diálogo de impresión. */
const slug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60);

function renderTable(table: PdfTable): string {
  const numeric = new Set(table.numeric ?? []);
  const head = table.head
    .map((cell, index) => `<th class="${numeric.has(index) ? 'num' : ''}">${escapeHtml(cell)}</th>`)
    .join('');
  const body = table.rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell, index) =>
              `<td class="${numeric.has(index) ? 'num' : ''}">${escapeHtml(cell)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');
  return `
    <h3>${escapeHtml(table.caption)}</h3>
    <table class="datos"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    ${table.note ? `<p class="chart-note">${escapeHtml(table.note)}</p>` : ''}
  `;
}

/**
 * El documento entero sobre el papel de la casa. `fuentes` son las
 * declaraciones `@font-face` con Gelasio y Libre Franklin incrustadas.
 */
export function documentoAnalisis(report: AnalysisReport, fuentes: string, emitido?: Date): string {
  const issued = (emitido ?? new Date()).toLocaleDateString('es-BO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const stats = report.groups
    .map(
      (group) => `
        <h3>${escapeHtml(group.heading)}</h3>
        <div class="stats">
          ${group.items
            .map(
              (item) => `
                <div class="stat">
                  <span>${escapeHtml(item.label)}</span>
                  <b>${escapeHtml(item.value)}</b>
                  ${item.hint ? `<i>${escapeHtml(item.hint)}</i>` : ''}
                </div>`,
            )
            .join('')}
        </div>`,
    )
    .join('');

  const figures = report.figures
    .filter((figure) => figure.markup.trim())
    .map(
      (figure) => `
        <figure class="${figure.portrait ? 'portrait' : ''}">
          <figcaption>${escapeHtml(figure.caption)}</figcaption>
          <div class="plot">${figure.markup}</div>
          ${figure.note ? `<p>${escapeHtml(figure.note)}</p>` : ''}
        </figure>`,
    )
    .join('');

  const definition = report.definition
    ? `
      <h2>Qué mide y cómo leerlo</h2>
      <div class="prose">
        <p><b>Qué mide.</b> ${escapeHtml(report.definition.what)}</p>
        <p><b>Cómo leerlo.</b> ${escapeHtml(report.definition.howToRead)}</p>
        ${report.definition.caveat ? `<p><b>Advertencia.</b> ${escapeHtml(report.definition.caveat)}</p>` : ''}
      </div>`
    : '';

  const cuerpo = `
    <div class="kicker">${escapeHtml(report.sector)} · análisis de distribución</div>
    <h1>${escapeHtml(report.title)}</h1>
    <div class="subtitle">
      <span>${escapeHtml(report.span)}</span>
      <span>${report.stats.n} observaciones</span>
      <span>${escapeHtml(report.unit)}</span>
      <span>${escapeHtml(report.publisher ?? 'fuente citada')}</span>
    </div>

    <p class="lede">${escapeHtml(report.reading)}</p>

    <h2>Estadísticos descriptivos</h2>
    ${stats}

    <h2>Distribución y correlación</h2>
    <div class="figures">${figures}</div>

    <h2>Tablas</h2>
    ${report.tables.map(renderTable).join('')}

    ${definition}

    <div class="colophon">
      <b>Dato:</b> ${escapeHtml(report.publisher ?? 'fuente citada')}${
        report.sourceUrl ? ` · ${escapeHtml(report.sourceUrl)}` : ''
      }.<br>
      <b>Cálculos:</b> DatosBolivia.com, sobre las ${report.stats.n} observaciones del
      periodo ${escapeHtml(report.span)} tal como estaban filtradas en pantalla. La media recortada
      quita el 10 % de cada cola; los atípicos son los que caen fuera de los bigotes de Tukey
      (1,5 × RIC); la curtosis se reporta en exceso, de modo que cero es la normal.<br>
      <b>Definición:</b> redactada por ${escapeHtml(report.definitionAuthor)} a partir del
      concepto estándar. No es la del publicador.<br>
      <b>Reproducibilidad:</b> el CSV y el JSON de esta misma selección se descargan desde el
      tablero, en el panel de macroeconomía.
    </div>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(`${report.title} — DatosBolivia.com`)}</title>
<style>${fuentes}${cssPapel()}${PRINT_CSS}</style>
</head>
<body>${papelHtml(
    { documento: 'Análisis de serie', fecha: issued, referencia: `Serie ${report.code}` },
    cuerpo,
    `${report.sector} · ${report.code}`,
  )}</body>
</html>`;
}

/**
 * Compone el informe y abre el diálogo de impresión sobre él.
 *
 * Primero se incrustan las fuentes —sin ellas el papel sale en Georgia— y
 * después el documento va al `iframe` oculto de `imprimirDocumento`, que lo
 * retira cuando el lector vuelve del diálogo.
 */
export function printAnalysis(report: AnalysisReport): void {
  if (typeof document === 'undefined') return;
  // El título del documento es lo que el diálogo propone como nombre de
  // archivo, así que el PDF sale llamándose como el indicador.
  const nombre = `datosbolivia-${slug(report.title)}-${report.code}`;
  void hojaDeFuentes()
    .catch(() => '')
    .then((fuentes) => imprimirDocumento(documentoAnalisis(report, fuentes), nombre));
}

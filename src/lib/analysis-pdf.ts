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

import type { MacroStats } from './macro-stats';

/**
 * La paleta del tablero, fijada en su versión clara.
 *
 * Son los mismos valores que `globals.css` declara en `:root`. Repetirlos aquí
 * es una duplicación consciente: el documento impreso no hereda el tema del
 * lector y tiene que verse igual salga de donde salga.
 */
const PALETTE: Record<string, string> = {
  '--ink': '#14181f',
  '--ink-soft': '#4a5464',
  '--ink-faint': '#78839a',
  '--rule': '#e2e6ed',
  '--rule-soft': '#eef1f5',
  '--paper': '#ffffff',
  '--panel': '#ffffff',
  '--panel-tint': '#f6f8fa',

  /*
   * Las casillas de identidad y los tres personajes del informe, en su versión
   * clara. Un token que falte aquí no se rompe de forma visible: se sustituye
   * por `currentColor`, así que la figura sale impresa en el color del texto y
   * nadie se entera hasta que mira el PDF. Por eso esta lista tiene que cubrir
   * todos los tokens de color que una figura pueda usar, no solo los cinco
   * primeros.
   */
  '--series-1': '#2a78d6',
  '--series-2': '#eb6834',
  '--series-3': '#963b8c',
  '--series-4': '#a87c00',
  '--series-5': '#4a3aa7',
  '--series-6': '#0f8f62',
  '--series-rest': '#6b7688',
  '--official': '#2a78d6',
  '--parallel': '#eb6834',
  '--gap': '#963b8c',

  '--up': '#d03b3b',
  '--down': '#0d7f85',
  '--mid': '#f0efec',

  '--good': '#0ca30c',
  '--warning': '#fab219',
  '--serious': '#ec835a',
  '--critical': '#d03b3b',

  '--seq-100': '#cde2fb',
  '--seq-200': '#9ec5f4',
  '--seq-300': '#6da7ec',
  '--seq-400': '#3987e5',
  '--seq-500': '#256abf',
  '--seq-600': '#184f95',
  '--seq-700': '#0d366b',

  '--ord-1': '#86b6ef',
  '--ord-2': '#2a78d6',
  '--ord-3': '#104281',

  '--adv-0': '#6b7688',
  '--adv-1': '#c04d44',
  '--adv-2': '#a5332e',
  '--adv-3': '#8a1616',

  '--chart-surface': '#ffffff',
  '--grid': '#e6e9ef',
  '--axis-ink': '#6b7688',

  '--serif': "ui-serif, Georgia, 'Times New Roman', serif",
  '--sans':
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  '--mono': "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
};

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
  @page { size: A4; margin: 16mm 14mm 20mm; }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: ${PALETTE['--paper']};
    color: ${PALETTE['--ink']};
    font-family: ${PALETTE['--sans']};
    font-size: 10.5pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /*
   * La marca de agua y el pie van fijos, que es lo que hace que el navegador
   * los repita en cada página impresa sin tener que saber cuántas hay.
   */
  .watermark {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 0;
    pointer-events: none;
  }
  .watermark span {
    font-family: ${PALETTE['--serif']};
    font-size: 58pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    line-height: 1.05;
    text-align: center;
    text-transform: uppercase;
    color: ${PALETTE['--official']};
    opacity: 0.045;
    transform: rotate(-28deg);
    white-space: pre-line;
  }

  .footer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-top: 4pt;
    border-top: 0.6pt solid ${PALETTE['--rule']};
    background: ${PALETTE['--paper']};
    font-size: 7.5pt;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${PALETTE['--ink-faint']};
  }
  .footer b {
    font-family: ${PALETTE['--serif']};
    font-size: 9pt;
    letter-spacing: 0.1em;
    color: ${PALETTE['--official']};
    text-transform: none;
  }

  .sheet { position: relative; z-index: 1; padding-bottom: 10mm; }

  /* Cabecera --------------------------------------------------------- */

  .masthead {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1.2rem;
    border-bottom: 2pt solid ${PALETTE['--ink']};
    padding-bottom: 6pt;
  }
  .brand {
    font-family: ${PALETTE['--serif']};
    font-size: 13pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${PALETTE['--official']};
  }
  .brand small {
    display: block;
    font-family: ${PALETTE['--sans']};
    font-size: 7pt;
    font-weight: 500;
    letter-spacing: 0.16em;
    color: ${PALETTE['--ink-faint']};
  }
  .issued { text-align: right; font-size: 8pt; color: ${PALETTE['--ink-faint']}; }

  h1 {
    font-family: ${PALETTE['--serif']};
    font-size: 21pt;
    line-height: 1.18;
    font-weight: 600;
    margin: 12pt 0 2pt;
    letter-spacing: -0.01em;
  }
  .kicker {
    font-size: 7.5pt;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${PALETTE['--parallel']};
    font-weight: 600;
    margin-top: 12pt;
  }
  .subtitle {
    display: flex;
    flex-wrap: wrap;
    gap: 0 10pt;
    font-size: 8.5pt;
    color: ${PALETTE['--ink-faint']};
    font-family: ${PALETTE['--mono']};
  }
  .lede {
    margin: 10pt 0 0;
    font-family: ${PALETTE['--serif']};
    font-size: 11.5pt;
    line-height: 1.55;
    color: ${PALETTE['--ink-soft']};
    border-left: 2pt solid ${PALETTE['--rule']};
    padding-left: 9pt;
  }

  /* Estadísticos ------------------------------------------------------ */

  h2 {
    font-family: ${PALETTE['--serif']};
    font-size: 12pt;
    font-weight: 600;
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
    border: 0.6pt solid ${PALETTE['--rule']};
    border-radius: 3pt;
    padding: 5pt 6pt;
    background: ${PALETTE['--panel-tint']};
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
    font-family: ${PALETTE['--mono']};
    font-size: 11.5pt;
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
    border: 0.6pt solid ${PALETTE['--rule']};
    border-radius: 3pt;
    padding: 6pt;
    background: ${PALETTE['--panel']};
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
    font-family: ${PALETTE['--mono']};
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
    font-family: ${PALETTE['--mono']};
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

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    margin-top: 4pt;
    break-inside: avoid;
  }
  thead th {
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
  tbody td {
    padding: 3pt 5pt;
    border-bottom: 0.4pt solid ${PALETTE['--rule']};
    color: ${PALETTE['--ink-soft']};
    vertical-align: top;
  }
  tbody tr:nth-child(even) td { background: ${PALETTE['--panel-tint']}; }
  .num {
    text-align: right;
    font-family: ${PALETTE['--mono']};
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
    font-family: ${PALETTE['--mono']};
    font-size: 7.5pt;
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
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    ${table.note ? `<p class="chart-note">${escapeHtml(table.note)}</p>` : ''}
  `;
}

function buildDocument(report: AnalysisReport): string {
  const issued = new Date().toLocaleDateString('es-BO', {
    day: '2-digit',
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

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(`${report.title} — Observatorio Económico`)}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
  <div class="watermark"><span>Observatorio\nEconómico</span></div>

  <div class="sheet">
    <div class="masthead">
      <div class="brand">Observatorio Económico<small>Análisis de series macroeconómicas</small></div>
      <div class="issued">
        Emitido el ${escapeHtml(issued)}<br>
        <code>${escapeHtml(report.code)}</code>
      </div>
    </div>

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
      <b>Cálculos:</b> el Observatorio Económico, sobre las ${report.stats.n} observaciones del
      período ${escapeHtml(report.span)} tal como estaban filtradas en pantalla. La media recortada
      quita el 10 % de cada cola; los atípicos son los que caen fuera de los bigotes de Tukey
      (1,5 × RIC); la curtosis se reporta en exceso, de modo que cero es la normal.<br>
      <b>Definición:</b> redactada por el ${escapeHtml(report.definitionAuthor)} a partir del
      concepto estándar. No es la del publicador.<br>
      <b>Reproducibilidad:</b> el CSV y el JSON de esta misma selección se descargan desde el
      tablero, en el panel de macroeconomía.
    </div>
  </div>

  <div class="footer">
    <span>Observatorio Económico · ${escapeHtml(report.code)}</span>
    <b>Observatorio Económico</b>
    <span>${escapeHtml(issued)}</span>
  </div>
</body>
</html>`;
}

/**
 * Compone el informe y abre el diálogo de impresión sobre él.
 *
 * El `iframe` se queda en el documento mientras dura el diálogo —quitarlo antes
 * cancela la impresión en Chrome— y se retira cuando la ventana devuelve el
 * foco, que es lo más parecido a «el lector ya terminó» que expone la API.
 */
export function printAnalysis(report: AnalysisReport): void {
  if (typeof document === 'undefined') return;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('title', 'Informe para imprimir');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
  document.body.appendChild(frame);

  const remove = (): void => {
    if (frame.parentNode) frame.parentNode.removeChild(frame);
    window.removeEventListener('focus', onFocus);
  };
  const onFocus = (): void => {
    window.setTimeout(remove, 800);
  };

  frame.onload = () => {
    const view = frame.contentWindow;
    if (!view) {
      remove();
      return;
    }
    // El título del documento es lo que el diálogo propone como nombre de
    // archivo, así que el PDF sale llamándose como el indicador y no
    // «about:blank».
    view.document.title = `observatorio-${slug(report.title)}-${report.code}`;
    window.addEventListener('focus', onFocus);
    view.focus();
    view.print();
  };

  const document_ = frame.contentDocument;
  if (!document_) {
    remove();
    return;
  }
  document_.open();
  document_.write(buildDocument(report));
  document_.close();
}

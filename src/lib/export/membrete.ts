/**
 * El papel de DatosBolivia.com: membrete, orla, fondo de seguridad y marca de agua.
 *
 * Todo documento que sale del tablero para imprimirse —el informe de una pestaña,
 * el análisis de una serie, las pruebas econométricas del tipo de cambio— se
 * escribe sobre esta misma hoja, como la correspondencia de un banco central:
 *
 *   · membrete arriba: el monograma DB, el nombre, el descriptor y, a la derecha,
 *     qué documento es y cuándo se emitió, sobre un filete doble (tinta y oro);
 *   · orla de dos filetes finos en oro a 8 mm del borde, con el nombre del sitio
 *     repetido en microtexto entre los dos, como el borde de un billete;
 *   · fondo de guilloche: dos familias de ondas entrelazadas, en un oro tan
 *     rebajado que se ve como textura del papel y no estorba la lectura;
 *   · marca de agua: una roseta de guilloche con el monograma al centro, muy
 *     tenue, en cada página;
 *   · pie institucional y folio («Página 2 de 5») en cada hoja.
 *
 * La geometría se calcula aquí una sola vez y se dibuja de dos maneras: en SVG y
 * CSS para los documentos que imprime el navegador (`informe.ts`,
 * `analysis-pdf.ts`) y en operadores de PDF para el que se compone en el
 * servidor (`fx-econometrics-report.ts` sobre `pdf-sheet.ts`). Así las tres
 * salidas son la misma hoja.
 *
 * La paleta va escrita en claro, como en los demás documentos impresos: el papel
 * no hereda el tema del lector y un lector en modo oscuro imprimiría gris sobre
 * negro. Son los valores de `:root` en `globals.css`.
 */
import {
  MONO_B,
  MONO_B_X,
  MONO_D,
  MONO_GRABADO,
  MONO_VIEWBOX,
} from '@/components/brand/monogram-geometry';
import type { Sheet } from '@/lib/pdf-sheet';

/* ------------------------------------------------------------------ paleta */

export const PAPEL = {
  tinta: '#17191a',
  suave: '#4d4a44',
  tenue: '#69655d',
  filete: '#e2ddd3',
  fileteFuerte: '#b9b1a3',
  papel: '#fffefb',
  marfil: '#f7f4ed',
  /** Oro numismático: filetes, orla, monograma. Nunca texto corrido. */
  oro: '#aa884d',
  /** Oro profundo: volantas y lo que se lee en oro. */
  oroProfundo: '#806337',
} as const;

/** Un color mezclado con el papel, ya resuelto: lo mismo que una opacidad, sin transparencia. */
export function sobrePapel(color: string, alfa: number): string {
  const canal = (hex: string, at: number): number => parseInt(hex.slice(at, at + 2), 16);
  const a = color.replace('#', '');
  const b = PAPEL.papel.replace('#', '');
  return (
    '#' +
    [0, 2, 4]
      .map((at) =>
        Math.round(canal(b, at) + (canal(a, at) - canal(b, at)) * alfa)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/* ------------------------------------------------------------------ datos */

export interface DatosMembrete {
  /** Qué documento es: «Informe de pestaña», «Análisis de serie», «Pruebas econométricas». */
  documento: string;
  /** La fecha de emisión, en letra. */
  fecha: string;
  /** Una línea más bajo la fecha: el código de la serie, el último dato. */
  referencia?: string | undefined;
}

export const NOMBRE = 'DatosBolivia.com';
export const DESCRIPTOR = 'Centro de Datos de Bolivia';
const MICROTEXTO = 'DATOSBOLIVIA.COM · CENTRO DE DATOS DE BOLIVIA · ';

/* -------------------------------------------------------------- medidas */

const MM = 72 / 25.4;

/** Medidas de la hoja A4, en milímetros, compartidas por las dos salidas. */
export const HOJA = {
  ancho: 210,
  alto: 297,
  /** De la orilla del papel al filete exterior de la orla. */
  orla: 8,
  /** Entre el filete exterior y el interior: ahí corre el microtexto. */
  franja: 2.3,
  /** Del filete interior al texto, a los lados. */
  lado: 13,
  /** Del filete interior al texto, arriba y abajo de cada página. */
  arriba: 10,
  abajo: 15,
} as const;

/* ------------------------------------------------------------- geometría */

type Punto = readonly [number, number];

/**
 * La tesela del fondo: dos familias de ondas en contrafase, apiladas a un paso
 * menor que su amplitud para que se crucen y formen la malla de lentejas de un
 * papel de seguridad. Se dibuja con desplazamientos de un paso arriba y abajo
 * para que la tesela empalme sin costura al repetirse.
 */
export const TESELA = { ancho: 30, alto: 3.4, amplitud: 2.5 } as const;

export function ondasDeTesela(): Punto[][] {
  const { ancho, alto, amplitud } = TESELA;
  const curvas: Punto[][] = [];
  for (const fase of [0, Math.PI]) {
    for (const desplazamiento of [-alto, 0, alto]) {
      const puntos: Punto[] = [];
      for (let i = 0; i <= 30; i += 1) {
        const x = (ancho * i) / 30;
        const y =
          alto / 2 + desplazamiento + (amplitud / 2) * Math.sin((2 * Math.PI * x) / ancho + fase);
        puntos.push([x, y]);
      }
      curvas.push(puntos);
    }
  }
  return curvas;
}

/**
 * La roseta de la marca de agua: anillos de radio ondulado, girados entre sí,
 * como el medallón de un billete. Centrada en el origen; `radio` es el exterior.
 */
export function anillosDeRoseta(radio: number): Punto[][] {
  const anillos: Punto[][] = [];
  const familias = [
    { base: 0.86, onda: 0.1, lobulos: 18, copias: 6 },
    { base: 0.6, onda: 0.07, lobulos: 12, copias: 4 },
  ];
  for (const familia of familias) {
    for (let copia = 0; copia < familia.copias; copia += 1) {
      const fase = (2 * Math.PI * copia) / (familia.copias * familia.lobulos);
      const puntos: Punto[] = [];
      for (let i = 0; i <= 540; i += 1) {
        const t = (2 * Math.PI * i) / 540;
        const r = radio * (familia.base + familia.onda * Math.sin(familia.lobulos * (t + fase)));
        puntos.push([r * Math.cos(t), r * Math.sin(t)]);
      }
      anillos.push(puntos);
    }
  }
  return anillos;
}

const n = (valor: number): string => {
  const redondeado = Math.round(valor * 100) / 100;
  return Object.is(redondeado, -0) ? '0' : String(redondeado);
};

const trazo = (puntos: readonly Punto[]): string =>
  puntos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${n(x)} ${n(y)}`).join('');

/* ------------------------------------------------------------- en HTML */

const escapar = (texto: string): string =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** El monograma en SVG, con el grabado de oro dentro de la D. */
export function monogramaSvg(clase: string, conGrabado = true, id = 'mb'): string {
  return (
    `<svg class="${clase}" viewBox="${MONO_VIEWBOX}" aria-hidden="true">` +
    (conGrabado ? `<defs><clipPath id="${id}-d"><path d="${MONO_D}"/></clipPath></defs>` : '') +
    `<path d="${MONO_B}" transform="translate(${MONO_B_X} 0)" fill="${PAPEL.oro}"/>` +
    `<path d="${MONO_D}" fill="${PAPEL.tinta}" stroke="${PAPEL.papel}" stroke-width="56" paint-order="stroke"/>` +
    (conGrabado
      ? `<g clip-path="url(#${id}-d)"><path d="${MONO_GRABADO}" fill="none" stroke="${PAPEL.oro}" stroke-width="15" stroke-linecap="round" opacity="0.9"/></g>`
      : '') +
    '</svg>'
  );
}

function teselaSvg(): string {
  const { ancho, alto } = TESELA;
  const color = sobrePapel(PAPEL.oro, 0.3);
  const caminos = ondasDeTesela()
    .map((curva) => `<path d="${trazo(curva)}"/>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">` +
    `<g fill="none" stroke="${color}" stroke-width="0.24">${caminos}</g></svg>`
  );
}

function marcaDeAguaSvg(): string {
  const radio = 100;
  const anillos = anillosDeRoseta(radio)
    .map((anillo) => `<path d="${trazo(anillo)}Z"/>`)
    .join('');
  // El monograma mide 2743 × 1440 en su caja; aquí, 56 mm de los 128 de la roseta.
  const anchoMono = (radio * 2 * 56) / 128;
  const escala = anchoMono / 2743;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-radio} ${-radio} ${radio * 2} ${radio * 2}">` +
    `<g fill="none" stroke="${PAPEL.oro}" stroke-width="0.35" opacity="0.15">${anillos}</g>` +
    `<circle r="${radio * 0.5}" fill="none" stroke="${PAPEL.oro}" stroke-width="0.5" opacity="0.15"/>` +
    `<circle r="${radio * 0.47}" fill="none" stroke="${PAPEL.oro}" stroke-width="0.25" opacity="0.15"/>` +
    `<g opacity="0.055" transform="translate(${-anchoMono / 2 + 30 * escala} ${-(1440 * escala) / 2 + 1400 * escala}) scale(${escala})">` +
    `<path d="${MONO_B}" transform="translate(${MONO_B_X} 0)" fill="${PAPEL.oroProfundo}"/>` +
    `<path d="${MONO_D}" fill="${PAPEL.tinta}"/></g>` +
    '</svg>'
  );
}

const svgEnUrl = (svg: string): string =>
  `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

/**
 * La hoja de estilo del papel. Usa las familias `ObsSerif` (Gelasio) y `ObsSans`
 * (Libre Franklin) que declara `hojaDeFuentes()`; sin ellas cae a Georgia y al
 * sans del sistema, que es la misma voz.
 */
export function cssPapel(): string {
  const { orla, franja, lado, arriba, abajo } = HOJA;
  return `
  @page {
    size: A4;
    margin: ${orla}mm;
    background: ${PAPEL.papel};
    @bottom-center {
      content: "Página " counter(page) " de " counter(pages);
      font-family: 'ObsSans', 'Libre Franklin', system-ui, sans-serif;
      font-size: 6.5pt;
      letter-spacing: 0.06em;
      color: ${PAPEL.tenue};
      vertical-align: middle;
    }
  }
  html, body {
    margin: 0;
    padding: 0;
    background: ${PAPEL.papel};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .papel-orla {
    position: fixed;
    inset: 0;
    border: 0.9pt solid ${PAPEL.oro};
    z-index: 0;
    pointer-events: none;
  }
  .papel-orla::after {
    content: '';
    position: absolute;
    inset: ${franja}mm;
    border: 0.35pt solid ${PAPEL.oro};
  }
  .papel-fondo {
    position: fixed;
    inset: ${franja + 0.6}mm;
    background-image: ${svgEnUrl(teselaSvg())};
    background-size: ${TESELA.ancho}pt ${TESELA.alto}pt;
    z-index: 0;
    pointer-events: none;
  }
  .papel-micro {
    position: fixed;
    overflow: hidden;
    white-space: nowrap;
    font-family: 'ObsSans', 'Libre Franklin', system-ui, sans-serif;
    font-size: 3.6pt;
    line-height: ${franja}mm;
    letter-spacing: 0.1em;
    color: ${PAPEL.oroProfundo};
    z-index: 0;
    pointer-events: none;
  }
  .papel-micro.arriba, .papel-micro.abajo { left: ${franja}mm; right: ${franja}mm; height: ${franja}mm; }
  .papel-micro.arriba { top: 0; }
  .papel-micro.abajo { bottom: 0; }
  .papel-micro.izq, .papel-micro.der {
    top: ${franja}mm; bottom: ${franja}mm; width: ${franja}mm;
    writing-mode: vertical-rl;
  }
  .papel-micro.izq { left: 0; transform: rotate(180deg); }
  .papel-micro.der { right: 0; }
  /* Como imagen de fondo y no como SVG en línea: Chrome repite en cada hoja
     el fondo de un elemento fijo, pero no siempre su contenido. */
  .papel-agua {
    position: fixed;
    inset: 0;
    background: ${svgEnUrl(marcaDeAguaSvg())} no-repeat center / 128mm 128mm;
    z-index: 0;
    pointer-events: none;
  }
  .papel-pie {
    position: fixed;
    left: ${franja + lado}mm;
    right: ${franja + lado}mm;
    bottom: ${franja + 4}mm;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8pt;
    padding-top: 3pt;
    border-top: 0.5pt solid ${PAPEL.oro};
    font-family: 'ObsSans', 'Libre Franklin', system-ui, sans-serif;
    font-size: 7pt;
    color: ${PAPEL.tenue};
    z-index: 1;
  }
  .papel-pie b {
    font-family: 'ObsSerif', Georgia, serif;
    font-weight: 700;
    font-size: 8pt;
    color: ${PAPEL.tinta};
  }
  .papel-pie b i { font-style: normal; color: ${PAPEL.oro}; }
  table.papel-hojas {
    position: relative;
    z-index: 1;
    width: 100%;
    border-collapse: collapse;
    border: 0;
    margin: 0;
  }
  table.papel-hojas > thead > tr > td,
  table.papel-hojas > tfoot > tr > td,
  table.papel-hojas > tbody > tr > td {
    padding: 0 ${franja + lado}mm;
    border: 0;
    background: none;
  }
  .papel-hueco-arriba { height: ${franja + arriba}mm; }
  .papel-hueco-abajo { height: ${franja + abajo}mm; }

  .membrete {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 14pt;
    padding-bottom: 7pt;
  }
  .membrete-marca { display: flex; align-items: center; gap: 9pt; }
  .membrete-mono { width: 46pt; height: auto; display: block; }
  .membrete-nombre {
    font-family: 'ObsSerif', Georgia, serif;
    font-size: 17pt;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1;
    color: ${PAPEL.tinta};
  }
  .membrete-nombre i { font-style: normal; color: ${PAPEL.oro}; }
  .membrete-desc {
    margin-top: 4pt;
    font-family: 'ObsSans', 'Libre Franklin', system-ui, sans-serif;
    font-size: 6.3pt;
    font-weight: 600;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: ${PAPEL.suave};
  }
  .membrete-doc {
    text-align: right;
    font-family: 'ObsSans', 'Libre Franklin', system-ui, sans-serif;
    font-size: 7.5pt;
    line-height: 1.5;
    color: ${PAPEL.suave};
  }
  .membrete-tipo {
    font-size: 6.5pt;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${PAPEL.oroProfundo};
  }
  .membrete-filete {
    height: 3.4pt;
    border-top: 1.6pt solid ${PAPEL.tinta};
    border-bottom: 0.5pt solid ${PAPEL.oro};
    margin-bottom: 14pt;
  }
  `;
}

/** El membrete: va al principio del documento, una sola vez. */
export function membreteHtml(datos: DatosMembrete): string {
  return (
    '<header class="membrete"><div class="membrete-marca">' +
    monogramaSvg('membrete-mono') +
    `<div><div class="membrete-nombre">DatosBolivia<i>.</i>com</div><div class="membrete-desc">${escapar(DESCRIPTOR)}</div></div></div>` +
    `<div class="membrete-doc"><div class="membrete-tipo">${escapar(datos.documento)}</div>` +
    `<div>Emitido el ${escapar(datos.fecha)}</div>` +
    (datos.referencia ? `<div>${escapar(datos.referencia)}</div>` : '') +
    '</div></header><div class="membrete-filete"></div>'
  );
}

/**
 * El cuerpo entero de un documento sobre el papel: orla, fondo, microtexto,
 * marca de agua y pie, que se repiten en cada hoja por ir fijos, y el contenido
 * dentro de una tabla cuyos `thead` y `tfoot` vacíos el navegador repite en cada
 * página: es lo que da a cada hoja su margen propio dentro de la orla.
 */
export function papelHtml(datos: DatosMembrete, contenido: string, pie?: string): string {
  const micro = escapar(MICROTEXTO.repeat(40));
  return (
    '<div class="papel-fondo"></div>' +
    '<div class="papel-agua" aria-hidden="true"></div>' +
    '<div class="papel-orla"></div>' +
    ['arriba', 'abajo', 'izq', 'der']
      .map((lado) => `<div class="papel-micro ${lado}" aria-hidden="true">${micro}</div>`)
      .join('') +
    `<div class="papel-pie"><b>DatosBolivia<i>.</i>com</b><span>${escapar(pie ?? datos.documento)}</span><span>${escapar(datos.fecha)}</span></div>` +
    '<table class="papel-hojas" role="presentation">' +
    '<thead><tr><td><div class="papel-hueco-arriba"></div></td></tr></thead>' +
    '<tfoot><tr><td><div class="papel-hueco-abajo"></div></td></tr></tfoot>' +
    `<tbody><tr><td>${membreteHtml(datos)}${contenido}</td></tr></tbody></table>`
  );
}

/* -------------------------------------------------------------- en PDF */

/*
 * En PDF las coordenadas van en puntos con el origen abajo a la izquierda. El
 * fondo y la roseta se guardan una sola vez —una tesela y un formulario— y cada
 * página los referencia: el documento pesa lo mismo con una hoja que con veinte.
 */

const rgb = (hex: string): string => {
  const v = hex.replace('#', '');
  const c = (at: number): string => (parseInt(v.slice(at, at + 2), 16) / 255).toFixed(3);
  return `${c(0)} ${c(2)} ${c(4)}`;
};
const p = (valor: number): string => valor.toFixed(2);

function polilinea(puntos: readonly Punto[], cerrar = false): string {
  return (
    puntos.map(([x, y], i) => `${p(x)} ${p(y)} ${i === 0 ? 'm' : 'l'}`).join(' ') +
    (cerrar ? ' h' : '')
  );
}

/**
 * Un trazado SVG (absoluto o relativo: M, L, H, V, Q, C, Z) en operadores de
 * PDF, pasando cada punto por `a`. Las cuadráticas de la fuente se elevan a
 * cúbicas, que es lo único que PDF sabe dibujar.
 */
export function trazadoPdf(d: string, a: (x: number, y: number) => Punto): string {
  const fichas = d.match(/[MLHVQCZmlhvqcz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const ops: string[] = [];
  let i = 0;
  let orden = 'M';
  let x = 0;
  let y = 0;
  let inicioX = 0;
  let inicioY = 0;
  const num = (): number => Number(fichas[i++]);
  const punto = (px: number, py: number): string => {
    const [tx, ty] = a(px, py);
    return `${p(tx)} ${p(ty)}`;
  };
  while (i < fichas.length) {
    const ficha = fichas[i] ?? '';
    if (/[A-Za-z]/.test(ficha)) {
      orden = ficha;
      i += 1;
      if (orden === 'Z' || orden === 'z') {
        ops.push('h');
        x = inicioX;
        y = inicioY;
        continue;
      }
    }
    const relativo = orden === orden.toLowerCase();
    const ox = relativo ? x : 0;
    const oy = relativo ? y : 0;
    switch (orden.toUpperCase()) {
      case 'M': {
        x = ox + num();
        y = oy + num();
        inicioX = x;
        inicioY = y;
        ops.push(`${punto(x, y)} m`);
        // Pares que siguen a un M sin letra son L implícitos.
        orden = relativo ? 'l' : 'L';
        break;
      }
      case 'L':
        x = ox + num();
        y = oy + num();
        ops.push(`${punto(x, y)} l`);
        break;
      case 'H':
        x = (relativo ? x : 0) + num();
        ops.push(`${punto(x, y)} l`);
        break;
      case 'V':
        y = (relativo ? y : 0) + num();
        ops.push(`${punto(x, y)} l`);
        break;
      case 'Q': {
        const qx = ox + num();
        const qy = oy + num();
        const ex = ox + num();
        const ey = oy + num();
        const c1x = x + (2 / 3) * (qx - x);
        const c1y = y + (2 / 3) * (qy - y);
        const c2x = ex + (2 / 3) * (qx - ex);
        const c2y = ey + (2 / 3) * (qy - ey);
        ops.push(`${punto(c1x, c1y)} ${punto(c2x, c2y)} ${punto(ex, ey)} c`);
        x = ex;
        y = ey;
        break;
      }
      case 'C': {
        const c1x = ox + num();
        const c1y = oy + num();
        const c2x = ox + num();
        const c2y = oy + num();
        const ex = ox + num();
        const ey = oy + num();
        ops.push(`${punto(c1x, c1y)} ${punto(c2x, c2y)} ${punto(ex, ey)} c`);
        x = ex;
        y = ey;
        break;
      }
      default:
        i += 1;
    }
  }
  return ops.join(' ');
}

/**
 * El monograma en operadores de PDF, con su esquina inferior izquierda en
 * (x, y) y `ancho` puntos de ancho. `relleno` permite dibujarlo de un solo color
 * (la marca de agua); sin él, D en tinta con grabado de oro y B en oro.
 */
export function monogramaPdf(
  x: number,
  y: number,
  ancho: number,
  relleno?: { d: string; b: string },
): string {
  const k = ancho / 2743;
  const a =
    (dx: number) =>
    (sx: number, sy: number): Punto => [x + (sx + dx + 30) * k, y + (40 - sy) * k];
  const d = trazadoPdf(MONO_D, a(0));
  const b = trazadoPdf(MONO_B, a(MONO_B_X));
  const ops = [`q ${rgb(relleno?.b ?? PAPEL.oro)} rg ${b} f Q`];
  if (relleno) {
    ops.push(`q ${rgb(relleno.d)} rg ${d} f Q`);
  } else {
    // El contorno de papel separa la D de la B, como en pantalla.
    ops.push(`q ${rgb(PAPEL.papel)} RG ${p(56 * k)} w 1 j ${d} S Q`);
    ops.push(`q ${rgb(PAPEL.tinta)} rg ${d} f Q`);
    const grabado = trazadoPdf(MONO_GRABADO, a(0));
    ops.push(`q ${d} W n ${rgb(PAPEL.oro)} RG ${p(15 * k)} w 1 J ${grabado} S Q`);
  }
  return ops.join('\n');
}

/** Registra la tesela y la roseta en la hoja. Se llama una vez, antes de dibujar. */
export function prepararPapelPdf(hoja: Sheet): void {
  const { ancho, alto } = TESELA;
  const ondas = ondasDeTesela()
    .map((curva) => `${polilinea(curva)} S`)
    .join('\n');
  hoja.defineTiling('Guil', {
    width: ancho,
    height: alto,
    ops: `${rgb(sobrePapel(PAPEL.oro, 0.3))} RG 0.24 w ${ondas}`,
  });

  const radio = 64 * MM;
  const anillos = anillosDeRoseta(radio)
    .map(
      (anillo) =>
        `${polilinea(
          anillo.map(([ax, ay]) => [ax + radio, ay + radio]),
          true,
        )} S`,
    )
    .join('\n');
  const circulo = (r: number): string => {
    // Un círculo con cuatro cúbicas.
    const c = 0.5523 * r;
    const m = radio;
    return (
      `${p(m + r)} ${p(m)} m ${p(m + r)} ${p(m + c)} ${p(m + c)} ${p(m + r)} ${p(m)} ${p(m + r)} c ` +
      `${p(m - c)} ${p(m + r)} ${p(m - r)} ${p(m + c)} ${p(m - r)} ${p(m)} c ` +
      `${p(m - r)} ${p(m - c)} ${p(m - c)} ${p(m - r)} ${p(m)} ${p(m - r)} c ` +
      `${p(m + c)} ${p(m - r)} ${p(m + r)} ${p(m - c)} ${p(m + r)} ${p(m)} c S`
    );
  };
  hoja.defineForm('Roseta', {
    width: radio * 2,
    height: radio * 2,
    ops:
      `${rgb(sobrePapel(PAPEL.oro, 0.16))} RG 0.35 w ${anillos}\n` +
      `${rgb(sobrePapel(PAPEL.oro, 0.15))} RG 0.5 w ${circulo(radio * 0.5)}\n0.25 w ${circulo(radio * 0.47)}\n` +
      monogramaPdf(radio - 56 * MM * 0.5, radio - (1440 / 2743) * 56 * MM * 0.5, 56 * MM, {
        d: sobrePapel(PAPEL.tinta, 0.055),
        b: sobrePapel(PAPEL.oroProfundo, 0.055),
      }),
  });
}

/** Lo que va DEBAJO del texto en cada página: fondo y marca de agua. */
export function fondoPdf(hoja: Sheet): void {
  const { orla, franja } = HOJA;
  const borde = (orla + franja + 0.6) * MM;
  const radio = 64 * MM;
  hoja.raw(
    [
      `q ${rgb(PAPEL.papel)} rg 0 0 ${p(hoja.width)} ${p(hoja.height)} re f Q`,
      `q /Pattern cs /Guil scn ${p(borde)} ${p(borde)} ${p(hoja.width - borde * 2)} ${p(hoja.height - borde * 2)} re f Q`,
      `q 1 0 0 1 ${p(hoja.width / 2 - radio)} ${p(hoja.height / 2 - radio)} cm /Roseta Do Q`,
    ].join('\n'),
  );
}

/** Lo que va ENCIMA en cada página: orla, microtexto, pie y folio. */
export function orlaPdf(
  hoja: Sheet,
  datos: DatosMembrete,
  pagina: number,
  paginas: number,
  pie?: string,
): void {
  const { orla, franja, lado } = HOJA;
  const o = orla * MM;
  const f = franja * MM;
  const w = hoja.width;
  const h = hoja.height;
  hoja.raw(
    `q ${rgb(PAPEL.oro)} RG 0.9 w ${p(o)} ${p(o)} ${p(w - o * 2)} ${p(h - o * 2)} re S ` +
      `0.35 w ${p(o + f)} ${p(o + f)} ${p(w - (o + f) * 2)} ${p(h - (o + f) * 2)} re S Q`,
  );

  // El microtexto, centrado en la franja entre los dos filetes.
  const estilo = { font: 'sans' as const, size: 3.6, color: PAPEL.oroProfundo, tracking: 0.36 };
  const largoH = w - (o + f) * 2;
  const largoV = h - (o + f) * 2;
  const linea = (largo: number): string => {
    let texto = '';
    while (hoja.measureText(texto + MICROTEXTO, estilo) < largo) texto += MICROTEXTO;
    // Se completa letra a letra hasta el filete, sin pasarse.
    for (const letra of MICROTEXTO) {
      if (hoja.measureText(texto + letra, estilo) > largo) break;
      texto += letra;
    }
    return texto;
  };
  const enFranja = o + f / 2 - estilo.size * 0.36;
  hoja.text(linea(largoH), o + f, h - o - f / 2 - estilo.size * 0.36, estilo);
  hoja.text(linea(largoH), o + f, enFranja, estilo);
  hoja.text(linea(largoV), o + f / 2 + estilo.size * 0.36, o + f, estilo, { rotate: 90 });
  hoja.text(linea(largoV), w - o - f / 2 - estilo.size * 0.36, h - o - f, estilo, { rotate: -90 });

  // Pie institucional dentro de la orla, y el folio debajo, en el margen.
  const izq = o + f + lado * MM;
  const der = w - izq;
  const base = o + f + 4 * MM;
  hoja.line(izq, base + 9, der, base + 9, PAPEL.oro, 0.5);
  hoja.text('DatosBolivia', izq, base, { font: 'serif-bold', size: 8, color: PAPEL.tinta });
  const ancho = hoja.measureText('DatosBolivia', { font: 'serif-bold', size: 8 });
  hoja.text('.', izq + ancho, base, { font: 'serif-bold', size: 8, color: PAPEL.oro });
  hoja.text('com', izq + ancho + hoja.measureText('.', { font: 'serif-bold', size: 8 }), base, {
    font: 'serif-bold',
    size: 8,
    color: PAPEL.tinta,
  });
  const nota = { font: 'sans' as const, size: 7, color: PAPEL.tenue };
  hoja.text(pie ?? datos.documento, w / 2, base, { ...nota, align: 'center' });
  hoja.text(datos.fecha, der, base, { ...nota, align: 'right' });
  hoja.text(`Página ${pagina} de ${paginas}`, w / 2, o / 2 - 2.3, {
    font: 'sans',
    size: 6.5,
    color: PAPEL.tenue,
    tracking: 0.4,
    align: 'center',
  });
}

/** El membrete en la primera página, a partir del cursor de la hoja. */
export function membretePdf(hoja: Sheet, datos: DatosMembrete): void {
  const arriba = hoja.y;
  const anchoMono = 46;
  const altoMono = (1440 / 2743) * anchoMono;
  const baseMono = arriba - 2 - altoMono;
  hoja.raw(monogramaPdf(hoja.left, baseMono, anchoMono));

  const x = hoja.left + anchoMono + 9;
  const nombre = { font: 'serif-bold' as const, size: 17, color: PAPEL.tinta, tracking: -0.3 };
  const yNombre = baseMono + altoMono - 14;
  hoja.text('DatosBolivia', x, yNombre, nombre);
  const a1 = hoja.measureText('DatosBolivia', nombre);
  hoja.text('.', x + a1, yNombre, { ...nombre, color: PAPEL.oro });
  hoja.text('com', x + a1 + hoja.measureText('.', nombre), yNombre, nombre);
  hoja.text(DESCRIPTOR.toUpperCase(), x, yNombre - 11.5, {
    font: 'sans-bold',
    size: 6.3,
    color: PAPEL.suave,
    tracking: 1.5,
  });

  const lineas = [`Emitido el ${datos.fecha}`, ...(datos.referencia ? [datos.referencia] : [])];
  let yDoc = baseMono + 1 + lineas.length * 10.5;
  hoja.text(datos.documento.toUpperCase(), hoja.right, yDoc, {
    font: 'sans-bold',
    size: 6.5,
    color: PAPEL.oroProfundo,
    tracking: 1.15,
    align: 'right',
  });
  for (const linea of lineas) {
    yDoc -= 10.5;
    hoja.text(linea, hoja.right, yDoc, {
      font: 'sans',
      size: 7.5,
      color: PAPEL.suave,
      align: 'right',
    });
  }

  hoja.space(arriba - baseMono + 7);
  hoja.line(hoja.left, hoja.y, hoja.right, hoja.y, PAPEL.tinta, 1.6);
  hoja.line(hoja.left, hoja.y - 3.2, hoja.right, hoja.y - 3.2, PAPEL.oro, 0.5);
  hoja.space(3.2 + 16);
}

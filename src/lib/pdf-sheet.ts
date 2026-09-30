/**
 * Una hoja A4 que se escribe en el servidor y sale como PDF.
 *
 * El informe del análisis macro (`analysis-pdf.ts`) no necesita esto: se arma
 * en HTML y lo imprime el navegador del lector, que es el que sabe hacer un PDF
 * y ya tiene las figuras dibujadas. Un informe que se descarga de una ruta no
 * tiene navegador delante —lo que hay es un proceso de Node que devuelve
 * bytes—, y en el repositorio no hay librería de PDF ni motivo para sumar
 * medio megabyte por una descarga. Esto es el mínimo del formato que hace
 * falta para texto y tablas: las catorce fuentes que todo lector de PDF trae
 * consigo, un flujo de contenido por página comprimido con el `zlib` de Node,
 * y una tabla de referencias cruzadas al final.
 *
 * Lo que sí se conserva de `analysis-pdf.ts` es la voz: la misma paleta fijada
 * en claro, la misma jerarquía —cabecera con marca, volanta, título con serifa,
 * entradilla con barra, secciones con filete, tablas con cabecera en
 * versalitas y filas alternas— y la marca de agua y el pie en cada página.
 *
 * Dos detalles del formato que no son adorno. Los textos van en WinAnsi, que
 * cubre el castellano entero pero no el alfabeto griego ni el signo menos
 * tipográfico, así que cada línea se parte en tramos y los caracteres que la
 * fuente de texto no tiene se escriben con la fuente Symbol, que sí los trae:
 * «ρ = 0,89» sale como se lee y no como «? = 0,89». Y el ancho de cada
 * carácter está tabulado aquí porque no hay quien lo mida: sin la tabla no hay
 * ajuste de línea, y sin ajuste no hay párrafo.
 */

import { deflateSync } from 'node:zlib';

/* ------------------------------------------------------------------ paleta */

/**
 * La paleta del tablero en su versión clara, la misma que `analysis-pdf.ts`
 * escribe en claro por la misma razón: el papel no hereda el tema del lector.
 */
export const INK = {
  ink: '#14181f',
  soft: '#4a5464',
  faint: '#78839a',
  rule: '#e2e6ed',
  tint: '#f6f8fa',
  paper: '#ffffff',
  official: '#2a78d6',
  parallel: '#eb6834',
} as const;

/* ----------------------------------------------------------------- fuentes */

export type FontName = 'serif' | 'serif-bold' | 'sans' | 'sans-bold' | 'mono';

/** El recurso de cada fuente en el PDF y el nombre estándar que lo respalda. */
const FONTS: Record<FontName | 'symbol', { resource: string; base: string }> = {
  serif: { resource: 'F1', base: 'Times-Roman' },
  'serif-bold': { resource: 'F2', base: 'Times-Bold' },
  sans: { resource: 'F3', base: 'Helvetica' },
  'sans-bold': { resource: 'F4', base: 'Helvetica-Bold' },
  mono: { resource: 'F5', base: 'Courier' },
  symbol: { resource: 'F6', base: 'Symbol' },
};

/**
 * Anchos de los caracteres imprimibles ASCII (32–126) en milésimas de cuerpo,
 * tomados de las métricas AFM de las fuentes estándar. Una letra acentuada mide
 * lo mismo que su base en estas familias, así que el resto de WinAnsi se
 * resuelve quitando el acento y mirando aquí, salvo la lista de `EXTRA`.
 */
const ASCII_WIDTHS: Record<FontName, readonly number[]> = {
  sans: parseWidths(
    '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584',
  ),
  'sans-bold': parseWidths(
    '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584',
  ),
  serif: parseWidths(
    '250 333 408 500 500 833 778 180 333 333 500 564 250 333 250 278 500 500 500 500 500 500 500 500 500 500 278 278 564 564 564 444 921 722 667 667 722 611 556 722 722 333 389 722 611 889 722 722 556 722 667 556 611 722 722 944 722 722 611 333 278 333 469 500 333 444 500 444 500 444 333 500 500 278 278 500 278 778 500 500 500 500 333 389 278 500 500 722 500 500 444 480 200 480 541',
  ),
  'serif-bold': parseWidths(
    '250 333 555 500 500 1000 833 278 333 333 500 570 250 333 250 278 500 500 500 500 500 500 500 500 500 500 333 333 570 570 570 500 930 722 667 722 722 667 611 778 778 389 500 778 667 944 722 778 611 778 722 556 667 722 722 1000 722 722 667 333 278 333 581 500 333 500 556 444 556 444 333 500 556 278 333 556 278 833 556 500 556 556 444 389 333 556 500 722 500 500 444 394 220 394 520',
  ),
  mono: Array.from({ length: 95 }, () => 600),
};

function parseWidths(list: string): number[] {
  return list.split(' ').map(Number);
}

/** Caracteres de WinAnsi que no se resuelven quitando un acento: [sans, sans-bold, serif, serif-bold]. */
const EXTRA: Record<string, readonly [number, number, number, number]> = {
  '«': [556, 556, 500, 500],
  '»': [556, 556, 500, 500],
  '·': [278, 278, 250, 250],
  '°': [400, 400, 400, 400],
  '±': [584, 584, 564, 570],
  '×': [584, 584, 564, 570],
  '–': [556, 556, 500, 500],
  '—': [1000, 1000, 1000, 1000],
  '…': [1000, 1000, 1000, 1000],
  '•': [350, 350, 350, 350],
  '‘': [222, 278, 333, 333],
  '’': [222, 278, 333, 333],
  '“': [333, 500, 444, 500],
  '”': [333, 500, 444, 500],
  '€': [556, 556, 500, 500],
  '²': [333, 333, 300, 300],
  '³': [333, 333, 300, 300],
  '¹': [333, 333, 300, 300],
  ª: [370, 370, 276, 300],
  º: [365, 365, 310, 330],
  '¼': [834, 834, 750, 750],
  '½': [834, 834, 750, 750],
  '¾': [834, 834, 750, 750],
  '§': [556, 556, 500, 500],
  '¶': [537, 556, 453, 540],
  '©': [737, 737, 760, 747],
  '®': [737, 737, 760, 747],
  '™': [1000, 1000, 980, 1000],
  µ: [556, 611, 500, 556],
  '¬': [584, 584, 564, 570],
  '¦': [260, 280, 200, 220],
  '¢': [556, 556, 500, 500],
  '£': [556, 556, 500, 500],
  '¥': [556, 556, 500, 500],
  ß: [611, 611, 500, 556],
  æ: [889, 889, 667, 722],
  ø: [611, 611, 500, 500],
  Æ: [1000, 1000, 889, 1000],
  Ø: [778, 778, 722, 778],
  '¡': [333, 333, 333, 333],
  '¿': [611, 611, 444, 500],
  '\u00a0': [278, 278, 250, 250],
};

const EXTRA_INDEX: Record<FontName, number> = {
  sans: 0,
  'sans-bold': 1,
  serif: 2,
  'serif-bold': 3,
  mono: 0,
};

/** La parte alta de WinAnsi que no coincide con Latin-1. */
const WIN_ANSI_HIGH: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};

/** Lo que la fuente Symbol sabe escribir y el byte con que se le pide. */
const SYMBOL: Record<string, number> = {
  α: 0x61,
  β: 0x62,
  χ: 0x63,
  δ: 0x64,
  ε: 0x65,
  φ: 0x66,
  γ: 0x67,
  η: 0x68,
  ι: 0x69,
  κ: 0x6b,
  λ: 0x6c,
  μ: 0x6d,
  ν: 0x6e,
  ο: 0x6f,
  π: 0x70,
  θ: 0x71,
  ρ: 0x72,
  σ: 0x73,
  τ: 0x74,
  υ: 0x75,
  ω: 0x77,
  ξ: 0x78,
  ψ: 0x79,
  ζ: 0x7a,
  Δ: 0x44,
  Φ: 0x46,
  Γ: 0x47,
  Λ: 0x4c,
  Π: 0x50,
  Θ: 0x51,
  Σ: 0x53,
  Ω: 0x57,
  Ξ: 0x58,
  Ψ: 0x59,
  '−': 0x2d,
  '≈': 0xbb,
  '≤': 0xa3,
  '≥': 0xb3,
  '≠': 0xb9,
  '→': 0xae,
  '←': 0xac,
  '↔': 0xab,
  '∞': 0xa5,
  '√': 0xd6,
  '∑': 0xe5,
  '′': 0xa2,
  '∈': 0xce,
  '∂': 0xb6,
};

/** Anchos de Symbol para lo que se usa; el resto se toma por 549, que es la mediana. */
const SYMBOL_WIDTHS: Record<string, number> = {
  α: 631,
  γ: 411,
  δ: 494,
  ε: 439,
  ζ: 494,
  η: 603,
  θ: 521,
  ι: 329,
  μ: 576,
  ν: 521,
  ξ: 493,
  σ: 603,
  τ: 439,
  υ: 576,
  φ: 521,
  ψ: 686,
  ω: 686,
  Δ: 612,
  Σ: 713,
  Ω: 768,
  Λ: 686,
  Θ: 741,
  Π: 768,
  Φ: 763,
  Ψ: 795,
  Γ: 603,
  Ξ: 645,
  '→': 987,
  '←': 987,
  '↔': 1042,
  '∞': 713,
  '∑': 713,
  '′': 247,
  '∈': 713,
};

const stripAccent = (character: string): string => character.normalize('NFD').replace(/[̀-ͯ]/g, '');

function winAnsi(character: string): number | null {
  const code = character.codePointAt(0) ?? 0;
  if (code >= 0x20 && code <= 0x7e) return code;
  if (code >= 0xa0 && code <= 0xff) return code;
  return WIN_ANSI_HIGH[character] ?? null;
}

function widthOfCharacter(character: string, font: FontName): number {
  const code = character.codePointAt(0) ?? 0;
  if (code >= 0x20 && code <= 0x7e) return ASCII_WIDTHS[font][code - 0x20] ?? 500;
  if (font === 'mono') return 600;
  const extra = EXTRA[character];
  if (extra) return extra[EXTRA_INDEX[font]] ?? 500;
  const base = stripAccent(character);
  const baseCode = base.codePointAt(0) ?? 0;
  if (base.length === 1 && baseCode >= 0x20 && baseCode <= 0x7e) {
    return ASCII_WIDTHS[font][baseCode - 0x20] ?? 500;
  }
  return 500;
}

interface Run {
  resource: string;
  bytes: number[];
  width: number;
}

/**
 * Una línea partida en tramos por fuente: lo que WinAnsi cubre va en la fuente
 * pedida y lo que no, en Symbol; lo que ninguna tiene sale como «?» antes que
 * como un hueco que nadie nota.
 */
function runsOf(text: string, font: FontName, size: number, tracking: number): Run[] {
  const runs: Run[] = [];
  const push = (resource: string, byte: number, width: number): void => {
    const last = runs.at(-1);
    if (last && last.resource === resource) {
      last.bytes.push(byte);
      last.width += width;
    } else {
      runs.push({ resource, bytes: [byte], width });
    }
  };
  for (const character of text) {
    const code = winAnsi(character);
    if (code !== null) {
      push(
        FONTS[font].resource,
        code,
        (widthOfCharacter(character, font) / 1000) * size + tracking,
      );
      continue;
    }
    const symbol = SYMBOL[character];
    if (symbol !== undefined) {
      push(
        FONTS.symbol.resource,
        symbol,
        ((SYMBOL_WIDTHS[character] ?? 549) / 1000) * size + tracking,
      );
      continue;
    }
    push(FONTS[font].resource, 0x3f, (widthOfCharacter('?', font) / 1000) * size + tracking);
  }
  return runs;
}

/* ------------------------------------------------------------------ texto */

export interface TextStyle {
  font: FontName;
  size: number;
  color?: string;
  /** Espacio entre caracteres en puntos, para versalitas espaciadas. */
  tracking?: number;
  /** Interlineado en puntos; por defecto, 1,45 cuerpos. */
  leading?: number;
  align?: 'left' | 'right' | 'center';
}

const toHex = (bytes: readonly number[]): string =>
  bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');

const rgb = (hex: string): string => {
  const value = hex.replace('#', '');
  const channel = (at: number): string => (parseInt(value.slice(at, at + 2), 16) / 255).toFixed(3);
  return `${channel(0)} ${channel(2)} ${channel(4)}`;
};

const pt = (value: number): string => value.toFixed(2);

/** El ancho de una línea ya en puntos, sumado tramo a tramo. */
export function measure(text: string, style: TextStyle): number {
  return runsOf(text, style.font, style.size, style.tracking ?? 0).reduce(
    (sum, run) => sum + run.width,
    0,
  );
}

/**
 * Parte un texto en líneas que caben en `width`. Se corta en los espacios y,
 * si una palabra sola no cabe, se corta la palabra, que es preferible a que se
 * salga de la caja.
 */
export function wrap(text: string, style: TextStyle, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ').filter((word) => word.length > 0);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, style) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      if (measure(word, style) <= width) {
        line = word;
        continue;
      }
      let piece = '';
      for (const character of word) {
        if (measure(piece + character, style) > width && piece) {
          lines.push(piece);
          piece = '';
        }
        piece += character;
      }
      line = piece;
    }
    lines.push(line);
  }
  return lines;
}

/* ------------------------------------------------------------------- hoja */

export interface TableColumn {
  head: string;
  /** Fracción del ancho de la caja de texto. */
  width: number;
  numeric?: boolean;
}

export interface TableSpec {
  columns: readonly TableColumn[];
  rows: ReadonlyArray<readonly string[]>;
  size?: number;
}

interface Page {
  ops: string[];
}

export interface SheetOptions {
  title: string;
  author: string;
  subject?: string;
}

/**
 * La hoja: un cursor que baja por la página y salta a la siguiente cuando lo
 * que viene no cabe. Todo se dibuja en coordenadas de PDF —origen abajo a la
 * izquierda— y `y` es la línea base de lo próximo que se escriba.
 */
export class Sheet {
  readonly width = 595.28;
  readonly height = 841.89;
  /** 16 mm arriba, 14 mm a los lados y 20 mm abajo, como `@page` del informe macro. */
  readonly margin = { top: 45.35, right: 39.69, bottom: 56.69, left: 39.69 };

  private readonly pages: Page[] = [];
  private page: Page = { ops: [] };
  private cursor = 0;
  private decorator: ((sheet: Sheet, index: number, count: number) => void) | null = null;

  constructor(private readonly options: SheetOptions) {
    this.newPage();
  }

  get contentWidth(): number {
    return this.width - this.margin.left - this.margin.right;
  }

  get y(): number {
    return this.cursor;
  }

  get left(): number {
    return this.margin.left;
  }

  get right(): number {
    return this.width - this.margin.right;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  /** Se dibuja en cada página al cerrar el documento, cuando ya se sabe cuántas hay. */
  decorate(draw: (sheet: Sheet, index: number, count: number) => void): void {
    this.decorator = draw;
  }

  newPage(): void {
    this.page = { ops: [] };
    this.pages.push(this.page);
    this.cursor = this.height - this.margin.top;
  }

  /** Salta de página si no quedan `needed` puntos por debajo del cursor. */
  ensure(needed: number): void {
    if (this.cursor - needed < this.margin.bottom) this.newPage();
  }

  space(points: number): void {
    this.cursor -= points;
  }

  /* -- primitivas ---------------------------------------------------- */

  rect(x: number, y: number, width: number, height: number, color: string): void {
    this.page.ops.push(`${rgb(color)} rg ${pt(x)} ${pt(y)} ${pt(width)} ${pt(height)} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, stroke = 0.6): void {
    this.page.ops.push(
      `${rgb(color)} RG ${pt(stroke)} w ${pt(x1)} ${pt(y1)} m ${pt(x2)} ${pt(y2)} l S`,
    );
  }

  /**
   * Una línea de texto en su línea base, sin ajuste. `rotate` gira en grados
   * alrededor del punto de anclaje; `opacity` usa el estado gráfico que la
   * marca de agua necesita.
   */
  text(
    value: string,
    x: number,
    y: number,
    style: TextStyle,
    extra: { rotate?: number; opacity?: boolean } = {},
  ): void {
    const runs = runsOf(value, style.font, style.size, style.tracking ?? 0);
    const total = runs.reduce((sum, run) => sum + run.width, 0);
    const start =
      style.align === 'right' ? x - total : style.align === 'center' ? x - total / 2 : x;
    const ops: string[] = ['q'];
    if (extra.opacity) ops.push('/GS1 gs');
    if (extra.rotate) {
      const angle = (extra.rotate * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      ops.push(`${pt(cos)} ${pt(sin)} ${pt(-sin)} ${pt(cos)} ${pt(start)} ${pt(y)} cm`);
      ops.push('BT 0 0 Td');
    } else {
      ops.push(`BT ${pt(start)} ${pt(y)} Td`);
    }
    ops.push(`${rgb(style.color ?? INK.ink)} rg ${pt(style.tracking ?? 0)} Tc`);
    for (const run of runs) {
      ops.push(`/${run.resource} ${pt(style.size)} Tf <${toHex(run.bytes)}> Tj`);
    }
    ops.push('ET', 'Q');
    this.page.ops.push(ops.join(' '));
  }

  /* -- bloques ------------------------------------------------------- */

  /**
   * Un párrafo ajustado a `width`, que baja el cursor y cambia de página línea
   * a línea. Devuelve cuántas líneas ocupó. `keep` pide que las primeras
   * líneas no queden huérfanas al pie de una página.
   */
  paragraph(
    value: string,
    style: TextStyle,
    layout: { x?: number; width?: number; keep?: number; after?: number } = {},
  ): number {
    const x = layout.x ?? this.left;
    const width = layout.width ?? this.right - x;
    const leading = style.leading ?? style.size * 1.45;
    const lines = wrap(value, style, width);
    this.ensure(leading * Math.min(lines.length, layout.keep ?? 2));
    for (const line of lines) {
      this.ensure(leading);
      this.cursor -= leading;
      const anchor =
        style.align === 'right' ? x + width : style.align === 'center' ? x + width / 2 : x;
      this.text(line, anchor, this.cursor + (leading - style.size) / 2, style);
    }
    this.cursor -= layout.after ?? 0;
    return lines.length;
  }

  /** Un filete horizontal a lo ancho de la caja, con aire encima y debajo. */
  rule(color: string = INK.rule, stroke = 0.6, before = 3, after = 6): void {
    this.cursor -= before;
    this.line(this.left, this.cursor, this.right, this.cursor, color, stroke);
    this.cursor -= after;
  }

  /**
   * Una tabla con cabecera en versalitas, filas alternas teñidas y celdas que
   * ajustan su texto. Una fila no se parte; la cabecera se repite cuando la
   * tabla cambia de página.
   */
  table(spec: TableSpec): void {
    const size = spec.size ?? 8;
    const body: TextStyle = { font: 'sans', size, color: INK.soft, leading: size * 1.35 };
    const numeric: TextStyle = { ...body, font: 'mono', color: INK.ink };
    const head: TextStyle = {
      font: 'sans-bold',
      size: size - 1.2,
      color: INK.faint,
      tracking: 0.5,
    };
    const padX = 4;
    const padY = 3;
    const leading = body.leading ?? size * 1.35;
    const widths = spec.columns.map((column) => column.width * this.contentWidth);
    const starts = widths.map((_, index) =>
      widths.slice(0, index).reduce((sum, width) => sum + width, this.left),
    );

    const drawHead = (): void => {
      const height = head.size + padY * 2 + 1;
      this.ensure(height + leading * 2);
      const top = this.cursor;
      spec.columns.forEach((column, index) => {
        const start = starts[index] ?? this.left;
        const width = widths[index] ?? 0;
        const anchor = column.numeric ? start + width - padX : start + padX;
        this.text(column.head.toUpperCase(), anchor, top - padY - head.size, {
          ...head,
          align: column.numeric ? 'right' : 'left',
        });
      });
      this.cursor = top - height;
      this.line(this.left, this.cursor, this.right, this.cursor, INK.ink, 0.8);
    };

    drawHead();
    spec.rows.forEach((row, rowIndex) => {
      const cells = spec.columns.map((column, index) =>
        wrap(row[index] ?? '', column.numeric ? numeric : body, (widths[index] ?? 0) - padX * 2),
      );
      const lines = Math.max(1, ...cells.map((cell) => cell.length));
      const height = lines * leading + padY * 2;
      if (this.cursor - height < this.margin.bottom) {
        this.newPage();
        drawHead();
      }
      const top = this.cursor;
      if (rowIndex % 2 === 1)
        this.rect(this.left, top - height, this.contentWidth, height, INK.tint);
      cells.forEach((cell, index) => {
        const column = spec.columns[index];
        if (!column) return;
        const style = column.numeric ? numeric : body;
        const start = starts[index] ?? this.left;
        const width = widths[index] ?? 0;
        const anchor = column.numeric ? start + width - padX : start + padX;
        cell.forEach((line, lineIndex) => {
          const baseline = top - padY - (lineIndex + 1) * leading + (leading - size) / 2;
          this.text(line, anchor, baseline, { ...style, align: column.numeric ? 'right' : 'left' });
        });
      });
      this.cursor = top - height;
      this.line(this.left, this.cursor, this.right, this.cursor, INK.rule, 0.4);
    });
    this.cursor -= 4;
  }

  /* -- archivo ------------------------------------------------------- */

  /** El documento entero, listo para enviarse. */
  bytes(): Uint8Array<ArrayBuffer> {
    if (this.decorator) {
      const count = this.pages.length;
      const current = this.page;
      const cursor = this.cursor;
      const decorator = this.decorator;
      this.pages.forEach((page, index) => {
        this.page = page;
        decorator(this, index + 1, count);
      });
      this.page = current;
      this.cursor = cursor;
    }

    const objects: Buffer[] = [];
    const add = (body: Buffer | string): number => {
      objects.push(Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1'));
      return objects.length;
    };

    // Symbol no tiene una codificación que un lector sepa volver a Unicode, así
    // que sin este mapa ρ, β o el signo menos se ven pero no siempre se pueden
    // buscar ni copiar. El mapa sale de la misma tabla con que se escriben.
    const symbolMap = add(streamObject(toUnicodeCMap(SYMBOL)));
    const fontIds = Object.values(FONTS).map((font) =>
      add(
        `<< /Type /Font /Subtype /Type1 /BaseFont /${font.base}` +
          (font.base === 'Symbol'
            ? ` /ToUnicode ${symbolMap} 0 R`
            : ' /Encoding /WinAnsiEncoding') +
          ' >>',
      ),
    );
    const fontEntries = Object.values(FONTS)
      .map((font, index) => `/${font.resource} ${fontIds[index]} 0 R`)
      .join(' ');
    const stateId = add('<< /Type /ExtGState /ca 0.045 /CA 0.045 >>');
    const resources = `<< /Font << ${fontEntries} >> /ExtGState << /GS1 ${stateId} 0 R >> >>`;

    // Los números de objeto se reservan antes de escribir las páginas, porque
    // cada página apunta a la lista y la lista a cada página.
    const pagesId = objects.length + 1 + this.pages.length * 2;
    const pageIds: number[] = [];
    for (const page of this.pages) {
      const contentId = add(streamObject(page.ops.join('\n')));
      pageIds.push(
        add(
          `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pt(this.width)} ${pt(this.height)}] ` +
            `/Resources ${resources} /Contents ${contentId} 0 R >>`,
        ),
      );
    }
    add(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`,
    );
    const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const infoId = add(
      `<< /Title ${pdfString(this.options.title)} /Author ${pdfString(this.options.author)}` +
        (this.options.subject ? ` /Subject ${pdfString(this.options.subject)}` : '') +
        ` /Producer ${pdfString('Observatorio Económico')} /CreationDate (D:${stamp}Z) >>`,
    );

    // La segunda línea es la marca binaria que recomienda el formato: cuatro
    // bytes altos que avisan a un transporte de que esto no es texto.
    const header = Buffer.from('%PDF-1.4\n%âãÏÓ\n', 'latin1');
    const parts: Buffer[] = [header];
    const offsets: number[] = [];
    let length = header.length;
    objects.forEach((body, index) => {
      offsets.push(length);
      const chunk = Buffer.concat([
        Buffer.from(`${index + 1} 0 obj\n`, 'latin1'),
        body,
        Buffer.from('\nendobj\n', 'latin1'),
      ]);
      parts.push(chunk);
      length += chunk.length;
    });
    const xref =
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
      offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('') +
      `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\n` +
      `startxref\n${length}\n%%EOF\n`;
    parts.push(Buffer.from(xref, 'latin1'));

    // Copiado a un arreglo propio, y no devuelto el `Buffer`, para que quien lo
    // entregue como cuerpo de una respuesta no tenga que discutir con los tipos.
    const whole = Buffer.concat(parts);
    const out = new Uint8Array(whole.length);
    out.set(whole);
    return out;
  }
}

/** Una cadena del diccionario de información, en UTF-16 con marca de orden. */
function pdfString(value: string): string {
  const bytes = [0xfe, 0xff];
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0x3f;
    bytes.push((code >> 8) & 0xff, code & 0xff);
  }
  return `<${toHex(bytes)}>`;
}

/** Un objeto de flujo comprimido, con su diccionario delante. */
function streamObject(content: string): Buffer {
  const stream = deflateSync(Buffer.from(content, 'latin1'));
  return Buffer.concat([
    Buffer.from(`<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'),
    stream,
    Buffer.from('\nendstream', 'latin1'),
  ]);
}

/** El mapa de cada byte de la fuente a su carácter, en el formato CMap que pide el PDF. */
function toUnicodeCMap(table: Record<string, number>): string {
  const entries = Object.entries(table).map(
    ([character, byte]) =>
      `<${byte.toString(16).padStart(2, '0')}> <${(character.codePointAt(0) ?? 0x3f)
        .toString(16)
        .padStart(4, '0')}>`,
  );
  // `bfchar` admite a lo sumo cien entradas por bloque.
  const blocks: string[] = [];
  for (let at = 0; at < entries.length; at += 100) {
    const chunk = entries.slice(at, at + 100);
    blocks.push(`${chunk.length} beginbfchar\n${chunk.join('\n')}\nendbfchar`);
  }
  return [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange\n<00> <ff>\nendcodespacerange',
    ...blocks,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n');
}

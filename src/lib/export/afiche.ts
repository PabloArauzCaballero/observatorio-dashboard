/**
 * La figura de un panel como imagen: un «afiche» con su título, su gráfico, su
 * leyenda, su fuente y la marca del Observatorio, listo para pegar en un informe
 * o una red social.
 *
 * Solo corre en el navegador, porque lo que compone es lo que hay dibujado.
 *
 * Dos decisiones que no son obvias:
 *
 * 1. **Siempre en tema claro.** Quien está en oscuro y baja la imagen la pega en
 *    una diapositiva blanca; un gráfico con texto claro sobre fondo transparente
 *    desaparece. Por eso el panel se clona en un iframe fuera de pantalla con
 *    `data-theme="light"` y los colores se leen ahí, ya resueltos.
 * 2. **Un SVG suelto no tiene hoja de estilos ni variables.** Cada elemento del
 *    gráfico lleva sus propiedades escritas, y las fuentes viajan incrustadas:
 *    sin eso el texto sale en la letra que tenga el visor, con otras medidas.
 */

export interface MarcaLeyenda {
  label: string;
  color: string;
  forma: 'cuadro' | 'linea';
  discontinua: boolean;
}

export interface EntradaAfiche {
  /** El panel tal como está en pantalla. */
  panel: HTMLElement;
  titulo: string;
  /** Una línea con lo que dicen los datos. */
  entradilla?: string | undefined;
  fuente: string;
  /** «3 de octubre de 2026». */
  fecha: string;
  /**
   * Sin la marca del Observatorio al pie: dentro de un informe la lleva la
   * cabecera del documento, y repetirla en cada figura es ruido.
   */
  sinMarca?: boolean;
  /**
   * Sin las fuentes incrustadas: un informe con veinte figuras las declara una
   * sola vez (ver `hojaDeFuentes`) en vez de veinte copias de ciento diez mil
   * caracteres.
   */
  sinFuentes?: boolean;
}

export interface Afiche {
  svg: string;
  ancho: number;
  alto: number;
}

/** Las propiedades que un elemento SVG necesita llevar consigo. */
const PROPIEDADES = [
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'visibility',
  'display',
  'paint-order',
  'shape-rendering',
] as const;

const COLORES = new Set(['fill', 'stroke']);

const ANCHO = 1200;
const MARGEN = 56;
const CONTENIDO = ANCHO - MARGEN * 2;

const SANS = "'ObsSans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const SERIF = "'ObsSerif', Georgia, 'Times New Roman', serif";

// --- color ---------------------------------------------------------------------

let lienzoColor: CanvasRenderingContext2D | null = null;
const cacheColor = new Map<string, string>();

/**
 * Un color como `#rrggbb` o `rgba()`, venga como venga. `getComputedStyle`
 * devuelve `color(srgb …)` para todo lo que sale de `color-mix()`, y no todos
 * los visores de SVG lo entienden; un lienzo lo normaliza.
 */
function normalizarColor(valor: string): string {
  if (!valor || valor === 'none' || valor === 'currentcolor' || valor.startsWith('url(')) {
    return valor;
  }
  const guardado = cacheColor.get(valor);
  if (guardado) return guardado;
  if (!lienzoColor) {
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 1;
    lienzoColor = lienzo.getContext('2d', { willReadFrequently: true });
  }
  let salida = valor;
  if (lienzoColor) {
    lienzoColor.clearRect(0, 0, 1, 1);
    lienzoColor.fillStyle = '#000';
    lienzoColor.fillStyle = valor;
    lienzoColor.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0, a = 255] = lienzoColor.getImageData(0, 0, 1, 1).data;
    salida = a === 255 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
  }
  cacheColor.set(valor, salida);
  return salida;
}

// --- iframe en tema claro --------------------------------------------------------

/** Espera a que las hojas de estilo copiadas hayan cargado. */
function hojasListas(doc: Document): Promise<void> {
  const pendientes = [...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(
    (enlace) =>
      new Promise<void>((resolver) => {
        if (enlace.sheet) return resolver();
        enlace.addEventListener('load', () => resolver(), { once: true });
        enlace.addEventListener('error', () => resolver(), { once: true });
      }),
  );
  return Promise.all(pendientes).then(() => undefined);
}

interface Claro {
  doc: Document;
  panel: HTMLElement;
  liberar: () => void;
}

/** Clona el panel en un iframe fuera de pantalla, con la misma hoja y en tema claro. */
async function clonarEnClaro(origen: HTMLElement): Promise<Claro> {
  const ancho = Math.max(Math.round(origen.getBoundingClientRect().width), 320);
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.tabIndex = -1;
  marco.style.cssText = `position:fixed;left:-99999px;top:0;width:${ancho}px;height:2400px;border:0;visibility:hidden;`;
  document.body.append(marco);

  const doc = marco.contentDocument;
  if (!doc) {
    marco.remove();
    throw new Error('No se pudo preparar la figura para la imagen.');
  }
  doc.open();
  doc.write('<!doctype html><html><head></head><body></body></html>');
  doc.close();

  const raiz = doc.documentElement;
  raiz.className = document.documentElement.className;
  raiz.setAttribute('data-theme', 'light');
  raiz.lang = document.documentElement.lang;
  for (const nodo of document.head.querySelectorAll('link[rel="stylesheet"], style')) {
    doc.head.append(nodo.cloneNode(true));
  }
  doc.body.style.cssText = `margin:0;width:${ancho}px;`;
  const copia = origen.cloneNode(true) as HTMLElement;
  doc.body.append(copia);

  await hojasListas(doc);
  await doc.fonts?.ready;
  return { doc, panel: copia, liberar: () => marco.remove() };
}

// --- extracción -----------------------------------------------------------------

/** Los SVG que son el gráfico: no iconos, no marcas de cursor, con tamaño de figura. */
function graficosDe(panel: HTMLElement): SVGSVGElement[] {
  const hallados: SVGSVGElement[] = [];
  for (const svg of panel.querySelectorAll<SVGSVGElement>('svg')) {
    if (svg.classList.contains('ic')) continue;
    if (svg.closest('[data-export="skip"]')) continue;
    if (svg.closest('svg') !== svg) continue; // un SVG dentro de otro SVG ya viaja con su padre
    const caja = svg.getBoundingClientRect();
    const ancho = caja.width || Number(svg.getAttribute('width')) || 0;
    const alto = caja.height || Number(svg.getAttribute('height')) || 0;
    if (ancho < 160 || alto < 80) continue;
    hallados.push(svg);
  }
  return hallados;
}

function leyendaDe(panel: HTMLElement): MarcaLeyenda[] {
  const vistas = new Set<string>();
  const salida: MarcaLeyenda[] = [];
  for (const item of panel.querySelectorAll('.chart-legend li')) {
    const label = (item.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!label || vistas.has(label)) continue;
    vistas.add(label);
    const marca = item.querySelector<HTMLElement>('.chart-legend-mark');
    const estilo = marca ? getComputedStyle(marca) : null;
    const esLinea = marca?.classList.contains('chart-legend-mark-line') ?? false;
    const relleno = estilo?.backgroundColor ?? '';
    const sinRelleno = !relleno || relleno === 'rgba(0, 0, 0, 0)' || relleno === 'transparent';
    salida.push({
      label,
      color: normalizarColor(esLinea || sinRelleno ? (estilo?.color ?? '#6b7688') : relleno),
      forma: esLinea ? 'linea' : 'cuadro',
      discontinua: marca?.classList.contains('chart-legend-mark-dashed') ?? false,
    });
  }
  return salida;
}

/** Copia a cada elemento sus propiedades ya resueltas; sin clases, porque no habrá hoja. */
function fijarEstilos(origen: SVGSVGElement, copia: SVGSVGElement): void {
  const de = [origen, ...origen.querySelectorAll<SVGElement>('*')];
  const a = [copia, ...copia.querySelectorAll<SVGElement>('*')];
  for (let i = 0; i < de.length; i += 1) {
    const fuente = de[i];
    const destino = a[i];
    if (!fuente || !destino) continue;
    const calculado = getComputedStyle(fuente);
    let declaracion = '';
    for (const propiedad of PROPIEDADES) {
      let valor = calculado.getPropertyValue(propiedad);
      if (!valor) continue;
      if (COLORES.has(propiedad)) valor = normalizarColor(valor);
      declaracion += `${propiedad}:${valor};`;
    }
    // Un solo juego de letras: las dos fuentes del tablero viajan incrustadas.
    declaracion += `font-family:${SANS};`;
    destino.setAttribute('style', declaracion);
    destino.removeAttribute('class');
  }
  for (const marca of copia.querySelectorAll('[data-export="skip"]')) marca.remove();
}

// --- fuentes ----------------------------------------------------------------------

const cacheFuentes = new Map<string, string>();

async function fuenteBase64(ruta: string): Promise<string> {
  const guardada = cacheFuentes.get(ruta);
  if (guardada) return guardada;
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) throw new Error(`No se pudo leer la fuente ${ruta}`);
  const bytes = new Uint8Array(await respuesta.arrayBuffer());
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const base64 = btoa(binario);
  cacheFuentes.set(ruta, base64);
  return base64;
}

export async function hojaDeFuentes(): Promise<string> {
  const [sans, serif] = await Promise.all([
    fuenteBase64('/fonts/PublicSans-Variable.woff2'),
    fuenteBase64('/fonts/Newsreader-Variable.woff2'),
  ]);
  return (
    `@font-face{font-family:'ObsSans';font-weight:100 900;src:url(data:font/woff2;base64,${sans}) format('woff2');}` +
    `@font-face{font-family:'ObsSerif';font-weight:200 800;src:url(data:font/woff2;base64,${serif}) format('woff2');}`
  );
}

// --- composición ----------------------------------------------------------------

const escapar = (texto: string): string =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let medidor: CanvasRenderingContext2D | null = null;

function medir(texto: string, fuente: string): number {
  if (!medidor) medidor = document.createElement('canvas').getContext('2d');
  if (!medidor) return texto.length * 7;
  medidor.font = fuente;
  return medidor.measureText(texto).width;
}

/** Parte un texto en renglones que caben en `ancho`. */
function envolver(texto: string, fuente: string, ancho: number): string[] {
  const renglones: string[] = [];
  let actual = '';
  for (const palabra of texto.replace(/\s+/g, ' ').trim().split(' ')) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (actual && medir(prueba, fuente) > ancho) {
      renglones.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) renglones.push(actual);
  return renglones;
}

function varCss(doc: Document, nombre: string, respaldo: string): string {
  const valor = getComputedStyle(doc.documentElement).getPropertyValue(nombre).trim();
  return valor ? normalizarColor(valor) : respaldo;
}

/** Para medir con la letra real de la página y no con la del lienzo. */
function familiaDePagina(variable: '--serif' | '--sans'): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || 'sans-serif'
  );
}

function dimensionesDe(svg: SVGSVGElement): { ancho: number; alto: number } {
  const vista = svg.viewBox.baseVal;
  if (vista && vista.width > 0 && vista.height > 0)
    return { ancho: vista.width, alto: vista.height };
  const caja = svg.getBoundingClientRect();
  return {
    ancho: caja.width || Number(svg.getAttribute('width')) || CONTENIDO,
    alto: caja.height || Number(svg.getAttribute('height')) || 320,
  };
}

/**
 * Compone el afiche. Lanza si el panel no tiene un gráfico dibujable; quien
 * llama decide si ofrece la imagen (ver `puedeComponerImagen`).
 */
export async function componerAfiche(entrada: EntradaAfiche): Promise<Afiche> {
  const claro = await clonarEnClaro(entrada.panel);
  try {
    // Los gráficos del clon y los del original van emparejados por posición:
    // las medidas salen del original (con su tamaño real en pantalla) y los
    // estilos del clon (ya resueltos en tema claro).
    const delOriginal = graficosDe(entrada.panel);
    const delClon = graficosDe(claro.panel);
    if (delClon.length === 0) throw new Error('El panel no tiene un gráfico que bajar.');

    const tinta = varCss(claro.doc, '--ink', '#14181f');
    const suave = varCss(claro.doc, '--ink-soft', '#4a5464');
    const regla = varCss(claro.doc, '--rule', '#e2e6ed');

    const letraTitulo = `600 32px ${familiaDePagina('--serif')}`;
    const letraTexto = `400 16px ${familiaDePagina('--sans')}`;
    const letraLeyenda = `400 14px ${familiaDePagina('--sans')}`;
    const letraPie = `400 13px ${familiaDePagina('--sans')}`;

    let y = MARGEN;
    const partes: string[] = [];

    for (const renglon of envolver(entrada.titulo, letraTitulo, CONTENIDO)) {
      y += 38;
      partes.push(
        `<text x="${MARGEN}" y="${y}" font-family="${SERIF}" font-size="32" font-weight="600" fill="${tinta}">${escapar(renglon)}</text>`,
      );
    }
    if (entrada.entradilla) {
      y += 6;
      for (const renglon of envolver(entrada.entradilla, letraTexto, CONTENIDO)) {
        y += 24;
        partes.push(
          `<text x="${MARGEN}" y="${y}" font-family="${SANS}" font-size="16" fill="${suave}">${escapar(renglon)}</text>`,
        );
      }
    }
    y += 22;
    partes.push(`<rect x="${MARGEN}" y="${y}" width="${CONTENIDO}" height="1" fill="${regla}"/>`);
    y += 24;

    delClon.forEach((clon, i) => {
      const original = delOriginal[i] ?? clon;
      const { ancho, alto } = dimensionesDe(original);
      const altoFigura = Math.round((CONTENIDO * alto) / ancho);
      const figura = clon.cloneNode(true) as SVGSVGElement;
      // Los estilos salen del clon, que está en tema claro; del original saldrían los de la pantalla.
      fijarEstilos(clon, figura);
      figura.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
      figura.setAttribute('x', String(MARGEN));
      figura.setAttribute('y', String(y));
      figura.setAttribute('width', String(CONTENIDO));
      figura.setAttribute('height', String(altoFigura));
      figura.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      figura.setAttribute('overflow', 'visible');
      partes.push(new XMLSerializer().serializeToString(figura));
      y += altoFigura + 20;
    });

    const leyenda = leyendaDe(claro.panel);
    if (leyenda.length > 0) {
      let x = MARGEN;
      y += 6;
      let linea = y + 14;
      for (const marca of leyenda) {
        const ancho = medir(marca.label, letraLeyenda) + (marca.forma === 'linea' ? 26 : 20) + 22;
        if (x > MARGEN && x + ancho > MARGEN + CONTENIDO) {
          x = MARGEN;
          linea += 26;
        }
        if (marca.forma === 'linea') {
          const trazo = marca.discontinua ? ' stroke-dasharray="5 3"' : '';
          partes.push(
            `<line x1="${x}" y1="${linea - 5}" x2="${x + 18}" y2="${linea - 5}" stroke="${marca.color}" stroke-width="2.5" stroke-linecap="round"${trazo}/>`,
          );
          x += 26;
        } else {
          partes.push(
            `<rect x="${x}" y="${linea - 11}" width="12" height="12" rx="2" fill="${marca.color}"/>`,
          );
          x += 20;
        }
        partes.push(
          `<text x="${x}" y="${linea}" font-family="${SANS}" font-size="14" fill="${tinta}">${escapar(marca.label)}</text>`,
        );
        x += medir(marca.label, letraLeyenda) + 22;
      }
      y = linea + 22;
    }

    y += 10;
    partes.push(`<rect x="${MARGEN}" y="${y}" width="${CONTENIDO}" height="1" fill="${regla}"/>`);
    y += 12;
    for (const renglon of envolver(`Fuente: ${entrada.fuente}`, letraPie, CONTENIDO)) {
      y += 20;
      partes.push(
        `<text x="${MARGEN}" y="${y}" font-family="${SANS}" font-size="13" fill="${suave}">${escapar(renglon)}</text>`,
      );
    }
    if (entrada.sinMarca) {
      y += 18;
    } else {
      y += 26;
      partes.push(
        `<text x="${MARGEN}" y="${y}" font-family="${SANS}" font-size="13" font-weight="600" fill="${tinta}">Observatorio Económico de Bolivia</text>`,
        `<text x="${ANCHO - MARGEN}" y="${y}" font-family="${SANS}" font-size="13" text-anchor="end" fill="${suave}">datosbolivia.com · ${escapar(entrada.fecha)}</text>`,
      );
    }
    const alto = entrada.sinMarca ? y + 24 : y + MARGEN - 18;

    const fuentes = entrada.sinFuentes ? '' : await hojaDeFuentes();
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${alto}" viewBox="0 0 ${ANCHO} ${alto}">` +
      (fuentes ? `<style>${fuentes}</style>` : '') +
      `<rect width="${ANCHO}" height="${alto}" fill="#ffffff"/>` +
      partes.join('') +
      '</svg>';
    return { svg, ancho: ANCHO, alto };
  } finally {
    claro.liberar();
  }
}

/** ¿Tiene el panel un gráfico del que sacar una imagen? */
export function puedeComponerImagen(panel: HTMLElement): boolean {
  return graficosDe(panel).length > 0;
}

/** El afiche como PNG, a `escala` veces su tamaño (2 por omisión: nítido en una pantalla densa). */
export async function afichePng(afiche: Afiche, escala = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([afiche.svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const imagen = new Image();
    imagen.decoding = 'async';
    imagen.src = url;
    await imagen.decode();
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(afiche.ancho * escala);
    lienzo.height = Math.round(afiche.alto * escala);
    const contexto = lienzo.getContext('2d');
    if (!contexto) throw new Error('El navegador no puede dibujar la imagen.');
    contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    return await new Promise<Blob>((resolver, rechazar) =>
      lienzo.toBlob(
        (blob) => (blob ? resolver(blob) : rechazar(new Error('Sin imagen'))),
        'image/png',
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

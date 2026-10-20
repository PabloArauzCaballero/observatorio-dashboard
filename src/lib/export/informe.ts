/**
 * El informe de una pestaña: todos sus paneles, tal como están en pantalla, en un
 * documento listo para guardar como PDF.
 *
 * Solo corre en el navegador. No genera un archivo: compone un documento HTML en
 * un `iframe` oculto y abre el diálogo de impresión del navegador, que es lo que
 * saca un PDF con texto seleccionable y sin sumar una librería entera para ello
 * (el mismo camino que ya usa el informe de una serie macro).
 *
 * Qué entra de cada panel:
 *   · con un gráfico → su título, el gráfico en vector, su leyenda y su fuente, con la
 *     tipografía del informe y a la parte del ancho que ocupa en pantalla: dos gráficos
 *     que en pantalla van lado a lado, en el papel también. (Hasta el 20-oct-2026 iba el
 *     afiche entero: una caja blanca sobre el marfil, los ejes al doble de tamaño que la
 *     leyenda y dos figuras por hoja.)
 *   · sin gráfico pero con cifras o con una tabla → el título y la tabla puesta para
 *     leer (ver `tabla-impresa.ts`); el archivo completo se baja desde el menú del panel;
 *   · sin nada de eso → título, entradilla y fuente, para que el informe no
 *     calle que ese panel existe.
 *
 * Los bloques se parten entre páginas por filas, no enteros: un bloque que se negaba a
 * partirse saltaba a la hoja siguiente y dejaba media página en blanco.
 */
import { figurasDelPanel, hojaDeFuentes, puedeComponerImagen, type MarcaLeyenda } from './afiche';
import { PAPEL, cssPapel, papelHtml } from './membrete';
import { cifrasDelPanel } from './registro';
import { pieDeFuente } from './pie';
import { leerTablas } from './tablas';
import { escapar, tablaImpresa } from './tabla-impresa';

export interface EntradaInforme {
  /** «Macroeconomía · Series de Bolivia». */
  titulo: string;
  /** «3 de octubre de 2026». */
  fecha: string;
  paneles: ReadonlyArray<HTMLElement>;
  /** Para decir «Preparando 3 de 12» mientras se compone. */
  progreso?: ((hecho: number, total: number) => void) | undefined;
}

const textoDe = (elemento: Element | null | undefined): string =>
  (elemento?.textContent ?? '').replace(/\s+/g, ' ').trim();

function leyendaHtml(leyenda: readonly MarcaLeyenda[]): string {
  if (leyenda.length === 0) return '';
  return (
    '<ul class="leyenda">' +
    leyenda
      .map((m) => {
        const marca =
          m.forma === 'linea'
            ? `<i class="marca linea${m.discontinua ? ' discontinua' : ''}" style="border-color:${escapar(m.color)}"></i>`
            : `<i class="marca cuadro" style="background:${escapar(m.color)}"></i>`;
        return `<li>${marca}${escapar(m.label)}</li>`;
      })
      .join('') +
    '</ul>'
  );
}

/**
 * La parte de la columna de contenido que ocupa el panel en pantalla (0–1).
 *
 * La columna es la de los paneles, junto al carril de filtros si la página lo tiene; no
 * el panel más ancho: en «Series de Bolivia» todos son tarjetas de media columna, y medidos
 * entre sí salían todos a ancho completo.
 */
function fraccionDe(panel: HTMLElement): number {
  const ancho = panel.getBoundingClientRect().width;
  const mesa = panel.closest('.workspace');
  const columna =
    (mesa &&
      [...mesa.children].find(
        (hijo) => !hijo.classList.contains('rail') && hijo.contains(panel),
      )) ||
    panel.closest('[data-site-kind="pagina"], [data-site-kind="seccion"]');
  const total = columna?.getBoundingClientRect().width ?? ancho;
  return total > 0 ? Math.min(1, ancho / total) : 1;
}

/**
 * El ancho en el papel. El flujo es 6 mm más ancho que la hoja y cada pieza deja 6 mm a su
 * derecha: así dos medias columnas suman exactamente la hoja, con su calle en medio.
 * Más de tres cuartos es ancho completo; menos, se redondea a la mitad o al tercio.
 */
function anchoDe(fraccion: number): string {
  const pct = fraccion > 0.75 ? 100 : fraccion > 0.4 ? 50 : 33.33;
  return ` style="width:calc(${pct}% - 6mm)"`;
}

async function seccionDe(panel: HTMLElement, fraccion: number): Promise<string> {
  const titulo = textoDe(panel.querySelector('.panel-top h3'));
  const entradilla = textoDe(panel.querySelector('.panel-lede'));
  const fuente = textoDe(panel.querySelector('.panel-source')).replace(/^Fuente:\s*/, '');
  const pie = fuente ? `<p class="pie">${escapar(pieDeFuente(fuente))}</p>` : '';

  if (puedeComponerImagen(panel)) {
    const { figuras, leyenda } = await figurasDelPanel(panel);
    return (
      `<figure class="figura"${anchoDe(fraccion)}>` +
      `<h3>${escapar(titulo)}</h3>` +
      (entradilla ? `<p class="entradilla">${escapar(entradilla)}</p>` : '') +
      '<div class="laminas">' +
      figuras
        .map(
          (f) =>
            `<div class="lamina" style="width:${Math.round(f.fraccion * 100)}%">${f.svg}</div>`,
        )
        .join('') +
      '</div>' +
      leyendaHtml(leyenda) +
      pie +
      '</figure>'
    );
  }

  const conjuntos = cifrasDelPanel(panel).filter((c) => c.filas.length > 0);
  const tablas =
    conjuntos.length > 0 ? conjuntos : leerTablas(panel).filter((t) => t.filas.length > 0);
  return (
    '<section class="seccion">' +
    `<h3>${escapar(titulo)}</h3>` +
    (entradilla ? `<p class="entradilla">${escapar(entradilla)}</p>` : '') +
    tablas
      .map((t) => tablaImpresa(tablas.length > 1 ? t.etiqueta : undefined, t.columnas, t.filas))
      .join('') +
    pie +
    '</section>'
  );
}

/** Lo propio del informe; la hoja, la orla y el membrete vienen de `membrete.ts`. */
const CSS_INFORME = `
  * { box-sizing: border-box; }
  body { color: ${PAPEL.tinta}; font-family: 'ObsSans', 'Libre Franklin', system-ui, sans-serif;
    font-size: 9.5pt; line-height: 1.5; }
  .volanta { font-size: 6.8pt; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
    color: ${PAPEL.oroProfundo}; margin: 0 0 4pt; }
  h1 { font-family: 'ObsSerif', Georgia, serif; font-size: 25pt; line-height: 1.1; font-weight: 700;
    letter-spacing: -0.015em; margin: 0 0 4pt; }
  .fecha { font-size: 8.5pt; color: ${PAPEL.suave}; margin: 0 0 14pt; }
  /*
   * Las figuras guardan su parte del ancho de pantalla: dos medias columnas comparten renglón.
   * Bloques en línea y no flex: Chrome parte mal un flex dentro de la tabla del membrete (dejaba
   * la primera hoja en blanco y mandaba la primera figura a la segunda).
   */
  .flujo { display: block; margin-right: -6mm; }
  .flujo > * { display: inline-block; vertical-align: top; width: calc(100% - 6mm);
    margin: 0 6mm 7mm 0; }
  .figura, .seccion { padding-top: 5pt; border-top: 0.8pt solid ${PAPEL.tinta}; }
  .seccion { display: block; }
  .figura h3, .seccion h3 { font-family: 'ObsSerif', Georgia, serif; font-size: 11pt; font-weight: 700;
    line-height: 1.25; letter-spacing: -0.005em; margin: 0 0 2pt; break-after: avoid; }
  .entradilla { margin: 0 0 5pt; color: ${PAPEL.suave}; font-size: 8.3pt; line-height: 1.4;
    break-after: avoid; }
  .laminas { display: flex; flex-wrap: wrap; align-items: flex-start; }
  .lamina svg { display: block; width: 100%; height: auto; }
  .leyenda { list-style: none; margin: 4pt 0 0; padding: 0; display: flex; flex-wrap: wrap;
    gap: 2pt 10pt; font-size: 7.5pt; line-height: 1.35; }
  .leyenda li { display: inline-flex; align-items: center; gap: 4pt; }
  .marca { display: inline-block; flex: none; }
  .marca.linea { width: 12pt; border-top: 1.6pt solid; }
  .marca.linea.discontinua { border-top-style: dashed; }
  .marca.cuadro { width: 7pt; height: 7pt; border-radius: 1pt; }
  .etiqueta { margin: 8pt 0 3pt; font-weight: 600; font-size: 8.5pt; break-after: avoid; }
  table.datos { width: 100%; border-collapse: collapse; font-size: 7.8pt; margin: 0 0 4pt; }
  table.datos.corta { break-inside: avoid; }
  /* Una tabla corta viaja entera con su título: el título solo al pie de una hoja no sirve. */
  .seccion:has(table.corta) { break-inside: avoid; }
  /* Las direcciones sí se parten donde haga falta; las palabras y las fechas, no. */
  td a, dd a { overflow-wrap: anywhere; }
  .nw { white-space: nowrap; }
  table.datos tr { break-inside: avoid; }
  table.datos th, table.datos td { text-align: left; padding: 2.5pt 5pt;
    border-bottom: 0.5pt solid ${PAPEL.filete}; vertical-align: top; overflow-wrap: break-word; }
  table.datos th { border-bottom: 0.8pt solid ${PAPEL.tinta}; font-weight: 600; font-size: 7pt;
    letter-spacing: 0.04em; color: ${PAPEL.suave}; overflow-wrap: normal; }
  table.datos tbody tr:nth-child(even) td { background: ${PAPEL.marfil}; }
  table.datos .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  a { color: inherit; text-decoration: underline; text-decoration-color: ${PAPEL.fileteFuerte}; }
  .ficha { break-inside: avoid; padding: 5pt 0 6pt; border-bottom: 0.5pt solid ${PAPEL.filete}; }
  .ficha h4 { margin: 0 0 3pt; font-size: 9pt; font-weight: 700; }
  .ficha dl { margin: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 3pt 10pt; }
  .ficha .par { min-width: 0; }
  .ficha .par.ancho { grid-column: 1 / -1; }
  .ficha dt { font-size: 6.8pt; font-weight: 600; letter-spacing: 0.04em; color: ${PAPEL.suave}; }
  .ficha dd { margin: 0; font-size: 8pt; overflow-wrap: break-word; }
  .recorte, .pie { margin: 3pt 0 0; font-size: 7pt; color: ${PAPEL.suave}; line-height: 1.4; }
`;

/**
 * El documento a partir de las secciones ya compuestas. Separado de
 * `componerInforme` para poder verlo sin un tablero delante.
 */
export function documentoInforme(
  titulo: string,
  fecha: string,
  secciones: readonly string[],
  fuentes: string,
): string {
  const [seccion, ...resto] = titulo.split(' · ');
  return (
    '<!doctype html><html lang="es-BO"><head><meta charset="utf-8">' +
    `<title>${escapar(`datosbolivia-${titulo}`)}</title>` +
    `<style>${fuentes}${cssPapel()}${CSS_INFORME}</style></head><body>` +
    papelHtml(
      { documento: 'Informe del tablero', fecha, referencia: 'datosbolivia.com' },
      (resto.length ? `<p class="volanta">${escapar(seccion ?? '')}</p>` : '') +
        `<h1>${escapar(resto.length ? resto.join(' · ') : titulo)}</h1>` +
        `<p class="fecha">Cifras al ${escapar(fecha)}, con los filtros que estaban puestos en pantalla.</p>` +
        `<div class="flujo">${secciones.join('')}</div>`,
      titulo,
    ) +
    '</body></html>'
  );
}

/** Compone el documento completo del informe. */
export async function componerInforme(entrada: EntradaInforme): Promise<string> {
  const secciones: string[] = [];
  const total = entrada.paneles.length;
  for (const [i, panel] of entrada.paneles.entries()) {
    entrada.progreso?.(i, total);
    try {
      secciones.push(await seccionDe(panel, fraccionDe(panel)));
    } catch (error) {
      // Un panel que no se pudo componer no tira el informe entero: se nombra y se sigue.
      console.error('Informe: panel omitido', error);
      secciones.push(
        `<section class="seccion"><h3>${escapar(textoDe(panel.querySelector('.panel-top h3')))}</h3><p class="pie">Este panel no se pudo incluir en el informe.</p></section>`,
      );
    }
  }
  entrada.progreso?.(total, total);
  return documentoInforme(entrada.titulo, entrada.fecha, secciones, await hojaDeFuentes());
}

/**
 * Abre el diálogo de impresión sobre el documento.
 *
 * El `iframe` se queda en la página mientras dura el diálogo —quitarlo antes
 * cancela la impresión en Chrome— y se retira cuando la ventana recupera el
 * foco, que es lo más parecido a «terminó» que expone la API.
 */
export function imprimirDocumento(html: string, nombre: string): void {
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.setAttribute('title', 'Informe para imprimir');
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
  document.body.append(marco);

  const retirar = (): void => {
    marco.remove();
    window.removeEventListener('focus', alVolver);
  };
  const alVolver = (): void => {
    window.setTimeout(retirar, 800);
  };

  marco.onload = () => {
    const ventana = marco.contentWindow;
    if (!ventana) return retirar();
    // El título es lo que el diálogo propone como nombre del archivo.
    ventana.document.title = nombre;
    window.addEventListener('focus', alVolver);
    void ventana.document.fonts.ready.then(() => {
      ventana.focus();
      ventana.print();
    });
  };

  const doc = marco.contentDocument;
  if (!doc) return retirar();
  doc.open();
  doc.write(html);
  doc.close();
}

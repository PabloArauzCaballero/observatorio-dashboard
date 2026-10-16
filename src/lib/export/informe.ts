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
 *   · con un gráfico → su afiche (título, figura, leyenda y fuente), sin la marca
 *     repetida;
 *   · sin gráfico pero con cifras o con una tabla → el título y una tabla de las
 *     primeras filas (el archivo completo se baja desde el menú del panel);
 *   · sin nada de eso → título, entradilla y fuente, para que el informe no
 *     calle que ese panel existe.
 */
import { componerAfiche, hojaDeFuentes, puedeComponerImagen } from './afiche';
import type { Celda } from './datos';
import { PAPEL, cssPapel, papelHtml } from './membrete';
import { cifrasDelPanel } from './registro';
import { pieDeFuente } from './pie';
import { leerTablas } from './tablas';

export interface EntradaInforme {
  /** «Macroeconomía · Series de Bolivia». */
  titulo: string;
  /** «3 de octubre de 2026». */
  fecha: string;
  paneles: ReadonlyArray<HTMLElement>;
  /** Para decir «Preparando 3 de 12» mientras se compone. */
  progreso?: ((hecho: number, total: number) => void) | undefined;
}

const MAX_FILAS = 40;

const escapar = (texto: string): string =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const textoDe = (elemento: Element | null | undefined): string =>
  (elemento?.textContent ?? '').replace(/\s+/g, ' ').trim();

function celda(valor: Celda): string {
  if (valor === null) return '—';
  if (typeof valor === 'number') {
    return valor.toLocaleString('es-BO', { maximumFractionDigits: 4 });
  }
  return escapar(valor);
}

function tablaHtml(
  etiqueta: string | undefined,
  columnas: ReadonlyArray<string>,
  filas: ReadonlyArray<ReadonlyArray<Celda>>,
): string {
  const visibles = filas.slice(0, MAX_FILAS);
  const recorte =
    filas.length > MAX_FILAS
      ? `<p class="recorte">Primeras ${MAX_FILAS} de ${filas.length.toLocaleString('es-BO')} filas; el archivo completo se baja desde el panel.</p>`
      : '';
  return (
    (etiqueta ? `<p class="etiqueta">${escapar(etiqueta)}</p>` : '') +
    '<table class="datos"><thead><tr>' +
    columnas.map((c) => `<th>${escapar(c)}</th>`).join('') +
    '</tr></thead><tbody>' +
    visibles
      .map(
        (fila) =>
          '<tr>' +
          columnas
            .map((_, j) => {
              const valor = fila[j] ?? null;
              return `<td${typeof valor === 'number' ? ' class="num"' : ''}>${celda(valor)}</td>`;
            })
            .join('') +
          '</tr>',
      )
      .join('') +
    '</tbody></table>' +
    recorte
  );
}

async function seccionDe(panel: HTMLElement, fecha: string): Promise<string> {
  const titulo = textoDe(panel.querySelector('.panel-top h3'));
  const entradilla = textoDe(panel.querySelector('.panel-lede'));
  const fuente = textoDe(panel.querySelector('.panel-source')).replace(/^Fuente:\s*/, '');

  if (puedeComponerImagen(panel)) {
    const afiche = await componerAfiche({
      panel,
      titulo,
      entradilla: entradilla || undefined,
      fuente,
      fecha,
      sinMarca: true,
      sinFuentes: true,
    });
    return `<figure class="figura">${afiche.svg}</figure>`;
  }

  const conjuntos = cifrasDelPanel(panel).filter((c) => c.filas.length > 0);
  const tablas =
    conjuntos.length > 0 ? conjuntos : leerTablas(panel).filter((t) => t.filas.length > 0);
  return (
    '<section class="seccion">' +
    `<h3>${escapar(titulo)}</h3>` +
    (entradilla ? `<p class="entradilla">${escapar(entradilla)}</p>` : '') +
    tablas
      .map((t) => tablaHtml(tablas.length > 1 ? t.etiqueta : undefined, t.columnas, t.filas))
      .join('') +
    (fuente ? `<p class="pie">${escapar(pieDeFuente(fuente))}</p>` : '') +
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
  .fecha { font-size: 8.5pt; color: ${PAPEL.suave}; margin: 0 0 16pt; }
  .figura { margin: 0 0 9mm; break-inside: avoid; }
  .figura svg { display: block; width: 100%; height: auto; }
  .seccion { margin: 0 0 8mm; break-inside: avoid-page; }
  .seccion h3 { font-family: 'ObsSerif', Georgia, serif; font-size: 13.5pt; font-weight: 700;
    margin: 0 0 2pt; letter-spacing: -0.01em; }
  .entradilla { margin: 0 0 6pt; color: ${PAPEL.suave}; font-family: 'ObsSerif', Georgia, serif; }
  .etiqueta { margin: 8pt 0 3pt; font-weight: 600; font-size: 8.5pt; }
  table.datos { width: 100%; border-collapse: collapse; font-size: 7.8pt; margin: 0 0 4pt; }
  table.datos th, table.datos td { text-align: left; padding: 2.5pt 5pt; border-bottom: 0.5pt solid ${PAPEL.filete};
    vertical-align: top; }
  table.datos th { border-bottom: 0.8pt solid ${PAPEL.tinta}; font-weight: 600; font-size: 7pt;
    letter-spacing: 0.04em; color: ${PAPEL.suave}; }
  table.datos tbody tr:nth-child(even) td { background: ${PAPEL.marfil}; }
  table.datos td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .recorte, .pie { margin: 3pt 0 0; font-size: 7.5pt; color: ${PAPEL.suave}; }
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
        secciones.join(''),
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
      secciones.push(await seccionDe(panel, entrada.fecha));
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

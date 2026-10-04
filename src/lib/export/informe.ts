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
import { cifrasDelPanel } from './registro';
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
    '<table><thead><tr>' +
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
    (fuente ? `<p class="pie">Fuente: ${escapar(fuente)}</p>` : '') +
    '</section>'
  );
}

const CSS_INFORME = `
  @page { size: A4; margin: 15mm 14mm 18mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #14181f;
    font-family: 'ObsSans', system-ui, sans-serif; font-size: 10pt; line-height: 1.5;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cabecera { border-bottom: 1.5pt solid #14181f; padding-bottom: 8pt; margin-bottom: 14pt; }
  .marca { font-family: 'ObsSerif', Georgia, serif; font-size: 10.5pt; font-weight: 600; color: #4a5464; }
  h1 { font-family: 'ObsSerif', Georgia, serif; font-size: 24pt; line-height: 1.12; font-weight: 600;
    letter-spacing: -0.01em; margin: 6pt 0 2pt; }
  .fecha { font-size: 9pt; color: #4a5464; }
  .figura { margin: 0 0 9mm; break-inside: avoid; }
  .figura svg { display: block; width: 100%; height: auto; }
  .seccion { margin: 0 0 8mm; break-inside: avoid-page; }
  .seccion h3 { font-family: 'ObsSerif', Georgia, serif; font-size: 14pt; font-weight: 600;
    margin: 0 0 2pt; letter-spacing: -0.01em; }
  .entradilla { margin: 0 0 6pt; color: #4a5464; }
  .etiqueta { margin: 8pt 0 3pt; font-weight: 600; font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; font-size: 8pt; margin: 0 0 4pt; }
  th, td { text-align: left; padding: 2.5pt 5pt; border-bottom: 0.5pt solid #e2e6ed; vertical-align: top; }
  th { border-bottom: 0.8pt solid #14181f; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .recorte, .pie { margin: 3pt 0 0; font-size: 8pt; color: #4a5464; }
  .pie-doc { position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between;
    font-size: 7.5pt; color: #4a5464; border-top: 0.5pt solid #e2e6ed; padding-top: 3pt; background: #fff; }
`;

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
  const fuentes = await hojaDeFuentes();
  return (
    '<!doctype html><html lang="es-BO"><head><meta charset="utf-8">' +
    `<title>${escapar(`observatorio-${entrada.titulo}`)}</title>` +
    `<style>${fuentes}${CSS_INFORME}</style></head><body>` +
    '<header class="cabecera"><div class="marca">Observatorio Económico de Bolivia</div>' +
    `<h1>${escapar(entrada.titulo)}</h1><div class="fecha">${escapar(entrada.fecha)} · datosbolivia.com</div></header>` +
    secciones.join('') +
    `<div class="pie-doc"><span>Observatorio Económico de Bolivia · datosbolivia.com</span><span>${escapar(entrada.fecha)}</span></div>` +
    '</body></html>'
  );
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

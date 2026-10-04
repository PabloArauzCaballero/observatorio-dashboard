/**
 * Respaldo para los paneles que son una tabla y no un gráfico: leer la tabla de la
 * pantalla. Solo corre en el navegador, y solo cuando el panel no declaró cifras
 * por su cuenta (ver `useDatosDeFigura`).
 *
 * Lo que se baja es lo que se ve —con los filtros puestos— y por eso no se puede
 * equivocar de recorte; lo que no tiene es la precisión original, porque la
 * pantalla ya redondeó. La nota del archivo lo dice.
 */
import { tiparTabla } from './datos';
import type { Celda } from './datos';

export interface TablaLeida {
  etiqueta: string;
  columnas: string[];
  filas: Celda[][];
  nota: string;
}

const texto = (nodo: Element): string => (nodo.textContent ?? '').replace(/\s+/g, ' ').trim();

export function leerTablas(panel: Element): TablaLeida[] {
  const salida: TablaLeida[] = [];
  for (const tabla of panel.querySelectorAll('table')) {
    if (tabla.closest('[data-export="skip"]')) continue;
    const renglones = [...tabla.querySelectorAll('tr')].map((tr) =>
      [...tr.querySelectorAll('th, td')].map(texto),
    );
    if (renglones.length < 2) continue;
    const cabecera = renglones[0] ?? [];
    const cuerpo = renglones.slice(1);
    const ancho = Math.max(cabecera.length, ...cuerpo.map((fila) => fila.length));
    if (ancho === 0) continue;
    const columnas = Array.from({ length: ancho }, (_, j) => cabecera[j] || `Columna ${j + 1}`);
    const titulo = tabla.caption ? texto(tabla.caption) : '';
    salida.push({
      etiqueta: titulo || `Tabla ${salida.length + 1}`,
      columnas,
      filas: tiparTabla(cuerpo, ancho),
      nota: 'Leída de la pantalla tal como se muestra, con los filtros puestos y las cifras ya redondeadas.',
    });
  }
  return salida;
}

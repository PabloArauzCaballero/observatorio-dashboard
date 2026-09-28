/**
 * La respuesta cuando ningún modelo contesta.
 *
 * Los paquetes ya traen cada hecho escrito en una línea «- …» con su cifra, su
 * fecha y su fuente: es lo que lee el modelo. Sin modelo no hay redacción, pero
 * esas líneas se leen solas. La respuesta dice que es así, muestra las más
 * importantes de cada paquete y deja el resto a las tablas y los enlaces que
 * acompañan a toda respuesta.
 *
 * Puro, para probarlo con `node --test`.
 */

export type Motivo = 'sin-proveedor' | 'fallo' | 'presupuesto';

interface PaqueteLeido {
  id: string;
  texto: string;
  leido: boolean;
}

/** Qué dice cada paquete como título, en el orden en que suele importar. */
const TITULO: Record<string, string> = {
  HOY: 'Panorama de hoy',
  DOLAR: 'Dólar',
  MACRO: 'Indicadores anuales',
  DEPTO: 'Departamento',
  DEPTOS: 'Los nueve departamentos',
  POLITICA: 'Instituciones',
  PRENSA: 'Prensa reciente',
  ENERGIA: 'Energía',
  RECURSOS: 'Recursos naturales',
  AMBIENTE: 'Medio ambiente',
  COMERCIO: 'Comercio exterior',
  EMPRESAS: 'Empresas',
  EXOGENAS: 'Precios internacionales',
  MERCADOS: 'Mercados',
  MUNDO: 'Bolivia ante el mundo',
  CARRETERAS: 'Carreteras',
  CIUDADES: 'Ciudades',
  METODO: 'Fuentes',
};

const ENCABEZADO: Record<Motivo, string> = {
  'sin-proveedor': 'El asistente está funcionando sin IA en este servidor, así que no redacta: te muestro las cifras del tablero que responden tu pregunta, con su fecha.',
  fallo: 'Ahora no puedo redactar la respuesta con IA (el servicio no está disponible), pero estas son las cifras del tablero que responden tu pregunta, con su fecha.',
  presupuesto: 'El asistente llegó a su límite de uso de IA por hoy, pero estas son las cifras del tablero que responden tu pregunta, con su fecha.',
};

const POR_PAQUETE = 4;
const EN_TOTAL = 12;

/** Las líneas de hechos de un paquete: las «- …», sin las de reglas ni las sublíneas «  · …». */
export function hechos(texto: string): string[] {
  return texto
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => l.replace(/\s*Regla: .*$/, '').replace(/\s*Cómo leerlo: .*$/, '').trim())
    .filter((l) => l.length > 2);
}

export function respuestaSinIa(paquetes: readonly PaqueteLeido[], motivo: Motivo): string {
  const partes: string[] = [ENCABEZADO[motivo]];
  let quedan = EN_TOTAL;
  for (const p of paquetes) {
    if (!p.leido || !TITULO[p.id] || quedan <= 0) continue;
    const lineas = hechos(p.texto).slice(0, Math.min(POR_PAQUETE, quedan));
    if (lineas.length === 0) continue;
    quedan -= lineas.length;
    partes.push(`**${TITULO[p.id]}**`, ...lineas);
  }
  if (partes.length === 1) {
    partes.push('No encontré cifras para esa pregunta en los datos que leí. Probá nombrando el tema: el dólar, la inflación, un departamento, las exportaciones.');
  } else {
    partes.push('Abajo están las tablas completas para ver o descargar, y los enlaces a la pestaña donde está cada dato.');
  }
  return partes.join('\n');
}

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
  VENTAS_VIVO: 'Ventas en vivo',
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

/** Minúsculas, sin tildes: «Educación» y «educacion» son la misma palabra. */
const plano = (texto: string): string =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Las palabras de la pregunta que sirven para buscar: de cinco letras o más, recortadas a su raíz. */
export function raices(pregunta: string): string[] {
  const vacias = new Set(['sobre', 'cuanto', 'cuanta', 'cuales', 'donde', 'bolivia', 'comparada', 'comparado', 'opinas', 'esta', 'estan', 'tiene', 'datos']);
  return [...new Set(
    plano(pregunta)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 5 && !vacias.has(w))
      .map((w) => w.slice(0, 6)),
  )];
}

/**
 * Las líneas de un paquete, primero las que nombran lo que se preguntó.
 *
 * Sin modelo no hay quien elija el dato: «¿cómo está la educación comparada con
 * los vecinos?» traía las cuatro primeras líneas del paquete, que eran de PIB.
 * Ordenar por palabras compartidas con la pregunta pone arriba la de
 * educación; a igualdad, queda el orden del paquete.
 */
export function ordenarPorPregunta(lineas: readonly string[], pregunta: string): string[] {
  const buscadas = raices(pregunta);
  if (buscadas.length === 0) return [...lineas];
  const puntaje = (l: string) => {
    const t = plano(l);
    return buscadas.filter((r) => t.includes(r)).length;
  };
  return lineas
    .map((l, i) => ({ l, i, p: puntaje(l) }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map((x) => x.l);
}

export function respuestaSinIa(paquetes: readonly PaqueteLeido[], motivo: Motivo, pregunta = ''): string {
  const partes: string[] = [ENCABEZADO[motivo]];
  let quedan = EN_TOTAL;
  for (const p of paquetes) {
    if (!p.leido || !TITULO[p.id] || quedan <= 0) continue;
    const lineas = ordenarPorPregunta(hechos(p.texto), pregunta).slice(0, Math.min(POR_PAQUETE, quedan));
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

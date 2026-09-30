/**
 * Cuándo un lugar se marca como de confianza baja.
 *
 * Overture publica, para cada lugar, cuánto confía en que exista. El corpus de
 * tres ciudades cortó en 0,6; la carga del 2026-09-24 bajó el corte a 0,3 para
 * acercar el país a 200.000 lugares, y las filas entre 0,3 y 0,5 —casi todas
 * páginas de Facebook que nadie confirmó en la calle— entraron marcadas. El
 * tablero las muestra, pero no como si fueran tan firmes como las demás: quien
 * lee una fila de confianza baja tiene que saberlo en la misma fila.
 *
 * Vive aparte de `places.ts` porque ese módulo abre la base de datos y este lo
 * usan componentes del navegador.
 */

export const LOW_CONFIDENCE = 0.5;

export const LOW_CONFIDENCE_NOTE =
  'Confianza baja: la fuente no confirma que este lugar exista o siga abierto (Overture bajo el 50 %, o una ficha de Foursquare que nadie actualiza desde antes de 2020). Verificar antes de usar.';

/**
 * Foursquare no publica un número de confianza, pero sí cuándo se tocó la ficha por última
 * vez: el 70 % de Bolivia no se actualiza desde antes de 2020. Esa es la duda equivalente, y
 * la carga la deja escrita en `data_level`.
 */
const STALE_DIRECTORY = 'DIRECTORIO_COLABORATIVO_SIN_ACTUALIZAR';

export function isLowConfidence(place: {
  confidence: number | null;
  dataLevel?: string | null;
}): boolean {
  if (place.dataLevel === STALE_DIRECTORY) return true;
  return place.confidence !== null && place.confidence < LOW_CONFIDENCE;
}

/**
 * Cuándo el punto es el de la comunidad y no el del establecimiento.
 *
 * Es otra duda que la de arriba: el lugar existe —lo registra el Ministerio de
 * Salud—, pero el registro no trae coordenada y el punto es el de la comunidad
 * homónima de OpenStreetMap. Medido donde hay los dos, la mediana del error es
 * 480 m y uno de cada diez pasa de 3,4 km: sirve para saber en qué comunidad
 * está la posta, no para llegar a su puerta.
 */
const APPROXIMATE_POSITIONS = new Set(['centro_de_la_comunidad_osm_homonima']);

export const APPROXIMATE_POSITION_NOTE =
  'Ubicación aproximada: el registro no trae coordenada y el punto es el de la comunidad, no el del edificio.';

export function isApproximatePosition(place: { positionMethod: string | null }): boolean {
  return place.positionMethod !== null && APPROXIMATE_POSITIONS.has(place.positionMethod);
}

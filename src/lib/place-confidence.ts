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
  'Confianza baja: la fuente (Overture) no confirma que este lugar exista o siga abierto. Verificar antes de usar.';

export function isLowConfidence(place: { confidence: number | null }): boolean {
  return place.confidence !== null && place.confidence < LOW_CONFIDENCE;
}

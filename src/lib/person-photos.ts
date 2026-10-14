/**
 * Catálogo de retratos y fotografías de empresarios y principales personalidades de Bolivia.
 * Mapea identificadores de titulares y slugs de investigación a sus recursos en `public/people/`.
 */

/*
 * Vacío a propósito. Había 38 «retratos» SVG dibujados por plantilla —la misma silueta en tres
 * colores— y varios compartidos entre personas distintas (cuatro Paz con el mismo archivo, tres
 * Salvatierra, Maida Serrate con el de Mario Anglarill). No eran fotos y el lector las leía como
 * fotos: se retiraron. Una persona vuelve a tener imagen sólo con una fotografía real y
 * autorizada en `public/people/`, una por persona, anotada aquí por su clave.
 */
export const PERSON_PHOTOS: Readonly<Record<string, string>> = {
  ANABEL_ANGUS: 'anabel-angus.webp',
  CARLOS_MESA: 'carlos-mesa.webp',
  EDMAND_LARA: 'edmand-lara.webp',
  ELVIRA_ESPEJO_AYCA: 'elvira-espejo-ayca.webp',
  EVA_COPA: 'eva-copa.webp',
  EVO_MORALES: 'evo-morales.webp',
  JORGE_QUIROGA_RAMIREZ: 'jorge-quiroga-ramirez.webp',
  LUIS_ARCE: 'luis-arce.webp',
  MANFRED_REYES_VILLA: 'manfred-reyes-villa.webp',
  MARCELO_CLAURE: 'marcelo-claure.webp',
  MARIA_GALINDO: 'maria-galindo.webp',
  MIGUEL_KRIGSNER: 'miguel-krigsner.webp',
  RODRIGO_PAZ_PEREIRA: 'rodrigo-paz-pereira.webp',
  SAMUEL_DORIA_MEDINA: 'samuel-doria-medina.webp',
  // Nombres cortos con que otras fuentes llaman a la misma persona.
  ELVIRA_ESPEJO: 'elvira-espejo-ayca.webp',
  JORGE_QUIROGA: 'jorge-quiroga-ramirez.webp',
  JORGE_TUTO_QUIROGA: 'jorge-quiroga-ramirez.webp',
  LUIS_ARCE_CATACORA: 'luis-arce.webp',
  RODRIGO_PAZ: 'rodrigo-paz-pereira.webp',
  SAMUEL_DORIA: 'samuel-doria-medina.webp',
};

/**
 * Devuelve el nombre de archivo en `public/people/` si existe correspondencia exacta o normalizada por clave o nombre.
 */
export function findPersonPhoto(slugOrKey?: string | null, name?: string): string | null {
  if (slugOrKey) {
    const direct = PERSON_PHOTOS[slugOrKey];
    if (direct) return direct;

    const clean = slugOrKey.replace(/^P_/u, '').toUpperCase();
    if (PERSON_PHOTOS[clean]) return PERSON_PHOTOS[clean];
  }

  if (name) {
    const normalized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const exact = PERSON_PHOTOS[normalized];
    if (exact) return exact;
    const pref = PERSON_PHOTOS[`P_${normalized}`];
    if (pref) return pref;
  }

  return null;
}

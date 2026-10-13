/**
 * Catálogo de retratos y fotografías de empresarios y principales personalidades de Bolivia.
 * Mapea identificadores de titulares y slugs de investigación a sus recursos en `public/people/`.
 */

export const PERSON_PHOTOS: Readonly<Record<string, string>> = {
  // Empresarios (titulares y dueños de empresas)
  MARCELO_CLAURE: 'marcelo-claure.svg',
  MIGUEL_KRIGSNER: 'miguel-krigsner.svg',
  SAMUEL_DORIA_MEDINA: 'samuel-doria-medina.svg',
  MARIO_ANGLARILL: 'mario-anglarill.svg',
  MAIDA_SERRATE_DE_ANGLARILL: 'mario-anglarill.svg',
  IVO_MATEO_KULJIS_FUCHTNER: 'ivo-kuljis.svg',
  JULIO_NOVILLO_LA_FUENTE: 'julio-novillo.svg',
  CARLOS_PAZ_MORIN: 'carlos-paz.svg',
  CARLOS_PAZ_GVOZDANOVIC: 'carlos-paz.svg',
  ALEJANDRO_PAZ_MORIN: 'carlos-paz.svg',
  LUIS_PAZ_MORIN: 'carlos-paz.svg',
  CHRISTIAN_SCHILLING_DALGAS: 'christian-schilling.svg',
  DIRK_SCHILLING_DALGAS: 'christian-schilling.svg',
  IMKE_SCHILLING_DALGAS: 'christian-schilling.svg',
  EDWIN_SANTOS_SAAVEDRA_TOLEDO: 'edwin-saavedra.svg',
  FERNANDO_MONASTERIO_NIEME: 'fernando-monasterio.svg',
  JORGE_ARIAS_LAZCANO: 'jorge-arias.svg',
  GABRIEL_PABON_GUTIERREZ: 'gabriel-pabon.svg',
  ABDALLAH_EDMOND_DAHER_BULUS: 'abdallah-daher.svg',
  BEDOYA_BALLIVIAN_RENE_FERNANDO: 'fernando-bedoya.svg',
  JAIME_ROZENMAN_ATTIE: 'jaime-rozenman.svg',
  ENRIQUE_TERCEROS_HERRERA: 'enrique-terceros.svg',
  ALFONSO_KREIDLER: 'alfonso-kreidler.svg',
  JOSE_LUIS_CAMACHO_PARADA: 'jose-luis-camacho.svg',
  DANIEL_JOAQUIN_PAZ_SOLDAN_URRIOLAGOITIA: 'daniel-paz-soldan.svg',
  ANA_MARIA_SALVATIERRA_CHAVEZ_DE_HENICKE: 'ana-maria-salvatierra.svg',
  BARRY_LEONARDO_SALVATIERRA_CHAVEZ: 'ana-maria-salvatierra.svg',
  JOSE_EDUARDO_SALVATIERRA_CHAVEZ: 'ana-maria-salvatierra.svg',

  // Principales Personalidades (Top 5 Ipsos CIESMORI 2025 y figuras de sectores clave)
  P_RODRIGO_PAZ_PEREIRA: 'rodrigo-paz.svg',
  P_EDMAND_LARA: 'edmand-lara.svg',
  P_JORGE_QUIROGA_RAMIREZ: 'tuto-quiroga.svg',
  P_LUIS_ARCE: 'luis-arce.svg',
  P_JAIME_DUNN: 'jaime-dunn.svg',
  P_CARLOS_MESA: 'carlos-mesa.svg',
  P_EVO_MORALES: 'evo-morales.svg',
  P_MANFRED_REYES_VILLA: 'manfred-reyes-villa.svg',
  P_SAMUEL_DORIA_MEDINA: 'samuel-doria-medina.svg',
  P_EVA_COPA: 'eva-copa.svg',
  P_ALBERTINA_SACACA: 'albertina-sacaca.svg',
  P_LEONEL_FRANSEZZE: 'leonel-fransezze.svg',
  P_ANABEL_ANGUS: 'anabel-angus.svg',
  P_CARLOS_MARQUINA: 'carlos-marquina.svg',
  P_MARIA_GALINDO: 'maria-galindo.svg',
  P_JEAN_PIERRE_ANTELO: 'jean-pierre-antelo.svg',
  P_ALBERTO_GIMENEZ_TURBA: 'alberto-gimenez.svg',
  P_ELVIRA_ESPEJO_AYCA: 'elvira-espejo.svg',
  P_RAMIRO_VACA: 'ramiro-vaca.svg',
  P_MARCELO_CLAURE: 'marcelo-claure.svg',
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

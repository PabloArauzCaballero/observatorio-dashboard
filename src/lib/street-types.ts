/**
 * Las calles de las ciudades, como las sirve `/api/calles`.
 *
 * Son tipos y constantes sin dependencia del servidor, para que el lector, la
 * ruta y el mapa hablen de lo mismo.
 */

/** r residencial, l calle compartida, u sin clasificar, s de servicio, p peatonal. */
export type StreetClass = 'r' | 'l' | 'u' | 's' | 'p';
/** P pavimento, E empedrado, R ripio, T tierra, U sin pavimentar, D sin dato. */
export type StreetSurface = 'P' | 'E' | 'R' | 'T' | 'U' | 'D';

export interface StreetWay {
  id: number;
  /** `null` cuando OpenStreetMap no le da nombre: se dibuja, pero no se busca. */
  name: string | null;
  class: StreetClass;
  surface: StreetSurface;
  km: number;
  /** `[longitud, latitud]`, a ~2 m. */
  line: [number, number][];
}

export interface StreetCell {
  /** `<latitud>:<longitud>` de la esquina suroeste, con dos decimales. */
  id: string;
  department: string | null;
  streets: StreetWay[];
}

/** `[minLon, minLat, maxLon, maxLat]`. */
export type LonLatBox = [number, number, number, number];

export interface StreetIndexEntry {
  name: string;
  /** El nombre sin tildes ni mayúsculas: lo mismo que `streetKey`. */
  key: string;
  city: string;
  ways: number;
  department: string | null;
  km: number;
  paved: number;
  bounds: LonLatBox;
}

/**
 * Ancho de la vista, en unidades del plano, por debajo del cual se piden las calles.
 *
 * Una unidad son unos 1,3 km, así que 40 son ~52 km: una ciudad y su entorno. Más
 * allá serían cientos de celdas y la pantalla no tiene píxeles para dibujarlas.
 */
export const URBAN_MAX_WIDTH = 40;

export const STREET_CLASS_LABEL: Record<StreetClass, string> = {
  r: 'calle residencial',
  l: 'calle compartida',
  u: 'sin clasificar',
  s: 'de servicio',
  p: 'peatonal',
};

export const STREET_SURFACE_LABEL: Record<StreetSurface, string> = {
  P: 'Pavimentada',
  E: 'Ripio o empedrado',
  R: 'Ripio o empedrado',
  T: 'Tierra o sin pavimentar',
  U: 'Tierra o sin pavimentar',
  D: 'Sin dato de rodadura',
};

/** El grupo de rodadura de la leyenda, el mismo que `SURFACE_GROUP` da a los tramos. */
export const STREET_SURFACE_GROUP: Record<StreetSurface, 'PAVIMENTADA' | 'RIPIO' | 'TIERRA' | 'SIN_DATO'> = {
  P: 'PAVIMENTADA',
  E: 'RIPIO',
  R: 'RIPIO',
  T: 'TIERRA',
  U: 'TIERRA',
  D: 'SIN_DATO',
};

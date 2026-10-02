/**
 * El nombre de una calle, para buscarla y agruparla.
 *
 * Una calle de OpenStreetMap llega partida en muchas vías con el mismo nombre,
 * y el lector la escribe sin tildes y con otra mayúscula: «circunvalacion» tiene
 * que encontrar «Avenida Circunvalación». `foldName` es la clave de las dos
 * cosas, igual que `fold` en `scripts/roads/street_names.py` del núcleo.
 */

/** Sin tildes, mayúsculas ni signos: «Av. 6 de Agosto» → «av 6 de agosto». */
export function foldName(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/gu, '')
    .replaceAll(/[^a-z0-9]+/gu, ' ')
    .trim();
}

const TYPES = [
  'Avenida',
  'Calle',
  'Camino',
  'Pasaje',
  'Carretera',
  'Callejón',
  'Pasillo',
  'Plaza',
  'Paseo',
  'Autopista',
  'Circunvalación',
  'Ruta',
  'Sendero',
  'Urbanización',
  'Boulevard',
  'Costanera',
] as const;

const TYPE_KEYS = new Map(TYPES.map((type) => [foldName(type), type]));

/** «Avenida Blanco Galindo» → `{ type: 'Avenida', proper: 'Blanco Galindo' }`. */
export function splitStreetType(name: string): { type: string | null; proper: string } {
  const space = name.indexOf(' ');
  if (space < 0) return { type: null, proper: name };
  const type = TYPE_KEYS.get(foldName(name.slice(0, space)));
  return type ? { type, proper: name.slice(space + 1) } : { type: null, proper: name };
}

/** Si el nombre dice de qué «familia» de vía es, para ordenar y filtrar. */
export const streetKey = (name: string | null): string | null => {
  if (!name) return null;
  const key = foldName(name);
  return key || null;
};

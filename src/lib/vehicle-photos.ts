/**
 * Fotografía de cada modelo de la lista de vehículos 0 km, en `public/vehicles/`.
 *
 * Son fotos reales con licencia libre de Wikimedia Commons, de un ejemplar del mismo modelo —no
 * necesariamente de la versión ni del año que anuncia el representante en Bolivia—, por eso la
 * galería lo dice. Un modelo sin foto libre no tiene entrada y sale sin imagen: no se pone otro
 * auto en su lugar. Autor y licencia están en `image-credits.ts`.
 */
const PHOTOS: Readonly<Record<string, string>> = {
  'Nissan|Frontier': 'nissan-frontier.webp',
  'Nissan|Frontier CS': 'nissan-frontier-cs.webp',
  'Nissan|Kicks': 'nissan-kicks.webp',
  'Nissan|Pathfinder': 'nissan-pathfinder.webp',
  'Nissan|Sentra': 'nissan-sentra.webp',
  'Nissan|Versa': 'nissan-versa.webp',
  'Nissan|X-Trail': 'nissan-x-trail.webp',
  'Nissan|X-Trail e-POWER': 'nissan-x-trail-e-power.webp',
  'Renault|Kwid': 'renault-kwid.webp',
  'Renault|Kardian': 'renault-kardian.webp',
  'Renault|Duster': 'renault-duster.webp',
  'Renault|Oroch': 'renault-oroch.webp',
  'JAC|JS4': 'jac-js4.webp',
};

/** La ruta de la foto del modelo, o `null` si no hay una libre. */
export function vehiclePhoto(brand: string, model: string): string | null {
  const file = PHOTOS[`${brand}|${model}`];
  return file ? `/vehicles/${file}` : null;
}

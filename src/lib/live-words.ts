/**
 * Frases y productos llegan plegados (sin tildes, números como «#») porque así se cuentan
 * repetidos. Para leerlos se devuelven las tildes de las palabras frecuentes.
 */
const ACCENTS: Record<string, string> = {
  mio: 'mío', mia: 'mía', mios: 'míos', mias: 'mías', cuanto: 'cuánto', cuanta: 'cuánta', envio: 'envío',
  envios: 'envíos', donde: 'dónde', tamano: 'tamaño', tamanos: 'tamaños', ubicacion: 'ubicación',
  pantalon: 'pantalón', cafe: 'café', separame: 'sepárame', apartame: 'apártame', anotame: 'anótame',
  muestrame: 'muéstrame', poleron: 'polerón', camion: 'camión', jabon: 'jabón', sueter: 'suéter',
  rinonera: 'riñonera', munecas: 'muñecas', muneca: 'muñeca', panal: 'pañal', panales: 'pañales',
  bebe: 'bebé', telefono: 'teléfono', lampara: 'lámpara', audifono: 'audífono', audifonos: 'audífonos',
  mascara: 'máscara', rimel: 'rímel', serum: 'sérum', locion: 'loción', botin: 'botín', tacon: 'tacón',
  mocasin: 'mocasín', sarten: 'sartén', edredon: 'edredón', colchon: 'colchón', cojin: 'cojín',
  canasta: 'canasta', cunape: 'cuñapé', dinamica: 'dinámica', garantia: 'garantía', replica: 'réplica',
};
export const readable = (folded: string): string =>
  folded
    .split(' ')
    .map((word) => (word === '#' ? '[número]' : (ACCENTS[word] ?? word)))
    .join(' ');
export const productName = (folded: string): string => {
  const text = readable(folded);
  return text.charAt(0).toUpperCase() + text.slice(1);
};

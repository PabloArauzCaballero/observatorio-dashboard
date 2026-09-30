/**
 * Cómo se escriben los nombres que el INE publica en mayúsculas.
 *
 * Compartido entre el lector del servidor y el carril de filtros del
 * navegador: los dos muestran los mismos países y partidas y tienen que
 * escribirlos igual.
 */

const SMALL = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'y',
  'e',
  'o',
  'u',
  'el',
  'en',
  'a',
  'para',
  'por',
  'con',
  'sin',
]);

/** «ESTADOS UNIDOS» → «Estados Unidos»; lo que no viene en mayúsculas se deja. */
export function titled(text: string): string {
  // El INE recorta el rótulo del departamento sin declarar a once letras.
  if (/^NO ESPECIFI/u.test(text)) return 'No especificado';
  if (text !== text.toUpperCase()) return text;
  return text
    .toLowerCase()
    .split(/(\s+|[.,()/-])/u)
    .map((word, index) =>
      index > 0 && SMALL.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join('');
}

/** «LAS DEMAS ARVEJAS» → «Las demas arvejas»: una descripción arancelaria se lee como frase. */
export function sentenced(text: string): string {
  if (text !== text.toUpperCase()) return text;
  const lower = text.toLowerCase().replace(/\s+/gu, ' ').trim();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

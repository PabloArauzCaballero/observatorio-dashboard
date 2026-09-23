/**
 * La cocina de un restaurante, derivada de su nombre.
 *
 * Medido sobre Santa Cruz de la Sierra el 2026-09-23 (comentario de cabecera
 * de {@link import('./place-sectors').tallySectors}): 1.273 de 1.281
 * restaurantes de la ciudad llegan con la familia nativa genérica
 * `RESTAURANTE`, sin cocina — las familias de Overture que sí la dicen
 * (`OV_PIZZA_RESTAURANT`, `OV_BURGER_RESTAURANT`…) casi no aparecen ahí. En
 * una muestra de 432 de esos restaurantes el nombre delataba la especialidad
 * en uno de cada cuatro: «Papa Johns» y «Domino's» son pizza, «Burger King»
 * hamburguesa, «Pollos El Campeón» pollo, las churrasquerías parrilla, las
 * salteñerías comida boliviana.
 *
 * Reclasificar la familia en el núcleo tocaría datos ya cargados, que este
 * repo trata como inmutables. Esto deriva la cocina aquí, en el tablero, sin
 * tocar el corpus ni el núcleo.
 *
 * Es una heurística sobre el nombre, no un dato autoritativo: un lugar cuyo
 * nombre no encaja con ningún patrón se queda sin cocina (`null`), nunca se
 * le inventa una. Los patrones son de marca y de palabra, insensibles a
 * mayúsculas y acentos, y se prueban en orden — lo específico antes que lo
 * genérico, igual que {@link import('./place-sectors').SUBSECTOR_RULES} — así
 * que una pizzería con «grill» en el nombre cae en pizza y no en parrilla.
 *
 * Las claves coinciden a propósito con los sub-rubros de `RESTAURANTES` que ya
 * existen en `SUBSECTOR_RULES.GASTRONOMIA` (`place-sectors.ts`): quien use
 * esta clave como sufijo de una familia sintética (`RESTAURANTE__PIZZERIAS`)
 * la enchufa al árbol sin traducción.
 *
 * Solo tiene sentido para la familia `RESTAURANTE`: un lugar que ya vive en la
 * familia `CAFE` no pasa por aquí, así que la regla de cafetería de esta lista
 * nunca compite con esa familia — quien llama decide eso filtrando antes de
 * invocar esta función.
 */

export type CuisineKey =
  | 'PIZZERIAS'
  | 'HAMBURGUESERIAS'
  | 'POLLERIAS'
  | 'COMIDA_BOLIVIANA'
  | 'PARRILLAS'
  | 'COMIDA_ASIATICA'
  | 'COMIDA_RAPIDA'
  | 'CAFETERIAS';

/** Todas las claves válidas, para validar un sufijo de familia sintética. */
export const CUISINE_KEYS: readonly CuisineKey[] = [
  'PIZZERIAS',
  'HAMBURGUESERIAS',
  'POLLERIAS',
  'COMIDA_BOLIVIANA',
  'PARRILLAS',
  'COMIDA_ASIATICA',
  'COMIDA_RAPIDA',
  'CAFETERIAS',
];

interface CuisineRule {
  key: CuisineKey;
  /** Sobre el nombre normalizado (mayúsculas, sin acentos). */
  match: RegExp;
}

/**
 * Las reglas, en el orden en que se prueban.
 *
 * `\b` solo al inicio de cada palabra clave, nunca al final: el plural español
 * («pollos», «parrillas») y el sufijo de marca («burger's») añaden letras
 * después de la raíz, y exigir un límite ahí perdería esos casos.
 */
const CUISINE_RULES: CuisineRule[] = [
  { key: 'PIZZERIAS', match: /\bPIZZA|\bPAPA JOHN|\bDOMINO'?S/ },
  { key: 'HAMBURGUESERIAS', match: /\bBURGER|\bHAMBURGUES/ },
  { key: 'POLLERIAS', match: /\bPOLLO|\bCHICKEN|\bBROASTER|\bKFC\b/ },
  {
    key: 'COMIDA_BOLIVIANA',
    match: /\bSALTENA|\bAPI\b|\bANTICUCHO|\bPIQUE\b|\bBOLIVIAN/,
  },
  {
    key: 'PARRILLAS',
    match: /\bPARRILLA|\bCHURRASCO|\bGRILL|\bSTEAK|\bASADOR/,
  },
  {
    key: 'COMIDA_ASIATICA',
    match: /\bSUSHI|\bWOK\b|\bCHINA\b|\bCHINO\b|\bCHIFA/,
  },
  {
    key: 'COMIDA_RAPIDA',
    match: /\bFAST ?FOOD|\bSALCHIPAPA|\bHOT ?DOG|\bSNACK/,
  },
  { key: 'CAFETERIAS', match: /\bCAFE|\bCOFFEE/ },
];

/** Mayúsculas y sin acentos, para que el patrón no dependa de cómo se escribió el nombre. */
function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

/**
 * La cocina que delata el nombre de un restaurante, o `null` si ninguna regla
 * encaja. Nunca lanza ni adivina: sin coincidencia, sin cocina.
 */
export function deriveRestaurantCuisine(name: string | null | undefined): CuisineKey | null {
  if (!name) return null;
  const normalized = normalize(name);
  for (const rule of CUISINE_RULES) {
    if (rule.match.test(normalized)) return rule.key;
  }
  return null;
}

/** Si `value` es una de las claves de cocina, para validar un sufijo que llegó como texto. */
export function isCuisineKey(value: string): value is CuisineKey {
  return (CUISINE_KEYS as readonly string[]).includes(value);
}

/** El prefijo de la familia sintética: `RESTAURANTE__PIZZERIAS`, etc. */
export const SYNTHETIC_RESTAURANT_PREFIX = 'RESTAURANTE__';

/** La familia sintética de una cocina, tal como la expone `/api/familias`. */
export function syntheticRestaurantFamily(cuisine: CuisineKey): string {
  return `${SYNTHETIC_RESTAURANT_PREFIX}${cuisine}`;
}

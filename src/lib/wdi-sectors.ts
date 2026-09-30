/**
 * El rubro de una serie del Banco Mundial, leído de su propio código.
 *
 * El catálogo del banco trae mil quinientas series y ningún rubro: lo que trae
 * es un código con forma de dirección —`SE.PRM.ENRR`, `DT.DOD.DECT.CD`— cuyo
 * primer tramo es el tema bajo el que el banco la publica. Esa dirección es el
 * único dato de clasificación que el publicador entrega, y es estable: el
 * prefijo de una serie no cambia de año en año, porque cambiarlo sería cambiar
 * su código.
 *
 * Clasificar por prefijo es entonces leer lo que el publicador ya dijo, no
 * adivinar. Lo que sí es decisión nuestra es en cuántos rubros se reparten:
 * el banco tiene veinte temas y este informe tenía doce, y con doce media
 * docena de ellos caían juntos en «Social» —salud, educación, trabajo,
 * población y pobreza son cinco preguntas distintas y quinientas series— o
 * directamente en el residuo. El vocabulario de abajo es el del informe,
 * ensanchado hasta que ningún rubro esconda más de una pregunta.
 *
 * Las excepciones que hay son excepciones de verdad, no ajustes de gusto:
 * el acceso a electricidad es infraestructura aunque su código empiece por
 * energía, las rentas de recursos naturales son recursos aunque las publiquen
 * dentro de las cuentas nacionales, y la ayuda oficial al desarrollo es
 * cooperación aunque se registre como deuda. En los tres casos el código dice
 * dónde se computa la cifra y el rubro dice de qué habla, que no es lo mismo.
 *
 * El mismo reparto está escrito en SQL en la migración 0077 para las series
 * medidas de Bolivia. Son dos corpus distintos y un solo vocabulario a
 * propósito: un lector que filtra «Salud» en una pestaña y en la otra tiene
 * que estar preguntando lo mismo.
 */

/** Series cuyo código no tiene la forma de dirección del catálogo. */
const LITERAL: ReadonlyArray<readonly [RegExp, string]> = [
  [/^per_/u, 'POBREZA'],
  [/^GOV_WGI_/u, 'INSTITUCIONAL'],
  [/^GD_WBL_/u, 'GENERO'],
  [/^HD_HCIP_HLTH/u, 'SALUD'],
  [/^HD_HCIP_OTJL/u, 'TRABAJO'],
  [/^HD_HCIP_/u, 'SOCIAL'],
  [/^SH_UHC/u, 'SALUD'],
];

/**
 * Las series que el prefijo filiaría mal, y por qué.
 *
 * Se prueban antes que el prefijo y en este orden. Cada una responde a que el
 * código dice dónde se computa la cifra y no de qué habla.
 */
const EXCEPTION: ReadonlyArray<readonly [RegExp, string]> = [
  /* El acceso a la red se mide en el capítulo de energía y es infraestructura. */
  [/^EG\.ELC\.ACCS/u, 'INFRAESTRUCTURA'],
  [/^EG\.CFT\.ACCS/u, 'INFRAESTRUCTURA'],
  /* Uso del suelo y superficie: territorio, no producción agrícola. */
  [/^AG\.(LND|SRF)\./u, 'AMBIENTE'],
  /* Las rentas de recursos se publican dentro de las cuentas nacionales. */
  [/^NY\.GDP\..*RT\.ZS$/u, 'RECURSOS'],
  /* La ayuda al desarrollo se registra con la deuda y no es deuda. */
  [/^DT\.ODA\./u, 'COOPERACION'],
  /* Las reservas son sector externo aunque las publique el capítulo financiero. */
  [/^FI\.RES\./u, 'EXTERNO'],
  /* El tipo de cambio y la paridad viven los dos bajo `PA.NUS`. */
  [/^PA\.NUS\.(FCRF|ATLS)/u, 'CAMBIARIO'],
  [/^PX\.REX/u, 'CAMBIARIO'],
  [/^PA\.NUS\./u, 'PRECIOS'],
];

/** El tema del banco, por el primer tramo del código. */
const BY_PREFIX: Record<string, string> = {
  AG: 'SECTORIAL',
  BG: 'EXTERNO',
  BM: 'EXTERNO',
  BN: 'EXTERNO',
  BX: 'EXTERNO',
  CM: 'FINANCIERO',
  DC: 'COOPERACION',
  DT: 'DEUDA',
  EG: 'RECURSOS',
  EN: 'AMBIENTE',
  ER: 'AMBIENTE',
  FB: 'FINANCIERO',
  FD: 'FINANCIERO',
  FI: 'FINANCIERO',
  FM: 'MONETARIO',
  FP: 'PRECIOS',
  FR: 'MONETARIO',
  FS: 'FINANCIERO',
  FX: 'FINANCIERO',
  GB: 'EMPRESAS',
  GC: 'FISCAL',
  GF: 'EMPRESAS',
  IC: 'EMPRESAS',
  IE: 'INFRAESTRUCTURA',
  IP: 'EMPRESAS',
  IQ: 'INSTITUCIONAL',
  IS: 'INFRAESTRUCTURA',
  IT: 'INFRAESTRUCTURA',
  LP: 'EXTERNO',
  MS: 'INSTITUCIONAL',
  NE: 'ACTIVIDAD',
  NV: 'SECTORIAL',
  NY: 'ACTIVIDAD',
  PA: 'PRECIOS',
  PX: 'CAMBIARIO',
  SE: 'EDUCACION',
  SG: 'GENERO',
  SH: 'SALUD',
  SI: 'POBREZA',
  SL: 'TRABAJO',
  SM: 'POBLACION',
  SN: 'SALUD',
  SP: 'POBLACION',
  ST: 'SECTORIAL',
  TG: 'EXTERNO',
  TM: 'EXTERNO',
  TT: 'EXTERNO',
  TX: 'EXTERNO',
  VC: 'INSTITUCIONAL',
};

export function wdiSector(code: string): string {
  for (const [pattern, sector] of LITERAL) if (pattern.test(code)) return sector;
  for (const [pattern, sector] of EXCEPTION) if (pattern.test(code)) return sector;
  const prefix = code.slice(0, 2).toUpperCase();
  return BY_PREFIX[prefix] ?? 'OTROS';
}

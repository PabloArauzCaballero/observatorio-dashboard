import type { IconName } from './icons';
import type { MacroPoint } from '@/lib/series';

/**
 * Cómo se nombra un rubro, una unidad y una cifra en el panel macro.
 *
 * Vivían dentro de `macro-explorer.tsx` cuando el panel era una sola vista. La
 * vista de análisis y el PDF necesitan exactamente los mismos nombres —un rubro
 * que se llama «Sector externo» en la tabla y «EXTERNO» en el informe es un
 * error de datos a ojos del lector— así que se mudaron aquí, que es el único
 * sitio desde el que los tres pueden leerlos.
 */

/**
 * Los rubros, y por qué son veintidós y no doce.
 *
 * Eran doce y tres de ellos no tenían nombre en esta tabla —`FINANCIERO`,
 * `INSTITUCIONAL` y `FISCAL` salían en el filtro gritados en mayúsculas,
 * porque la base los filaba y el informe no sabía decirlos—. Pero el problema
 * de fondo no era ese: era que `SOCIAL` llevaba la alfabetización, la
 * mortalidad infantil, el desempleo, la población y el Gini a la vez. Cinco
 * preguntas bajo un título es una lista, no una respuesta, y un lector que
 * abría el rubro tenía que volver a filtrar a mano.
 *
 * Se parte en `EDUCACION`, `SALUD`, `TRABAJO`, `POBLACION` y `POBREZA`, y se
 * suman `AMBIENTE`, `INFRAESTRUCTURA`, `EMPRESAS` y `COOPERACION` para lo que
 * no tenía título propio. `SOCIAL` sobrevive para lo que de verdad es
 * compuesto: el índice de desarrollo humano no es salud, ni educación, ni
 * ingreso —es los tres a la vez, y meterlo en cualquiera de ellos sería decir
 * que es uno—.
 *
 * El mismo vocabulario nombra los dos corpus: las series medidas de Bolivia,
 * que la migración 0077 fila una por una, y las mil quinientas del Banco
 * Mundial, que `wdi-sectors.ts` fila por el prefijo de su código. Un lector
 * que filtra «Salud» en una pestaña tiene que estar preguntando lo mismo en la
 * otra.
 */
export const SECTOR_LABEL: Record<string, string> = {
  ACTIVIDAD: 'Actividad',
  SECTORIAL: 'Estructura productiva',
  RECURSOS: 'Recursos y energía',
  AMBIENTE: 'Ambiente y territorio',
  EXTERNO: 'Sector externo',
  COOPERACION: 'Cooperación externa',
  PRECIOS: 'Precios',
  CAMBIARIO: 'Tipo de cambio',
  MONETARIO: 'Monetario',
  FINANCIERO: 'Sistema financiero',
  FISCAL: 'Cuentas fiscales',
  DEUDA: 'Deuda externa',
  TRABAJO: 'Trabajo y empleo',
  EDUCACION: 'Educación',
  SALUD: 'Salud',
  POBLACION: 'Población y migración',
  POBREZA: 'Pobreza y desigualdad',
  GENERO: 'Género',
  INFRAESTRUCTURA: 'Infraestructura',
  EMPRESAS: 'Empresas e innovación',
  INSTITUCIONAL: 'Instituciones',
  SOCIAL: 'Desarrollo humano',
  OTROS: 'Otros',
};

export const SECTOR_ICON: Record<string, IconName> = {
  ACTIVIDAD: 'tendencia',
  SECTORIAL: 'fabrica',
  RECURSOS: 'gema',
  AMBIENTE: 'hoja',
  EXTERNO: 'globo',
  COOPERACION: 'maletin',
  PRECIOS: 'etiqueta',
  CAMBIARIO: 'velas',
  MONETARIO: 'monedas',
  FINANCIERO: 'banco',
  FISCAL: 'edificio',
  DEUDA: 'balanza',
  TRABAJO: 'casco',
  EDUCACION: 'capas',
  SALUD: 'corazon',
  POBLACION: 'mapa',
  POBREZA: 'barras',
  GENERO: 'personas',
  INFRAESTRUCTURA: 'camion',
  EMPRESAS: 'tienda',
  INSTITUCIONAL: 'escudo',
  SOCIAL: 'pulso',
  OTROS: 'cajas',
};

/**
 * El rubro lo dice el icono y el rótulo; la línea va siempre del mismo color.
 *
 * Había diez rubros repartidos entre cinco colores, así que «Actividad» y
 * «Sector externo» compartían azul y «Precios», «Recursos» y «Tipo de cambio»
 * compartían naranja: el color afirmaba un parentesco que no existe, que es
 * peor que no decir nada. Y con diez rubros no hay forma de arreglarlo
 * pintando: una paleta solo garantiza que dos colores se distingan hasta media
 * docena, y más allá de eso dos rubros distintos acaban siendo el mismo color
 * para quien no ve bien el rojo o el verde.
 *
 * La ficha ya nombra su rubro dos veces —con un icono y con la palabra—, así
 * que el color no estaba identificando nada que no estuviera ya escrito. Lo
 * que gana la retícula al pintarlas todas igual es que vuelve a ser un solo
 * instrumento: diez fichas se comparan entre sí, que es para lo que están
 * juntas. Un rubro adverso o favorable NO se marca aquí —el rojo y el verde
 * azulado de este informe significan «por encima» y «por debajo» de una
 * referencia, y ningún rubro es eso por naturaleza—.
 *
 * Era una tabla con un color repetido diez veces. Con veintidós rubros la
 * tabla habría repetido el mismo valor veintidós veces y seguido diciendo lo
 * mismo: que el color no distingue rubros. Queda dicho una sola vez.
 */
export const SECTOR_TONE = 'var(--official)';

export const UNIT_LABEL: Record<string, string> = {
  PERCENT: '%',
  PERCENT_OF_GDP: '% del PIB',
  USD: 'USD',
  INDEX: 'índice',
  MONTHS: 'meses',
  PEOPLE: 'personas',
  YEARS: 'años',
};

export const sectorLabel = (sector: string): string => SECTOR_LABEL[sector] ?? sector;
export const sectorIcon = (sector: string): IconName => SECTOR_ICON[sector] ?? 'cajas';
export const sectorTone = (): string => SECTOR_TONE;
export const unitLabel = (unit: string): string => UNIT_LABEL[unit] ?? unit;

export const number = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/**
 * Una cifra a la escala en la que se lee.
 *
 * Las reservas en dólares son once dígitos y la inflación son dos: escritas con
 * la misma regla, una de las dos sale ilegible. La unidad decide la escala, y
 * esa decisión tiene que ser la misma en la tarjeta, en la tabla y en el
 * informe impreso.
 */
export function headlineValue(value: number, unit: string): string {
  if (unit === 'USD') {
    const billions = value / 1_000_000_000;
    return Math.abs(billions) >= 1
      ? `${number(billions, 2)} mil M`
      : `${number(value / 1_000_000, 0)} M`;
  }
  if (unit === 'PEOPLE') return `${number(value / 1_000_000, 2)} M`;
  return number(value, 2);
}

export const headline = (point: MacroPoint): string => headlineValue(point.value, point.unit);

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

export const SECTOR_LABEL: Record<string, string> = {
  ACTIVIDAD: 'Actividad',
  SECTORIAL: 'Sectorial',
  RECURSOS: 'Recursos naturales',
  EXTERNO: 'Sector externo',
  PRECIOS: 'Precios',
  MONETARIO: 'Monetario y financiero',
  DEUDA: 'Deuda externa',
  SOCIAL: 'Social y laboral',
  CAMBIARIO: 'Tipo de cambio',
  OTROS: 'Otros',
};

export const SECTOR_ICON: Record<string, IconName> = {
  ACTIVIDAD: 'tendencia',
  SECTORIAL: 'cajas',
  RECURSOS: 'hoja',
  EXTERNO: 'globo',
  PRECIOS: 'etiqueta',
  MONETARIO: 'monedas',
  DEUDA: 'balanza',
  SOCIAL: 'personas',
  CAMBIARIO: 'balanza',
  OTROS: 'cajas',
};

export const SECTOR_TONE: Record<string, string> = {
  ACTIVIDAD: 'var(--official)',
  SECTORIAL: 'var(--gap)',
  RECURSOS: 'var(--parallel)',
  EXTERNO: 'var(--official)',
  PRECIOS: 'var(--parallel)',
  MONETARIO: 'var(--gap)',
  DEUDA: 'var(--up)',
  SOCIAL: 'var(--down)',
  CAMBIARIO: 'var(--parallel)',
  OTROS: 'var(--ink-soft)',
};

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
export const sectorTone = (sector: string): string => SECTOR_TONE[sector] ?? 'var(--ink-soft)';
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

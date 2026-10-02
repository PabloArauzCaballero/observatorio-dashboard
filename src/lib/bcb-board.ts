/**
 * Las estadísticas del Banco Central, en la forma que el explorador las pide.
 *
 * El catálogo son doce mil series y no viaja entero: cada búsqueda trae las que
 * coinciden (hasta `PAGE`), con el conteo de cada filtro recortado por los demás, y los
 * puntos se piden solo de las series que alguien eligió. Este módulo no toca la base.
 */

export interface BcbFacet {
  key: string;
  label: string;
  count: number;
}

export interface BcbSeriesInfo {
  code: string;
  name: string;
  family: string;
  workbook: string;
  /** El nombre del informe tal como lo publica el BCB, con sus tildes. */
  workbookTitle: string;
  sheet: string;
  unit: string | null;
  frequency: string;
  firstPeriod: string;
  lastPeriod: string;
  pointCount: number;
}

export interface BcbCatalogPage {
  families: BcbFacet[];
  workbooks: BcbFacet[];
  /** Solo cuando hay un informe elegido: las hojas de un informe son su índice. */
  sheets: BcbFacet[];
  frequencies: BcbFacet[];
  results: BcbSeriesInfo[];
  total: number;
  /** El período más reciente entre las series que coinciden. */
  latest: string | null;
}

export interface BcbSeriesData extends BcbSeriesInfo {
  locator: Record<string, string | number> | null;
  sourceUrl: string | null;
  evidenceSha256: string | null;
  /** `[fecha, valor]` como la semilla: el nombre de dos campos repetido en cada punto era la mitad del peso. */
  points: Array<[string, number]>;
}

export const PAGE = 40;
export const MAX_SELECTED = 4;
/** Cuántas series se dibujan solas al abrir la pestaña o al cambiar de informe. */
export const AUTO_DRAWN = 3;

export const FAMILY_LABEL: Record<string, string> = {
  'activos-virtuales': 'Activos virtuales',
  'sector-externo': 'Sector externo',
  'sector-monetario': 'Dinero y bancos',
  'sistema-de-pagos': 'Sistema de pagos',
  semanales: 'Estadísticas semanales',
  'tasas-de-interes': 'Tasas de interés',
  'tasas-por-entidad': 'Tasas por entidad',
  'tasas-historicas': 'Tasas históricas por tipo de entidad',
  precios: 'Precios',
  'tipo-de-cambio': 'Tipo de cambio',
  publicaciones: 'Publicaciones del BCB',
  'operaciones-de-mercado-abierto': 'Subastas del BCB',
  otros: 'Otros',
};

export const FREQUENCY_LABEL: Record<string, string> = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
  MIXED: 'Mezclada',
};

/**
 * Un nombre de serie legible.
 *
 * Algunos cuadros del BCB escriben sus rótulos con las letras separadas para estirarlos
 * sobre la columna («A C T I V A S | MN»): se juntan. Y una serie que repite su rótulo en
 * dos columnas llega con «(2)»; el número es de quien la leyó, no del dato.
 */
export function tidyName(name: string): string {
  return (
    name
      .replace(/(?:^|(?<=\s|\|))(?:[\p{L}]\s){3,}[\p{L}](?=\s|\||$)/gu, (run) =>
        run.replace(/\s/gu, ''),
      )
      .split(/\s*\|\s*/u)
      // «En millones de dólares» es la unidad, que la serie ya lleva aparte.
      .filter((part) => part && !/^\(?\s*en\s/iu.test(part))
      .join(' · ')
      .replace(/\s+/gu, ' ')
      .trim()
  );
}

/**
 * Las etiquetas de un grupo de series, sin lo que todas comparten.
 *
 * Las series de una hoja empiezan igual («Reservas internacionales del BCB · …») y solo se
 * distinguen al final; una leyenda con ese prefijo repetido en cada renglón no dice cuál es
 * cuál. Se quita el tramo común y, si aun así dos quedan iguales, se numeran.
 */
export function shortLabels(names: readonly string[]): string[] {
  const parts = names.map((name) => name.split(' · '));
  let common = 0;
  const shortest = Math.min(...parts.map((one) => one.length));
  while (
    common < shortest - 1 &&
    parts.length > 1 &&
    parts.every((one) => one[common] === parts[0]?.[common])
  ) {
    common += 1;
  }
  const seen = new Map<string, number>();
  return parts.map((one, index) => {
    const label = one.slice(common).join(' · ') || names[index] || '';
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    return count > 1 ? `${label} (${count})` : label;
  });
}

/** Un título de archivo que no dice nada («03A», «02 14P») se acompaña de su primera hoja. */
export const isOpaqueTitle = (title: string): boolean =>
  title.length <= 8 || /^[\d\s.\-]*[A-Za-z]?[\d\s.\-]*[A-Za-z]?$/u.test(title);

export const familyLabel = (family: string): string => FAMILY_LABEL[family] ?? family;

/**
 * El título de un informe, del nombre del archivo que el BCB publicó.
 *
 * El catálogo guarda el informe sin tildes ni números para reconocer sus versiones; el
 * título que se lee es el del archivo de la versión vigente, que sí los trae.
 */
export function workbookTitle(url: string | null, fallback: string): string {
  const raw = url?.split('/').pop() ?? fallback.split('/').pop() ?? fallback;
  let name = raw;
  try {
    name = decodeURIComponent(raw);
  } catch {
    // Una dirección mal codificada se muestra como viene.
  }
  const clean = name
    .replace(/\.(xlsx?|pdf)$/iu, '')
    .replace(/_+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : fallback;
}

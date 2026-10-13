/**
 * El mapa del tablero: sus secciones y las páginas de cada una, escrito una vez.
 *
 * Lo leen el índice lateral, los enlaces del asistente (`/?pestana=…&pagina=…`) y
 * las pruebas que comprueban que el índice nombra lo que de verdad hay en la
 * página. Los rótulos son los mismos que llevan los títulos de cada sección y
 * página: si uno cambia de nombre, cambia aquí y la prueba avisa de dónde.
 *
 * Puro —sin React ni `window`— para usarlo en el servidor y probarlo.
 */
import type { IconName } from '@/components/icons';

/**
 * El mismo `slug` de `enlace-tablero.ts`, repetido aquí a propósito: este módulo no importa nada de
 * este proyecto salvo tipos, para poder probarse con `node --test`. Una prueba comprueba que los dos
 * dicen lo mismo.
 */
export function slug(rotulo: string): string {
  return rotulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface SitePage {
  label: string;
}

export interface SiteSection {
  label: string;
  icon: IconName;
  /** Las páginas interiores, en orden; ninguna si la sección es de una sola pieza. */
  pages: readonly SitePage[];
}

const paginas = (...rotulos: string[]): SitePage[] => rotulos.map((label) => ({ label }));

export const SITE: readonly SiteSection[] = [
  { label: 'Hoy', icon: 'diana', pages: [] },
  { label: 'Tipo de cambio', icon: 'linea', pages: [] },
  {
    label: 'Macroeconomía',
    icon: 'globo',
    pages: paginas(
      'Series de Bolivia',
      'Social Info',
      'Bolivia ante el mundo',
      'Variables exógenas',
      'Factores externos',
      'Series del BCB',
      'Comercio exterior',
      'Detalle aduanero (INE)',
    ),
  },
  {
    label: 'Empresas',
    icon: 'edificio',
    pages: paginas(
      'Tejido empresarial',
      'Principales empresas',
      'Empresarios',
      'Bolsa de valores (BBV)',
      'Reputación empresarial',
      'Redes sociales',
      'Ventas en vivo',
      'Videos de vendedores',
    ),
  },
  {
    label: 'Personalidades',
    icon: 'personas',
    pages: paginas(
      'Impacto percibido',
      'Atención medible',
      'Fichas',
      'Conversación',
      'Método y calidad',
    ),
  },
  { label: 'Ciudades', icon: 'mapa', pages: [] },
  {
    label: 'Transporte',
    icon: 'camion',
    pages: paginas(
      'Automotor',
        'Vehículos 0 km',
        'Estudio automotor',
        'Competencia automotriz',
        'Precios internacionales',
        'Escenarios automotores',
      'Carburantes',
      'Pasajes',
      'Tarifas publicadas',
      'Carreteras',
      'Ferrocarriles',
      'Ríos y puertos',
      'Fletes',
    ),
  },
  { label: 'Prensa', icon: 'ventana', pages: paginas('Cobertura', 'Temas') },
  { label: 'Método', icon: 'info', pages: [] },
];

/** El ancla de una sección: «tipo-de-cambio». */
export const idDeSeccion = (rotulo: string): string => slug(rotulo);

/** El ancla de una página: «macroeconomia--series-de-bolivia». */
export const idDePagina = (seccion: string, pagina: string): string =>
  `${slug(seccion)}--${slug(pagina)}`;

export interface Destino {
  /** El ancla a la que hay que ir. */
  id: string;
  seccion: string;
  pagina?: string | undefined;
}

/**
 * Qué lugar nombra una dirección `?pestana=…&pagina=…`. Una página que la sección
 * no tiene se ignora y se va a la sección; una sección desconocida, a ninguna.
 */
export function destinoDe(pestana: string | null, pagina: string | null): Destino | null {
  if (!pestana) return null;
  const seccion = SITE.find((s) => slug(s.label) === slug(pestana));
  if (!seccion) return null;
  const hallada = pagina ? seccion.pages.find((p) => slug(p.label) === slug(pagina)) : undefined;
  return hallada
    ? {
        id: idDePagina(seccion.label, hallada.label),
        seccion: seccion.label,
        pagina: hallada.label,
      }
    : { id: idDeSeccion(seccion.label), seccion: seccion.label };
}

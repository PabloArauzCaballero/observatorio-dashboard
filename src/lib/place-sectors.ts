import type { IconName } from '@/components/icons';

/**
 * El rubro económico de un lugar, que la fuente no publica.
 *
 * El registro de lugares llega con dos etiquetas —`entity_group` y
 * `entity_family`— y con ninguna de las dos se puede preguntar «cuánto comercio
 * hay en esta ciudad». Medido sobre Santa Cruz el 2026-09-21, sobre 18.614
 * lugares reales:
 *
 * - `entity_group` tiene **68 valores**, y están a medio traducir: `SALUD`
 *   (1.334) convive con `HEALTH_CARE` (570), `EDUCACION` (810) con `EDUCATION`
 *   (179), `COMERCIO` (663) con `SHOPPING` (277), `GOBIERNO` (195) con
 *   `COMMUNITY_AND_GOVERNMENT` (189). El mismo rubro partido en dos idiomas
 *   aparece como dos rubros distintos y ninguno de los dos suma lo que es.
 * - Hay grupos compuestos —`COMERCIO_CONSTRUCCION`, `SALUD_COMERCIO`,
 *   `COMERCIO_TECNOLOGIA`, `FINANZAS_COMERCIO`— que reparten un rubro entre
 *   varias cajas de tres dígitos.
 * - Y el rubro que un lector busca puede estar **enterrado en la familia**, no
 *   en el grupo: las 320 inmobiliarias están dentro de `SERVICIOS_PROFESIONALES`,
 *   junto a abogados y publicistas.
 *
 * De ahí que el panel se viera «incompleto»: los rubros estaban en el dato y no
 * había forma de pedirlos. Esta tabla los reconstruye.
 *
 * Se resuelve **primero por familia y después por grupo**, porque la familia es
 * la etiqueta específica y el grupo la genérica: preguntar primero por el grupo
 * mandaría las inmobiliarias a «Servicios» y el rubro volvería a desaparecer.
 *
 * Es una derivación del tablero, no un dato de la fuente, y se dice donde se
 * muestra. Vive aquí y no en la base porque la correspondencia es un criterio
 * editorial que se va a discutir: cambiarla debe costar una línea, no una
 * migración.
 */

export type PlaceSector =
  | 'GASTRONOMIA'
  | 'COMERCIO'
  | 'SALUD'
  | 'SERVICIOS'
  | 'INMOBILIARIO'
  | 'CONSTRUCCION'
  | 'EDUCACION'
  | 'AUTOMOTOR'
  | 'BELLEZA'
  | 'TRANSPORTE'
  | 'FINANCIERO'
  | 'INDUSTRIA'
  | 'AGRO'
  | 'HOSPEDAJE'
  | 'CULTURA'
  | 'PUBLICO'
  | 'TELECOMUNICACIONES'
  | 'SIN_CLASIFICAR';

export const SECTOR_LABEL: Record<PlaceSector, string> = {
  GASTRONOMIA: 'Gastronomía',
  COMERCIO: 'Comercio',
  SALUD: 'Salud',
  SERVICIOS: 'Servicios',
  INMOBILIARIO: 'Inmobiliario',
  CONSTRUCCION: 'Construcción',
  EDUCACION: 'Educación',
  AUTOMOTOR: 'Automotor',
  BELLEZA: 'Belleza y bienestar',
  TRANSPORTE: 'Transporte y logística',
  FINANCIERO: 'Financiero',
  INDUSTRIA: 'Industria',
  AGRO: 'Agro',
  HOSPEDAJE: 'Hospedaje y turismo',
  CULTURA: 'Cultura, ocio y deporte',
  PUBLICO: 'Público y comunidad',
  TELECOMUNICACIONES: 'Telecomunicaciones',
  SIN_CLASIFICAR: 'Sin clasificar',
};

export const SECTOR_ICON: Record<PlaceSector, IconName> = {
  GASTRONOMIA: 'tienda',
  COMERCIO: 'cajas',
  SALUD: 'corazon',
  SERVICIOS: 'maletin',
  INMOBILIARIO: 'edificio',
  CONSTRUCCION: 'casco',
  EDUCACION: 'hoja',
  AUTOMOTOR: 'camion',
  BELLEZA: 'gema',
  TRANSPORTE: 'camion',
  FINANCIERO: 'banco',
  INDUSTRIA: 'fabrica',
  AGRO: 'espiga',
  HOSPEDAJE: 'reloj',
  CULTURA: 'globo',
  PUBLICO: 'personas',
  TELECOMUNICACIONES: 'chip',
  SIN_CLASIFICAR: 'cajas',
};

/**
 * Familias que deciden el rubro por sí solas.
 *
 * Solo las que su grupo mandaría a un rubro equivocado. No es un catálogo de
 * las 153 familias: una familia que el grupo ya coloca bien no necesita
 * entrada, y tenerla duplicaría el criterio en dos sitios.
 */
const SECTOR_BY_FAMILY: Record<string, PlaceSector> = {
  INMOBILIARIA: 'INMOBILIARIO',
  CONSTRUCTORA: 'CONSTRUCCION',
  ARQUITECTURA_INGENIERIA: 'CONSTRUCCION',
  MATERIALES_CONSTRUCCION: 'CONSTRUCCION',
  FERRETERIA: 'CONSTRUCCION',
  FABRICA_PLANTA: 'INDUSTRIA',
  INDUSTRIAL_SUMINISTROS: 'INDUSTRIA',
  AGROPECUARIA_INSUMOS: 'AGRO',
  COOPERATIVA_FINANCIERA: 'FINANCIERO',
  CASA_CAMBIO: 'FINANCIERO',
  CAJERO_ATM: 'FINANCIERO',
  REMESAS_PAGOS: 'FINANCIERO',
  CASA_EMPENO: 'FINANCIERO',
  SOFTWARE_TI: 'TELECOMUNICACIONES',
};

/**
 * El rubro de cada grupo, incluidos los que la fuente dejó en inglés.
 *
 * Los pares que dicen lo mismo en dos idiomas caen en el mismo rubro, que es
 * todo el arreglo: `SALUD` y `HEALTH_CARE` vuelven a ser un número.
 */
const SECTOR_BY_GROUP: Record<string, PlaceSector> = {
  GASTRONOMIA: 'GASTRONOMIA',
  GASTRONOMIA_ENTRETENIMIENTO: 'GASTRONOMIA',
  FOOD_AND_DRINK: 'GASTRONOMIA',
  COMERCIO_ALIMENTOS: 'GASTRONOMIA',

  COMERCIO: 'COMERCIO',
  SHOPPING: 'COMERCIO',
  COMERCIO_TECNOLOGIA: 'COMERCIO',
  COMERCIO_HOGAR: 'COMERCIO',
  COMERCIO_MASCOTAS: 'COMERCIO',
  COMERCIO_DEPORTE: 'COMERCIO',
  COMERCIO_EDUCACION: 'COMERCIO',
  SALUD_COMERCIO: 'COMERCIO',
  // Sesenta y dos de sus sesenta y siete lugares son tiendas de bicicletas, y
  // el resto concesionarias: venden, no transportan.
  COMERCIO_TRANSPORTE: 'COMERCIO',

  SALUD: 'SALUD',
  HEALTH_CARE: 'SALUD',
  SALUD_ANIMAL: 'SALUD',
  SALUD_INDUSTRIA: 'SALUD',
  SALUD_SOCIAL: 'SALUD',

  SERVICIOS: 'SERVICIOS',
  SERVICIOS_PROFESIONALES: 'SERVICIOS',
  SERVICIOS_PERSONALES: 'SERVICIOS',
  SERVICIOS_TECNICOS: 'SERVICIOS',
  SERVICIOS_BASICOS: 'SERVICIOS',
  LIFESTYLE_SERVICES: 'SERVICIOS',

  SERVICIOS_TECNOLOGIA: 'TELECOMUNICACIONES',
  TELECOMUNICACIONES: 'TELECOMUNICACIONES',

  COMERCIO_CONSTRUCCION: 'CONSTRUCCION',

  EDUCACION: 'EDUCACION',
  EDUCATION: 'EDUCACION',
  EDUCACION_CULTURA: 'EDUCACION',
  EDUCACION_DEPORTE: 'EDUCACION',
  EDUCACION_CIENCIA: 'EDUCACION',

  AUTOMOTOR: 'AUTOMOTOR',

  BELLEZA: 'BELLEZA',
  BELLEZA_BIENESTAR: 'BELLEZA',

  TRANSPORTE: 'TRANSPORTE',
  TRAVEL_AND_TRANSPORTATION: 'TRANSPORTE',
  LOGISTICA: 'TRANSPORTE',
  ENERGIA_TRANSPORTE: 'TRANSPORTE',

  FINANZAS: 'FINANCIERO',
  FINANZAS_COMERCIO: 'FINANCIERO',
  SEGUROS: 'FINANCIERO',

  INDUSTRIA: 'INDUSTRIA',
  INDUSTRIA_COMERCIO: 'INDUSTRIA',
  COMERCIO_INDUSTRIAL: 'INDUSTRIA',

  COMERCIO_AGRO: 'AGRO',

  HOSPEDAJE: 'HOSPEDAJE',
  TURISMO: 'HOSPEDAJE',

  CULTURA: 'CULTURA',
  CULTURA_ENTRETENIMIENTO: 'CULTURA',
  ENTRETENIMIENTO: 'CULTURA',
  ARTS_AND_ENTERTAINMENT: 'CULTURA',
  DEPORTE: 'CULTURA',
  SPORTS_AND_RECREATION: 'CULTURA',
  MEDIOS: 'CULTURA',
  MEDIOS_ENTRETENIMIENTO: 'CULTURA',

  GOBIERNO: 'PUBLICO',
  GOBIERNO_DIPLOMACIA: 'PUBLICO',
  COMMUNITY_AND_GOVERNMENT: 'PUBLICO',
  ESPACIO_PUBLICO: 'PUBLICO',
  RELIGION: 'PUBLICO',
  ORGANIZACIONES: 'PUBLICO',
  COMUNIDAD: 'PUBLICO',
  JUSTICIA: 'PUBLICO',
  SEGURIDAD_PUBLICA: 'PUBLICO',
  GEOGRAPHIC_ENTITIES: 'PUBLICO',

  /*
   * Residuo declarado. Los cuatro caen aquí porque su familia es literalmente
   * «otra entidad»: no son un rubro mal traducido, son lugares que la fuente no
   * clasificó. Son 5.159 de 18.614 en Santa Cruz —más de un cuarto— y el panel
   * lo dice en vez de repartirlos entre rubros plausibles.
   */
  OTRA_ENTIDAD: 'SIN_CLASIFICAR',
  OTROS: 'SIN_CLASIFICAR',
  SERVICES_AND_BUSINESS: 'SIN_CLASIFICAR',
  CULTURAL_AND_HISTORIC: 'SIN_CLASIFICAR',
};

/**
 * El rubro de un lugar, por su familia y su grupo.
 *
 * Lo que no encaja queda en `SIN_CLASIFICAR` y no en el rubro más parecido: un
 * residuo que se ve es un dato sobre la cobertura de la fuente, y repartirlo lo
 * convertiría en ruido dentro de rubros que dirían tener más de lo que tienen.
 */
export function sectorOf(entityGroup: string, entityFamily: string): PlaceSector {
  return SECTOR_BY_FAMILY[entityFamily] ?? SECTOR_BY_GROUP[entityGroup] ?? 'SIN_CLASIFICAR';
}

export interface SectorTally {
  sector: PlaceSector;
  label: string;
  icon: IconName;
  places: number;
  regulated: number;
  /** Las familias que componen el rubro, que es como se filtra. */
  families: string[];
}

/**
 * Los rubros de una selección, con lo que cada uno contiene.
 *
 * Devuelve también las familias porque el filtro del panel recorta por familia:
 * pedir un rubro es pedir sus familias, así que no hace falta ni una consulta
 * nueva ni una columna nueva en la base para que el lector pueda pedirlo.
 *
 * `SIN_CLASIFICAR` va siempre al final por grande que sea, por la misma razón
 * que el resto de las listas del informe lo hacen: es el residuo, no el titular.
 */
export function tallySectors(
  rows: ReadonlyArray<{
    entityGroup: string;
    entityFamily: string;
    places: number;
    regulated: number;
  }>,
): SectorTally[] {
  const held = new Map<PlaceSector, SectorTally>();
  for (const row of rows) {
    const sector = sectorOf(row.entityGroup, row.entityFamily);
    const entry = held.get(sector) ?? {
      sector,
      label: SECTOR_LABEL[sector],
      icon: SECTOR_ICON[sector],
      places: 0,
      regulated: 0,
      families: [],
    };
    entry.places += row.places;
    entry.regulated += row.regulated;
    if (!entry.families.includes(row.entityFamily)) entry.families.push(row.entityFamily);
    held.set(sector, entry);
  }
  return [...held.values()].sort((left, right) => {
    if (left.sector === 'SIN_CLASIFICAR') return 1;
    if (right.sector === 'SIN_CLASIFICAR') return -1;
    return right.places - left.places;
  });
}

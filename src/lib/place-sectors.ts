import type { IconName } from '@/components/icons';
import { CUISINE_KEYS, syntheticRestaurantFamily } from './restaurant-cuisine';

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
 *
 * ## El sub-rubro
 *
 * Entre el rubro y la familia faltaba un escalón. «Gastronomía» son noventa
 * familias en el dato nacional, y quien abre el rubro no quiere noventa filas:
 * quiere «Pizzerías», «Pollerías», «Cafeterías». El catálogo de 2.330 familias
 * del núcleo es plano —ninguna trae `parent_family` ni `refines`, solo
 * `group`—, así que ese escalón tampoco viene de la fuente y se deriva aquí, de
 * la familia:
 *
 * 1. El rubro fija la lista de reglas ({@link SUBSECTOR_RULES}); el sub-rubro
 *    afina el rubro, nunca lo cambia.
 * 2. Una tabla corta de excepciones por familia ({@link SUBSECTOR_BY_FAMILY})
 *    decide antes que los patrones.
 * 3. Después, la **primera** regla cuyo patrón encaja con el código de la
 *    familia. Por eso lo específico va antes que lo genérico: `PIZZA` se prueba
 *    antes que `RESTAURANT`, `ANIMAL` antes que `HOSPITAL`.
 * 4. Lo que no encaja en ninguna cae en «Otros de <rubro>», **no** en «sin
 *    clasificar»: la familia ya dijo a qué rubro pertenece y lo único que no
 *    sabe decir es el matiz. Un residuo por rubro que se ve dice además qué
 *    familias le faltan al catálogo.
 *
 * Cada familia cae en un solo sub-rubro. Algunos sub-rubros se agrupan bajo un
 * nodo intermedio ({@link SUBSECTOR_GROUPS}) cuando el lector los piensa juntos:
 * «Restaurantes» abre en Pizzerías, Hamburgueserías, Pollerías, Comida
 * boliviana… El grupo no es otra clasificación, es la suma de sus hijos.
 *
 * El reparto medido sobre Santa Cruz de la Sierra está junto a
 * {@link tallySectors}, que es quien lo calcula.
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
 * las familias: una familia que el grupo ya coloca bien no necesita entrada, y
 * tenerla duplicaría el criterio en dos sitios.
 *
 * Las de Overture (`OV_…`) entran por lo mismo que las nativas: la fuente las
 * archiva bajo `SERVICIOS_PROFESIONALES`, `COMERCIO` o `INDUSTRIA` y el nombre
 * dice otra cosa —una constructora es construcción aunque venda un servicio, y
 * una granja es agro aunque produzca.
 */
const SECTOR_BY_FAMILY: Record<string, PlaceSector> = {
  /*
   * Los dos cajones de sastre, sea cual sea el grupo que los archivó.
   *
   * `OTRA_ENTIDAD` cuelga de nueve grupos —salud, comercio, transporte…— y el
   * filtro solo sabe pedir familias: «Otros de Salud» pedía `OTRA_ENTIDAD` y el
   * mapa dibujaba las 4.797 de la ciudad entera, no las 616 que la fila decía.
   * Un número al lado de un rubro tiene que ser el número que el mapa dibuja al
   * pulsarlo, y eso solo se cumple si cada familia vive en un único rubro.
   */
  OTRA_ENTIDAD: 'SIN_CLASIFICAR',
  OV_SERVICES_AND_BUSINESS: 'SIN_CLASIFICAR',

  INMOBILIARIA: 'INMOBILIARIO',
  OV_REAL_ESTATE_AGENT: 'INMOBILIARIO',
  OV_COMMERCIAL_REAL_ESTATE: 'INMOBILIARIO',
  OV_PROPERTY_MANAGEMENT: 'INMOBILIARIO',
  OV_REAL_ESTATE_INVESTMENT: 'INMOBILIARIO',

  CONSTRUCTORA: 'CONSTRUCCION',
  ARQUITECTURA_INGENIERIA: 'CONSTRUCCION',
  MATERIALES_CONSTRUCCION: 'CONSTRUCCION',
  FERRETERIA: 'CONSTRUCCION',
  OV_BUILDING_OR_CONSTRUCTION_SERVICE: 'CONSTRUCCION',
  OV_CONTRACTOR: 'CONSTRUCCION',
  OV_HOME_DEVELOPER: 'CONSTRUCCION',
  OV_ARCHITECTURAL_DESIGNER: 'CONSTRUCCION',
  OV_LAND_SURVEYING: 'CONSTRUCCION',
  OV_LUMBER_STORE: 'CONSTRUCCION',
  OV_METAL_SUPPLIER: 'CONSTRUCCION',
  OV_GRANITE_SUPPLIER: 'CONSTRUCCION',
  OV_ELECTRICAL_SUPPLY_STORE: 'CONSTRUCCION',
  OV_PAINT_STORE: 'CONSTRUCCION',
  OV_HOME_IMPROVEMENT_STORE: 'CONSTRUCCION',
  OV_HARDWARE_HOME_AND_GARDEN_STORE: 'CONSTRUCCION',

  FABRICA_PLANTA: 'INDUSTRIA',
  INDUSTRIAL_SUMINISTROS: 'INDUSTRIA',
  // Fabrica medicamentos: es industria aunque su grupo diga salud.
  LABORATORIO_FARMACEUTICO: 'INDUSTRIA',

  AGROPECUARIA_INSUMOS: 'AGRO',
  OV_FARM: 'AGRO',
  OV_DAIRY_FARM: 'AGRO',
  OV_POULTRY_FARM: 'AGRO',
  OV_AGRICULTURAL_SERVICE: 'AGRO',

  COOPERATIVA_FINANCIERA: 'FINANCIERO',
  CASA_CAMBIO: 'FINANCIERO',
  CAJERO_ATM: 'FINANCIERO',
  REMESAS_PAGOS: 'FINANCIERO',
  CASA_EMPENO: 'FINANCIERO',

  SOFTWARE_TI: 'TELECOMUNICACIONES',
  OV_TELECOMMUNICATIONS_COMPANY: 'TELECOMUNICACIONES',
  OV_INTERNET_SERVICE_PROVIDER: 'TELECOMUNICACIONES',
  OV_TELEVISION_SERVICE_PROVIDER: 'TELECOMUNICACIONES',
  OV_INFORMATION_TECHNOLOGY_COMPANY: 'TELECOMUNICACIONES',
  OV_WEB_HOSTING_SERVICE: 'TELECOMUNICACIONES',
  OV_COMPUTER_HARDWARE_COMPANY: 'TELECOMUNICACIONES',

  OV_TRUCK_DEALER: 'AUTOMOTOR',
  OV_USED_AUTO_DEALER: 'AUTOMOTOR',
  OV_COMMERCIAL_VEHICLE_DEALER: 'AUTOMOTOR',

  OV_DAY_CARE_PRESCHOOL: 'EDUCACION',

  /*
   * El pan, las tortas y la pizza a domicilio se archivan en el mismo grupo que
   * los abarrotes (`COMERCIO_ALIMENTOS`), pero quien busca una panadería la
   * busca junto a las cafeterías y no junto a los supermercados.
   */
  PANADERIA_PASTELERIA: 'GASTRONOMIA',
  OV_PATISSERIE_CAKE_SHOP: 'GASTRONOMIA',
  OV_CUSTOM_CAKES_SHOP: 'GASTRONOMIA',
  OV_PIZZA_DELIVERY_SERVICE: 'GASTRONOMIA',

  /*
   * Las familias sintéticas de `/api/familias`: la cocina que
   * `restaurant-cuisine.ts` le lee al nombre de un `RESTAURANTE` sin
   * especialidad declarada. No son un código del catálogo del núcleo — son un
   * `RESTAURANTE` de siempre, partido en el tablero — así que el rubro es el
   * mismo que el de cualquier restaurante.
   */
  ...Object.fromEntries(
    CUISINE_KEYS.map((cuisine) => [syntheticRestaurantFamily(cuisine), 'GASTRONOMIA' as const]),
  ),
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

  COMERCIO: 'COMERCIO',
  SHOPPING: 'COMERCIO',
  COMERCIO_TECNOLOGIA: 'COMERCIO',
  COMERCIO_HOGAR: 'COMERCIO',
  COMERCIO_MASCOTAS: 'COMERCIO',
  COMERCIO_DEPORTE: 'COMERCIO',
  COMERCIO_EDUCACION: 'COMERCIO',
  /*
   * Supermercados, minimarkets, abarrotes y mercados. Estaban en Gastronomía
   * hasta el 2026-09-23: 269 lugares de Santa Cruz y 4.422 del país que no dan
   * de comer, venden. Quien pregunta «cuánta gastronomía hay» quiere los
   * restaurantes; quien pregunta «cuánto comercio», también los supermercados.
   * Las panaderías vuelven a Gastronomía por familia (arriba).
   */
  COMERCIO_ALIMENTOS: 'COMERCIO',
  // Sesenta y dos de sus sesenta y siete lugares son tiendas de bicicletas, y
  // el resto concesionarias: venden, no transportan.
  COMERCIO_TRANSPORTE: 'COMERCIO',

  SALUD: 'SALUD',
  HEALTH_CARE: 'SALUD',
  SALUD_ANIMAL: 'SALUD',
  SALUD_INDUSTRIA: 'SALUD',
  SALUD_SOCIAL: 'SALUD',
  /*
   * Farmacias, ópticas e insumos médicos. Hasta el 2026-09-23 iban a Comercio
   * —venden— y eran 994 lugares de Santa Cruz (7.906 en el país) que nadie
   * encontraba al abrir «Salud», que es donde cualquiera busca una farmacia. Un rubro es la
   * pregunta que hace el lector, no el papel que la fuente le dio al local.
   */
  SALUD_COMERCIO: 'SALUD',

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
   *
   * Desde el 2026-09-23 el residuo también recoge las `OTRA_ENTIDAD` que otros
   * grupos archivaban (ver `SECTOR_BY_FAMILY`): 7.830 de 21.341 en Santa Cruz.
   * No crece porque haya menos rubros, sino porque ahora dice lo que el mapa
   * dibuja.
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

/* Sub-rubros ------------------------------------------------------------- */

/** La clave del sub-rubro que recoge lo que ninguna regla del rubro nombró. */
export const OTHERS = 'OTROS';

interface SubsectorRule {
  key: string;
  label: string;
  /** Sobre el código de la familia, tal como lo escribe el catálogo. */
  match: RegExp;
  /** El nodo de {@link SUBSECTOR_GROUPS} bajo el que se despliega, si hay uno. */
  group?: string;
}

/**
 * Los nodos que agrupan sub-rubros hermanos, por rubro.
 *
 * Solo uno por ahora, y es el que pidió el lector: «Restaurantes» tiene que
 * abrirse en pizzerías, hamburgueserías y pollerías, que son restaurantes.
 * Comida rápida, cafeterías y bares quedan fuera a propósito: no son un tipo
 * de restaurante sino otro tipo de local.
 */
const SUBSECTOR_GROUPS: Partial<Record<PlaceSector, Record<string, string>>> = {
  GASTRONOMIA: { RESTAURANTES: 'Restaurantes' },
};

/**
 * Las reglas de cada rubro, en el orden en que se prueban.
 *
 * Una familia cae en el primer sub-rubro cuya expresión encaja con su código,
 * así que dentro de cada lista lo específico va antes que lo genérico:
 * `OV_PIZZA_RESTAURANT` es pizzería y no «otras cocinas» porque `PIZZA` se
 * prueba antes que `RESTAURANT`; `OV_ANIMAL_HOSPITAL` es veterinaria porque
 * `ANIMAL` se prueba antes que `HOSPITAL`. Cambiar el orden cambia el reparto.
 *
 * Las expresiones cubren el código nativo (`HELADERIA`) y el de Overture
 * (`OV_GELATO_SHOP`), que es por lo que casi todas llevan las dos lenguas.
 */
const SUBSECTOR_RULES: Record<PlaceSector, SubsectorRule[]> = {
  GASTRONOMIA: [
    { key: 'PIZZERIAS', label: 'Pizzerías', group: 'RESTAURANTES', match: /PIZZA/ },
    { key: 'HAMBURGUESERIAS', label: 'Hamburgueserías', group: 'RESTAURANTES', match: /BURGER/ },
    { key: 'POLLERIAS', label: 'Pollerías', group: 'RESTAURANTES', match: /CHICKEN/ },
    {
      key: 'COMIDA_BOLIVIANA',
      label: 'Comida boliviana',
      group: 'RESTAURANTES',
      match: /BOLIVIAN|SALTENERIA|PENSION_COMIDAS|EMPANADA/,
    },
    {
      key: 'PARRILLAS',
      label: 'Parrillas y carnes',
      group: 'RESTAURANTES',
      match: /BARBECUE|STEAKHOUSE|MEAT_RESTAURANT|BAR_AND_GRILL|ROTISSERIE|VENISON|WILD_GAME/,
    },
    {
      key: 'COMIDA_ASIATICA',
      label: 'Comida asiática',
      group: 'RESTAURANTES',
      match:
        /CHINESE|JAPANESE|SUSHI|ASIAN|THAI|KOREAN|VIETNAMESE|RAMEN|WOK|DIM_SUM|DUMPLING|BAOZI|INDIAN|SICHUAN|CANTONESE|SHANGHAINESE|BEIJING|HUNAN|FUJIAN|JIANGSU|SHANDONG|DONGBEI|XINJIANG|TAIWANESE|HONG_KONG|MONGOLIAN|TIBETAN|HIMALAYAN|NEPALESE|BURMESE|CAMBODIAN|LAOTIAN|FILIPINO|INDONESIAN|MALAYSIAN|SINGAPOREAN|SRI_LANKAN|BANGLADESHI|PAKISTANI|PUNJABI|GUJARATI|BENGALI|HYDERABADI|CHETTINAD|RAJASTHANI|SUNDANESE|NASI_|POKE|BUBBLE_TEA/,
    },
    {
      key: 'COMIDA_RAPIDA',
      label: 'Comida rápida',
      match:
        /COMIDA_RAPIDA|FAST_FOOD|FOOD_COURT|FOOD_TRUCK|SANDWICH|HOT_DOG|TACO|WRAP_|KEBAB|FALAFEL|FRITERIE|CASUAL_EATERY|DINER|SALAD_BAR|POUTINE|FISH_AND_CHIPS/,
    },
    {
      key: 'CAFETERIAS',
      label: 'Cafeterías',
      match: /CAFE|COFFEE|TEA_ROOM|SMOOTHIE|JUICE|MILK_BAR|MILKSHAKE|KOMBUCHA|NON_ALCOHOLIC/,
    },
    {
      key: 'PANADERIAS',
      label: 'Panaderías y pastelerías',
      match:
        /PANADERIA|BAKERY|PASTELERIA|PATISSERIE|CAKE|DONUT|BAGEL|BAGUETTE|PRETZEL|PIE_SHOP|DESSERT|CHOCOLAT|CANDY|MACARON|CONFECTIONERY|SWEETS|WAFFLE|PANCAKE|FLATBREAD|SUGAR_SHACK|POPCORN/,
    },
    {
      key: 'HELADERIAS',
      label: 'Heladerías',
      match: /HELADERIA|GELATO|ICE_CREAM|FROZEN_YOGURT|SHAVED_ICE|ACAI/,
    },
    {
      key: 'BARES',
      label: 'Bares y pubs',
      match:
        /BAR_PUB|CHICHERIA|_BAR$|PUB$|BREWERY|BEER|WINERY|WINE|DISTILLERY|CIDERY|LOUNGE|SPEAKEASY|ALCOHOLIC_BEVERAGE|BAR_TABAC|SUPPER_CLUB|TIKI/,
    },
    {
      key: 'RESTAURANTES_GENERAL',
      label: 'Restaurantes sin especialidad',
      group: 'RESTAURANTES',
      match: /^RESTAURANTE$/,
    },
    {
      key: 'OTRAS_COCINAS',
      label: 'Otras cocinas',
      group: 'RESTAURANTES',
      match: /RESTAURANT|BISTRO|BRASSERIE|SOUL_FOOD|BUFFET|CANTEEN/,
    },
  ],

  COMERCIO: [
    {
      key: 'SUPERMERCADOS',
      label: 'Supermercados y abarrotes',
      match:
        /SUPERMERCADO|MINIMARKET|ABARROTES|^MERCADO$|GROCER|FOOD_AND_BEVERAGE_STORE|WAREHOUSE_CLUB|FARMERS_MARKET|FLEA_MARKET|KIOSK|CONVENIENCE|DISTRIBUIDOR_ALIMENTOS|SPECIALTY_FOODS|IMPORTED_FOOD|FROZEN_FOODS|MAYORISTA|WHOLESALE/,
    },
    {
      key: 'ALIMENTOS',
      label: 'Carnicerías, bebidas y alimentos',
      match:
        /CARNICERIA|FRUTAS|BEBIDAS|LIQUOR|BEER_WINE|DAIRY_STORE|CHEESE|FISHMONGER|SEAFOOD_MARKET|HEALTH_FOOD_STORE|VITAMIN|HERB_AND_SPICE|HONEY|OLIVE|PASTA_STORE|RICE_STORE|WATER_STORE|TOBACCO|SMOKE_AND_VAPE|COFFEE_AND_TEA_SUPPLIES|BREWING_SUPPLY|MEAT_WHOLESALER|SMOKEHOUSE|CSA_FARM|PICK_YOUR_OWN|BUTCHER/,
    },
    {
      key: 'ROPA',
      label: 'Ropa y calzado',
      match:
        /ROPA|CALZADO|CLOTHING|APPAREL|FASHION|BOUTIQUE|LINGERIE|SPORTSWEAR|SHOE|HANDBAG|HAT_STORE|COSTUME|BABY_GEAR|BRIDAL|UNIFORM|FABRIC/,
    },
    {
      key: 'TECNOLOGIA',
      label: 'Tecnología y electrónica',
      match:
        /ELECTRONICA|CELULAR|COMPUTACION|COMPUTER|ELECTRONIC|MOBILE_PHONE|VIDEO_GAME|CAR_STEREO|AUDIO_VISUAL|CAMERA|APPLIANCE|ELECTRODOMESTICOS/,
    },
    {
      key: 'HOGAR',
      label: 'Hogar, muebles y jardín',
      match:
        /MUEBLES|HOME_GOODS|HOME_DECOR|FURNITURE|MATTRESS|LIGHTING|CARPET|WINDOW_TREATMENT|KITCHEN|BED_AND_BATH|VIVERO|JARDINERIA|GARDEN|NURSERY|HOUSEWARE/,
    },
    {
      key: 'LIBRERIAS',
      label: 'Librerías y papelerías',
      match:
        /LIBRERIA|PAPELERIA|BOOK|NEWSPAPER|MAGAZINE|STATIONERY|EDUCATIONAL_SUPPLY|COMIC|OFFICE_SUPPLY/,
    },
    {
      key: 'COSMETICA',
      label: 'Cosmética y perfumería',
      match: /COSMETICOS|PERFUMERIA|BEAUTY_SUPPLY|COSMETIC|HAIR_SUPPLY|PERFUME/,
    },
    {
      key: 'DEPORTES_JUGUETES',
      label: 'Deportes, juguetes y hobbies',
      match:
        /DEPORTES|SPORTING|OUTDOOR_STORE|BICICLETAS|BIKE|JUGUETERIA|TOY|HOBBY|ARTS_CRAFTS|HUNTING|SKATE_STORE|MUSICAL_INSTRUMENT|MUSIC_AND_DVD|GAME_STORE/,
    },
    {
      key: 'REGALOS',
      label: 'Joyerías, regalos y flores',
      match:
        /JOYERIA|JEWEL|WATCH|REGALOS|GIFT|FLORERIA|FLOWER|FLORIST|SOUVENIR|PARTY_SUPPLY|CANDLE/,
    },
    { key: 'MASCOTAS', label: 'Tiendas de mascotas', match: /MASCOTAS|PET_STORE|AQUATIC_PET/ },
    {
      key: 'TIENDAS_GENERALES',
      label: 'Centros comerciales y grandes tiendas',
      match:
        /CENTRO_COMERCIAL|TIENDA_DEPARTAMENTOS|DEPARTMENT_STORE|SHOPPING_MALL|SHOPPING_CENTER|SEGUNDA_MANO|THRIFT|SECOND_HAND|POP_UP_STORE|AUCTION|VENDING|VARIETY|DOLLAR_STORE/,
    },
  ],

  SALUD: [
    {
      key: 'VETERINARIAS',
      label: 'Veterinarias y mascotas',
      match: /VETERINARI|ANIMAL|PET_|EQUINE|HORSE|FARRIER|DOG_|AQUARIUM_SERVICE/,
    },
    { key: 'FARMACIAS', label: 'Farmacias', match: /FARMACIA|PHARMAC|DRUGSTORE|DRUG_STORE/ },
    {
      key: 'INSUMOS',
      label: 'Insumos médicos',
      match: /INSUMOS_MEDICOS|MEDICAL_SUPPLY|DENTAL_SUPPLY|HEARING_AID|SURGICAL_APPLIANCES/,
    },
    {
      key: 'ODONTOLOGIA',
      label: 'Odontología',
      match:
        /ODONTOLOGIA|DENTIST|DENTAL|ORTHODONT|ENDODONT|PERIODONT|PROSTHODONT|MAXILLOFACIAL|TEETH/,
    },
    {
      key: 'OPTICAS',
      label: 'Ópticas y oftalmología',
      match: /OPTICA|OFTALMOLOGIA|OPTOMETR|EYE_CARE|VISION|RETINA|LASIK|OPTICAL/,
    },
    {
      key: 'LABORATORIOS',
      label: 'Laboratorios y diagnóstico',
      match:
        /LABORATORIO|LABORATORY|DIAGNOSTIC|IMAGEN|IMAGING|RADIOLOGY|ULTRASOUND|PATHOLOGY|ENDOSCOPY|PATERNITY|BANCO_SANGRE|BLOOD/,
    },
    {
      key: 'HOSPITALES',
      label: 'Hospitales y clínicas',
      match:
        /HOSPITAL|CLINICA|CLINIC|CENTRO_SALUD|EMERGENCY|URGENT_CARE|SURGERY_CENTER|MATERNITY|HOSPICE|DIALISIS|DIALYSIS|PUBLIC_HEALTH|MEDICAL_CENTER/,
    },
    {
      key: 'SALUD_MENTAL',
      label: 'Psicología y salud mental',
      match:
        /PSICOLOGIA|PSYCH|COUNSELING|ADDICTION|CRISIS|SUICIDE|HYPNO|EATING_DISORDER|SEX_THERAPY|ART_THERAPY|BEHAVIOR|STRESS_MANAGEMENT/,
    },
    {
      key: 'FISIOTERAPIA',
      label: 'Fisioterapia y rehabilitación',
      match:
        /FISIOTERAPIA|REHABILITA|PHYSICAL|CHIROPRACT|OSTEOPATH|PODIATR|ORTHOTIC|PROSTHETIC|SPEECH|OCCUPATIONAL_THERAPY|MUSCULOSKELETAL|SPORTS_MEDICINE|ACUPUNCTURE|REFLEXOLOGY|TUI_NA|PSYCHOMOTOR/,
    },
    {
      key: 'CONSULTORIOS',
      label: 'Consultorios y especialidades',
      match:
        /CONSULTORIO|MEDIC|SURG|OLOGY|PEDIATRIC|PRACTICE|GYNECOLOGY|OBSTETRICS|ORTHOPEDIC|DERMAT|NURSING|MIDWIFERY|DOULA|LACTATION|FERTILITY|SPERM|WOMENS_CARE|PERINATAL|PRENATAL|NUTRITION|HOME_HEALTH|EAR_NOSE|ANESTHESI|AESTHETIC|PLASTIC|BODY_CONTOURING|SKIN_CARE|TATTOO_REMOVAL|HOMEOPATH|NATUROPATH|AYURVEDA|ALTERNATIVE|AROMATHERAPY|REIKI|SOPHROLOGY|SLEEP|PAIN_MANAGEMENT|GENETICS|INFECTIOUS|ALLERGY|DONOR|AMBULANCE|EMS_/,
    },
  ],

  SERVICIOS: [
    {
      key: 'JURIDICOS',
      label: 'Abogados y notarías',
      match: /ABOGADO|NOTARIA|NOTARY|_LAW$|_LAW_|ATTORNEY|LEGAL/,
    },
    {
      key: 'CONSULTORIA',
      label: 'Consultoría, contabilidad y oficinas',
      match:
        /CONTABILIDAD|AUDITORIA|ACCOUNT|CONSULTORIA|CONSULTANT|RECURSOS_HUMANOS|HUMAN_RESOURCE|COWORKING|CORPORATE|BUSINESS_OFFICE|PROFESSIONAL_SERVICE|APPRAISAL|TRANSLAT/,
    },
    {
      key: 'EMPRESAS',
      label: 'Servicios a empresas e industria',
      match:
        /B2B|INDUSTRIAL_COMPANY|COMMERCIAL_INDUSTRIAL|MACHINE_SHOP|CHEMICAL_PLANT|PLASTICS|AUTO_COMPANY|OCCUPATIONAL_SAFETY|MERCHANDISING|AUTOMATION|FREIGHT|CLOTHING_COMPANY/,
    },
    {
      key: 'IMPRENTAS',
      label: 'Imprentas y fotocopias',
      match: /IMPRENTA|FOTOCOPIA|PRINTING|COPY|SIGN_MAKING/,
    },
    {
      key: 'PUBLICIDAD',
      label: 'Publicidad, fotografía y diseño',
      match:
        /PUBLICIDAD|MARKETING|FOTOGRAFIA|PHOTOGRAPH|GRAPHIC|WEB_DESIGN|INTERIOR_DESIGN|MEDIA_AGENCY|IMAGE_CONSULTANT|ADVERTIS/,
    },
    {
      key: 'EVENTOS',
      label: 'Eventos y fiestas',
      match: /EVENTOS|EVENT|PARTY|WEDDING|BARTENDER|KIDS_RECREATION|CATERING/,
    },
    {
      key: 'PERSONALES',
      label: 'Lavanderías, costura y limpieza',
      match:
        /LAVANDERIA|TINTORERIA|LAUNDR|DRY_CLEAN|SASTRERIA|COSTURA|TAILOR|ZAPATERO|SHOE_REPAIR|CERRAJERIA|LOCKSMITH|LIMPIEZA|CLEANING|HOME_SERVICE|GARDENER|PEST|MOVING/,
    },
    {
      key: 'OFICIOS',
      label: 'Oficios y reparaciones',
      match:
        /REPARACION|REPAIR|ELECTRICISTA|ELECTRICIAN|PLOMERIA|PLUMB|CLIMATIZACION|REFRIGERACION|HVAC|CARPENTER|GLASS|WINDOWS|PAINTING|FURNITURE|ELEVATOR|GARAGE_DOOR|SOLAR|PATIO|FIRE_PROTECTION|WELDING|UPHOLSTER|HANDYMAN/,
    },
    { key: 'SEGURIDAD', label: 'Seguridad privada', match: /SEGURIDAD|SECURITY/ },
    { key: 'FUNERARIAS', label: 'Funerarias', match: /FUNERARIA|FUNERAL|CREMATION/ },
    {
      key: 'BASICOS',
      label: 'Agua, energía y residuos',
      match:
        /AGUA_SANEAMIENTO|ELECTRICIDAD_OFICINA|PUBLIC_UTILITY|ENERGY_COMPANY|BOTTLED_WATER|RESIDUOS|RECICLAJE|GARBAGE|WASTE|RECYCL/,
    },
  ],

  INMOBILIARIO: [
    {
      key: 'INMOBILIARIAS',
      label: 'Inmobiliarias',
      match: /INMOBILIARIA|REAL_ESTATE_AGENT|REAL_ESTATE_AGENCY|REALTOR/,
    },
    {
      key: 'ADMINISTRACION',
      label: 'Administración e inversión inmobiliaria',
      match: /PROPERTY_MANAGEMENT|REAL_ESTATE_INVESTMENT|COMMERCIAL_REAL_ESTATE|CONDOMINIUM/,
    },
  ],

  CONSTRUCCION: [
    { key: 'FERRETERIAS', label: 'Ferreterías', match: /FERRETERIA|HARDWARE/ },
    {
      key: 'MATERIALES',
      label: 'Materiales de construcción',
      match:
        /MATERIALES|BUILDING_MATERIAL|LUMBER|CEMENT|METAL_SUPPLIER|GRANITE|TILE|ELECTRICAL_SUPPLY|PLUMBING_SUPPLY|PAINT_STORE|HOME_IMPROVEMENT/,
    },
    {
      key: 'CONSTRUCTORAS',
      label: 'Constructoras y contratistas',
      match: /CONSTRUCTORA|CONTRACTOR|BUILDING_OR_CONSTRUCTION|DEVELOPER/,
    },
    {
      key: 'ARQUITECTURA',
      label: 'Arquitectura e ingeniería',
      match: /ARQUITECTURA|INGENIERIA|ARCHITECT|ENGINEER|SURVEY/,
    },
  ],

  EDUCACION: [
    {
      key: 'UNIVERSIDADES',
      label: 'Universidades e institutos',
      match: /UNIVERSIDAD|UNIVERSITY|COLLEGE|INSTITUTO_TECNICO|CAMPUS|MEDICAL_SCHOOL|POLYTECHNIC/,
    },
    {
      key: 'PREESCOLAR',
      label: 'Guarderías y preescolar',
      match: /PREESCOLAR|GUARDERIA|DAY_CARE|PRESCHOOL|KINDERGARTEN/,
    },
    {
      key: 'ACADEMIAS',
      label: 'Academias y capacitación',
      match:
        /ACADEMIA|MUSIC_SCHOOL|COOKING|FLIGHT|BARTENDING|COSMETOLOGY|SPECIALTY_SCHOOL|IDIOMAS|LANGUAGE|AUTOESCUELA|DRIVING|TUTORING|CAPACITACION|TRAINING|PREUNIVERSITARIO|VOCATIONAL/,
    },
    { key: 'COLEGIOS', label: 'Colegios y escuelas', match: /COLEGIO|ESCUELA|SCHOOL/ },
    {
      key: 'BIBLIOTECAS',
      label: 'Bibliotecas e investigación',
      match: /BIBLIOTECA|LIBRARY|INVESTIGACION|RESEARCH|ARCHAEOLOG/,
    },
  ],

  AUTOMOTOR: [
    {
      key: 'TALLERES',
      label: 'Talleres mecánicos',
      match:
        /TALLER|MECANICO|REPAIR|OIL_CHANGE|CHAPERIA|PINTURA|BODY_SHOP|AUTOMOTIVE_SERVICE|CUSTOMIZATION|INSPECCION|TRANSMISSION/,
    },
    {
      key: 'REPUESTOS',
      label: 'Repuestos y llanterías',
      match: /REPUESTOS|PARTS|LLANTERIA|TIRE|WHEEL|BATTERY|ACCESSOR/,
    },
    {
      key: 'CONCESIONARIOS',
      label: 'Concesionarios y alquiler',
      match: /CONCESIONARIO|DEALER|ALQUILER_AUTOS|CAR_RENTAL|LEASING/,
    },
    { key: 'LAVADEROS', label: 'Lavaderos de autos', match: /LAVADERO|CAR_WASH|DETAILING/ },
  ],

  BELLEZA: [
    {
      key: 'SALONES',
      label: 'Salones, peluquerías y barberías',
      match:
        /SALON_BELLEZA|BEAUTY_SALON|PELUQUERIA|BARBERIA|BARBER|HAIR|UNAS|NAIL|MAKEUP|EYELASH|WAXING/,
    },
    {
      key: 'SPAS',
      label: 'Spas, masajes y bienestar',
      match: /SPA|MASAJE|MASSAGE|SAUNA|TANNING|WELLNESS|NUTRITION|SKIN_CARE/,
    },
    { key: 'TATUAJES', label: 'Tatuajes y piercing', match: /TATUAJE|TATTOO|PIERCING/ },
  ],

  TRANSPORTE: [
    {
      key: 'SURTIDORES',
      label: 'Surtidores de combustible',
      match: /SURTIDOR|GAS_STATION|FUEL|PETROL|CHARGING/,
    },
    // Antes que las terminales: `ESTACION` también encaja en «estacionamiento».
    { key: 'ESTACIONAMIENTOS', label: 'Estacionamientos', match: /ESTACIONAMIENTO|PARKING/ },
    {
      key: 'TERMINALES',
      label: 'Terminales, aeropuertos y estaciones',
      match: /TERMINAL|AEROPUERTO|ESTACION|STATION|TRANSIT|BUS_STOP|WATER_TRANSPORT|FERRY/,
    },
    {
      key: 'LOGISTICA',
      label: 'Logística, carga y correos',
      match:
        /LOGISTICA|CARGA|FREIGHT|CARGO|ALMACEN|DEPOSITO|WAREHOUSE|STORAGE|CORREOS|COURIER|MENSAJERIA|POSTAL|SHIPPING|TRUCKING/,
    },
    {
      key: 'PASAJEROS',
      label: 'Taxis, aerolíneas y pasajeros',
      match: /TAXI|AEROLINEA|AIRLINE|SHUTTLE|LIMO|BUS_COMPANY|CHAUFFEUR/,
    },
  ],

  FINANCIERO: [
    { key: 'CAJEROS', label: 'Cajeros automáticos', match: /CAJERO|_ATM$/ },
    {
      key: 'CAMBIO',
      label: 'Casas de cambio y remesas',
      match: /CASA_CAMBIO|CURRENCY|EXCHANGE|REMESAS|MONEY_TRANSFER|PAYMENT/,
    },
    { key: 'SEGUROS', label: 'Aseguradoras', match: /ASEGURADORA|INSURANCE|SEGUROS/ },
    { key: 'EMPENO', label: 'Casas de empeño', match: /EMPENO|PAWN/ },
    {
      key: 'BANCOS',
      label: 'Bancos y cooperativas',
      match: /^BANCO$|BANK|CREDIT_UNION|COOPERATIVA|FINANCIAL|MICROFINAN|LOANS|CREDIT|MORTGAGE/,
    },
  ],

  INDUSTRIA: [
    {
      key: 'FABRICAS',
      label: 'Fábricas y plantas',
      match:
        /FABRICA|PLANTA|MANUFACTUR|FABRICATOR|SAWMILL|FACTORY|PLANT$|TEXTILE|CHEMICAL|FARMACEUTICO|REFINERY|FOUNDRY/,
    },
    {
      key: 'SUMINISTROS',
      label: 'Suministros y distribución industrial',
      match: /SUMINISTROS|SUPPLIER|SUPPLY|DISTRIBUIDORA|DISTRIBUTOR|EQUIPMENT|MACHINE/,
    },
  ],

  AGRO: [
    {
      key: 'INSUMOS',
      label: 'Insumos agropecuarios',
      match: /INSUMOS|SUPPLY|STORE|VETERINARIO_RURAL|FEED/,
    },
    {
      key: 'PRODUCCION',
      label: 'Fincas, granjas y cooperativas',
      match: /FARM|AGRICULTUR|LIVESTOCK|GANADER|CULTIVO|RANCH|ORCHARD|VINEYARD|COOPERATIVE|APIAR/,
    },
  ],

  HOSPEDAJE: [
    {
      key: 'HOSTALES',
      label: 'Hostales y albergues',
      match: /HOSTAL|HOSTEL|ALBERGUE|GUEST_HOUSE/,
    },
    {
      key: 'CABANAS',
      label: 'Cabañas, campings y casas de vacaciones',
      match: /CABIN|CAMPGROUND|CAMPING|MOUNTAIN_HUT|COTTAGE|HOLIDAY_RENTAL|RV_PARK|VACATION/,
    },
    {
      key: 'AGENCIAS',
      label: 'Agencias de viaje y turismo',
      match: /AGENCIA_VIAJES|TRAVEL|OPERADOR_TURISMO|TOUR|INFORMACION_TURISTICA|SIGHTSEEING/,
    },
    {
      key: 'HOTELES',
      label: 'Hoteles, moteles y apart-hoteles',
      match: /HOTEL|MOTEL|RESORT|APART|LODGING|LODGE|INN$|BED_AND_BREAKFAST/,
    },
  ],

  CULTURA: [
    {
      key: 'MEDIOS',
      label: 'Medios y producción audiovisual',
      match:
        /MEDIOS|MEDIA|RADIO|BROADCAST|TELEVISION|ESTUDIO_GRABACION|RECORDING|MUSIC_PRODUCTION|NEWSPAPER|NEWS|PUBLISHER/,
    },
    {
      key: 'OCIO_NOCTURNO',
      label: 'Discotecas, karaokes y salas de juego',
      match:
        /DISCOTECA|NIGHTCLUB|KARAOKE|BILLIARDS|ARCADE|CASINO|APUESTAS|BOWLING|SALSA_CLUB|CIRCUS|COMEDY|BINGO/,
    },
    {
      key: 'GIMNASIOS',
      label: 'Gimnasios y fitness',
      match:
        /GIMNASIO|GYM|FITNESS|CROSSFIT|PILATES|YOGA|BOOT_CAMP|MARTIAL_ARTS|BOXING|CYCLING_CLASS|DANCE_STUDIO|SWIMMING_INSTRUCTOR/,
    },
    {
      key: 'MUSEOS',
      label: 'Museos, teatros y cines',
      match:
        /MUSEO|MUSEUM|TEATRO|THEATER|THEATRE|CINE|CINEMA|CENTRO_CULTURAL|CULTURAL|GALERIA|GALLERY|AUDITORIUM|MUSIC_VENUE|CONCERT|OBSERVATORY|PLANETARIUM/,
    },
    {
      key: 'PARQUES_TEMATICOS',
      label: 'Parques temáticos y zoológicos',
      match:
        /PARQUE_TEMATICO|THEME_PARK|AMUSEMENT|ZOO|ACUARIO|AQUARIUM|WILDLIFE|FAIRGROUND|WATER_PARK/,
    },
    {
      key: 'SALAS_EVENTOS',
      label: 'Salas de eventos y boleterías',
      match: /CENTRO_EVENTOS|EVENT|TICKET|BANQUET/,
    },
    {
      key: 'DEPORTES',
      label: 'Canchas, estadios y clubes deportivos',
      match:
        /DEPORTIVO|SPORT|CANCHA|COURT|FIELD|ESTADIO|STADIUM|PISCINA|POOL|SWIMMING|GOLF|SKATE_PARK|RACE_TRACK|GO_KART|PAINTBALL|ARCHERY|HORSE_RIDING|EQUESTRIAN|CLUB$|TRACK|HIKING|FISHING|CANOE|ATV|TENNIS|ARENA|RINK|TEAM$/,
    },
  ],

  PUBLICO: [
    {
      key: 'GOBIERNO',
      label: 'Oficinas de gobierno',
      match:
        /OFICINA_GOBIERNO|GOBIERNO|GOVERNMENT|ALCALDIA|MUNICIPAL|CITY_HALL|MINISTERIO|MINISTRY|EMBAJADA|CONSULADO|EMBASSY|CONSULATE|DEPARTMENT_OF|HOUSING_AUTHORITY|HEALTH_DEPARTMENT|TAX_OFFICE/,
    },
    {
      key: 'JUSTICIA',
      label: 'Policía, justicia y emergencias',
      match:
        /POLICIA|POLICE|JUZGADO|TRIBUNAL|COURT|JAIL|PRISON|BOMBEROS|FIRE_STATION|FIRE_DEPARTMENT|EMERGENCIAS|MILITARY|CIVIL_DEFENSE/,
    },
    {
      key: 'RELIGION',
      label: 'Iglesias y templos',
      match: /IGLESIA|TEMPLO|WORSHIP|CHURCH|RELIGIO|MOSQUE|SYNAGOGUE|PARISH|MONASTERY|CONVENT/,
    },
    {
      key: 'COMUNIDAD',
      label: 'Asociaciones, ONG y comunidad',
      match:
        /CENTRO_COMUNITARIO|COMMUNITY|ASOCIACION|CAMARA|ASSOCIATION|^ONG_|FUNDACION|FOUNDATION|NON_PROFIT|CHARITY|ORGANIZATION|UNION|SOCIAL|YOUTH|SENIOR|FOOD_BANK|POLITICAL/,
    },
    {
      key: 'ESPACIOS',
      label: 'Parques, plazas y cementerios',
      match:
        /PARQUE|PARK|PLAZA|SQUARE|CEMENTERIO|CEMETERY|FOUNTAIN|MONUMENT|MEMORIAL|MARINA|BEACH|GARDEN/,
    },
  ],

  TELECOMUNICACIONES: [
    {
      key: 'OPERADORES',
      label: 'Operadores de telefonía, internet y TV',
      match: /TELECOM|INTERNET_SERVICE|TELEVISION_SERVICE|CABLE|MOBILE_NETWORK/,
    },
    { key: 'CYBER', label: 'Cibercafés', match: /CYBER|INTERNET_CAFE|CIBER/ },
    {
      key: 'SOFTWARE',
      label: 'Software y servicios TI',
      match: /SOFTWARE|_TI$|INFORMATION_TECHNOLOGY|WEB_HOSTING|COMPUTER_HARDWARE|IT_SERVICE/,
    },
  ],

  // No hay matiz que derivar de «otra entidad»: el residuo es un solo cajón.
  SIN_CLASIFICAR: [],
};

/**
 * Familias que deciden su sub-rubro por sí solas, saltándose los patrones.
 *
 * Van aquí las que ninguna expresión razonable atrapa sin atrapar también lo
 * que no debe. La clave es la de un sub-rubro de su propio rubro; si no existe
 * en {@link SUBSECTOR_RULES}, la familia cae en «Otros», nunca en otro rubro.
 */
const SUBSECTOR_BY_FAMILY: Record<string, string> = {
  // Overture llama «delicatessen» al local que sirve fiambres, no a la tienda.
  OV_DELICATESSEN: 'OTRAS_COCINAS',

  /*
   * Las familias sintéticas de la cocina derivada del nombre
   * (`RESTAURANTE__PIZZERIAS`, …). La clave de la cocina es, a propósito, la
   * misma que la del sub-rubro en `SUBSECTOR_RULES.GASTRONOMIA`: no hace
   * falta traducir una en la otra.
   */
  ...Object.fromEntries(
    CUISINE_KEYS.map((cuisine) => [syntheticRestaurantFamily(cuisine), cuisine]),
  ),
};

export interface PlaceSubsector {
  /** `<rubro>/<clave>`, único en todo el árbol y estable para la interfaz. */
  id: string;
  sector: PlaceSector;
  key: string;
  label: string;
  /** El nodo que lo agrupa (`<rubro>/<grupo>`) y su nombre, si tiene uno. */
  groupId?: string;
  groupLabel?: string;
}

/** «Otros de Gastronomía»: lo que ninguna regla del rubro nombró. */
function othersOf(sector: PlaceSector): PlaceSubsector {
  return {
    id: `${sector}/${OTHERS}`,
    sector,
    key: OTHERS,
    label: sector === 'SIN_CLASIFICAR' ? SECTOR_LABEL[sector] : `Otros de ${SECTOR_LABEL[sector]}`,
  };
}

/**
 * El sub-rubro de un lugar, por su familia y su grupo.
 *
 * Primero el rubro —que fija la lista de reglas—, después la excepción por
 * familia, después la primera regla que encaja. Una familia cae en exactamente
 * un sub-rubro, y siempre dentro del rubro que `sectorOf` le dio: el escalón
 * intermedio afina, no reubica.
 */
export function subsectorOf(entityGroup: string, entityFamily: string): PlaceSubsector {
  const sector = sectorOf(entityGroup, entityFamily);
  const rules = SUBSECTOR_RULES[sector];
  const forced = SUBSECTOR_BY_FAMILY[entityFamily];
  const rule = forced
    ? rules.find((one) => one.key === forced)
    : rules.find((one) => one.match.test(entityFamily));
  if (!rule) return othersOf(sector);
  const groupLabel = rule.group ? SUBSECTOR_GROUPS[sector]?.[rule.group] : undefined;
  return {
    id: `${sector}/${rule.key}`,
    sector,
    key: rule.key,
    label: rule.label,
    ...(rule.group && groupLabel ? { groupId: `${sector}/${rule.group}`, groupLabel } : {}),
  };
}

/* Recuentos ---------------------------------------------------------------- */

/**
 * Un nodo del árbol bajo un rubro.
 *
 * Es un sub-rubro —y entonces `children` está vacío y se despliega en sus
 * familias— o un grupo de sub-rubros como «Restaurantes», que se despliega en
 * sus hijos. Las dos formas llevan sus familias, porque elegir cualquiera de
 * las dos es elegir sus familias.
 */
export interface SubsectorNode {
  id: string;
  label: string;
  places: number;
  regulated: number;
  /** Las familias del nodo, de mayor a menor. */
  families: string[];
  /** Los sub-rubros que agrupa; vacío si el nodo es un sub-rubro. */
  children: SubsectorNode[];
  /** Si es el «Otros de <rubro>», que va siempre al final. */
  residual: boolean;
}

export interface SectorTally {
  sector: PlaceSector;
  label: string;
  icon: IconName;
  places: number;
  regulated: number;
  /** Las familias que componen el rubro, que es como se filtra. */
  families: string[];
  /** Los nodos del rubro, de mayor a menor y «Otros» al final. */
  subsectors: SubsectorNode[];
}

/**
 * Los rubros de una selección, con lo que cada uno contiene.
 *
 * Devuelve también las familias porque el filtro del panel recorta por familia:
 * pedir un rubro es pedir sus familias, así que no hace falta ni una consulta
 * nueva ni una columna nueva en la base para que el lector pueda pedirlo. Lo
 * mismo vale un escalón más abajo: pedir «Pizzerías» es pedir las familias de
 * ese sub-rubro.
 *
 * `SIN_CLASIFICAR` va siempre al final por grande que sea, por la misma razón
 * que el resto de las listas del informe lo hacen: es el residuo, no el
 * titular. «Otros de <rubro>» va al final de su rubro por lo mismo.
 *
 * Reparto medido sobre Santa Cruz de la Sierra el 2026-09-23, 21.341 lugares
 * del fixture de `/api/familias` (los que vienen entre corchetes cuelgan del
 * grupo que los precede):
 *
 * - Salud 2.580 — Farmacias 916 · Odontología 710 · Hospitales y clínicas 305 ·
 *   Laboratorios y diagnóstico 212 · Veterinarias y mascotas 192 · Ópticas y
 *   oftalmología 80 · Fisioterapia y rehabilitación 41 · Consultorios y
 *   especialidades 38 · Psicología y salud mental 27 · Insumos médicos 13 ·
 *   Otros de Salud 46
 * - Comercio 2.432 — Ropa y calzado 459 · Tecnología y electrónica 265 ·
 *   Supermercados y abarrotes 163 · Centros comerciales y grandes tiendas 127 ·
 *   Carnicerías, bebidas y alimentos 109 · Deportes, juguetes y hobbies 72 ·
 *   Cosmética y perfumería 70 · Librerías y papelerías 57 · Tiendas de mascotas
 *   37 · Hogar, muebles y jardín 35 · Joyerías, regalos y flores 2 · Otros de
 *   Comercio 1.036
 * - Gastronomía 2.033 — Restaurantes 1.281 [Restaurantes sin especialidad 1.273
 *   · Parrillas y carnes 5 · Otras cocinas 1 · Pizzerías 1 · Hamburgueserías 1]
 *   · Bares y pubs 268 · Cafeterías 180 · Panaderías y pastelerías 111 ·
 *   Heladerías 95 · Comida rápida 94 · Otros de Gastronomía 4
 * - Belleza y bienestar 1.071 — Salones, peluquerías y barberías 804 · Spas,
 *   masajes y bienestar 264 · Tatuajes y piercing 3
 * - Automotor 917 — Repuestos y llanterías 403 · Talleres mecánicos 331 ·
 *   Concesionarios y alquiler 135 · Lavaderos de autos 48
 * - Servicios 888 — Eventos y fiestas 291 · Abogados y notarías 190 · Imprentas
 *   y fotocopias 150 · Lavanderías, costura y limpieza 83 · Publicidad,
 *   fotografía y diseño 66 · Oficios y reparaciones 38 · Consultoría,
 *   contabilidad y oficinas 34 · Agua, energía y residuos 20 · Servicios a
 *   empresas e industria 8 · Seguridad privada 4 · Funerarias 3 · Otros de
 *   Servicios 1
 * - Educación 837 — Colegios y escuelas 448 · Universidades e institutos 147 ·
 *   Guarderías y preescolar 143 · Academias y capacitación 82 · Bibliotecas e
 *   investigación 14 · Otros de Educación 3
 * - Cultura, ocio y deporte 569 — Gimnasios y fitness 301 · Canchas, estadios y
 *   clubes deportivos 106 · Museos, teatros y cines 57 · Discotecas, karaokes y
 *   salas de juego 54 · Salas de eventos y boleterías 18 · Medios y producción
 *   audiovisual 17 · Parques temáticos y zoológicos 14 · Otros de Cultura, ocio
 *   y deporte 2
 * - Construcción 498 — Ferreterías 355 · Materiales de construcción 70 ·
 *   Arquitectura e ingeniería 58 · Constructoras y contratistas 15
 * - Público y comunidad 393 — Oficinas de gobierno 198 · Iglesias y templos 70
 *   · Parques, plazas y cementerios 69 · Asociaciones, ONG y comunidad 54 ·
 *   Policía, justicia y emergencias 2
 * - Hospedaje y turismo 371 — Hoteles, moteles y apart-hoteles 330 · Agencias
 *   de viaje y turismo 26 · Cabañas, campings y casas de vacaciones 8 ·
 *   Hostales y albergues 7
 * - Inmobiliario 335 — Inmobiliarias 335
 * - Industria 208 — Suministros y distribución industrial 113 · Fábricas y
 *   plantas 95
 * - Financiero 182 — Casas de empeño 79 · Bancos y cooperativas 50 ·
 *   Aseguradoras 26 · Casas de cambio y remesas 23 · Cajeros automáticos 4
 * - Transporte y logística 121 — Logística, carga y correos 69 · Surtidores de
 *   combustible 27 · Terminales, aeropuertos y estaciones 11 · Taxis,
 *   aerolíneas y pasajeros 9 · Estacionamientos 3 · Otros de Transporte y
 *   logística 2
 * - Telecomunicaciones 69 — Operadores de telefonía, internet y TV 37 ·
 *   Software y servicios TI 17 · Cibercafés 15
 * - Agro 7 — Insumos agropecuarios 4 · Fincas, granjas y cooperativas 3
 * - Sin clasificar 7.830
 *
 * Lo que dice ese reparto sobre la fuente, no sobre el árbol: en Santa Cruz
 * los restaurantes vienen casi todos con la familia nativa `RESTAURANTE`
 * (1.273 de 1.281), sin cocina; las familias de Overture que sí la dicen
 * (`OV_PIZZA_RESTAURANT`, `OV_BURGER_RESTAURANT`…) aparecen en Sucre, Tarija u
 * Oruro y casi nunca aquí. En una muestra de 432 de esos restaurantes, el
 * nombre delata la especialidad en uno de cada cuatro —Papa Johns, Burger
 * King, Pollos El Campeón, churrasquerías—, así que «Pizzerías» con una sola
 * fila era un hueco del catálogo y no del árbol.
 *
 * RESUELTO (2026-09-23), sin tocar el núcleo ni el corpus: reclasificar la
 * familia allá tocaría datos ya cargados, que este repo trata como
 * inmutables, así que la cocina se deriva del nombre aquí, en el tablero.
 * `src/lib/restaurant-cuisine.ts` lee el nombre de cada `RESTAURANTE` y
 * devuelve una clave de cocina o `null`; `/api/familias` (`src/lib/places.ts`)
 * hace esa pasada por ciudad y publica el resultado como familias sintéticas
 * —`RESTAURANTE__PIZZERIAS`, `RESTAURANTE__HAMBURGUESERIAS`…— manteniendo
 * `RESTAURANTE` a secas para lo que el nombre no delata; `/api/lugares`
 * traduce esas familias sintéticas de vuelta a «`RESTAURANTE` filtrado por el
 * mismo patrón» al pedir los lugares. Este archivo solo necesitó una entrada
 * más en {@link SECTOR_BY_FAMILY} y otra en {@link SUBSECTOR_BY_FAMILY} por
 * cocina, apuntando a los sub-rubros de `RESTAURANTES` que ya existían: el
 * árbol no ganó nodos nuevos, solo dejó de estar vacíos.
 */
export function tallySectors(
  rows: ReadonlyArray<{
    entityGroup: string;
    entityFamily: string;
    places: number;
    regulated: number;
  }>,
): SectorTally[] {
  const perFamily = new Map<string, number>();
  const sectors = new Map<PlaceSector, SectorTally>();
  // Los nodos de cada rubro por id: sub-rubros sueltos, grupos y sus hijos.
  const nodes = new Map<string, SubsectorNode>();
  const tops = new Map<PlaceSector, SubsectorNode[]>();

  const node = (id: string, label: string, residual: boolean): SubsectorNode => {
    const held = nodes.get(id);
    if (held) return held;
    const fresh: SubsectorNode = {
      id,
      label,
      places: 0,
      regulated: 0,
      families: [],
      children: [],
      residual,
    };
    nodes.set(id, fresh);
    return fresh;
  };
  const add = (
    target: { places: number; regulated: number; families: string[] },
    row: {
      entityFamily: string;
      places: number;
      regulated: number;
    },
  ): void => {
    target.places += row.places;
    target.regulated += row.regulated;
    if (!target.families.includes(row.entityFamily)) target.families.push(row.entityFamily);
  };

  for (const row of rows) {
    perFamily.set(row.entityFamily, (perFamily.get(row.entityFamily) ?? 0) + row.places);
    const sub = subsectorOf(row.entityGroup, row.entityFamily);

    const sector = sectors.get(sub.sector) ?? {
      sector: sub.sector,
      label: SECTOR_LABEL[sub.sector],
      icon: SECTOR_ICON[sub.sector],
      places: 0,
      regulated: 0,
      families: [],
      subsectors: [],
    };
    sectors.set(sub.sector, sector);
    add(sector, row);

    const top = tops.get(sub.sector) ?? [];
    tops.set(sub.sector, top);
    const leaf = node(sub.id, sub.label, sub.key === OTHERS);
    add(leaf, row);
    if (sub.groupId && sub.groupLabel) {
      const group = node(sub.groupId, sub.groupLabel, false);
      add(group, row);
      if (!group.children.includes(leaf)) group.children.push(leaf);
      if (!top.includes(group)) top.push(group);
    } else if (!top.includes(leaf)) {
      top.push(leaf);
    }
  }

  const byFamily = (one: string, other: string): number =>
    (perFamily.get(other) ?? 0) - (perFamily.get(one) ?? 0);
  const byNode = (left: SubsectorNode, right: SubsectorNode): number => {
    if (left.residual !== right.residual) return left.residual ? 1 : -1;
    return right.places - left.places;
  };
  for (const held of nodes.values()) {
    held.families.sort(byFamily);
    held.children.sort(byNode);
  }
  for (const [sector, entry] of sectors) {
    entry.families.sort(byFamily);
    entry.subsectors = (tops.get(sector) ?? []).sort(byNode);
  }
  return [...sectors.values()].sort((left, right) => {
    if (left.sector === 'SIN_CLASIFICAR') return 1;
    if (right.sector === 'SIN_CLASIFICAR') return -1;
    return right.places - left.places;
  });
}

/**
 * Los nombres del comercio exterior, en castellano y con su código de mapa.
 *
 * Comtrade rotula a los socios en inglés y recorta el nombre en el token del
 * código (`RUSSIANFEDER`, `UNITEDKINGDO`), y rotula los capítulos del Sistema
 * Armonizado con la descripción oficial inglesa, que en algunos capítulos pasa
 * de las treinta palabras. En un tablero en castellano eso se leía como un
 * error —«Russian Federation» junto a «Carne» en la misma fila de filtros— y en
 * el carril, a 264 px, rompía las pastillas de la selección activa.
 *
 * El token es la llave porque es lo único estable: el rótulo de la serie es
 * texto de la fuente y puede cambiar de redacción sin que cambie el socio. Un
 * token que no esté aquí no se pierde: cae al rótulo de la fuente y queda sin
 * lugar en el mapa, que es lo honesto hasta que alguien lo agregue.
 */

export interface PartnerName {
  /** ISO 3166 alfa-3, la llave de `WORLD_SHAPES`. */
  iso3: string;
  name: string;
}

export const PARTNER_NAMES: Readonly<Record<string, PartnerName>> = {
  ARGENTINA: { iso3: 'ARG', name: 'Argentina' },
  AUSTRALIA: { iso3: 'AUS', name: 'Australia' },
  AUSTRIA: { iso3: 'AUT', name: 'Austria' },
  BELGIUM: { iso3: 'BEL', name: 'Bélgica' },
  BRAZIL: { iso3: 'BRA', name: 'Brasil' },
  CANADA: { iso3: 'CAN', name: 'Canadá' },
  CHILE: { iso3: 'CHL', name: 'Chile' },
  CHINA: { iso3: 'CHN', name: 'China' },
  CHINAHONGKON: { iso3: 'HKG', name: 'Hong Kong' },
  COLOMBIA: { iso3: 'COL', name: 'Colombia' },
  ECUADOR: { iso3: 'ECU', name: 'Ecuador' },
  FRANCE: { iso3: 'FRA', name: 'Francia' },
  GERMANY: { iso3: 'DEU', name: 'Alemania' },
  INDIA: { iso3: 'IND', name: 'India' },
  INDONESIA: { iso3: 'IDN', name: 'Indonesia' },
  ITALY: { iso3: 'ITA', name: 'Italia' },
  JAPAN: { iso3: 'JPN', name: 'Japón' },
  MALAYSIA: { iso3: 'MYS', name: 'Malasia' },
  MEXICO: { iso3: 'MEX', name: 'México' },
  NETHERLANDS: { iso3: 'NLD', name: 'Países Bajos' },
  PANAMA: { iso3: 'PAN', name: 'Panamá' },
  PARAGUAY: { iso3: 'PRY', name: 'Paraguay' },
  PERU: { iso3: 'PER', name: 'Perú' },
  REPOFKOREA: { iso3: 'KOR', name: 'Corea del Sur' },
  RUSSIANFEDER: { iso3: 'RUS', name: 'Rusia' },
  SINGAPORE: { iso3: 'SGP', name: 'Singapur' },
  SOUTHAFRICA: { iso3: 'ZAF', name: 'Sudáfrica' },
  SPAIN: { iso3: 'ESP', name: 'España' },
  SWEDEN: { iso3: 'SWE', name: 'Suecia' },
  SWITZERLAND: { iso3: 'CHE', name: 'Suiza' },
  THAILAND: { iso3: 'THA', name: 'Tailandia' },
  TURKIYE: { iso3: 'TUR', name: 'Turquía' },
  TURKEY: { iso3: 'TUR', name: 'Turquía' },
  UNITEDARABEM: { iso3: 'ARE', name: 'Emiratos Árabes Unidos' },
  UNITEDKINGDO: { iso3: 'GBR', name: 'Reino Unido' },
  URUGUAY: { iso3: 'URY', name: 'Uruguay' },
  USA: { iso3: 'USA', name: 'Estados Unidos' },
  VENEZUELA: { iso3: 'VEN', name: 'Venezuela' },
  VIETNAM: { iso3: 'VNM', name: 'Vietnam' },
};

/**
 * Los 97 capítulos del Sistema Armonizado, con un nombre que cabe en una fila.
 *
 * No es la nomenclatura oficial de la Aduana —que repite la redacción inglesa
 * entera, excepciones incluidas— sino su título corto: lo que alguien diría
 * para nombrar el capítulo. El número sigue delante en cada rótulo, así que
 * quien necesite la descripción completa la encuentra por él.
 */
export const HS_CHAPTERS: Readonly<Record<string, string>> = {
  '01': 'Animales vivos',
  '02': 'Carne y despojos',
  '03': 'Pescados y mariscos',
  '04': 'Lácteos, huevos y miel',
  '05': 'Otros productos de origen animal',
  '06': 'Plantas y flores',
  '07': 'Hortalizas',
  '08': 'Frutas y frutos secos',
  '09': 'Café, té y especias',
  '10': 'Cereales',
  '11': 'Harinas y productos de molinería',
  '12': 'Semillas oleaginosas (soya, chía…)',
  '13': 'Gomas y resinas',
  '14': 'Materias vegetales para trenzar',
  '15': 'Grasas y aceites',
  '16': 'Preparados de carne y pescado',
  '17': 'Azúcar y confitería',
  '18': 'Cacao y sus preparados',
  '19': 'Preparados de cereales y panadería',
  '20': 'Conservas de hortalizas y frutas',
  '21': 'Preparaciones alimenticias diversas',
  '22': 'Bebidas y alcohol',
  '23': 'Residuos de la industria alimentaria y forrajes',
  '24': 'Tabaco',
  '25': 'Sal, azufre, piedras y cemento',
  '26': 'Minerales metalíferos',
  '27': 'Combustibles minerales (gas, petróleo)',
  '28': 'Químicos inorgánicos (incluye litio)',
  '29': 'Químicos orgánicos',
  '30': 'Productos farmacéuticos',
  '31': 'Fertilizantes',
  '32': 'Tintas, pinturas y barnices',
  '33': 'Aceites esenciales y cosméticos',
  '34': 'Jabones y detergentes',
  '35': 'Albúminas, colas y enzimas',
  '36': 'Explosivos',
  '37': 'Productos fotográficos',
  '38': 'Productos químicos diversos',
  '39': 'Plásticos',
  '40': 'Caucho',
  '41': 'Pieles y cueros',
  '42': 'Manufacturas de cuero',
  '43': 'Peletería',
  '44': 'Madera',
  '45': 'Corcho',
  '46': 'Cestería',
  '47': 'Pasta de madera',
  '48': 'Papel y cartón',
  '49': 'Libros e impresos',
  '50': 'Seda',
  '51': 'Lana y pelo fino',
  '52': 'Algodón',
  '53': 'Otras fibras vegetales',
  '54': 'Filamentos sintéticos',
  '55': 'Fibras sintéticas discontinuas',
  '56': 'Guata, fieltro y cordeles',
  '57': 'Alfombras',
  '58': 'Tejidos especiales',
  '59': 'Tejidos técnicos',
  '60': 'Tejidos de punto',
  '61': 'Prendas de punto',
  '62': 'Prendas que no son de punto',
  '63': 'Otros textiles confeccionados',
  '64': 'Calzado',
  '65': 'Sombreros',
  '66': 'Paraguas y bastones',
  '67': 'Plumas y flores artificiales',
  '68': 'Manufacturas de piedra y yeso',
  '69': 'Cerámica',
  '70': 'Vidrio',
  '71': 'Oro, plata y piedras preciosas',
  '72': 'Hierro y acero',
  '73': 'Manufacturas de hierro y acero',
  '74': 'Cobre',
  '75': 'Níquel',
  '76': 'Aluminio',
  '78': 'Plomo',
  '79': 'Zinc',
  '80': 'Estaño',
  '81': 'Otros metales comunes',
  '82': 'Herramientas',
  '83': 'Manufacturas de metal diversas',
  '84': 'Maquinaria y reactores',
  '85': 'Máquinas y aparatos eléctricos',
  '86': 'Material ferroviario',
  '87': 'Vehículos',
  '88': 'Aeronaves',
  '89': 'Barcos',
  '90': 'Instrumentos de óptica y medicina',
  '91': 'Relojería',
  '92': 'Instrumentos musicales',
  '93': 'Armas y municiones',
  '94': 'Muebles',
  '95': 'Juguetes y deporte',
  '96': 'Manufacturas diversas',
  '97': 'Obras de arte y antigüedades',
};

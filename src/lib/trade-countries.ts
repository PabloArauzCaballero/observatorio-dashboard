/**
 * De los códigos de país del INE a los contornos del mapa.
 *
 * La base aduanera nombra cada país con el código numérico de la Aduana y el
 * mapa del mundo los dibuja por ISO 3166 alfa-3: este archivo es el puente.
 * Se armó cruzando los 261 nombres del catálogo del INE con los del mapa y
 * resolviendo a mano los que no coinciden por escritura («Corea (Sur),
 * República de», «Rusia, Federación de»); con él se ubica el 99,93 % del valor
 * comerciado entre 1992 y 2025.
 *
 * **Lo que no tiene contorno** y por eso no se dibuja, pero sí se cuenta aparte
 * en {@link CountryMap.unplaced}: la «Zona Franca de Bolivia» (990, comercio
 * con un territorio del propio país), «No declarados» (999) y los códigos
 * históricos sin continuidad en el mapa (Checoslovaquia, Kosovo).
 *
 * **Varios códigos para un mismo contorno** son reales: «Antillas Holandesas»
 * (47, disuelta en 2010) y «Curazao» (570) pintan Curazao; «Serbia» (729) y
 * «Serbia y Montenegro» (885) pintan Serbia. Se suman en una sola fila y
 * tocar el contorno elige todos sus códigos.
 */

export const COUNTRY_ISO3: Readonly<Record<string, string>> = {
  '10': 'ATA', '13': 'AFG', '15': 'ALA', '17': 'ALB', '23': 'DEU', '24': 'ATA', '26': 'ARM',
  '27': 'ABW', '29': 'BIH', '31': 'BFA', '37': 'AND', '40': 'AGO', '41': 'AIA', '43': 'ATG',
  '47': 'CUW', '53': 'SAU', '59': 'DZA', '63': 'ARG', '69': 'AUS', '72': 'AUT', '74': 'AZE',
  '77': 'BHS', '80': 'BHR', '81': 'BGD', '83': 'BRB', '87': 'BEL', '88': 'BLZ', '90': 'BMU',
  '91': 'BLR', '93': 'MMR', '97': 'BOL', '101': 'BWA', '102': 'BVT', '105': 'BRA',
  '108': 'BRN', '111': 'BGR', '115': 'BDI', '119': 'BTN', '127': 'CPV', '137': 'CYM',
  '141': 'KHM', '145': 'CMR', '149': 'CAN', '156': 'LKA', '157': 'KIR', '159': 'VAT',
  '165': 'CCK', '169': 'COL', '173': 'COM', '177': 'COG', '183': 'COK', '187': 'PRK',
  '190': 'KOR', '193': 'CIV', '196': 'CRI', '198': 'HRV', '199': 'CUB', '203': 'TCD',
  '211': 'CHL', '215': 'CHN', '218': 'TWN', '221': 'CYP', '229': 'BEN', '232': 'DNK',
  '235': 'DMA', '238': 'FLK', '239': 'ECU', '240': 'EGY', '242': 'SLV', '243': 'ERI',
  '244': 'ARE', '245': 'ESP', '246': 'SVK', '247': 'SVN', '249': 'USA', '251': 'EST',
  '253': 'ETH', '259': 'FRO', '267': 'PHL', '271': 'FIN', '275': 'FRA', '281': 'GAB',
  '285': 'GMB', '287': 'GEO', '289': 'GHA', '293': 'GIB', '297': 'GRD', '301': 'GRC',
  '305': 'GRL', '309': 'GLP', '313': 'GUM', '317': 'GTM', '325': 'GUF', '329': 'GIN',
  '331': 'GNQ', '334': 'GNB', '337': 'GUY', '341': 'HTI', '343': 'HMD', '345': 'HND',
  '351': 'HKG', '355': 'HUN', '361': 'IND', '365': 'IDN', '369': 'IRQ', '372': 'IRN',
  '375': 'IRL', '379': 'ISL', '383': 'ISR', '386': 'ITA', '391': 'JAM', '395': 'UMI',
  '399': 'JPN', '403': 'JOR', '406': 'KAZ', '410': 'KEN', '411': 'KIR', '412': 'KGZ',
  '413': 'KWT', '420': 'LAO', '426': 'LSO', '429': 'LVA', '431': 'LBN', '434': 'LBR',
  '438': 'LBY', '440': 'LIE', '443': 'LTU', '445': 'LUX', '447': 'MAC', '448': 'MKD',
  '450': 'MDG', '455': 'MYS', '458': 'MWI', '461': 'MDV', '464': 'MLI', '467': 'MLT',
  '469': 'MNP', '472': 'MHL', '474': 'MAR', '477': 'MTQ', '485': 'MUS', '488': 'MRT',
  '489': 'MYT', '493': 'MEX', '494': 'FSM', '495': 'UMI', '496': 'MDA', '497': 'MNG',
  '498': 'MCO', '500': 'MNE', '501': 'MSR', '505': 'MOZ', '507': 'NAM', '508': 'NRU',
  '511': 'CXR', '517': 'NPL', '521': 'NIC', '525': 'NER', '528': 'NGA', '531': 'NIU',
  '535': 'NFK', '538': 'NOR', '542': 'NCL', '545': 'PNG', '548': 'NZL', '551': 'VUT',
  '556': 'OMN', '566': 'UMI', '570': 'CUW', '573': 'NLD', '576': 'PAK', '578': 'PLW',
  '579': 'PSE', '580': 'PAN', '586': 'PRY', '589': 'PER', '593': 'PCN', '599': 'PYF',
  '603': 'POL', '607': 'PRT', '611': 'PRI', '618': 'QAT', '628': 'GBR', '640': 'CAF',
  '644': 'CZE', '647': 'DOM', '652': 'BLM', '660': 'REU', '665': 'ZWE', '670': 'ROU',
  '675': 'RWA', '676': 'RUS', '677': 'SLB', '685': 'ESH', '686': 'SSD', '687': 'WSM',
  '690': 'ASM', '695': 'KNA', '697': 'SMR', '700': 'SPM', '705': 'VCT', '710': 'SHN',
  '715': 'LCA', '720': 'STP', '728': 'SEN', '729': 'SRB', '731': 'SYC', '735': 'SLE',
  '741': 'SGP', '744': 'SYR', '748': 'SOM', '750': 'LKA', '756': 'ZAF', '759': 'SDN',
  '764': 'SWE', '767': 'CHE', '770': 'SUR', '772': 'SJM', '773': 'SWZ', '774': 'TJK',
  '776': 'THA', '780': 'TZA', '783': 'DJI', '787': 'IOT', '788': 'TLS', '800': 'TGO',
  '805': 'TKL', '810': 'TON', '815': 'TTO', '820': 'TUN', '823': 'TCA', '825': 'TKM',
  '827': 'TUR', '828': 'TUV', '830': 'UKR', '831': 'GGY', '832': 'JEY', '833': 'UGA',
  '845': 'URY', '847': 'UZB', '850': 'VEN', '855': 'VNM', '863': 'VGB', '866': 'VIR',
  '870': 'FJI', '875': 'WLF', '880': 'YEM', '885': 'SRB', '888': 'COD', '890': 'ZMB',
  '933': 'IMN', '992': 'SGS', '993': 'HMD', '994': 'SJM', '995': 'IMN', '996': 'FRA',
};

/** La fila de un país tal como la devuelve una vista de la base aduanera. */
export interface CountryItem {
  key: string | null;
  label: string;
  usd: number;
  kg: number;
}

/** Una fila del mapa: un contorno, con la suma de todos los códigos que le tocan. */
export interface CountryMapRow {
  /** El código del INE de mayor valor; es el que identifica la fila. */
  token: string;
  /** Todos los códigos del INE que pintan este contorno, el principal incluido. */
  members: string[];
  iso3: string;
  label: string;
  value: number;
}

export interface CountryMap {
  rows: CountryMapRow[];
  /** Lo que la base declara pero el mapa no puede dibujar, con su nombre. */
  unplaced: Array<{ label: string; value: number }>;
}

/** Los códigos que pintan el mismo contorno que `code` (él mismo incluido). */
export function sameOutline(code: string): string[] {
  const iso3 = COUNTRY_ISO3[code];
  if (!iso3) return [code];
  return Object.keys(COUNTRY_ISO3).filter((other) => COUNTRY_ISO3[other] === iso3);
}

/**
 * Las filas del mapa a partir de la vista por país, en dólares o en toneladas.
 *
 * Una fila con valor cero no entra: pintarla sería afirmar un comercio que la
 * base no declara. Las filas sin contorno van a `unplaced` y no se pierden.
 */
export function countryMap(items: readonly CountryItem[], measure: 'usd' | 'kg'): CountryMap {
  const byOutline = new Map<string, CountryMapRow & { top: number }>();
  const unplaced: CountryMap['unplaced'] = [];
  for (const item of items) {
    const value = measure === 'usd' ? item.usd / 1_000_000 : item.kg / 1_000_000;
    if (!(value > 0)) continue;
    const iso3 = item.key ? COUNTRY_ISO3[item.key] : undefined;
    if (!item.key || !iso3) {
      unplaced.push({ label: item.label, value });
      continue;
    }
    const known = byOutline.get(iso3);
    if (!known) {
      byOutline.set(iso3, {
        token: item.key,
        members: [item.key],
        iso3,
        label: item.label,
        value,
        top: value,
      });
      continue;
    }
    known.members.push(item.key);
    known.value += value;
    if (value > known.top) {
      known.top = value;
      known.token = item.key;
      known.label = item.label;
    }
  }
  const rows = [...byOutline.values()].map(({ top: _top, ...row }) => row);
  return { rows, unplaced };
}

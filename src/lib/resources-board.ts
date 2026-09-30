/**
 * El subsuelo: qué deja, qué se agota y en qué se convierte.
 *
 * El informe hablaba del gas —en la matriz energética— y de nada más. Los
 * minerales no aparecían por ninguna parte, y son hoy el primer renglón de la
 * renta del subsuelo boliviano: la renta minera de 2021 es la más alta de toda
 * la serie del Banco Mundial, que arranca en 1970, justo mientras la del gas
 * cae a un tercio de lo que fue en 2013. Ese relevo no estaba dibujado en
 * ningún sitio.
 *
 * Tres preguntas, no una. **Cuánto deja** el subsuelo —las rentas, que son el
 * excedente sobre el costo de extracción—. **Cuánto se gasta** del patrimonio
 * al sacarlo —el agotamiento, que las cuentas ajustadas del Banco Mundial
 * descuentan del ahorro—. Y **en qué se convierte** eso: si el país compra con
 * ello capital que dura —máquinas, escuelas— o si lo consume. Las tres se
 * responden con series que el núcleo ya recogía para treinta economías y que
 * no llegaban a ningún panel.
 *
 * La tercera es la que ordena el capítulo. Una renta alta no dice nada por sí
 * sola: Chile y Perú también viven de minerales. Lo que distingue un caso de
 * otro es el ahorro neto ajustado, que resta del ahorro bruto la depreciación
 * del capital y el agotamiento del subsuelo y suma el gasto en educación. Si
 * sale negativo, el país está consumiendo su patrimonio.
 *
 * Bolivia se lee al lado de siete vecinos por la misma razón que en la matriz
 * energética: la cifra del Banco Mundial tiene una sola definición para todos,
 * así que la comparación no necesita ninguna conversión que nadie publicó.
 *
 * Las conclusiones se derivan, no se redactan: cada frase se arma con la
 * última lectura y aquella contra la que se mide, y cambia con ellas.
 */

import type { FxConclusion } from './fx-snapshot';
import type { MacroPoint, WorldPoint } from './series';

export type ResourceGroup = 'RENTA' | 'CANASTA' | 'AGOTAMIENTO' | 'TRANSFORMACION';

/**
 * El título de cada panel dice qué se está mirando y en qué unidad.
 *
 * La entradilla —«lo que el subsuelo deja»— es una frase de capítulo, no un
 * título de figura: encima de un dibujo de cuatro líneas obliga a bajar al
 * párrafo para saber qué mide el eje. Cada una de esas frases abre el párrafo
 * de debajo, que es su sitio. La unidad va en el título porque es la mitad de
 * la respuesta a «qué estoy viendo»: un 6 de «% del PIB» y un 6 de «% del INB»
 * son dos afirmaciones distintas y el eje sólo imprime el número.
 */
export const RESOURCE_GROUP_LABEL: Record<ResourceGroup, string> = {
  RENTA: 'Renta de cada recurso (% del PIB)',
  CANASTA: 'Composición de lo exportado (% de las mercancías)',
  AGOTAMIENTO: 'Ahorro ajustado y patrimonio consumido (% del INB)',
  TRANSFORMACION: 'Manufactura, campo e inversión fija (% del PIB)',
};

export interface ResourceIndicator {
  code: string;
  label: string;
  unit: string;
  group: ResourceGroup;
  decimals: number;
  what: string;
}

export const RESOURCE_INDICATORS: readonly ResourceIndicator[] = [
  {
    code: 'NY.GDP.MINR.RT.ZS',
    label: 'Renta minera',
    unit: '% del PIB',
    group: 'RENTA',
    decimals: 2,
    what: 'Lo que los minerales metálicos —zinc, plata, oro, estaño, plomo— dejan por encima de su costo de extracción.',
  },
  {
    code: 'NY.GDP.NGAS.RT.ZS',
    label: 'Renta del gas',
    unit: '% del PIB',
    group: 'RENTA',
    decimals: 2,
    what: 'Lo mismo para el gas natural.',
  },
  {
    code: 'NY.GDP.PETR.RT.ZS',
    label: 'Renta del petróleo',
    unit: '% del PIB',
    group: 'RENTA',
    decimals: 2,
    what: 'Lo mismo para el petróleo y sus líquidos.',
  },
  {
    code: 'NY.GDP.FRST.RT.ZS',
    label: 'Renta forestal',
    unit: '% del PIB',
    group: 'RENTA',
    decimals: 2,
    what: 'Lo que deja la madera extraída por encima del valor de reposición del bosque.',
  },
  {
    code: 'NY.GDP.COAL.RT.ZS',
    label: 'Renta del carbón',
    unit: '% del PIB',
    group: 'RENTA',
    decimals: 2,
    what: 'Lo mismo para el carbón. En Bolivia es casi cero y sirve de contraste con los vecinos que sí lo extraen.',
  },
  {
    code: 'NY.GDP.TOTL.RT.ZS',
    label: 'Renta de todos los recursos',
    unit: '% del PIB',
    group: 'RENTA',
    decimals: 2,
    what: 'Minerales, gas, petróleo, carbón y bosque sumados.',
  },
  {
    code: 'TX.VAL.MMTL.ZS.UN',
    label: 'Minerales y metales',
    unit: '% de las mercancías exportadas',
    group: 'CANASTA',
    decimals: 1,
    what: 'Peso de los minerales y metales en lo que el país vende afuera.',
  },
  {
    code: 'TX.VAL.FUEL.ZS.UN',
    label: 'Combustibles',
    unit: '% de las mercancías exportadas',
    group: 'CANASTA',
    decimals: 1,
    what: 'Peso del gas y los derivados del petróleo en lo exportado.',
  },
  {
    code: 'TX.VAL.FOOD.ZS.UN',
    label: 'Alimentos',
    unit: '% de las mercancías exportadas',
    group: 'CANASTA',
    decimals: 1,
    what: 'Soya, quinua, azúcar, carne y lo demás que se come.',
  },
  {
    code: 'TX.VAL.AGRI.ZS.UN',
    label: 'Materias primas agrícolas',
    unit: '% de las mercancías exportadas',
    group: 'CANASTA',
    decimals: 1,
    what: 'Madera, cueros y fibras: lo que sale del campo sin ser alimento.',
  },
  {
    code: 'TX.VAL.MANF.ZS.UN',
    label: 'Manufacturas',
    unit: '% de las mercancías exportadas',
    group: 'CANASTA',
    decimals: 1,
    what: 'Todo lo que salió de una fábrica. Es el complemento de lo primario: cuanto más suben los minerales, más baja esto.',
  },
  {
    code: 'NY.ADJ.DRES.GN.ZS',
    label: 'Agotamiento de recursos naturales',
    unit: '% del INB',
    group: 'AGOTAMIENTO',
    decimals: 2,
    what: 'Valor del patrimonio natural consumido en el año: lo que se extrajo y ya no está bajo tierra.',
  },
  {
    code: 'NY.ADJ.DMIN.GN.ZS',
    label: 'Agotamiento mineral',
    unit: '% del INB',
    group: 'AGOTAMIENTO',
    decimals: 2,
    what: 'La parte del agotamiento que corresponde a los minerales metálicos.',
  },
  {
    code: 'NY.ADJ.DNGY.GN.ZS',
    label: 'Agotamiento energético',
    unit: '% del INB',
    group: 'AGOTAMIENTO',
    decimals: 2,
    what: 'La parte que corresponde al gas, el petróleo y el carbón.',
  },
  {
    code: 'NY.ADJ.DFOR.GN.ZS',
    label: 'Agotamiento forestal neto',
    unit: '% del INB',
    group: 'AGOTAMIENTO',
    decimals: 2,
    what: 'Madera extraída por encima de lo que el bosque repone.',
  },
  {
    code: 'NY.ADJ.SVNX.GN.ZS',
    label: 'Ahorro neto ajustado',
    unit: '% del INB',
    group: 'AGOTAMIENTO',
    decimals: 2,
    what: 'Ahorro bruto menos la depreciación del capital y el agotamiento del subsuelo, más el gasto en educación. Negativo quiere decir que el país consume su patrimonio.',
  },
  {
    code: 'NY.ADJ.AEDU.GN.ZS',
    label: 'Gasto en educación',
    unit: '% del INB',
    group: 'AGOTAMIENTO',
    decimals: 2,
    what: 'Se suma al ahorro ajustado porque el Banco Mundial lo cuenta como inversión en capital humano, no como gasto corriente.',
  },
  {
    code: 'NY.ADJ.NNTY.PC.KD',
    label: 'Ingreso neto ajustado por habitante',
    unit: 'US$ de 2015',
    group: 'AGOTAMIENTO',
    decimals: 0,
    what: 'El ingreso por persona una vez descontados la depreciación y el agotamiento: el PIB per cápita menos lo que costó producirlo en patrimonio.',
  },
  {
    code: 'NV.IND.MANF.ZS',
    label: 'Manufactura',
    unit: '% del PIB',
    group: 'TRANSFORMACION',
    decimals: 1,
    what: 'Valor agregado de las fábricas. Es la medida de cuánto se transforma dentro del país.',
  },
  {
    code: 'NV.IND.TOTL.ZS',
    label: 'Industria con construcción',
    unit: '% del PIB',
    group: 'TRANSFORMACION',
    decimals: 1,
    what: 'Manufactura, minería, electricidad y construcción juntas. Sube con el precio de los minerales aunque no se fabrique nada nuevo.',
  },
  {
    code: 'NV.AGR.TOTL.ZS',
    label: 'Agricultura, silvicultura y pesca',
    unit: '% del PIB',
    group: 'TRANSFORMACION',
    decimals: 1,
    what: 'El otro sector que vive de un recurso natural, para ponerlo en la misma escala.',
  },
  {
    code: 'NE.GDI.FTOT.ZS',
    label: 'Inversión fija',
    unit: '% del PIB',
    group: 'TRANSFORMACION',
    decimals: 1,
    what: 'Formación bruta de capital fijo: el destino que convierte una renta en algo que dura.',
  },
];

export const RESOURCE_CODES: readonly string[] = RESOURCE_INDICATORS.map(
  (indicator) => indicator.code,
);

/** Bolivia primero, después los vecinos que el panel sostiene, en el orden en que se listan. */
export const RESOURCE_PLACES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'BOL', label: 'Bolivia' },
  { code: 'PER', label: 'Perú' },
  { code: 'CHL', label: 'Chile' },
  { code: 'ARG', label: 'Argentina' },
  { code: 'BRA', label: 'Brasil' },
  { code: 'COL', label: 'Colombia' },
  { code: 'ECU', label: 'Ecuador' },
  { code: 'PRY', label: 'Paraguay' },
];

export const RESOURCE_PLACE_CODES: readonly string[] = RESOURCE_PLACES.map((place) => place.code);

export interface YearValue {
  year: number;
  value: number;
}

/**
 * Lo que sale del país, producto por producto.
 *
 * Las rentas del Banco Mundial dicen cuánto deja el subsuelo y no cuánto sale
 * de él: son un porcentaje del PIB que no distingue el zinc del oro y cierra en
 * 2021. Esto es la declaración aduanera ante Naciones Unidas partida por
 * partida, que el núcleo recoge desde 1992 y archiva bajo el mismo rubro.
 *
 * **Dos medidas por producto.** El valor en dólares mezcla precio y volumen —el
 * mismo oro con el precio duplicado vale el doble—, y el peso neto separa las
 * dos cosas. La pregunta «cuánto se está sacando» sólo la responde el peso.
 *
 * **El litio está aquí y en ninguna otra parte del informe.** El Sistema
 * Armonizado clasifica el carbonato de litio entre los productos químicos
 * (2836.91) y no entre los minerales, así que un capítulo de minería que mire
 * sólo el capítulo 26 no lo encuentra nunca.
 */
export interface CommodityExport {
  /** El tramo del código que nombra el producto: `ZINC_ORE`, `LITHIUM_CARBONATE`. */
  slug: string;
  label: string;
  /** Dólares corrientes declarados, año a año. */
  value: YearValue[];
  /** Kilos de peso neto, donde el registro los declara. */
  weight: YearValue[];
}

/** Cómo se llama cada partida en el tablero, por su tramo del código. */
export const COMMODITY_LABEL: Record<string, string> = {
  METAL_ORES: 'Minerales metalíferos (todo el capítulo)',
  ZINC_ORE: 'Minerales de cinc',
  PRECIOUS_ORE: 'Minerales de oro y plata',
  LEAD_ORE: 'Minerales de plomo',
  TIN_ORE: 'Minerales de estaño',
  OTHER_ORE: 'Otros minerales (antimonio, wólfram)',
  GOLD: 'Oro en bruto',
  SILVER: 'Plata en bruto',
  TIN_METAL: 'Estaño en bruto',
  LEAD_METAL: 'Plomo en bruto',
  ZINC_METAL: 'Cinc en bruto',
  LITHIUM_CARBONATE: 'Carbonato de litio',
  NATURAL_GAS: 'Gas natural',
  CRUDE_OIL: 'Petróleo crudo',
  OIL_PRODUCTS: 'Derivados del petróleo',
};

/** El prefijo con el que el núcleo nombra estas series. */
const COMMODITY_PREFIX = 'COMMODITY_EXPORTS_';

/**
 * El capítulo 26 entero, que no se dibuja junto a sus propias partidas.
 *
 * Está en el corpus porque es la magnitud —cuánto mineral sale en total— y
 * porque su peso no lo declara nadie, así que no compite con el desglose en el
 * panel físico. Sumarlo con las partidas que lo componen contaría lo mismo dos
 * veces, y por eso el dibujo lo trata aparte.
 */
export const COMMODITY_CHAPTER_TOTAL = 'METAL_ORES';

/** Los productos del subsuelo, en el orden en que se leen. */
export const MINERAL_SLUGS: readonly string[] = [
  'ZINC_ORE',
  'PRECIOUS_ORE',
  'GOLD',
  'TIN_METAL',
  'LEAD_ORE',
  'SILVER',
  'TIN_ORE',
  'OTHER_ORE',
];

/** Los hidrocarburos, que se leen contra los minerales y no entre ellos. */
export const FUEL_SLUGS: readonly string[] = ['NATURAL_GAS', 'OIL_PRODUCTS', 'CRUDE_OIL'];

export const LITHIUM_SLUG = 'LITHIUM_CARBONATE';

export interface ResourceBoard {
  /** Las series de Bolivia, por código, del año más viejo al más nuevo. */
  series: Record<string, YearValue[]>;
  /**
   * Lo exportado por partida arancelaria, si el núcleo ya lo tiene cargado.
   *
   * Vacío no es un fallo. El tablero se despliega desde un repositorio distinto
   * del que migra y siembra: entre un despliegue y el otro estas series
   * sencillamente no están todavía, y el capítulo tiene que seguir dibujando
   * todo lo demás en vez de caerse o mostrar un panel en blanco.
   */
  commodities: CommodityExport[];
  /** La última lectura de cada lugar para cada indicador. */
  latest: Record<string, Record<string, YearValue>>;
  /** La historia de cada lugar, sólo en los indicadores que se dibujan contra los vecinos. */
  history: Record<string, Array<{ place: string; year: number; value: number }>>;
  conclusions: FxConclusion[];
  /** El año que trae la lectura boliviana más fresca del tablero. */
  asOfYear: number | null;
}

/** Los indicadores cuya historia entera viaja para todos los lugares, no sólo el último año. */
const COMPARED_ACROSS_PLACES = new Set([
  'NY.GDP.TOTL.RT.ZS',
  'NY.ADJ.SVNX.GN.ZS',
  'TX.VAL.MMTL.ZS.UN',
]);

const say = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

function last(series: YearValue[] | undefined): YearValue | null {
  return series?.at(-1) ?? null;
}

function peak(series: YearValue[] | undefined): YearValue | null {
  return (series ?? []).reduce<YearValue | null>(
    (best, point) => (!best || point.value > best.value ? point : best),
    null,
  );
}

function trough(series: YearValue[] | undefined): YearValue | null {
  return (series ?? []).reduce<YearValue | null>(
    (best, point) => (!best || point.value < best.value ? point : best),
    null,
  );
}

function firstYear(series: YearValue[] | undefined): string {
  return series?.[0] ? String(series[0].year) : 'el inicio de la serie';
}

const placeLabel = (code: string): string =>
  RESOURCE_PLACES.find((place) => place.code === code)?.label ?? code;

/**
 * El relevo: los minerales pasan al gas.
 *
 * Es la frase que da sentido al capítulo, así que se deriva entera y no se
 * escribe: dice cuál de las dos rentas manda hoy, por cuánto, y contra qué año
 * se mide la que cayó.
 */
function relayConclusion(series: ResourceBoard['series']): FxConclusion | null {
  const mineral = last(series['NY.GDP.MINR.RT.ZS']);
  const gas = last(series['NY.GDP.NGAS.RT.ZS']);
  if (!mineral || !gas) return null;
  const mineralPeak = peak(series['NY.GDP.MINR.RT.ZS']);
  const gasPeak = peak(series['NY.GDP.NGAS.RT.ZS']);
  const mineralLeads = mineral.value > gas.value;
  const atRecord = mineralPeak !== null && mineralPeak.year === mineral.year;
  return {
    key: 'relevo',
    claim: mineralLeads
      ? atRecord
        ? 'La renta minera es hoy la primera del subsuelo, y está en su máximo histórico'
        : 'La renta minera es hoy la primera del subsuelo'
      : 'El gas sigue dejando más que los minerales',
    figure: `${say(mineral.value, 2)} % del PIB`,
    detail:
      `En ${mineral.year} los minerales dejaron ${say(mineral.value, 2)} % del PIB por encima de su ` +
      `costo de extracción, y el gas ${say(gas.value, 2)} %.` +
      (atRecord
        ? ` Es la lectura minera más alta de la serie, que empieza en ${firstYear(series['NY.GDP.MINR.RT.ZS'])}.`
        : mineralPeak
          ? ` El máximo minero fue ${say(mineralPeak.value, 2)} % en ${mineralPeak.year}.`
          : '') +
      (gasPeak && gasPeak.year !== gas.year && gasPeak.value > 0
        ? ` La del gas tocó ${say(gasPeak.value, 2)} % en ${gasPeak.year}: hoy es ` +
          `${say((gas.value / gasPeak.value) * 100, 0)} % de aquello.`
        : ''),
    tone: 'neutral',
  };
}

/** Cuánto de lo que se vende afuera es algo que se saca de la tierra. */
function basketConclusion(series: ResourceBoard['series']): FxConclusion | null {
  const minerals = last(series['TX.VAL.MMTL.ZS.UN']);
  const fuel = last(series['TX.VAL.FUEL.ZS.UN']);
  if (!minerals || !fuel) return null;
  const manufactures = last(series['TX.VAL.MANF.ZS.UN']);
  const food = last(series['TX.VAL.FOOD.ZS.UN']);
  const extractive = minerals.value + fuel.value;
  const mineralsTrough = trough(series['TX.VAL.MMTL.ZS.UN']);
  return {
    key: 'canasta',
    claim:
      extractive >= 50
        ? 'Más de la mitad de lo que Bolivia vende afuera sale de un pozo o de una mina'
        : 'La canasta exportadora ya no es mayoritariamente extractiva',
    figure: `${say(extractive)} % extractivo`,
    detail:
      `En ${minerals.year}, ${say(minerals.value)} % de las mercancías exportadas fueron minerales y ` +
      `metales y ${say(fuel.value)} % combustibles` +
      (food ? `; los alimentos fueron ${say(food.value)} %` : '') +
      (manufactures ? ` y las manufacturas ${say(manufactures.value)} %` : '') +
      `.` +
      (mineralsTrough && mineralsTrough.year !== minerals.year
        ? ` El peso mineral tocó su piso en ${mineralsTrough.year}, con ${say(mineralsTrough.value)} %, ` +
          `cuando el gas mandaba en la canasta.`
        : ''),
    tone: extractive >= 50 ? 'adverse' : 'neutral',
  };
}

/**
 * El hallazgo: el ahorro neto ajustado.
 *
 * Es la única serie del capítulo que responde a «¿en qué se convierte?» con un
 * número y no con un relato, y por eso lleva el tono. Negativo significa que lo
 * que se extrae del subsuelo no se está reponiendo con capital de ningún otro
 * tipo.
 */
function savingsConclusion(series: ResourceBoard['series']): FxConclusion | null {
  const savings = last(series['NY.ADJ.SVNX.GN.ZS']);
  if (!savings) return null;
  const best = peak(series['NY.ADJ.SVNX.GN.ZS']);
  const depletion = last(series['NY.ADJ.DRES.GN.ZS']);
  const education = last(series['NY.ADJ.AEDU.GN.ZS']);
  const lowest = trough(series['NY.ADJ.SVNX.GN.ZS']);
  const negative = savings.value < 0;
  return {
    key: 'ahorro',
    claim: negative
      ? 'Descontado lo que se saca del subsuelo, el país desahorra'
      : 'El ahorro del país sigue siendo positivo una vez descontado el subsuelo',
    figure: `${say(savings.value, 2)} % del INB`,
    detail:
      `El ahorro neto ajustado de ${savings.year} fue ${say(savings.value, 2)} % del ingreso nacional ` +
      `bruto: el ahorro del año menos la depreciación del capital y ` +
      (depletion ? `el agotamiento de recursos (${say(depletion.value, 2)} %)` : 'el agotamiento') +
      (education ? `, más el gasto en educación (${say(education.value, 2)} %)` : '') +
      `.` +
      (lowest && lowest.year === savings.year
        ? ` Es el valor más bajo de la serie, que empieza en ${firstYear(series['NY.ADJ.SVNX.GN.ZS'])}.`
        : '') +
      (best && best.year !== savings.year
        ? ` Su máximo fue ${say(best.value, 2)} % en ${best.year}, en pleno auge del gas.`
        : ''),
    tone: negative ? 'adverse' : 'favourable',
  };
}

/** Qué parte del patrimonio se consumió en el año y de dónde salió. */
function depletionConclusion(series: ResourceBoard['series']): FxConclusion | null {
  const total = last(series['NY.ADJ.DRES.GN.ZS']);
  if (!total) return null;
  const mineral = last(series['NY.ADJ.DMIN.GN.ZS']);
  const energy = last(series['NY.ADJ.DNGY.GN.ZS']);
  const forest = last(series['NY.ADJ.DFOR.GN.ZS']);
  const mineralPeak = peak(series['NY.ADJ.DMIN.GN.ZS']);
  const mineralLeads = (mineral?.value ?? 0) > (energy?.value ?? 0);
  /*
   * Un sumando que redondea a cero no se escribe.
   *
   * El agotamiento forestal boliviano da 0,00 % en las últimas lecturas —el
   * bosque que se tumba no se vende como madera—, y «y 0,00 % forestal» al
   * final de la frase se lee como un dato cuando es la ausencia de uno.
   */
  const shownForest = forest && forest.value >= 0.005 ? forest : null;
  return {
    key: 'agotamiento',
    claim: mineralLeads
      ? 'La mina agota más patrimonio que el pozo'
      : 'El pozo agota más patrimonio que la mina',
    figure: `${say(total.value, 2)} % del INB`,
    detail:
      `En ${total.year} el patrimonio natural consumido fue ${say(total.value, 2)} % del ingreso ` +
      `nacional bruto` +
      (mineral ? `: ${say(mineral.value, 2)} % mineral` : '') +
      (energy ? ` y ${say(energy.value, 2)} % energético` : '') +
      (shownForest ? `, más ${say(shownForest.value, 2)} % forestal` : '') +
      `.` +
      (mineralPeak && mineral && mineralPeak.year === mineral.year
        ? ' El agotamiento mineral está en su máximo de la serie.'
        : ''),
    tone: 'neutral',
  };
}

/** Si la renta se transforma dentro del país o sale como entró. */
function transformationConclusion(series: ResourceBoard['series']): FxConclusion | null {
  const manufacturing = last(series['NV.IND.MANF.ZS']);
  if (!manufacturing) return null;
  const best = peak(series['NV.IND.MANF.ZS']);
  const investment = last(series['NE.GDI.FTOT.ZS']);
  const agriculture = last(series['NV.AGR.TOTL.ZS']);
  const shrinking = best !== null && best.year !== manufacturing.year;
  return {
    key: 'transformacion',
    claim: shrinking
      ? 'La fábrica pesa menos en el PIB que cuando la renta era menor'
      : 'La manufactura está en su punto más alto del PIB',
    figure: `${say(manufacturing.value)} % del PIB`,
    detail:
      `La manufactura fue ${say(manufacturing.value)} % del PIB en ${manufacturing.year}` +
      (best && best.year !== manufacturing.year
        ? `, contra ${say(best.value)} % en ${best.year}`
        : '') +
      (agriculture ? `; la agricultura, ${say(agriculture.value)} %` : '') +
      `.` +
      (investment
        ? ` La inversión fija —el destino que convierte una renta en algo que dura— fue ` +
          `${say(investment.value)} % del PIB en ${investment.year}.`
        : ''),
    tone: shrinking ? 'adverse' : 'favourable',
  };
}

/** Dónde queda Bolivia entre los vecinos que también viven del subsuelo. */
function neighboursConclusion(board: Pick<ResourceBoard, 'series' | 'latest'>): FxConclusion | null {
  const own = last(board.series['NY.GDP.TOTL.RT.ZS']);
  if (!own) return null;
  const others = Object.entries(board.latest['NY.GDP.TOTL.RT.ZS'] ?? {})
    .filter(([place]) => place !== 'BOL')
    .map(([place, reading]) => ({ place, value: reading.value }))
    .sort((left, right) => right.value - left.value);
  if (!others.length) return null;
  const above = others.filter((entry) => entry.value > own.value).length;
  const savings = board.latest['NY.ADJ.SVNX.GN.ZS'] ?? {};
  const negatives = Object.entries(savings).filter(([, reading]) => reading.value < 0);
  return {
    key: 'vecinos',
    claim:
      above === 0
        ? 'Ningún vecino del panel depende tanto de su subsuelo como Bolivia'
        : 'Bolivia está entre los vecinos que más dependen de su subsuelo',
    figure: `${say(own.value, 2)} % del PIB`,
    detail:
      `La renta de todos los recursos fue ${say(own.value, 2)} % del PIB en ${own.year}; ` +
      `${above} de los ${others.length} vecinos del panel tienen una mayor` +
      (others[0]
        ? `, ${placeLabel(others[0].place)} la más alta con ${say(others[0].value, 2)} %`
        : '') +
      `.` +
      (negatives.length
        ? ` Con el ahorro neto ajustado en negativo aparecen ${negatives.length} de los ` +
          `${Object.keys(savings).length} países del tablero: ` +
          `${negatives.map(([place]) => placeLabel(place)).join(', ')}.`
        : ''),
    tone: 'neutral',
  };
}

/**
 * Lo exportado por producto, sacado de las series medidas del observatorio.
 *
 * Se reconocen por prefijo y no por una lista escrita aquí: el catálogo de
 * partidas vive en el núcleo y crece, y una lista en el tablero sería una
 * segunda copia que hay que acordarse de ampliar. Lo que el tablero sí decide
 * es cómo se llama cada una y en qué panel entra.
 */
function readCommodities(measured: readonly MacroPoint[]): CommodityExport[] {
  const byCommodity = new Map<string, CommodityExport>();
  for (const point of measured) {
    if (!point.indicatorCode.startsWith(COMMODITY_PREFIX)) continue;
    if (!Number.isFinite(point.value)) continue;
    const tail = point.indicatorCode.slice(COMMODITY_PREFIX.length);
    const measure = tail.endsWith('_KG') ? 'KG' : tail.endsWith('_USD') ? 'USD' : null;
    if (measure === null) continue;
    const slug = tail.slice(0, -(measure.length + 1));
    const own = byCommodity.get(slug) ?? {
      slug,
      label: COMMODITY_LABEL[slug] ?? point.name ?? slug,
      value: [],
      weight: [],
    };
    const year = Number(point.period);
    if (Number.isFinite(year)) {
      (measure === 'USD' ? own.value : own.weight).push({ year, value: point.value });
    }
    byCommodity.set(slug, own);
  }
  for (const commodity of byCommodity.values()) {
    commodity.value.sort((left, right) => left.year - right.year);
    commodity.weight.sort((left, right) => left.year - right.year);
  }
  return [...byCommodity.values()];
}

/**
 * El litio, que hasta ahora no estaba en ninguna cifra del informe.
 *
 * Se mide en toneladas y no en dólares porque el precio del carbonato hizo un
 * pico en 2022 que multiplica el valor sin que salga un gramo más: la serie en
 * dinero cuenta el mercado mundial, la serie en peso cuenta lo que Bolivia
 * produce. Las dos van en la frase, en ese orden.
 */
function lithiumConclusion(commodities: readonly CommodityExport[]): FxConclusion | null {
  const lithium = commodities.find((one) => one.slug === LITHIUM_SLUG);
  const weight = last(lithium?.weight);
  const value = last(lithium?.value);
  if (!lithium || !weight || !value) return null;
  const firstWeight = lithium.weight[0];
  const tonnes = weight.value / 1_000;
  const heaviest = peak(lithium.weight);
  const perTonne = tonnes > 0 ? value.value / tonnes : null;
  return {
    key: 'litio',
    claim:
      heaviest && heaviest.year === weight.year
        ? 'El litio ya sale del país, y nunca salió tanto como el último año medido'
        : 'El litio ya sale del país, por debajo de su propio máximo',
    figure: `${say(tonnes, 0)} t`,
    detail:
      `En ${weight.year} Bolivia exportó ${say(tonnes, 0)} toneladas de carbonato de litio por ` +
      `${say(value.value / 1_000_000, 1)} millones de dólares` +
      (perTonne ? `, unos ${say(perTonne, 0)} dólares la tonelada` : '') +
      `.` +
      (firstWeight && firstWeight.year !== weight.year
        ? ` La primera declaración de la serie es de ${firstWeight.year}, con ` +
          `${say(firstWeight.value / 1_000, 0)} toneladas.`
        : '') +
      ` Es una partida química (2836.91) y no mineral, que es la razón por la que no aparece en ` +
      `ninguna cuenta de minería.`,
    tone: 'neutral',
  };
}

/**
 * Qué mineral pesa más en lo que se vende, y cuál lo desplazó.
 *
 * En valor y no en peso: aquí la pregunta es de qué vive el país, y una
 * tonelada de concentrado de zinc y una de oro no son la misma plata.
 */
function mineralMixConclusion(commodities: readonly CommodityExport[]): FxConclusion | null {
  const ranked = commodities
    .filter((one) => MINERAL_SLUGS.includes(one.slug))
    .flatMap((one) => {
      const reading = last(one.value);
      return reading ? [{ label: one.label, year: reading.year, value: reading.value }] : [];
    })
    .sort((left, right) => right.value - left.value);
  const leader = ranked[0];
  if (!leader) return null;
  const total = ranked.reduce((sum, entry) => sum + entry.value, 0);
  const second = ranked[1];
  return {
    key: 'productos',
    claim: `La primera partida minera del país es «${leader.label}»`,
    figure: `${say(leader.value / 1_000_000, 0)} millones de US$`,
    detail:
      `En ${leader.year} esa partida sumó ${say(leader.value / 1_000_000, 0)} millones de dólares` +
      (total > 0
        ? `, ${say((leader.value / total) * 100, 0)} % de las ${ranked.length} partidas mineras`
        : '') +
      (second
        ? `; detrás va «${second.label}», con ${say(second.value / 1_000_000, 0)} millones`
        : '') +
      `. Son cifras declaradas en aduana, no estimaciones.`,
    tone: 'neutral',
  };
}

/**
 * El tablero, armado con el panel del Banco Mundial y las series medidas.
 *
 * Dos corpus y no uno porque responden a dos preguntas distintas: el panel dice
 * cuánto deja el subsuelo y con qué se compara en la región; la declaración
 * aduanera dice cuánto sale y de qué producto. `measured` es opcional porque
 * esas series llegan al tablero desde el otro repositorio y puede no haberlas
 * todavía.
 */
export function buildResourceBoard(
  points: readonly WorldPoint[],
  measured: readonly MacroPoint[] = [],
): ResourceBoard {
  const series: Record<string, YearValue[]> = {};
  const latest: Record<string, Record<string, YearValue>> = {};
  const history: Record<string, Array<{ place: string; year: number; value: number }>> = {};

  for (const point of points) {
    if (!Number.isFinite(point.value)) continue;
    if (point.place === 'BOL') {
      (series[point.indicatorCode] ??= []).push({ year: point.year, value: point.value });
    }
    if (COMPARED_ACROSS_PLACES.has(point.indicatorCode)) {
      (history[point.indicatorCode] ??= []).push({
        place: point.place,
        year: point.year,
        value: point.value,
      });
    }
    const byPlace = (latest[point.indicatorCode] ??= {});
    const current = byPlace[point.place];
    if (!current || point.year > current.year)
      byPlace[point.place] = { year: point.year, value: point.value };
  }

  for (const code of Object.keys(series)) {
    series[code]?.sort((left, right) => left.year - right.year);
  }

  const commodities = readCommodities(measured);
  const partial = { series, latest };
  /*
   * El relevo primero y el litio en tercer lugar, no por importancia sino por
   * escala: el litio son veintidós millones de dólares al lado de una renta
   * minera de miles, y abrir con él daría la proporción al revés.
   */
  const conclusions = [
    relayConclusion(series),
    basketConclusion(series),
    mineralMixConclusion(commodities),
    lithiumConclusion(commodities),
    savingsConclusion(series),
    depletionConclusion(series),
    transformationConclusion(series),
    neighboursConclusion(partial),
  ].filter((entry): entry is FxConclusion => entry !== null);

  const asOfYear = [
    ...Object.values(series).map((own) => own.at(-1)?.year ?? 0),
    ...commodities.map((one) => one.value.at(-1)?.year ?? 0),
  ].reduce((best, year) => Math.max(best, year), 0);

  return { series, latest, history, commodities, conclusions, asOfYear: asOfYear || null };
}

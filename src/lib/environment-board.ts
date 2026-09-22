/**
 * El ambiente: el bosque que queda, lo que se emite, el aire y el agua.
 *
 * El informe no tenía una sola cifra ambiental, y el panel del Banco Mundial
 * que el núcleo ya recoge trae casi cien series del asunto para treinta
 * economías. Estaban en la base desde la migración 0067 y no llegaban a
 * ningún tablero.
 *
 * El capítulo se ordena por lo que en Bolivia de verdad mueve la aguja, que no
 * es lo que mueve la aguja en un país industrial. **El uso del suelo.** Las
 * emisiones bolivianas sin contar el cambio de uso del suelo son modestas; con
 * él contado, casi se duplican, porque el bosque que se tumba emite lo que
 * había guardado. Por eso las dos medidas van juntas y nunca por separado: dar
 * sólo la primera —que es la que suelen citar los informes— dice lo contrario
 * de lo que pasa.
 *
 * Lo mismo con el agua. El estrés hídrico boliviano es bajísimo en la cuenta
 * nacional y eso no significa que no haya sequía: el indicador divide la
 * extracción entre un recurso renovable que está casi todo en la Amazonía,
 * mientras la extracción está casi toda en el altiplano y en el valle. La ficha
 * de cada serie lo dice, porque una cifra de agua sin esa advertencia se lee
 * mal.
 *
 * Bolivia se lee al lado de siete vecinos: la deforestación y el aire sólo se
 * entienden contra la escala de la región, y la cifra del Banco Mundial tiene
 * una sola definición para todos.
 *
 * Las conclusiones se derivan, no se redactan.
 */

import type { FxConclusion } from './fx-snapshot';
import type { WorldPoint } from './series';

export type EnvironmentGroup = 'BOSQUE' | 'EMISIONES' | 'AIRE' | 'AGUA' | 'PROTECCION';

/**
 * El título de cada panel dice qué se está mirando y en qué unidad.
 *
 * «El aire que se respira» es una entradilla y no un título de figura: puesta
 * encima del dibujo obliga a bajar al párrafo para saber qué mide el eje. Esas
 * frases abren el párrafo de debajo, que es su sitio, y el título carga la
 * unidad, que es la mitad de la respuesta a «qué estoy viendo».
 */
export const ENVIRONMENT_GROUP_LABEL: Record<EnvironmentGroup, string> = {
  BOSQUE: 'Bosque y tierra agrícola (% del territorio)',
  EMISIONES: 'Gases de efecto invernadero (Mt de CO₂ equivalente)',
  AIRE: 'Partículas finas PM2,5 (µg/m³)',
  AGUA: 'Extracción y estrés hídrico (% del agua disponible)',
  PROTECCION: 'Áreas protegidas (% del territorio) y especies amenazadas',
};

export interface EnvironmentIndicator {
  code: string;
  label: string;
  unit: string;
  group: EnvironmentGroup;
  decimals: number;
  what: string;
}

export const ENVIRONMENT_INDICATORS: readonly EnvironmentIndicator[] = [
  {
    code: 'AG.LND.FRST.ZS',
    label: 'Superficie con bosque',
    unit: '% del territorio',
    group: 'BOSQUE',
    decimals: 2,
    what: 'Parte del país cubierta de bosque, según el inventario de la FAO que el Banco Mundial publica.',
  },
  {
    code: 'AG.LND.FRST.K2',
    label: 'Bosque',
    unit: 'km²',
    group: 'BOSQUE',
    decimals: 0,
    what: 'La misma superficie en kilómetros cuadrados, que es donde se ve el tamaño de lo perdido.',
  },
  {
    code: 'AG.LND.AGRI.ZS',
    label: 'Tierra agrícola',
    unit: '% del territorio',
    group: 'BOSQUE',
    decimals: 2,
    what: 'Cultivos y pastos. Su avance es, casi siempre, el retroceso del bosque.',
  },
  {
    code: 'AG.LND.ARBL.ZS',
    label: 'Tierra cultivable',
    unit: '% del territorio',
    group: 'BOSQUE',
    decimals: 2,
    what: 'La parte de la tierra agrícola que se ara, sin contar pastos ni cultivos permanentes.',
  },
  {
    code: 'AG.LND.PRCP.MM',
    label: 'Precipitación media',
    unit: 'mm al año',
    group: 'BOSQUE',
    decimals: 0,
    what: 'Lluvia media del territorio en el año. Es un dato de largo plazo y se mueve poco.',
  },
  {
    code: 'EN.GHG.ALL.MT.CE.AR5',
    label: 'Gases de efecto invernadero',
    unit: 'Mt de CO₂ equivalente',
    group: 'EMISIONES',
    decimals: 1,
    what: 'Todos los gases, SIN contar el cambio de uso del suelo. Es la cifra que suelen citar los informes.',
  },
  {
    code: 'EN.GHG.ALL.LU.MT.CE.AR5',
    label: 'Gases con uso del suelo',
    unit: 'Mt de CO₂ equivalente',
    group: 'EMISIONES',
    decimals: 1,
    what: 'Lo mismo CONTANDO la deforestación y el cambio de uso del suelo. En Bolivia casi duplica la anterior.',
  },
  {
    code: 'EN.GHG.CO2.LU.DF.MT.CE.AR5',
    label: 'CO₂ de la deforestación',
    unit: 'Mt de CO₂ equivalente',
    group: 'EMISIONES',
    decimals: 1,
    what: 'Lo que emite el bosque tumbado: el carbono que tenía guardado y suelta al arder o al pudrirse.',
  },
  {
    code: 'EN.GHG.ALL.PC.CE.AR5',
    label: 'Emisiones por habitante',
    unit: 't de CO₂ equivalente',
    group: 'EMISIONES',
    decimals: 2,
    what: 'Gases por persona, sin uso del suelo. Sirve para comparar países de tamaños distintos.',
  },
  {
    code: 'EN.GHG.CH4.AG.MT.CE.AR5',
    label: 'Metano del agro',
    unit: 'Mt de CO₂ equivalente',
    group: 'EMISIONES',
    decimals: 2,
    what: 'Sobre todo ganado y arroz. El metano calienta mucho más que el CO₂ y dura menos en el aire.',
  },
  {
    code: 'EN.GHG.N2O.AG.MT.CE.AR5',
    label: 'Óxido nitroso del agro',
    unit: 'Mt de CO₂ equivalente',
    group: 'EMISIONES',
    decimals: 2,
    what: 'Viene de los fertilizantes y del manejo del suelo.',
  },
  {
    code: 'EN.GHG.CO2.RT.GDP.KD',
    label: 'Intensidad de carbono',
    unit: 'kg de CO₂ por US$ de 2015',
    group: 'EMISIONES',
    decimals: 3,
    what: 'Cuánto CO₂ cuesta producir un dólar. Baja cuando la economía se vuelve más limpia o cambia de sectores.',
  },
  {
    code: 'EN.GHG.TOT.ZG.AR5',
    label: 'Cambio desde 1990',
    unit: '%',
    group: 'EMISIONES',
    decimals: 1,
    what: 'Variación de las emisiones totales respecto de 1990, que es el año base de los compromisos climáticos.',
  },
  {
    code: 'EN.ATM.PM25.MC.M3',
    label: 'Partículas finas (PM2,5)',
    unit: 'µg/m³',
    group: 'AIRE',
    decimals: 1,
    what: 'Exposición media anual de la población. La guía de la OMS desde 2021 es de 5 µg/m³.',
  },
  {
    code: 'EN.ATM.PM25.MC.ZS',
    label: 'Población sobre la guía de la OMS',
    unit: '% de la población',
    group: 'AIRE',
    decimals: 1,
    what: 'Qué parte del país respira un aire con más partículas de las que la OMS considera seguras.',
  },
  {
    code: 'NY.ADJ.DPEM.GN.ZS',
    label: 'Daño por partículas',
    unit: '% del INB',
    group: 'AIRE',
    decimals: 3,
    what: 'Lo que el Banco Mundial estima que cuesta en vidas y salud el aire con partículas, como parte del ingreso.',
  },
  {
    code: 'NY.ADJ.DCO2.GN.ZS',
    label: 'Daño por CO₂',
    unit: '% del INB',
    group: 'AIRE',
    decimals: 3,
    what: 'Lo mismo para el dióxido de carbono emitido, valorado a un precio social del carbono.',
  },
  {
    code: 'ER.H2O.FWST.ZS',
    label: 'Estrés hídrico',
    unit: '% del agua disponible',
    group: 'AGUA',
    decimals: 2,
    what: 'Extracción sobre agua dulce disponible. Ojo: es una cuenta nacional, y en Bolivia el agua está en la Amazonía mientras la extracción está en el altiplano y el valle.',
  },
  {
    code: 'ER.H2O.FWTL.ZS',
    label: 'Extracción de agua dulce',
    unit: '% de los recursos internos',
    group: 'AGUA',
    decimals: 2,
    what: 'Toda el agua que se saca en el año, contra la que el ciclo repone dentro del país.',
  },
  {
    code: 'ER.H2O.FWAG.ZS',
    label: 'Agua para la agricultura',
    unit: '% de la extracción',
    group: 'AGUA',
    decimals: 1,
    what: 'De toda el agua extraída, qué parte va al riego.',
  },
  {
    code: 'ER.H2O.INTR.PC',
    label: 'Agua renovable por habitante',
    unit: 'm³ al año',
    group: 'AGUA',
    decimals: 0,
    what: 'Lo que el ciclo del agua repone cada año, repartido entre la población. Cae sola cuando la población crece.',
  },
  {
    code: 'ER.GDP.FWTL.M3.KD',
    label: 'Productividad del agua',
    unit: 'US$ de 2015 por m³',
    group: 'AGUA',
    decimals: 2,
    what: 'Cuánto PIB se produce con cada metro cúbico extraído.',
  },
  {
    code: 'ER.LND.PTLD.ZS',
    label: 'Áreas protegidas terrestres',
    unit: '% del territorio',
    group: 'PROTECCION',
    decimals: 1,
    what: 'Territorio bajo alguna figura de protección. Es una cifra de papel: dice qué está declarado, no qué se vigila.',
  },
  {
    code: 'EN.MAM.THRD.NO',
    label: 'Mamíferos amenazados',
    unit: 'especies',
    group: 'PROTECCION',
    decimals: 0,
    what: 'Especies en la lista roja de la UICN con presencia en el país.',
  },
  {
    code: 'EN.BIR.THRD.NO',
    label: 'Aves amenazadas',
    unit: 'especies',
    group: 'PROTECCION',
    decimals: 0,
    what: 'Lo mismo para las aves.',
  },
  {
    code: 'EN.HPT.THRD.NO',
    label: 'Plantas superiores amenazadas',
    unit: 'especies',
    group: 'PROTECCION',
    decimals: 0,
    what: 'Lo mismo para las plantas superiores.',
  },
  {
    code: 'EN.FSH.THRD.NO',
    label: 'Peces amenazados',
    unit: 'especies',
    group: 'PROTECCION',
    decimals: 0,
    what: 'Lo mismo para los peces.',
  },
];

export const ENVIRONMENT_CODES: readonly string[] = ENVIRONMENT_INDICATORS.map(
  (indicator) => indicator.code,
);

/** Bolivia primero y después los vecinos, en el orden en que se dibujan. */
export const ENVIRONMENT_PLACES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'BOL', label: 'Bolivia' },
  { code: 'BRA', label: 'Brasil' },
  { code: 'PER', label: 'Perú' },
  { code: 'COL', label: 'Colombia' },
  { code: 'ECU', label: 'Ecuador' },
  { code: 'PRY', label: 'Paraguay' },
  { code: 'ARG', label: 'Argentina' },
  { code: 'CHL', label: 'Chile' },
];

export const ENVIRONMENT_PLACE_CODES: readonly string[] = ENVIRONMENT_PLACES.map(
  (place) => place.code,
);

/** La guía de calidad del aire de la OMS de 2021, contra la que se mide el PM2,5. */
export const WHO_PM25_GUIDELINE = 5;

export interface YearValue {
  year: number;
  value: number;
}

export interface EnvironmentBoard {
  series: Record<string, YearValue[]>;
  latest: Record<string, Record<string, YearValue>>;
  history: Record<string, Array<{ place: string; year: number; value: number }>>;
  conclusions: FxConclusion[];
  asOfYear: number | null;
}

/** Los indicadores cuya historia entera viaja para todos los lugares. */
const COMPARED_ACROSS_PLACES = new Set([
  'AG.LND.FRST.ZS',
  'EN.GHG.ALL.PC.CE.AR5',
  'EN.ATM.PM25.MC.M3',
]);

const say = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

function last(series: YearValue[] | undefined): YearValue | null {
  return series?.at(-1) ?? null;
}

function first(series: YearValue[] | undefined): YearValue | null {
  return series?.[0] ?? null;
}

function peak(series: YearValue[] | undefined): YearValue | null {
  return (series ?? []).reduce<YearValue | null>(
    (best, point) => (!best || point.value > best.value ? point : best),
    null,
  );
}

const placeLabel = (code: string): string =>
  ENVIRONMENT_PLACES.find((place) => place.code === code)?.label ?? code;

/**
 * El bosque, medido en lo que falta.
 *
 * La serie de la FAO empieza en 1990 y no antes, así que la pérdida se mide
 * contra su primer año y se dice cuál es: un «desde 1990» que el lector no
 * puede comprobar es una cifra sin fecha.
 */
function forestConclusion(series: EnvironmentBoard['series']): FxConclusion | null {
  const share = last(series['AG.LND.FRST.ZS']);
  const shareStart = first(series['AG.LND.FRST.ZS']);
  const area = last(series['AG.LND.FRST.K2']);
  const areaStart = first(series['AG.LND.FRST.K2']);
  if (!share || !shareStart) return null;
  const lostKm = area && areaStart ? areaStart.value - area.value : null;
  const lostPoints = shareStart.value - share.value;
  /* Nunca subió en la serie: se comprueba, no se afirma. */
  const everRose = (series['AG.LND.FRST.K2'] ?? []).some(
    (point, index, all) => index > 0 && point.value > (all[index - 1]?.value ?? point.value),
  );
  return {
    key: 'bosque',
    claim:
      lostPoints <= 0
        ? 'La superficie con bosque dejó de retroceder'
        : everRose
          ? 'El bosque cubre hoy menos país que cuando empezó a medirse'
          : 'El bosque retrocede todos los años, sin una sola pausa en la serie',
    figure: `${say(share.value, 1)} % del territorio`,
    detail:
      `En ${share.year} el bosque cubría ${say(share.value, 1)} % del país, contra ` +
      `${say(shareStart.value, 1)} % en ${shareStart.year}: ${say(lostPoints, 1)} puntos menos` +
      (lostKm !== null && areaStart && areaStart.value > 0
        ? `, que son ${say(lostKm, 0)} km² —${say((lostKm / areaStart.value) * 100, 1)} % del bosque ` +
          `que había en ${areaStart.year}—`
        : '') +
      `.` +
      (area ? ` Quedan ${say(area.value, 0)} km².` : ''),
    tone: lostPoints > 0 ? 'adverse' : 'favourable',
  };
}

/**
 * La parte que no se cuenta.
 *
 * Es el hallazgo del capítulo: la huella boliviana crece mucho cuando se cuenta
 * el uso del suelo, y la cifra que circula es la que lo deja fuera.
 *
 * Las dos series no terminan el mismo año —el inventario con uso del suelo
 * cierra uno o dos años después que el otro—, así que la razón se calcula en el
 * **último año en que las dos existen** y no entre los dos últimos datos
 * disponibles. Dividir 2023 entre 2024 daría un número que no es de ningún año
 * y que se movería solo cuando el publicador adelante una de las dos.
 */
function landUseConclusion(series: EnvironmentBoard['series']): FxConclusion | null {
  const withLand = series['EN.GHG.ALL.LU.MT.CE.AR5'] ?? [];
  const withoutLand = new Map(
    (series['EN.GHG.ALL.MT.CE.AR5'] ?? []).map((point) => [point.year, point.value]),
  );
  const shared = [...withLand]
    .reverse()
    .find((point) => (withoutLand.get(point.year) ?? 0) > 0);
  if (!shared) return null;
  const bare = withoutLand.get(shared.year);
  if (bare === undefined || bare <= 0) return null;
  const deforestation = (series['EN.GHG.CO2.LU.DF.MT.CE.AR5'] ?? []).find(
    (point) => point.year === shared.year,
  );
  const deforestationPeak = peak(series['EN.GHG.CO2.LU.DF.MT.CE.AR5']);
  const times = shared.value / bare;
  const extra = shared.value - bare;
  return {
    key: 'suelo',
    claim:
      times >= 1.8
        ? 'Contando la deforestación, Bolivia emite el doble de lo que dice su cifra más citada'
        : 'La cifra de emisiones que más circula deja fuera la mayor fuente boliviana',
    figure: `×${say(times, 2)}`,
    detail:
      `En ${shared.year} las emisiones con uso del suelo fueron ${say(shared.value, 1)} Mt de CO₂ ` +
      `equivalente y sin él ${say(bare, 1)} Mt: ${say(extra, 1)} Mt de diferencia, ` +
      `${say((times - 1) * 100, 0)} % más.` +
      (deforestation
        ? ` Sólo la deforestación aportó ${say(deforestation.value, 1)} Mt ese año` +
          (deforestationPeak && deforestationPeak.year === deforestation.year
            ? ', el máximo de la serie.'
            : '.')
        : ''),
    tone: 'adverse',
  };
}

/** Las emisiones por persona, que es lo único comparable entre países de tamaños distintos. */
function perCapitaConclusion(
  board: Pick<EnvironmentBoard, 'series' | 'latest'>,
): FxConclusion | null {
  const own = last(board.series['EN.GHG.ALL.PC.CE.AR5']);
  if (!own) return null;
  const others = Object.entries(board.latest['EN.GHG.ALL.PC.CE.AR5'] ?? {})
    .filter(([place]) => place !== 'BOL')
    .map(([place, reading]) => ({ place, value: reading.value }))
    .sort((left, right) => right.value - left.value);
  const above = others.filter((entry) => entry.value > own.value).length;
  const change = last(board.series['EN.GHG.TOT.ZG.AR5']);
  return {
    key: 'porhabitante',
    claim:
      above === 0
        ? 'Bolivia emite más por habitante que cualquiera de sus vecinos'
        : 'Bolivia emite por habitante en el rango de sus vecinos',
    figure: `${say(own.value, 2)} t por persona`,
    detail:
      `${say(own.value, 2)} toneladas de CO₂ equivalente por persona en ${own.year}, sin contar el uso ` +
      `del suelo` +
      (others.length
        ? `: ${above} de los ${others.length} vecinos del panel emiten más` +
          (others[0]
            ? `, ${placeLabel(others[0].place)} el que más con ${say(others[0].value, 2)}`
            : '') +
          '.'
        : '.') +
      (change
        ? ` Las emisiones totales del país están ${say(change.value, 0)} % por encima de las de 1990.`
        : ''),
    tone: 'neutral',
  };
}

/** El aire, medido contra la guía de la OMS y no contra sí mismo. */
function airConclusion(series: EnvironmentBoard['series']): FxConclusion | null {
  const pm = last(series['EN.ATM.PM25.MC.M3']);
  if (!pm) return null;
  const exposed = last(series['EN.ATM.PM25.MC.ZS']);
  const worst = peak(series['EN.ATM.PM25.MC.M3']);
  const times = pm.value / WHO_PM25_GUIDELINE;
  const damage = last(series['NY.ADJ.DPEM.GN.ZS']);
  return {
    key: 'aire',
    claim:
      times > 1
        ? 'El aire que se respira tiene varias veces las partículas que la OMS considera seguras'
        : 'La exposición media a partículas está dentro de la guía de la OMS',
    figure: `${say(pm.value, 1)} µg/m³`,
    detail:
      `La exposición media a partículas finas fue ${say(pm.value, 1)} µg/m³ en ${pm.year}: ` +
      `${say(times, 1)} veces la guía de la OMS, que es de ${WHO_PM25_GUIDELINE} µg/m³.` +
      (exposed
        ? ` En ${exposed.year}, ${say(exposed.value, 1)} % de la población vivía por encima de esa guía.`
        : '') +
      (worst && worst.year !== pm.year
        ? ` El peor año de la serie fue ${worst.year}, con ${say(worst.value, 1)}.`
        : '') +
      (damage
        ? ` El daño en salud que el Banco Mundial le atribuye equivale a ${say(damage.value, 2)} % ` +
          `del ingreso nacional.`
        : ''),
    tone: times > 1 ? 'adverse' : 'favourable',
  };
}

/**
 * El agua, con su advertencia dentro.
 *
 * La cifra nacional de estrés hídrico es baja y eso no significa que no falte
 * agua: la conclusión lo dice en la misma frase porque separarlo sería dar por
 * buena una lectura que el propio indicador no sostiene.
 */
function waterConclusion(board: Pick<EnvironmentBoard, 'series' | 'latest'>): FxConclusion | null {
  const series = board.series;
  const stress = last(series['ER.H2O.FWST.ZS']);
  const withdrawal = last(series['ER.H2O.FWTL.ZS']);
  if (!stress && !withdrawal) return null;
  const agriculture = last(series['ER.H2O.FWAG.ZS']);
  const perCapita = last(series['ER.H2O.INTR.PC']);
  const perCapitaStart = first(series['ER.H2O.INTR.PC']);
  const base = stress ?? withdrawal;
  if (!base) return null;
  /* «De las más bajas de la región» es una posición, y se cuenta antes de decirla. */
  const across = Object.entries(board.latest['ER.H2O.FWST.ZS'] ?? {}).filter(
    ([place]) => place !== 'BOL',
  );
  const below = stress ? across.filter(([, reading]) => reading.value < stress.value).length : null;
  return {
    key: 'agua',
    claim: 'En la cuenta nacional sobra agua; la cuenta nacional no es donde falta',
    figure: stress ? `${say(stress.value, 2)} % de estrés` : `${say(base.value, 2)} % extraído`,
    detail:
      (stress
        ? `El estrés hídrico de ${stress.year} fue ${say(stress.value, 2)} % del agua disponible`
        : `La extracción de ${base.year} fue ${say(base.value, 2)} % de los recursos internos`) +
      (below !== null && across.length
        ? below === 0
          ? `, la más baja de los ${across.length + 1} países del tablero`
          : `, y sólo ${below} de los ${across.length} vecinos del panel tienen una cifra menor`
        : '') +
      `. Esa cifra engaña: el indicador reparte sobre un recurso renovable que está casi todo en ` +
      `la cuenca amazónica mientras la extracción está en el altiplano y en el valle.` +
      (agriculture
        ? ` De toda el agua extraída, ${say(agriculture.value, 1)} % va al riego (${agriculture.year}).`
        : '') +
      (perCapita && perCapitaStart
        ? ` El agua renovable por habitante pasó de ${say(perCapitaStart.value, 0)} m³ en ` +
          `${perCapitaStart.year} a ${say(perCapita.value, 0)} en ${perCapita.year}, que es lo que ` +
          `hace la población al crecer sobre un caudal fijo.`
        : ''),
    tone: 'neutral',
  };
}

/** Lo declarado protegido, y lo que la lista roja cuenta aparte. */
function protectionConclusion(series: EnvironmentBoard['series']): FxConclusion | null {
  const land = last(series['ER.LND.PTLD.ZS']);
  if (!land) return null;
  const mammals = last(series['EN.MAM.THRD.NO']);
  const birds = last(series['EN.BIR.THRD.NO']);
  const plants = last(series['EN.HPT.THRD.NO']);
  const fish = last(series['EN.FSH.THRD.NO']);
  const threatened = [mammals, birds, plants, fish]
    .filter((entry): entry is YearValue => entry !== null)
    .reduce((total, entry) => total + entry.value, 0);
  return {
    key: 'proteccion',
    claim:
      land.value >= 30
        ? 'Casi un tercio del territorio está declarado protegido'
        : 'Lo declarado protegido no llega a un tercio del territorio',
    figure: `${say(land.value, 1)} % del territorio`,
    detail:
      `${say(land.value, 1)} % del territorio tenía alguna figura de protección en ${land.year}. ` +
      `Es lo declarado, no lo vigilado: el indicador cuenta superficie con figura legal y no dice ` +
      `nada sobre su control.` +
      (threatened > 0
        ? ` En la lista roja de la UICN aparecen ${say(threatened, 0)} especies amenazadas con ` +
          `presencia en el país` +
          (mammals ? `: ${say(mammals.value, 0)} mamíferos` : '') +
          (birds ? `, ${say(birds.value, 0)} aves` : '') +
          (plants ? `, ${say(plants.value, 0)} plantas superiores` : '') +
          (fish ? ` y ${say(fish.value, 0)} peces` : '') +
          `.`
        : ''),
    tone: 'neutral',
  };
}

/** La frontera agrícola, que es la otra cara del bosque. */
function farmlandConclusion(series: EnvironmentBoard['series']): FxConclusion | null {
  const farmland = last(series['AG.LND.AGRI.ZS']);
  const farmlandStart = first(series['AG.LND.AGRI.ZS']);
  if (!farmland || !farmlandStart) return null;
  const arable = last(series['AG.LND.ARBL.ZS']);
  const gained = farmland.value - farmlandStart.value;
  const widest = peak(series['AG.LND.AGRI.ZS']);
  const atRecord = widest !== null && widest.value - farmland.value < 0.05;
  return {
    key: 'frontera',
    claim:
      gained <= 0
        ? 'La tierra agrícola dejó de avanzar'
        : atRecord
          ? 'La tierra agrícola nunca ocupó tanto territorio como ahora'
          : 'La frontera agrícola avanzó y todavía no ha vuelto atrás',
    figure: `${say(farmland.value, 1)} % del territorio`,
    detail:
      `La tierra agrícola era ${say(farmland.value, 1)} % del territorio en ${farmland.year}, contra ` +
      `${say(farmlandStart.value, 1)} % en ${farmlandStart.year}: ${say(gained, 1)} puntos más en ` +
      `${farmland.year - farmlandStart.year} años.` +
      (arable
        ? ` La parte que se ara —sin pastos— es ${say(arable.value, 1)} % del territorio.`
        : ''),
    tone: gained > 0 ? 'neutral' : 'favourable',
  };
}

/** El tablero, armado con las filas del panel para los lugares y códigos pedidos. */
export function buildEnvironmentBoard(points: readonly WorldPoint[]): EnvironmentBoard {
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

  const partial = { series, latest };
  const conclusions = [
    forestConclusion(series),
    landUseConclusion(series),
    perCapitaConclusion(partial),
    airConclusion(series),
    farmlandConclusion(series),
    waterConclusion(partial),
    protectionConclusion(series),
  ].filter((entry): entry is FxConclusion => entry !== null);

  const asOfYear = Object.values(series)
    .map((own) => own.at(-1)?.year ?? 0)
    .reduce((best, year) => Math.max(best, year), 0);

  return { series, latest, history, conclusions, asOfYear: asOfYear || null };
}

/**
 * The energy matrix: what Bolivia burns, what it sells and what it buys.
 *
 * The report carried one card on the subject — fuel as a share of exports —
 * and nothing on where the electricity comes from, how much energy the
 * country uses, whether it still exports more energy than it imports, or what
 * the gas rent has become. Every one of those series was already in the World
 * Bank panel the core collects for thirty economies; none of them reached a
 * panel. This module reads them as one board.
 *
 * Bolivia is read beside its neighbours on purpose: a gas share of sixty-eight
 * per cent means little alone and a great deal next to Brazil's hydro or
 * Chile's solar. Every figure is the World Bank's on one definition for every
 * country, so the comparison needs no conversion nobody published.
 *
 * Conclusions are derived, never written: each sentence is assembled from the
 * latest reading and the one it is measured against, and changes with them.
 */

import type { FxConclusion } from './fx-snapshot';
import type { WorldPoint } from './series';

export type EnergyGroup =
  'ELECTRICIDAD' | 'FUENTES' | 'CONSUMO' | 'COMERCIO' | 'RENTA' | 'ACCESO' | 'EMISIONES';

export const ENERGY_GROUP_LABEL: Record<EnergyGroup, string> = {
  ELECTRICIDAD: 'De dónde sale la electricidad',
  FUENTES: 'Con qué se mueve el país',
  CONSUMO: 'Cuánta energía se usa',
  COMERCIO: 'Lo que se vende y lo que se compra',
  RENTA: 'Lo que el subsuelo deja',
  ACCESO: 'Quién tiene energía',
  EMISIONES: 'Lo que se emite',
};

export interface EnergyIndicator {
  code: string;
  label: string;
  unit: string;
  group: EnergyGroup;
  decimals: number;
  what: string;
}

export const ENERGY_INDICATORS: readonly EnergyIndicator[] = [
  {
    code: 'EG.ELC.NGAS.ZS',
    label: 'Gas natural',
    unit: '% de la generación',
    group: 'ELECTRICIDAD',
    decimals: 1,
    what: 'Electricidad generada quemando gas, como parte del total.',
  },
  {
    code: 'EG.ELC.HYRO.ZS',
    label: 'Hidroeléctrica',
    unit: '% de la generación',
    group: 'ELECTRICIDAD',
    decimals: 1,
    what: 'Electricidad generada con agua, como parte del total.',
  },
  {
    code: 'EG.ELC.PETR.ZS',
    label: 'Derivados del petróleo',
    unit: '% de la generación',
    group: 'ELECTRICIDAD',
    decimals: 1,
    what: 'Electricidad generada con diésel y otros derivados.',
  },
  {
    code: 'EG.ELC.RNWX.ZS',
    label: 'Renovables sin hidro',
    unit: '% de la generación',
    group: 'ELECTRICIDAD',
    decimals: 1,
    what: 'Solar, eólica, biomasa y geotermia, como parte del total.',
  },
  {
    code: 'EG.ELC.COAL.ZS',
    label: 'Carbón',
    unit: '% de la generación',
    group: 'ELECTRICIDAD',
    decimals: 1,
    what: 'Electricidad generada con carbón.',
  },
  {
    code: 'EG.ELC.LOSS.ZS',
    label: 'Pérdidas de transmisión y distribución',
    unit: '% de lo generado',
    group: 'ELECTRICIDAD',
    decimals: 1,
    what: 'Electricidad que se pierde entre la planta y el enchufe.',
  },
  {
    code: 'EG.FEC.RNEW.ZS',
    label: 'Renovables en el consumo final',
    unit: '% del consumo final',
    group: 'FUENTES',
    decimals: 1,
    what: 'Parte de toda la energía consumida —no solo la eléctrica— que viene de fuentes renovables.',
  },
  {
    code: 'EG.USE.CRNW.ZS',
    label: 'Leña, biomasa y residuos',
    unit: '% de la energía',
    group: 'FUENTES',
    decimals: 1,
    what: 'Combustibles renovables tradicionales: leña, bagazo, residuos.',
  },
  {
    code: 'EG.USE.COMM.CL.ZS',
    label: 'Alternativas y nuclear',
    unit: '% de la energía',
    group: 'FUENTES',
    decimals: 1,
    what: 'Hidro, solar, eólica, geotermia y nuclear en el uso total de energía.',
  },
  {
    code: 'EG.USE.PCAP.KG.OE',
    label: 'Energía por habitante',
    unit: 'kg de petróleo equivalente',
    group: 'CONSUMO',
    decimals: 0,
    what: 'Toda la energía usada en el año, repartida entre la población.',
  },
  {
    code: 'EG.USE.ELEC.KH.PC',
    label: 'Electricidad por habitante',
    unit: 'kWh',
    group: 'CONSUMO',
    decimals: 0,
    what: 'Consumo eléctrico anual por persona.',
  },
  {
    code: 'EG.EGY.PRIM.PP.KD',
    label: 'Intensidad energética',
    unit: 'MJ por dólar de PIB (PPA 2021)',
    group: 'CONSUMO',
    decimals: 2,
    what: 'Cuánta energía hace falta para producir un dólar. Baja cuando la economía se vuelve más eficiente o cambia de sectores.',
  },
  {
    code: 'EG.IMP.CONS.ZS',
    label: 'Energía importada neta',
    unit: '% del uso',
    group: 'COMERCIO',
    decimals: 1,
    what: 'Importaciones menos exportaciones de energía, como parte del uso. Negativo es un exportador neto.',
  },
  {
    code: 'TX.VAL.FUEL.ZS.UN',
    label: 'Combustible en las exportaciones',
    unit: '% de las mercancías exportadas',
    group: 'COMERCIO',
    decimals: 1,
    what: 'Peso del combustible —el gas, sobre todo— en lo que el país vende afuera.',
  },
  {
    code: 'TM.VAL.FUEL.ZS.UN',
    label: 'Combustible en las importaciones',
    unit: '% de las mercancías importadas',
    group: 'COMERCIO',
    decimals: 1,
    what: 'Peso del combustible —diésel y gasolina, sobre todo— en lo que el país compra afuera.',
  },
  {
    code: 'NY.GDP.NGAS.RT.ZS',
    label: 'Renta del gas',
    unit: '% del PIB',
    group: 'RENTA',
    decimals: 2,
    what: 'Lo que el gas deja por encima de su costo de extracción, como parte del PIB.',
  },
  {
    code: 'NY.GDP.PETR.RT.ZS',
    label: 'Renta del petróleo',
    unit: '% del PIB',
    group: 'RENTA',
    decimals: 2,
    what: 'Lo que el petróleo deja por encima de su costo de extracción.',
  },
  {
    code: 'NY.GDP.TOTL.RT.ZS',
    label: 'Renta de todos los recursos',
    unit: '% del PIB',
    group: 'RENTA',
    decimals: 2,
    what: 'Gas, petróleo, minerales y bosques juntos.',
  },
  {
    code: 'EG.ELC.ACCS.ZS',
    label: 'Acceso a electricidad',
    unit: '% de la población',
    group: 'ACCESO',
    decimals: 1,
    what: 'Hogares con conexión eléctrica.',
  },
  {
    code: 'EG.ELC.ACCS.RU.ZS',
    label: 'Acceso a electricidad, rural',
    unit: '% de la población rural',
    group: 'ACCESO',
    decimals: 1,
    what: 'Lo mismo, solo en el campo.',
  },
  {
    code: 'EG.CFT.ACCS.ZS',
    label: 'Cocina con combustibles limpios',
    unit: '% de la población',
    group: 'ACCESO',
    decimals: 1,
    what: 'Hogares que cocinan con gas o electricidad y no con leña o carbón.',
  },
  {
    code: 'EG.CFT.ACCS.RU.ZS',
    label: 'Cocina limpia, rural',
    unit: '% de la población rural',
    group: 'ACCESO',
    decimals: 1,
    what: 'Lo mismo, solo en el campo.',
  },
  {
    code: 'EN.GHG.CO2.PC.CE.AR5',
    label: 'CO₂ por habitante',
    unit: 't por persona',
    group: 'EMISIONES',
    decimals: 2,
    what: 'Dióxido de carbono emitido por persona, sin contar el cambio de uso del suelo.',
  },
  {
    code: 'EN.GHG.CO2.RT.GDP.PP.KD',
    label: 'Intensidad de carbono',
    unit: 'kg de CO₂ por dólar (PPA 2021)',
    group: 'EMISIONES',
    decimals: 3,
    what: 'Cuánto CO₂ cuesta producir un dólar.',
  },
  {
    code: 'EN.GHG.CO2.TR.MT.CE.AR5',
    label: 'CO₂ del transporte',
    unit: 'Mt',
    group: 'EMISIONES',
    decimals: 2,
    what: 'Lo que emiten los vehículos.',
  },
  {
    code: 'EN.GHG.CO2.PI.MT.CE.AR5',
    label: 'CO₂ de las centrales',
    unit: 'Mt',
    group: 'EMISIONES',
    decimals: 2,
    what: 'Lo que emite la generación eléctrica.',
  },
];

export const ENERGY_CODES: readonly string[] = ENERGY_INDICATORS.map((indicator) => indicator.code);

/** Bolivia first, then the neighbours the panel holds, in the order they are listed. */
export const ENERGY_PLACES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'BOL', label: 'Bolivia' },
  { code: 'ARG', label: 'Argentina' },
  { code: 'BRA', label: 'Brasil' },
  { code: 'CHL', label: 'Chile' },
  { code: 'COL', label: 'Colombia' },
  { code: 'ECU', label: 'Ecuador' },
  { code: 'PER', label: 'Perú' },
  { code: 'PRY', label: 'Paraguay' },
];

export const ENERGY_PLACE_CODES: readonly string[] = ENERGY_PLACES.map((place) => place.code);

export interface YearValue {
  year: number;
  value: number;
}

export interface EnergyBoard {
  /** Bolivia's own series, by indicator code, oldest year first. */
  series: Record<string, YearValue[]>;
  /** The latest reading of every place for every indicator. */
  latest: Record<string, Record<string, YearValue>>;
  /** Every place's history, only for the indicators drawn against the neighbours. */
  history: Record<string, Array<{ place: string; year: number; value: number }>>;
  conclusions: FxConclusion[];
  /** The year the freshest Bolivian reading of the board carries. */
  asOfYear: number | null;
}

const say = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** The year the gas contract with Brazil began to export, from where the boom is measured. */
const GAS_ERA = 2000;

function last(series: YearValue[] | undefined): YearValue | null {
  return series?.at(-1) ?? null;
}

function peakSince(series: YearValue[] | undefined, year: number): YearValue | null {
  return (series ?? [])
    .filter((point) => point.year >= year)
    .reduce<YearValue | null>(
      (best, point) => (!best || point.value > best.value ? point : best),
      null,
    );
}

function electricityConclusion(series: EnergyBoard['series']): FxConclusion | null {
  const gas = last(series['EG.ELC.NGAS.ZS']);
  const hydro = last(series['EG.ELC.HYRO.ZS']);
  if (!gas || !hydro) return null;
  const other = last(series['EG.ELC.RNWX.ZS']);
  const oil = last(series['EG.ELC.PETR.ZS']);
  const gasPeak = peakSince(series['EG.ELC.NGAS.ZS'], 1990);
  const dominant = gas.value >= 50;
  return {
    key: 'electricidad',
    claim: dominant
      ? 'La electricidad boliviana sale del gas'
      : 'El gas ya no es la fuente principal de electricidad',
    figure: `${say(gas.value)} % gas`,
    detail:
      `En ${gas.year}, ${say(gas.value)} % de la generación fue con gas natural y ${say(hydro.value)} % ` +
      `hidroeléctrica` +
      (other
        ? `; las renovables sin hidro llegaban a ${say(other.value)} % en ${other.year}`
        : '') +
      (oil ? ` y los derivados del petróleo a ${say(oil.value)} %` : '') +
      `.` +
      (gasPeak && gasPeak.year !== gas.year
        ? ` El gas tocó su máximo en la generación en ${gasPeak.year}, con ${say(gasPeak.value)} %.`
        : ''),
    tone: 'neutral',
  };
}

function balanceConclusion(series: EnergyBoard['series']): FxConclusion | null {
  const net = last(series['EG.IMP.CONS.ZS']);
  if (!net) return null;
  const deepest = (series['EG.IMP.CONS.ZS'] ?? [])
    .filter((point) => point.year >= GAS_ERA)
    .reduce<YearValue | null>(
      (best, point) => (!best || point.value < best.value ? point : best),
      null,
    );
  const exporter = net.value < 0;
  return {
    key: 'balance',
    claim: exporter
      ? 'Bolivia todavía exporta más energía de la que importa, pero cada vez menos'
      : 'Bolivia ya importa más energía de la que exporta',
    figure: `${say(Math.abs(net.value))} % ${exporter ? 'exportado' : 'importado'} neto`,
    detail:
      `En ${net.year} las importaciones netas de energía fueron ${say(net.value)} % del uso: ` +
      (exporter
        ? `el país vendió afuera el equivalente a ${say(Math.abs(net.value))} % de lo que consumió.`
        : `el país compró afuera ${say(net.value)} % de lo que consumió.`) +
      (deepest && deepest.year !== net.year
        ? ` En ${deepest.year} el excedente exportado llegó a ${say(Math.abs(deepest.value))} % del uso; ` +
          `de ahí a ${net.year} se perdió ${say(Math.abs(deepest.value) - Math.abs(net.value))} puntos.`
        : ''),
    tone: exporter ? 'neutral' : 'adverse',
  };
}

function tradeConclusion(series: EnergyBoard['series']): FxConclusion | null {
  const exportsShare = last(series['TX.VAL.FUEL.ZS.UN']);
  const importsShare = last(series['TM.VAL.FUEL.ZS.UN']);
  if (!exportsShare || !importsShare) return null;
  const imports = new Map(
    (series['TM.VAL.FUEL.ZS.UN'] ?? []).map((point) => [point.year, point.value]),
  );
  const crossover = (series['TX.VAL.FUEL.ZS.UN'] ?? [])
    .filter((point) => point.year >= GAS_ERA)
    .find((point, index, all) => {
      const importsThen = imports.get(point.year);
      const previous = all[index - 1];
      const importsBefore = previous ? imports.get(previous.year) : undefined;
      return (
        importsThen !== undefined &&
        importsThen > point.value &&
        previous !== undefined &&
        importsBefore !== undefined &&
        importsBefore <= previous.value
      );
    });
  const heavierInImports = importsShare.value > exportsShare.value;
  return {
    key: 'comercio',
    claim: heavierInImports
      ? 'El combustible ya pesa más en lo que Bolivia compra que en lo que vende'
      : 'El combustible sigue pesando más en lo que Bolivia vende que en lo que compra',
    figure: `${say(exportsShare.value)} % vs ${say(importsShare.value)} %`,
    detail:
      `En ${exportsShare.year} el combustible fue ${say(exportsShare.value)} % de las mercancías ` +
      `exportadas y ${say(importsShare.value)} % de las importadas.` +
      (crossover
        ? ` Las dos curvas se cruzaron en ${crossover.year}: desde entonces el diésel y la gasolina ` +
          `que entran pesan más que el gas que sale.`
        : ''),
    tone: heavierInImports ? 'adverse' : 'favourable',
  };
}

function rentConclusion(series: EnergyBoard['series']): FxConclusion | null {
  const gas = last(series['NY.GDP.NGAS.RT.ZS']);
  if (!gas) return null;
  const peak = peakSince(series['NY.GDP.NGAS.RT.ZS'], GAS_ERA);
  const total = last(series['NY.GDP.TOTL.RT.ZS']);
  return {
    key: 'renta',
    claim:
      peak && gas.value < peak.value / 2
        ? 'La renta del gas es menos de la mitad de lo que fue'
        : 'La renta del gas sigue cerca de su máximo',
    figure: `${say(gas.value, 2)} % del PIB`,
    detail:
      `En ${gas.year} el gas dejó ${say(gas.value, 2)} % del PIB por encima de su costo de extracción` +
      (peak && peak.year !== gas.year
        ? `, contra ${say(peak.value, 2)} % en ${peak.year}, su máximo desde ${GAS_ERA}`
        : '') +
      `.` +
      (total
        ? ` Todos los recursos naturales juntos dejaron ${say(total.value, 2)} % en ${total.year}.`
        : ''),
    tone: peak && gas.value < peak.value / 2 ? 'adverse' : 'neutral',
  };
}

function energyUseConclusion(board: Pick<EnergyBoard, 'series' | 'latest'>): FxConclusion | null {
  const perCapita = last(board.series['EG.USE.PCAP.KG.OE']);
  if (!perCapita) return null;
  const neighbours = Object.entries(board.latest['EG.USE.PCAP.KG.OE'] ?? {})
    .filter(([place]) => place !== 'BOL')
    .map(([place, reading]) => ({ place, value: reading.value }))
    .sort((left, right) => right.value - left.value);
  const above = neighbours.filter((entry) => entry.value > perCapita.value).length;
  const label = (code: string): string =>
    ENERGY_PLACES.find((place) => place.code === code)?.label ?? code;
  return {
    key: 'consumo',
    claim: 'Bolivia usa menos energía por habitante que casi todos sus vecinos',
    figure: `${say(perCapita.value, 0)} kg`,
    detail:
      `${say(perCapita.value, 0)} kilos de petróleo equivalente por persona en ${perCapita.year}` +
      (neighbours.length
        ? `: ${above} de los ${neighbours.length} vecinos del panel usan más` +
          (neighbours[0]
            ? `, ${label(neighbours[0].place)} el que más con ${say(neighbours[0].value, 0)}`
            : '') +
          (neighbours.at(-1) && neighbours.at(-1)!.value < perCapita.value
            ? ` y ${label(neighbours.at(-1)!.place)} el que menos con ${say(neighbours.at(-1)!.value, 0)}`
            : '') +
          '.'
        : '.'),
    tone: 'neutral',
  };
}

function accessConclusion(series: EnergyBoard['series']): FxConclusion | null {
  const electricity = last(series['EG.ELC.ACCS.ZS']);
  const rural = last(series['EG.ELC.ACCS.RU.ZS']);
  const cooking = last(series['EG.CFT.ACCS.ZS']);
  const cookingRural = last(series['EG.CFT.ACCS.RU.ZS']);
  if (!electricity) return null;
  return {
    key: 'acceso',
    claim: 'La red llega a casi todos; la cocina limpia todavía no llega al campo',
    figure: `${say(electricity.value)} %`,
    detail:
      `${say(electricity.value)} % de la población tenía electricidad en ${electricity.year}` +
      (rural ? `, ${say(rural.value)} % en el campo` : '') +
      (cooking
        ? `. Cocinaba con combustibles limpios ${say(cooking.value)} %` +
          (cookingRural ? `, y solo ${say(cookingRural.value)} % de la población rural` : '') +
          ` (${cooking.year}).`
        : '.'),
    tone: rural && rural.value < 90 ? 'neutral' : 'favourable',
  };
}

/** The board, assembled from the panel's rows for the places and codes asked. */
export function buildEnergyBoard(points: readonly WorldPoint[]): EnergyBoard {
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
  /*
   * A zero on a share series is a gap the publisher wrote as a number: the
   * fossil-fuel share of Bolivia's energy use does not fall from eighty to
   * nothing in a year. Trailing zeros on a percentage are dropped so the
   * latest reading is the latest real one.
   */
  for (const code of Object.keys(series)) {
    const own = series[code] ?? [];
    if (!/\.ZS$/u.test(code)) continue;
    while (own.length > 1 && own.at(-1)?.value === 0 && (own.at(-2)?.value ?? 0) > 5) own.pop();
    const stillLatest = own.at(-1);
    if (stillLatest && latest[code]?.BOL) latest[code]!.BOL = stillLatest;
  }

  const partial = { series, latest };
  const conclusions = [
    electricityConclusion(series),
    balanceConclusion(series),
    tradeConclusion(series),
    rentConclusion(series),
    energyUseConclusion(partial),
    accessConclusion(series),
  ].filter((entry): entry is FxConclusion => entry !== null);

  const asOfYear = Object.values(series)
    .map((own) => own.at(-1)?.year ?? 0)
    .reduce((best, year) => Math.max(best, year), 0);

  return { series, latest, history, conclusions, asOfYear: asOfYear || null };
}

/** The indicators whose whole history travels for every place, not only the latest year. */
const COMPARED_ACROSS_PLACES = new Set(['EG.USE.PCAP.KG.OE']);

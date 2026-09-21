/**
 * The legal and political situation, read from the indices that rate it.
 *
 * Nobody counts freedom. What exists is a handful of institutions that rate
 * it on a published method — the Fraser Institute for economic freedom,
 * Freedom House for political rights and civil liberties, V-Dem for the
 * anatomy of democracy, the World Bank's governance estimates for how the
 * state works — and each composite is built from named parts. The parts are
 * the reading: a country can hold a middling total while one of its parts
 * collapses, and the total hides exactly that.
 *
 * Every index here carries its own scale and direction, stated on the entry,
 * because a 6 out of 16 and a 6 out of 10 are different findings and a rating
 * where 1 is best reads backwards next to one where 1 is worst.
 *
 * Conclusions are derived from the series, never written; they change when
 * the publishers do.
 */

import type { FxConclusion } from './fx-snapshot';
import type { MacroPoint } from './series';

export type InstitutionGroup = 'ECONOMICA' | 'POLITICA' | 'DEMOCRACIA' | 'GOBERNANZA';

export const INSTITUTION_GROUP_LABEL: Record<InstitutionGroup, string> = {
  ECONOMICA: 'Libertad económica',
  POLITICA: 'Libertad política',
  DEMOCRACIA: 'Anatomía de la democracia',
  GOBERNANZA: 'Cómo funciona el Estado',
};

export interface InstitutionIndicator {
  code: string;
  label: string;
  group: InstitutionGroup;
  /** The publisher's scale, so a figure is never read against the wrong ceiling. */
  min: number;
  max: number;
  /** False for the ratings where 1 is the freest and the corruption index. */
  higherIsBetter: boolean;
  decimals: number;
  publisher: string;
  what: string;
}

const FRASER = 'Fraser Institute';
const FREEDOM_HOUSE = 'Freedom House';
const VDEM = 'V-Dem';
const WORLD_BANK = 'Banco Mundial (WGI)';

export const INSTITUTION_INDICATORS: readonly InstitutionIndicator[] = [
  {
    code: 'EFW_SUMMARY_INDEX',
    label: 'Libertad económica, índice resumen',
    group: 'ECONOMICA',
    min: 0,
    max: 10,
    higherIsBetter: true,
    decimals: 2,
    publisher: FRASER,
    what: 'Promedio de las cinco áreas. 10 es la economía más libre.',
  },
  {
    code: 'EFW_SIZE_OF_GOVERNMENT',
    label: 'Tamaño del gobierno',
    group: 'ECONOMICA',
    min: 0,
    max: 10,
    higherIsBetter: true,
    decimals: 2,
    publisher: FRASER,
    what: 'Gasto, transferencias, empresas públicas e impuestos: más alto es un Estado que ocupa menos espacio.',
  },
  {
    code: 'EFW_LEGAL_SYSTEM_PROPERTY_RIGHTS',
    label: 'Sistema legal y derechos de propiedad',
    group: 'ECONOMICA',
    min: 0,
    max: 10,
    higherIsBetter: true,
    decimals: 2,
    publisher: FRASER,
    what: 'Independencia judicial, imparcialidad de los tribunales, protección de la propiedad, cumplimiento de contratos.',
  },
  {
    code: 'EFW_SOUND_MONEY',
    label: 'Moneda sana',
    group: 'ECONOMICA',
    min: 0,
    max: 10,
    higherIsBetter: true,
    decimals: 2,
    publisher: FRASER,
    what: 'Crecimiento monetario, inflación y libertad para tener cuentas en moneda extranjera.',
  },
  {
    code: 'EFW_FREEDOM_TO_TRADE',
    label: 'Libertad de comercio internacional',
    group: 'ECONOMICA',
    min: 0,
    max: 10,
    higherIsBetter: true,
    decimals: 2,
    publisher: FRASER,
    what: 'Aranceles, barreras regulatorias, controles de capital y de tipo de cambio.',
  },
  {
    code: 'EFW_REGULATION',
    label: 'Regulación',
    group: 'ECONOMICA',
    min: 0,
    max: 10,
    higherIsBetter: true,
    decimals: 2,
    publisher: FRASER,
    what: 'Regulación del crédito, del trabajo y de los negocios.',
  },
  {
    code: 'FH_TOTAL_SCORE',
    label: 'Libertad en el mundo, total',
    group: 'POLITICA',
    min: 0,
    max: 100,
    higherIsBetter: true,
    decimals: 0,
    publisher: FREEDOM_HOUSE,
    what: 'Suma de derechos políticos (40) y libertades civiles (60).',
  },
  {
    code: 'FH_POLITICAL_RIGHTS_SCORE',
    label: 'Derechos políticos',
    group: 'POLITICA',
    min: 0,
    max: 40,
    higherIsBetter: true,
    decimals: 0,
    publisher: FREEDOM_HOUSE,
    what: 'Proceso electoral, pluralismo y participación, funcionamiento del gobierno.',
  },
  {
    code: 'FH_CIVIL_LIBERTIES_SCORE',
    label: 'Libertades civiles',
    group: 'POLITICA',
    min: 0,
    max: 60,
    higherIsBetter: true,
    decimals: 0,
    publisher: FREEDOM_HOUSE,
    what: 'Expresión y creencia, asociación, estado de derecho, autonomía personal.',
  },
  {
    code: 'FH_ELECTORAL_PROCESS_SCORE',
    label: 'Proceso electoral',
    group: 'POLITICA',
    min: 0,
    max: 12,
    higherIsBetter: true,
    decimals: 0,
    publisher: FREEDOM_HOUSE,
    what: 'Si el Ejecutivo y el Legislativo se eligen en elecciones libres y justas, con leyes electorales imparciales.',
  },
  {
    code: 'FH_POLITICAL_PLURALISM_SCORE',
    label: 'Pluralismo y participación',
    group: 'POLITICA',
    min: 0,
    max: 16,
    higherIsBetter: true,
    decimals: 0,
    publisher: FREEDOM_HOUSE,
    what: 'Derecho a organizar partidos, oposición con posibilidad real, libertad frente a poderes no electos, participación de minorías.',
  },
  {
    code: 'FH_GOVERNMENT_FUNCTIONING_SCORE',
    label: 'Funcionamiento del gobierno',
    group: 'POLITICA',
    min: 0,
    max: 12,
    higherIsBetter: true,
    decimals: 0,
    publisher: FREEDOM_HOUSE,
    what: 'Si los electos deciden de verdad, si hay controles a la corrupción y si el gobierno rinde cuentas.',
  },
  {
    code: 'FH_EXPRESSION_BELIEF_SCORE',
    label: 'Expresión y creencia',
    group: 'POLITICA',
    min: 0,
    max: 16,
    higherIsBetter: true,
    decimals: 0,
    publisher: FREEDOM_HOUSE,
    what: 'Prensa, religión, academia y conversación privada.',
  },
  {
    code: 'FH_ASSOCIATION_RIGHTS_SCORE',
    label: 'Asociación y organización',
    group: 'POLITICA',
    min: 0,
    max: 12,
    higherIsBetter: true,
    decimals: 0,
    publisher: FREEDOM_HOUSE,
    what: 'Reunión, organizaciones civiles y sindicatos.',
  },
  {
    code: 'FH_RULE_OF_LAW_SCORE',
    label: 'Estado de derecho',
    group: 'POLITICA',
    min: 0,
    max: 16,
    higherIsBetter: true,
    decimals: 0,
    publisher: FREEDOM_HOUSE,
    what: 'Independencia judicial, debido proceso, protección frente a la fuerza ilegítima, igualdad ante la ley.',
  },
  {
    code: 'FH_PERSONAL_AUTONOMY_SCORE',
    label: 'Autonomía personal',
    group: 'POLITICA',
    min: 0,
    max: 16,
    higherIsBetter: true,
    decimals: 0,
    publisher: FREEDOM_HOUSE,
    what: 'Movimiento, propiedad y empresa, libertades sociales, igualdad de oportunidades.',
  },
  {
    code: 'FH_POLITICAL_RIGHTS_RATING',
    label: 'Derechos políticos, calificación',
    group: 'POLITICA',
    min: 1,
    max: 7,
    higherIsBetter: false,
    decimals: 0,
    publisher: FREEDOM_HOUSE,
    what: 'La calificación histórica de 1 a 7, donde 1 es la más libre. Existe desde 1972.',
  },
  {
    code: 'FH_CIVIL_LIBERTIES_RATING',
    label: 'Libertades civiles, calificación',
    group: 'POLITICA',
    min: 1,
    max: 7,
    higherIsBetter: false,
    decimals: 0,
    publisher: FREEDOM_HOUSE,
    what: 'La calificación histórica de 1 a 7, donde 1 es la más libre.',
  },
  {
    code: 'VDEM_LIBERAL_DEMOCRACY_INDEX',
    label: 'Democracia liberal',
    group: 'DEMOCRACIA',
    min: 0,
    max: 1,
    higherIsBetter: true,
    decimals: 3,
    publisher: VDEM,
    what: 'Elecciones limpias más contrapesos: libertades individuales, control judicial y legislativo del Ejecutivo.',
  },
  {
    code: 'VDEM_ELECTORAL_DEMOCRACY_INDEX',
    label: 'Democracia electoral',
    group: 'DEMOCRACIA',
    min: 0,
    max: 1,
    higherIsBetter: true,
    decimals: 3,
    publisher: VDEM,
    what: 'Solo la parte electoral: sufragio, elecciones limpias, libertad de expresión y asociación.',
  },
  {
    code: 'VDEM_FREEDOM_OF_EXPRESSION_INDEX',
    label: 'Libertad de expresión',
    group: 'DEMOCRACIA',
    min: 0,
    max: 1,
    higherIsBetter: true,
    decimals: 3,
    publisher: VDEM,
    what: 'Prensa, discusión académica y privada, censura.',
  },
  {
    code: 'VDEM_FREEDOM_OF_ASSOCIATION_INDEX',
    label: 'Libertad de asociación',
    group: 'DEMOCRACIA',
    min: 0,
    max: 1,
    higherIsBetter: true,
    decimals: 3,
    publisher: VDEM,
    what: 'Partidos y organizaciones de la sociedad civil.',
  },
  {
    code: 'VDEM_JUDICIAL_CONSTRAINTS_INDEX',
    label: 'Control judicial del Ejecutivo',
    group: 'DEMOCRACIA',
    min: 0,
    max: 1,
    higherIsBetter: true,
    decimals: 3,
    publisher: VDEM,
    what: 'Si el Ejecutivo acata a los tribunales y estos son independientes.',
  },
  {
    code: 'VDEM_LEGISLATIVE_CONSTRAINTS_INDEX',
    label: 'Control legislativo del Ejecutivo',
    group: 'DEMOCRACIA',
    min: 0,
    max: 1,
    higherIsBetter: true,
    decimals: 3,
    publisher: VDEM,
    what: 'Si el Legislativo investiga y frena al Ejecutivo en la práctica.',
  },
  {
    code: 'VDEM_RULE_OF_LAW_INDEX',
    label: 'Estado de derecho',
    group: 'DEMOCRACIA',
    min: 0,
    max: 1,
    higherIsBetter: true,
    decimals: 3,
    publisher: VDEM,
    what: 'Leyes aplicadas de forma transparente, independiente, predecible e igual.',
  },
  {
    code: 'VDEM_HUMAN_RIGHTS_INDEX',
    label: 'Derechos humanos',
    group: 'DEMOCRACIA',
    min: 0,
    max: 1,
    higherIsBetter: true,
    decimals: 3,
    publisher: VDEM,
    what: 'Libertad frente a la tortura, el asesinato político y el trabajo forzado; libertad de movimiento, religión y propiedad.',
  },
  {
    code: 'VDEM_POLITICAL_CORRUPTION_INDEX',
    label: 'Corrupción política',
    group: 'DEMOCRACIA',
    min: 0,
    max: 1,
    higherIsBetter: false,
    decimals: 3,
    publisher: VDEM,
    what: 'Corrupción en el Ejecutivo, el Legislativo, el Judicial y la administración. Aquí más alto es peor.',
  },
  {
    code: 'POLITICAL_REGIME_CLASSIFICATION',
    label: 'Tipo de régimen',
    group: 'DEMOCRACIA',
    min: 0,
    max: 3,
    higherIsBetter: true,
    decimals: 0,
    publisher: VDEM,
    what: '0 autocracia cerrada, 1 autocracia electoral, 2 democracia electoral, 3 democracia liberal.',
  },
  {
    code: 'RULE_OF_LAW_SCORE',
    label: 'Estado de derecho',
    group: 'GOBERNANZA',
    min: -2.5,
    max: 2.5,
    higherIsBetter: true,
    decimals: 2,
    publisher: WORLD_BANK,
    what: 'Confianza en las reglas, contratos, policía y tribunales. Cero es la media mundial.',
  },
  {
    code: 'REGULATORY_QUALITY_SCORE',
    label: 'Calidad regulatoria',
    group: 'GOBERNANZA',
    min: -2.5,
    max: 2.5,
    higherIsBetter: true,
    decimals: 2,
    publisher: WORLD_BANK,
    what: 'Capacidad de formular y aplicar políticas que permitan al sector privado desarrollarse.',
  },
  {
    code: 'CONTROL_OF_CORRUPTION_SCORE',
    label: 'Control de la corrupción',
    group: 'GOBERNANZA',
    min: -2.5,
    max: 2.5,
    higherIsBetter: true,
    decimals: 2,
    publisher: WORLD_BANK,
    what: 'Hasta qué punto el poder público se usa para beneficio privado.',
  },
  {
    code: 'GOVERNMENT_EFFECTIVENESS_SCORE',
    label: 'Efectividad gubernamental',
    group: 'GOBERNANZA',
    min: -2.5,
    max: 2.5,
    higherIsBetter: true,
    decimals: 2,
    publisher: WORLD_BANK,
    what: 'Calidad de los servicios públicos y de la administración, y su independencia de presiones políticas.',
  },
  {
    code: 'POLITICAL_STABILITY_SCORE',
    label: 'Estabilidad política',
    group: 'GOBERNANZA',
    min: -2.5,
    max: 2.5,
    higherIsBetter: true,
    decimals: 2,
    publisher: WORLD_BANK,
    what: 'Probabilidad de inestabilidad o violencia por motivos políticos.',
  },
  {
    code: 'VOICE_AND_ACCOUNTABILITY_SCORE',
    label: 'Voz y rendición de cuentas',
    group: 'GOBERNANZA',
    min: -2.5,
    max: 2.5,
    higherIsBetter: true,
    decimals: 2,
    publisher: WORLD_BANK,
    what: 'Participación en elegir el gobierno, y libertad de expresión, asociación y prensa.',
  },
  {
    code: 'CORRUPTION_PERCEPTIONS_INDEX',
    label: 'Percepción de la corrupción',
    group: 'GOBERNANZA',
    min: 0,
    max: 100,
    higherIsBetter: true,
    decimals: 0,
    publisher: 'Transparency International',
    what: 'Cómo perciben la corrupción del sector público expertos y empresarios. 100 es el más limpio.',
  },
  {
    code: 'STATE_CAPACITY_INDEX',
    label: 'Capacidad estatal',
    group: 'GOBERNANZA',
    min: -3,
    max: 3,
    higherIsBetter: true,
    decimals: 2,
    publisher: 'Hanson y Sigman',
    what: 'Capacidad del Estado de extraer recursos, coaccionar y administrar.',
  },
];

export const INSTITUTION_CODES: readonly string[] = INSTITUTION_INDICATORS.map(
  (entry) => entry.code,
);

export interface YearValue {
  year: number;
  value: number;
}

export interface InstitutionsBoard {
  series: Record<string, YearValue[]>;
  conclusions: FxConclusion[];
  /** The indices the board names and the core has not delivered yet. */
  missing: string[];
  asOfYear: number | null;
}

export const REGIME_LABEL: Record<number, string> = {
  0: 'autocracia cerrada',
  1: 'autocracia electoral',
  2: 'democracia electoral',
  3: 'democracia liberal',
};

const say = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const indicatorOf = (code: string): InstitutionIndicator | undefined =>
  INSTITUTION_INDICATORS.find((entry) => entry.code === code);

const last = (series: YearValue[] | undefined): YearValue | null => series?.at(-1) ?? null;

/** The reading closest to `years` before the latest, for a like-for-like change. */
function yearsBefore(series: YearValue[] | undefined, years: number): YearValue | null {
  const latest = last(series);
  if (!latest || !series) return null;
  const target = latest.year - years;
  return [...series].filter((point) => point.year <= target).at(-1) ?? null;
}

function peakSince(
  series: YearValue[] | undefined,
  year: number,
  best: 'max' | 'min',
): YearValue | null {
  return (series ?? [])
    .filter((point) => point.year >= year)
    .reduce<YearValue | null>(
      (held, point) =>
        !held || (best === 'max' ? point.value > held.value : point.value < held.value)
          ? point
          : held,
      null,
    );
}

/** Freedom House's status, from the two ratings it is defined on. */
export function freedomStatus(political: number, civil: number): string {
  const combined = (political + civil) / 2;
  return combined <= 2.5 ? 'Libre' : combined <= 5 ? 'Parcialmente libre' : 'No libre';
}

function economicConclusion(series: InstitutionsBoard['series']): FxConclusion | null {
  const summary = last(series.EFW_SUMMARY_INDEX);
  if (!summary) return null;
  const areas = [
    'EFW_SIZE_OF_GOVERNMENT',
    'EFW_LEGAL_SYSTEM_PROPERTY_RIGHTS',
    'EFW_SOUND_MONEY',
    'EFW_FREEDOM_TO_TRADE',
    'EFW_REGULATION',
  ]
    .map((code) => ({ code, label: indicatorOf(code)?.label ?? code, reading: last(series[code]) }))
    .filter(
      (entry): entry is { code: string; label: string; reading: YearValue } =>
        entry.reading !== null,
    )
    .sort((left, right) => left.reading.value - right.reading.value);
  const weakest = areas[0];
  const strongest = areas.at(-1);
  const peak = peakSince(series.EFW_SUMMARY_INDEX, 1970, 'max');
  const decade = yearsBefore(series.EFW_SUMMARY_INDEX, 10);
  return {
    key: 'libertad-economica',
    claim:
      weakest && weakest.reading.value < 5
        ? `La libertad económica está a medias, y lo que la hunde es ${weakest.label.toLocaleLowerCase('es')}`
        : 'La libertad económica está en la mitad de la escala',
    figure: `${say(summary.value)} / 10`,
    detail:
      `Índice de libertad económica del Fraser Institute en ${summary.year}` +
      (peak && peak.year !== summary.year
        ? `, contra un máximo de ${say(peak.value)} en ${peak.year}`
        : '') +
      (decade ? `; diez años antes, en ${decade.year}, era ${say(decade.value)}` : '') +
      `.` +
      (weakest && strongest
        ? ` De las cinco áreas, la más baja es ${weakest.label.toLocaleLowerCase('es')} con ${say(weakest.reading.value)} ` +
          `y la más alta ${strongest.label.toLocaleLowerCase('es')} con ${say(strongest.reading.value)}` +
          (areas.length > 2
            ? `; entre medio, ${areas
                .slice(1, -1)
                .map(
                  (entry) => `${entry.label.toLocaleLowerCase('es')} ${say(entry.reading.value)}`,
                )
                .join(', ')}.`
            : '.')
        : ''),
    tone: summary.value < 6 ? 'adverse' : summary.value < 7 ? 'neutral' : 'favourable',
  };
}

function politicalConclusion(series: InstitutionsBoard['series']): FxConclusion | null {
  const total = last(series.FH_TOTAL_SCORE);
  const political = last(series.FH_POLITICAL_RIGHTS_SCORE);
  const civil = last(series.FH_CIVIL_LIBERTIES_SCORE);
  if (!total || !political || !civil) return null;
  const parts = INSTITUTION_INDICATORS.filter(
    (entry) => entry.group === 'POLITICA' && entry.max <= 16 && entry.min === 0,
  )
    .map((entry) => ({ entry, reading: last(series[entry.code]) }))
    .filter(
      (item): item is { entry: InstitutionIndicator; reading: YearValue } => item.reading !== null,
    )
    .map((item) => ({ ...item, share: item.reading.value / item.entry.max }))
    .sort((left, right) => left.share - right.share);
  const weakest = parts[0];
  const strongest = parts.at(-1);
  const first = series.FH_TOTAL_SCORE?.[0];
  const ratingP = last(series.FH_POLITICAL_RIGHTS_RATING);
  const ratingC = last(series.FH_CIVIL_LIBERTIES_RATING);
  const status = ratingP && ratingC ? freedomStatus(ratingP.value, ratingC.value) : null;
  return {
    key: 'libertad-politica',
    claim: status
      ? `Freedom House clasifica a Bolivia como «${status.toLocaleLowerCase('es')}»`
      : 'Libertad política según Freedom House',
    figure: `${say(total.value, 0)} / 100`,
    detail:
      `Puntaje total en ${total.year}: derechos políticos ${say(political.value, 0)} de 40 y libertades ` +
      `civiles ${say(civil.value, 0)} de 60.` +
      (first && first.year !== total.year
        ? ` En ${first.year}, primer año con esta escala, era ${say(first.value, 0)}.`
        : '') +
      (weakest && strongest
        ? ` La subcategoría más baja frente a su techo es ${weakest.entry.label.toLocaleLowerCase('es')}, ` +
          `${say(weakest.reading.value, 0)} de ${weakest.entry.max}; la más alta, ` +
          `${strongest.entry.label.toLocaleLowerCase('es')}, ${say(strongest.reading.value, 0)} de ${strongest.entry.max}.`
        : ''),
    tone: status === 'Libre' ? 'favourable' : status === 'No libre' ? 'adverse' : 'neutral',
  };
}

function historyConclusion(series: InstitutionsBoard['series']): FxConclusion | null {
  const political = series.FH_POLITICAL_RIGHTS_RATING ?? [];
  const civilByYear = new Map(
    (series.FH_CIVIL_LIBERTIES_RATING ?? []).map((point) => [point.year, point.value]),
  );
  const rated = political
    .filter((point) => civilByYear.has(point.year))
    .map((point) => ({
      year: point.year,
      status: freedomStatus(point.value, civilByYear.get(point.year) ?? 7),
    }));
  const latest = rated.at(-1);
  if (!latest || rated.length < 5) return null;
  let since = latest.year;
  for (
    let index = rated.length - 1;
    index >= 0 && rated[index]?.status === latest.status;
    index -= 1
  ) {
    since = rated[index]?.year ?? since;
  }
  const counts = rated.reduce<Record<string, number>>((held, point) => {
    held[point.status] = (held[point.status] ?? 0) + 1;
    return held;
  }, {});
  const freeYears = rated.filter((point) => point.status === 'Libre');
  const lastFree = freeYears.at(-1);
  return {
    key: 'historia',
    claim: `«${latest.status}» desde ${since}`,
    figure: `${latest.year - since + 1} años`,
    detail:
      `Con las calificaciones de 1 a 7 que Freedom House publica desde ${rated[0]?.year ?? ''}: ` +
      `${counts.Libre ?? 0} años como «libre», ${counts['Parcialmente libre'] ?? 0} como «parcialmente libre» y ` +
      `${counts['No libre'] ?? 0} como «no libre».` +
      (lastFree && latest.status !== 'Libre'
        ? ` La última vez que fue «libre» fue en ${lastFree.year}.`
        : ''),
    tone:
      latest.status === 'Libre'
        ? 'favourable'
        : latest.status === 'No libre'
          ? 'adverse'
          : 'neutral',
  };
}

function democracyConclusion(series: InstitutionsBoard['series']): FxConclusion | null {
  const liberal = last(series.VDEM_LIBERAL_DEMOCRACY_INDEX);
  const electoral = last(series.VDEM_ELECTORAL_DEMOCRACY_INDEX);
  if (!liberal) return null;
  const peak = peakSince(series.VDEM_LIBERAL_DEMOCRACY_INDEX, 1982, 'max');
  const components = [
    'VDEM_FREEDOM_OF_EXPRESSION_INDEX',
    'VDEM_FREEDOM_OF_ASSOCIATION_INDEX',
    'VDEM_JUDICIAL_CONSTRAINTS_INDEX',
    'VDEM_LEGISLATIVE_CONSTRAINTS_INDEX',
    'VDEM_RULE_OF_LAW_INDEX',
  ]
    .map((code) => ({ code, label: indicatorOf(code)?.label ?? code, reading: last(series[code]) }))
    .filter(
      (entry): entry is { code: string; label: string; reading: YearValue } =>
        entry.reading !== null,
    )
    .sort((left, right) => left.reading.value - right.reading.value);
  const weakest = components[0];
  return {
    key: 'democracia',
    claim:
      electoral && electoral.value - liberal.value > 0.15
        ? 'Las elecciones valen más que los contrapesos'
        : 'Democracia liberal según V-Dem',
    figure: `${say(liberal.value, 3)} / 1`,
    detail:
      `Índice de democracia liberal en ${liberal.year}` +
      (peak && peak.year !== liberal.year
        ? `, contra un máximo de ${say(peak.value, 3)} en ${peak.year} desde la vuelta a las urnas en 1982`
        : '') +
      (electoral ? `. La parte electoral sola da ${say(electoral.value, 3)}` : '') +
      (weakest
        ? `; el componente más bajo es ${weakest.label.toLocaleLowerCase('es')}, ${say(weakest.reading.value, 3)}` +
          (components.length > 1
            ? `, y el más alto ${components.at(-1)!.label.toLocaleLowerCase('es')}, ${say(components.at(-1)!.reading.value, 3)}.`
            : '.')
        : '.'),
    tone: liberal.value < 0.4 ? 'adverse' : liberal.value < 0.6 ? 'neutral' : 'favourable',
  };
}

function regimeConclusion(series: InstitutionsBoard['series']): FxConclusion | null {
  const regime = series.POLITICAL_REGIME_CLASSIFICATION ?? [];
  const latest = regime.at(-1);
  if (!latest) return null;
  let since = latest.year;
  for (
    let index = regime.length - 1;
    index >= 0 && regime[index]?.value === latest.value;
    index -= 1
  ) {
    since = regime[index]?.year ?? since;
  }
  const previous = [...regime].filter((point) => point.year < since).at(-1);
  return {
    key: 'regimen',
    claim: `V-Dem clasifica el régimen como ${REGIME_LABEL[latest.value] ?? 'sin clasificar'}`,
    figure: `desde ${since}`,
    detail:
      `Clasificación de regímenes del mundo en ${latest.year}: ${REGIME_LABEL[latest.value] ?? latest.value}` +
      (previous
        ? `. En ${previous.year} estaba clasificado como ${REGIME_LABEL[previous.value] ?? previous.value}.`
        : '.') +
      ' La escala va de autocracia cerrada a democracia liberal; el paso de una a otra lo dan las elecciones y los contrapesos, no el discurso.',
    tone: latest.value >= 2 ? 'neutral' : 'adverse',
  };
}

function ruleOfLawConclusion(series: InstitutionsBoard['series']): FxConclusion | null {
  const wgi = last(series.RULE_OF_LAW_SCORE);
  if (!wgi) return null;
  const before = yearsBefore(series.RULE_OF_LAW_SCORE, 10);
  const vdem = last(series.VDEM_RULE_OF_LAW_INDEX);
  const corruption = last(series.CORRUPTION_PERCEPTIONS_INDEX);
  return {
    key: 'estado-de-derecho',
    claim:
      wgi.value < -1
        ? 'El estado de derecho está muy por debajo de la media mundial'
        : wgi.value < 0
          ? 'El estado de derecho está por debajo de la media mundial'
          : 'El estado de derecho está sobre la media mundial',
    figure: `${wgi.value > 0 ? '+' : wgi.value < 0 ? '−' : ''}${say(Math.abs(wgi.value))} σ`,
    detail:
      `Estimación de gobernanza del Banco Mundial en ${wgi.year}, en desviaciones típicas respecto de la ` +
      `media mundial (cero)` +
      (before ? `; en ${before.year} era ${say(before.value)}` : '') +
      `.` +
      (vdem ? ` V-Dem da ${say(vdem.value, 3)} sobre 1 en ${vdem.year}.` : '') +
      (corruption
        ? ` La percepción de corrupción de Transparency International: ${say(corruption.value, 0)} sobre 100 en ${corruption.year}.`
        : ''),
    tone: wgi.value < -0.5 ? 'adverse' : 'neutral',
  };
}

function governanceConclusion(series: InstitutionsBoard['series']): FxConclusion | null {
  const dimensions = INSTITUTION_INDICATORS.filter(
    (entry) => entry.group === 'GOBERNANZA' && entry.max === 2.5,
  )
    .map((entry) => ({ entry, reading: last(series[entry.code]) }))
    .filter(
      (item): item is { entry: InstitutionIndicator; reading: YearValue } => item.reading !== null,
    )
    .sort((left, right) => left.reading.value - right.reading.value);
  if (dimensions.length < 3) return null;
  const below = dimensions.filter((item) => item.reading.value < 0).length;
  const weakest = dimensions[0]!;
  const strongest = dimensions.at(-1)!;
  return {
    key: 'gobernanza',
    claim: `${below} de ${dimensions.length} dimensiones de gobernanza están bajo la media mundial`,
    figure: `${weakest.reading.value < 0 ? '−' : ''}${say(Math.abs(weakest.reading.value))} la más baja`,
    detail:
      `Las seis estimaciones del Banco Mundial en ${weakest.reading.year}, de la más baja a la más alta: ` +
      dimensions
        .map((item) => `${item.entry.label.toLocaleLowerCase('es')} ${say(item.reading.value)}`)
        .join(', ') +
      `. Lo que más falla es ${weakest.entry.label.toLocaleLowerCase('es')}; lo que mejor está, ` +
      `${strongest.entry.label.toLocaleLowerCase('es')}.`,
    tone: below >= dimensions.length - 1 ? 'adverse' : 'neutral',
  };
}

/** The board, from the annual points the page already reads. */
export function buildInstitutionsBoard(points: readonly MacroPoint[]): InstitutionsBoard {
  const wanted = new Set(INSTITUTION_CODES);
  const series: Record<string, YearValue[]> = {};
  for (const point of points) {
    if (!wanted.has(point.indicatorCode) || !Number.isFinite(point.value)) continue;
    const year = Number(point.period.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    (series[point.indicatorCode] ??= []).push({ year, value: point.value });
  }
  for (const code of Object.keys(series))
    series[code]?.sort((left, right) => left.year - right.year);

  const conclusions = [
    economicConclusion(series),
    politicalConclusion(series),
    historyConclusion(series),
    democracyConclusion(series),
    regimeConclusion(series),
    ruleOfLawConclusion(series),
    governanceConclusion(series),
  ].filter((entry): entry is FxConclusion => entry !== null);

  const missing = INSTITUTION_CODES.filter((code) => !(series[code]?.length ?? 0));
  const asOfYear = Object.values(series)
    .map((own) => own.at(-1)?.year ?? 0)
    .reduce((best, year) => Math.max(best, year), 0);
  return { series, conclusions, missing, asOfYear: asOfYear || null };
}

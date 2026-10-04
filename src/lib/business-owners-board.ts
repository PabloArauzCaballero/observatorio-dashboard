import type { MacroPoint } from './series';

/**
 * «Empresas › Empresarios»: los dueños de las empresas más grandes y lo que
 * valen sus participaciones, año a año.
 *
 * Ninguna fuente publica las fortunas de los empresarios que viven en Bolivia
 * (Forbes nunca sacó una lista del país y sólo nombra a dos nacidos en él). Lo
 * que sí es público son sus dos insumos: **quién es dueño de qué**, en las
 * memorias de los bancos, los prospectos de la bolsa y los registros de
 * valores, y **cuánto vale en libros cada empresa**, en el balance auditado
 * que esos mismos documentos traen (y en «Las 500» donde se consiga). La
 * estimación del observatorio los multiplica, y la regla es la de todo el
 * capítulo: al corpus entran los insumos con su documento, y el producto se
 * calcula aquí, al dibujar, donde cada cifra se puede abrir en las piezas de
 * las que salió (ADR 0028 del núcleo).
 *
 * El método, entero:
 *
 * 1. **Participación efectiva.** Directa, o a través de sociedades cuando un
 *    documento atribuye la sociedad a la persona: se multiplican los tramos de
 *    la cadena y se suman los caminos. Para un año se usa el documento más
 *    reciente hasta ese año; si no hay ninguno anterior, el primero publicado
 *    hasta dos años después, porque una composición accionaria rara vez cambia
 *    de un año al siguiente.
 * 2. **Piso contable.** Participación efectiva por el patrimonio de la empresa
 *    ese año, del balance publicado. Una sociedad que sólo tiene acciones de otras de la lista no se
 *    cuenta aparte: contarla sería contar dos veces a la misma empresa.
 * 3. **Valor de mercado de referencia.** El piso por la razón precio/valor en
 *    libros de su industria en mercados emergentes (Damodaran) ese año: lo que
 *    valdría esa participación si cotizara como cotizan sus pares.
 * 4. Bolivianos a dólares al tipo oficial de 6,96, que es al que las empresas
 *    llevan su contabilidad.
 *
 * Es una **cota inferior**: no incluye inmuebles, cuentas, empresas fuera de la
 * lista ni nada fuera de Bolivia, y ninguna participación que un documento
 * público no declare.
 */

/*
 * Las dos lecturas del nombre que también usa `largest-companies-board`, escritas
 * aquí otra vez a propósito: las pruebas corren con `node --test` sobre el
 * TypeScript tal cual, sin empaquetador, y una importación de valor sin
 * extensión entre dos módulos de `lib` no resuelve ahí. Son cuatro líneas.
 */
function attributesOf(name: string | null): Record<string, string> {
  const block = /\{([^}]*)\}\s*$/u.exec(name ?? '')?.[1];
  const out: Record<string, string> = {};
  for (const pair of block?.split(';') ?? []) {
    const [key, ...rest] = pair.split('=');
    if (key?.trim() && rest.join('=').trim()) out[key.trim()] = rest.join('=').trim();
  }
  return out;
}

const ownerName = (name: string | null, fallback: string): string =>
  (name ?? '').split(': ')[0]?.replace(/\s*\{[^}]*\}\s*$/u, '').trim() || fallback;

const OFFICIAL_RATE = 6.96;
const CARRY_BACK = 2;
const MAX_DEPTH = 4;

export interface Stake {
  holder: string;
  holderName: string;
  holderKind: 'persona' | 'sociedad';
  company: string;
  companyName: string;
  year: number;
  pct: number;
  direct: boolean;
}

export interface Holding {
  company: string;
  name: string;
  sector: string | null;
  /** Participación efectiva, en tanto por ciento. */
  stake: number;
  /** De qué año es el documento que la sostiene. */
  documentYear: number;
  /** Patrimonio de la empresa, millones de dólares. */
  equity: number;
  book: number;
  multiple: number | null;
  industry: string | null;
  market: number | null;
  via: string | null;
}

export interface OwnerEstimate {
  person: string;
  name: string;
  year: number;
  book: number;
  market: number | null;
  holdings: Holding[];
}

export interface PublishedFortune {
  slug: string;
  name: string;
  attributes: Record<string, string>;
  points: Array<{ year: number; value: number }>;
}

export interface OwnerYearHistory {
  year: number;
  rank: number;
  /** Cantidad de personas con una estimación calculable ese año. */
  population: number;
  book: number;
  market: number | null;
  leadingHolding: string;
}

export interface OwnerHistory {
  person: string;
  name: string;
  firstYear: number;
  latestYear: number;
  bestRank: number;
  podiumYears: number[];
  peak: { year: number; rank: number; book: number; market: number | null };
  years: OwnerYearHistory[];
  mainHoldings: Array<{
    company: string;
    name: string;
    firstYear: number;
    latestYear: number;
    peakYear: number;
    peakBook: number;
    latestStake: number;
    estimateYears: number[];
  }>;
}

/**
 * Cuántos puestos se publican por año: los diez primeros. El podio de tres
 * escondía a casi todos —hay años con once estimaciones— y no dejaba ver cómo
 * se mueve el orden. Un año con menos personas tiene menos puestos: no se
 * rellenan.
 */
export const TOP_PLACES = 10;

export interface OwnerPodium {
  year: number;
  /** Universo comparable: personas con un piso calculable en la gestión. */
  population: number;
  places: Array<{
    person: string;
    name: string;
    rank: number;
    book: number;
    market: number | null;
  }>;
}

export interface OwnersBoard {
  estimates: OwnerEstimate[];
  histories: OwnerHistory[];
  podiums: OwnerPodium[];
  stakes: Stake[];
  forbes: PublishedFortune[];
  /** Impuesto a las Grandes Fortunas: cuántos lo pagan y cuánto. */
  wealthTax: Array<{ year: number; payers: number | null; collected: number | null; unit: string | null }>;
  benchmarks: Array<{ code: string; label: string; unit: string; points: Array<{ year: number; value: number }> }>;
  /** Empresas de la lista con dueños documentados, contra las que tienen patrimonio publicado. */
  coverage: { withOwners: number; withEquity: number; people: number };
  sources: Record<string, { publisher: string; url: string | null }>;
}

/** Industrias de Damodaran que corresponden a un sector escrito en castellano. */
const INDUSTRIES: ReadonlyArray<[RegExp, RegExp]> = [
  [/banc|financ|microfin|ahorro/iu, /^Bank|Banks/iu],
  [/seguro|reaseguro/iu, /Insurance \(General\)|Insurance/iu],
  [/cervec|alcoh/iu, /Beverage \(Alcoholic\)/iu],
  [/bebida|gaseosa|refresco/iu, /Beverage \(Soft\)/iu],
  [/aliment|l[aá]cte|av[ií]col|azúcar|azucar|ingenio|aceite|oleag/iu, /Food Processing/iu],
  [/cement|construc|ladrillo/iu, /Building Materials|Engineering\/Construction/iu],
  [/miner|metal/iu, /Metals & Mining|Precious Metals/iu],
  [/petr|hidrocarb|gas natural|refin/iu, /Oil\/Gas/iu],
  [/el[eé]ctric|energ/iu, /Utility|Power/iu],
  [/telecom|telefon|comunicaci/iu, /Telecom/iu],
  [/supermerc|hipermerc|retail|comercio|import|distribu/iu, /Retail \(General\)|Retail \(Distributors\)/iu],
  [/farmac|laborator|drog/iu, /Drugs \(Pharmaceutical\)/iu],
  [/automot|veh[ií]cul|motor/iu, /Auto & Truck/iu],
  [/transport|avia|log[ií]st/iu, /Transportation|Air Transport/iu],
  [/agro|agr[ií]col|ganad|soya/iu, /Farming\/Agriculture/iu],
  [/tabac/iu, /Tobacco/iu],
  [/papel|cart[oó]n/iu, /Paper/iu],
  [/qu[ií]mic|explosiv/iu, /Chemical/iu],
];

const toUsdMillions = (value: number, unit: string): number => {
  if (unit === 'MILLION_USD') return value;
  if (unit === 'THOUSAND_USD') return value / 1000;
  if (unit === 'USD') return value / 1_000_000;
  if (unit === 'MILLION_BOB') return value / OFFICIAL_RATE;
  if (unit === 'THOUSAND_BOB') return value / 1000 / OFFICIAL_RATE;
  return value / 1_000_000 / OFFICIAL_RATE;
};

export function buildOwnersBoard(ranking: readonly MacroPoint[], fortunes: readonly MacroPoint[]): OwnersBoard {
  const board: OwnersBoard = { estimates: [], histories: [], podiums: [], stakes: [], forbes: [], wealthTax: [], benchmarks: [], coverage: { withOwners: 0, withEquity: 0, people: 0 }, sources: {} };
  const equity = new Map<string, Map<number, number>>();
  const sectors = new Map<string, string>();
  const names = new Map<string, string>();
  for (const point of ranking) {
    if (!point.indicatorCode.startsWith('LARGEST_')) continue;
    const slug = point.indicatorCode.replace(/^LARGEST_[A-Z]+_/u, '');
    const sector = attributesOf(point.name).sector;
    if (sector) sectors.set(slug, sector);
    names.set(slug, ownerName(point.name, slug));
    if (!point.indicatorCode.startsWith('LARGEST_EQUITY_') || !Number.isFinite(point.value)) continue;
    const byYear = equity.get(slug) ?? new Map<number, number>();
    byYear.set(Number(point.period), toUsdMillions(point.value, point.unit));
    equity.set(slug, byYear);
  }

  const multiples = new Map<string, Map<number, number>>();
  const forbes = new Map<string, PublishedFortune>();
  const tax = new Map<number, OwnersBoard['wealthTax'][number]>();
  const benchmarks = new Map<string, OwnersBoard['benchmarks'][number]>();
  for (const point of fortunes) {
    if (!Number.isFinite(point.value)) continue;
    const code = point.indicatorCode;
    const year = Number(point.period);
    const family = code.split('_').slice(0, 2).join('_');
    board.sources[family] ??= { publisher: point.publisher ?? '', url: point.sourceUrl };
    if (code.startsWith('OWNER_EQUITY_')) {
      /*
       * El patrimonio que la empresa declara en el mismo documento auditado del
       * que sale su composición accionaria. Manda sobre el de «Las 500» cuando
       * hay los dos: es la cifra del balance, no una recopilación.
       */
      const attributes = attributesOf(point.name);
      const slug = attributes.empresa ?? code.slice('OWNER_EQUITY_'.length);
      if (attributes.sector) sectors.set(slug, attributes.sector);
      names.set(slug, ownerName(point.name, slug));
      const byYear = equity.get(slug) ?? new Map<number, number>();
      byYear.set(year, toUsdMillions(point.value, point.unit));
      equity.set(slug, byYear);
    } else if (code.startsWith('OWNER_STAKE_')) {
      const attributes = attributesOf(point.name);
      const holder = attributes.titular;
      const company = attributes.empresa;
      if (!holder || !company) continue;
      board.stakes.push({
        holder,
        holderName: ownerName(point.name, holder),
        holderKind: attributes.tipo === 'sociedad' ? 'sociedad' : 'persona',
        company,
        companyName: names.get(company) ?? (point.name ?? '').split(' en ').at(-1)?.replace(/\s*\{.*$/u, '') ?? company,
        year,
        pct: point.value,
        direct: attributes.directa !== 'no',
      });
    } else if (code.startsWith('WEALTH_FORBES_NETWORTH_')) {
      const slug = code.slice('WEALTH_FORBES_NETWORTH_'.length);
      const row = forbes.get(slug) ?? { slug, name: ownerName(point.name, slug), attributes: attributesOf(point.name), points: [] };
      row.points.push({ year, value: point.value });
      forbes.set(slug, row);
    } else if (code.startsWith('WEALTH_PBV_')) {
      const label = (point.name ?? '').split(': ').at(-1)?.replace(/\s*\{.*$/u, '') ?? code;
      const byYear = multiples.get(label) ?? new Map<number, number>();
      byYear.set(year, point.value);
      multiples.set(label, byYear);
    } else if (code.startsWith('WEALTH_IGF_')) {
      const row = tax.get(year) ?? { year, payers: null, collected: null, unit: null };
      if (code.includes('PAYERS')) row.payers = point.value;
      else {
        row.collected = point.value;
        row.unit = point.unit;
      }
      tax.set(year, row);
    } else if (code.startsWith('WEALTH_')) {
      const row = benchmarks.get(code) ?? { code, label: ownerName(point.name, code), unit: point.unit, points: [] };
      row.points.push({ year, value: point.value });
      benchmarks.set(code, row);
    }
  }
  board.forbes = [...forbes.values()].map((row) => ({ ...row, points: row.points.sort((a, b) => a.year - b.year) }));
  board.wealthTax = [...tax.values()].sort((a, b) => a.year - b.year);
  board.benchmarks = [...benchmarks.values()].map((row) => ({ ...row, points: row.points.sort((a, b) => a.year - b.year) }));

  const multipleFor = (sector: string | null, year: number): { value: number; industry: string } | null => {
    const rule = sector ? INDUSTRIES.find(([pattern]) => pattern.test(sector)) : undefined;
    const candidates = [...multiples.keys()].filter((label) => (rule ? rule[1].test(label) : /Total Market/iu.test(label)));
    const label = candidates.find((one) => multiples.get(one)?.has(year)) ?? candidates[0];
    if (!label) return null;
    const byYear = multiples.get(label)!;
    const nearest = [...byYear.keys()].sort((a, b) => Math.abs(a - year) - Math.abs(b - year))[0];
    return nearest === undefined ? null : { value: byYear.get(nearest)!, industry: label };
  };

  /** La participación vigente de cada tramo en un año, según la regla del punto 1. */
  const stakeIn = (holder: string, company: string, year: number): { pct: number; documentYear: number } | null => {
    const docs = board.stakes.filter((one) => one.holder === holder && one.company === company).sort((a, b) => a.year - b.year);
    const before = docs.filter((one) => one.year <= year).at(-1);
    const after = docs.find((one) => one.year > year && one.year - year <= CARRY_BACK);
    const chosen = before ?? after;
    return chosen ? { pct: chosen.pct, documentYear: chosen.year } : null;
  };
  const owned = (holder: string): string[] => [...new Set(board.stakes.filter((one) => one.holder === holder).map((one) => one.company))];

  const years = [...new Set([...equity.values()].flatMap((byYear) => [...byYear.keys()]))].sort((a, b) => a - b);
  const people = [...new Map(board.stakes.filter((one) => one.holderKind === 'persona').map((one) => [one.holder, one.holderName])).entries()];
  for (const [person, name] of people) {
    for (const year of years) {
      const reach = new Map<string, { stake: number; documentYear: number; via: string | null }>();
      const walk = (holder: string, share: number, depth: number, via: string | null, seen: Set<string>): void => {
        if (depth > MAX_DEPTH) return;
        for (const company of owned(holder)) {
          if (seen.has(company)) continue;
          const link = stakeIn(holder, company, year);
          if (!link) continue;
          const effective = (share * link.pct) / 100;
          const prior = reach.get(company);
          reach.set(company, {
            stake: (prior?.stake ?? 0) + effective,
            documentYear: Math.max(prior?.documentYear ?? 0, link.documentYear),
            via: prior?.via ?? via,
          });
          walk(company, effective, depth + 1, via ?? names.get(company) ?? company, new Set([...seen, company]));
        }
      };
      walk(person, 100, 1, null, new Set());
      const holdings: Holding[] = [];
      for (const [company, link] of reach) {
        const value = equity.get(company)?.get(year);
        if (value === undefined) continue;
        const passThrough = owned(company).some((child) => reach.has(child) && equity.get(child)?.has(year));
        if (passThrough) continue;
        const sector = sectors.get(company) ?? null;
        const multiple = multipleFor(sector, year);
        const book = (link.stake / 100) * value;
        holdings.push({
          company,
          name: names.get(company) ?? company,
          sector,
          stake: link.stake,
          documentYear: link.documentYear,
          equity: value,
          book,
          multiple: multiple?.value ?? null,
          industry: multiple?.industry ?? null,
          market: multiple ? book * multiple.value : null,
          via: link.via,
        });
      }
      if (!holdings.length) continue;
      const book = holdings.reduce((sum, one) => sum + one.book, 0);
      const market = holdings.every((one) => one.market !== null) ? holdings.reduce((sum, one) => sum + (one.market ?? 0), 0) : null;
      board.estimates.push({ person, name, year, book, market, holdings: holdings.sort((a, b) => b.book - a.book) });
    }
  }

  const rankedByYear = new Map<number, OwnerEstimate[]>();
  for (const estimate of board.estimates) {
    const rows = rankedByYear.get(estimate.year) ?? [];
    rows.push(estimate);
    rankedByYear.set(estimate.year, rows);
  }
  for (const rows of rankedByYear.values()) {
    rows.sort((left, right) => right.book - left.book || left.name.localeCompare(right.name, 'es'));
  }
  board.podiums = [...rankedByYear.entries()]
    .sort(([left], [right]) => left - right)
    .map(([year, rows]) => ({
      year,
      population: rows.length,
      places: rows.slice(0, TOP_PLACES).map((estimate, index) => ({
        person: estimate.person,
        name: estimate.name,
        rank: index + 1,
        book: estimate.book,
        market: estimate.market,
      })),
    }));

  const histories = new Map<string, { name: string; years: OwnerYearHistory[] }>();
  for (const [year, rows] of rankedByYear) {
    rows.forEach((estimate, index) => {
      const history = histories.get(estimate.person) ?? { name: estimate.name, years: [] };
      history.years.push({
        year,
        rank: index + 1,
        population: rows.length,
        book: estimate.book,
        market: estimate.market,
        leadingHolding: estimate.holdings[0]?.name ?? '—',
      });
      histories.set(estimate.person, history);
    });
  }
  board.histories = [...histories.entries()]
    .map(([person, history]) => {
      const years = history.years.sort((left, right) => left.year - right.year);
      const peak = [...years].sort((left, right) => right.book - left.book || right.year - left.year)[0]!;
      const holdingHistory = new Map<string, OwnerHistory['mainHoldings'][number]>();
      for (const estimate of board.estimates.filter((row) => row.person === person).sort((left, right) => left.year - right.year)) {
        for (const holding of estimate.holdings) {
          const current = holdingHistory.get(holding.company);
          if (!current) {
            holdingHistory.set(holding.company, {
              company: holding.company,
              name: holding.name,
              firstYear: estimate.year,
              latestYear: estimate.year,
              peakYear: estimate.year,
              peakBook: holding.book,
              latestStake: holding.stake,
              estimateYears: [estimate.year],
            });
            continue;
          }
          current.latestYear = estimate.year;
          current.latestStake = holding.stake;
          if (!current.estimateYears.includes(estimate.year)) current.estimateYears.push(estimate.year);
          if (holding.book > current.peakBook) {
            current.peakBook = holding.book;
            current.peakYear = estimate.year;
          }
        }
      }
      return {
        person,
        name: history.name,
        firstYear: years[0]!.year,
        latestYear: years.at(-1)!.year,
        bestRank: Math.min(...years.map((row) => row.rank)),
        podiumYears: years.filter((row) => row.rank <= 3).map((row) => row.year),
        peak: { year: peak.year, rank: peak.rank, book: peak.book, market: peak.market },
        years,
        mainHoldings: [...holdingHistory.values()].sort((left, right) => right.peakBook - left.peakBook || left.name.localeCompare(right.name, 'es')),
      };
    })
    .sort((left, right) => left.bestRank - right.bestRank || right.peak.book - left.peak.book || left.name.localeCompare(right.name, 'es'));

  board.coverage = {
    withOwners: new Set(board.stakes.map((one) => one.company)).size,
    withEquity: equity.size,
    people: new Set(board.estimates.map((one) => one.person)).size,
  };
  return board;
}

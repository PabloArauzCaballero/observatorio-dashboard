import type { MacroPoint } from './series';

/**
 * «Empresas › Principales empresas»: quiénes son las más grandes, año a año,
 * medidas con dos varas.
 *
 * - **Impuestos** publica cada año las cien empresas que más impuestos pagaron,
 *   con el monto y la parte de la recaudación. Es oficial y mide impuesto
 *   pagado, no ventas: un banco con utilidades altas paga más que un comercio
 *   que factura el doble.
 * - **«Las 500 empresas más grandes de Bolivia»** (Hugo Siles Espada) publica
 *   ingresos, utilidad, activo, pasivo y patrimonio de cada empresa con los
 *   estados que encuentra: de reguladores, de la bolsa o de la propia empresa.
 *   Es privada y mezcla estados auditados y sin auditar; la página lo dice.
 *
 * Las dos se cruzan por el código de empresa que el núcleo arma sin la forma
 * societaria, así que «BANCO GANADERO S.A.» de Impuestos y «Banco Ganadero» de
 * Siles son una sola fila. Los atributos que no son cifras —departamento,
 * sector, si es pública— viajan entre llaves al final del nombre.
 */

export type CompanyMeasure =
  | 'taxRank'
  | 'taxPaid'
  | 'taxShare'
  | 'rank'
  | 'revenue'
  | 'profit'
  | 'assets'
  | 'liabilities'
  | 'equity';

export interface CompanyYear {
  year: number;
  taxRank?: number;
  taxPaid?: number;
  taxShare?: number;
  rank?: number;
  revenue?: number;
  profit?: number;
  assets?: number;
  liabilities?: number;
  equity?: number;
}

export interface LargestCompany {
  slug: string;
  name: string;
  attributes: Record<string, string>;
  years: CompanyYear[];
}

export interface LargestBoard {
  companies: LargestCompany[];
  /** Qué parte de la recaudación pagaron las cien, cada año. */
  coverage: Array<{ year: number; pct: number }>;
  /** La unidad en que viene cada medida, tal como la escribió el colector. */
  units: Partial<Record<CompanyMeasure, string>>;
  sources: Record<string, { publisher: string; url: string | null }>;
}

const CODES: ReadonlyArray<[string, CompanyMeasure]> = [
  ['TAXTOP_RANK_', 'taxRank'],
  ['TAXTOP_PAID_', 'taxPaid'],
  ['TAXTOP_SHARE_', 'taxShare'],
  ['LARGEST_RANK_', 'rank'],
  ['LARGEST_REVENUE_', 'revenue'],
  ['LARGEST_PROFIT_', 'profit'],
  ['LARGEST_ASSETS_', 'assets'],
  ['LARGEST_LIABILITIES_', 'liabilities'],
  ['LARGEST_EQUITY_', 'equity'],
];

/** `{departamento=Santa Cruz; sector=Bancos}` al final de un nombre, como pares. */
export function attributesOf(name: string | null): Record<string, string> {
  const block = /\{([^}]*)\}\s*$/u.exec(name ?? '')?.[1];
  const out: Record<string, string> = {};
  if (!block) return out;
  for (const pair of block.split(';')) {
    const [key, ...rest] = pair.split('=');
    const value = rest.join('=').trim();
    if (key?.trim() && value) out[key.trim()] = value;
  }
  return out;
}

/** Lo que va antes de «: », sin las llaves: la empresa o la persona. */
export function ownerName(name: string | null, fallback: string): string {
  const head = (name ?? '').split(': ')[0]?.replace(/\s*\{[^}]*\}\s*$/u, '').trim();
  return head || fallback;
}

export function buildLargestBoard(points: readonly MacroPoint[]): LargestBoard {
  const companies = new Map<string, LargestCompany>();
  const years = new Map<string, CompanyYear>();
  const board: LargestBoard = { companies: [], coverage: [], units: {}, sources: {} };

  for (const point of points) {
    if (!Number.isFinite(point.value)) continue;
    const code = point.indicatorCode;
    const year = Number(point.period);
    if (code === 'TAXTOP_COVERAGE_PCT') {
      board.coverage.push({ year, pct: point.value });
      continue;
    }
    const found = CODES.find(([prefix]) => code.startsWith(prefix));
    if (!found) continue;
    const [prefix, measure] = found;
    const slug = code.slice(prefix.length);
    const family = prefix.startsWith('TAXTOP') ? 'TAXTOP' : 'LARGEST';
    board.sources[family] ??= { publisher: point.publisher ?? '', url: point.sourceUrl };
    board.units[measure] ??= point.unit;

    const company = companies.get(slug) ?? { slug, name: ownerName(point.name, slug), attributes: {}, years: [] };
    /*
     * Los atributos de la fuente oficial mandan: el departamento que imprime
     * Impuestos es el de la gerencia donde la empresa tributa, y el sector de
     * Siles completa lo que Impuestos no dice.
     */
    const attributes = attributesOf(point.name);
    for (const [key, value] of Object.entries(attributes)) {
      if (family === 'TAXTOP' || !(key in company.attributes)) company.attributes[key] = value;
    }
    if (family === 'TAXTOP') company.name = ownerName(point.name, slug);
    companies.set(slug, company);

    const id = `${slug}|${year}`;
    const row = years.get(id) ?? { year };
    row[measure] = point.value;
    if (!years.has(id)) {
      years.set(id, row);
      company.years.push(row);
    }
  }

  board.companies = [...companies.values()].map((company) => ({
    ...company,
    years: company.years.sort((left, right) => left.year - right.year),
  }));
  board.coverage.sort((left, right) => left.year - right.year);
  return board;
}

export const EMPTY_LARGEST_BOARD: LargestBoard = buildLargestBoard([]);

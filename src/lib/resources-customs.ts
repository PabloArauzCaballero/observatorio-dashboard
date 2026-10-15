/**
 * Qué cuenta como «recurso natural» en la base aduanera del INE, y cómo se pide.
 *
 * La página «Recursos naturales» mira lo que Bolivia saca de su suelo y vende
 * afuera: minería e hidrocarburos, más el litio y los boratos del salar. La
 * base aduanera trae cada exportación por partida NANDINA de diez dígitos, país
 * de destino, departamento de origen y mes; este archivo agrupa esas partidas
 * en recursos que un lector reconoce («Zinc», «Gas natural») y arma el filtro de
 * producto que entiende `/api/comercio-exterior/aduana`.
 *
 * **Qué entra.** Cada recurso junta el mineral en bruto o concentrado (capítulo
 * 26 del arancel) con el metal que sale de fundición o refinería: el estaño de
 * Vinto (8001) es el mismo estaño que el concentrado de la partida 2609. El
 * litio se exporta como carbonato (2836.91) o cloruro (2827.39), que el arancel
 * clasifica como productos **químicos** y no como minerales: sin nombrarlas, el
 * litio no aparece. El gas natural se separa del gas licuado de petróleo (GLP),
 * que va con el petróleo y sus derivados.
 *
 * **Qué no entra, a propósito.** La soya, la castaña y la madera también son
 * recursos naturales, pero no del subsuelo: son cultivo, recolección o tala, y
 * ya se ven por producto en «Sector externo». Tampoco los desperdicios de metal
 * precioso (7112), que son chatarra y no extracción.
 *
 * **Lo que no tiene nombre propio** del capítulo 26 —manganeso, niobio y
 * tántalo, escorias— va a «Manganeso y demás». Nueve partidas del capítulo que en
 * 34 años sumaron menos de 0,2 millones de USD en total (níquel, cromo,
 * titanio, aluminio…) no se piden por separado para que el filtro quepa en el
 * tope de 40 códigos de la API; cuando se eligen todos los minerales a la vez se
 * pide el capítulo 26 entero y sí entran.
 */

export type ResourceFamily = 'mineria' | 'minerales' | 'hidrocarburos' | 'salar';

export interface CustomsResource {
  id: string;
  label: string;
  family: ResourceFamily;
  /** Prefijos NANDINA (2 a 10 dígitos). Ninguno es prefijo de otro recurso. */
  codes: readonly string[];
  /** De qué está hecho el recurso, para la nota del lector. */
  note: string;
}

export const FAMILY_LABEL: Record<ResourceFamily, string> = {
  mineria: 'Metales',
  minerales: 'Otros minerales',
  hidrocarburos: 'Hidrocarburos',
  salar: 'Litio y boratos',
};

export const RESOURCES: readonly CustomsResource[] = [
  {
    id: 'zinc',
    label: 'Zinc',
    family: 'mineria',
    codes: ['2608', '7901'],
    note: 'concentrado de zinc (2608) y zinc en bruto (7901)',
  },
  {
    id: 'plata',
    label: 'Plata',
    family: 'mineria',
    codes: ['261610', '7106'],
    note: 'concentrado de plata (2616.10) y plata metálica (7106)',
  },
  {
    id: 'oro',
    label: 'Oro',
    family: 'mineria',
    codes: ['7108', '261690'],
    note: 'oro en bruto (7108) y concentrado de oro (2616.90)',
  },
  {
    id: 'estano',
    label: 'Estaño',
    family: 'mineria',
    codes: ['2609', '8001'],
    note: 'concentrado de estaño (2609) y estaño metálico (8001)',
  },
  {
    id: 'plomo',
    label: 'Plomo',
    family: 'mineria',
    codes: ['2607', '7801'],
    note: 'concentrado de plomo (2607) y plomo refinado (7801)',
  },
  {
    id: 'antimonio',
    label: 'Antimonio',
    family: 'minerales',
    codes: ['261710', '282580', '8110'],
    note: 'concentrado (2617.10), óxidos (2825.80) y antimonio metálico (8110)',
  },
  {
    id: 'wolframio',
    label: 'Wolframio',
    family: 'minerales',
    codes: ['2611', '8101'],
    note: 'concentrado de wolframio o tungsteno (2611) y metal (8101)',
  },
  {
    id: 'cobre',
    label: 'Cobre',
    family: 'mineria',
    codes: ['2603', '7402', '7403'],
    note: 'concentrado de cobre (2603) y cobre refinado (7402, 7403)',
  },
  {
    id: 'hierro',
    label: 'Hierro',
    family: 'minerales',
    codes: ['2601'],
    note: 'mineral y pellets de hierro (2601)',
  },
  {
    id: 'otros',
    label: 'Manganeso y demás',
    family: 'minerales',
    codes: ['2602', '2615', '261790', '262'],
    note: 'manganeso (2602), niobio y tántalo (2615), demás minerales (2617.90) y escorias (262)',
  },
  {
    id: 'gas',
    label: 'Gas natural',
    family: 'hidrocarburos',
    codes: ['271121', '271111'],
    note: 'gas natural por gasoducto (2711.21) y licuado (2711.11)',
  },
  {
    id: 'petroleo',
    label: 'Petróleo y derivados',
    family: 'hidrocarburos',
    codes: ['2709', '2710', '271112', '271113', '271119'],
    note: 'crudo (2709), combustibles y aceites (2710) y gas licuado de petróleo (2711.12-19)',
  },
  {
    id: 'litio',
    label: 'Litio',
    family: 'salar',
    codes: ['283691', '282739'],
    note: 'carbonato (2836.91) y cloruro de litio (2827.39), partidas químicas',
  },
  {
    id: 'boratos',
    label: 'Boratos (ulexita)',
    family: 'salar',
    codes: ['2528', '2810'],
    note: 'ulexita y boratos naturales (2528) y ácido bórico (2810)',
  },
];

const BY_ID = new Map(RESOURCES.map((resource) => [resource.id, resource]));

export const resourceById = (id: string): CustomsResource | undefined => BY_ID.get(id);

/** Los recursos cuyos códigos son todos del capítulo 26 (y del metal que de él sale). */
const CHAPTER_26 = RESOURCES.filter((resource) =>
  resource.codes.some((code) => code.startsWith('26')),
);

/**
 * El recurso al que pertenece una partida de diez dígitos, por el prefijo más
 * largo que la contiene. Lo demás del capítulo 26 es «Otros minerales»: así
 * las partidas mínimas que entran al pedir el capítulo entero no quedan sueltas.
 */
export function resourceOf(nandina: string): CustomsResource | undefined {
  let best: CustomsResource | undefined;
  let length = 0;
  for (const resource of RESOURCES) {
    for (const code of resource.codes) {
      if (nandina.startsWith(code) && code.length > length) {
        best = resource;
        length = code.length;
      }
    }
  }
  if (!best && nandina.startsWith('26')) return BY_ID.get('otros');
  return best;
}

/**
 * El filtro `product` para la API: los códigos de los recursos elegidos, o de
 * todos si no se eligió ninguno. Cuando entran todos los minerales del capítulo
 * 26 se pide el capítulo entero (`26`), que es más corto y además trae las
 * partidas mínimas que no tienen recurso propio.
 */
export function productFilter(chosen: Iterable<string>): string[] {
  const ids = new Set(chosen);
  const picked = ids.size ? RESOURCES.filter((resource) => ids.has(resource.id)) : [...RESOURCES];
  const wholeChapter = CHAPTER_26.every((resource) => picked.includes(resource));
  const codes = picked.flatMap((resource) =>
    wholeChapter ? resource.codes.filter((code) => !code.startsWith('26')) : resource.codes,
  );
  return [...new Set(wholeChapter ? ['26', ...codes] : codes)];
}

/** Lo que una vista por partida trae de cada fila. */
export interface ProductRow {
  key: string | null;
  usd: number;
  kg: number;
}

export interface ResourceTotal {
  resource: CustomsResource;
  usd: number;
  kg: number;
}

/** Las filas por partida sumadas por recurso, de mayor a menor valor. */
export function byResource(rows: readonly ProductRow[]): ResourceTotal[] {
  const sums = new Map<string, ResourceTotal>();
  for (const row of rows) {
    const resource = row.key ? resourceOf(row.key) : undefined;
    if (!resource) continue;
    const entry = sums.get(resource.id) ?? { resource, usd: 0, kg: 0 };
    entry.usd += row.usd;
    entry.kg += row.kg;
    sums.set(resource.id, entry);
  }
  return [...sums.values()].sort((left, right) => right.usd - left.usd);
}

/** Variación porcentual; `null` cuando no hay base con qué comparar. */
export const growth = (now: number, before: number): number | null =>
  before > 0 ? (now / before - 1) * 100 : null;

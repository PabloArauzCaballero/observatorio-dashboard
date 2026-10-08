/**
 * Lo que viaja entre la ruta `/api/personalidades` y la pestaña «Personalidades».
 *
 * Solo tipos: lo importan el servidor (`people-payload.ts`) y el cliente
 * (`components/people/people-model.ts`), y ninguno de los dos arrastra al otro.
 */

export type SectorKey =
  | 'POLITICS'
  | 'BUSINESS'
  | 'MEDIA'
  | 'SCIENCE'
  | 'CULTURE'
  | 'CIVIC'
  | 'SPORTS'
  | 'UNCLASSIFIED';

export interface Evidence {
  source: string;
  url: string;
  rank?: number | undefined;
}

/** Cada componente del índice llega con su cifra bruta y con su percentil (0–1). */
export interface Components {
  wikipediaViews12m: number | null;
  wikipediaViewsEs: number | null;
  wikipediaViewsEn: number | null;
  verifiedFollowers: number | null;
  mercoRank: number | null;
  pressArticles: number | null;
  percentiles?: { views: number | null; social: number | null; merco: number | null } | undefined;
}

export interface VerifiedAccount {
  platform: string;
  followers: number | null;
}

export interface Account extends VerifiedAccount {
  url: string;
  verification: string;
}

export interface Sentiment {
  analyzed: number;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
  ironyPct: number | null;
  netScore?: number | undefined;
}

export interface Term {
  term: string;
  count: number;
}

/** Lo que se leyó de YouTube sobre una persona, en lo que cabe en la lista. */
export interface Talk {
  videos: number;
  read: number;
  analyzed: number;
  /** `null` mientras la muestra no alcanza el mínimo para publicar el porcentaje. */
  sentiment: Sentiment | null;
}

export interface PersonRow {
  slug: string;
  name: string;
  sector: SectorKey;
  rank: number;
  sectorRank: number;
  score: number;
  measured: boolean;
  components: Components;
  /** Cuentas que suman al índice, sin su dirección: la dirección va en la ficha. */
  accounts: VerifiedAccount[];
  /** Cuántas cuentas halladas no suman (y por qué se ve en la ficha). */
  unverified: number;
  talk: Talk | null;
  /** Hay muestra de su propio canal (las tres personas del piloto). */
  own: boolean;
  /** Puesto en el Top 5 de Ipsos, si lo tiene. */
  ipsos: number | null;
}

export interface RankedPerson {
  rank: number;
  slug: string;
  name: string;
  impactSharePercent: number;
  sector: string;
}

export interface ImpactRanking {
  title: string;
  measurementPeriod: string;
  question: string;
  metric: string;
  accessNote: string | null;
  source: {
    publisher: string;
    publication: string;
    publishedAt: string;
    url: string;
    sampleSize: number;
    population: string;
    fieldworkStart: string;
    fieldworkEnd: string;
    geographicCoverage: string[];
    referenceMarginOfErrorPercentagePoints: number;
  };
  scope: string;
  coverageLimit: string;
  /** La nota de actualidad sin el enlace pegado en medio de la frase. */
  currentness: string;
  currentnessUrl: string | null;
  people: RankedPerson[];
}

export interface Quality {
  padron: {
    fichasOriginales: number;
    fichasEnElRanking: number;
    porFuente: Record<string, number>;
  };
  identidad: {
    coincidenciasWikidata: number;
    revisadasYAceptadas: number;
    descartadas: number;
    duplicadasFusionadas: number;
    fueraDeAlcance: number;
  };
  cuentas: { suman: Record<string, number>; noSuman: Record<string, number> };
  conVisitasWikipedia: number;
  conAudienciaVerificada: number;
  conPuestoMerco: number;
}

export interface Weights {
  views: number;
  social: number;
  merco: number;
}

export interface PeopleSummary {
  generatedAt: string;
  ranking: ImpactRanking;
  method: { summary: string; limits: string[]; weights: Weights; measuredPeople: number };
  quality: Quality;
  conversation: {
    source: string;
    limits: string[];
    minComments: number;
    peopleRead: number;
    peoplePublishable: number;
    commentsAnalyzed: number;
  };
  /** Las palabras que más se repiten sumadas entre las personas con muestra suficiente. */
  words: Term[];
  people: PersonRow[];
}

export interface TalkVideo {
  videoId: string;
  title: string;
  published: string | null;
  url: string;
  commentsRead: number;
}

export interface OwnChannel {
  accountUrl: string;
  followersApprox: number | null;
  retrievedAt: string;
  postsInWindow: number;
  commentsCaptured: number;
  commentsAnalyzedSpanish: number;
  sentiment: Sentiment;
  words: Term[];
  posts: Array<{
    url: string;
    title: string;
    publishedAt: string | null;
    comments: number | null;
    commentsAnalyzedSpanish: number;
  }>;
}

/** Lo que solo hace falta al abrir la ficha de alguien. */
export interface PersonDetail {
  slug: string;
  identity: string;
  identityNote: string | null;
  evidence: Evidence[];
  verifiedAccounts: Account[];
  unverifiedAccounts: Account[];
  videos: TalkVideo[];
  words: Term[];
  own: OwnChannel | null;
}

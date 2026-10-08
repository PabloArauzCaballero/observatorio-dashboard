/**
 * De los JSON de la investigación a lo que cabe en la pantalla.
 *
 * La ruta mandaba los cuatro archivos enteros —567 KB, de los que 89 eran la lista de
 * investigación repetida— y la pestaña usaba un tercio. Aquí se parten en dos: el
 * **resumen** (lo que pinta cualquier página: el ránking, las 298 filas con sus cifras, la
 * calidad) y la **ficha** de una persona (evidencia, direcciones de cuentas, videos,
 * palabras), que se pide al abrirla. Puro, sin `window` ni `server-only`, para probarlo con
 * `node --test`.
 */
import type {
  Account,
  Components,
  Evidence,
  ImpactRanking,
  OwnChannel,
  PeopleSummary,
  PersonDetail,
  PersonRow,
  Quality,
  SectorKey,
  Sentiment,
  Talk,
  TalkVideo,
  Term,
  Weights,
} from './people-types';

interface RawAccount {
  platform: string;
  url: string;
  followers: number | null;
  verification: string;
}

interface RawPerson {
  slug: string;
  name: string;
  sector: string;
  identity: string;
  identityNote: string | null;
  evidence: Evidence[];
  rank: number;
  sectorRank: number;
  score: number;
  measured: boolean;
  components: Components;
  verifiedAccounts: RawAccount[];
  unverifiedAccounts: RawAccount[];
}

interface RawConversationEntry {
  videosRead: number;
  commentsRead: number;
  commentsAnalyzed: number;
  videos: TalkVideo[];
  sentiment: Sentiment | null;
  words: Array<{ kind: string; term: string; count: number }> | null;
}

interface RawPilot {
  slug: string;
  accountUrl: string;
  followersApprox: number | null;
  retrievedAt: string;
  postsInWindow: number;
  commentsCaptured: number;
  commentsAnalyzedSpanish: number;
  sentiment: Sentiment;
  wordCloud: Array<{ kind: string; term: string; count: number }>;
  posts: Array<{
    url: string;
    title: string;
    publishedAt: string | null;
    comments: number | null;
    commentsAnalyzedSpanish: number;
  }>;
}

export interface RawPeopleData {
  ranking: {
    title: string;
    measurementPeriod: string;
    question: string;
    metric: string;
    accessNote?: string | undefined;
    source: ImpactRanking['source'];
    interpretation: { scope: string; coverageLimit: string; currentness: string };
    people: ImpactRanking['people'];
  };
  top300: {
    generatedAt: string;
    method: {
      weights: Weights;
      summary: string;
      limits: string[];
      measuredPeople: number;
      quality: Quality;
    };
    people: RawPerson[];
  };
  conversation: {
    method: { source: string; limits: string[]; minComments: number };
    coverage: { peopleRead: number; peoplePublishable: number; commentsAnalyzed: number };
    people: Record<string, RawConversationEntry>;
  };
  pilot: { people: RawPilot[] };
}

const WORDS_PER_PERSON = 25;
const WORDS_ALL = 60;

/** Quita el enlace pegado en medio de la frase: la ficha de la encuesta lo muestra aparte. */
export function splitUrl(text: string): { text: string; url: string | null } {
  const match = /https?:\/\/\S+/.exec(text);
  if (!match) return { text, url: null };
  const url = match[0].replace(/[.,;:]+$/, '');
  const clean = text
    .replace(match[0], '')
    .replace(/\s*:\s*$/, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { text: clean, url };
}

const topWords = (
  rows: ReadonlyArray<{ kind: string; term: string; count: number }> | null,
  limit: number,
): Term[] =>
  (rows ?? [])
    .filter((row) => row.kind === 'WORD')
    .slice(0, limit)
    .map((row) => ({ term: row.term, count: row.count }));

export function buildSummary(raw: RawPeopleData): PeopleSummary {
  const ipsos = new Map(raw.ranking.people.map((row) => [row.slug, row.rank]));
  const own = new Set(raw.pilot.people.map((row) => row.slug));
  const totals = new Map<string, number>();

  const people: PersonRow[] = raw.top300.people.map((person) => {
    const entry = raw.conversation.people[person.slug];
    const talk: Talk | null = entry
      ? {
          videos: entry.videosRead,
          read: entry.commentsRead,
          analyzed: entry.commentsAnalyzed,
          sentiment: entry.sentiment,
        }
      : null;
    if (entry?.sentiment) {
      for (const word of topWords(entry.words, WORDS_PER_PERSON))
        totals.set(word.term, (totals.get(word.term) ?? 0) + word.count);
    }
    return {
      slug: person.slug,
      name: person.name,
      sector: person.sector as SectorKey,
      rank: person.rank,
      sectorRank: person.sectorRank,
      score: person.score,
      measured: person.measured,
      components: person.components,
      accounts: person.verifiedAccounts.map((a) => ({
        platform: a.platform,
        followers: a.followers,
      })),
      unverified: person.unverifiedAccounts.length,
      talk,
      own: own.has(person.slug),
      ipsos: ipsos.get(person.slug) ?? null,
    };
  });

  const current = splitUrl(raw.ranking.interpretation.currentness);
  const ranking: ImpactRanking = {
    title: raw.ranking.title,
    measurementPeriod: raw.ranking.measurementPeriod,
    question: raw.ranking.question,
    metric: raw.ranking.metric,
    accessNote: raw.ranking.accessNote ?? null,
    source: raw.ranking.source,
    scope: raw.ranking.interpretation.scope,
    coverageLimit: raw.ranking.interpretation.coverageLimit,
    currentness: current.text,
    currentnessUrl: current.url,
    people: raw.ranking.people,
  };

  return {
    generatedAt: raw.top300.generatedAt,
    ranking,
    method: {
      summary: raw.top300.method.summary,
      limits: raw.top300.method.limits,
      weights: raw.top300.method.weights,
      measuredPeople: raw.top300.method.measuredPeople,
    },
    quality: raw.top300.method.quality,
    conversation: {
      source: raw.conversation.method.source,
      limits: raw.conversation.method.limits,
      minComments: raw.conversation.method.minComments,
      ...raw.conversation.coverage,
    },
    words: [...totals.entries()]
      .map(([term, count]) => ({ term, count }))
      .sort((left, right) => right.count - left.count || left.term.localeCompare(right.term, 'es'))
      .slice(0, WORDS_ALL),
    people,
  };
}

const asAccount = (a: RawAccount): Account => ({
  platform: a.platform,
  url: a.url,
  followers: a.followers,
  verification: a.verification,
});

export function buildDetail(raw: RawPeopleData, slug: string): PersonDetail | null {
  const person = raw.top300.people.find((row) => row.slug === slug);
  if (!person) return null;
  const entry = raw.conversation.people[slug];
  const pilot = raw.pilot.people.find((row) => row.slug === slug);
  const own: OwnChannel | null = pilot
    ? {
        accountUrl: pilot.accountUrl,
        followersApprox: pilot.followersApprox,
        retrievedAt: pilot.retrievedAt,
        postsInWindow: pilot.postsInWindow,
        commentsCaptured: pilot.commentsCaptured,
        commentsAnalyzedSpanish: pilot.commentsAnalyzedSpanish,
        sentiment: pilot.sentiment,
        words: topWords(pilot.wordCloud, WORDS_PER_PERSON),
        posts: pilot.posts,
      }
    : null;
  return {
    slug,
    identity: person.identity,
    identityNote: person.identityNote,
    evidence: person.evidence,
    verifiedAccounts: person.verifiedAccounts.map(asAccount),
    unverifiedAccounts: person.unverifiedAccounts.map(asAccount),
    videos: entry?.videos ?? [],
    words: topWords(entry?.words ?? null, WORDS_PER_PERSON),
    own,
  };
}

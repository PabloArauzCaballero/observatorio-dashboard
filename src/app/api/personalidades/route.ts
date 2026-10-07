import research from '@/data/people-research-300.json';
import pilot from '@/data/people-pilot-3.json';
import ranking from '@/data/people-impact-ranking-2025.json';
import top300 from '@/data/people-top300.json';
import conversation from '@/data/people-conversation.json';
import { jsonResponse } from '@/lib/respond';

export const dynamic = 'force-dynamic';

/** Research coverage and aggregate comments. Unverified account URLs stay internal. */
export function GET(request: Request): Response {
  const people = research.people.map((person) => ({
    slug: person.slug,
    name: person.name,
    sector: person.sector,
    evidence: person.evidence,
    accountLeadCount: person.accountLeads.length,
    accountVerification: person.accountVerification,
    identityReview: person.identityReview,
    ageReview: person.ageReview,
  }));
  return jsonResponse(request, {
    research: {
      status: research.status,
      generatedAt: research.generatedAt,
      method: research.method,
      sectors: research.sectors,
      people,
    },
    ranking,
    top300: {
      status: top300.status,
      generatedAt: top300.generatedAt,
      method: top300.method,
      people: top300.people.map((person) => ({
        slug: person.slug,
        name: person.name,
        sector: person.sector,
        identity: person.identity,
        identityNote: person.identityNote,
        evidence: person.evidence,
        rank: person.rank,
        sectorRank: person.sectorRank,
        score: person.score,
        measured: person.measured,
        components: person.components,
        adultReview: person.adultReview,
        verifiedAccounts: person.verifiedAccounts,
        unverifiedAccounts: person.unverifiedAccounts,
      })),
    },
    conversation,
    pilot,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

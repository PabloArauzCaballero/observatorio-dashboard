import research from '@/data/people-research-300.json';
import pilot from '@/data/people-pilot-3.json';
import { jsonResponse } from '@/lib/respond';

export const dynamic = 'force-static';

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
    pilot,
  }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}

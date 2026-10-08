import 'server-only';
import conversation from '@/data/people-conversation.json';
import ranking from '@/data/people-impact-ranking-2025.json';
import pilot from '@/data/people-pilot-3.json';
import top300 from '@/data/people-top300.json';
import { buildDetail, buildSummary, type RawPeopleData } from '@/lib/people-payload';
import type { PeopleSummary, PersonDetail } from '@/lib/people-types';

/**
 * Los archivos de la investigación, una sola vez por proceso.
 *
 * Son JSON del repositorio: no cambian entre despliegues, así que armar el resumen en
 * cada petición era trabajo repetido. El cast es el único sitio donde el JSON importado
 * (tipos inferidos de un archivo) se encuentra con los tipos de la pestaña.
 */
const RAW = { ranking, top300, conversation, pilot } as unknown as RawPeopleData;

let summary: PeopleSummary | undefined;

export function peopleSummary(): PeopleSummary {
  summary ??= buildSummary(RAW);
  return summary;
}

export function personDetail(slug: string): PersonDetail | null {
  return buildDetail(RAW, slug);
}

import 'server-only';
import { pool } from './db';
import { held } from './hold';
import { abiWhere, type AbiSelection, type AbiNewsCard, type AbiNewsPage } from './abi-news-query';

async function catalogue(): Promise<Pick<AbiNewsPage, 'issuers' | 'coverage'>> {
  return held('abi-news-catalogue', async () => {
    const [issuers, coverage] = await Promise.all([
      pool().query<{ code: string; name: string; articles: number }>(`
        SELECT filer_code AS code, min(filer) AS name, count(DISTINCT article_key)::integer AS articles
        FROM read_models.abi_company_mention GROUP BY filer_code ORDER BY min(filer)`),
      pool().query<AbiNewsPage['coverage']>(`
        SELECT count(*)::integer AS articles,
          count(*) FILTER (WHERE jsonb_array_length(article -> 'mentions') > 0)::integer AS "companyArticles",
          max(retrieved_at)::text AS "retrievedAt", min(article ->> 'publicationDay') AS "earliestDay",
          max(article ->> 'publicationDay') AS "latestDay" FROM read_models.abi_article_snapshot`),
    ]);
    return { issuers: issuers.rows, coverage: coverage.rows[0]! };
  });
}
export async function readAbiNews(selection: AbiSelection, exporting = false): Promise<AbiNewsPage> {
  const { sql, values } = abiWhere(selection);
  const pageSize = exporting ? 10000 : 24;
  const offset = exporting ? 0 : (selection.page - 1) * pageSize;
  const [count, records, meta] = await Promise.all([
    pool().query<{ total: number }>(`SELECT count(*)::integer AS total FROM read_models.abi_article_snapshot WHERE ${sql}`, values),
    pool().query<{ article: AbiNewsCard; evidence_sha256: string; retrieved_at: Date }>(`
      SELECT article - 'contentHtml' - 'text' - 'responseStorage' AS article, evidence_sha256, retrieved_at
      FROM read_models.abi_article_snapshot WHERE ${sql}
      ORDER BY article ->> 'publicationDay' DESC, article_key DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, offset]),
    catalogue(),
  ]);
  const total = count.rows[0]?.total ?? 0;
  if (exporting && total > pageSize) throw new Error('ABI_EXPORT_TOO_LARGE');
  return { ...meta, total, page: exporting ? 1 : selection.page, pageSize,
    articles: records.rows.map(row => ({ ...row.article, evidenceSha256: row.evidence_sha256,
      retrievedAt: row.retrieved_at.toISOString() })) };
}

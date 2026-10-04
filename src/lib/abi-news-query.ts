export const ABI_TOPICS = ['FINANCIAMIENTO', 'INVERSION', 'RESULTADOS', 'GESTION', 'OPERACIONES', 'REGULACION', 'CONFLICTO', 'ACUERDOS'] as const;
export interface AbiSelection { issuer: string; from: string; to: string; topic: string; search: string; edition: string; role: string; page: number }
export function abiSelection(params: URLSearchParams): AbiSelection {
  const day = (key: string): string => {
    const value = params.get(key) ?? '';
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('Fecha inválida');
    return value;
  };
  const issuer = params.get('emisor') ?? '';
  if (issuer && !/^[A-Z0-9_-]{1,40}$/.test(issuer)) throw new Error('Emisor inválido');
  const topic = params.get('tema') ?? '';
  if (topic && !(ABI_TOPICS as readonly string[]).includes(topic)) throw new Error('Tema inválido');
  const edition = params.get('edicion') ?? '';
  if (edition && !['CURRENT', 'HISTORICAL'].includes(edition)) throw new Error('Archivo inválido');
  const role = params.get('rol') ?? '';
  if (role && !['HEADLINE', 'MENTION'].includes(role)) throw new Error('Mención inválida');
  const rawPage = params.get('pagina') ?? '1';
  if (!/^\d+$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > 100000) throw new Error('Página inválida');
  const search = (params.get('q') ?? '').trim();
  if (search.length > 150) throw new Error('Búsqueda demasiado larga');
  const from = day('desde'), to = day('hasta');
  if (from && to && from > to) throw new Error('Periodo inválido');
  return { issuer, from, to, topic, search, edition, role, page: Number(rawPage) };
}
export function abiWhere(selection: AbiSelection): { sql: string; values: string[] } {
  const filters = ["jsonb_array_length(article -> 'mentions') > 0"];
  const values: string[] = [];
  const bind = (value: string) => { values.push(value); return `$${values.length}`; };
  if (selection.issuer || selection.role) filters.push(`article -> 'mentions' @> ${bind(JSON.stringify([{
    ...(selection.issuer ? { filerCode: selection.issuer } : {}), ...(selection.role ? { role: selection.role } : {}),
  }]))}::jsonb`);
  if (selection.from) filters.push(`article ->> 'publicationDay' >= ${bind(selection.from)}`);
  if (selection.to) filters.push(`article ->> 'publicationDay' <= ${bind(selection.to)}`);
  if (selection.topic) filters.push(`article -> 'topics' ? ${bind(selection.topic)}`);
  if (selection.edition) filters.push(`article ->> 'edition' = ${bind(selection.edition)}`);
  if (selection.search) {
    const term = selection.search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\\%_]/g, '\\$&');
    filters.push(`translate(lower((article ->> 'title') || ' ' || (article ->> 'text')), 'áéíóúüñ', 'aeiouun') LIKE ${bind(`%${term}%`)}`);
  }
  return { sql: filters.join(' AND '), values };
}
export interface AbiNewsCard {
  key: string; title: string; summary: string; url: string; publicationDay: string;
  publishedAt: string | null; modifiedAt: string | null; dateQuality: string;
  edition: string; author: { name: string | null }; categories: Array<{ name: string }>;
  topics: string[]; mentions: Array<{ filerCode: string; filer: string; role: string; evidence: string; alias: string }>;
  quantities: Array<{ text: string; context: string }>; links: Array<{ url: string; text: string; kind: string }>;
  evidenceSha256: string; retrievedAt: string;
}
export interface AbiNewsPage {
  articles: AbiNewsCard[]; total: number; page: number; pageSize: number;
  issuers: Array<{ code: string; name: string; articles: number }>;
  coverage: { articles: number; companyArticles: number; retrievedAt: string | null; earliestDay: string | null; latestDay: string | null };
}

/** Prevent spreadsheet formulas when a publisher's text begins with =, +, - or @. */
export function abiCsv(rows: AbiNewsCard[]): string {
  const cell = (value: unknown): string => {
    const text = String(value ?? '');
    return `"${(/^[\s]*[=+@-]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
  };
  const fields = ['id', 'fecha', 'titular', 'emisores', 'mencion', 'temas', 'archivo', 'calidad_fecha', 'fuente', 'evidencia_sha256'];
  return '\ufeff' + [fields, ...rows.map(a => [a.key, a.publicationDay, a.title,
    a.mentions.map(m => m.filerCode).join('|'), a.mentions.map(m => `${m.filerCode}:${m.role}`).join('|'),
    a.topics.join('|'), a.edition, a.dateQuality, a.url, a.evidenceSha256])].map(row => row.map(cell).join(',')).join('\r\n');
}

'use client';

import { useEffect, useState } from 'react';
import { ABI_TOPICS, type AbiNewsPage } from '@/lib/abi-news-query';
import styles from './abi-news.module.css';

const topicLabels: Record<string, string> = { FINANCIAMIENTO: 'Financiamiento', INVERSION: 'Inversión', RESULTADOS: 'Resultados', GESTION: 'Gestión', OPERACIONES: 'Operaciones', REGULACION: 'Regulación', CONFLICTO: 'Conflictos', ACUERDOS: 'Acuerdos' };
export function AbiNewsExplorer({ initialIssuer = '' }: { initialIssuer?: string }) {
  const [issuer, setIssuer] = useState(initialIssuer);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [topic, setTopic] = useState('');
  const [edition, setEdition] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AbiNewsPage | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { const timer = setTimeout(() => { setTerm(search); setPage(1); }, 350); return () => clearTimeout(timer); }, [search]);
  const query = new URLSearchParams({ emisor: issuer, q: term, desde: from, hasta: to, tema: topic, edicion: edition, rol: role, pagina: String(page) }).toString();
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError('');
    fetch(`/api/noticias-empresas?${query}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(response.status === 400 ? 'Revisa el periodo seleccionado.' : 'No se pudieron cargar las noticias.'); return response.json() as Promise<AbiNewsPage>; })
      .then(result => { setData(result); setBusy(false); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : 'No se pudo consultar ABI.'); setBusy(false); } });
    return () => controller.abort();
  }, [query, retry]);
  const change = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  return <section className={styles.section} aria-label="Noticias ABI sobre emisores">
    <div className="briefcard"><div>
      <h2>Noticias ABI sobre emisores de la BBV</h2>
      <p>Cobertura de la Agencia Boliviana de Información. Cada noticia se relaciona con el emisor cuyo nombre aparece en el texto; puedes leer el fragmento que explica esa relación. Los datos y declaraciones se atribuyen a ABI.</p>
      {data && <p className={styles.coverage}>{data.coverage.companyArticles.toLocaleString('es-BO')} noticias con menciones de emisores, entre {data.coverage.articles.toLocaleString('es-BO')} publicaciones consultadas · {data.coverage.earliestDay} a {data.coverage.latestDay}</p>}
      <p className={styles.coverage}>El archivo histórico se incorpora por tandas. Las cifras corresponden a las publicaciones ya consultadas.</p>
    </div></div>
    <form className={styles.filters} onSubmit={event => event.preventDefault()}>
      <label>Emisor<select value={issuer} onChange={e => change(setIssuer, e.target.value)}>
        <option value="">Todos los emisores con noticias</option>
        {initialIssuer && !data?.issuers.some(i => i.code === initialIssuer) && <option value={initialIssuer}>{initialIssuer}</option>}
        {data?.issuers.map(i => <option key={i.code} value={i.code}>{i.name} ({i.articles})</option>)}
      </select></label>
      <label>Buscar en título y contenido<input type="search" value={search} maxLength={150} placeholder="inversión, planta, bonos…" onChange={e => setSearch(e.target.value)} /></label>
      <label>Desde<input type="date" value={from} onChange={e => change(setFrom, e.target.value)} /></label>
      <label>Hasta<input type="date" value={to} onChange={e => change(setTo, e.target.value)} /></label>
      <label>Tema<select value={topic} onChange={e => change(setTopic, e.target.value)}><option value="">Todos los temas</option>{ABI_TOPICS.map(t => <option key={t} value={t}>{topicLabels[t]}</option>)}</select></label>
      <label>Presencia del emisor<select value={role} onChange={e => change(setRole, e.target.value)}><option value="">Cualquier mención</option><option value="HEADLINE">En el titular</option><option value="MENTION">En el contenido</option></select></label>
      <label>Archivo<select value={edition} onChange={e => change(setEdition, e.target.value)}><option value="">Todos</option><option value="CURRENT">Sitio actual</option><option value="HISTORICAL">Archivo histórico</option></select></label>
      <button type="button" onClick={() => { setIssuer(''); setSearch(''); setTerm(''); setFrom(''); setTo(''); setTopic(''); setEdition(''); setRole(''); setPage(1); }}>Limpiar filtros</button>
    </form>
    <div className={styles.results} aria-live="polite">
      <span>{busy ? 'Consultando noticias…' : error || `${data?.total.toLocaleString('es-BO') ?? 0} noticias encontradas`}</span>
      {!busy && !error && <span className={styles.exports}>Exportar selección: <a href={`/api/noticias-empresas?${query}&formato=csv`}>CSV</a> <a href={`/api/noticias-empresas?${query}&formato=json`}>JSON</a></span>}
    </div>
    {error && <button type="button" onClick={() => setRetry(n => n + 1)}>Volver a intentar</button>}
    {!busy && !error && data && <>
      {!data.articles.length && <div className="callout">No hay noticias que coincidan con estos filtros. La ausencia de cobertura no significa que la empresa no haya tenido actividad.</div>}
      <div className={styles.cards}>{data.articles.map(article => <article key={article.key} className={styles.card}>
        <p className={styles.meta}>ABI · <time dateTime={article.publicationDay}>{article.publicationDay}</time>{article.edition === 'HISTORICAL' ? ' · Archivo histórico' : ''}</p>
        <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3>
        {article.dateQuality === 'CONFLICT' && <p className={styles.note}>ABI presenta horas discrepantes; se muestra el día declarado.</p>}
        <p>{article.summary.slice(0, 500)}{article.summary.length > 500 ? '…' : ''}</p>
        <div className={styles.chips}>{article.mentions.map(m => <button key={m.filerCode} type="button" title={m.filer} onClick={() => change(setIssuer, m.filerCode)}>{m.filerCode} · {m.role === 'HEADLINE' ? 'en el titular' : 'mencionado'}</button>)}</div>
        <p className={styles.meta}>{article.topics.map(t => topicLabels[t] ?? t).join(' · ')}</p>
        <details><summary>Ver relación con los emisores y procedencia</summary>
          {article.mentions.filter(m => !issuer || m.filerCode === issuer).map(m => <div key={m.filerCode} className={styles.evidence}><strong>{m.filer}</strong><p>«{m.evidence}»</p></div>)}
          <p className={styles.meta}>Firma: {article.author.name ?? 'No indicada'} · {article.categories.map(c => c.name).join(', ')}</p>
          {article.modifiedAt && <p className={styles.meta}>Última edición declarada: {article.modifiedAt.slice(0, 10)}</p>}
          <p className={styles.meta}>Consultado: {article.retrievedAt.slice(0, 10)}</p>
          <p className={styles.hash}>Huella de evidencia: {article.evidenceSha256}</p>
          {article.links.filter(l => l.kind === 'DOCUMENT').map(l => <p key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.text || 'Documento enlazado por ABI'}</a></p>)}
        </details>
        <a className={styles.original} href={article.url} target="_blank" rel="noopener noreferrer">Leer noticia en ABI ↗</a>
      </article>)}</div>
      {data.total > data.pageSize && <nav className="pager" aria-label="Páginas de noticias ABI">
        <button type="button" disabled={page <= 1} onClick={() => setPage(n => n - 1)}>Anterior</button>
        <span>Página {page} de {Math.ceil(data.total / data.pageSize)}</span>
        <button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(n => n + 1)}>Siguiente</button>
      </nav>}
    </>}
  </section>;
}

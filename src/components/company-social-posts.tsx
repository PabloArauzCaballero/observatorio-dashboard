'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { sayDate } from './charts';
import { PLATFORM_LABEL, type SocialCompany } from '@/lib/company-social-board';
import type { MonthPoint, PostPage, PostSort } from '@/lib/company-social-posts-view';

/**
 * «Posts a fondo»: todos los posts leídos de las empresas y redes que el panel ya tiene elegidas,
 * uno por uno, con su propia fecha, formato, orden y búsqueda por texto.
 *
 * El resto del tablero sólo viaja con los seis mejores de cada cuenta; esto los pide al servidor
 * con los mismos filtros (las empresas y redes elegidas arriba) y los suma por mes. Cada cifra es
 * la que la red declaró en el post; lo que no declaró no se cuenta como cero. Los comentarios no se
 * guardan —la ADR 0027 deja fuera a quien comenta—, así que de cada post se ve el conteo y el tono
 * de los comentarios leídos, no el comentario.
 */

type Metric = 'posts' | 'interactions' | 'views';

const METRICS: ReadonlyArray<{ value: Metric; label: string }> = [
  { value: 'posts', label: 'Posts publicados' },
  { value: 'interactions', label: 'Interacciones' },
  { value: 'views', label: 'Vistas' },
];
const SORTS: ReadonlyArray<{ value: PostSort; label: string }> = [
  { value: 'interactions', label: 'Más interacciones' },
  { value: 'views', label: 'Más vistas' },
  { value: 'comments', label: 'Más comentarios' },
  { value: 'date', label: 'Más recientes' },
];
const FORMAT_LABEL: Record<string, string> = {
  VIDEO: 'Video',
  REEL: 'Reel',
  PHOTO: 'Foto',
  TEXT: 'Texto',
  POST: 'Publicación',
};
const PAGE = 25;

const count = (value: number): string => value.toLocaleString('es-BO');
const signed = (value: number): string =>
  `${value > 0 ? '+' : ''}${value.toLocaleString('es-BO', { maximumFractionDigits: 1 })}`;
const compact = (value: number): string =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toLocaleString('es-BO', { maximumFractionDigits: 1 })} M`
    : value >= 1_000
      ? `${(value / 1_000).toLocaleString('es-BO', { maximumFractionDigits: 1 })} mil`
      : String(value);
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const sayMonth = (month: string): string => {
  const [year = '', number = ''] = month.split('-');
  return `${MONTHS[Number(number) - 1] ?? number} ${year}`;
};

interface Props {
  /** Las empresas que el panel de arriba deja ver; vacío = todas. */
  slugs: readonly string[];
  /** Las redes elegidas; vacío = todas. */
  platforms: readonly string[];
  companies: readonly SocialCompany[];
}

export function CompanySocialPosts({ slugs, platforms, companies }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sort, setSort] = useState<PostSort>('interactions');
  const [metric, setMetric] = useState<Metric>('posts');
  const [page, setPage] = useState<PostPage | null>(null);
  const [rows, setRows] = useState<PostPage['rows']>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const names = useMemo(() => new Map(companies.map((company) => [company.slug, company.name])), [companies]);

  const slugKey = slugs.join(',');
  const platformKey = platforms.join(',');

  const request = async (offset: number, signal: AbortSignal): Promise<PostPage> => {
    const response = await fetch('/api/redes-empresas/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slugs: slugKey ? slugKey.split(',') : [],
        platforms: platformKey ? platformKey.split(',') : [],
        from: from || null,
        to: to || null,
        format,
        text,
        sort,
        offset,
        limit: PAGE,
      }),
      signal,
    });
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()) as PostPage;
  };

  useEffect(() => {
    const controller = new AbortController();
    // Con una búsqueda por texto se espera a que se termine de escribir.
    const timer = setTimeout(
      () => {
        setLoading(true);
        setFailed(false);
        request(0, controller.signal)
          .then((next) => {
            setPage(next);
            setRows(next.rows);
          })
          .catch((error: unknown) => {
            if ((error as { name?: string }).name !== 'AbortError') setFailed(true);
          })
          .finally(() => setLoading(false));
      },
      text ? 350 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `request` lee los mismos filtros que esta lista de dependencias.
  }, [slugKey, platformKey, from, to, format, text, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const more = (): void => {
    const controller = new AbortController();
    setLoading(true);
    request(rows.length, controller.signal)
      .then((next) => setRows((current) => [...current, ...next.rows]))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };

  const series: MonthPoint[] = page?.series ?? [];
  const label = METRICS.find((one) => one.value === metric)?.label ?? '';
  const filtered = Boolean(from || to || format || text);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Posts a fondo: cada post leído, con su fecha y sus cifras</h2>
        <p className="panel-sub">
          Los de las empresas y redes elegidas arriba, sin el recorte de seis por cuenta. Filtra por fecha de
          publicación, formato o texto; la serie por mes y la lista se recuentan con el mismo filtro.
        </p>
      </div>

      <div className="rail-pills" role="group" aria-label="Qué medir por mes">
        {METRICS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={metric === option.value ? 'chip chip-on' : 'chip'}
            aria-pressed={metric === option.value}
            onClick={() => setMetric(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {series.length ? (
        <>
          <div className="chart-frame" style={{ height: 220 }} role="img" aria-label={`${label} por mes de publicación`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={sayMonth}
                  tick={{ fill: 'var(--axis-ink)', fontSize: 11 }}
                  stroke="var(--axis-rule)"
                  minTickGap={18}
                />
                <YAxis
                  tickFormatter={compact}
                  tick={{ fill: 'var(--axis-ink)', fontSize: 11 }}
                  stroke="var(--axis-rule)"
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: 'var(--panel-tint)' }}
                  contentStyle={{
                    background: 'var(--chart-surface)',
                    border: '1px solid var(--rule)',
                    borderRadius: 8,
                    color: 'var(--ink)',
                    fontSize: 12,
                  }}
                  labelFormatter={(value) => sayMonth(String(value))}
                  formatter={(value) => [count(Number(value)), label]}
                />
                <Bar dataKey={metric} fill="var(--official)" maxBarSize={28} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="chart-legend">
            <li>
              <span className="chart-legend-mark" style={{ background: 'var(--official)' }} />
              {label} por mes de publicación
            </li>
          </ul>
        </>
      ) : loading ? null : (
        <div className="callout">Sin posts con fecha para este filtro: la serie por mes necesita la fecha de publicación.</div>
      )}

      <div className="rail-sec">
        <div className="rail-pills" role="group" aria-label="Formato del post">
          <button
            type="button"
            className={format === null ? 'chip chip-on' : 'chip'}
            aria-pressed={format === null}
            onClick={() => setFormat(null)}
          >
            Todos los formatos
          </button>
          {(page?.formats ?? []).map((one) => (
            <button
              key={one.format}
              type="button"
              className={format === one.format ? 'chip chip-on' : 'chip'}
              aria-pressed={format === one.format}
              onClick={() => setFormat(format === one.format ? null : one.format)}
            >
              {FORMAT_LABEL[one.format] ?? one.format} · {count(one.posts)}
            </button>
          ))}
        </div>
      </div>

      <div className="rail-pills" role="group" aria-label="Orden de la lista">
        {SORTS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={sort === option.value ? 'chip chip-on' : 'chip'}
            aria-pressed={sort === option.value}
            onClick={() => setSort(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="rail-field" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', margin: '0.8rem 0' }}>
        <label>
          Desde{' '}
          <input type="date" value={from} min={page?.dates.min ?? undefined} max={to || page?.dates.max || undefined} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          Hasta{' '}
          <input type="date" value={to} min={from || page?.dates.min || undefined} max={page?.dates.max ?? undefined} onChange={(event) => setTo(event.target.value)} />
        </label>
        <input
          type="search"
          placeholder="Buscar en el texto del post…"
          aria-label="Buscar en el texto de los posts"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        {filtered ? (
          <button
            type="button"
            className="chip"
            onClick={() => {
              setFrom('');
              setTo('');
              setFormat(null);
              setText('');
            }}
          >
            Quitar filtros de esta lista
          </button>
        ) : null}
      </div>

      {failed ? <div className="callout">No se pudieron leer los posts. Vuelve a intentarlo en un momento.</div> : null}
      {page ? (
        <p className="panel-sub" aria-live="polite">
          {count(page.total)} post{page.total === 1 ? '' : 's'}
          {page.dates.min && page.dates.max ? ` publicados entre el ${sayDate(page.dates.min)} y el ${sayDate(page.dates.max)}` : ''}.
        </p>
      ) : null}

      {rows.length ? (
        <ol className="social-posts">
          {rows.map((post) => (
            <li key={`${post.platform}-${post.url}`} className="social-post">
              <div className="social-post-head">
                <b>{names.get(post.slug) ?? post.slug}</b>
                <span className="social-post-meta">
                  {PLATFORM_LABEL[post.platform]} · {post.date ? sayDate(post.date) : 'sin fecha'}
                  {post.format ? ` · ${FORMAT_LABEL[post.format] ?? post.format}` : ''}
                </span>
              </div>
              <p className="social-post-text">{post.text || '(sin texto)'}</p>
              <div className="social-post-figures">
                <span>{count(post.interactions ?? 0)} interacciones</span>
                {post.likes !== null ? <span>{count(post.likes)} me gusta</span> : null}
                {post.comments !== null ? <span>{count(post.comments)} comentarios</span> : null}
                {post.shares !== null ? <span>{count(post.shares)} compartidos</span> : null}
                {post.views !== null ? <span>{count(post.views)} vistas</span> : null}
                {post.sentiment ? (
                  <span>
                    neto {signed(post.sentiment.netScore)} ({post.sentiment.analyzed} comentarios leídos)
                  </span>
                ) : null}
                <a href={post.url} target="_blank" rel="noopener noreferrer">
                  Ver el post
                </a>
              </div>
            </li>
          ))}
        </ol>
      ) : page && !loading ? (
        <div className="callout">Ningún post cumple este filtro.</div>
      ) : null}

      {page && rows.length < page.total ? (
        <button type="button" className="chip" disabled={loading} onClick={more}>
          {loading ? 'Cargando…' : `Ver ${Math.min(PAGE, page.total - rows.length)} más (${count(page.total - rows.length)} restantes)`}
        </button>
      ) : null}
    </div>
  );
}

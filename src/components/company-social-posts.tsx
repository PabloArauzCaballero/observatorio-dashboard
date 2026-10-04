'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AXIS,
  BAR_CAP,
  ChartLegend,
  GRID,
  MOTION,
  TooltipShell,
  framed,
  sayDate,
  type TooltipRender,
} from './charts';
import { SOCIAL_SOURCE } from './company-social-source';
import { CommentSentimentSummary } from './company-social-insights';
import { Pager } from './pager';
import { Panel } from '@/components/ui/panel';
import { celda, useDatosDeFigura } from '@/components/ui/panel-data';
import { PLATFORM_LABEL, type SocialCompany } from '@/lib/company-social-board';
import type { CommentTone, MonthPoint, PostPage, PostSort } from '@/lib/company-social-posts-view';

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
  { value: 'analyzed', label: 'Más comentarios analizados' },
  { value: 'date', label: 'Más recientes' },
];
const FORMAT_LABEL: Record<string, string> = {
  VIDEO: 'Video',
  REEL: 'Reel',
  PHOTO: 'Foto',
  TEXT: 'Texto',
  POST: 'Publicación',
  'SIN DATO': 'Sin dato',
};
const PAGE = 8;
/** Una sola serie, un solo color: el de interfaz. */
const TONE = 'var(--official)';

const count = (value: number): string => value.toLocaleString('es-BO');
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
  emptySelection: boolean;
}

export function CompanySocialPosts({ slugs, platforms, companies, emptySelection }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sort, setSort] = useState<PostSort>('interactions');
  const [commentTone, setCommentTone] = useState<CommentTone>('all');
  const [metric, setMetric] = useState<Metric>('posts');
  const [response, setResponse] = useState<{ key: string; data: PostPage } | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const names = useMemo(
    () => new Map(companies.map((company) => [company.slug, company.name])),
    [companies],
  );

  const slugKey = slugs.join(',');
  const platformKey = platforms.join(',');
  const filterKey = JSON.stringify([slugKey, platformKey, emptySelection, from, to, format, text, commentTone, sort]);
  const [cursor, setCursor] = useState({ key: filterKey, offset: 0 });
  useEffect(() => setCursor({ key: filterKey, offset: 0 }), [filterKey]);
  const offset = cursor.key === filterKey ? cursor.offset : 0;
  const requestKey = JSON.stringify([filterKey, offset]);
  const page = response?.key === requestKey ? response.data : null;

  const request = async (offset: number, signal: AbortSignal): Promise<PostPage> => {
    const response = await fetch('/api/redes-empresas/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slugs: slugKey ? slugKey.split(',') : [],
        platforms: platformKey ? platformKey.split(',') : [],
        emptySelection,
        from: from || null,
        to: to || null,
        format,
        text,
        commentTone,
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
    setLoading(true);
    setFailed(false);
    // Con una búsqueda por texto se espera a que se termine de escribir.
    const timer = setTimeout(
      () => {
        request(offset, controller.signal)
          .then((next) => {
            if (!controller.signal.aborted) setResponse({ key: requestKey, data: next });
          })
          .catch((error: unknown) => {
            if (!controller.signal.aborted && (error as { name?: string }).name !== 'AbortError') setFailed(true);
          })
          .finally(() => { if (!controller.signal.aborted) setLoading(false); });
      },
      text ? 350 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `request` lee los mismos filtros que esta lista de dependencias.
  }, [requestKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (next: number): void => setCursor({ key: filterKey, offset: next });
  const totalPages = Math.max(1, Math.ceil((page?.total ?? 0) / PAGE));
  const pageNumber = Math.min(totalPages, Math.floor(offset / PAGE) + 1);

  const series: MonthPoint[] = page?.series ?? [];
  const label = METRICS.find((one) => one.value === metric)?.label ?? '';
  const filtered = Boolean(from || to || format || text || commentTone !== 'all');

  const unitName =
    metric === 'posts'
      ? 'cantidad de posts'
      : metric === 'interactions'
        ? 'cantidad de interacciones'
        : 'cantidad de vistas';

  return (
    <Panel
      id="empresas-redes-posts"
      title={`Posts a fondo: ${label.toLowerCase()} por mes y cada post leído (${unitName})`}
      lede="Los posts de las empresas y redes elegidas arriba, sin el recorte de seis por cuenta, con su fecha y sus cifras."
      source={SOCIAL_SOURCE}
      data={() => ({
        etiqueta: 'Posts',
        unidad: 'interacciones',
        columnas: [
          'Empresa',
          'Red',
          'Fecha',
          'Formato',
          'Texto',
          'Interacciones',
          'Me gusta',
          'Comentarios',
          'Compartidos',
          'Vistas',
          'Sentimiento neto',
          'Comentarios leídos',
          'Enlace',
        ],
        filas: (page?.rows ?? []).map((post) => [
          names.get(post.slug) ?? post.slug,
          PLATFORM_LABEL[post.platform],
          post.date,
          post.format ? (FORMAT_LABEL[post.format] ?? post.format) : null,
          post.text,
          post.interactions,
          post.likes,
          post.comments,
          post.shares,
          post.views,
          post.sentiment ? post.sentiment.netScore : null,
          post.sentiment ? post.sentiment.analyzed : null,
          post.url,
        ]),
        nota: 'Solo los posts de esta página; Anteriores y Siguientes recorren el resto.',
      })}
    >
      <details className="panel-note">
        <summary>Cómo leerlo</summary>
        <p>
          Los de las empresas y redes elegidas arriba, sin el recorte de seis por cuenta. Filtra por
          fecha de publicación, formato o texto; la serie por mes y la lista se recuentan con el
          mismo filtro.
        </p>
      </details>

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
        <MonthBars series={series} metric={metric} label={label} />
      ) : loading ? null : (
        <div className="callout">
          Sin posts con fecha para este filtro: la serie por mes necesita la fecha de publicación.
        </div>
      )}

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

      <div className="rail-pills" role="group" aria-label="Sentimiento de comentarios del post">
        {([
          ['all', 'Todos los posts'],
          ['analyzed', 'Con comentarios analizados'],
          ['positive', 'Saldo positivo'],
          ['negative', 'Saldo negativo'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" className={commentTone === value ? 'chip chip-on' : 'chip'}
            aria-pressed={commentTone === value} onClick={() => setCommentTone(value)}>{label}</button>
        ))}
      </div>

      <div className="rail-field emp-fields">
        <label>
          Desde{' '}
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          Hasta{' '}
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
          />
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
              setCommentTone('all');
            }}
          >
            Quitar filtros de esta lista
          </button>
        ) : null}
      </div>

      {failed ? (
        <div className="callout">
          No se pudieron leer los posts. Vuelve a intentarlo en un momento.
        </div>
      ) : null}
      {page ? (
        <>
          <p className="panel-note" aria-live="polite">
            {count(page.total)} post{page.total === 1 ? '' : 's'}
            {page.dates.min && page.dates.max
              ? ` publicados entre el ${sayDate(page.dates.min)} y el ${sayDate(page.dates.max)}`
              : ''}.
          </p>
          <div className="stat-strip">
            <div className="stat"><span className="stat-label">Mediana de interacciones</span><span className="stat-value">{page.summary.medianInteractions === null ? '—' : count(page.summary.medianInteractions)}</span><span className="stat-hint">{count(page.summary.measured)} posts con interacciones declaradas</span></div>
            <div className="stat"><span className="stat-label">Peso de los 5 principales</span><span className="stat-value">{page.summary.topFiveShare === null ? '—' : `${page.summary.topFiveShare.toLocaleString('es-BO', { maximumFractionDigits: 1 })} %`}</span><span className="stat-hint">de las interacciones declaradas del recorte</span></div>
            <div className="stat"><span className="stat-label">Sentimiento neto</span><span className="stat-value">{page.summary.net === null ? '—' : `${page.summary.net > 0 ? '+' : ''}${page.summary.net.toLocaleString('es-BO', { maximumFractionDigits: 1 })}`}</span><span className="stat-hint">{count(page.summary.analyzed)} comentarios clasificados</span></div>
          </div>
          <Pager page={pageNumber} pages={totalPages} first={page.total ? offset + 1 : 0} last={offset + page.rows.length} total={page.total} pageSize={PAGE} onGo={go} where="arriba" noun="posts" />
        </>
      ) : null}

      {page?.rows.length ? (
        <ol className="social-posts">
          {page.rows.map((post) => (
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
                <span>{post.interactions === null ? 'Interacciones sin dato' : `${count(post.interactions)} interacciones`}</span>
                {post.likes !== null ? <span>{count(post.likes)} me gusta</span> : null}
                {post.comments !== null ? <span>{count(post.comments)} comentarios</span> : null}
                {post.shares !== null ? <span>{count(post.shares)} compartidos</span> : null}
                {post.views !== null ? <span>{count(post.views)} vistas</span> : null}
                {post.sentiment ? <CommentSentimentSummary sentiment={post.sentiment} /> : null}
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

      {page ? <Pager page={pageNumber} pages={totalPages} first={page.total ? offset + 1 : 0} last={offset + page.rows.length} total={page.total} pageSize={PAGE} onGo={go} where="abajo" noun="posts" /> : null}
    </Panel>
  );
}

/**
 * La serie por mes de los posts, con el mismo tooltip, tope de barra y ejes que el resto del
 * tablero (antes era un `BarChart` suelto con estilos propios).
 */
function MonthBars({
  series,
  metric,
  label,
}: {
  series: MonthPoint[];
  metric: Metric;
  label: string;
}) {
  useDatosDeFigura(
    () => ({
      etiqueta: label,
      unidad: label,
      columnas: ['Mes', label],
      filas: series.map((point) => [point.month, celda(point[metric])]),
    }),
    [series, metric, label],
  );
  const renderTooltip = ({ active, payload, label: month }: TooltipRender) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as MonthPoint | undefined;
    if (!point) return null;
    return (
      <TooltipShell
        label={sayMonth(String(month))}
        rows={[{ name: label, value: count(point[metric]), color: TONE }]}
      />
    );
  };

  return (
    <div className="chart-stack">
      <div
        className="chart-frame"
        style={{ height: framed(220) }}
        role="img"
        aria-label={`${label} por mes de publicación`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="month" tickFormatter={sayMonth} minTickGap={18} {...AXIS} />
            <YAxis tickFormatter={compact} width={48} {...AXIS} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--rule-soft)' }} />
            <Bar
              dataKey={metric}
              fill={TONE}
              maxBarSize={BAR_CAP}
              radius={[4, 4, 0, 0]}
              animationDuration={MOTION.duration}
              animationEasing={MOTION.easing}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={[{ color: TONE, label: `${label} por mes de publicación` }]} />
    </div>
  );
}

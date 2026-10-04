'use client';

import { useMemo, useState } from 'react';
import { ChartLegend, DivergingBars, ShareBars, sayDate } from './charts';
import { CompanySocialMix } from './company-social-mix';
import { AudienceWordCloud, CommentSentimentSummary } from './company-social-insights';
import { CompanySocialPosts } from './company-social-posts';
import { SOCIAL_SOURCE } from './company-social-source';
import { CompanySocialTable } from './company-social-table';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import { OnOpenNotice, useOnOpen } from './on-open';
import { Panel } from '@/components/ui/panel';
import { ANY, additive, picked, toggle } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import {
  PLATFORM_LABEL,
  SOCIAL_PLATFORMS,
  commentBreakdown,
  type CompanySocialBoard,
} from '@/lib/company-social-board';
import {
  MIN_COMMENTS,
  companyEngagement,
  companySentiment,
  coverage,
  filterCompanies,
  followersOf,
  sectorChoices,
  sumTerms,
  topPosts,
  type SocialFilters,
  type TermKind,
} from '@/lib/company-social-view';

/**
 * Las redes sociales de las empresas del ránking Merco (ADR 0027 del núcleo).
 *
 * Todo se cruza: la red, el sector, la búsqueda, el tono y el top 50 recortan
 * la tabla, y la tabla recorta los gráficos, las palabras y los posts —tocar
 * una empresa la aísla; con Ctrl/⌘ se suman varias—. Las cifras son las que
 * cada red declaró el día de la lectura. Lo que una red no dejó leer se cuenta
 * como cobertura y no entra a ninguna suma como cero.
 */

const TONES: ReadonlyArray<{ value: SocialFilters['tone']; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'heard', label: `Con ${MIN_COMMENTS}+ comentarios` },
  { value: 'positive', label: 'Neto positivo' },
  { value: 'negative', label: 'Neto negativo' },
];

const KINDS: ReadonlyArray<{ value: TermKind; label: string }> = [
  { value: 'WORD', label: 'Palabras' },
  { value: 'BIGRAM', label: 'Frases de dos palabras' },
  { value: 'HASHTAG', label: 'Hashtags' },
  { value: 'EMOJI', label: 'Emojis' },
];

const count = (value: number): string => value.toLocaleString('es-BO');
const signed = (value: number): string =>
  `${value > 0 ? '+' : ''}${value.toLocaleString('es-BO', { maximumFractionDigits: 1 })}`;

/** La clave de color bajo cada gráfico de barras: siempre, también con una sola serie. */
const barsKey = (label: string) => <ChartLegend items={[{ color: 'var(--official)', label }]} />;

const millions = (value: number): string =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toLocaleString('es-BO', { maximumFractionDigits: 1 })} M`
    : count(value);

export function CompanySocialExplorer({ board }: { board: CompanySocialBoard }) {
  const [platforms, setPlatforms] = useState<Choice>(ANY);
  const [sectors, setSectors] = useState<Choice>(ANY);
  const [query, setQuery] = useState('');
  const [topOnly, setTopOnly] = useState(false);
  const [tone, setTone] = useState<SocialFilters['tone']>('all');
  const [focus, setFocus] = useState<Choice>(ANY);
  const [scope, setScope] = useState<'COMPANY' | 'AUDIENCE'>('AUDIENCE');
  const [kind, setKind] = useState<TermKind>('WORD');

  const filters: SocialFilters = { platforms, sectors, query, topOnly, tone };
  const companies = useMemo(
    () => filterCompanies(board, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, platforms, sectors, query, topOnly, tone],
  );
  const sectorList = useMemo(
    () => sectorChoices(board, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, platforms, query, topOnly, tone],
  );
  const chosen = focus.size ? companies.filter((company) => focus.has(company.slug)) : companies;
  const slugs = useMemo(() => new Set(chosen.map((company) => company.slug)), [chosen]);
  const covered = coverage(chosen);

  const followers = chosen.reduce(
    (sum, company) => sum + (followersOf(company, platforms) ?? 0),
    0,
  );
  const postsRead = chosen
    .flatMap((company) => company.accounts)
    .reduce((sum, account) => sum + account.postsRead, 0);
  const sentiments = chosen
    .map((company) => companySentiment(company, platforms))
    .filter((one) => one !== null);
  const analyzed = sentiments.reduce((sum, one) => sum + one.analyzed, 0);
  const breakdown = commentBreakdown(chosen, platforms);
  const net = analyzed
    ? sentiments.reduce((sum, one) => sum + one.net * one.analyzed, 0) / analyzed
    : null;

  const byPlatform = covered
    .filter((row) => (platforms.size === 0 || platforms.has(row.platform)) && row.followers > 0)
    .map((row) => ({
      name: row.label,
      value: row.followers,
      pick: row.platform,
      emphasis: platforms.has(row.platform),
    }));
  const engagement = chosen
    .map((company) => ({
      name: company.name,
      value: companyEngagement(company, platforms),
      pick: company.slug,
    }))
    .filter((row): row is { name: string; value: number; pick: string } => row.value !== null)
    .sort((left, right) => right.value - left.value)
    .slice(0, 15)
    .map((row) => ({ ...row, value: Number(row.value.toFixed(3)), emphasis: focus.has(row.pick) }));
  const tones = chosen
    .map((company) => ({ company, sentiment: companySentiment(company, platforms) }))
    .filter((row) => row.sentiment && row.sentiment.analyzed >= MIN_COMMENTS)
    .map(({ company, sentiment }) => ({
      name: company.name,
      value: Number((sentiment?.net ?? 0).toFixed(1)),
      meta: `${count(sentiment?.analyzed ?? 0)} comentarios${sentiment?.irony != null ? ` · ${sentiment.irony.toFixed(0)} % irónicos` : ''}`,
    }));
  const terms = sumTerms(board.terms, slugs, scope, kind, 20);
  const cloudTerms = sumTerms(board.terms, slugs, 'AUDIENCE', 'WORD', 45);
  const posts = topPosts(board.posts, slugs, platforms);
  const kindLabel = KINDS.find((one) => one.value === kind) ?? KINDS[0];

  const reset = (): void => {
    setPlatforms(ANY);
    setSectors(ANY);
    setQuery('');
    setTopOnly(false);
    setTone('all');
    setFocus(ANY);
  };
  const active =
    (platforms.size ? 1 : 0) +
    (sectors.size ? 1 : 0) +
    (query.trim() ? 1 : 0) +
    (topOnly ? 1 : 0) +
    (tone !== 'all' ? 1 : 0) +
    (focus.size ? 1 : 0);

  if (!board.companies.length) {
    return (
      <div className="callout">
        Todavía no hay lectura de redes sociales cargada. La página se llena sola cuando el núcleo
        siembre la primera corrida (migración 0094).
      </div>
    );
  }

  return (
    <>
      <Panel
        id="empresas-redes-resumen"
        className="emp-hero"
        title={`Redes sociales de las empresas Merco: seguidores, interacción y sentimiento (lectura del ${board.readingDate ? sayDate(board.readingDate) : '—'})`}
        lede="Perfiles sociales encontrados en webs corporativas y buscadores, leídos sin iniciar sesión. Algunos hallazgos siguen pendientes de verificar."
        source={SOCIAL_SOURCE}
        data={() => ({
          unidad: 'seguidores',
          columnas: ['Cifra', 'Valor', 'Detalle'],
          filas: [
            ['Empresas', chosen.length, `de ${board.companies.length} con alguna cuenta hallada`],
            [
              'Seguidores declarados',
              followers,
              'suma de cuentas leídas, con duplicados entre redes',
            ],
            ['Posts leídos', postsRead, 'en la ventana de 90 días y la grilla visible'],
            [
              'Sentimiento neto',
              net === null ? null : Number(net.toFixed(1)),
              `${analyzed} comentarios clasificados (% pos − % neg)`,
            ],
            ...covered.map((row) => [
              `Cobertura: ${row.label}`,
              row.read,
              [
                `${row.read} leídas`,
                row.restricted ? `${row.restricted} con restricción de edad` : '',
                row.blocked ? `${row.blocked} bloqueadas` : '',
                row.missing ? `${row.missing} no encontradas` : '',
              ]
                .filter(Boolean)
                .join(' · '),
            ]),
          ],
        })}
      >
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">Empresas</span>
            <span className="stat-value">{count(chosen.length)}</span>
            <span className="stat-hint">
              de {count(board.companies.length)} con alguna cuenta hallada
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Seguidores declarados</span>
            <span className="stat-value">{millions(followers)}</span>
            <span className="stat-hint">suma de cuentas leídas, con duplicados entre redes</span>
          </div>
          <div className="stat">
            <span className="stat-label">Posts leídos</span>
            <span className="stat-value">{count(postsRead)}</span>
            <span className="stat-hint">en la ventana de 90 días y la grilla visible</span>
          </div>
          <div className="stat">
            <span className="stat-label">Sentimiento neto</span>
            <span className="stat-value">{net === null ? '—' : signed(net)}</span>
            <span className="stat-hint">
              {count(analyzed)} comentarios clasificados (% pos − % neg)
            </span>
          </div>
        </div>
        <ul className="social-coverage" aria-label="Cobertura de la lectura por red">
          {covered.map((row) => (
            <li key={row.platform}>
              <b>{row.label}</b> {row.read} leídas
              {row.restricted ? ` · ${row.restricted} con restricción de edad` : ''}
              {row.blocked ? ` · ${row.blocked} bloqueadas` : ''}
              {row.missing ? ` · ${row.missing} no encontradas` : ''}
            </li>
          ))}
        </ul>
        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>
            Las cifras son las que <strong>cada red declara</strong> ese día: no son personas únicas
            ni se suman entre redes sin duplicar a quien sigue en dos. El sentimiento sale de los
            comentarios que la red muestra sin sesión, clasificados con un modelo entrenado en
            español de redes; la ironía se cuenta aparte y no se suma a lo positivo.
          </p>
        </details>
      </Panel>

      <div className="workspace">
        <aside className="rail" id="redes-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">
              {active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}
            </span>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="personas" size={13} /> Red <PickedCount choice={platforms} />
            </div>
            <FilterHint />
            <div className="rail-pills">
              {SOCIAL_PLATFORMS.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  className={picked(platforms, platform) ? 'chip chip-on' : 'chip'}
                  aria-pressed={picked(platforms, platform)}
                  onClick={(event) =>
                    setPlatforms((current) => toggle(current, platform, additive(event)))
                  }
                >
                  {PLATFORM_LABEL[platform]}
                </button>
              ))}
            </div>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="buscar" size={13} /> Empresa
            </div>
            <div className="rail-field">
              <input
                type="search"
                placeholder="Buscar por nombre…"
                aria-label="Buscar una empresa por su nombre"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="corazon" size={13} /> Tono de los comentarios
            </div>
            <div className="rail-pills">
              {TONES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={tone === option.value ? 'chip chip-on' : 'chip'}
                  aria-pressed={tone === option.value}
                  onClick={() => setTone(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rail-sec">
            <label className="rep-toggle">
              <input
                type="checkbox"
                checked={topOnly}
                onChange={(event) => setTopOnly(event.target.checked)}
              />
              <span>
                <Icon name="escudo" size={13} /> Sólo el top 50 de Merco
              </span>
            </label>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="capas" size={13} /> Sector Merco <PickedCount choice={sectors} />
            </div>
            <div className="rail-list rail-list-cut">
              {sectorList.map((option) => {
                const on = picked(sectors, option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={on ? 'rail-item rail-item-on' : 'rail-item'}
                    aria-pressed={on}
                    onClick={(event) =>
                      setSectors((current) => toggle(current, option.value, additive(event)))
                    }
                  >
                    <span className="rail-name">{option.value}</span>
                    <span className="rail-n">{option.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {active ? (
            <div className="rail-sec">
              <button type="button" className="chip" onClick={reset}>
                Limpiar todo
              </button>
            </div>
          ) : null}
        </aside>

        <div className="workspace-main">
          <CompanySocialTable
            companies={companies}
            platforms={platforms}
            focus={focus}
            onFocus={(slug, add) => setFocus((current) => toggle(current, slug, add))}
          />

          <div className="grid-pair">
            <Panel
              id="empresas-redes-seguidores"
              title="Seguidores declarados por red (suma de las empresas elegidas, cuentas)"
              lede="Toca una red para filtrar por ella. Una persona que sigue a la empresa en dos redes cuenta dos veces."
              source={SOCIAL_SOURCE}
            >
              {byPlatform.length ? (
                <>
                  <ShareBars
                    data={byPlatform}
                    unit=" seguidores"
                    decimals={0}
                    height={220}
                    onPick={(platform, add) =>
                      setPlatforms((current) => toggle(current, platform, add))
                    }
                  />
                  {barsKey('Seguidores declarados por la red, sumados entre las empresas elegidas')}
                </>
              ) : (
                <div className="callout">Ninguna cuenta leída con los filtros puestos.</div>
              )}
            </Panel>

            <Panel
              id="empresas-redes-interaccion"
              title="Interacción por post (% de los seguidores, mediana de las cuentas de cada empresa)"
              lede="Cuánto responde la audiencia, no su tamaño: las 15 más altas; toca una para aislarla."
              source={SOCIAL_SOURCE}
            >
              <details className="panel-note">
                <summary>Cómo leerlo</summary>
                <p>
                  Likes, comentarios y compartidos de cada post de los últimos 90 días dividido por
                  los seguidores de la cuenta. Mide cuánto responde la audiencia, no su tamaño. Las
                  15 más altas; toca una para aislarla.
                </p>
              </details>
              {engagement.length ? (
                <>
                  <ShareBars
                    data={engagement}
                    unit="%"
                    decimals={3}
                    height={Math.max(220, engagement.length * 26)}
                    onPick={(slug, add) => setFocus((current) => toggle(current, slug, add))}
                  />
                  {barsKey('Mediana de (likes + comentarios + compartidos) ÷ seguidores, en %')}
                </>
              ) : (
                <div className="callout">
                  Sin posts con cifras de interacción para las empresas elegidas.
                </div>
              )}
            </Panel>
          </div>

          <Panel
            id="empresas-redes-reparto-comentarios"
            title="Sentimiento expresado en los comentarios visibles"
            lede="Porcentaje de comentarios clasificados en los perfiles de las empresas y redes elegidas. La ironía se mide aparte."
            source={SOCIAL_SOURCE}
          >
            {breakdown ? (
              <div className="social-sentiment-breakdown">
                <div><strong>{count(breakdown.analyzed)}</strong><span>comentarios analizados</span></div>
                <div><strong>{breakdown.positivePct.toFixed(1)} %</strong><span>positivos</span></div>
                <div><strong>{breakdown.neutralPct.toFixed(1)} %</strong><span>neutros</span></div>
                <div><strong>{breakdown.negativePct.toFixed(1)} %</strong><span>negativos</span></div>
                {breakdown.ironyPct !== null ? (
                  <div><strong>{breakdown.ironyPct.toFixed(1)} %</strong><span>irónicos</span></div>
                ) : null}
              </div>
            ) : <div className="callout">Sin comentarios visibles para este filtro.</div>}
            <p className="panel-note">Son señales del texto que captó el modelo; no describen el estado emocional de cada persona.</p>
          </Panel>

          <Panel
            id="empresas-redes-sentimiento"
            title="Sentimiento neto de los comentarios (puntos: % positivos − % negativos)"
            lede={`Solo empresas con ${MIN_COMMENTS} o más comentarios clasificados.`}
            source={SOCIAL_SOURCE}
          >
            <details className="panel-note">
              <summary>Cómo leerlo</summary>
              <p>
                Sin sesión, Instagram, TikTok y LinkedIn no muestran comentarios: la base es sobre
                todo YouTube y el comentario destacado de Facebook.
              </p>
            </details>
            {tones.length ? (
              <DivergingBars data={tones} unit="puntos" height={Math.max(220, tones.length * 26)} />
            ) : (
              <div className="callout">
                Ninguna empresa elegida tiene {MIN_COMMENTS} comentarios clasificados.
              </div>
            )}
          </Panel>

          <CompanySocialMix board={board} companies={chosen} slugs={slugs} platforms={platforms} />

          <Panel
            id="empresas-redes-terminos"
            title={`Lo más repetido en ${scope === 'COMPANY' ? 'lo que publican' : 'lo que les comentan'}: ${kindLabel?.label.toLowerCase()} (menciones)`}
            lede="Sin artículos, preposiciones, muletillas de redes ni el nombre de la propia empresa."
            source={SOCIAL_SOURCE}
          >
            <details className="panel-note">
              <summary>Cómo leerlo</summary>
              <p>Un mismo texto publicado en dos redes cuenta una vez.</p>
            </details>
            <div className="social-term-switch">
              {(['COMPANY', 'AUDIENCE'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={scope === value ? 'chip chip-on' : 'chip'}
                  aria-pressed={scope === value}
                  onClick={() => setScope(value)}
                >
                  {value === 'COMPANY' ? 'Lo que publican' : 'Lo que les comentan'}
                </button>
              ))}
              {KINDS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={kind === option.value ? 'chip chip-on' : 'chip'}
                  aria-pressed={kind === option.value}
                  onClick={() => setKind(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {scope === 'AUDIENCE' && kind === 'WORD' && cloudTerms.length ? (
              <AudienceWordCloud terms={cloudTerms} />
            ) : null}
            {terms.length ? (
              <>
                <ShareBars
                  data={terms.map((row) => ({
                    name: kind === 'HASHTAG' ? `#${row.term}` : row.term,
                    value: row.count,
                    note: `en ${row.companies} empresa${row.companies === 1 ? '' : 's'}`,
                  }))}
                  unit="menciones"
                  decimals={0}
                  height={Math.max(220, terms.length * 24)}
                />
                {barsKey(
                  `Veces que aparece en ${scope === 'COMPANY' ? 'los posts de las empresas' : 'los comentarios'}`,
                )}
              </>
            ) : (
              <div className="callout">Sin términos repetidos para esta combinación.</div>
            )}
          </Panel>

          <Panel
            id="empresas-redes-mejores-posts"
            title="Posts con más interacciones (cantidad de interacciones por post)"
            lede="Los de las empresas y redes elegidas."
            source={SOCIAL_SOURCE}
            data={() => ({
              etiqueta: 'Posts',
              unidad: 'interacciones',
              columnas: [
                'Empresa',
                'Red',
                'Fecha',
                'Texto',
                'Interacciones',
                'Me gusta',
                'Comentarios',
                'Compartidos',
                'Vistas',
                'Sentimiento neto',
                'Comentarios leídos',
                'Cómo se halló',
                'Enlace',
              ],
              filas: posts.map((post) => [
                board.companies.find((one) => one.slug === post.slug)?.name ?? post.slug,
                PLATFORM_LABEL[post.platform],
                post.date,
                post.text,
                post.interactions,
                post.likes,
                post.comments,
                post.shares,
                post.views,
                post.sentiment ? post.sentiment.netScore : null,
                post.sentiment ? post.sentiment.analyzed : null,
                post.discovery === 'SEARCH' ? 'buscador' : 'perfil',
                post.url,
              ]),
            })}
          >
            <details className="panel-note">
              <summary>Cómo leerlo</summary>
              <p>
                Likes, comentarios y compartidos suman las interacciones. Los videos de TikTok
                llegan por buscador, no por la grilla del perfil, y se marcan así.
              </p>
            </details>
            {posts.length ? (
              <ol className="social-posts">
                {posts.map((post) => {
                  const company = board.companies.find((one) => one.slug === post.slug);
                  return (
                    <li key={`${post.platform}-${post.url}`} className="social-post">
                      <div className="social-post-head">
                        <b>{company?.name ?? post.slug}</b>
                        <span className="social-post-meta">
                          {PLATFORM_LABEL[post.platform]} ·{' '}
                          {post.date ? sayDate(post.date) : 'sin fecha'}
                          {post.discovery === 'SEARCH' ? ' · hallado por buscador' : ''}
                        </span>
                      </div>
                      <p className="social-post-text">{post.text || '(sin texto)'}</p>
                      <div className="social-post-figures">
                        <span>{count(post.interactions ?? 0)} interacciones</span>
                        {post.likes !== null ? <span>{count(post.likes)} me gusta</span> : null}
                        {post.comments !== null ? (
                          <span>{count(post.comments)} comentarios</span>
                        ) : null}
                        {post.shares !== null ? (
                          <span>{count(post.shares)} compartidos</span>
                        ) : null}
                        {post.views !== null ? <span>{count(post.views)} vistas</span> : null}
                        {post.sentiment ? <CommentSentimentSummary sentiment={post.sentiment} /> : null}
                        <a href={post.url} target="_blank" rel="noopener noreferrer">
                          Ver el post
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="callout">Sin posts leídos para las empresas y redes elegidas.</div>
            )}
          </Panel>

          <CompanySocialPosts
            slugs={
              chosen.length === board.companies.length ? [] : chosen.map((company) => company.slug)
            }
            platforms={[...platforms]}
            companies={board.companies}
          />
        </div>
      </div>
    </>
  );
}

/** La página de redes, pedida al abrirse: no viaja con el resto de «Empresas». */
export function CompanySocialSection() {
  const { payload, failed } = useOnOpen<{ board: CompanySocialBoard }>('/api/redes-empresas');
  if (!payload) return <OnOpenNotice what="las redes sociales de las empresas" failed={failed} />;
  return <CompanySocialExplorer board={payload.board} />;
}

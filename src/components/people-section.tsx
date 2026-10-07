'use client';

import { useMemo, useState } from 'react';
import { OnOpenNotice, useOnOpen } from '@/components/on-open';
import { TabHeader } from '@/components/ui/tab-header';
import styles from './people-section.module.css';

interface Evidence { source: string; url: string; rank?: number }
interface Person { slug: string; name: string; sector: string; evidence: Evidence[]; accountLeadCount: number }
interface Term { kind: string; term: string; count: number; rank: number }
interface Sentiment {
  analyzed: number; positivePct: number; neutralPct: number; negativePct: number;
  ironyPct: number | null; topEmotion: string | null; netScore?: number;
}
interface PilotPost {
  url: string; title: string; publishedAt: string | null; likes: number | null;
  comments: number | null; views: number | null; commentsAnalyzedSpanish: number;
  commentSentiment: Sentiment | null;
}
interface PilotPerson {
  slug: string; name: string; accountUrl: string; accountEvidence: string[];
  followersApprox: number | null; retrievedAt: string; postsInWindow: number;
  commentsCaptured: number; commentsAnalyzedSpanish: number; commentsExcluded: number;
  sentiment: Sentiment; wordCloud: Term[]; posts: PilotPost[];
}
interface RankedPerson { rank: number; slug: string; name: string; impactSharePercent: number; sector: string }
interface ImpactRanking {
  accessNote?: string;
  status: string; title: string; measurementPeriod: string; question: string;
  source: { publisher: string; publication: string; publishedAt: string; url: string; sampleSize: number; fieldworkStart: string; fieldworkEnd: string; geographicCoverage: string[]; referenceMarginOfErrorPercentagePoints: number };
  interpretation: { scope: string; coverageLimit: string; currentness: string };
  people: RankedPerson[];
}
interface MeasuredAccount { platform: string; url: string; followers: number | null; verification: string; evidence?: string[] }
interface Measure {
  name: string; evidence: Evidence[]; sector: string; identity: string; identityNote: string | null;
  slug: string; rank: number; sectorRank: number; score: number; measured: boolean; adultReview: string;
  components: {
    wikipediaViews12m: number | null; wikipediaViewsEs: number | null; wikipediaViewsEn: number | null;
    verifiedFollowers: number | null; mercoRank: number | null; pressArticles: number | null;
  };
  verifiedAccounts: MeasuredAccount[]; unverifiedAccounts: MeasuredAccount[];
}
interface Quality {
  padron: { fichasOriginales: number; fichasEnElRanking: number; porFuente: Record<string, number> };
  identidad: { coincidenciasWikidata: number; revisadasYAceptadas: number; descartadas: number; duplicadasFusionadas: number; fueraDeAlcance: number };
  cuentas: { suman: Record<string, number>; noSuman: Record<string, number> };
  conVisitasWikipedia: number; conAudienciaVerificada: number; conPuestoMerco: number;
}
interface Top300 { status: string; method: { summary: string; limits: string[]; measuredPeople: number; quality: Quality }; people: Measure[] }
interface ConversationVideo { videoId: string; title: string; published: string | null; url: string; commentsRead: number; commentsSpanish: number }
interface Conversation {
  videosRead: number; commentsRead: number; commentsAnalyzed: number; videos: ConversationVideo[];
  sentiment: Sentiment | null; words: Term[] | null;
}
interface ConversationSet {
  status: string; method: { source: string; limits: string[] };
  coverage: { peopleRead: number; peoplePublishable: number; commentsAnalyzed: number };
  people: Record<string, Conversation>;
}
interface PeoplePayload {
  conversation: ConversationSet;
  ranking: ImpactRanking;
  top300: Top300;
  research: { status: string; generatedAt: string; sectors: Record<string, number>; people: Person[] };
  pilot: {
    status: string; windowStart: string; windowEnd: string;
    coverage: { researchPeople: number; peopleWithPilotSentiment: number; commentsCaptured: number; commentsAnalyzedSpanish: number };
    people: PilotPerson[];
  };
}

const SECTORS: Record<string, string> = {
  POLITICS: 'Política', BUSINESS: 'Empresas', MEDIA: 'Medios y creadores',
  SCIENCE: 'Ciencia', CULTURE: 'Cultura', CIVIC: 'Sociedad civil',
  SPORTS: 'Deporte', UNCLASSIFIED: 'Por clasificar',
};
const SOURCES: Record<string, string> = {
  MERCO_LEADERS_2025_26: 'Merco Líderes 2025/26',
  OEP_ELECTION_2025: 'Órgano Electoral 2025',
  IPDRS_CREATOR_STUDY_2024: 'Estudio IPDRS 2024',
  IPSOS_IMPACT_2025: 'Ipsos CIESMORI, impacto 2025',
  WIKIDATA_DISCOVERY: 'Wikidata',
  UCB_MARIE_CURIE: 'UCB, Premio Marie Curie',
  UMSA_SCIENCE_2025: 'UMSA, ciencia 2025',
  UCB_SCIENCE_2025: 'UCB, ciencia 2025',
  HAFI_TIKTOK_BOLIVIA: 'Hafi, TikTok Bolivia (directorio)',
  HYPEAUDITOR_INSTAGRAM_BOLIVIA: 'HypeAuditor, Instagram Bolivia (directorio)',
};
const number = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'sin dato' : value.toLocaleString('es-BO');
const index = (value: number): string => value.toLocaleString('es-BO', { maximumFractionDigits: 1 });
const pct = (value: number): string => `${value.toLocaleString('es-BO', { maximumFractionDigits: 1 })} %`;
const folded = (value: string): string => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function SentimentView({ person }: { person: PilotPerson }) {
  const sentiment = person.sentiment;
  const words = person.wordCloud.filter((row) => row.kind === 'WORD').slice(0, 25);
  const peak = Math.max(...words.map((word) => word.count), 1);
  const posts = [...person.posts].sort((left, right) =>
    (right.comments ?? 0) - (left.comments ?? 0)).slice(0, 6);
  return (
    <div className={styles.pilot}>
      <div className={styles.pilotHead}>
        <h4>Comentarios en YouTube · muestra exploratoria</h4>
        <a href={person.accountUrl} target="_blank" rel="noreferrer">Abrir canal ↗</a>
      </div>
      <p className={styles.muted}>
        {number(person.followersApprox)} suscriptores aprox. al {person.retrievedAt.slice(0, 10)} ·
        {' '}{number(person.postsInWindow)} videos leídos · {number(person.commentsCaptured)} comentarios visibles ·
        {' '}{number(person.commentsAnalyzedSpanish)} clasificados en español.
      </p>
      <div className={styles.sentiment} aria-label={`Sentimiento de ${number(sentiment.analyzed)} comentarios clasificados`}>
        <span><b>{pct(sentiment.positivePct)}</b> positivos</span>
        <span><b>{pct(sentiment.neutralPct)}</b> neutros</span>
        <span><b>{pct(sentiment.negativePct)}</b> negativos</span>
        {sentiment.ironyPct !== null ? <span><b>{pct(sentiment.ironyPct)}</b> posible ironía</span> : null}
      </div>
      <div className={styles.bar} aria-hidden="true">
        <span className={styles.positive} style={{ width: `${sentiment.positivePct}%` }} />
        <span className={styles.neutral} style={{ width: `${sentiment.neutralPct}%` }} />
        <span className={styles.negative} style={{ width: `${sentiment.negativePct}%` }} />
      </div>
      <h4>Palabras más repetidas en comentarios leídos</h4>
      <ul className={styles.cloud} aria-label="Nube de palabras de comentarios en español">
        {words.map((word) => (
          <li key={word.term}>
            <span style={{ fontSize: `${(0.86 + 0.98 * Math.sqrt(word.count / peak)).toFixed(2)}rem` }}
              title={`${number(word.count)} apariciones`}>
              {word.term}
            </span>
          </li>
        ))}
      </ul>
      <h4>Videos con más comentarios visibles en la muestra</h4>
      <ol className={styles.posts}>
        {posts.map((post) => (
          <li key={post.url}>
            <a href={post.url} target="_blank" rel="noreferrer">{post.title || 'Abrir video'} ↗</a>
            <small>{post.publishedAt ?? 'fecha no publicada'} · {number(post.comments)} comentarios mostrados por YouTube · {number(post.commentsAnalyzedSpanish)} clasificados</small>
          </li>
        ))}
      </ol>
      <p className={styles.note}>
        Estos porcentajes describen únicamente los comentarios públicos que se pudieron leer en los videos
        seleccionados. El modelo puede confundir bromas, ironía y contexto; no mide la opinión de toda Bolivia.
      </p>
    </div>
  );
}

const PLATFORMS: Record<string, string> = { tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook' };
const VERIFICATION: Record<string, string> = {
  WIKIDATA_DECLARED: 'cuenta oficial según Wikidata',
  PLATFORM_VERIFIED: 'verificada por la plataforma',
  HANDLE_MATCHES_WIKIDATA: 'mismo usuario que su cuenta oficial en Wikidata',
  SOURCE_LINKED: 'enlazada por una fuente oficial o de prensa',
  HANDLE_UNCONFIRMED_SMALL: 'mismo usuario que su cuenta oficial, pero muy pequeña y sin verificar',
  IMPLAUSIBLY_SMALL: 'demasiado pequeña para esta figura: probable cuenta abandonada o ajena',
  NAME_MISMATCH: 'el nombre mostrado no coincide',
  NAME_MATCH: 'coincide solo por nombre',
};

function MeasureView({ measure, total }: { measure: Measure; total: number }) {
  const c = measure.components;
  return (
    <div className={styles.measure}>
      <h4>Cómo se midió · puesto {number(measure.rank)} de {number(total)}{measure.measured ? ` · índice ${index(measure.score)}` : ''}</h4>
      {measure.measured ? (
        <dl>
          <div><dt>Visitas a Wikipedia, 12 meses</dt><dd>{c.wikipediaViews12m === null ? 'sin artículo' : [number(c.wikipediaViews12m), c.wikipediaViewsEs ? `es ${number(c.wikipediaViewsEs)}` : null, c.wikipediaViewsEn ? `en ${number(c.wikipediaViewsEn)}` : null].filter(Boolean).join(' · ')}</dd></div>
          <div><dt>Audiencia verificada</dt><dd>{c.verifiedFollowers === null ? 'sin cuenta verificada' : measure.verifiedAccounts.map((a) => `${PLATFORMS[a.platform] ?? a.platform}: ${number(a.followers)}`).join(' · ')}</dd></div>
          <div><dt>Merco Líderes 2025/26</dt><dd>{c.mercoRank === null ? 'no figura' : `puesto ${c.mercoRank}`}</dd></div>
          <div><dt>Puesto en su sector</dt><dd>{number(measure.sectorRank)}</dd></div>
        </dl>
      ) : <p className={styles.muted}>Sin datos medibles en las fuentes abiertas: no tiene artículo en Wikipedia, cuenta verificada ni puesto en Merco.</p>}
      {measure.identityNote ? <p className={styles.muted}>Revisión de identidad: {measure.identityNote}</p> : null}
      {measure.verifiedAccounts.length > 0 ? <ul className={styles.sources}>{measure.verifiedAccounts.map((a) =>
        <li key={a.url}><a href={a.url} target="_blank" rel="noreferrer">{PLATFORMS[a.platform] ?? a.platform} ↗</a> <small>{VERIFICATION[a.verification] ?? a.verification} · {number(a.followers)} seguidores</small></li>)}</ul> : null}
      {measure.unverifiedAccounts.length > 0 ? <p className={styles.muted}>Cuentas sin verificar, que no suman: {measure.unverifiedAccounts.map((a) =>
        `${PLATFORMS[a.platform] ?? a.platform} (${number(a.followers)}, ${VERIFICATION[a.verification] ?? a.verification})`).join(' · ')}.</p> : null}
    </div>
  );
}

function SentimentBlock({ sentiment, label }: { sentiment: Sentiment; label: string }) {
  return (
    <>
      <div className={styles.sentiment} aria-label={label}>
        <span><b>{pct(sentiment.positivePct)}</b> positivos</span>
        <span><b>{pct(sentiment.neutralPct)}</b> neutros</span>
        <span><b>{pct(sentiment.negativePct)}</b> negativos</span>
        {sentiment.ironyPct !== null ? <span><b>{pct(sentiment.ironyPct)}</b> posible ironía</span> : null}
      </div>
      <div className={styles.bar} aria-hidden="true">
        <span className={styles.positive} style={{ width: `${sentiment.positivePct}%` }} />
        <span className={styles.neutral} style={{ width: `${sentiment.neutralPct}%` }} />
        <span className={styles.negative} style={{ width: `${sentiment.negativePct}%` }} />
      </div>
    </>
  );
}

function ConversationView({ entry, limits }: { entry: Conversation; limits: string[] }) {
  const words = (entry.words ?? []).slice(0, 25);
  const peak = Math.max(...words.map((word) => word.count), 1);
  return (
    <div className={styles.pilot}>
      <h4>Lo que se comenta sobre la persona en YouTube</h4>
      <p className={styles.muted}>
        {number(entry.videosRead)} videos recientes que la nombran · {number(entry.commentsRead)} comentarios leídos ·
        {' '}{number(entry.commentsAnalyzed)} clasificados en español.
      </p>
      {entry.sentiment ? (
        <>
          <SentimentBlock sentiment={entry.sentiment} label={`Sentimiento de ${number(entry.commentsAnalyzed)} comentarios`} />
          <p className={styles.muted}>Saldo (positivos menos negativos): {(entry.sentiment.netScore ?? 0) > 0 ? "+" : ""}{pct(entry.sentiment.netScore ?? 0)}</p>
          <ul className={styles.cloud} aria-label="Palabras más repetidas en los comentarios">
            {words.map((word) => (
              <li key={word.term}>
                <span style={{ fontSize: `${(0.86 + 0.98 * Math.sqrt(word.count / peak)).toFixed(2)}rem` }}
                  title={`${number(word.count)} apariciones`}>{word.term}</span>
              </li>
            ))}
          </ul>
        </>
      ) : <p className={styles.empty}>Muestra insuficiente: hacen falta al menos 30 comentarios en español clasificables para publicar el porcentaje.</p>}
      <ol className={styles.posts}>
        {entry.videos.map((video) => (
          <li key={video.videoId}>
            <a href={video.url} target="_blank" rel="noreferrer">{video.title} ↗</a>
            <small>{video.published ?? 'fecha no publicada'} · {number(video.commentsRead)} comentarios leídos</small>
          </li>
        ))}
      </ol>
      <p className={styles.note}>{limits.join(' ')}</p>
    </div>
  );
}

function QualityView({ top, conversation }: { top: Top300; conversation: ConversationSet }) {
  const q = top.method.quality;
  const sources = Object.entries(q.padron.porFuente).sort((left, right) => right[1] - left[1]);
  const counted = Object.entries(q.cuentas.suman);
  const notCounted = Object.entries(q.cuentas.noSuman);
  return (
    <details className={styles.quality}>
      <summary>Calidad de las fuentes y límites de esta lista</summary>
      <h4>De dónde sale el padrón de {number(q.padron.fichasOriginales)}</h4>
      <p className={styles.muted}>
        No es una selección editorial de «los más importantes»: es un padrón de descubrimiento armado con listas públicas.
        {' '}{sources.map(([key, count]) => `${SOURCES[key] ?? key}: ${number(count)}`).join(' · ')}.
        {' '}Una persona puede estar en varias fuentes. Wikidata aporta sobre todo deportistas, políticos y obispos con ficha en Wikipedia.
      </p>
      <h4>Identidad</h4>
      <p className={styles.muted}>
        {number(q.identidad.coincidenciasWikidata)} fichas se enlazaron con su entidad de Wikidata. Se revisaron a mano las sospechosas:
        {' '}{number(q.identidad.revisadasYAceptadas)} confirmadas, {number(q.identidad.descartadas)} descartadas por ser otra persona,
        {' '}{number(q.identidad.duplicadasFusionadas)} duplicadas fusionadas y {number(q.identidad.fueraDeAlcance)} fuera de alcance.
        {' '}Quedan {number(q.padron.fichasEnElRanking)} personas.
      </p>
      <h4>Qué mide el índice</h4>
      <p className={styles.muted}>
        {number(q.conVisitasWikipedia)} personas tienen visitas a Wikipedia, {number(q.conAudienciaVerificada)} tienen audiencia verificada y {number(q.conPuestoMerco)} figuran en Merco.
        {' '}La audiencia suma las plataformas y hay solapamiento entre ellas; Instagram redondea (1 M = 1.000.000 o más).
      </p>
      <h4>Cuentas sociales</h4>
      <p className={styles.muted}>
        Suman: {counted.map(([key, count]) => `${VERIFICATION[key] ?? key} (${number(count)})`).join(' · ') || 'ninguna'}.
        {' '}No suman: {notCounted.map(([key, count]) => `${VERIFICATION[key] ?? key} (${number(count)})`).join(' · ') || 'ninguna'}.
      </p>
      <h4>Sentimiento</h4>
      <p className={styles.muted}>
        {conversation.method.source}. {number(conversation.coverage.peoplePublishable)} personas de {number(conversation.coverage.peopleRead)} leídas tienen muestra
        {' '}suficiente (30 comentarios en español y al menos dos videos con 5 o más). Los comentarios reaccionan al video, no solo a la persona. {conversation.method.limits.join(' ')}
      </p>
      <ul className={styles.limits}>{top.method.limits.map((limit) => <li key={limit}>{limit}</li>)}</ul>
    </details>
  );
}

function ImpactRankingView({ ranking, onPick }: { ranking: ImpactRanking; onPick: (slug: string) => void }) {
  const top = Math.max(...ranking.people.map((row) => row.impactSharePercent), 1);
  const { source } = ranking;
  return (
    <section className={styles.ranking} aria-labelledby="ranking-impacto">
      <div className={styles.rankingHead}>
        <span>Ranking final medido · {ranking.measurementPeriod}</span>
        <h3 id="ranking-impacto">{ranking.title}</h3>
        <p className={styles.muted}>{ranking.question}</p>
      </div>
      <ol className={styles.rankingList}>
        {ranking.people.map((row) => (
          <li key={row.slug}>
            <b className={styles.rankingPlace}>{row.rank}</b>
            <button type="button" onClick={() => onPick(row.slug)} title="Ver la ficha de la persona">{row.name}</button>
            <span className={styles.rankingBar} aria-hidden="true"><i style={{ width: `${(row.impactSharePercent / top) * 100}%` }} /></span>
            <strong>{number(row.impactSharePercent)} %</strong>
          </li>
        ))}
      </ol>
      <p className={styles.note}>
        Fuente: <a href={source.url} target="_blank" rel="noreferrer">{source.publisher}, {source.publication} ↗</a>.
        {' '}Encuesta de {number(source.sampleSize)} personas con acceso a internet en {source.geographicCoverage.join(', ')},
        {' '}del {source.fieldworkStart} al {source.fieldworkEnd} (margen ±{source.referenceMarginOfErrorPercentagePoints.toLocaleString('es-BO')} puntos).
        {' '}{ranking.interpretation.scope} {ranking.interpretation.currentness}
        {ranking.accessNote ? ` ${ranking.accessNote}` : ''}
      </p>
    </section>
  );
}

export function PeopleSection() {
  const { payload, failed } = useOnOpen<PeoplePayload>('/api/personalidades');
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('ALL');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [limit, setLimit] = useState(30);
  const people = useMemo<Person[]>(() => (payload?.top300.people ?? []).map((row) => ({
    slug: row.slug, name: row.name, sector: row.sector, evidence: row.evidence, accountLeadCount: 0,
  })), [payload]);
  const ipsos = useMemo(() => new Map((payload?.ranking.people ?? []).map((row) => [row.slug, row.rank])), [payload]);
  const measures = useMemo(() => new Map((payload?.top300.people ?? []).map((row) => [row.slug, row])), [payload]);
  const filtered = useMemo(() => people.filter((person) => measures.has(person.slug) &&
    (sector === 'ALL' || (measures.get(person.slug)?.sector ?? person.sector) === sector) && folded(person.name).includes(folded(query)))
    .sort((left, right) => (measures.get(left.slug)?.rank ?? 999) - (measures.get(right.slug)?.rank ?? 999)),
  [people, query, sector, measures]);
  const selected = filtered.find((person) => person.slug === selectedSlug) ?? filtered[0];
  const measure = selected ? measures.get(selected.slug) : undefined;
  const talk = selected ? payload?.conversation.people[selected.slug] : undefined;
  const pilot = payload?.pilot.people.find((person) => person.slug === selected?.slug);

  return (
    <div className="stack">
      <TabHeader id="personalidades" title="Personalidades de Bolivia"
        lede="Las cinco figuras de mayor impacto percibido en 2025 según Ipsos CIESMORI y, debajo, el Top 300 de personas de política, empresas, deporte, cultura, ciencia y redes, ordenado por atención medible en fuentes abiertas." />
      {!payload ? <OnOpenNotice what="la investigación de personalidades" failed={failed} /> : (
        <>
          <ImpactRankingView ranking={payload.ranking} onPick={(slug) => { setQuery(''); setSector('ALL'); setSelectedSlug(slug); }} />
          <div className={styles.stats}>
            <div><strong>{number(payload.top300.method.quality.padron.fichasEnElRanking)}</strong><span>personas en el ranking</span></div>
            <div><strong>{number(payload.top300.method.measuredPeople)}</strong><span>con atención medible</span></div>
            <div><strong>{number(payload.conversation.coverage.peoplePublishable)}</strong><span>con sentimiento publicado</span></div>
            <div><strong>{number(payload.conversation.coverage.commentsAnalyzed + payload.pilot.coverage.commentsAnalyzedSpanish)}</strong><span>comentarios en español analizados</span></div>
          </div>
          <p className={styles.notice}>
            Orden de las 300: {payload.top300.method.summary} No mide importancia ni mérito. Solo suman las cuentas con identidad respaldada; las demás se muestran aparte. Las cuentas de directorios,
            buscadores y Wikidata se revisan antes de publicar métricas personales. El sentimiento sale de comentarios públicos de YouTube en videos recientes que nombran a cada persona; los canales propios de tres personas se analizan aparte.
          </p>
          <QualityView top={payload.top300} conversation={payload.conversation} />
          <div className={styles.layout}>
            <div className={styles.listPanel}>
              <div className={styles.filters}>
                <label>Buscar persona<input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(30); }} placeholder="Nombre" /></label>
                <label>Sector<select value={sector} onChange={(event) => { setSector(event.target.value); setLimit(30); }}>
                  <option value="ALL">Todos los sectores</option>
                  {Object.entries(SECTORS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
              </div>
              <p className={styles.count}>{number(filtered.length)} personas · ordenadas por índice de atención medible</p>
              <ul className={styles.peopleList}>
                {filtered.slice(0, limit).map((person) => (
                  <li key={person.slug}>
                    <button type="button" aria-pressed={selected?.slug === person.slug}
                      className={selected?.slug === person.slug ? styles.selected : ''}
                      onClick={() => setSelectedSlug(person.slug)}>
                      <b>{measures.get(person.slug)?.rank ?? '–'}. {person.name}{ipsos.has(person.slug) ? ` ★ Top 5 Ipsos (#${ipsos.get(person.slug)})` : ''}</b><span>{SECTORS[measures.get(person.slug)?.sector ?? person.sector] ?? person.sector}{measures.get(person.slug)?.measured ? ` · índice ${index(measures.get(person.slug)?.score ?? 0)}` : ' · sin medición'}</span>
                      {payload.pilot.people.some((entry) => entry.slug === person.slug) ? <em>Comentarios analizados</em> : null}
                    </button>
                  </li>
                ))}
              </ul>
              {filtered.length > limit ? <button type="button" className={styles.more} onClick={() => setLimit((value) => value + 30)}>Mostrar 30 más</button> : null}
            </div>
            {selected ? <article className={styles.detail}>
              <div className={styles.detailHead}><span>{SECTORS[measure?.sector ?? selected.sector] ?? selected.sector}</span><h3>{selected.name}</h3>{ipsos.has(selected.slug) ? <em className={styles.badge}>Top 5 de impacto percibido 2025 · puesto {ipsos.get(selected.slug)}</em> : null}</div>
              <p className={styles.muted}>{selected.evidence.length} fuentes de identificación · {selected.accountLeadCount} pistas de cuenta social pendientes de verificar.</p>
              <h4>Fuentes de la ficha</h4>
              <ul className={styles.sources}>{selected.evidence.map((source) =>
                <li key={`${source.source}-${source.url}`}><a href={source.url} target="_blank" rel="noreferrer">{SOURCES[source.source] ?? source.source}{source.rank ? ` · puesto ${source.rank}` : ''} ↗</a></li>)}</ul>
              {measure ? <MeasureView measure={measure} total={payload.top300.method.quality.padron.fichasEnElRanking} /> : null}
              {talk ? <ConversationView entry={talk} limits={payload?.conversation.method.limits ?? []} /> : <p className={styles.empty}>Sin lectura de comentarios: no se encontraron videos recientes que la nombren o no hay base para confirmar que es adulta.</p>}
              {pilot ? <SentimentView person={pilot} /> : null}
            </article> : null}
          </div>
        </>
      )}
    </div>
  );
}

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
  ironyPct: number | null; topEmotion: string | null;
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
  status: string; title: string; measurementPeriod: string; question: string;
  source: { publisher: string; publication: string; publishedAt: string; url: string; sampleSize: number; fieldworkStart: string; fieldworkEnd: string; geographicCoverage: string[]; referenceMarginOfErrorPercentagePoints: number };
  interpretation: { scope: string; coverageLimit: string; currentness: string };
  people: RankedPerson[];
}
interface PeoplePayload {
  ranking: ImpactRanking;
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
  WIKIDATA_DISCOVERY: 'Wikidata',
  UCB_MARIE_CURIE: 'UCB, Premio Marie Curie',
  UMSA_SCIENCE_2025: 'UMSA, ciencia 2025',
  UCB_SCIENCE_2025: 'UCB, ciencia 2025',
};
const number = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'sin dato' : value.toLocaleString('es-BO');
const pct = (value: number): string => `${value.toLocaleString('es-BO', { maximumFractionDigits: 1 })} %`;
const folded = (value: string): string => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const EMPTY_PEOPLE: Person[] = [];

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
      </p>
    </section>
  );
}

export function PeopleSection() {
  const { payload, failed } = useOnOpen<PeoplePayload>('/api/personalidades');
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('ALL');
  const [selectedSlug, setSelectedSlug] = useState('P_ALBERTINA_SACACA');
  const [limit, setLimit] = useState(30);
  const people = payload?.research.people ?? EMPTY_PEOPLE;
  const filtered = useMemo(() => people.filter((person) =>
    (sector === 'ALL' || person.sector === sector) && folded(person.name).includes(folded(query)))
    .sort((left, right) => left.name.localeCompare(right.name, 'es')),
  [people, query, sector]);
  const selected = filtered.find((person) => person.slug === selectedSlug) ?? filtered[0];
  const pilot = payload?.pilot.people.find((person) => person.slug === selected?.slug);

  return (
    <div className="stack">
      <TabHeader id="personalidades" title="Personalidades de Bolivia"
        lede="Las cinco figuras de mayor impacto percibido en 2025 según Ipsos CIESMORI y, debajo, la investigación de 300 personas de política, empresas, deporte, cultura, ciencia y redes con sus fuentes y la cobertura social disponible." />
      {!payload ? <OnOpenNotice what="la investigación de personalidades" failed={failed} /> : (
        <>
          <ImpactRankingView ranking={payload.ranking} onPick={(slug) => { setQuery(''); setSector('ALL'); setSelectedSlug(slug); }} />
          <div className={styles.stats}>
            <div><strong>{number(people.length)}</strong><span>personas en revisión</span></div>
            <div><strong>{number(people.filter((person) => person.accountLeadCount > 0).length)}</strong><span>con pistas de cuentas por verificar</span></div>
            <div><strong>{number(payload.pilot.coverage.peopleWithPilotSentiment)}</strong><span>con muestra de sentimiento</span></div>
            <div><strong>{number(payload.pilot.coverage.commentsAnalyzedSpanish)}</strong><span>comentarios en español analizados</span></div>
          </div>
          <p className={styles.notice}>
            El padrón de 300 es un marco de investigación, no un ranking: el único orden medido es el Top 5 de arriba. Las cuentas de directorios,
            buscadores y Wikidata se revisan antes de publicar métricas personales. Los datos de comentarios
            corresponden solo a tres canales corroborados y al período {payload.pilot.windowStart}–{payload.pilot.windowEnd}.
          </p>
          <div className={styles.layout}>
            <div className={styles.listPanel}>
              <div className={styles.filters}>
                <label>Buscar persona<input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(30); }} placeholder="Nombre" /></label>
                <label>Sector<select value={sector} onChange={(event) => { setSector(event.target.value); setLimit(30); }}>
                  <option value="ALL">Todos los sectores</option>
                  {Object.entries(SECTORS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
              </div>
              <p className={styles.count}>{number(filtered.length)} personas encontradas · orden alfabético</p>
              <ul className={styles.peopleList}>
                {filtered.slice(0, limit).map((person) => (
                  <li key={person.slug}>
                    <button type="button" aria-pressed={selected?.slug === person.slug}
                      className={selected?.slug === person.slug ? styles.selected : ''}
                      onClick={() => setSelectedSlug(person.slug)}>
                      <b>{person.name}</b><span>{SECTORS[person.sector] ?? person.sector}</span>
                      {payload.pilot.people.some((entry) => entry.slug === person.slug) ? <em>Comentarios analizados</em> : null}
                    </button>
                  </li>
                ))}
              </ul>
              {filtered.length > limit ? <button type="button" className={styles.more} onClick={() => setLimit((value) => value + 30)}>Mostrar 30 más</button> : null}
            </div>
            {selected ? <article className={styles.detail}>
              <div className={styles.detailHead}><span>{SECTORS[selected.sector] ?? selected.sector}</span><h3>{selected.name}</h3></div>
              <p className={styles.muted}>{selected.evidence.length} fuentes de identificación · {selected.accountLeadCount} pistas de cuenta social pendientes de verificar.</p>
              <h4>Fuentes de la ficha</h4>
              <ul className={styles.sources}>{selected.evidence.map((source) =>
                <li key={`${source.source}-${source.url}`}><a href={source.url} target="_blank" rel="noreferrer">{SOURCES[source.source] ?? source.source}{source.rank ? ` · puesto ${source.rank}` : ''} ↗</a></li>)}</ul>
              {pilot ? <SentimentView person={pilot} /> : <p className={styles.empty}>Sin análisis de comentarios publicable. Falta corroborar una cuenta personal con suficientes comentarios visibles en español.</p>}
            </article> : null}
          </div>
        </>
      )}
    </div>
  );
}

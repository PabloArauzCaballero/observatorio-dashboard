'use client';

import { ChartLegend } from '@/components/charts';
import { useOnOpen } from '@/components/on-open';
import { Panel } from '@/components/ui/panel';
import type { Account, OwnChannel, PersonDetail, PersonRow, Sentiment } from '@/lib/people-types';
import { usePeople } from './people-context';
import {
  COMPONENT_LABEL,
  PLATFORMS,
  SOURCES,
  VERIFICATION,
  contributions,
  dec,
  missingReason,
  netOf,
  num,
  pct,
  sectorLabel,
  signed,
  sinDatoMotivo,
  talkState,
  type Contribution,
} from './people-model';
import { COMPONENT_TONE } from './page-perceived';
import { Avatar, Empty } from './people-ui';
import s from './people.module.css';

const SENTIMENT_TONE = {
  positive: 'var(--series-1)',
  neutral: 'var(--series-rest)',
  negative: 'var(--series-2)',
} as const;

/** La ficha de una persona: quién es, cómo se midió, qué audiencia tiene y qué se dice de ella. */
export function Profile({ row }: { row: PersonRow }) {
  const { summary, rows, select, updated } = usePeople();
  const weights = summary.method.weights;
  const parts = contributions(row, weights);
  const inSector = rows.filter((other) => other.sector === row.sector).length;
  const { payload: detail, failed } = useOnOpen<PersonDetail>(`/api/personalidades/${row.slug}`);
  const topShare = row.measured
    ? Math.max(1, Math.ceil((row.rank / Math.max(1, summary.method.measuredPeople)) * 100))
    : null;

  return (
    <article className={s.profile} aria-labelledby={`ficha-${row.slug}`}>
      <button type="button" className={`chip ${s.back}`} onClick={() => select(null)}>
        ← Volver a la lista
      </button>
      <header className={s.head}>
        <Avatar name={row.name} size="lg" />
        <div className={s.headText}>
          <h3 id={`ficha-${row.slug}`}>{row.name}</h3>
          <p className={s.standing}>
            {sectorLabel(row.sector)}
            {row.measured ? (
              <>
                {' · '}
                <b>puesto {num(row.rank)}</b> de {num(rows.length)} · <b>{row.sectorRank}.º</b> de{' '}
                {num(inSector)} en su sector
                {topShare !== null ? ` · entre el ${topShare} % con mayor índice` : ''}
              </>
            ) : (
              ' · sin puesto: no hay datos medibles'
            )}
          </p>
          {row.ipsos ? (
            <span className={s.badge}>Top 5 de impacto percibido 2025 · puesto {row.ipsos}</span>
          ) : null}
        </div>
      </header>

      <Panel
        id={`ficha-medicion-${row.slug}`}
        title={`Cómo se midió a ${row.name} (índice de 0 a 100)`}
        lede={
          row.measured
            ? 'Cada fuente aporta hasta su peso en el índice; la pista rayada marca lo que no tiene dato.'
            : undefined
        }
        source="Observatorio Económico de Bolivia con Wikipedia, cuentas verificadas y Merco Líderes 2025/26"
        updated={updated}
        data={{
          columnas: ['Fuente', 'Dato', 'Percentil', 'Puntos aportados', 'Máximo posible'],
          filas: parts.map((part) => [
            COMPONENT_LABEL[part.key],
            rawLabel(row, part.key),
            part.percentile === null ? null : Math.round(part.percentile * 1000) / 10,
            Math.round(part.points * 10) / 10,
            part.ceiling,
          ]),
          unidad: 'puntos del índice',
        }}
      >
        {row.measured ? (
          <Measure row={row} parts={parts} />
        ) : (
          <Empty title="Sin datos medibles">{sinDatoMotivo(row)}</Empty>
        )}
      </Panel>

      <AudiencePanel row={row} detail={detail} />
      <TalkPanel row={row} detail={detail} />
      <Sources detail={detail} failed={failed} />
    </article>
  );
}

function rawLabel(row: PersonRow, key: Contribution['key']): string {
  const c = row.components;
  if (key === 'views')
    return c.wikipediaViews12m === null
      ? 'sin artículo'
      : `${num(c.wikipediaViews12m)} visitas (es ${num(c.wikipediaViewsEs ?? 0)}, en ${num(c.wikipediaViewsEn ?? 0)})`;
  if (key === 'social')
    return c.verifiedFollowers === null
      ? 'sin cuenta verificada'
      : `${num(c.verifiedFollowers)} seguidores`;
  return c.mercoRank === null ? 'no figura' : `puesto ${c.mercoRank}`;
}

function Measure({ row, parts }: { row: PersonRow; parts: Contribution[] }) {
  return (
    <>
      <ul className={s.parts}>
        {parts.map((part) => (
          <li className={s.part} key={part.key}>
            <span className={s.partName}>
              <span
                className={s.swatch}
                style={{ background: COMPONENT_TONE[part.key] }}
                aria-hidden="true"
              />
              {COMPONENT_LABEL[part.key]}
            </span>
            <span className={s.partPts}>
              {part.present
                ? `${dec(part.points)} de ${dec(part.ceiling, 0)} puntos`
                : `0 de ${dec(part.ceiling, 0)} puntos`}
            </span>
            <span
              className={part.present ? s.partTrack : `${s.partTrack} ${s.partTrackEmpty}`}
              role="img"
              aria-label={
                part.present
                  ? `${dec(part.points)} de ${dec(part.ceiling, 0)} puntos`
                  : `Sin dato: ${missingReason(row, part.key)}`
              }
            >
              {part.present ? (
                <span
                  className={s.partFill}
                  style={{
                    width: `${(part.points / part.ceiling) * 100}%`,
                    background: COMPONENT_TONE[part.key],
                  }}
                />
              ) : null}
            </span>
            <p className={s.partNote}>
              {part.present
                ? `${rawLabel(row, part.key)} · percentil ${dec((part.percentile ?? 0) * 100, 0)}`
                : `Sin dato: ${missingReason(row, part.key)}.`}
            </p>
          </li>
        ))}
      </ul>
      <p className={s.totalLine}>
        <span>Suma de las tres fuentes</span>
        <strong>{dec(row.score)} de 100</strong>
      </p>
      <ChartLegend
        items={parts.map((part) => ({
          color: COMPONENT_TONE[part.key],
          label: `${COMPONENT_LABEL[part.key]} (hasta ${dec(part.ceiling, 0)} puntos)`,
        }))}
      />
    </>
  );
}

/* ------------------------------------------------------------ audiencia */

function AudiencePanel({ row, detail: payload }: { row: PersonRow; detail: PersonDetail | null }) {
  const { updated } = usePeople();
  const peak = Math.max(...row.accounts.map((a) => a.followers ?? 0), 1);
  const unverified: Account[] = payload?.unverifiedAccounts ?? [];
  const linkOf = (platform: string): string | undefined =>
    payload?.verifiedAccounts.find((a) => a.platform === platform)?.url;
  const none = row.accounts.length === 0 && row.unverified === 0;

  return (
    <Panel
      id={`ficha-audiencia-${row.slug}`}
      title={`Audiencia verificada de ${row.name} (seguidores)`}
      lede="Solo suman las cuentas con identidad respaldada; las demás se muestran con trama y no cuentan."
      source="Páginas públicas de TikTok, YouTube, Instagram y Facebook; identidad según Wikidata, TikTok o fuentes enlazadas"
      updated={updated}
      data={{
        columnas: ['Plataforma', 'Seguidores', 'Suma al índice', 'Verificación'],
        filas: [
          ...row.accounts.map(
            (a) => [PLATFORMS[a.platform] ?? a.platform, a.followers, 'sí', null] as const,
          ),
          ...unverified.map(
            (a) =>
              [
                PLATFORMS[a.platform] ?? a.platform,
                a.followers,
                'no',
                VERIFICATION[a.verification] ?? a.verification,
              ] as const,
          ),
        ].map((fila) => [...fila]),
        unidad: 'seguidores',
      }}
    >
      {none ? (
        <Empty title="Sin cuentas halladas">
          No se encontró una cuenta de {row.name} en TikTok, YouTube, Instagram ni Facebook con
          respaldo suficiente.
        </Empty>
      ) : (
        <>
          <ul className={s.platforms}>
            {row.accounts.map((account) => {
              const href = linkOf(account.platform);
              return (
                <li className={s.platform} key={`ok-${account.platform}`}>
                  <span className={s.platformName}>
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer">
                        {PLATFORMS[account.platform] ?? account.platform} ↗
                      </a>
                    ) : (
                      (PLATFORMS[account.platform] ?? account.platform)
                    )}
                  </span>
                  <span className={s.platformBar}>
                    <span
                      className={s.platformFill}
                      style={{ width: `${((account.followers ?? 0) / peak) * 100}%` }}
                    />
                  </span>
                  <span className={s.platformN}>{num(account.followers)}</span>
                </li>
              );
            })}
            {unverified.map((account) => (
              <li className={s.platform} key={`no-${account.platform}-${account.url}`}>
                <span className={s.platformName}>
                  <a href={account.url} target="_blank" rel="noreferrer">
                    {PLATFORMS[account.platform] ?? account.platform} ↗
                  </a>
                </span>
                <span className={s.platformBar}>
                  <span
                    className={`${s.platformFill} ${s.platformFillNo}`}
                    style={{ width: `${Math.max(2, ((account.followers ?? 0) / peak) * 100)}%` }}
                  />
                </span>
                <span className={s.platformN}>{num(account.followers)}</span>
                <span className={s.platformWhy}>
                  No suma: {VERIFICATION[account.verification] ?? account.verification}.
                </span>
              </li>
            ))}
          </ul>
          {row.accounts.length === 0 ? (
            <p className={s.footnote}>
              Ninguna cuenta hallada tiene identidad respaldada, así que la audiencia del índice es
              0 por falta de dato, no por poca gente.
            </p>
          ) : null}
          <ChartLegend
            items={[
              { color: 'var(--series-1)', label: 'Seguidores de una cuenta que suma' },
              { color: 'var(--series-rest)', label: 'Cuenta hallada que no suma (con trama)' },
            ]}
          />
        </>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------- conversación */

export function SentimentBlock({ sentiment, label }: { sentiment: Sentiment; label: string }) {
  const net = sentiment.netScore ?? sentiment.positivePct - sentiment.negativePct;
  return (
    <div className={s.sent}>
      <p className={s.sentNet}>
        <strong>{signed(net)}</strong>
        <span>puntos de saldo (positivos menos negativos)</span>
      </p>
      <div className={s.sentBar} role="img" aria-label={label}>
        <span
          className={s.sentSeg}
          style={{ width: `${sentiment.positivePct}%`, background: SENTIMENT_TONE.positive }}
        />
        <span
          className={`${s.sentSeg} ${s.segGap}`}
          style={{ width: `${sentiment.neutralPct}%`, background: SENTIMENT_TONE.neutral }}
        />
        <span
          className={`${s.sentSeg} ${s.segGap}`}
          style={{ width: `${sentiment.negativePct}%`, background: SENTIMENT_TONE.negative }}
        />
      </div>
      <ul className={s.sentLegend}>
        <li>
          <b>{pct(sentiment.positivePct)}</b> positivos
        </li>
        <li>
          <b>{pct(sentiment.neutralPct)}</b> neutros
        </li>
        <li>
          <b>{pct(sentiment.negativePct)}</b> negativos
        </li>
      </ul>
      {sentiment.ironyPct !== null ? (
        <p className={s.sentIrony}>
          {pct(sentiment.ironyPct)} de los comentarios podrían ser irónicos: el modelo los confunde
          con facilidad.
        </p>
      ) : null}
    </div>
  );
}

function TalkPanel({ row, detail: payload }: { row: PersonRow; detail: PersonDetail | null }) {
  const { summary, updated } = usePeople();
  const state = talkState(row);
  const talk = row.talk;
  const net = netOf(row);

  return (
    <Panel
      id={`ficha-conversacion-${row.slug}`}
      title={`Qué se comenta de ${row.name} en YouTube (% de comentarios en español)`}
      lede="Reacciones a videos recientes que la nombran: miden a quienes comentan, no a toda Bolivia."
      source="Comentarios públicos de YouTube, clasificados con pysentimiento/robertuito"
      updated={updated}
      data={
        talk?.sentiment
          ? {
              columnas: ['Medida', 'Valor'],
              filas: [
                ['Positivos (%)', talk.sentiment.positivePct],
                ['Neutros (%)', talk.sentiment.neutralPct],
                ['Negativos (%)', talk.sentiment.negativePct],
                ['Saldo (puntos)', net],
                ['Comentarios clasificados', talk.analyzed],
                ['Comentarios leídos', talk.read],
                ['Videos', talk.videos],
              ],
              unidad: '% de comentarios en español',
            }
          : { columnas: ['Medida', 'Valor'], filas: [], unidad: '% de comentarios en español' }
      }
    >
      {state === 'publishable' && talk?.sentiment ? (
        <>
          <p className={s.footnote}>
            {num(talk.analyzed)} comentarios en español clasificados, de {num(talk.read)} leídos en{' '}
            {num(talk.videos)} videos.{' '}
            {talk.analyzed < 60 ? (
              <span className={s.sample}>Muestra pequeña: léase con cautela</span>
            ) : null}
          </p>
          <SentimentBlock
            sentiment={talk.sentiment}
            label={`Sentimiento de ${num(talk.analyzed)} comentarios`}
          />
          <ChartLegend
            items={[
              { color: SENTIMENT_TONE.positive, label: 'Positivos' },
              { color: SENTIMENT_TONE.neutral, label: 'Neutros' },
              { color: SENTIMENT_TONE.negative, label: 'Negativos' },
            ]}
          />
          {payload && payload.words.length > 0 ? (
            <>
              <h4 className={s.subhead}>Palabras más repetidas</h4>
              <ul className={s.words} aria-label="Palabras más repetidas en los comentarios">
                {payload.words.slice(0, 20).map((word) => (
                  <li className={s.word} key={word.term}>
                    {word.term} <small>{num(word.count)}</small>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : state === 'insufficient' && talk ? (
        <Empty title="Sin sentimiento publicado: la muestra es corta">
          Se leyeron {num(talk.read)} comentarios ({num(talk.analyzed)} en español) en{' '}
          {num(talk.videos)} videos. Para publicar un porcentaje hacen falta{' '}
          {summary.conversation.minComments} comentarios en español y al menos dos videos con 5 o
          más.
        </Empty>
      ) : (
        <Empty title="Sin lectura de comentarios">
          No se encontraron videos recientes que nombren a {row.name}, o no hay base para confirmar
          que es adulta.
        </Empty>
      )}

      {payload && payload.videos.length > 0 ? (
        <details className={s.details}>
          <summary>Videos leídos ({num(payload.videos.length)})</summary>
          <ul className={s.videos}>
            {payload.videos.map((video) => (
              <li key={video.videoId}>
                <a href={video.url} target="_blank" rel="noreferrer">
                  {video.title} ↗
                </a>
                <small>
                  {video.published ?? 'fecha no publicada'} · {num(video.commentsRead)} comentarios
                  leídos
                </small>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {payload?.own ? <OwnChannelBlock own={payload.own} /> : null}
    </Panel>
  );
}

function OwnChannelBlock({ own }: { own: OwnChannel }) {
  return (
    <div className={s.details}>
      <h4 className={s.subhead}>Su propio canal · muestra exploratoria</h4>
      <p className={s.footnote}>
        {num(own.followersApprox)} suscriptores aproximados al {own.retrievedAt.slice(0, 10)} ·{' '}
        {num(own.postsInWindow)} videos leídos · {num(own.commentsAnalyzedSpanish)} comentarios
        clasificados en español.{' '}
        <a href={own.accountUrl} target="_blank" rel="noreferrer">
          Abrir canal ↗
        </a>
      </p>
      <SentimentBlock
        sentiment={own.sentiment}
        label="Sentimiento de los comentarios en su propio canal"
      />
    </div>
  );
}

/* --------------------------------------------------------------- fuentes */

function Sources({ detail: payload, failed }: { detail: PersonDetail | null; failed: boolean }) {
  if (failed) return <p className={s.footnote}>No se pudieron leer las fuentes de esta ficha.</p>;
  if (!payload) return <p className={s.footnote}>Leyendo las fuentes de la ficha…</p>;
  return (
    <section aria-label="Fuentes de la ficha">
      <h4 className={s.subhead}>Fuentes de la ficha</h4>
      <ul className={s.sources}>
        {payload.evidence.map((source) => (
          <li key={`${source.source}-${source.url}`}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {SOURCES[source.source] ?? source.source}
              {source.rank ? ` · puesto ${source.rank}` : ''} ↗
            </a>
          </li>
        ))}
      </ul>
      {payload.identityNote ? (
        <p className={s.footnote}>Revisión de identidad: {payload.identityNote}</p>
      ) : null}
    </section>
  );
}

'use client';

import { ChartLegend } from '@/components/charts';
import { Panel } from '@/components/ui/panel';
import { usePeople } from './people-context';
import {
  COMPONENT_LABEL,
  contributions,
  dec,
  lensRows,
  num,
  pct,
  sectorLabel,
} from './people-model';
import { Avatar, Facts } from './people-ui';
import { RankList, type RankItem } from './rank-list';
import s from './people.module.css';

/** Los colores de las tres fuentes del índice: las tres casillas que pasan «todos contra todos». */
export const COMPONENT_TONE = {
  views: 'var(--official)',
  social: 'var(--parallel)',
  merco: 'var(--gap)',
} as const;

const logPosition = (rank: number, total: number): number =>
  total > 1 ? (Math.log(rank) / Math.log(total)) * 100 : 0;

/**
 * «Impacto percibido»: la entrada. Dos maneras de preguntar quién pesa en Bolivia, una al
 * lado de la otra, y la distancia entre ellas dicha en voz alta.
 */
export function PerceivedPage() {
  const { summary, rows, openProfile, updated } = usePeople();
  const ranking = summary.ranking;
  const { source } = ranking;
  const moe = source.referenceMarginOfErrorPercentagePoints;
  const peak = Math.max(...ranking.people.map((p) => p.impactSharePercent), 1) + moe;
  const weights = summary.method.weights;

  const ipsosItems: RankItem[] = ranking.people.map((p) => ({
    slug: p.slug,
    name: p.name,
    sub: sectorLabel(p.sector),
    place: p.rank,
    shown: pct(p.impactSharePercent, 0),
    raw: p.impactSharePercent,
    segments: [
      {
        key: 'ipsos',
        width: (p.impactSharePercent / peak) * 100,
        color: 'var(--series-1)',
        label: `${dec(p.impactSharePercent)} % de los encuestados`,
      },
    ],
    band: {
      from: ((p.impactSharePercent - moe) / peak) * 100,
      to: ((p.impactSharePercent + moe) / peak) * 100,
    },
  }));

  const topIndex = rows.filter((row) => row.measured).slice(0, 10);
  const indexItems: RankItem[] = topIndex.map((row) => ({
    slug: row.slug,
    name: row.name,
    sub: `${sectorLabel(row.sector)} · ${row.sectorRank}.º del sector`,
    place: row.rank,
    shown: dec(row.score),
    raw: row.score,
    segments: contributions(row, weights).map((part) => ({
      key: part.key,
      width: part.points,
      color: COMPONENT_TONE[part.key],
      label: `${COMPONENT_LABEL[part.key]}: ${dec(part.points)} puntos`,
    })),
  }));

  const lens = lensRows(ranking.people, rows, rows.length);
  const ticks = [1, 3, 10, 30, 100, rows.length];

  return (
    <>
      <Facts
        items={[
          { value: num(rows.length), label: 'personas en el ranking' },
          { value: num(summary.method.measuredPeople), label: 'con atención medible' },
          {
            value: num(summary.conversation.peoplePublishable),
            label: 'con sentimiento publicado',
          },
          {
            value: num(summary.conversation.commentsAnalyzed),
            label: 'comentarios de YouTube analizados',
          },
        ]}
      />

      <div className="grid-pair">
        <div className={s.col}>
          <Panel
            id="personalidades-ipsos"
            title="Impacto percibido de figuras bolivianas en 2025 (% de encuestados que las nombran)"
            lede={ranking.question}
            ledeText={ranking.question}
            source={`${source.publisher}, ${source.publication}`}
            updated={updated}
          >
            <RankList
              items={ipsosItems}
              onPick={openProfile}
              label="Las cinco figuras con mayor impacto percibido en 2025"
              unit="% de encuestados"
              valueHeader="% de encuestados que la nombran"
              tall
            />
            <ChartLegend
              items={[
                { color: 'var(--series-1)', label: '% de encuestados que nombran a la figura' },
                {
                  color: 'var(--ink-soft)',
                  label: `Margen de error de ±${dec(moe, 2)} puntos (el bigote de cada barra)`,
                },
              ]}
            />
            <details className={s.details}>
              <summary>Sobre esta encuesta</summary>
              <p>
                {num(source.sampleSize)} personas de 18 años o más con acceso a internet en{' '}
                {source.geographicCoverage.join(', ')}, del {source.fieldworkStart} al{' '}
                {source.fieldworkEnd}. {ranking.scope} {ranking.coverageLimit}
              </p>
              <p>
                {ranking.currentness}
                {ranking.currentnessUrl ? (
                  <>
                    {' '}
                    <a href={ranking.currentnessUrl} target="_blank" rel="noreferrer">
                      Monitor de Opinión Pública, septiembre de 2026 ↗
                    </a>
                  </>
                ) : null}
              </p>
              <p>
                Fuente:{' '}
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.publisher}, {source.publication} ↗
                </a>
                . {ranking.accessNote ?? ''}
              </p>
            </details>
          </Panel>

          <Panel
            id="personalidades-lentes"
            title="Las cinco de Ipsos frente a su puesto en el índice (puesto entre las personas del ranking)"
            lede="Preguntar a la gente y medir la atención no dan el mismo orden. La distancia entre los dos puntos de cada fila es esa diferencia."
            source="Ipsos CIESMORI y Observatorio Económico de Bolivia"
            updated={updated}
            data={{
              columnas: [
                'Figura',
                'Puesto en Ipsos',
                '% Ipsos',
                'Puesto en el índice',
                'Personas en el ranking',
              ],
              filas: lens.map((row) => [
                row.name,
                row.ipsosRank,
                row.ipsosShare,
                row.indexRank,
                rows.length,
              ]),
              unidad: 'puesto',
            }}
          >
            <LensChart lens={lens} total={rows.length} ticks={ticks} onPick={openProfile} />
            <ChartLegend
              items={[
                { color: 'var(--ink)', label: 'Puesto en Ipsos (percepción, 2025)' },
                { color: 'var(--series-1)', label: 'Puesto en el índice de atención medible' },
              ]}
            />
          </Panel>
        </div>
        <div className={s.col}>
          <Panel
            id="personalidades-indice-top10"
            title="Atención medible: las diez primeras (índice de 0 a 100)"
            lede="Qué tanto se busca, se sigue y se cita a cada persona en fuentes abiertas. No mide importancia ni mérito."
            source="Observatorio Económico de Bolivia con Wikipedia, cuentas verificadas y Merco Líderes 2025/26"
            updated={updated}
          >
            <RankList
              items={indexItems}
              onPick={openProfile}
              label="Las diez personas con mayor índice de atención medible"
              unit="índice de 0 a 100"
              valueHeader="Índice de atención (0–100)"
              tall
            />
            <ChartLegend
              items={(['views', 'social', 'merco'] as const).map((key) => ({
                color: COMPONENT_TONE[key],
                label: `${COMPONENT_LABEL[key]} (${Math.round(weights[key] * 100)} % del índice)`,
              }))}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

function LensChart({
  lens,
  total,
  ticks,
  onPick,
}: {
  lens: ReturnType<typeof lensRows>;
  total: number;
  ticks: number[];
  onPick: (slug: string) => void;
}) {
  return (
    <ul className={s.lens} aria-label="Puesto de cada figura de Ipsos en los dos órdenes">
      {lens.map((row) => {
        const a = logPosition(row.ipsosRank, total);
        const b = row.indexRank === null ? null : logPosition(row.indexRank, total);
        return (
          <li className={s.lensRow} key={row.slug}>
            <span className={s.lensName}>
              <Avatar name={row.name} />
              <button type="button" className={s.nameBtn} onClick={() => onPick(row.slug)}>
                {row.name}
              </button>
            </span>
            <span className={s.lensRail} aria-hidden="true">
              {b !== null ? (
                <span
                  className={s.lensLink}
                  style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%` }}
                />
              ) : null}
              <span className={`${s.lensDot} ${s.lensIpsos}`} style={{ left: `${a}%` }} />
              {b !== null ? <span className={s.lensDot} style={{ left: `${b}%` }} /> : null}
            </span>
            <span className={s.lensPlace}>
              {row.indexRank === null
                ? 'sin puesto'
                : `Ipsos ${row.ipsosRank}.º · índice ${row.indexRank}.º`}
            </span>
            {row.why ? <span className={s.lensWhy}>{row.why}</span> : null}
          </li>
        );
      })}
      <li className={`${s.lensRow} ${s.lensAxisRow}`} aria-hidden="true">
        <span />
        <span className={s.lensRail}>
          {ticks.map((tick) => (
            <span
              key={tick}
              className={s.lensTick}
              style={{ left: `${logPosition(tick, total)}%` }}
            >
              {tick === total ? `${tick}.º` : tick}
            </span>
          ))}
        </span>
        <span />
      </li>
    </ul>
  );
}

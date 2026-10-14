'use client';

import {
  ChartLegend,
  DivergingBars,
  ShareBars,
  type DivergingRow,
  type ShareSlice,
} from '@/components/charts';
import { Panel } from '@/components/ui/panel';
import { FilterBar } from './filter-bar';
import { usePeople } from './people-context';
import { channelNetOf, channelState, netOf, num, talkState } from './people-model';
import { Empty } from './people-ui';
import s from './people.module.css';

const SOURCE = 'Comentarios públicos de YouTube, clasificados con pysentimiento/robertuito';

/**
 * «Conversación»: qué reacción generan en YouTube las personas con muestra suficiente.
 *
 * El saldo es positivos menos negativos de los comentarios a videos que nombran a la persona.
 * Casi todos son negativos porque quienes comentan videos políticos reaccionan al video, no
 * aprueban ni desaprueban a la persona: la página lo dice al pie del gráfico, no en un anexo.
 */
export function ConversationPage() {
  const { summary, filtered, clearFilters, openProfile, updated } = usePeople();
  const { conversation, words } = summary;

  const publishable = filtered.filter((row) => talkState(row) === 'publishable');
  const net: DivergingRow[] = publishable.map((row) => ({
    name: row.name,
    value: netOf(row) ?? 0,
    meta: `${num(row.talk?.analyzed ?? 0)} comentarios en español clasificados`,
  }));

  const channelRows = filtered.filter((row) => channelState(row) === 'publishable');
  const channelNet: DivergingRow[] = channelRows.map((row) => ({
    name: row.name,
    value: channelNetOf(row) ?? 0,
    meta: `${num(row.talk?.channel?.analyzed ?? 0)} comentarios en español clasificados`,
  }));
  const channelPublishable = summary.people.filter(
    (row) => channelState(row) === 'publishable',
  ).length;

  const funnel: ShareSlice[] = [
    { name: 'Personas en el ranking', value: summary.people.length },
    { name: 'Con comentarios leídos', value: conversation.peopleRead },
    { name: 'Con muestra suficiente para publicar', value: conversation.peoplePublishable },
    { name: 'Con muestra suficiente en su propio canal', value: channelPublishable },
  ];
  const wordBars: ShareSlice[] = words
    .slice(0, 15)
    .map((word) => ({ name: word.term, value: word.count }));

  return (
    <>
      <FilterBar compact />

      <Panel
        id="personalidades-saldo"
        title="Saldo de sentimiento en comentarios de YouTube (puntos porcentuales)"
        lede="Positivos menos negativos. Hacia la derecha predominan los comentarios favorables; hacia la izquierda, los adversos."
        meta={`${num(publishable.length)} personas`}
        source={SOURCE}
        updated={updated}
      >
        {net.length ? (
          <>
            <DivergingBars
              data={net}
              unit="puntos"
              signed
              height={Math.max(260, net.length * 30 + 40)}
            />
            <p className={s.footnote}>
              Son reacciones a videos que nombran a la persona: miden cómo comentan quienes los ven,
              no su aprobación ni la opinión de toda Bolivia. {conversation.limits.join(' ')}
            </p>
            <ul className={s.sources}>
              {publishable.slice(0, 12).map((row) => (
                <li key={row.slug}>
                  <a
                    href={`?persona=${row.slug}`}
                    onClick={(event) => {
                      event.preventDefault();
                      openProfile(row.slug);
                    }}
                  >
                    Ficha de {row.name} →
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Empty
            title="Ninguna persona con este filtro tiene sentimiento publicado"
            action={
              <button type="button" className="chip" onClick={clearFilters}>
                Quitar filtros
              </button>
            }
          >
            Solo {num(conversation.peoplePublishable)} de {num(summary.people.length)} personas
            tienen muestra suficiente.
          </Empty>
        )}
      </Panel>

      {channelNet.length ? (
        <Panel
          id="personalidades-canal"
          title="Saldo de sentimiento en su propio canal de YouTube (puntos porcentuales)"
          lede="Positivos menos negativos en los comentarios de los últimos videos del canal de cada creador: es su público, no quienes hablan de él."
          meta={`${num(channelNet.length)} personas`}
          source={SOURCE}
          updated={updated}
        >
          <DivergingBars
            data={channelNet}
            unit="puntos"
            signed
            height={Math.max(220, channelNet.length * 30 + 40)}
          />
          <p className={s.footnote}>
            Es la audiencia que ya sigue al creador y comenta en su canal: suele ser más favorable
            que la conversación sobre la persona y no mide a toda Bolivia. Los creadores cuyo
            contenido está solo en TikTok o Instagram no aparecen: sin sesión iniciada esas
            plataformas no entregan comentarios.
          </p>
        </Panel>
      ) : null}

      <div className="grid-pair">
        <Panel
          id="personalidades-muestra"
          title="Quién tiene muestra suficiente (cantidad de personas)"
          lede={`Para publicar un porcentaje hacen falta ${conversation.minComments} comentarios en español y al menos dos videos con 5 o más.`}
          source={SOURCE}
          updated={updated}
        >
          <ShareBars data={funnel} unit="personas" decimals={0} height={180} />
          <ChartLegend items={[{ color: 'var(--official)', label: 'Cantidad de personas' }]} />
          <p className={s.footnote}>
            La mayoría no sale porque casi no hay videos recientes que las nombren o tienen pocos
            comentarios. {conversation.source}.
          </p>
        </Panel>

        <Panel
          id="personalidades-palabras"
          title="Palabras más repetidas en los comentarios (apariciones)"
          lede="Sumadas entre las personas con muestra suficiente. Una palabra frecuente no es una opinión: puede ser el nombre de quien habla."
          source={SOURCE}
          updated={updated}
        >
          <ShareBars
            data={wordBars}
            unit="apariciones"
            decimals={0}
            height={Math.max(220, wordBars.length * 26)}
          />
          <ChartLegend
            items={[{ color: 'var(--official)', label: 'Apariciones en comentarios en español' }]}
          />
        </Panel>
      </div>
    </>
  );
}

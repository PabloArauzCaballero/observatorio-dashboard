'use client';

import { ChartLegend, ShareBars } from './charts';
import { SOCIAL_SOURCE } from './company-social-source';
import { Panel } from '@/components/ui/panel';
import type { Choice } from '@/lib/choice';
import type { CompanySocialBoard, SocialCompany } from '@/lib/company-social-board';
import { emotionMix, formatMix, hourMix } from '@/lib/company-social-view';

/**
 * Cómo publican y qué despiertan: formato de los posts, hora de publicación y
 * reparto de emociones en los comentarios. Los tres siguen el recorte de la
 * página —red, sector, empresas aisladas— como el resto.
 */

const count = (value: number): string => value.toLocaleString('es-BO');

/** La clave de color bajo cada gráfico de barras: siempre, también con una sola serie. */
const barsKey = (label: string) => <ChartLegend items={[{ color: 'var(--official)', label }]} />;

export function CompanySocialMix({
  board,
  companies,
  slugs,
  platforms,
}: {
  board: CompanySocialBoard;
  companies: readonly SocialCompany[];
  slugs: ReadonlySet<string>;
  platforms: Choice;
}) {
  const formats = formatMix(board.shapes, slugs, platforms);
  const hours = hourMix(board.shapes, slugs, platforms);
  const emotions = emotionMix(companies, platforms);
  const posts = formats.reduce((sum, row) => sum + row.posts, 0);

  return (
    <>
      <Panel
        id="empresas-redes-formato"
        title="Formato de los posts (% de los posts leídos)"
        lede={`${count(posts)} posts de las empresas y redes elegidas; al pasar sobre una barra se ve la mediana de interacciones por post de ese formato.`}
        source={SOCIAL_SOURCE}
      >
        {formats.length ? (
          <>
            <ShareBars
              data={formats.map((row) => ({
                name: row.name,
                value: Number(row.value.toFixed(1)),
                parts: [
                  { name: 'Posts', value: row.posts },
                  { name: 'Mediana de interacciones', value: row.median },
                ],
              }))}
              unit="%"
              height={Math.max(180, formats.length * 40)}
            />
            {barsKey('Parte de los posts leídos que tiene ese formato, en %')}
          </>
        ) : (
          <div className="callout">Sin posts con formato conocido para el recorte.</div>
        )}
      </Panel>

      <Panel
        id="empresas-redes-hora"
        title="Hora de publicación en La Paz (% de los posts con hora)"
        lede={`${count(hours.total)} posts cuya red da la hora exacta (Facebook, TikTok y parte de YouTube); Instagram y LinkedIn solo dan el día y no entran aquí.`}
        source={SOCIAL_SOURCE}
      >
        {hours.total ? (
          <>
            <ShareBars
              data={hours.rows.map((row) => ({
                name: `${String(row.hour).padStart(2, '0')}:00`,
                value: Number(row.value.toFixed(1)),
                parts: [{ name: 'Posts', value: row.posts }],
              }))}
              unit="%"
              height={24 * 22}
            />
            {barsKey('Parte de los posts con hora publicados en esa franja de una hora, en %')}
          </>
        ) : (
          <div className="callout">Ningún post del recorte trae la hora de publicación.</div>
        )}
      </Panel>

      <Panel
        id="empresas-redes-emociones"
        title="Emociones en los comentarios (% de los comentarios clasificados)"
        lede={`${count(emotions.analyzed)} comentarios clasificados con el modelo de emociones de pysentimiento; lo que falta para cien es «otras»: preguntas, saludos, datos.`}
        source={SOCIAL_SOURCE}
      >
        {emotions.rows.length ? (
          <>
            <ShareBars
              data={emotions.rows.map((row) => ({
                name: row.name,
                value: Number(row.value.toFixed(1)),
              }))}
              unit="%"
              height={Math.max(200, emotions.rows.length * 40)}
            />
            {barsKey('Parte de los comentarios clasificados con esa emoción, en %')}
          </>
        ) : (
          <div className="callout">Sin comentarios clasificados para el recorte.</div>
        )}
      </Panel>
    </>
  );
}

'use client';

import { ChartLegend, ShareBars } from './charts';
import { SOCIAL_SOURCE } from './company-social-source';
import { Panel } from '@/components/ui/panel';
import type { Choice } from '@/lib/choice';
import type { CompanySocialBoard, SocialCompany } from '@/lib/company-social-board';
import { formatMix } from '@/lib/company-social-format';
import { emotionMix, hourMix } from '@/lib/company-social-view';

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
      <div className="grid-three">
        <Panel
          id="empresas-redes-formato"
          title="Formato de las publicaciones (% de las publicaciones leídas)"
          lede={`${count(posts)} publicaciones de las empresas y redes seleccionadas. El detalle de cada barra indica la mediana de interacciones y cuántas publicaciones las declaran.`}
          source={SOCIAL_SOURCE}
        >
          {formats.length ? (
            <>
              <ShareBars
                data={formats.map((row) => ({
                  name: row.name,
                  value: Number(row.value.toFixed(1)),
                  parts: [
                    { name: 'Publicaciones', value: row.posts },
                    ...(row.median === null ? [] : [{ name: 'Mediana de interacciones', value: row.median }]),
                    { name: 'Publicaciones con interacciones', value: row.measured },
                  ],
                }))}
                unit="%"
                height={Math.max(180, formats.length * 40)}
              />
              {barsKey('Parte de las publicaciones leídas con ese formato (%)')}
            </>
          ) : (
            <div className="callout">No hay publicaciones para estos filtros.</div>
          )}
        </Panel>

        <Panel
          id="empresas-redes-hora"
          title="Hora de publicación, hora de Bolivia (% de las publicaciones con hora)"
          lede={`${count(hours.total)} publicaciones con hora exacta (Facebook, TikTok y parte de YouTube). Instagram y LinkedIn solo informan el día y quedan fuera del cálculo.`}
          source={SOCIAL_SOURCE}
        >
          {hours.total ? (
            <>
              <ShareBars
                data={hours.rows.map((row) => ({
                  name: `${String(row.hour).padStart(2, '0')}:00`,
                  value: Number(row.value.toFixed(1)),
                  parts: [{ name: 'Publicaciones', value: row.posts }],
                }))}
                unit="%"
                height={24 * 22}
              />
              {barsKey('Parte de las publicaciones con hora publicadas en esa franja horaria (%)')}
            </>
          ) : (
            <div className="callout">Ninguna publicación de la selección informa la hora.</div>
          )}
        </Panel>

        <Panel
          id="empresas-redes-emociones"
          title="Emociones en los comentarios (% de los comentarios clasificados)"
          lede={`${count(emotions.analyzed)} comentarios clasificados con un modelo de detección de emociones en español (pysentimiento). La diferencia hasta 100 % corresponde a «otras»: preguntas, saludos y datos.`}
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
              {barsKey('Parte de los comentarios clasificados con esa emoción (%)')}
            </>
          ) : (
            <div className="callout">No hay comentarios clasificados para estos filtros.</div>
          )}
        </Panel>
      </div>
    </>
  );
}

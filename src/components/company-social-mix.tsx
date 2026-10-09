'use client';

import { ShareBars } from './charts';
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

function BarLegend({ label }: { label: string }) {
  return (
    <ul className="chart-legend">
      <li>
        <span className="chart-legend-mark" style={{ background: 'var(--official)' }} />
        {label}
      </li>
    </ul>
  );
}

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
      <div className="panel">
        <div className="panel-head">
          <h2>Formato de los posts (% de los posts leídos)</h2>
          <p className="panel-sub">
            {count(posts)} posts de las empresas y redes elegidas. Al pasar sobre una barra se ve la mediana de
            interacciones de los posts con cifras de ese formato y el tamaño de esa muestra.
          </p>
        </div>
        {formats.length ? (
          <>
            <ShareBars
              data={formats.map((row) => ({
                name: row.name,
                value: Number(row.value.toFixed(1)),
                parts: [
                  { name: 'Posts', value: row.posts },
                  ...(row.median === null ? [] : [{ name: 'Mediana de interacciones', value: row.median }]),
                  { name: 'Posts con interacciones', value: row.measured },
                ],
              }))}
              unit="%"
              height={Math.max(180, formats.length * 40)}
            />
            <BarLegend label="Parte de los posts leídos que tiene ese formato, en %" />
          </>
        ) : (
          <div className="callout">Sin posts para el recorte.</div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Hora de publicación en La Paz (% de los posts con hora)</h2>
          <p className="panel-sub">
            {count(hours.total)} posts cuya red da la hora exacta (Facebook, TikTok y parte de YouTube). Instagram y
            LinkedIn sólo dan el día y no entran aquí.
          </p>
        </div>
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
            <BarLegend label="Parte de los posts con hora publicados en esa franja de una hora, en %" />
          </>
        ) : (
          <div className="callout">Ningún post del recorte trae la hora de publicación.</div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Emociones en los comentarios (% de los comentarios clasificados)</h2>
          <p className="panel-sub">
            {count(emotions.analyzed)} comentarios clasificados con el modelo de emociones de pysentimiento. Lo que
            falta para cien es «otras»: comentarios sin una emoción marcada (preguntas, saludos, datos).
          </p>
        </div>
        {emotions.rows.length ? (
          <>
            <ShareBars
              data={emotions.rows.map((row) => ({ name: row.name, value: Number(row.value.toFixed(1)) }))}
              unit="%"
              height={Math.max(200, emotions.rows.length * 40)}
            />
            <BarLegend label="Parte de los comentarios clasificados con esa emoción, en %" />
          </>
        ) : (
          <div className="callout">Sin comentarios clasificados para el recorte.</div>
        )}
      </div>
    </>
  );
}

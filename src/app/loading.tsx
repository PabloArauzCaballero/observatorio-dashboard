import { Icon } from '@/components/icons';

/**
 * What the reader sees while the briefing is being built.
 *
 * The page is `force-dynamic` and reads thirteen models in one `Promise.all`,
 * and the first request after a deploy also builds the whole cross-tabulation
 * of the press corpus — minutes of work, once, by design. Until this file
 * existed the browser had nothing to show for that: a white page with no
 * heading, no explanation and no sign that anything was happening, which reads
 * as a site that is down rather than one that is working.
 *
 * Next serves this the instant the request arrives and swaps in the real page
 * when the reads land. It is deliberately the same furniture as the page it
 * stands in for — the same masthead in the same place, panels of the same size
 * where the panels will be — so the arrival is a fill, not a jump.
 *
 * It never states a figure, not even a placeholder digit. A number-shaped grey
 * box is a number a reader can misread as data that has already loaded.
 */
export default function Loading() {
  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="barras" size={19} />
          </span>
          <div>
            <h1>Observatorio Económico de Bolivia</h1>
            <div className="dateline">Situación económica y de los mercados</div>
          </div>
        </div>
        <div className="topbar-stamp">
          <Icon name="reloj" size={14} />
          <span aria-hidden="true">Leyendo la base…</span>
        </div>
      </header>

      <div className="loading-note" role="status" aria-live="polite">
        <span className="loading-spin" aria-hidden="true" />
        <div>
          <b>Armando el tablero</b>
          <span>
            Se leen todas las series y se reconstruye la tabulación del archivo de prensa. La
            primera carga después de un despliegue es la lenta; las siguientes no.
          </span>
        </div>
      </div>

      {/* La forma de lo que va a llegar, sin ninguna cifra dentro. */}
      <div className="stack" aria-hidden="true">
        <div className="panel">
          <div className="skeleton skeleton-head" />
          <div className="skeleton-strip">
            <div className="skeleton skeleton-stat" />
            <div className="skeleton skeleton-stat" />
            <div className="skeleton skeleton-stat" />
            <div className="skeleton skeleton-stat" />
          </div>
        </div>
        <div className="panel">
          <div className="skeleton skeleton-head" />
          <div className="skeleton skeleton-chart" />
        </div>
        <div className="panel">
          <div className="skeleton skeleton-head" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line skeleton-line-short" />
        </div>
      </div>
    </main>
  );
}

import { Sparkline } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { BoardBlock, TodayBoard, Verdict } from '@/lib/today-board';

/**
 * El cuadro de mando, arriba del informe.
 *
 * Es lo primero que se ve y lo unico de esta pagina escrito para alguien que no
 * conoce Bolivia: cinco lecturas, un veredicto por lectura y el umbral que lo
 * decidio, a la vista. Debajo sigue el informe de siempre, con las series con
 * las que se comprueba cada una de las cinco.
 *
 * Lo que esta pantalla NO hace es opinar sin enseñar de donde sale la opinion.
 * Cada tarjeta lleva tres cosas que la hacen discutible: el periodo del dato,
 * el editor que lo publica y la regla que se le aplico. Un lector que no este
 * de acuerdo con el corte puede decir por que; uno al que solo le enseñan el
 * color, no.
 */

const VERDICT_LABEL: Record<Verdict, string> = {
  favorable: 'Favorable',
  vigilar: 'Vigilar',
  adverso: 'Adverso',
  'sin-lectura': 'Sin lectura reciente',
};

/*
 * El color del veredicto sale de la paleta ya validada del informe, no de una
 * terna nueva: `--up` es el rojo con que esta pagina marca lo adverso desde
 * siempre y `--down` el verde azulado de lo favorable. Reusarlos evita dos
 * cosas — inventar contraste sin comprobarlo, y que el mismo hecho salga de un
 * color aqui y de otro tres centimetros mas abajo.
 */
const VERDICT_TONE: Record<Verdict, string> = {
  favorable: 'var(--down)',
  vigilar: 'var(--series-4)',
  adverso: 'var(--up)',
  'sin-lectura': 'var(--ink-faint)',
};

/** Una tarjeta: la cifra, lo que significa y con que regla se juzgo. */
function Block({ block }: { block: BoardBlock }) {
  const tone = VERDICT_TONE[block.verdict];

  return (
    <article className={`board-card board-${block.verdict}`}>
      <div className="board-card-head">
        <span className="board-card-icon">
          <Icon name={block.icon as IconName} size={16} />
        </span>
        <h3>{block.title}</h3>
        <span className="board-verdict">
          <span className="board-dot" aria-hidden="true" />
          {VERDICT_LABEL[block.verdict]}
        </span>
      </div>

      <div className="board-figure">
        <span className="board-value">{block.value}</span>
        <span className="board-unit">{block.unit}</span>
      </div>
      <p className="board-measure">{block.measure}</p>

      {block.spark.length > 1 ? (
        <div className="board-spark">
          <Sparkline data={block.spark} tone={tone} />
        </div>
      ) : null}

      <p className="board-reading">{block.reading}</p>

      {block.facts.length ? (
        <dl className="board-facts">
          {block.facts.map((fact) => (
            <div className="board-fact" key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>
                <b>{fact.value}</b>
                <span>{fact.meta}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/*
        La regla va plegada y no escondida: ocupar cinco lineas en cada tarjeta
        enterraria las cifras, y no publicarla convertiria el semaforo en una
        opinion. `details` la abre sin JavaScript, que es lo que corresponde a
        algo que tiene que poder leerse siempre.
      */}
      <details className="board-rule">
        <summary>¿Por qué este veredicto?</summary>
        <p>{block.rule}</p>
      </details>

      <p className="board-source">
        <span className="board-asof">
          {block.lag > 0 ? `Dato de ${block.asOf}` : `Al ${block.asOf}`}
        </span>
        {block.publisher ? <span> · {block.publisher}</span> : null}
        {block.sourceUrl ? (
          <>
            {' · '}
            <a href={block.sourceUrl} target="_blank" rel="noreferrer noopener">
              fuente
            </a>
          </>
        ) : null}
        <span className="board-goes">Detalle en «{block.goesTo}»</span>
      </p>
    </article>
  );
}

export function TodayBoardPanel({ board }: { board: TodayBoard }) {
  if (!board.blocks.length) return null;

  const adverse = board.blocks.filter((block) => block.verdict === 'adverso').length;
  const judged = board.blocks.filter((block) => block.verdict !== 'sin-lectura').length;

  return (
    <section className="board" aria-labelledby="board-title">
      <div className="tile-head">
        <Icon name="diana" size={17} />
        <h2 id="board-title">Bolivia hoy</h2>
        <span className="tile-hint">
          {adverse} de {judged} lecturas en rojo
        </span>
      </div>
      <p className="board-intro">
        Cinco lecturas para quien llega sin contexto, cada una con el umbral que decide su color a
        la vista. Ninguna es una opinión de este observatorio: son la cifra publicada, su fecha y
        una regla fija que se puede discutir. El detalle de cada una está en las pestañas de abajo.
      </p>

      <div className="board-grid">
        {board.blocks.map((block) => (
          <Block block={block} key={block.key} />
        ))}
      </div>

      {board.changes.length ? (
        <div className="board-news">
          <div className="board-news-head">
            <Icon name="campana" size={15} />
            <h3>Lo que cambió</h3>
            <span className="tile-hint">
              {board.changesDate ? `último día del archivo: ${board.changesDate}` : ''}
              {board.changesOutlets ? ` · ${board.changesOutlets} medios` : ''}
            </span>
          </div>
          <ul className="board-news-list">
            {board.changes.map((change) => (
              <li key={change.id}>
                <a href={change.url} target="_blank" rel="noreferrer noopener">
                  {change.headline}
                </a>
                <div className="board-news-meta">
                  <span className="board-chip">{change.topic}</span>
                  <span>{change.outlet}</span>
                </div>
                {change.summary ? <p>{change.summary}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

import { Sparkline } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import { Panel } from '@/components/ui/panel';
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
        <h4>{block.title}</h4>
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

      {/*
        Las cifras de apoyo y la regla van plegadas juntas, y no escondidas.
        Abiertas, cada tarjeta medía media pantalla de teléfono y las cinco
        empujaban la portada entera cuatro pantallas abajo; la tendencia se lee
        con la cifra, el color y la chispa, y quien quiera discutir el corte lo
        abre. `details` funciona sin JavaScript, que es lo que corresponde a
        algo que tiene que poder leerse siempre.
      */}
      <details className="board-rule">
        <summary>
          {block.facts.length
            ? 'Cifras de apoyo y por qué este veredicto'
            : '¿Por qué este veredicto?'}
        </summary>
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

/**
 * Lo que cambió en la prensa, aparte del cuadro.
 *
 * Estaba dentro de «Bolivia hoy», entre las tendencias y el resto de la
 * portada, y en un teléfono eran seis titulares con su entradilla antes de
 * llegar a una sola cifra más. Sigue en la portada, después de lo que el
 * lector vino a mirar.
 */
export function BoardNews({ board }: { board: TodayBoard }) {
  if (!board.changes.length) return null;
  const outlets = board.changesOutlets;
  return (
    <Panel
      id="lo-que-cambio"
      title="Lo que cambió en la prensa (titulares del último día archivado)"
      meta={board.changesDate ? `día ${board.changesDate}` : undefined}
      source={
        outlets
          ? `${outlets} medios de prensa boliviana, leídos por el Observatorio`
          : 'prensa boliviana, leída por el Observatorio'
      }
      data={{
        unidad: 'titulares',
        columnas: ['Titular', 'Tema', 'Medio', 'Resumen', 'Dirección'],
        filas: board.changes.map((change) => [
          change.headline,
          change.topic,
          change.outlet,
          change.summary ?? null,
          change.url,
        ]),
      }}
      className="board-news"
    >
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
    </Panel>
  );
}

/**
 * «Bolivia hoy»: la cotización del dólar primero y las tendencias después.
 *
 * `lead` es la tarjeta de cotizaciones, que se lee aparte y llega por su propio
 * `Suspense`: el cuadro no la espera, y si su lectura falla el cuadro sigue.
 */
export function TodayBoardPanel({ board, lead }: { board: TodayBoard; lead?: React.ReactNode }) {
  if (!board.blocks.length && !lead) return null;

  const adverse = board.blocks.filter((block) => block.verdict === 'adverso').length;
  const judged = board.blocks.filter((block) => block.verdict !== 'sin-lectura').length;
  const publishers = [...new Set(board.blocks.map((block) => block.publisher).filter(Boolean))];

  return (
    <section className="board" aria-label="Bolivia hoy">
      {lead ?? null}

      {board.blocks.length ? (
        <Panel
          id="lecturas-economia"
          title="Cinco lecturas de la economía de Bolivia (último dato publicado)"
          lede="Cada lectura lleva la cifra publicada, su fecha y una regla fija que decide su color; la regla se abre en cada tarjeta. El detalle está en las pestañas de arriba."
          meta={`${adverse} de ${judged} lecturas en rojo`}
          source={publishers.length ? publishers.join(', ') : 'las que cita cada tarjeta'}
          data={{
            columnas: [
              'Lectura',
              'Veredicto',
              'Cifra',
              'Unidad',
              'Qué mide',
              'Periodo',
              'Regla aplicada',
              'Editor',
              'Dirección de la fuente',
              'Detalle en',
            ],
            filas: board.blocks.map((block) => [
              block.title,
              VERDICT_LABEL[block.verdict],
              block.value,
              block.unit,
              block.measure,
              block.asOf,
              block.rule,
              block.publisher,
              block.sourceUrl,
              block.goesTo,
            ]),
          }}
          className="board-panel"
        >
          <div className="board-grid">
            {board.blocks.map((block) => (
              <Block block={block} key={block.key} />
            ))}
          </div>
        </Panel>
      ) : null}
    </section>
  );
}

'use client';

import { Icon } from './icons';
import type { IconName } from './icons';
import { ANY, additive, multiTitle, picked } from '@/lib/choice';
import { countsFor } from '@/lib/cross-filter';
import type { PressDimension, PressSelection } from '@/lib/cross-filter';
import type { PressCube } from '@/lib/series';

/**
 * The pulse of the coverage: what tone it carries, when, what it keeps naming,
 * and where — every one of them a slicer.
 *
 * These are not four charts beside a filter panel. Each one is counted under
 * every selection except its own, so choosing Santa Cruz rewrites the tone
 * strip to Santa Cruz's tone, the years to Santa Cruz's years and the
 * vocabulary to what Santa Cruz's coverage names, while the department list
 * itself still offers every department so the choice can be undone. That is
 * what a report pane does when you click a bar, and it is the whole reason the
 * page carries a cross-tabulation instead of a set of totals.
 *
 * The panel is careful about what it claims. The tone is a lexicon — it matches
 * words an economist watches and reports which category matched. It cannot read
 * irony, it does not know who is speaking, and a headline quoting someone
 * else's alarm scores as alarm. That is the price of a measure a reader can
 * audit word by word, which a sentiment model's number is not, and the panel
 * says so rather than presenting a score as a fact about the country's mood.
 *
 * El color dice el SIGNO, y el icono y la palabra dicen la categoría.
 *
 * Antes cada una de las ocho categorías tenía su propio tono, y eran ocho tonos
 * para ocho cosas que no son ocho identidades independientes: dos de ellas
 * compartían color con otra, dos más iban en el gris de una nota al margen, y
 * el conjunto pedía al lector que memorizara ocho colores para leer una tira
 * que ya viene rotulada palabra por palabra. Ocho clases de color con sentido
 * es más de las que cualquiera distingue de un vistazo.
 *
 * Ahora las tres categorías adversas comparten el cálido de «adverso», la
 * mejora toma el frío de «a favor», la desinformación toma el ámbar de una
 * señal aparte, la medida tomada el azul de lo administrado, y lo que no es
 * ninguna de esas cosas va en gris. El color pasa a contestar de un vistazo la
 * pregunta que abre el panel —cuánto de la cobertura es adversa— y la categoría
 * exacta la sigue diciendo el rótulo, que es el canal que no falla.
 */

const TONE: Record<string, { label: string; colour: string; icon: IconName; note: string }> = {
  ALARMA: {
    label: 'Alarma',
    colour: 'var(--up)',
    icon: 'campana',
    note: 'escasez, colas, emergencia',
  },
  CONFLICTO: {
    label: 'Conflicto',
    colour: 'var(--up)',
    icon: 'rayo',
    note: 'bloqueos, paros, denuncias',
  },
  DETERIORO: {
    label: 'Deterioro',
    colour: 'var(--up)',
    icon: 'area',
    note: 'caídas, pérdidas, incumplimiento',
  },
  INCERTIDUMBRE: {
    label: 'Incertidumbre',
    colour: 'var(--series-rest)',
    icon: 'info',
    note: 'rumor, presunto, se evalúa',
  },
  MEJORA: {
    label: 'Mejora',
    colour: 'var(--down)',
    icon: 'tendencia',
    note: 'acuerdos, inversión, récords',
  },
  DESINFORMACION: {
    label: 'Desinformación',
    colour: 'var(--series-4)',
    icon: 'escudo',
    note: 'verificado como falso o manipulado',
  },
  MEDIDA: {
    label: 'Medida tomada',
    colour: 'var(--official)',
    icon: 'capas',
    note: 'se anuncia, se crea, se regula',
  },
  NEUTRO: {
    /*
     * «Sin marca» es la ausencia de una categoría, no una categoría: no le
     * toca un color de la serie. Pero tampoco puede leerse como una celda
     * apagada, porque es un resultado del léxico y no un hueco.
     *
     * Por eso `--series-rest`, el gris del «resto» de la paleta, que está
     * medido para leerse (4,6:1). Los dos candidatos obvios fallan por lo
     * mismo: `--rule` es el color de una línea de un pixel y `--ink-faint` el
     * de una nota al margen — en oscuro los dos dejan la celda en apagada.
     *
     * Sin cifras a propósito: el peso de este residuo se movió seis veces en
     * dieciocho días a medida que el léxico ganaba patrones, así que cualquier
     * porcentaje escrito aquí caduca en la siguiente migración. La razón de
     * arriba no depende de cuánto pese.
     */
    label: 'Sin marca',
    colour: 'var(--series-rest)',
    icon: 'cajas',
    note: 'ninguna regla del léxico coincidió',
  },
};

const REGION: Record<string, string> = {
  SANTA_CRUZ: 'Santa Cruz',
  LA_PAZ: 'La Paz',
  COCHABAMBA: 'Cochabamba',
  ORURO: 'Oruro',
  POTOSI: 'Potosí',
  TARIJA: 'Tarija',
  CHUQUISACA: 'Chuquisaca',
  BENI: 'Beni',
  PANDO: 'Pando',
  NACIONAL: 'Sin departamento nombrado',
};

const ORDER = [
  'ALARMA',
  'CONFLICTO',
  'DETERIORO',
  'INCERTIDUMBRE',
  'MEJORA',
  'MEDIDA',
  'DESINFORMACION',
  'NEUTRO',
];

/** The categories that make a year a bad year. */
const ALARMING = new Set(['ALARMA', 'CONFLICTO']);

const percent = (part: number, whole: number): string =>
  `${((part / (whole || 1)) * 100).toLocaleString('es-BO', { maximumFractionDigits: 0 })} %`;

export interface PressPulseProps {
  cube: PressCube;
  selection: PressSelection;
  /** Corpus figures that no selection changes: the span and the mastheads held. */
  span: {
    total: number;
    outlets: number;
    firstDay: string | null;
    lastDay: string | null;
    unmarked: { archive: number; live: number; archiveLength: number; liveLength: number };
  };
  /**
   * Lo que el lector acaba de tocar.
   *
   * `add` dice si el gesto traía un modificador: el panel no decide qué hacer
   * con eso —esa regla vive entera en `toggle`— sólo reporta cómo se tocó.
   */
  onPick: (dimension: PressDimension, value: string, add: boolean) => void;
}

export function PressPulse({ cube, selection, span, onPick }: PressPulseProps) {
  const byTone = countsFor(cube, selection, 'tone');
  const byRegion = countsFor(cube, selection, 'region');
  const byTerm = countsFor(cube, selection, 'term');
  // The years block reads two dimensions at once — how many, and how many of
  // those are alarming — so it is counted with the year left open and the tone
  // read off the rows rather than asked for separately.
  const alarmByYear = (() => {
    const open = { ...selection, tone: ANY };
    const totals = countsFor(cube, open, 'year');
    const alarm = new Map<string, number>();
    for (const tone of ALARMING) {
      for (const [year, count] of countsFor(cube, { ...open, tone: new Set([tone]) }, 'year')) {
        alarm.set(year, (alarm.get(year) ?? 0) + count);
      }
    }
    /*
     * How many mastheads each year was read from.
     *
     * A reader comparing two years is entitled to know whether they are
     * comparing two years or two newspapers: the archive holds four outlets for
     * 2020 and ten for this year, so a thin year can mean a quiet year or a
     * year nobody archived. Counted from the same rows, so it cannot drift.
     */
    const mastheads = new Map<string, Set<number>>();
    for (const row of cube.cells) {
      const year = cube.years[row[0] ?? -1] ?? '';
      const held = mastheads.get(year) ?? new Set<number>();
      held.add(row[4] ?? -1);
      mastheads.set(year, held);
    }

    return [...totals.entries()]
      .filter(([, count]) => count > 0)
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([year, articles]) => ({
        year,
        articles,
        outlets: mastheads.get(year)?.size ?? 0,
        share: ((alarm.get(year) ?? 0) / (articles || 1)) * 100,
      }));
  })();

  const shown = [...byTone.values()].reduce((sum, count) => sum + count, 0);
  const tones = ORDER.filter((key) => (byTone.get(key) ?? 0) > 0);
  const regions = [...byRegion.entries()]
    .filter(([key, count]) => key !== 'NACIONAL' && count > 0)
    .sort((left, right) => right[1] - left[1]);
  const national = byRegion.get('NACIONAL') ?? 0;
  const terms = cube.terms
    .map((entry) => ({ ...entry, mentions: byTerm.get(entry.term) ?? 0 }))
    .filter((entry) => entry.mentions > 0)
    .sort((left, right) => right.mentions - left.mentions);
  const peakTerm = terms[0]?.mentions ?? 1;
  const peakRegion = regions[0]?.[1] ?? 1;
  const peakYear = Math.max(1, ...alarmByYear.map((row) => row.articles));
  // A fixed multiplier saturates: most years sit near 20 %, so ×5 paints them
  // all full. Scaling to the loudest year in the current selection is what makes
  // the comparison between years readable at all.
  const peakShare = Math.max(1, ...alarmByYear.map((row) => row.share));

  return (
    <>
      <div className="panel">
        <div className="tile-head">
          <Icon name="campana" size={17} />
          <h2>Tono de la cobertura</h2>
          <span className="tile-hint">
            {shown.toLocaleString('es-BO')} de {span.total.toLocaleString('es-BO')} notas ·{' '}
            {span.firstDay} → {span.lastDay}
          </span>
        </div>
        <p className="panel-sub" style={{ marginBottom: 'var(--s2)' }}>
          Léxico, no modelo: cada categoría es una lista de palabras que podés revisar. No lee
          ironía ni distingue quién habla — un titular que cita la alarma de otro cuenta como
          alarma. Tocá una y el resto del tablero se filtra con ella; con Ctrl+clic (⌘ en Mac)
          sumás varias y el tablero se queda con las notas de cualquiera de ellas.
        </p>
        <p className="panel-sub" style={{ marginBottom: 'var(--s2)' }}>
          «Sin marca» no quiere decir calma: quiere decir que ninguna palabra de la lista apareció.
          Depende de cuánto texto hay que leer — <b>{span.unmarked.live} %</b> en las notas que
          llegan con entradilla ({span.unmarked.liveLength} caracteres de media) y{' '}
          <b>{span.unmarked.archive} %</b> en las de archivo, que sólo conservan el titular
          reconstruido de su dirección ({span.unmarked.archiveLength} caracteres).
        </p>
        <div className="tone-strip">
          {tones.map((key) => {
            const entry = TONE[key];
            const count = byTone.get(key) ?? 0;
            const on = picked(selection.tone, key);
            return (
              <button
                key={key}
                type="button"
                className={on ? 'tone-cell tone-cell-on' : 'tone-cell'}
                aria-pressed={on}
                title={multiTitle(entry?.label ?? key, on)}
                onClick={(event) => onPick('tone', key, additive(event))}
                style={{ borderTopColor: entry?.colour ?? 'var(--rule)' }}
              >
                <span className="tone-top">
                  <i
                    className="tone-icon"
                    style={{ color: entry?.colour ?? 'var(--ink-soft)' }}
                    aria-hidden="true"
                  >
                    <Icon name={entry?.icon ?? 'cajas'} size={14} />
                  </i>
                  {entry?.label ?? key}
                </span>
                <span className="tone-count">{count.toLocaleString('es-BO')}</span>
                <span className="tone-share">{percent(count, shown)}</span>
                <span className="tone-note">{entry?.note ?? ''}</span>
              </button>
            );
          })}
        </div>
      </div>

      {alarmByYear.length > 1 ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="tendencia" size={17} />
            <h2>Alarma y conflicto por año</h2>
            <span className="tile-hint">{span.outlets} medios</span>
          </div>
          <p className="panel-sub" style={{ marginBottom: 'var(--s2)' }}>
            Porcentaje de la cobertura de cada año que el léxico marca como escasez, colas, bloqueos
            o paros. Tocá un año para quedarte con él. La cifra entre paréntesis es{' '}
            <b>cuántos medios</b> se pudieron leer ese año: un año con menos notas puede ser un año
            tranquilo o un año que nadie archivó, y esa columna dice cuál.
          </p>
          {/*
            Dos marcas llevan sentido en esta lista —la barra de detrás es el
            volumen del año y la de delante su alarma— y ninguna estaba
            nombrada sobre el dibujo: el texto lo contaba, pero un lector que
            baja directo a las barras veía dos rojos y tenía que adivinar cuál
            era cuál.
          */}
          <ul className="chart-legend" style={{ marginBottom: 'var(--s2)' }}>
            <li>
              <span className="chart-legend-mark" style={{ background: 'var(--up)' }} />
              Alarma y conflicto, en % de la cobertura del año
            </li>
            <li>
              <span
                className="chart-legend-mark"
                style={{ background: 'color-mix(in srgb, var(--up) 26%, var(--panel-tint))' }}
              />
              Notas archivadas ese año
            </li>
          </ul>
          <div className="barlist">
            {alarmByYear.map((row) => {
              const on = picked(selection.year, row.year);
              return (
                <button
                  key={row.year}
                  type="button"
                  className={on ? 'barlist-row barlist-row-on' : 'barlist-row'}
                  aria-pressed={on}
                  title={multiTitle(row.year, on)}
                  onClick={(event) => onPick('year', row.year, additive(event))}
                >
                  <Icon name="calendario" size={13} />
                  <span className="barlist-name" style={{ width: 60 }}>
                    {row.year}
                  </span>
                  <span className="barlist-track">
                    {/* The pale bar is the year's volume; the solid one, its alarm. */}
                    <span
                      className="barlist-ghost"
                      style={{ width: `${(row.articles / peakYear) * 100}%` }}
                    />
                    <span
                      className="barlist-fill"
                      style={{
                        width: `${Math.min(100, (row.share / peakShare) * 100)}%`,
                        background: on ? 'var(--ink)' : 'var(--up)',
                      }}
                    />
                  </span>
                  <span className="barlist-n" style={{ width: 152 }}>
                    {row.share.toFixed(1)} % de {row.articles.toLocaleString('es-BO')}{' '}
                    <span className="barlist-aside">({row.outlets})</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid-two">
        <div className="panel">
          <div className="tile-head">
            <Icon name="etiqueta" size={17} />
            <h2>Qué se está nombrando</h2>
            <span className="tile-hint">
              {terms.length} de {cube.terms.length} términos vigilados
            </span>
          </div>
          <p className="panel-sub" style={{ marginBottom: 'var(--s2)' }}>
            Tamaño por número de notas que lo mencionan. Tocá un término y el tablero entero se
            queda con la cobertura que lo nombra; con Ctrl+clic sumás varios. Ojo: una nota que
            nombra dos de los términos elegidos se cuenta dos veces en estas cifras y una sola vez
            en el listado, así que los recuentos pasan a ser un techo.
          </p>
          <div className="term-map">
            {terms.slice(0, 24).map((term) => {
              const weight = term.mentions / peakTerm;
              const on = picked(selection.term, term.term);
              return (
                <button
                  key={term.term}
                  type="button"
                  className={on ? 'term-chip term-chip-on' : 'term-chip'}
                  aria-pressed={on}
                  title={`${term.mentions.toLocaleString('es-BO')} notas lo mencionan — ${multiTitle(
                    term.label,
                    on,
                  )}`}
                  onClick={(event) => onPick('term', term.term, additive(event))}
                  style={{
                    fontSize: `${0.72 + weight * 0.55}rem`,
                    background: on ? 'var(--ink)' : `rgb(27 79 156 / ${0.05 + weight * 0.16})`,
                    borderColor: on ? 'var(--ink)' : `rgb(27 79 156 / ${0.15 + weight * 0.4})`,
                    color: on ? 'var(--panel)' : 'inherit',
                  }}
                >
                  {term.label}
                  <em>{term.mentions.toLocaleString('es-BO')}</em>
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="tile-head">
            <Icon name="globo" size={17} />
            <h2>Dónde ocurre</h2>
            <span className="tile-hint">{regions.length} departamentos</span>
          </div>
          <p className="panel-sub" style={{ marginBottom: 'var(--s2)' }}>
            El departamento que la nota nombra. Las que no nombran ninguno quedan como nacionales,
            en vez de asignarse a la ciudad del medio. Ctrl+clic para comparar varios a la vez.
          </p>
          <div className="barlist">
            {regions.map(([key, count]) => {
              const on = picked(selection.region, key);
              return (
                <button
                  key={key}
                  type="button"
                  className={on ? 'barlist-row barlist-row-on' : 'barlist-row'}
                  aria-pressed={on}
                  title={multiTitle(REGION[key] ?? key, on)}
                  onClick={(event) => onPick('region', key, additive(event))}
                >
                  <Icon name="globo" size={13} />
                  <span className="barlist-name">{REGION[key] ?? key}</span>
                  <span className="barlist-track">
                    <span
                      className="barlist-fill"
                      style={{
                        width: `${(count / peakRegion) * 100}%`,
                        background: on ? 'var(--ink)' : 'var(--official)',
                      }}
                    />
                  </span>
                  <span className="barlist-n">{count.toLocaleString('es-BO')}</span>
                </button>
              );
            })}
          </div>
          <p className="panel-sub" style={{ marginTop: 'var(--s2)', marginBottom: 0 }}>
            {national.toLocaleString('es-BO')} notas no nombran ningún departamento y no aparecen en
            la lista.
          </p>
        </div>
      </div>
    </>
  );
}

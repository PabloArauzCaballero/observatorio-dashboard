'use client';

import { Icon } from './icons';
import type { IconName } from './icons';
import { countsFor } from '@/lib/cross-filter';
import type { PressSelection } from '@/lib/cross-filter';
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
 * Colour is the signal. Alarm and conflict take the two warning hues the report
 * already uses for a rising gap; improvement takes the falling one. A reader
 * who has learned the palette on the exchange-rate charts reads this strip
 * without a legend.
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
    colour: 'var(--parallel)',
    icon: 'rayo',
    note: 'bloqueos, paros, denuncias',
  },
  DETERIORO: {
    label: 'Deterioro',
    colour: 'var(--gap)',
    icon: 'area',
    note: 'caídas, pérdidas, incumplimiento',
  },
  INCERTIDUMBRE: {
    label: 'Incertidumbre',
    colour: 'var(--ink-faint)',
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
    colour: 'var(--official)',
    icon: 'escudo',
    note: 'verificado como falso o manipulado',
  },
  NEUTRO: {
    label: 'Sin marca',
    colour: 'var(--rule)',
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
  span: { total: number; outlets: number; firstDay: string | null; lastDay: string | null };
  onPick: (dimension: keyof PressSelection, value: string) => void;
}

export function PressPulse({ cube, selection, span, onPick }: PressPulseProps) {
  const byTone = countsFor(cube, selection, 'tone');
  const byRegion = countsFor(cube, selection, 'region');
  const byTerm = countsFor(cube, selection, 'term');
  // The years block reads two dimensions at once — how many, and how many of
  // those are alarming — so it is counted with the year left open and the tone
  // read off the rows rather than asked for separately.
  const alarmByYear = (() => {
    const open = { ...selection, tone: 'TODOS' };
    const totals = countsFor(cube, open, 'year');
    const alarm = new Map<string, number>();
    for (const tone of ALARMING) {
      for (const [year, count] of countsFor(cube, { ...open, tone }, 'year')) {
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
          alarma. Tocá una y el resto del tablero se filtra con ella.
        </p>
        <div className="tone-strip">
          {tones.map((key) => {
            const entry = TONE[key];
            const count = byTone.get(key) ?? 0;
            const on = selection.tone === key;
            return (
              <button
                key={key}
                type="button"
                className={on ? 'tone-cell tone-cell-on' : 'tone-cell'}
                onClick={() => onPick('tone', on ? 'TODOS' : key)}
                style={{ borderTopColor: entry?.colour ?? 'var(--rule)' }}
              >
                <span className="tone-top" style={{ color: entry?.colour ?? 'var(--ink-soft)' }}>
                  <Icon name={entry?.icon ?? 'cajas'} size={14} />
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
          <div className="barlist">
            {alarmByYear.map((row) => {
              const on = selection.year === row.year;
              return (
                <button
                  key={row.year}
                  type="button"
                  className={on ? 'barlist-row barlist-row-on' : 'barlist-row'}
                  onClick={() => onPick('year', on ? 'TODOS' : row.year)}
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
            queda con la cobertura que lo nombra.
          </p>
          <div className="term-map">
            {terms.slice(0, 24).map((term) => {
              const weight = term.mentions / peakTerm;
              const on = selection.term === term.term;
              return (
                <button
                  key={term.term}
                  type="button"
                  className={on ? 'term-chip term-chip-on' : 'term-chip'}
                  title={`${term.mentions.toLocaleString('es-BO')} notas lo mencionan`}
                  onClick={() => onPick('term', on ? 'TODOS' : term.term)}
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
            en vez de asignarse a la ciudad del medio.
          </p>
          <div className="barlist">
            {regions.map(([key, count]) => {
              const on = selection.region === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={on ? 'barlist-row barlist-row-on' : 'barlist-row'}
                  onClick={() => onPick('region', on ? 'TODOS' : key)}
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

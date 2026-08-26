'use client';

import { Icon } from './icons';
import type { IconName } from './icons';
import type { PressPulseData, TermMention } from '@/lib/series';

/**
 * The pulse of the coverage: what tone it carries, what it keeps naming, where.
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
 *
 * The term map sizes by mentions and shades by how many mastheads carry it,
 * because those are different facts: a term one paper repeats is that paper's
 * campaign; a term six papers use is the country's conversation.
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

const percent = (part: number, whole: number): string =>
  `${((part / (whole || 1)) * 100).toLocaleString('es-BO', { maximumFractionDigits: 0 })} %`;

export interface PressPulseProps {
  pulse: PressPulseData;
  terms: TermMention[];
  tone: string;
  region: string;
  onTone: (value: string) => void;
  onRegion: (value: string) => void;
}

export function PressPulse({ pulse, terms, tone, region, onTone, onRegion }: PressPulseProps) {
  // Counted in the database over the whole corpus, not in the browser over the
  // page of stories it happens to hold.
  const byTone = new Map<string, number>();
  for (const row of pulse.toneByYear) {
    byTone.set(row.tone, (byTone.get(row.tone) ?? 0) + row.articles);
  }
  const byRegion = new Map(pulse.regions.map((row) => [row.region, row.articles]));
  const total = pulse.total || 1;

  /** Alarm as a share of each year, which is the shape a reader is looking for. */
  const alarmByYear = (() => {
    const totals = new Map<string, number>();
    const alarm = new Map<string, number>();
    for (const row of pulse.toneByYear) {
      totals.set(row.year, (totals.get(row.year) ?? 0) + row.articles);
      if (row.tone === 'ALARMA' || row.tone === 'CONFLICTO') {
        alarm.set(row.year, (alarm.get(row.year) ?? 0) + row.articles);
      }
    }
    return [...totals.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([year, count]) => ({
        year,
        share: ((alarm.get(year) ?? 0) / (count || 1)) * 100,
        articles: count,
      }));
  })();
  const tones = ORDER.filter((key) => byTone.has(key));
  const regions = [...byRegion.entries()]
    .filter(([key]) => key !== 'NACIONAL')
    .sort((left, right) => right[1] - left[1]);
  const national = byRegion.get('NACIONAL') ?? 0;
  const peakTerm = terms[0]?.mentions ?? 1;
  const peakRegion = regions[0]?.[1] ?? 1;

  return (
    <>
      <div className="panel">
        <div className="tile-head">
          <Icon name="campana" size={17} />
          <h2>Tono de la cobertura</h2>
          <span className="tile-hint">
            {pulse.total.toLocaleString('es-BO')} notas · {pulse.firstDay} → {pulse.lastDay}
          </span>
        </div>
        <p className="panel-sub" style={{ marginBottom: 'var(--s2)' }}>
          Léxico, no modelo: cada categoría es una lista de palabras que podés revisar. No lee
          ironía ni distingue quién habla — un titular que cita la alarma de otro cuenta como
          alarma. Tocá una para filtrar.
        </p>
        <div className="tone-strip">
          {tones.map((key) => {
            const entry = TONE[key];
            const count = byTone.get(key) ?? 0;
            const on = tone === key;
            return (
              <button
                key={key}
                type="button"
                className={on ? 'tone-cell tone-cell-on' : 'tone-cell'}
                onClick={() => onTone(on ? 'TODOS' : key)}
                style={{
                  borderTopColor: entry?.colour ?? 'var(--rule)',
                  background: on ? 'var(--panel-tint)' : 'var(--panel)',
                }}
              >
                <span className="tone-top" style={{ color: entry?.colour ?? 'var(--ink-soft)' }}>
                  <Icon name={entry?.icon ?? 'cajas'} size={14} />
                  {entry?.label ?? key}
                </span>
                <span className="tone-count">{count}</span>
                <span className="tone-share">{percent(count, total)}</span>
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
            <span className="tile-hint">{pulse.outlets} medios</span>
          </div>
          <p className="panel-sub" style={{ marginBottom: 'var(--s2)' }}>
            Porcentaje de la cobertura de cada año que el léxico marca como escasez, colas, bloqueos
            o paros. Es lo que seis años de archivo permiten ver y cuatro meses de feed no.
          </p>
          <div className="barlist">
            {alarmByYear.map((row) => (
              <div className="barlist-row" key={row.year}>
                <Icon name="calendario" size={13} />
                <span className="barlist-name" style={{ width: 60 }}>
                  {row.year}
                </span>
                <span className="barlist-track">
                  <span
                    className="barlist-fill"
                    style={{
                      width: `${Math.min(100, row.share * 5)}%`,
                      background: 'var(--up)',
                    }}
                  />
                </span>
                <span className="barlist-n" style={{ width: 108 }}>
                  {row.share.toFixed(1)} % de {row.articles.toLocaleString('es-BO')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid-two">
        <div className="panel">
          <div className="tile-head">
            <Icon name="etiqueta" size={17} />
            <h2>Qué se está nombrando</h2>
            <span className="tile-hint">{terms.length} términos vigilados</span>
          </div>
          <p className="panel-sub" style={{ marginBottom: 'var(--s2)' }}>
            Tamaño por menciones; el número entre paréntesis es cuántos medios lo dicen. Un término
            que repite un solo diario es su campaña; uno que dicen seis es la conversación del país.
          </p>
          <div className="term-map">
            {terms.slice(0, 22).map((term) => {
              const weight = term.mentions / peakTerm;
              return (
                <span
                  key={term.term}
                  className="term-chip"
                  title={`${term.mentions} menciones en ${term.outlets} medios`}
                  style={{
                    fontSize: `${0.72 + weight * 0.55}rem`,
                    background: `rgb(27 79 156 / ${0.05 + (term.outlets / 7) * 0.16})`,
                    borderColor: `rgb(27 79 156 / ${0.15 + (term.outlets / 7) * 0.4})`,
                  }}
                >
                  {term.label}
                  <em>{term.outlets}</em>
                </span>
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
            {regions.map(([key, count]) => (
              <button
                key={key}
                type="button"
                className="barlist-row"
                onClick={() => onRegion(region === key ? 'TODOS' : key)}
                style={{
                  appearance: 'none',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  font: 'inherit',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <Icon name="globo" size={13} />
                <span className="barlist-name">{REGION[key] ?? key}</span>
                <span className="barlist-track">
                  <span
                    className="barlist-fill"
                    style={{
                      width: `${(count / peakRegion) * 100}%`,
                      background: region === key ? 'var(--ink)' : 'var(--official)',
                    }}
                  />
                </span>
                <span className="barlist-n">{count}</span>
              </button>
            ))}
          </div>
          <p className="panel-sub" style={{ marginTop: 'var(--s2)', marginBottom: 0 }}>
            {national} notas no nombran un departamento.
          </p>
        </div>
      </div>
    </>
  );
}

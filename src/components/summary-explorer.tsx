'use client';

import { useMemo, useState } from 'react';
import { GapChart, Sparkline } from './charts';
import type { GapChartPoint } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { AnalysisBullet } from '@/lib/daily-analysis';

/**
 * The landing panel, under the same docked rail as every other section.
 *
 * It used to be the one tab with no controls at all: a fixed set of figures
 * over the whole history, which is the right default and the wrong only
 * option — the gap ran from 157 % to under 1 %, so "the period" is exactly the
 * question a reader arrives with. The period is now a slicer, and the figures,
 * the chart and the extremes all answer for the window chosen rather than for
 * a window nobody picked.
 *
 * The rail's second block is not a filter: it is what the observatory holds,
 * stated where the filters are so the reader can see the base a selection is
 * being drawn from.
 */

export interface SummaryFigure {
  label: string;
  value: string;
  unit?: string;
  meta?: string;
  spark?: number[];
  tone?: string;
  icon: IconName;
}

export interface SummaryExplorerProps {
  gap: GapChartPoint[];
  figures: SummaryFigure[];
  coverage: ReadonlyArray<{ label: string; count: string; icon: IconName }>;
  analysis: AnalysisBullet[];
  latestDate: string | null;
  /** The dollar-linked markets, rendered by the caller that reads them. */
  markets?: React.ReactNode;
}

const RANGES: ReadonlyArray<{ key: string; label: string; days: number | null }> = [
  { key: '90d', label: '90 días', days: 90 },
  { key: '1a', label: '1 año', days: 365 },
  { key: '2a', label: '2 años', days: 730 },
  { key: 'todo', label: 'Todo', days: null },
];

const percent = (value: number): string =>
  `${value > 0 ? '+' : ''}${value.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;

export function SummaryExplorer({
  gap,
  figures,
  coverage,
  analysis,
  latestDate,
  markets,
}: SummaryExplorerProps) {
  const [range, setRange] = useState('todo');

  const shown = useMemo(() => {
    const days = RANGES.find((entry) => entry.key === range)?.days ?? null;
    const last = gap.at(-1)?.date;
    if (days === null || !last) return gap;
    const cut = new Date(`${last}T12:00:00Z`);
    cut.setUTCDate(cut.getUTCDate() - days);
    const floor = cut.toISOString().slice(0, 10);
    return gap.filter((point) => point.date >= floor);
  }, [gap, range]);

  /** The extremes of the window on screen, not of the whole history. */
  const peak = useMemo(
    () =>
      shown.reduce<GapChartPoint | null>(
        (best, point) => (!best || point.gapPercent > best.gapPercent ? point : best),
        null,
      ),
    [shown],
  );
  const trough = useMemo(
    () =>
      shown.reduce<GapChartPoint | null>(
        (best, point) => (!best || point.gapPercent < best.gapPercent ? point : best),
        null,
      ),
    [shown],
  );

  /**
   * What the chosen window contains, said where the window is chosen.
   *
   * The period slicer sat above a pane that never reported back: a reader could
   * pick "90 días" and the rail said nothing about what those ninety days held.
   * The span, the extremes and the movement across them are the first four
   * things anyone asks of a window, and they cost nothing to state.
   */
  const first = shown.at(0);
  const last = shown.at(-1);
  const move = first && last ? last.gapPercent - first.gapPercent : null;

  return (
    <div className="workspace">
      <aside className="rail">
        <div className="rail-top">
          <Icon name="diana" size={15} />
          <span className="rail-title">Panorama</span>
          <span className="rail-count">{range === 'todo' ? 'todo' : '1 activo'}</span>
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="calendario" size={13} />
            Periodo
          </div>
          <div className="rail-pills">
            {RANGES.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={range === entry.key ? 'chip chip-on' : 'chip'}
                onClick={() => setRange(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        {first && last ? (
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="area" size={13} />
              En esta ventana
            </div>
            <div className="rail-fact">
              <Icon name="calendario" size={16} />
              <span className="rail-name">Jornadas</span>
              <span className="rail-n">{shown.length.toLocaleString('es-BO')}</span>
            </div>
            <div className="rail-fact">
              <Icon name="tendencia" size={16} />
              <span className="rail-name">Máxima</span>
              <span className="rail-n">{peak ? percent(peak.gapPercent) : '—'}</span>
            </div>
            <div className="rail-fact">
              <Icon name="area" size={16} />
              <span className="rail-name">Mínima</span>
              <span className="rail-n">{trough ? percent(trough.gapPercent) : '—'}</span>
            </div>
            <div className="rail-fact">
              <Icon name="pulso" size={16} />
              <span className="rail-name">Movimiento</span>
              <span
                className={
                  move === null ? 'rail-n' : move >= 0 ? 'rail-n delta-up' : 'rail-n delta-down'
                }
              >
                {move === null
                  ? '—'
                  : `${move > 0 ? '+' : ''}${move.toLocaleString('es-BO', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })} pts`}
              </span>
            </div>
            <p className="rail-note">
              {first.date} → {last.date}
            </p>
          </div>
        ) : null}

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="capas" size={13} />
            Lo que guarda el observatorio
          </div>
          {coverage.map((row) => (
            <div className="rail-fact" key={row.label}>
              <Icon name={row.icon} size={16} />
              <span className="rail-name">{row.label}</span>
              <span className="rail-n">{row.count}</span>
            </div>
          ))}
        </div>

        <div className="rail-foot">
          Cada cifra guarda la <b>huella</b> del documento del que se leyó.
          {latestDate ? (
            <>
              <br />
              Último dato: <b>{latestDate}</b>
            </>
          ) : null}
        </div>
      </aside>

      <div className="workspace-main" id="tablero" tabIndex={-1}>
        <div className="figures">
          {figures.map((figure) => (
            <div className="figure" key={figure.label}>
              <div className="label">
                <Icon name={figure.icon} size={12} /> {figure.label}
              </div>
              <div>
                <span className="value">{figure.value}</span>
                {figure.unit ? <span className="unit">{figure.unit}</span> : null}
              </div>
              {figure.meta ? <div className="meta">{figure.meta}</div> : null}
              {figure.spark && figure.spark.length > 1 ? (
                <Sparkline data={figure.spark} tone={figure.tone ?? 'var(--ink-faint)'} />
              ) : null}
            </div>
          ))}
        </div>

        {markets ?? null}

        <div className="panel">
          <div className="tile-head">
            <Icon name="area" size={17} />
            <h2>Brecha cambiaria</h2>
            <span className="tile-hint">
              {shown.length.toLocaleString('es-BO')} días con ambas cotizaciones
            </span>
          </div>
          <p className="panel-sub" style={{ marginBottom: 'var(--s2)' }}>
            Porcentaje sobre el oficial, contra el punto medio del paralelo
          </p>
          {shown.length >= 2 ? (
            <GapChart data={shown} tall />
          ) : (
            <div className="callout">
              La brecha solo puede calcularse en los días con ambas cotizaciones.
            </div>
          )}
          {peak && trough && peak.date !== trough.date ? (
            <div
              style={{
                display: 'flex',
                marginTop: '0.5rem',
                fontFamily: 'var(--mono)',
                fontSize: '0.72rem',
                color: 'var(--ink-faint)',
              }}
            >
              <span>
                máx {percent(peak.gapPercent)} · {peak.date}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                mín {percent(trough.gapPercent)} · {trough.date}
              </span>
            </div>
          ) : null}
        </div>

        <div className="analysis">
          <div className="tile-head">
            <Icon name="sigma" size={17} />
            <h2>Análisis del día</h2>
            <span className="tile-hint">derivado, no redactado</span>
          </div>
          <p className="analysis-note">
            Derivado de las observaciones, no redactado: cada cifra procede de las series de este
            informe y se recalcula con cada carga.
          </p>
          <ul className="bullets">
            {analysis.map((bullet) => (
              <li className="bullet" key={bullet.key}>
                <span className={`bullet-mark bullet-mark-${bullet.tone}`}>
                  <Icon name={bullet.icon as IconName} size={16} />
                </span>
                <div className="bullet-body">
                  <div className="bullet-line">
                    <b className="bullet-label">{bullet.label}</b>
                    <span className={`bullet-value bullet-value-${bullet.tone}`}>
                      {bullet.value}
                    </span>
                  </div>
                  <p className="bullet-detail">{bullet.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

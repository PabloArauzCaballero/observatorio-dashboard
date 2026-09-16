/**
 * A state that reads the same to everyone.
 *
 * Every badge carries a word and a mark as well as a colour, because a console
 * whose only difference between «al día» and «atrasada» is a hue is unusable by
 * the eight per cent of men who cannot tell those two hues apart — and unusable
 * by anyone at all in a printed report or a black-and-white screenshot.
 *
 * `unknown` is its own tone and its own word. It is not a warning and it is not
 * a success: it is the absence of evidence, and rendering it as either of the
 * other two is the specific lie this portal exists to stop telling.
 */
export type Tone = 'ok' | 'warn' | 'bad' | 'unknown';

const MARK: Record<Tone, string> = {
  ok: '●',
  warn: '▲',
  bad: '■',
  unknown: '○',
};

export function StateBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`state state-${tone}`} data-mark={MARK[tone]} data-tone={tone}>
      {label}
    </span>
  );
}

/** How the core's freshness verdicts read on screen. */
export function freshnessTone(state: string): Tone {
  if (state === 'on_time') return 'ok';
  if (state === 'late') return 'bad';
  if (state === 'not_applicable') return 'unknown';
  return 'unknown';
}

export const FRESHNESS_LABEL: Record<string, string> = {
  on_time: 'Al día',
  late: 'Atrasada',
  not_applicable: 'No aplica',
  unknown: 'Sin evidencia',
};

/** How an execution or a run status reads on screen. */
export function runTone(status: string): Tone {
  if (status === 'SUCCEEDED') return 'ok';
  if (status === 'PARTIAL' || status === 'RUNNING' || status === 'QUEUED') return 'warn';
  if (status === 'FAILED' || status === 'ABANDONED') return 'bad';
  return 'unknown';
}

export function qualityTone(status: string): Tone {
  if (status === 'PASS') return 'ok';
  if (status === 'WARNING') return 'warn';
  if (status === 'FAIL' || status === 'ERROR') return 'bad';
  return 'unknown';
}

export const RUN_LABEL: Record<string, string> = {
  QUEUED: 'En cola',
  RUNNING: 'En curso',
  SUCCEEDED: 'Terminada',
  PARTIAL: 'Parcial',
  FAILED: 'Fallida',
  CANCELLED: 'Cancelada',
  ABANDONED: 'Abandonada',
};

export const QUALITY_LABEL: Record<string, string> = {
  PASS: 'Cumple',
  WARNING: 'Advertencia',
  FAIL: 'Incumple',
  ERROR: 'Error',
  NOT_EVALUATED: 'Sin evaluar',
  NOT_APPLICABLE: 'No aplica',
};

'use client';

import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import type { TreemapNode } from 'recharts';
import { additive } from '@/lib/choice';
import { Icon } from './icons';
import type { IconName } from './icons';

/**
 * El mismo dato en otra forma, a elección de quien lee.
 *
 * Un gráfico de líneas contesta «cómo cambió», uno de barras «quién va
 * primero» y uno de cuadrados «cuánto del total se lleva cada uno». Son tres
 * preguntas distintas sobre las mismas filas, y el tablero elegía una por el
 * lector. El selector va en la cabecera de cada panel, como en una hoja de
 * cálculo: cambia ese gráfico y ningún otro, y no toca los filtros.
 */

export type ChartKind = 'lineas' | 'barras' | 'cuadrados';

const KIND_LABEL: Record<ChartKind, { label: string; icon: IconName }> = {
  lineas: { label: 'Líneas', icon: 'linea' },
  barras: { label: 'Barras', icon: 'barras' },
  cuadrados: { label: 'Cuadrados', icon: 'cajas' },
};

export function ChartKindSwitch({
  value,
  onChange,
  kinds = ['lineas', 'barras', 'cuadrados'],
}: {
  value: ChartKind;
  onChange: (kind: ChartKind) => void;
  kinds?: readonly ChartKind[];
}) {
  return (
    <div className="chart-kind" role="group" aria-label="Tipo de gráfico">
      {kinds.map((kind) => (
        <button
          key={kind}
          type="button"
          className={kind === value ? 'chip chip-on' : 'chip'}
          aria-pressed={kind === value}
          onClick={() => onChange(kind)}
        >
          <Icon name={KIND_LABEL[kind].icon} size={13} />
          {KIND_LABEL[kind].label}
        </button>
      ))}
    </div>
  );
}

export interface SquareSlice {
  name: string;
  value: number;
  /** El valor de filtro que representa, si tocarlo filtra. */
  pick?: string;
  /** Va marcado: está elegido en el filtro. */
  emphasis?: boolean;
}

/**
 * Los cinco pasos de la rampa de magnitud, con su tinta emparejada.
 *
 * Los mismos que el mapa departamental y la retícula de calor: el área ya dice
 * cuánto, el color lo repite para que dos cuadrados de tamaño parecido no se
 * tengan que medir a ojo, y la tinta viaja con el paso porque en modo oscuro
 * la rampa se ancla al revés.
 */
const STEPS = [
  { fill: 'var(--seq-200)', ink: 'var(--seq-ink-1)' },
  { fill: 'var(--seq-300)', ink: 'var(--seq-ink-2)' },
  { fill: 'var(--seq-400)', ink: 'var(--seq-ink-3)' },
  { fill: 'var(--seq-500)', ink: 'var(--seq-ink-4)' },
  { fill: 'var(--seq-600)', ink: 'var(--seq-ink-5)' },
] as const;

const say = (value: number, decimals: number): string =>
  value.toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/**
 * Un gráfico de cuadrados: cada fila es un rectángulo con área proporcional
 * a su valor, y el rótulo dice también qué parte del total es.
 *
 * El porcentaje es sobre lo dibujado, no sobre el total del país: si el lector
 * eligió tres socios, los tres suman cien. El título del panel lo dice.
 */
export function ShareSquares({
  data,
  unit,
  height = 360,
  onPick,
}: {
  data: readonly SquareSlice[];
  unit: string;
  height?: number;
  onPick?: (value: string, additive: boolean) => void;
}) {
  const rows = data.filter((row) => row.value > 0).sort((left, right) => right.value - left.value);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const peak = rows[0]?.value ?? 0;
  const marked = rows.some((row) => row.emphasis);
  const decimals = peak >= 100 ? 0 : 1;

  if (!rows.length) return <div className="callout">Sin valores positivos para dibujar.</div>;

  const stepOf = (value: number) =>
    STEPS[Math.min(STEPS.length - 1, Math.floor((value / (peak || 1)) * STEPS.length))] ?? STEPS[0];

  const renderCell = (node: TreemapNode) => {
    if (node.depth !== 1) return <g />;
    const row = rows[node.index];
    if (!row) return <g />;
    const step = stepOf(row.value);
    const share = total > 0 ? (row.value / total) * 100 : 0;
    const roomy = node.width > 70 && node.height > 34;
    const tall = node.height > 50;
    const clickable = Boolean(onPick && row.pick);
    return (
      <g
        className={clickable ? 'square square-pick' : 'square'}
        {...(clickable
          ? {
              onClick: (event: React.MouseEvent) => onPick?.(row.pick as string, additive(event)),
            }
          : {})}
      >
        <rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={3}
          style={{
            fill: step.fill,
            opacity: marked && !row.emphasis ? 0.45 : 1,
          }}
          className={row.emphasis ? 'square-rect square-on' : 'square-rect'}
        />
        {roomy ? (
          <text x={node.x + 7} y={node.y + 17} className="square-name" style={{ fill: step.ink }}>
            {row.name.length * 6.6 > node.width - 12
              ? `${row.name.slice(0, Math.max(3, Math.floor((node.width - 12) / 6.6) - 1))}…`
              : row.name}
          </text>
        ) : null}
        {roomy && tall ? (
          <text x={node.x + 7} y={node.y + 34} className="square-value" style={{ fill: step.ink }}>
            {say(row.value, decimals)} · {say(share, 1)} %
          </text>
        ) : null}
      </g>
    );
  };

  return (
    <div className="chart-frame" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={rows.map((row) => ({ ...row }))}
          dataKey="value"
          nameKey="name"
          aspectRatio={4 / 3}
          isAnimationActive={false}
          content={renderCell}
        >
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as SquareSlice | undefined;
              if (!point) return null;
              const share = total > 0 ? (point.value / total) * 100 : 0;
              return (
                <div className="tooltip">
                  <div className="t-date">{point.name}</div>
                  <div className="t-row">
                    <span>Valor</span>
                    <strong>
                      {say(point.value, 1)} {unit}
                    </strong>
                  </div>
                  <div className="t-row">
                    <span>Parte de lo dibujado</span>
                    <strong>{say(share, 1)} %</strong>
                  </div>
                  {point.pick && onPick ? (
                    <div className="t-note">Tocá para filtrar por este.</div>
                  ) : null}
                </div>
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}

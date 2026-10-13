'use client';

import { useState } from 'react';
import { useDatosDeFigura, celda } from '@/components/ui/panel-data';
import type { PersonRow } from '@/lib/people-types';
import { histogram, num, scatterPoints, sectorLabel } from './people-model';
import s from './people.module.css';

/** «1.500» → «1,5 mil»; «2.300.000» → «2,3 M»: ejes cortos para que quepan en un teléfono. */
const short = (value: number): string => {
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString('es-BO', { maximumFractionDigits: 1 })} M`;
  if (value >= 1_000)
    return `${(value / 1_000).toLocaleString('es-BO', { maximumFractionDigits: 1 })} mil`;
  return value.toLocaleString('es-BO');
};

const W = 640;
const H = 360;
const M = { top: 12, right: 16, bottom: 44, left: 64 };

/**
 * Visitas a Wikipedia frente a audiencia verificada, las dos en escala logarítmica.
 *
 * Un solo color para el conjunto y una marca para quien se eligió: ocho sectores no caben
 * en una paleta que se pueda distinguir bajo daltonismo, y el sector ya está en los
 * filtros. Quien no tiene las dos cifras no se dibuja en la nube: se cuenta debajo, para
 * que ausente no se lea como «cero».
 */
export function PeopleScatter({
  rows,
  selectedSlug,
  onPick,
}: {
  rows: readonly PersonRow[];
  selectedSlug: string | null | undefined;
  onPick: (slug: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const points = scatterPoints(rows);
  useDatosDeFigura(
    () => ({
      etiqueta: 'Dispersión',
      unidad: 'visitas en 12 meses y seguidores',
      columnas: ['Nombre', 'Sector', 'Visitas a Wikipedia (12 meses)', 'Seguidores verificados'],
      filas: points.map((p) => [p.name, sectorLabel(p.sector), celda(p.views), celda(p.followers)]),
    }),
    [points],
  );

  if (points.length < 2) {
    return null;
  }
  const lx = points.map((p) => Math.log10(p.views));
  const ly = points.map((p) => Math.log10(p.followers));
  const x0 = Math.floor(Math.min(...lx));
  const x1 = Math.max(x0 + 1, Math.ceil(Math.max(...lx)));
  const y0 = Math.floor(Math.min(...ly));
  const y1 = Math.max(y0 + 1, Math.ceil(Math.max(...ly)));
  const px = (value: number) =>
    M.left + ((Math.log10(value) - x0) / (x1 - x0)) * (W - M.left - M.right);
  const py = (value: number) =>
    H - M.bottom - ((Math.log10(value) - y0) / (y1 - y0)) * (H - M.top - M.bottom);
  const xs = Array.from({ length: x1 - x0 + 1 }, (_, i) => 10 ** (x0 + i));
  const ys = Array.from({ length: y1 - y0 + 1 }, (_, i) => 10 ** (y0 + i));
  const shown = points.find((p) => p.slug === (hover ?? selectedSlug));

  return (
    <svg
      className={s.plot}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Dispersión de ${num(points.length)} personas: visitas a Wikipedia en el eje horizontal y seguidores verificados en el vertical, ambos en escala logarítmica.`}
    >
      {ys.map((value) => (
        <g key={`y${value}`}>
          <line className={s.plotGrid} x1={M.left} x2={W - M.right} y1={py(value)} y2={py(value)} />
          <text className={s.plotText} x={M.left - 8} y={py(value) + 4} textAnchor="end">
            {short(value)}
          </text>
        </g>
      ))}
      {xs.map((value) => (
        <g key={`x${value}`}>
          <line className={s.plotGrid} x1={px(value)} x2={px(value)} y1={M.top} y2={H - M.bottom} />
          <text className={s.plotText} x={px(value)} y={H - M.bottom + 16} textAnchor="middle">
            {short(value)}
          </text>
        </g>
      ))}
      <line
        className={s.plotAxis}
        x1={M.left}
        x2={W - M.right}
        y1={H - M.bottom}
        y2={H - M.bottom}
      />
      <text className={s.plotText} x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle">
        Visitas a Wikipedia en 12 meses (escala logarítmica)
      </text>
      <text
        className={s.plotText}
        transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`}
        textAnchor="middle"
      >
        Seguidores verificados (log)
      </text>
      {points.map((p) => (
        <circle
          key={p.slug}
          className={p.slug === selectedSlug ? `${s.plotDot} ${s.plotOn}` : s.plotDot}
          cx={px(p.views)}
          cy={py(p.followers)}
          r={p.slug === selectedSlug ? 6 : 4}
          onMouseEnter={() => setHover(p.slug)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onPick(p.slug)}
        >
          <title>{`${p.name}: ${num(p.views)} visitas, ${num(p.followers)} seguidores`}</title>
        </circle>
      ))}
      {shown ? (
        <text
          className={s.plotName}
          x={Math.min(px(shown.views) + 9, W - M.right - 4)}
          y={py(shown.followers) - 9}
          textAnchor={px(shown.views) > W - 160 ? 'end' : 'start'}
        >
          {shown.name}
        </text>
      ) : null}
    </svg>
  );
}

/** Cuántas personas hay en cada tramo de 10 puntos del índice; el de la persona elegida resalta. */
export function IndexHistogram({
  rows,
  selected,
}: {
  rows: readonly PersonRow[];
  selected: PersonRow | null | undefined;
}) {
  const bins = histogram(rows);
  useDatosDeFigura(
    () => ({
      etiqueta: 'Distribución',
      unidad: 'personas',
      columnas: ['Desde', 'Hasta', 'Personas'],
      filas: bins.map((bin) => [bin.from, bin.to, bin.count]),
    }),
    [bins],
  );
  const peak = Math.max(...bins.map((bin) => bin.count), 1);
  const BW = 640;
  const BH = 220;
  const pad = { top: 22, bottom: 30, left: 8, right: 8 };
  const step = (BW - pad.left - pad.right) / bins.length;
  const mark = selected?.measured ? Math.min(bins.length - 1, Math.floor(selected.score / 10)) : -1;

  return (
    <svg
      className={s.plot}
      viewBox={`0 0 ${BW} ${BH}`}
      role="img"
      aria-label={`Cuántas personas hay en cada tramo de 10 puntos del índice, de 0 a 100. El tramo más poblado tiene ${num(peak)}.`}
    >
      <line
        className={s.plotAxis}
        x1={pad.left}
        x2={BW - pad.right}
        y1={BH - pad.bottom}
        y2={BH - pad.bottom}
      />
      {bins.map((bin, index) => {
        const height = (bin.count / peak) * (BH - pad.top - pad.bottom);
        const x = pad.left + index * step + 3;
        const dim = mark >= 0 && index !== mark;
        return (
          <g key={bin.from}>
            <rect
              className={dim ? s.barDim : s.bar}
              x={x}
              y={BH - pad.bottom - height}
              width={step - 6}
              height={height}
              rx={3}
            />
            <text
              className={s.plotText}
              x={x + (step - 6) / 2}
              y={BH - pad.bottom - height - 5}
              textAnchor="middle"
            >
              {bin.count}
            </text>
            <text className={s.plotText} x={x + (step - 6) / 2} y={BH - 10} textAnchor="middle">
              {bin.from}–{bin.to}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

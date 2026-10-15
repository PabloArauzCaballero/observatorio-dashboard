'use client';

import { useId, useMemo, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Panel } from '@/components/ui/panel';
import { celda } from '@/components/ui/panel-data';
import { ViewToggle } from '@/components/ui/view-toggle';
import { downloadCsv } from '@/lib/csv';
import { asFamilyData } from '@/lib/exogenous-board-adapter';
import type { ExogenousSeries } from '@/lib/exogenous-board';
import { yearOf } from '@/lib/exogenous-board';
import {
  compareFactorSeries, FactorComparisonError, type FactorComparisonMode,
} from '@/lib/exogenous-factor-comparison';
import { sourcesOf } from './exogenous-table';

const FREQUENCY: Record<string, string> = { MONTHLY: 'mensual', ANNUAL: 'anual' };
const format = (value: number) =>
  new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 }).format(value);

const label = (one: ExogenousSeries) =>
  `${one.name.includes(one.market) ? one.name : `${one.name} (${one.market})`} · ${one.unit} · ${FREQUENCY[one.frequency] ?? one.frequency}`;

/**
 * Dos lecturas cualesquiera frente a frente, aunque una sea mensual y la otra anual.
 *
 * Si las frecuencias difieren, la más frecuente se promedia al período de la más gruesa y el
 * panel lo dice; nunca se interpola. La base 100 permite comparar unidades distintas (dólares
 * por tonelada y bolivianos por quintal); «Niveles» exige la misma unidad.
 */
export function ExogenousCompare({
  all, listed, from, to,
}: {
  all: readonly ExogenousSeries[];
  listed: readonly ExogenousSeries[];
  from: number;
  to: number;
}) {
  const id = useId();
  const [left, setLeft] = useState(listed[0]?.code ?? all[0]?.code ?? '');
  const [right, setRight] = useState(listed[1]?.code ?? all[1]?.code ?? '');
  const [mode, setMode] = useState<FactorComparisonMode>('BASE100');
  const byCode = useMemo(() => new Map(all.map((one) => [one.code, one])), [all]);
  const groups = useMemo(() => {
    const out = new Map<string, ExogenousSeries[]>();
    for (const one of all) out.set(one.productLabel, [...(out.get(one.productLabel) ?? []), one]);
    return [...out];
  }, [all]);

  const outcome = useMemo(() => {
    const a = byCode.get(left);
    const b = byCode.get(right);
    if (!a || !b || a.code === b.code) return { error: 'La comparación necesita dos lecturas distintas.' };
    const slice = (one: ExogenousSeries) => {
      const data = asFamilyData(one);
      return {
        ...data,
        points: data.points.filter((p) => yearOf(p.period) >= from && yearOf(p.period) <= to),
      };
    };
    const A = slice(a);
    const B = slice(b);
    try {
      const result = compareFactorSeries({
        leftSeries: A.series, rightSeries: B.series, leftPoints: A.points, rightPoints: B.points, mode,
      });
      return { result, a, b };
    } catch (error) {
      return { error: error instanceof FactorComparisonError ? error.message : 'No se pudo comparar.' };
    }
  }, [byCode, left, right, mode, from, to]);

  const select = (value: string, set: (code: string) => void, name: string) => (
    <label style={{ display: 'grid', gap: 4 }}>
      {name}
      <select value={value} onChange={(event) => set(event.target.value)}>
        {groups.map(([group, members]) => (
          <optgroup key={group} label={group}>
            {members.map((one) => <option key={one.code} value={one.code}>{label(one)}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );

  const result = 'result' in outcome ? outcome.result : null;
  const a = 'a' in outcome ? outcome.a : null;
  const b = 'b' in outcome ? outcome.b : null;
  const error = 'error' in outcome ? outcome.error : null;
  const dataset = () => result && a && b ? {
    unidad: result.unit,
    columnas: ['Periodo', a.name, b.name],
    filas: result.points.map((point) => [point.period, celda(point.left), celda(point.right)]),
    nota: result.description,
  } : undefined;

  return (
    <Panel
      id="exogenas-comparar"
      title="Comparación de dos lecturas (índice base 100 o unidad común)"
      lede={`Si una lectura es mensual y la otra anual, la mensual se promedia por año, sin interpolar. Período: ${from}–${to}, según el filtro de años.`}
      source={a && b ? sourcesOf([a, b]) : 'sin publicador declarado (ver «Método»)'}
      data={dataset}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {select(left, setLeft, 'Primera lectura')}
        {select(right, setRight, 'Segunda lectura')}
        <label htmlFor={`${id}-mode`} style={{ display: 'grid', gap: 4 }}>
          Forma de comparar
          <select
            id={`${id}-mode`}
            value={mode}
            onChange={(event) => setMode(event.target.value as FactorComparisonMode)}
          >
            <option value="BASE100">Base 100 · primer período común</option>
            <option value="LEVEL">Niveles · misma unidad</option>
          </select>
        </label>
      </div>
      {error ? <div className="callout" role="alert">{error}</div> : null}
      {result && a && b ? (
        <>
          <p className="panel-note">{result.description}</p>
          {result.warnings.filter((w) => /promedió/.test(w)).map((w) => (
            <p key={w} className="panel-note">{w}</p>
          ))}
          {result.points.length ? (
            <ViewToggle
              label="Vista de la comparación"
              chart={
                <div
                  role="img"
                  aria-label={`Comparación de ${a.name} y ${b.name}, en ${result.unit}. Los valores están en la vista Tabla.`}
                  style={{ width: '100%', height: 320, minWidth: 0 }}
                >
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={result.points} margin={{ top: 15, right: 20, bottom: 15, left: 10 }} accessibilityLayer>
                      <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="period" tick={{ fill: 'var(--ink-soft)', fontSize: 11 }} minTickGap={35} axisLine={false} tickLine={false} />
                      <YAxis width={64} tick={{ fill: 'var(--ink-soft)', fontSize: 11 }} tickFormatter={(value: number) => format(value)} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: 'var(--panel)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                        formatter={(value, name) => [typeof value === 'number' ? `${format(value)} ${result.unit}` : 'Sin dato', name]}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="left" name={a.name} stroke="var(--series-1)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="right" name={b.name} stroke="var(--series-2)" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              }
              table={
                <div className="table-wrap" style={{ maxHeight: 480, overflow: 'auto' }}>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => downloadCsv(
                      `comparacion_${a.code}_${b.code}.csv`,
                      ['periodo', a.name, b.name],
                      result.points.map((point) => [point.period, point.left, point.right]),
                    )}
                  >
                    Descargar CSV de la comparación
                  </button>
                  <table className="grid-table">
                    <caption style={{ textAlign: 'left' }}>
                      {result.points.length} períodos, en {result.unit}. Una celda vacía es un período sin dato; no se rellena.
                    </caption>
                    <thead>
                      <tr><th>Período</th><th className="num">{a.name}</th><th className="num">{b.name}</th></tr>
                    </thead>
                    <tbody>
                      {[...result.points].reverse().map((point) => (
                        <tr key={point.period}>
                          <th scope="row" style={{ textAlign: 'left', fontWeight: 500 }}>{point.period}</th>
                          <td className="num">{point.left === null ? '' : format(point.left)}</td>
                          <td className="num">{point.right === null ? '' : format(point.right)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            />
          ) : (
            <div className="callout">No hay períodos comparables en los años elegidos.</div>
          )}
        </>
      ) : null}
    </Panel>
  );
}

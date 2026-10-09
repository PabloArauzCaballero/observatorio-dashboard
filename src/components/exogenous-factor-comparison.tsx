'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  compareFactorSeries, FactorComparisonError,
  type FactorComparisonMode, type FactorComparisonResult,
} from '@/lib/exogenous-factor-comparison';
import type { FactorHistoryResponse, FactorObservation, FactorSeries } from '@/lib/exogenous-factor-types';
import { ViewToggle } from './ui/view-toggle';
import styles from './exogenous-factors.module.css';

const MAX_POINTS = 20_000;
const FREQUENCIES: Record<string, string> = { DAILY: 'Diaria', WEEKLY: 'Semanal', MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', ANNUAL: 'Anual' };
const format = (value: number) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 4 }).format(value);
class ComparisonFetchError extends Error {}

interface CompleteSeries { series: FactorSeries; points: FactorObservation[]; warnings: string[] }
interface ComparisonRequest {
  left: string; right: string; from: string; to: string;
  asOf: string; chosenDate: string; mode: FactorComparisonMode;
}
interface ComparisonState {
  key: string; result: FactorComparisonResult | null;
  left: FactorSeries | null; right: FactorSeries | null;
  warnings: string[]; progress: [number, number]; error: string | null;
}

/** Nunca compara páginas parciales: la misma fecha de conocimiento fija ambas consultas. */
async function completeHistory(
  code: string, request: ComparisonRequest, signal: AbortSignal, progress: (count: number) => void,
): Promise<CompleteSeries> {
  const params = new URLSearchParams({ series: code, from: request.from, to: request.to, asOf: request.asOf, pageSize: '500' });
  const points = new Map<string, FactorObservation>();
  const warnings = new Set<string>();
  const cursors = new Set<string>();
  let metadata: FactorSeries | null = null;
  for (let page = 0; page < MAX_POINTS / 500; page += 1) {
    const response = await fetch(`/api/exogenas/factores?${params}`, { signal });
    if (!response.ok) throw new ComparisonFetchError('No se pudo completar una de las series. Reintenta la consulta.');
    const body = await response.json() as FactorHistoryResponse;
    if (signal.aborted) throw new DOMException('Consulta cancelada', 'AbortError');
    if (metadata && (
      metadata.unit !== body.series.unit || metadata.frequency !== body.series.frequency || metadata.measureType !== body.series.measureType ||
      metadata.geography !== body.series.geography || metadata.observationStatus !== body.series.observationStatus ||
      metadata.measurementStatus !== body.series.measurementStatus || metadata.transformationType !== body.series.transformationType
    )) {
      throw new ComparisonFetchError('La definición de una serie cambió entre páginas. Reintenta para obtener una lectura consistente.');
    }
    metadata = body.series;
    for (const point of body.points) {
      if (points.has(point.period)) throw new ComparisonFetchError('El histórico repite un período entre páginas. Reintenta para comparar una sola revisión por período.');
      points.set(point.period, point);
    }
    body.warnings.forEach((warning) => warnings.add(warning));
    progress(points.size);
    if (!body.nextCursor) return { series: metadata, points: [...points.values()].sort((a, b) => a.period.localeCompare(b.period)), warnings: [...warnings] };
    if (cursors.has(body.nextCursor)) throw new ComparisonFetchError('No se pudo completar la paginación. La comparación no se presenta con datos parciales.');
    cursors.add(body.nextCursor);
    params.set('cursor', body.nextCursor);
  }
  throw new ComparisonFetchError(`La consulta supera el límite de ${format(MAX_POINTS)} observaciones por serie. Reduce el período para comparar.`);
}

function Source({ series }: { series: FactorSeries }) {
  let url: string | null = null;
  try { const parsed = new URL(series.sourceUrl); if (['https:', 'http:'].includes(parsed.protocol)) url = parsed.href; } catch { /* No se inventa un enlace ausente. */ }
  return <span>{series.name}: {url ? <a href={url} target="_blank" rel="noopener noreferrer">{series.publisher || 'Fuente'} ↗</a> : series.publisher || 'Sin enlace de fuente'}</span>;
}

export function ExogenousFactorComparison({ series, initialCode }: { series: FactorSeries[]; initialCode: string }) {
  const id = useId();
  const thisYear = new Date().getFullYear();
  const [draft, setDraft] = useState({
    left: initialCode, right: series.find((item) => item.code !== initialCode)?.code ?? '',
    from: '2000', to: String(thisYear), asOf: '', mode: 'BASE100' as FactorComparisonMode,
  });
  const [request, setRequest] = useState<ComparisonRequest | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [validation, setValidation] = useState('');
  const [state, setState] = useState<ComparisonState>({ key: '', result: null, left: null, right: null, warnings: [], progress: [0, 0], error: null });
  const key = useMemo(() => `${JSON.stringify(request)}|${attempt}`, [request, attempt]);

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    setState({ key, result: null, left: null, right: null, warnings: [], progress: [0, 0], error: null });
    const progress = (index: 0 | 1) => (count: number) => {
      if (!controller.signal.aborted) setState((old) => {
        if (old.key !== key) return old;
        const next: [number, number] = [...old.progress];
        next[index] = count;
        return { ...old, progress: next };
      });
    };
    Promise.all([
      completeHistory(request.left, request, controller.signal, progress(0)),
      completeHistory(request.right, request, controller.signal, progress(1)),
    ]).then(([left, right]) => {
      if (controller.signal.aborted) return;
      const result = compareFactorSeries({ leftSeries: left.series, rightSeries: right.series, leftPoints: left.points, rightPoints: right.points, mode: request.mode });
      setState({ key, result, left: left.series, right: right.series, progress: [left.points.length, right.points.length], warnings: [...new Set([...left.warnings, ...right.warnings, ...result.warnings])], error: null });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      controller.abort();
      setState((old) => old.key === key ? { ...old, error: error instanceof FactorComparisonError || error instanceof ComparisonFetchError ? error.message : 'No se pudo preparar la comparación. Reintenta la consulta.' } : old);
    });
    return () => controller.abort();
  }, [request, key]);

  if (series.length < 2) return null;
  const current = state.key === key;
  const result = current ? state.result : null;
  const error = current ? state.error : null;
  const loading = request !== null && (!current || (!state.result && !state.error));
  const update = <K extends keyof typeof draft>(field: K, value: typeof draft[K]) => {
    setDraft((old) => ({ ...old, [field]: value }));
    setValidation('');
  };

  return <details className={styles.comparison}>
    <summary>Comparar dos series de esta familia</summary>
    <div className={styles.comparisonBody}>
      <p className={styles.muted}>Se comparan dos series con la misma frecuencia, sin interpolar ni convertir unidades. La base o el cambio se calculan desde un período común. Los controles de esta comparación son independientes del gráfico individual.</p>
      <form className={styles.comparisonForm} onSubmit={(event) => {
        event.preventDefault();
        if (!draft.left || !draft.right || draft.left === draft.right) { setValidation('Selecciona dos series distintas.'); return; }
        const from = Number(draft.from); const to = Number(draft.to);
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1900 || from > to || to > thisYear + 1) {
          setValidation('Revisa el período: el año inicial debe ser anterior o igual al final.'); return;
        }
        if (draft.asOf && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.asOf) || draft.asOf > new Date().toISOString().slice(0, 10))) {
          setValidation('La fecha de corte debe ser válida y no puede estar en el futuro.'); return;
        }
        setValidation('');
        const asOf = new Date(draft.asOf ? Math.min(Date.parse(`${draft.asOf}T23:59:59.999Z`), Date.now()) : Date.now()).toISOString();
        setRequest({ left: draft.left, right: draft.right, from: draft.from, to: draft.to, chosenDate: draft.asOf, asOf, mode: draft.mode });
        setAttempt((value) => value + 1);
      }}>
        <label htmlFor={`${id}-left`}>Primera serie<select id={`${id}-left`} value={draft.left} onChange={(event) => update('left', event.target.value)}>{series.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.unit} · {FREQUENCIES[item.frequency] ?? item.frequency}</option>)}</select></label>
        <label htmlFor={`${id}-right`}>Segunda serie<select id={`${id}-right`} value={draft.right} onChange={(event) => update('right', event.target.value)}>{series.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.unit} · {FREQUENCIES[item.frequency] ?? item.frequency}</option>)}</select></label>
        <label htmlFor={`${id}-mode`}>Forma de comparar<select id={`${id}-mode`} value={draft.mode} onChange={(event) => update('mode', event.target.value as FactorComparisonMode)}>
          <option value="BASE100">Base 100 · período común positivo</option><option value="LEVEL">Niveles · misma unidad y medida</option><option value="CHANGE">Cambio absoluto · tasas y proporciones</option>
        </select></label>
        <div className={styles.comparisonRange}>
          <label htmlFor={`${id}-from`}>Comparar desde (año)<input id={`${id}-from`} type="number" min="1900" max={thisYear + 1} required value={draft.from} onChange={(event) => update('from', event.target.value)} /></label>
          <label htmlFor={`${id}-to`}>Comparar hasta (año)<input id={`${id}-to`} type="number" min="1900" max={thisYear + 1} required value={draft.to} onChange={(event) => update('to', event.target.value)} /></label>
          <label htmlFor={`${id}-asof`}>Corte común de información<input id={`${id}-asof`} type="date" max={new Date().toISOString().slice(0, 10)} value={draft.asOf} onChange={(event) => update('asOf', event.target.value)} /></label>
        </div>
        <p className={styles.muted}>Sin fecha, ambas consultas usan el mismo instante de conocimiento actual. Con fecha, el corte es al final del día en UTC; si eliges hoy, se limita al instante de la consulta. Tasas y proporciones requieren cambios absolutos; no se convierten a base 100.</p>
        <button type="submit" className={styles.button}>Comparar series</button>
      </form>
      {validation && <p className={styles.error} role="alert">{validation}</p>}
      {loading && <p className={styles.loading} role="status"><span className="loading-spin" aria-hidden="true" />Completando ambos históricos… {current ? `${format(state.progress[0])} / ${format(state.progress[1])} observaciones recibidas` : ''}</p>}
      {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" className={styles.button} onClick={() => setAttempt((value) => value + 1)}>Reintentar comparación</button></div>}
      {result && state.left && state.right && request && <>
        <div className={styles.comparisonCaption}><h4>Comparación · {result.unit}</h4><p>{result.description}</p>
          <p>Período solicitado: {request.from}–{request.to}. Corte común efectivo: {request.asOf.replace('T', ' ').replace('Z', ' UTC')}.</p>
          {result.basePeriod && <p><strong>Base común: {result.basePeriod}</strong>. Primera serie: {result.leftBaseValue === null ? 'Sin dato' : format(result.leftBaseValue)} {state.left.unit}; segunda: {result.rightBaseValue === null ? 'Sin dato' : format(result.rightBaseValue)} {state.right.unit}.</p>}
          <p>{format(result.points.length)} períodos comparados. Históricos completos consultados: {format(state.progress[0])} y {format(state.progress[1])} observaciones.</p>
        </div>
        {state.warnings.length > 0 && <div className={styles.warning} role="status"><strong>Alcance de la comparación</strong><ul>{state.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
        {result.points.length > 0 ? <>
          <ViewToggle label="Vista de la comparación" chart={<div className={styles.chart} role="img" aria-label={`Comparación de ${state.left.name} y ${state.right.name}, en ${result.unit}. ${result.basePeriod ? `Base común ${result.basePeriod}.` : ''} Los valores están en la vista Tabla.`}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={result.points} margin={{ top: 15, right: 20, bottom: 15, left: 10 }} accessibilityLayer>
                <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: 'var(--ink-soft)', fontSize: 11 }} minTickGap={35} axisLine={false} tickLine={false} />
                <YAxis width={74} tick={{ fill: 'var(--ink-soft)', fontSize: 11 }} tickFormatter={(value: number) => format(value)} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--rule)', color: 'var(--ink)' }} formatter={(value, name) => [typeof value === 'number' ? `${format(value)} ${result.unit}` : 'Sin dato', name]} />
                <Legend formatter={(name) => <span className={styles.comparisonLegend}>{name}</span>} />
                <Line type="linear" dataKey="left" name={state.left.name} stroke="var(--series-1)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                <Line type="linear" dataKey="right" name={state.right.name} stroke="var(--series-2)" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>} table={<div className={styles.tableScroll}><table>
            <caption>Últimos {Math.min(result.points.length, 100)} períodos comparados, en {result.unit}. Las descargas individuales conservan los datos originales.</caption>
            <thead><tr><th scope="col">Período</th><th scope="col">{state.left.name}</th><th scope="col">{state.right.name}</th></tr></thead>
            <tbody>{result.points.slice(-100).map((point) => <tr key={point.period}><th scope="row">{point.period}</th><td>{point.left === null ? 'Sin dato' : format(point.left)}</td><td>{point.right === null ? 'Sin dato' : format(point.right)}</td></tr>)}</tbody>
          </table></div>} />
        </> : <p className={styles.empty}>No hay períodos comparables dentro del rango y corte seleccionados.</p>}
        <div className={styles.comparisonSources}><Source series={state.left} /><Source series={state.right} /></div>
      </>}
    </div>
  </details>;
}

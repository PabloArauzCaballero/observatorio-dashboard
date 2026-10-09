'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type {
  FactorCatalogueResponse, FactorFamily, FactorHistoryResponse, FactorObservation,
  FactorSeries, FactorSeriesResponse,
} from '@/lib/exogenous-factor-types';
import { ExogenousFactorComparison } from './exogenous-factor-comparison';
import { ViewToggle } from './ui/view-toggle';
import styles from './exogenous-factors.module.css';

const ROLES: Record<string, string> = {
  EXTERNO_CANDIDATO: 'Factor externo candidato',
  EXTERNO_CONDICIONAL: 'Externo sujeto a condiciones',
  EXPOSICION: 'Exposición',
  CONDICIONANTE: 'Condicionante o transmisión',
  RESULTADO: 'Resultado local',
  EVENTO_LOCAL_ENDOGENO: 'Evento local',
  POLITICA_LOCAL: 'Política local',
  POR_DEFINIR_SEGUN_OBJETIVO: 'Rol por definir según objetivo',
};
const FREQUENCIES: Record<string, string> = {
  DAILY: 'Diaria', WEEKLY: 'Semanal', MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', ANNUAL: 'Anual',
};
const STATUSES: Record<string, string> = {
  OBSERVED: 'Observado', OBSERVATION: 'Observación', AVAILABLE: 'Disponible',
  PROVISIONAL: 'Provisional', REVISED: 'Revisado', MISSING: 'Sin observación',
  ESTIMATED: 'Estimado', DERIVED: 'Derivado', FINAL: 'Definitivo',
  STALE: 'Sin actualización reciente', SOURCE_ERROR: 'Fuente no disponible',
  UNKNOWN: 'Sin estado declarado', RESEARCH: 'En investigación',
  PROXY: 'Medida aproximada', DIRECT: 'Medición directa',
  OUTCOME: 'Resultado local', EXPOSURE: 'Exposición', TRANSMISSION: 'Transmisión',
  EXTERNAL_DRIVER: 'Factor externo', EXTERNAL_CONDITIONAL: 'Externo sujeto a condiciones',
  CONDITIONING: 'Condicionante', CONDITION: 'Condicionante', POLICY: 'Política',
};
const number = (value: number) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 4 }).format(value);
const label = (value: string) => ROLES[value.toUpperCase()] ?? STATUSES[value.toUpperCase()] ?? value.replaceAll('_', ' ').toLowerCase();
const today = () => new Date().toISOString().slice(0, 10);

function safeSource(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : undefined;
  } catch { return undefined; }
}

function SourceLink({ url, children = 'Consultar fuente' }: { url?: string | null; children?: React.ReactNode }) {
  const href = safeSource(url);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children} ↗</a> : null;
}

async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('No se pudo consultar la información. Intenta nuevamente.');
  return response.json() as Promise<T>;
}

/** La clave evita mostrar datos de una selección anterior antes de que corra el efecto. */
function useRemote<T>(url: string) {
  const [attempt, setAttempt] = useState(0);
  const key = `${url}|${attempt}`;
  const [state, setState] = useState<{ key: string; data: T | null; error: boolean }>({ key: '', data: null, error: false });
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, data: null, error: false });
    readJson<T>(url, controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ key, data, error: false });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ key, data: null, error: true });
    });
    return () => controller.abort();
  }, [url, key]);
  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current && state.error,
    loading: !current || (!state.data && !state.error),
    retry: () => setAttempt((n) => n + 1),
  };
}

function Notice({ loading, error, retry }: { loading?: boolean; error?: boolean; retry?: () => void }) {
  if (error) return <div className={styles.error} role="alert">
    <span>No se pudo leer esta información. Puedes volver a intentarlo.</span>
    {retry && <button type="button" className={styles.button} onClick={retry}>Reintentar</button>}
  </div>;
  return loading ? <p className={styles.loading} role="status"><span className="loading-spin" aria-hidden="true" /> Consultando información…</p> : null;
}

function Warnings({ values }: { values: string[] }) {
  if (!values.length) return null;
  return <div className={styles.warning} role="status"><strong>Sobre la disponibilidad</strong>
    <ul>{[...new Set(values)].map((warning) => <li key={warning}>{warning}</li>)}</ul>
  </div>;
}

interface Filters { q: string; sector: string; mechanism: string; availability: string; priority: string; role: string }
const INITIAL_FILTERS: Filters = { q: '', sector: '', mechanism: '', availability: '', priority: '', role: '' };

export function ExogenousFactorsExplorer() {
  const uid = useId();
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FactorFamily | null>(null);
  const [options, setOptions] = useState<Pick<FactorCatalogueResponse, 'sectors' | 'mechanisms'> | null>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '24' });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return `/api/exogenas/catalogo?${params}`;
  }, [filters, page]);
  const catalogue = useRemote<FactorCatalogueResponse>(query);
  useEffect(() => {
    if (catalogue.data) setOptions({ sectors: catalogue.data.sectors, mechanisms: catalogue.data.mechanisms });
  }, [catalogue.data]);
  useEffect(() => {
    if (selected) detailHeading.current?.focus({ preventScroll: true });
  }, [selected]);

  const change = (key: keyof Filters, value: string) => {
    setFilters((old) => ({ ...old, [key]: value }));
    setPage(1);
    setSelected(null);
  };
  const reset = () => { setFilters(INITIAL_FILTERS); setSearch(''); setPage(1); setSelected(null); };
  const data = catalogue.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const activeFilters = Object.values(filters).some(Boolean);

  return <div className={styles.root}>
    <header className={`panel ${styles.intro}`}>
      <div><p className={styles.eyebrow}>Bolivia · sectores y mercados</p>
        <h2>Qué factores afectan a cada sector</h2>
        <p className="panel-sub">Explora condiciones externas, exposición y resultados locales. Cada familia explica el canal económico y distingue las series consultables de las necesidades de investigación.</p>
      </div>
      {data && <dl className={styles.coverage} aria-label="Cobertura del catálogo">
        <div><dt>Familias en catálogo</dt><dd>{number(data.coverage.families)}</dd></div>
        <div><dt>Con series vinculadas</dt><dd>{number(data.coverage.linkedFamilies)}</dd></div>
        <div><dt>Series vinculadas</dt><dd>{number(data.coverage.series)}</dd></div>
      </dl>}
    </header>

    <section className={`panel ${styles.filterPanel}`} aria-label="Filtros del catálogo">
      <form className={styles.search} onSubmit={(event) => { event.preventDefault(); change('q', search.trim()); }}>
        <label htmlFor={`${uid}-search`}>Buscar variable, mercado o canal</label>
        <div><input id={`${uid}-search`} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ej. sequía, transporte, medicamentos…" maxLength={200} />
          <button type="submit" className={styles.primary}>Buscar</button></div>
      </form>
      <div className={styles.filters}>
        <label htmlFor={`${uid}-sector`}>Sector económico
          <select id={`${uid}-sector`} value={filters.sector} onChange={(e) => change('sector', e.target.value)}>
            <option value="">Todos los sectores</option>
            {(options?.sectors ?? []).map((sector) => <option key={sector.id} value={sector.id}>{sector.id} · {sector.label}</option>)}
          </select>
        </label>
        <label htmlFor={`${uid}-mechanism`}>Canal de transmisión
          <select id={`${uid}-mechanism`} value={filters.mechanism} onChange={(e) => change('mechanism', e.target.value)}>
            <option value="">Todos los canales</option>
            {(options?.mechanisms ?? []).map((mechanism) => <option key={mechanism} value={mechanism}>{label(mechanism)}</option>)}
          </select>
        </label>
        <label htmlFor={`${uid}-availability`}>Disponibilidad
          <select id={`${uid}-availability`} value={filters.availability} onChange={(e) => change('availability', e.target.value)}>
            <option value="">Todo el catálogo</option>
            <option value="available">Con series vinculadas</option>
            <option value="research">Investigación · sin series vinculadas</option>
          </select>
        </label>
      </div>
      <details className={styles.advanced} open={Boolean(filters.priority || filters.role) || undefined}>
        <summary>Prioridad y rol económico</summary>
        <div className={styles.filters}>
          <label htmlFor={`${uid}-priority`}>Prioridad de evaluación
            <select id={`${uid}-priority`} value={filters.priority} onChange={(e) => change('priority', e.target.value)}>
              <option value="">Todas las prioridades</option><option value="P0">P0 · Primera evaluación</option>
              <option value="P1">P1 · Segunda evaluación</option><option value="P2">P2 · Investigación posterior</option>
            </select>
          </label>
          <label htmlFor={`${uid}-role`}>Rol respecto al objetivo
            <select id={`${uid}-role`} value={filters.role} onChange={(e) => change('role', e.target.value)}>
              <option value="">Todos los roles</option>
              {Object.entries(ROLES).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
            </select>
          </label>
        </div>
        <p className={styles.muted}>La prioridad ordena la evaluación; no garantiza datos disponibles. El rol depende de qué resultado se quiera explicar.</p>
      </details>
      {activeFilters && <button type="button" className={styles.linkButton} onClick={reset}>Limpiar filtros</button>}
    </section>

    <Notice loading={catalogue.loading} error={catalogue.error} retry={catalogue.retry} />
    {data && <>
      <Warnings values={data.warnings} />
      {selected && <section className={`panel ${styles.detail}`} aria-labelledby={`${uid}-detail`}>
        <div className={styles.detailTop}><div><p className={styles.eyebrow}>{selected.id} · {selected.sectorLabel}</p>
          <h3 id={`${uid}-detail`} ref={detailHeading} tabIndex={-1}>{selected.name}</h3></div>
          <button type="button" className={styles.button} onClick={() => setSelected(null)}>Cerrar detalle</button></div>
        <FamilyDetail key={`${selected.id}|${filters.sector}`} family={selected} sector={filters.sector} />
      </section>}
      <div className={styles.resultsHeader}>
        <h3>{number(data.total)} {data.total === 1 ? 'familia' : 'familias'}{filters.q ? ` para “${filters.q}”` : ''}</h3>
        <span className={styles.muted} role="status">Página {data.page} de {totalPages}</span>
      </div>
      {!data.families.length ? <div className={`panel ${styles.empty}`}><h3>No hay familias para esta combinación</h3><p>Prueba otro sector o amplía los filtros.</p><button type="button" className={styles.button} onClick={reset}>Ver todo el catálogo</button></div> :
        <div className={styles.cards}>{data.families.map((family) => <article key={family.id} className={`${styles.card} ${selected?.id === family.id ? styles.selectedCard : ''}`}>
          <div className={styles.cardTop}><span className={styles.eyebrow}>{family.id}</span><span className={family.seriesCount ? styles.dataBadge : styles.researchBadge}>{family.seriesCount ? `${family.seriesCount} series vinculadas` : 'En investigación'}</span></div>
          <p className={styles.sectorLabel}>{family.sectorLabel}</p><h4>{family.name}</h4>
          <p className={styles.channel}>{family.channel || family.definition}</p>
          <dl className={styles.cardFacts}><div><dt>Rezago propuesto</dt><dd>{family.lagHypothesis || 'Por definir'}</dd></div>
            <div><dt>Rol</dt><dd>{label(family.role)}</dd></div><div><dt>Prioridad</dt><dd>{family.priority} · evaluación</dd></div></dl>
          <button type="button" className={styles.cardButton} aria-expanded={selected?.id === family.id} aria-controls={selected?.id === family.id ? `${uid}-detail` : undefined} onClick={() => {
            setSelected(family);
            window.requestAnimationFrame(() => detailHeading.current?.scrollIntoView({ behavior: 'auto', block: 'start' }));
          }}>{family.seriesCount ? 'Explorar series' : 'Consultar propuesta y brechas'} <span aria-hidden="true">→</span></button>
        </article>)}</div>}
      {totalPages > 1 && <nav className={styles.pagination} aria-label="Páginas del catálogo">
        <button type="button" className={styles.button} disabled={page <= 1} onClick={() => { setPage((p) => p - 1); setSelected(null); }}>Anterior</button>
        <span>Página {data.page} de {totalPages}</span>
        <button type="button" className={styles.button} disabled={page >= totalPages} onClick={() => { setPage((p) => p + 1); setSelected(null); }}>Siguiente</button>
      </nav>}
      <p className={styles.footnote}>Los rezagos son hipótesis para evaluar. Una relación temporal o una fuente extranjera no demuestra causalidad.</p>
    </>}
  </div>;
}

function FamilyDetail({ family, sector }: { family: FactorFamily; sector: string }) {
  const id = useId();
  const params = new URLSearchParams({ family: family.id });
  if (sector) params.set('sector', sector);
  const remote = useRemote<FactorSeriesResponse>(`/api/exogenas/factores?${params}`);
  const [picked, setPicked] = useState('');
  const series = remote.data?.series ?? [];
  const selected = series.find((one) => one.code === picked) ?? series[0];
  return <>
    <p className={styles.definition}>{family.definition}</p>
    <dl className={styles.metadata}>
      <div><dt>Canal económico</dt><dd>{family.channel}</dd></div>
      <div><dt>Rezago · hipótesis</dt><dd>{family.lagHypothesis}</dd></div>
      <div><dt>Ámbito propuesto</dt><dd>{family.geography}</dd></div>
      <div><dt>Rol económico</dt><dd>{label(family.role)}{family.roleDetail ? ` · ${family.roleDetail}` : ''}</dd></div>
      <div><dt>Medida propuesta</dt><dd>{family.unit} · {family.frequency}</dd></div>
      <div><dt>Estado de la fuente</dt><dd>{family.availability}</dd></div>
    </dl>
    <p className={styles.source}><SourceLink url={family.sourceUrl}>Fuente o referencia de investigación</SourceLink></p>
    <Notice loading={remote.loading} error={remote.error} retry={remote.retry} />
    {remote.data && <Warnings values={remote.data.warnings} />}
    {remote.data && !series.length && <div className={styles.empty}><strong>Esta familia todavía no tiene series vinculadas{sector ? ' para el sector seleccionado' : ''}.</strong>
      <p>La ficha documenta la propuesta y sus límites. La prioridad de evaluación y el enlace de referencia no significan que ya exista una medición integrada.</p></div>}
    {selected && <>
      <label className={styles.seriesSelect} htmlFor={`${id}-series`}>Serie para consultar
        <select id={`${id}-series`} value={selected.code} onChange={(event) => setPicked(event.target.value)}>{series.map((one) => <option key={one.code} value={one.code}>{one.name} · {one.unit} · {FREQUENCIES[one.frequency] ?? one.frequency}</option>)}</select>
      </label>
      <HistoryViewer key={selected.code} series={selected} />
      <ExogenousFactorComparison key={`compare-${selected.code}`} series={series} initialCode={selected.code} />
    </>}
  </>;
}

interface HistoryState { key: string; data: FactorHistoryResponse | null; loading: boolean; moreLoading: boolean; error: boolean; moreError: boolean }

function useHistory(url: string) {
  const [attempt, setAttempt] = useState(0);
  const key = `${url}|${attempt}`;
  const [state, setState] = useState<HistoryState>({ key: '', data: null, loading: true, moreLoading: false, error: false, moreError: false });
  const controllerRef = useRef<AbortController | null>(null);
  const moreInFlight = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    moreInFlight.current = false;
    setState({ key, data: null, loading: true, moreLoading: false, error: false, moreError: false });
    readJson<FactorHistoryResponse>(url, controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ key, data, loading: false, moreLoading: false, error: false, moreError: false });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ key, data: null, loading: false, moreLoading: false, error: true, moreError: false });
    });
    return () => controller.abort();
  }, [url, key]);
  const current = state.key === key;
  const loadMore = async () => {
    const cursor = current ? state.data?.nextCursor : null;
    const controller = controllerRef.current;
    if (!cursor || !controller || controller.signal.aborted || moreInFlight.current) return;
    moreInFlight.current = true;
    setState((old) => old.key === key ? { ...old, moreLoading: true, moreError: false } : old);
    try {
      const next = await readJson<FactorHistoryResponse>(`${url}&cursor=${encodeURIComponent(cursor)}`, controller.signal);
      if (controller.signal.aborted) return;
      setState((old) => {
        if (old.key !== key || !old.data) return old;
        const points = new Map<string, FactorObservation>();
        [...old.data.points, ...next.points].forEach((point) => points.set(point.period, point));
        const repeatedCursor = next.nextCursor === cursor;
        return { ...old, moreLoading: false, data: {
          ...next, points: [...points.values()].sort((a, b) => a.period.localeCompare(b.period)),
          nextCursor: repeatedCursor ? null : next.nextCursor,
          warnings: [...new Set([...old.data.warnings, ...next.warnings, ...(repeatedCursor ? ['La fuente no permitió avanzar a la siguiente página. El histórico visible está incompleto.'] : [])])],
        } };
      });
    } catch {
      if (!controller.signal.aborted) setState((old) => old.key === key ? { ...old, moreLoading: false, moreError: true } : old);
    } finally {
      if (!controller.signal.aborted) moreInFlight.current = false;
    }
  };
  return { data: current ? state.data : null, loading: !current || state.loading, error: current && state.error, moreError: current && state.moreError, moreLoading: current && state.moreLoading, loadMore, retry: () => setAttempt((n) => n + 1) };
}

function HistoryViewer({ series }: { series: FactorSeries }) {
  const id = useId();
  const currentYear = new Date().getFullYear();
  const [range, setRange] = useState({ from: '2000', to: String(currentYear), asOf: '' });
  const [draft, setDraft] = useState(range);
  const [validation, setValidation] = useState('');
  const [exportState, setExportState] = useState<'idle' | 'loading' | 'error'>('idle');
  const downloadController = useRef<AbortController | null>(null);
  const params = useMemo(() => {
    const value = new URLSearchParams({ series: series.code, from: range.from, to: range.to, pageSize: '500' });
    if (range.asOf) value.set('asOf', `${range.asOf}T23:59:59.999Z`);
    return value;
  }, [range, series.code]);
  const url = `/api/exogenas/factores?${params}`;
  const history = useHistory(url);
  useEffect(() => {
    setExportState('idle');
    return () => { downloadController.current?.abort(); };
  }, [url]);
  const data = history.data;
  const points = useMemo(() => (data?.points ?? []).map((point) => ({ ...point, value: point.value !== null && Number.isFinite(point.value) ? point.value : null })), [data]);
  const numeric = points.filter((point) => point.value !== null);
  const last = numeric.at(-1);
  const metadata = data?.series ?? series;
  const tablePoints = points.slice(-100);

  const exportCsv = async () => {
    downloadController.current?.abort();
    const controller = new AbortController();
    downloadController.current = controller;
    setExportState('loading');
    try {
      const exportParams = new URLSearchParams(params);
      exportParams.delete('pageSize');
      exportParams.set('format', 'csv');
      const response = await fetch(`/api/exogenas/factores?${exportParams}`, { signal: controller.signal });
      if (!response.ok) throw new Error('export');
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `${series.code.replace(/[^a-zA-Z0-9_-]/g, '_')}_${range.from}-${range.to}${range.asOf ? `_al_${range.asOf}` : ''}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      setExportState('idle');
    } catch {
      if (!controller.signal.aborted) setExportState('error');
    }
  };

  return <div className={styles.history}>
    <div className={styles.seriesHeader}><div><h4>{series.name}</h4><p>{series.geography} · {FREQUENCIES[series.frequency] ?? series.frequency} · {series.unit}</p></div>
      <SourceLink url={series.sourceUrl}>{series.publisher || 'Fuente de la serie'}</SourceLink></div>
    <form className={styles.range} onSubmit={(event) => {
      event.preventDefault();
      const from = Number(draft.from); const to = Number(draft.to);
      if (!draft.from || !draft.to || !Number.isInteger(from) || !Number.isInteger(to) || from < 1900 || to > currentYear + 1 || from > to) {
        setValidation('Indica años válidos: el inicio debe ser anterior o igual al final.'); return;
      }
      if (draft.asOf && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.asOf) || draft.asOf > today())) {
        setValidation('La fecha de corte debe ser válida y no puede estar en el futuro.'); return;
      }
      setValidation(''); setRange({ ...draft });
    }}>
      <label htmlFor={`${id}-from`}>Desde (año)<input id={`${id}-from`} type="number" min="1900" max={currentYear + 1} required value={draft.from} onChange={(e) => setDraft((old) => ({ ...old, from: e.target.value }))} /></label>
      <label htmlFor={`${id}-to`}>Hasta (año)<input id={`${id}-to`} type="number" min="1900" max={currentYear + 1} required value={draft.to} onChange={(e) => setDraft((old) => ({ ...old, to: e.target.value }))} /></label>
      <label htmlFor={`${id}-asof`}>Información disponible al<input id={`${id}-asof`} type="date" max={today()} value={draft.asOf} onChange={(e) => setDraft((old) => ({ ...old, asOf: e.target.value }))} aria-describedby={`${id}-vintage`} /></label>
      <button type="submit" className={styles.button}>Aplicar período</button>
    </form>
    <p id={`${id}-vintage`} className={styles.muted}>Sin fecha: última versión disponible. Con fecha: corte al final de ese día, en UTC, según disponibilidad registrada. El período observado y la fecha en que se conoció el dato son distintos.</p>
    {validation && <p className={styles.error} role="alert">{validation}</p>}
    <Notice loading={history.loading} error={history.error} retry={history.retry} />
    {data && <>
      <Warnings values={data.warnings} />
      <dl className={styles.seriesFacts}>
        <div><dt>Último valor cargado</dt><dd>{last?.value !== null && last?.value !== undefined ? number(last.value) : 'Sin dato'} <small>{series.unit}</small>{last && <span>{last.period}{data.nextCursor ? ' · histórico parcial' : ''}</span>}</dd></div>
        <div><dt>Medición</dt><dd>{label(metadata.measurementStatus || 'UNKNOWN')}<span>{label(metadata.observationStatus || 'UNKNOWN')}</span></dd></div>
        <div><dt>Rol de la serie</dt><dd>{label(metadata.economicRole)}<span>{metadata.targetScope}</span></dd></div>
      </dl>
      <p className={styles.muted}>Consulta: {range.from}–{range.to} · {range.asOf ? `información disponible al ${range.asOf}` : 'última versión disponible'} · {number(points.length)} períodos cargados.</p>
      {numeric.length ? <ViewToggle label="Vista de la serie" chart={<div className={styles.chart} role="img" aria-label={`${series.name}. ${points.length} períodos cargados, en ${series.unit}. Los valores y sus fuentes están en la vista Tabla.`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={points} margin={{ top: 15, right: 20, bottom: 20, left: 10 }} accessibilityLayer>
            <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" tick={{ fill: 'var(--ink-soft)', fontSize: 11 }} minTickGap={35} axisLine={false} tickLine={false} />
            <YAxis width={74} tick={{ fill: 'var(--ink-soft)', fontSize: 11 }} tickFormatter={(value: number) => number(value)} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--rule)', borderRadius: 8, color: 'var(--ink)' }} formatter={(value) => [typeof value === 'number' ? number(value) : 'Sin dato', series.unit]} />
            <Legend />
            <Line type="linear" dataKey="value" name={series.name} stroke="var(--series-1)" strokeWidth={2} dot={numeric.length < 40 ? { r: 2 } : false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>} table={
        <div className={styles.tableScroll}><table><caption>{tablePoints.length < points.length ? `Últimas ${tablePoints.length} observaciones de las ${points.length} cargadas. Descarga el CSV para el período completo.` : 'Observaciones del período cargado.'} Todas las cifras en {series.unit}.</caption>
          <thead><tr><th scope="col">Período</th><th scope="col">Valor</th><th scope="col">Estado</th><th scope="col">Publicado</th><th scope="col">Disponible desde</th><th scope="col">Fuente</th></tr></thead>
          <tbody>{tablePoints.map((point) => <tr key={point.period}><th scope="row">{point.period}</th><td>{point.value === null ? 'Sin dato' : number(point.value)}</td><td>{label(point.status)}</td><td>{point.publishedAt?.slice(0, 10) ?? 'No consta'}</td><td>{point.availableAt?.slice(0, 10) || 'No consta'}</td><td><SourceLink url={point.sourceUrl}>Fuente</SourceLink></td></tr>)}</tbody>
        </table></div>
      } /> : <div className={styles.empty}><strong>No hay valores observados para este período y fecha de corte.</strong><p>Amplía los años o elimina el corte de información para revisar otras observaciones.</p></div>}
      {data.nextCursor && <div className={styles.more}><p>El histórico está paginado. Se muestran {number(points.length)} períodos; todavía quedan observaciones por cargar.</p>
        <button type="button" className={styles.button} disabled={history.moreLoading} onClick={() => void history.loadMore()}>{history.moreLoading ? 'Cargando…' : history.moreError ? 'Reintentar siguiente página' : 'Cargar más observaciones'}</button></div>}
      {history.moreError && <p className={styles.error} role="alert">No se pudo cargar la siguiente página. Las observaciones anteriores se conservan.</p>}
      <p className={styles.note}>{metadata.note}</p>
      <div className={styles.export}><button type="button" className={styles.button} disabled={exportState === 'loading'} onClick={() => void exportCsv()}>{exportState === 'loading' ? 'Preparando CSV…' : 'Descargar CSV del período completo'}</button><span>Incluye el corte seleccionado, estados y fuentes; no se limita a las páginas cargadas.</span></div>
      {exportState === 'error' && <p className={styles.error} role="alert">No se pudo descargar el CSV. Reintenta o reduce el período si supera el límite de exportación.</p>}
    </>}
  </div>;
}

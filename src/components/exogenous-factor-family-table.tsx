'use client';

import { useEffect, useMemo, useState } from 'react';
import { downloadCsv } from '@/lib/csv';
import { fetchCompleteHistory, runLimited } from '@/lib/exogenous-factor-client';
import {
  buildFamilyTables, familyCsvRows, FAMILY_CSV_HEADER, type FamilySeriesData,
} from '@/lib/exogenous-factor-table';
import type { FactorSeries } from '@/lib/exogenous-factor-types';
import styles from './exogenous-factors.module.css';

const FREQUENCIES: Record<string, string> = { DAILY: 'Diaria', WEEKLY: 'Semanal', MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', ANNUAL: 'Anual' };
const format = (value: number) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 4 }).format(value);

/** Lo ya leído en esta visita: abrir y cerrar la tabla no vuelve a pedir veinte series. */
const loaded = new Map<string, FamilySeriesData[]>();

interface State { key: string; data: FamilySeriesData[] | null; error: boolean; done: number }

/**
 * La vista «Tabla» de una familia: todas sus series, todas sus filas.
 *
 * Una tabla por frecuencia (mensual, anual…), una columna por serie, sin recorte a las
 * últimas filas. El botón baja lo mismo, una observación por fila, con unidad, estado y fuente.
 */
export function FactorFamilyTable({ series, familyId, selectedCode }: {
  series: FactorSeries[]; familyId: string; selectedCode: string;
}) {
  const thisYear = String(new Date().getFullYear());
  const codes = useMemo(() => series.map((one) => one.code).sort(), [series]);
  const key = `${familyId}|${codes.join(',')}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ key: '', data: null, error: false, done: 0 });

  useEffect(() => {
    const cached = loaded.get(key);
    if (cached && attempt === 0) { setState({ key, data: cached, error: false, done: cached.length }); return; }
    const controller = new AbortController();
    setState({ key, data: null, error: false, done: 0 });
    runLimited(codes, 4, async (code) => {
      const history = await fetchCompleteHistory(code, { from: '2000', to: thisYear }, controller.signal);
      if (!controller.signal.aborted) setState((old) => (old.key === key ? { ...old, done: old.done + 1 } : old));
      return { series: history.series, points: history.points } satisfies FamilySeriesData;
    }).then((data) => {
      if (controller.signal.aborted) return;
      const order = new Map(series.map((one, index) => [one.code, index]));
      data.sort((a, b) => (order.get(a.series.code) ?? 0) - (order.get(b.series.code) ?? 0));
      loaded.set(key, data);
      setState({ key, data, error: false, done: data.length });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ key, data: null, error: true, done: 0 });
    });
    return () => controller.abort();
    // `series` solo ordena las columnas; la identidad de la consulta es `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, thisYear]);

  const current = state.key === key;
  const data = current ? state.data : null;
  const groups = useMemo(() => (data ? buildFamilyTables(data) : []), [data]);

  if (current && state.error) {
    return <div className={styles.error} role="alert">
      <span>No se pudieron leer todas las series de la familia. Puedes volver a intentarlo.</span>
      <button type="button" className={styles.button} onClick={() => setAttempt((n) => n + 1)}>Reintentar</button>
    </div>;
  }
  if (!data) {
    return <p className={styles.loading} role="status"><span className="loading-spin" aria-hidden="true" />
      {' '}Leyendo las series de la familia… {current ? `${state.done} de ${codes.length}` : ''}</p>;
  }

  const total = data.reduce((sum, item) => sum + item.points.length, 0);
  return <div className={styles.familyTable}>
    <div className={styles.export}>
      <button type="button" className={styles.button} onClick={() => downloadCsv(
        `${familyId}_todas-las-series_${new Date().toISOString().slice(0, 10)}.csv`,
        FAMILY_CSV_HEADER, familyCsvRows(data),
      )}>Descargar CSV de las {data.length} series</button>
      <span>{format(total)} observaciones, 2000–{thisYear}. Una fila por observación, con unidad, estado y fuente.</span>
    </div>
    {groups.map((group) => <div key={group.frequency} className={styles.tableScroll}>
      <table>
        <caption>Frecuencia {(FREQUENCIES[group.frequency] ?? group.frequency).toLowerCase()} · {group.columns.length} {group.columns.length === 1 ? 'serie' : 'series'} · {format(group.rows.length)} períodos, del más reciente al más antiguo. Una celda vacía es un período sin observación; no se rellena.</caption>
        <thead><tr>
          <th scope="col">Período</th>
          {group.columns.map((column) => <th key={column.code} scope="col" className={column.code === selectedCode ? styles.selectedColumn : undefined}>
            {column.name}<small>{column.unit}</small>
          </th>)}
        </tr></thead>
        <tbody>{group.rows.map((row) => <tr key={row.period}>
          <th scope="row">{row.period}</th>
          {row.values.map((value, index) => <td key={group.columns[index]!.code} className={styles.num}>{value === null ? '' : format(value)}</td>)}
        </tr>)}</tbody>
      </table>
    </div>)}
  </div>;
}

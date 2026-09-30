'use client';

import { useEffect, useState } from 'react';
import { DatedLines, seriesTone } from './charts';
import type { DatedLineSeries } from './charts';
import type { BcbSeriesData } from '@/lib/bcb-board';

/**
 * El mercado boliviano de USDT, según el propio Banco Central.
 *
 * Son las dos cifras que el BCB publica en los gráficos de su libro del bicentenario y de
 * su Memoria: cuánto se comerció y cuántas operaciones hubo, por mes, desde enero de 2024
 * —el mes anterior a que la R.D. 082/2024 levantara la prohibición— hasta mayo de 2025,
 * que es lo último que publicó. Vienen de la plataforma Binance y son compras de USDT;
 * no son las de los bancos, que no publican nada, pero dicen qué tan grande es el mercado
 * que los bancos empezaron a atender.
 */

const CODES = ['BCB_ACTIVOS_VIRTUALES_MONTOS_USDT', 'BCB_ACTIVOS_VIRTUALES_OPERACIONES_USDT'];

const SERIES: Record<string, { title: string; label: string; unit: string; decimals: number }> = {
  BCB_ACTIVOS_VIRTUALES_MONTOS_USDT: {
    title: 'Montos comerciados con USDT en Bolivia (millones de dólares)',
    label: 'Montos comerciados',
    unit: 'millones de US$',
    decimals: 1,
  },
  BCB_ACTIVOS_VIRTUALES_OPERACIONES_USDT: {
    title: 'Operaciones de compra de USDT en Bolivia (miles)',
    label: 'Operaciones',
    unit: 'miles de operaciones',
    decimals: 0,
  },
};

export function BcbUsdtMarket() {
  const [series, setSeries] = useState<BcbSeriesData[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/bcb/serie?codigos=${CODES.join(',')}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('bcb'))))
      .then((body: { series: BcbSeriesData[] }) => alive && setSeries(body.series))
      .catch(() => alive && setSeries([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!series?.length) return null;

  return (
    <div className="grid-pair">
      {CODES.map((code, index) => {
        const one = series.find((entry) => entry.code === code);
        const meta = SERIES[code];
        if (!one || !meta) return null;
        const lines: DatedLineSeries[] = [
          { key: 'value', label: meta.label, tone: seriesTone(index), emphasis: true },
        ];
        return (
          <div className="panel" key={code}>
            <div className="panel-head">
              <h2>{meta.title}</h2>
              <p className="panel-sub">
                Según el Banco Central, con información de Binance: compras de USDT hechas desde
                Bolivia, por mes. El BCB la publica hasta mayo de 2025.
              </p>
            </div>
            <DatedLines
              data={one.points.map(([date, value]) => ({ date, value }))}
              series={lines}
              unit={meta.unit}
              decimals={meta.decimals}
              monthly
              domain={[0, Math.max(...one.points.map(([, value]) => value)) * 1.08]}
            />
          </div>
        );
      })}
    </div>
  );
}

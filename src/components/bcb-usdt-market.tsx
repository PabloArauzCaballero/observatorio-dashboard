'use client';

import { useEffect, useState } from 'react';
import { DatedLines, seriesTone } from './charts';
import type { DatedLineSeries } from './charts';
import { Panel } from '@/components/ui/panel';
import type { BcbSeriesData } from '@/lib/bcb-board';

/**
 * El mercado boliviano de USDT, según el propio Banco Central, como tercer gráfico de la
 * fila de «Tipo de cambio».
 *
 * Son las dos cifras que el BCB publica en los gráficos de su libro del bicentenario y de
 * su Memoria: cuánto se comerció y cuántas operaciones hubo, por mes, desde enero de 2024
 * —el mes anterior a que la R.D. 082/2024 levantara la prohibición— hasta mayo de 2025,
 * que es lo último que publicó. Vienen de la plataforma Binance y son compras de USDT; no
 * son las de los bancos, que no publican nada, pero dicen qué tan grande es el mercado que
 * los bancos empezaron a atender.
 *
 * Un solo panel con un selector y no dos gráficos: la fila tiene tres lugares y las dos
 * medidas son la misma historia contada con otra unidad, que no comparten eje.
 */

const MEASURES = [
  {
    code: 'BCB_ACTIVOS_VIRTUALES_MONTOS_USDT',
    chip: 'Montos',
    title: 'Mercado de USDT en Bolivia: montos (millones de dólares)',
    label: 'Montos comerciados',
    unit: 'millones de US$',
    decimals: 1,
  },
  {
    code: 'BCB_ACTIVOS_VIRTUALES_OPERACIONES_USDT',
    chip: 'Operaciones',
    title: 'Mercado de USDT en Bolivia: operaciones (miles)',
    label: 'Operaciones',
    unit: 'miles de operaciones',
    decimals: 0,
  },
] as const;

export function BcbUsdtMarket() {
  const [series, setSeries] = useState<BcbSeriesData[] | null>(null);
  const [which, setWhich] = useState<(typeof MEASURES)[number]['code']>(MEASURES[0].code);

  useEffect(() => {
    let alive = true;
    fetch(`/api/bcb/serie?codigos=${MEASURES.map((one) => one.code).join(',')}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('bcb'))))
      .then((body: { series: BcbSeriesData[] }) => alive && setSeries(body.series))
      .catch(() => alive && setSeries([]));
    return () => {
      alive = false;
    };
  }, []);

  const measure = MEASURES.find((one) => one.code === which) ?? MEASURES[0];
  const one = series?.find((entry) => entry.code === measure.code);
  // Sin la serie (el núcleo todavía no la sembró, o no se pudo leer) el panel no ocupa
  // un lugar de la fila con un aviso: la fila se reparte entre los que sí tienen datos.
  if (series !== null && !series.length) return null;

  const lines: DatedLineSeries[] = [
    { key: 'value', label: measure.label, tone: seriesTone(3), emphasis: true },
  ];
  return (
    <Panel
      id="mercado-usdt-bcb"
      title={measure.title}
      lede="Compras de USDT hechas desde Bolivia, por mes, según el Banco Central con información de Binance."
      source="Banco Central de Bolivia (libro del bicentenario y Memoria), con información de Binance"
    >
      <div className="fx-filters">
        <div className="chips" role="group" aria-label="Medida">
          {MEASURES.map((option) => (
            <button
              key={option.code}
              type="button"
              className={option.code === which ? 'chip chip-on' : 'chip'}
              aria-pressed={option.code === which}
              onClick={() => setWhich(option.code)}
            >
              {option.chip}
            </button>
          ))}
        </div>
      </div>
      {one ? (
        <DatedLines
          data={one.points.map(([date, value]) => ({ date, value }))}
          series={lines}
          unit={measure.unit}
          decimals={measure.decimals}
          monthly
          domain={[0, Math.max(...one.points.map(([, value]) => value)) * 1.08]}
        />
      ) : (
        <div className="callout">Leyendo las cifras del Banco Central…</div>
      )}
      <details className="panel-note">
        <summary>Cómo leer este gráfico</summary>
        <p>
          Es el mercado que los bancos empezaron a atender; el BCB lo publica hasta mayo de 2025.
        </p>
      </details>
    </Panel>
  );
}

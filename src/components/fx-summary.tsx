'use client';

import { useState } from 'react';
import { DatedLines } from './charts';
import type { DatedLinePoint, DatedLineSeries } from './charts';
import { Panel } from '@/components/ui/panel';

/**
 * «Resumen» del tipo de cambio: lo que un lector sin formación económica viene a buscar.
 *
 * El capítulo abría con lecturas plegadas, un índice deflactado y velas, y el lector que solo
 * quería saber cuánto cuesta el dólar no encontraba la cifra (pedido del usuario, 15-oct-2026:
 * «incomprensible, necesito que sea más sencillo»). Esta página contesta tres preguntas en este
 * orden —cuánto cuesta hoy, cuánto cambió, cuánto se separan los dos precios— con tres cifras,
 * tres frases y un solo gráfico. Lo técnico sigue en las otras páginas de la sección.
 *
 * Nada de la prosa está escrito a mano: cada frase sale de las mismas filas que dibuja el gráfico.
 */

export interface FxDay {
  date: string;
  /** Dólar oficial del BCB (Bs por USD). */
  official: number | null;
  /** Punto medio del paralelo P2P (Bs por USD). */
  parallel: number | null;
}

export interface FxTokenNow {
  token: string;
  mid: number;
  date: string;
}

const RANGES = [
  { key: '1m', label: '1 mes', days: 31 },
  { key: '3m', label: '3 meses', days: 92 },
  { key: '1a', label: '1 año', days: 366 },
  { key: 'todo', label: 'Todo', days: null },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

const SERIES: readonly DatedLineSeries[] = [
  {
    key: 'parallel',
    label: 'Dólar paralelo (mercado P2P)',
    tone: 'var(--parallel)',
    emphasis: true,
  },
  { key: 'official', label: 'Dólar oficial (Banco Central)', tone: 'var(--official)' },
];

const bs = (value: number): string =>
  value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (value: number): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('es-BO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
const longDate = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const say = (date: string): string => longDate.format(new Date(`${date}T12:00:00Z`));

/** Resta días a una fecha ISO, en UTC. */
const minusDays = (date: string, days: number): string => {
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() - days);
  return at.toISOString().slice(0, 10);
};

/** El último valor de un lado y el que tenía hace `days` días (el más cercano anterior). */
function lastAndBefore(
  days: readonly FxDay[],
  side: 'official' | 'parallel',
  back: number,
): { last: { date: string; value: number } | null; change: number | null } {
  const filled = days.filter((day) => typeof day[side] === 'number');
  const lastDay = filled.at(-1);
  if (!lastDay) return { last: null, change: null };
  const last = { date: lastDay.date, value: lastDay[side] as number };
  const cut = minusDays(last.date, back);
  const before = [...filled].reverse().find((day) => day.date <= cut);
  const change = before ? (last.value / (before[side] as number) - 1) * 100 : null;
  return { last, change };
}

/** Sube, baja o se mantiene, dicho en palabras y sin decimales falsos. */
function moved(change: number | null, what: string): string {
  if (change === null) return `No hay datos suficientes para comparar el ${what} con hace un mes.`;
  if (Math.abs(change) < 0.05) return `El ${what} está igual que hace un mes.`;
  return `El ${what} ${change > 0 ? 'subió' : 'bajó'} ${pct(Math.abs(change)).replace('+', '')} en el último mes.`;
}

export function FxSummary({
  days,
  tokens,
}: {
  days: readonly FxDay[];
  tokens: readonly FxTokenNow[];
}) {
  const [range, setRange] = useState<RangeKey>('1a');
  const official = lastAndBefore(days, 'official', 30);
  const parallel = lastAndBefore(days, 'parallel', 30);
  const gap =
    official.last && parallel.last ? (parallel.last.value / official.last.value - 1) * 100 : null;

  const chosen = RANGES.find((one) => one.key === range) ?? RANGES[2];
  const lastDate = days.at(-1)?.date;
  const from = chosen.days && lastDate ? minusDays(lastDate, chosen.days) : '';
  const rows: DatedLinePoint[] = days
    .filter((day) => day.date >= from && (day.official !== null || day.parallel !== null))
    .map((day) => ({ date: day.date, official: day.official, parallel: day.parallel }));

  const usdt = tokens.find((one) => one.token === 'USDT');
  const usdc = tokens.find((one) => one.token === 'USDC');

  return (
    <>
      <Panel
        id="dolar-hoy"
        title="Cuánto cuesta un dólar hoy (Bs por USD)"
        lede={
          parallel.last && official.last
            ? `Al ${say(parallel.last.date)}, un dólar se compra en el mercado a ${bs(parallel.last.value)} Bs; el precio oficial del Banco Central es ${bs(official.last.value)} Bs.`
            : 'Las cotizaciones del día todavía no están disponibles.'
        }
        source="Banco Central de Bolivia (oficial) y mercados P2P en bolivianos (paralelo); cálculo de DatosBolivia.com"
        data={{
          unidad: 'Bs por USD; variaciones en %',
          columnas: ['Cotización', 'Bs por USD', 'Fecha', 'Cambio en 30 días (%)'],
          filas: [
            [
              'Dólar paralelo (punto medio)',
              parallel.last?.value ?? null,
              parallel.last?.date ?? null,
              parallel.change,
            ],
            [
              'Dólar oficial (BCB)',
              official.last?.value ?? null,
              official.last?.date ?? null,
              official.change,
            ],
            ...(usdt ? [['USDT (punto medio)', usdt.mid, usdt.date, null]] : []),
            ...(usdc ? [['USDC (punto medio)', usdc.mid, usdc.date, null]] : []),
          ],
        }}
      >
        <div className="stat-strip fx-hoy">
          {parallel.last ? (
            <div className="stat">
              <span className="stat-label">Dólar paralelo</span>
              <span className="stat-value">{bs(parallel.last.value)} Bs</span>
              <span className="stat-hint">
                lo que se paga en el mercado
                {parallel.change === null ? '' : ` · ${pct(parallel.change)} en 30 días`}
              </span>
            </div>
          ) : null}
          {official.last ? (
            <div className="stat">
              <span className="stat-label">Dólar oficial</span>
              <span className="stat-value">{bs(official.last.value)} Bs</span>
              <span className="stat-hint">
                el que publica el Banco Central
                {official.change === null ? '' : ` · ${pct(official.change)} en 30 días`}
              </span>
            </div>
          ) : null}
          {gap !== null ? (
            <div className="stat">
              <span className="stat-label">Diferencia (brecha)</span>
              <span className="stat-value">{pct(gap)}</span>
              <span className="stat-hint">cuánto más caro es el paralelo que el oficial</span>
            </div>
          ) : null}
        </div>
        <ul className="fx-en-pocas">
          <li>{moved(parallel.change, 'dólar paralelo')}</li>
          <li>{moved(official.change, 'dólar oficial')}</li>
          {gap !== null ? (
            <li>
              {Math.abs(gap) < 1
                ? 'Los dos precios están prácticamente iguales: hoy casi no hay brecha.'
                : `Comprar un dólar en el mercado cuesta ${pct(Math.abs(gap)).replace('+', '')} ${gap > 0 ? 'más' : 'menos'} que al precio oficial.`}
            </li>
          ) : null}
          {usdt ? (
            <li>
              USDT, el «dólar digital» más usado para comprar dólares por internet, cotiza a{' '}
              {bs(usdt.mid)} Bs{usdc ? ` y USDC a ${bs(usdc.mid)} Bs` : ''}.
            </li>
          ) : null}
        </ul>
      </Panel>

      <Panel
        id="dolar-oficial-y-paralelo-simple"
        title="Dólar oficial y paralelo (Bs por USD)"
        lede="La línea gruesa es lo que se paga en el mercado; la fina, el precio oficial. Cuanto más separadas, mayor la brecha."
        source="Banco Central de Bolivia (oficial) y mercados P2P en bolivianos (paralelo); cálculo de DatosBolivia.com"
      >
        <div className="chips" role="group" aria-label="Periodo del gráfico">
          {RANGES.map((one) => (
            <button
              key={one.key}
              type="button"
              className={one.key === range ? 'chip chip-on' : 'chip'}
              aria-pressed={one.key === range}
              onClick={() => setRange(one.key)}
            >
              {one.label}
            </button>
          ))}
        </div>
        {rows.length > 1 ? (
          <DatedLines
            data={rows}
            series={SERIES}
            unit="Bs por USD"
            decimals={2}
            yearTicks={range === 'todo'}
          />
        ) : (
          <div className="callout">No hay cotizaciones suficientes en este periodo.</div>
        )}
      </Panel>

      <Panel
        id="glosario-del-dolar"
        title="Qué significa cada término (glosario)"
        lede="Cuatro palabras bastan para leer toda la sección."
        source="DatosBolivia.com"
        downloadable={false}
      >
        <dl className="fx-glosario">
          <dt>Dólar oficial</dt>
          <dd>
            El precio que publica el Banco Central de Bolivia. Estuvo fijo en 6,96 Bs hasta el 27 de
            junio de 2026; desde entonces se mueve.
          </dd>
          <dt>Dólar paralelo</dt>
          <dd>
            Lo que se paga por un dólar entre particulares, fuera de los bancos. Aquí se mide en los
            mercados P2P por internet (punto medio entre compra y venta).
          </dd>
          <dt>Brecha</dt>
          <dd>
            Cuánto más caro es el paralelo que el oficial, en porcentaje. Una brecha grande indica
            que faltan dólares.
          </dd>
          <dt>USDT y USDC</dt>
          <dd>
            «Dólares digitales» (fichas estables) que valen un dólar cada uno; son la vía más usada
            para comprar dólares cuando los bancos no los venden. Ver «Dólar digital».
          </dd>
        </dl>
      </Panel>
    </>
  );
}

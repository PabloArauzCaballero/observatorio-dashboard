'use client';

import { useEffect, useState } from 'react';
import { DatedLines, WorldLines, seriesTone } from './charts';
import type { DatedLinePoint, WorldLinePoint } from './charts';
import { OnOpenNotice } from './on-open';
import { Panel } from '@/components/ui/panel';
import type { FactorHistoryResponse } from '@/lib/exogenous-factor-types';

/**
 * Lo que mueve a Bolivia desde fuera y no es un precio: cuánto crecen los
 * países que le compran y el estado de El Niño.
 *
 * Son las dos únicas piezas del antiguo catálogo de factores que eran de verdad
 * externas y no estaban ya en otra página. El crecimiento de los socios es la
 * demanda de lo que Bolivia exporta —gas a Brasil y Argentina, minerales a
 * China, soya a Perú y Colombia—; el índice ONI anticipa la sequía del
 * altiplano y las inundaciones del oriente, que mueven la cosecha y la energía.
 *
 * Las series se leen de la misma dirección que el catálogo (`/api/exogenas/
 * factores`), una por serie, y se piden al llegar a la página como el resto.
 */

const PARTNERS: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'BRA', label: 'Brasil' },
  { code: 'ARG', label: 'Argentina' },
  { code: 'CHN', label: 'China' },
  { code: 'USA', label: 'Estados Unidos' },
  { code: 'PER', label: 'Perú' },
  { code: 'CHL', label: 'Chile' },
];
const growthCode = (country: string) => `EXF_WDI_${country}_NY_GDP_MKTP_KD_ZG`;
const ONI = 'EXF_NOAA_ONI';

const number = (value: number, decimals = 1): string =>
  new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);

async function history(code: string, signal: AbortSignal): Promise<FactorHistoryResponse> {
  const params = new URLSearchParams({
    series: code,
    from: '2000',
    to: String(new Date().getFullYear()),
    pageSize: '500',
  });
  const response = await fetch(`/api/exogenas/factores?${params}`, { signal });
  if (!response.ok) throw new Error(`No se pudo leer ${code}`);
  return response.json() as Promise<FactorHistoryResponse>;
}

interface Loaded {
  growth: Array<{ code: string; label: string; body: FactorHistoryResponse }>;
  oni: FactorHistoryResponse | null;
}

export function ExternalDrivers() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    /* Una serie que no llega no tumba a las demás: se dibuja lo que hay. */
    const settle = <T,>(promise: Promise<T>) =>
      promise.then(
        (value) => value,
        () => null,
      );
    Promise.all([
      Promise.all(PARTNERS.map((one) => settle(history(growthCode(one.code), controller.signal)))),
      settle(history(ONI, controller.signal)),
    ]).then(([growth, oni]) => {
      if (controller.signal.aborted) return;
      const ok = PARTNERS.flatMap((one, index) => {
        const body = growth[index];
        return body && body.points.length ? [{ code: one.code, label: one.label, body }] : [];
      });
      if (!ok.length && !oni) setFailed(true);
      else setLoaded({ growth: ok, oni: oni && oni.points.length ? oni : null });
    });
    return () => controller.abort();
  }, []);

  if (!loaded) return <OnOpenNotice what="la demanda externa y el clima" failed={failed} />;

  return (
    <section className="stack" aria-label="Demanda externa y clima">
      <header className="page-intro">
        <h3 className="page-intro-title">Lo que mueve a Bolivia desde fuera y no es un precio</h3>
        <p className="page-intro-lede">
          Cuánto crecen los países que le compran a Bolivia y si el Pacífico está en El Niño o en La
          Niña.
        </p>
      </header>
      <div className="grid-two">
        {loaded.growth.length ? <PartnerGrowth growth={loaded.growth} /> : null}
        {loaded.oni ? <OceanicNino oni={loaded.oni} /> : null}
      </div>
    </section>
  );
}

function PartnerGrowth({ growth }: { growth: Loaded['growth'] }) {
  const rows = new Map<string, WorldLinePoint>();
  for (const one of growth) {
    for (const point of one.body.points) {
      if (point.value === null || !Number.isFinite(point.value)) continue;
      const year = point.period.slice(0, 4);
      const row = rows.get(year) ?? { year };
      row[one.code] = point.value;
      rows.set(year, row);
    }
  }
  const data = [...rows.values()].sort((left, right) => left.year.localeCompare(right.year));
  const last = data.at(-1)?.year ?? '';
  const publishers = [...new Set(growth.map((one) => one.body.series.publisher).filter(Boolean))];
  return (
    <Panel
      id="exogenas-socios-crecimiento"
      title={`Crecimiento de los socios comerciales de Bolivia, ${data[0]?.year ?? ''}–${last} (% anual)`}
      lede="Crecimiento real del PIB de seis de los principales socios comerciales de Bolivia. Cuando Brasil o China frenan, cae la demanda de gas, minerales y soya."
      source={publishers.join(', ') || 'Banco Mundial, Indicadores del Desarrollo Mundial'}
    >
      <WorldLines
        data={data}
        series={growth.map((one, index) => ({
          key: one.code,
          label: one.label,
          tone: seriesTone(index),
        }))}
        format={(value) => `${number(value)} %`}
        tick={(value) => number(value, 0)}
      />
    </Panel>
  );
}

function OceanicNino({ oni }: { oni: FactorHistoryResponse }) {
  const data: DatedLinePoint[] = oni.points
    .filter((point) => point.value !== null && Number.isFinite(point.value))
    .map((point) => ({ date: `${point.period.slice(0, 7)}-01`, oni: point.value }));
  const last = oni.points.at(-1);
  const state =
    last && last.value !== null
      ? last.value >= 0.5
        ? 'El Niño'
        : last.value <= -0.5
          ? 'La Niña'
          : 'neutral'
      : null;
  return (
    <Panel
      id="exogenas-oni"
      title="El Niño y La Niña: índice oceánico del Pacífico (°C de anomalía), mensual"
      lede={`Temperatura del mar en el Pacífico central frente a lo normal. Desde +0,5 °C es El Niño (sequía en el altiplano, lluvias fuertes en el oriente); desde −0,5 °C, La Niña.${
        state && last ? ` Último dato: ${number(last.value ?? 0)} °C, ${state}.` : ''
      }`}
      source={oni.series.publisher || 'NOAA, Centro de Predicción del Clima'}
    >
      <DatedLines
        data={data}
        series={[{ key: 'oni', label: 'Índice ONI', tone: seriesTone(0) }]}
        unit="°C"
        decimals={1}
        monthly
        referenceLine={0}
      />
    </Panel>
  );
}

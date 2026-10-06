'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ExternalDrivers } from './exogenous-drivers';
import { OnOpenNotice } from './on-open';
import type { ExogenousBoard } from '@/lib/exogenous-board';

const ExogenousExplorer = dynamic(
  () => import('./exogenous-explorer').then((module) => module.ExogenousExplorer),
  {
    loading: () => <OnOpenNotice what="el explorador de precios" failed={false} />,
  },
);

/**
 * La pestaña de variables exógenas, pedida al abrirse.
 *
 * Como el resto de las páginas de Macroeconomía, no se pide hasta que el
 * lector llega a ella.
 *
 * Una sola vista: los precios que Bolivia no fija, y debajo la demanda de sus
 * socios y el clima del Pacífico. Antes había un segundo enfoque, «Factores por
 * sector», con 287 fichas de catálogo: 243 no tenían ninguna serie, 26 repetían
 * exactamente las series de precios de esta misma página y el resto eran datos
 * de Bolivia —tasas, remesas, matrícula, población— que ya están en «Series de
 * Bolivia», «Social Info» o «Series del BCB» y que no son exógenos. De ese
 * catálogo sólo dos cosas eran externas y no estaban en otro lado; son las de
 * `ExternalDrivers`.
 */
export function ExogenousSection() {
  return (
    <>
      <PricesOnOpen />
      <ExternalDrivers />
    </>
  );
}

/** El histórico de precios se pide solamente cuando el lector llega a la página. */
function PricesOnOpen() {
  const [payload, setPayload] = useState<{ board: ExogenousBoard } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setPayload(null);
    setFailed(false);
    fetch('/api/exogenas', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('No se pudieron consultar los precios');
        return response.json() as Promise<{ board: ExogenousBoard }>;
      })
      .then((body) => {
        if (!controller.signal.aborted) setPayload(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [attempt]);

  if (!payload)
    return (
      <>
        <OnOpenNotice what="las series de precios" failed={failed} />
        {failed && (
          <button type="button" className="chip" onClick={() => setAttempt((value) => value + 1)}>
            Reintentar
          </button>
        )}
      </>
    );

  if (!payload.board.series.length) {
    return (
      <div className="callout">Aún no hay series de precios disponibles para esta sección.</div>
    );
  }

  return <ExogenousExplorer board={payload.board} />;
}

'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ExogenousFactorsExplorer } from './exogenous-factors-explorer';
import { OnOpenNotice } from './on-open';
import type { ExogenousBoard } from '@/lib/exogenous-board';
import styles from './exogenous-factors.module.css';

const ExogenousExplorer = dynamic(() => import('./exogenous-explorer').then((module) => module.ExogenousExplorer), {
  loading: () => <OnOpenNotice what="el explorador de precios" failed={false} />,
});

/**
 * La pestaña de variables exógenas, pedida al abrirse.
 *
 * Como el resto de las páginas de Macroeconomía, no se pide hasta que el
 * lector la elige: `SubTabs` monta sólo la página activa.
 */
export function ExogenousSection() {
  const [mode, setMode] = useState<'factors' | 'prices'>('factors');
  return <>
    <nav className={styles.modeNav} aria-label="Enfoque de las variables exógenas">
      <button type="button" aria-pressed={mode === 'factors'} onClick={() => setMode('factors')}>Factores por sector</button>
      <button type="button" aria-pressed={mode === 'prices'} onClick={() => setMode('prices')}>Precios por producto</button>
    </nav>
    {mode === 'factors' ? <ExogenousFactorsExplorer /> : <PricesOnOpen />}
  </>;
}

/** El histórico de precios se pide solamente cuando el lector abre ese enfoque. */
function PricesOnOpen() {
  const [payload, setPayload] = useState<{ board: ExogenousBoard } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setPayload(null);
    setFailed(false);
    fetch('/api/exogenas', { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error('No se pudieron consultar los precios');
      return response.json() as Promise<{ board: ExogenousBoard }>;
    }).then((body) => { if (!controller.signal.aborted) setPayload(body); }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [attempt]);

  if (!payload) return <>
    <OnOpenNotice what="las series de precios" failed={failed} />
    {failed && <button type="button" className={styles.button} onClick={() => setAttempt((value) => value + 1)}>Reintentar</button>}
  </>;

  if (!payload.board.series.length) {
    return (
      <div className="callout">
        Aún no hay series de precios disponibles para esta sección.
      </div>
    );
  }

  return <ExogenousExplorer board={payload.board} />;
}

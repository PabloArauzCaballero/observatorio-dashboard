'use client';

import { useEffect, useState } from 'react';
import type { TradeView } from '@/lib/trade-records';

/**
 * Una lectura de la base aduanera por dirección.
 *
 * Mientras llega la lectura nueva se conserva la anterior —el gráfico se
 * atenúa en vez de vaciarse—, y una dirección `null` es «todavía no hay nada
 * que pedir». Un cambio de dirección cancela la lectura en vuelo: el lector que
 * arrastra el control de años no deja una cola de pedidos que ya no importan.
 */
export function useTradeViews(url: string | null): {
  views: Record<string, TradeView> | null;
  loading: boolean;
  failed: boolean;
} {
  const [views, setViews] = useState<Record<string, TradeView> | null>(null);
  const [loading, setLoading] = useState(url !== null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    const control = new AbortController();
    setLoading(true);
    fetch(url, { signal: control.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(url))))
      .then((body: { views: Record<string, TradeView> }) => {
        setViews(body.views);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== 'AbortError') setFailed(true);
      })
      .finally(() => {
        if (!control.signal.aborted) setLoading(false);
      });
    return () => control.abort();
  }, [url]);

  return { views, loading, failed };
}

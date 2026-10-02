'use client';

import { useEffect, useState } from 'react';
import type { StreetIndexEntry } from '@/lib/street-types';

/**
 * El índice de calles de las ciudades, pedido una vez y compartido.
 *
 * Pesa ~3,4 MB (una quinta parte en brotli) y no depende de quién pregunta, así que la
 * promesa vive a nivel de módulo: dos tablas, o la misma tras desmontarse y volver a
 * montarse, esperan una sola petición. Un fallo se olvida para que el siguiente intento
 * pueda reintentar.
 */

let pending: Promise<StreetIndexEntry[]> | null = null;

function load(): Promise<StreetIndexEntry[]> {
  pending ??= fetch('/api/calles/indice')
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error('índice de calles'))))
    .then((body: { streets: StreetIndexEntry[] }) => body.streets)
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}

export function useStreetIndex(wanted: boolean): { entries: StreetIndexEntry[] | null; failed: boolean } {
  const [entries, setEntries] = useState<StreetIndexEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!wanted || entries) return;
    let alive = true;
    load()
      .then((streets) => {
        if (alive) setEntries(streets);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [wanted, entries]);

  return { entries, failed };
}

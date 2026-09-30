'use client';

import { useEffect, useState } from 'react';
import type { BankAssetsBoard } from '@/lib/bank-assets-board';

/**
 * El tablero de bancos, pedido una sola vez por página.
 *
 * Tres piezas lo usan —las tarjetas de la portada, el gráfico de la fila de
 * «Tipo de cambio» y la tabla de detalle— y cada una por su lado pedía
 * `/api/bancos`. La promesa se guarda a nivel de módulo y no del componente:
 * las tres comparten la misma petición y un fallo no se recuerda, así que la
 * siguiente visita lo vuelve a intentar.
 */

let pending: Promise<BankAssetsBoard> | null = null;

function load(): Promise<BankAssetsBoard> {
  pending ??= fetch('/api/bancos')
    .then((response) =>
      response.ok ? (response.json() as Promise<{ board: BankAssetsBoard }>) : Promise.reject(),
    )
    .then((body) => body.board)
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}

export function useBankBoard(): { board: BankAssetsBoard | null; failed: boolean } {
  const [board, setBoard] = useState<BankAssetsBoard | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    load()
      .then((loaded) => {
        if (alive) setBoard(loaded);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { board, failed };
}

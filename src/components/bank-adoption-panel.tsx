'use client';

import { DatedLines, seriesTone } from './charts';
import type { DatedLineSeries } from './charts';
import { useBankBoard } from './bank-board';
import { sayLong } from './bank-format';

/**
 * Cuántos bancos ofrecen dólar digital, como tercer gráfico de la fila de
 * «Tipo de cambio».
 *
 * Va al lado del índice real y del precio por ficha y no debajo: son la misma
 * clase de dibujo —una serie contra el calendario— y al lado se leen juntas
 * con qué pasó con el dólar y cuándo se abrió cada puerta para comprarlo.
 */

const SERIES: readonly DatedLineSeries[] = [
  { key: 'total', label: 'Bancos con el servicio', tone: seriesTone(0), emphasis: true },
  { key: 'usdt', label: 'Ofrecen USDT', tone: seriesTone(3) },
  { key: 'usdc', label: 'Ofrecen USDC', tone: seriesTone(5) },
];

export function BankAdoptionPanel() {
  const { board, failed } = useBankBoard();
  const adoption = board?.adoption ?? [];
  const latest = board?.latestRead;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Bancos con dólar digital (cantidad de bancos)</h2>
        <p className="panel-sub">
          Ningún banco publica a qué precio compra o vende USDT o USDC: lo que se sigue es desde
          cuándo lo ofrece cada uno, leyendo cada día su página oficial
          {latest ? ` (última lectura: ${sayLong(latest)})` : ''}.
        </p>
      </div>
      {adoption.length > 1 ? (
        <DatedLines
          data={adoption}
          series={SERIES}
          unit="bancos"
          decimals={0}
          yearTicks
          domain={[0, Math.max(...adoption.map((point) => point.total)) + 1]}
        />
      ) : (
        <div className="callout">
          {failed
            ? 'No se pudieron leer los bancos. El resto del informe sigue al día.'
            : board
              ? 'Todavía no hay bancos cargados.'
              : 'Leyendo los bancos…'}
        </div>
      )}
    </div>
  );
}

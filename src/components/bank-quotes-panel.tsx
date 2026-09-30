'use client';

import { DatedLines, seriesTone } from './charts';
import type { DatedLineSeries } from './charts';
import { useBankBoard } from './bank-board';
import { sayLong } from './bank-format';

/**
 * Lo que cada banco cobra por un dólar digital, como tercer gráfico de la fila
 * de «Tipo de cambio».
 *
 * Va al lado del índice real y del precio por ficha porque es el mismo dibujo
 * —bolivianos por dólar contra el calendario— y al lado se lee contra el
 * mercado que los bancos compiten por alcanzar. La línea es lo que el cliente
 * PAGA por cada ficha. Ningún banco publica esa cifra fuera de su aplicación:
 * cada punto es una captura que alguien anotó, y el gráfico no dibuja nada que
 * nadie haya visto.
 */

export function BankQuotesPanel() {
  const { board, failed } = useBankBoard();
  const quotes = board?.quotes ?? [];
  const banks = board?.banks ?? [];
  const series: DatedLineSeries[] = banks.map((bank, index) => ({
    key: bank.bank,
    label: `${bank.bankName} (${bank.asset})`,
    tone: seriesTone(index),
  }));
  const latest = quotes.at(-1)?.date;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Cotización de cada banco (Bs por ficha)</h2>
        <p className="panel-sub">
          Lo que el cliente paga por cada USDT o USDC en cada banco. Ningún banco publica esa cifra
          fuera de su aplicación, así que cada punto es una captura anotada a mano
          {latest ? ` (la última, del ${sayLong(latest)})` : ''}.
        </p>
      </div>
      {quotes.length > 0 && series.length > 0 ? (
        <DatedLines data={quotes} series={series} unit="Bs" decimals={2} yearTicks />
      ) : (
        <div className="callout">
          {failed
            ? 'No se pudieron leer los bancos. El resto del informe sigue al día.'
            : board
              ? 'Todavía no hay ninguna cotización anotada. Ningún banco la publica fuera de su aplicación: en cuanto se anote la primera captura, esta línea empieza a dibujarse.'
              : 'Leyendo los bancos…'}
        </div>
      )}
    </div>
  );
}

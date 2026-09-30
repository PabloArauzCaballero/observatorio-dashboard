'use client';

import { Icon } from './icons';
import { OnOpenNotice } from './on-open';
import { useBankBoard } from './bank-board';
import { amount, sayLong } from './bank-format';
import type { BankProduct } from '@/lib/bank-assets-board';

/**
 * El detalle de cada banco que ofrece dólar digital, al final de «Tipo de
 * cambio».
 *
 * El gráfico de cuántos son está en la fila de los otros gráficos y las
 * tarjetas están en la portada; esta tabla es lo que ninguno de los dos cabe:
 * la fuente de cada fecha, cómo consta y los límites que declara cada página.
 */

const BASIS_LABEL: Record<BankProduct['sinceBasis'], string> = {
  ANNOUNCEMENT: 'anunciado',
  FIRST_PUBLIC_DOCUMENT: 'a más tardar (primer documento oficial)',
  OFFICIAL_PAGE: 'primera lectura de su página',
};

function State({ bank }: { bank: BankProduct }) {
  if (bank.offeredNow === null) {
    return <span title="Su sitio rechaza las consultas automáticas">sin lectura diaria</span>;
  }
  return bank.offeredNow ? (
    <span title={bank.lastRead ? `Leído el ${sayLong(bank.lastRead)}` : undefined}>lo ofrece</span>
  ) : (
    <b>ya no lo anuncia</b>
  );
}

export function BankAssetsTable() {
  const { board, failed } = useBankBoard();

  if (!board) return <OnOpenNotice what="los bancos con dólar digital" failed={failed} />;
  if (!board.banks.length) return null;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Qué ofrece cada banco, desde cuándo y con qué límites</h2>
        <p className="panel-sub">
          Ordenados por fecha de arranque. «Anunciado» es el día que el banco o la prensa dan como
          inicio; «a más tardar» es la fecha del primer documento oficial cuando el banco nunca dijo
          cuándo empezó, así que el servicio pudo abrir antes.
        </p>
      </div>
      <div className="table-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Banco</th>
              <th>Servicio</th>
              <th>Ficha</th>
              <th>Desde</th>
              <th>Hoy</th>
              <th>Límites que declara su página</th>
            </tr>
          </thead>
          <tbody>
            {board.banks.map((bank) => (
              <tr key={`${bank.bank}-${bank.asset}`} title={bank.note}>
                <td>
                  <Icon name="banco" size={12} /> {bank.bankName}
                </td>
                <td>{bank.product}</td>
                <td>{bank.asset}</td>
                <td>
                  {bank.sinceSource ? (
                    <a href={bank.sinceSource} target="_blank" rel="noreferrer">
                      {sayLong(bank.since)}
                    </a>
                  ) : (
                    sayLong(bank.since)
                  )}
                  <span className="stat-hint"> · {BASIS_LABEL[bank.sinceBasis]}</span>
                </td>
                <td>
                  <State bank={bank} />
                </td>
                <td>
                  {bank.limits.length
                    ? bank.limits.map((limit) => (
                        <div key={limit.label}>
                          {limit.label}: <b>{amount(limit.value)}</b> {limit.unit}
                        </div>
                      ))
                    : 'no los publica'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

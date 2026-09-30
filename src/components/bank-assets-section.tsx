'use client';

import { DatedLines, sayDate, seriesTone } from './charts';
import type { DatedLineSeries } from './charts';
import { Icon } from './icons';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { BankAssetsBoard, BankProduct } from '@/lib/bank-assets-board';

/**
 * Los bancos que ofrecen dólar digital, pedidos al abrirse.
 *
 * No hay precio que dibujar: ningún banco publica su cotización fuera de su
 * aplicación. Lo que sí es público, y cambia, es si el servicio existe, desde
 * cuándo y con qué límites, y eso es lo que muestra este panel.
 */

const ADOPTION_SERIES: readonly DatedLineSeries[] = [
  { key: 'total', label: 'Bancos con el servicio', tone: seriesTone(0), emphasis: true },
  { key: 'usdt', label: 'Ofrecen USDT', tone: seriesTone(3) },
  { key: 'usdc', label: 'Ofrecen USDC', tone: seriesTone(5) },
];

const number = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 });

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
    <span title={bank.lastRead ? `Leído el ${sayDate(bank.lastRead)}` : undefined}>lo ofrece</span>
  ) : (
    <b>ya no lo anuncia</b>
  );
}

export function BankAssetsSection() {
  const { payload, failed } = useOnOpen<{ board: BankAssetsBoard }>('/api/bancos');

  if (!payload) return <OnOpenNotice what="los bancos con dólar digital" failed={failed} />;

  const { banks, adoption, latestRead } = payload.board;
  if (!banks.length) {
    return (
      <div className="callout">
        Todavía no hay bancos cargados. El panel se llena solo cuando el núcleo del observatorio
        tenga sembrado el catálogo «bank-virtual-assets» (migración 0089).
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Bancos bolivianos que ofrecen dólar digital (cantidad de bancos)</h2>
          <p className="panel-sub">
            Ningún banco publica a qué precio compra o vende su USDT o USDC: la cotización se ve
            dentro de su aplicación. Lo que sí es público es que el servicio exista, desde cuándo y
            con qué límites, y eso es lo que sigue el observatorio, leyendo cada día la página
            oficial de cada banco
            {latestRead ? ` (última lectura: ${sayDate(latestRead)})` : ''}.
          </p>
        </div>
        {adoption.length > 1 ? (
          <DatedLines
            data={adoption}
            series={ADOPTION_SERIES}
            unit="bancos"
            decimals={0}
            domain={[0, Math.max(...adoption.map((point) => point.total)) + 1]}
          />
        ) : (
          <div className="callout">Hace falta más de un día de lecturas para dibujar la línea.</div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Qué ofrece cada banco, desde cuándo y con qué límites</h2>
          <p className="panel-sub">
            Ordenados por fecha de arranque. «Anunciado» es el día que el banco o la prensa dan como
            inicio; «a más tardar» es la fecha del primer documento oficial cuando el banco nunca
            dijo cuándo empezó, así que el servicio pudo abrir antes.
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
              {banks.map((bank) => (
                <tr key={`${bank.bank}-${bank.asset}`} title={bank.note}>
                  <td>
                    <Icon name="chip" size={12} /> {bank.bankName}
                  </td>
                  <td>{bank.product}</td>
                  <td>{bank.asset}</td>
                  <td>
                    {bank.sinceSource ? (
                      <a href={bank.sinceSource} target="_blank" rel="noreferrer">
                        {sayDate(bank.since)}
                      </a>
                    ) : (
                      sayDate(bank.since)
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
                            {limit.label}: <b>{number.format(limit.value)}</b> {limit.unit}
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
    </>
  );
}

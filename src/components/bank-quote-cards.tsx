'use client';

import { Icon } from './icons';
import { useBankBoard } from './bank-board';
import { amount, price, sayLong, sayShort } from './bank-format';
import type { BankProduct } from '@/lib/bank-assets-board';

/**
 * Una tarjeta por banco que ofrece dólar digital, bajo las de USDT y USDC.
 *
 * Usan el mismo esqueleto que las cotizaciones de arriba y el color de la
 * ficha que ofrecen —USDT naranja, USDC rosa—, así que se lee de un vistazo
 * qué banco vende cuál. No hay precio en ellas porque ningún banco lo
 * publica fuera de su aplicación: lo que dicen es desde cuándo, si sigue
 * anunciado hoy y con qué límite.
 */

const ACCENT: Record<string, string> = {
  USDT: 'var(--parallel)',
  USDC: 'var(--gap)',
};

/** El nombre corto con el que se conoce al banco, que es el que cabe en la tarjeta. */
const SHORT_NAME: Record<string, string> = {
  BNB: 'BNB',
  BISA: 'Banco BISA',
  BCP: 'BCP',
  GANADERO: 'Ganadero',
  FIE: 'Banco FIE',
  UNION: 'Banco Unión',
};

function state(bank: BankProduct): string {
  if (bank.offeredNow === null) return 'sin lectura diaria';
  return bank.offeredNow ? 'lo ofrece hoy' : 'ya no lo anuncia';
}

function BankCard({ bank }: { bank: BankProduct }) {
  const accent = ACCENT[bank.asset] ?? 'var(--series-rest)';
  const daily = bank.limits.find((limit) => limit.label.startsWith('Máximo por día en compra'));
  const minimum = bank.limits.find((limit) => limit.label.startsWith('Mínimo por compra'));
  const name = SHORT_NAME[bank.bank] ?? bank.bankName;
  return (
    <article
      className="quote"
      style={{ '--quote-accent': accent } as React.CSSProperties}
      aria-label={`${bank.bankName}: ${bank.product}, ${bank.asset}, desde ${sayLong(bank.since)}`}
    >
      <div className="quote-head">
        <Icon name="banco" size={14} />
        <span className="quote-name">{name}</span>
        <span className="quote-date">{sayShort(bank.since)}</span>
      </div>
      <p className="quote-detail">{bank.product}</p>
      <div className="quote-figure">
        <span className="quote-value">
          {bank.quote?.clientBuys != null ? price(bank.quote.clientBuys) : bank.asset}
        </span>
        <span className="quote-unit">
          {bank.quote?.clientBuys != null ? `Bs por ${bank.asset}` : 'ficha'}
        </span>
      </div>
      <span className="quote-change quote-change-flat">
        {state(bank)}
        {bank.quote ? ` · cotización del ${sayShort(bank.quote.date)}` : ''}
      </span>
      {bank.quote ? (
        <dl className="quote-sides">
          <div>
            <dt>Pagas</dt>
            <dd>{price(bank.quote.clientBuys)}</dd>
          </div>
          <div>
            <dt>Recibes</dt>
            <dd>{price(bank.quote.clientSells)}</dd>
          </div>
        </dl>
      ) : daily && minimum ? (
        <dl className="quote-sides">
          <div>
            <dt>Mínimo</dt>
            <dd>{amount(minimum.value)}</dd>
          </div>
          <div>
            <dt>Máx. por día</dt>
            <dd>{amount(daily.value)}</dd>
          </div>
        </dl>
      ) : null}
    </article>
  );
}

export function BankQuoteCards() {
  const { board } = useBankBoard();
  // Sin datos no se dibuja nada: la portada no muestra un hueco ni un aviso por
  // algo que no es lo que el lector vino a buscar. El detalle y el motivo están
  // en «Tipo de cambio».
  if (!board?.banks.length) return null;

  return (
    <section className="quotes" aria-labelledby="bank-quotes-title">
      <div className="quotes-head">
        <Icon name="banco" size={17} />
        <h2 id="bank-quotes-title">Bancos con dólar digital</h2>
        <span className="tile-hint">desde cuándo lo ofrecen</span>
      </div>
      <div className="quotes-grid">
        {board.banks.map((bank) => (
          <BankCard bank={bank} key={`${bank.bank}-${bank.asset}`} />
        ))}
      </div>
      <p className="quotes-foot">
        <span>Ningún banco publica su cotización fuera de su aplicación</span>
        {board.latestRead ? <span>Última lectura: {sayLong(board.latestRead)}</span> : null}
        <span>Detalle en «Tipo de cambio»</span>
      </p>
    </section>
  );
}

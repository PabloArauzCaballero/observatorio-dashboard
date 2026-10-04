'use client';

import { Panel } from '@/components/ui/panel';
import { useBankBoard } from './bank-board';
import { amount, price, sayLong, sayShort } from './bank-format';
import type { BankProduct } from '@/lib/bank-assets-board';
import styles from './bank-quote-cards.module.css';

/**
 * Los bancos que ofrecen dólar digital, bajo las cotizaciones de USDT y USDC.
 *
 * Tarjeta grande sólo para el banco que da una cifra: el que la publica (BISA,
 * en un archivo de su sitio) o aquel cuyo precio alguien anotó de su
 * aplicación. Usa el mismo esqueleto que las cotizaciones de arriba y el color
 * de su ficha —USDT naranja, USDC rosa—. Los que no publican precio van en una
 * lista al lado, con desde cuándo lo ofrecen y un enlace a donde el lector
 * puede ver la cotización: una tarjeta grande que decía «USDT ficha» ocupaba el
 * sitio de una cifra que no existe.
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

/**
 * A dónde mandar al lector, y con qué palabra, según lo que hay detrás.
 *
 * Revisado el 2026-10-03, incluido el tráfico de red de cada sitio: ninguno de
 * estos sirve su precio sin sesión. FIE es el único que deja cotizar desde la
 * web, en su formulario de apertura; Ganadero lo muestra en GanaMóvil y
 * Gananet, BNB en su aplicación, y Unión no tiene página del servicio —Yasta
 * rechaza las consultas—, así que va el anuncio.
 */
const SERVICE_PAGE: Record<string, { url: string; label: string }> = {
  FIE: {
    url: 'https://cuentacripto.bancofie.com.bo/apertura-cripto',
    label: 'Cotizar en su sitio',
  },
  GANADERO: { url: 'https://www.bg.com.bo/ganacripto/', label: 'Ver el servicio' },
  BNB: {
    url: 'https://www.bnb.com.bo/PortalBNB/Documentos/Cuenta_Cripto.pdf',
    label: 'Ver el servicio',
  },
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
      className={`quote ${styles.priced}`}
      style={{ '--quote-accent': accent } as React.CSSProperties}
      aria-label={`${bank.bankName}: ${bank.product}, ${bank.asset}, desde ${sayLong(bank.since)}`}
    >
      <div className="quote-head">
        <span className="quote-dot" aria-hidden="true" />
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
        {bank.quote
          ? ` · ${bank.quote.basis === 'OFFICIAL_FEED' ? 'publicado por el banco' : 'anotado de su app'} el ${sayShort(bank.quote.date)}`
          : ''}
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

function OtherBanks({ banks, span }: { banks: readonly BankProduct[]; span: number }) {
  return (
    <div className={styles.others} style={{ '--others-span': span } as React.CSSProperties}>
      <div className={styles.othersHead}>
        <span className={styles.othersTitle}>Sin precio público</span>
        <span className={styles.othersHint}>
          no la publican: se ve al operar, en su aplicación o su sitio
        </span>
      </div>
      <ul className={styles.list}>
        {banks.map((bank) => {
          const page = SERVICE_PAGE[bank.bank];
          const link = page?.url ?? bank.sinceSource;
          return (
            <li
              key={`${bank.bank}-${bank.asset}`}
              className={styles.row}
              style={
                {
                  '--asset-tone': ACCENT[bank.asset] ?? 'var(--series-rest)',
                } as React.CSSProperties
              }
            >
              <span className={styles.name}>{SHORT_NAME[bank.bank] ?? bank.bankName}</span>
              <span className={styles.product} title={bank.note}>
                {bank.product} · {state(bank)}
              </span>
              <span className={styles.asset}>{bank.asset}</span>
              <span className={styles.since}>desde {sayShort(bank.since)}</span>
              {link ? (
                <a className={styles.link} href={link} target="_blank" rel="noopener noreferrer">
                  {page?.label ?? 'Ver el anuncio'} ↗
                </a>
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BankQuoteCards() {
  const { board } = useBankBoard();
  // Sin datos no se dibuja nada: la portada no muestra un hueco ni un aviso por
  // algo que no es lo que el lector vino a buscar. El detalle y el motivo están
  // en «Tipo de cambio».
  if (!board?.banks.length) return null;
  const priced = board.banks.filter((bank) => bank.quote?.clientBuys != null);
  const others = board.banks.filter((bank) => bank.quote?.clientBuys == null);
  // La lista ocupa lo que dejan las tarjetas en su última fila de tres.
  const span = 3 - (priced.length % 3);

  return (
    <Panel
      id="bancos-dolar-digital"
      title="Bancos con dólar digital (Bs por ficha)"
      lede={
        priced.length
          ? 'Cuánto cuesta y cuánto paga cada banco que publica su precio; los demás se listan con desde cuándo lo ofrecen.'
          : 'Los bancos que ofrecen dólar digital y desde cuándo lo hacen.'
      }
      meta={board.latestRead ? `última lectura: ${sayLong(board.latestRead)}` : undefined}
      source="el archivo público de BISA, el precio anotado de la aplicación de otros bancos y las páginas y comunicados de cada banco (cada fila dice cuál)"
      data={{
        unidad: 'Bs por ficha',
        columnas: [
          'Banco',
          'Ficha',
          'Producto',
          'Estado',
          'Ofrecido desde',
          'El cliente paga (Bs)',
          'El cliente recibe (Bs)',
          'Fecha del precio',
          'Origen del precio',
        ],
        filas: board.banks.map((bank) => [
          SHORT_NAME[bank.bank] ?? bank.bankName,
          bank.asset,
          bank.product,
          state(bank),
          bank.since,
          bank.quote?.clientBuys ?? null,
          bank.quote?.clientSells ?? null,
          bank.quote?.date ?? null,
          bank.quote
            ? bank.quote.basis === 'OFFICIAL_FEED'
              ? 'publicado por el banco'
              : 'anotado de su aplicación'
            : null,
        ]),
      }}
      className="quotes"
    >
      <div className="quotes-grid">
        {priced.map((bank) => (
          <BankCard bank={bank} key={`${bank.bank}-${bank.asset}`} />
        ))}
        {others.length ? <OtherBanks banks={others} span={span} /> : null}
      </div>
      <p className="quotes-foot">
        <span>Detalle en «Tipo de cambio»</span>
      </p>
    </Panel>
  );
}

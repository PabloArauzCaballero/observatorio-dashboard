import { Sparkline } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { DollarQuote, DollarQuotes, QuoteKey } from '@/lib/dollar-quotes';

/**
 * «¿A cuánto está el dólar?», contestado antes que nada.
 *
 * Tres cotizaciones lado a lado y en la misma escala, cada una con el color que
 * ya tiene en el capítulo del tipo de cambio —USDT naranja, USDC rosa, el
 * oficial azul—, así que quien pasa de aquí a los gráficos no tiene que volver
 * a aprender la paleta. En un teléfono las tres caben en una fila: es la única
 * pantalla de la portada que no se deja apilar, porque compararlas de un
 * vistazo es para lo que existe.
 */

const TONE: Record<QuoteKey, { accent: string; icon: IconName }> = {
  USDT: { accent: 'var(--parallel)', icon: 'monedas' },
  USDC: { accent: 'var(--gap)', icon: 'monedas' },
  OFICIAL: { accent: 'var(--official)', icon: 'banco' },
};

const bs = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** «22 sept.», que es como se dice una fecha reciente. */
const shortDate = (value: string): string =>
  new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${value}T12:00:00Z`),
  );

function Change({ quote }: { quote: DollarQuote }) {
  if (quote.change === null || quote.changePercent === null) {
    return <span className="quote-change quote-change-flat">sin lectura previa</span>;
  }
  const flat = Math.abs(quote.change) < 0.005;
  /*
   * Un dólar más caro es un boliviano que vale menos: al alza es la tinta de lo
   * adverso en todo el informe (`delta-up`), a la baja la de lo favorable.
   */
  const tone = flat ? 'quote-change-flat' : quote.change > 0 ? 'delta-up' : 'delta-down';
  const arrow = flat ? '=' : quote.change > 0 ? '▲' : '▼';
  return (
    <span className={`quote-change ${tone}`} title={`Contra el ${quote.previousDate ?? ''}`}>
      <span aria-hidden="true">{arrow}</span> {flat ? 'sin cambio' : `${bs(Math.abs(quote.change))} Bs`}
      {flat ? null : (
        <span className="quote-change-pct">
          ({quote.changePercent > 0 ? '+' : ''}
          {bs(quote.changePercent, 1)} %)
        </span>
      )}
    </span>
  );
}

function Quote({ quote }: { quote: DollarQuote }) {
  const tone = TONE[quote.key];
  return (
    <article
      className="quote"
      style={{ '--quote-accent': tone.accent } as React.CSSProperties}
      aria-label={`${quote.label}: ${bs(quote.value)} bolivianos por dólar`}
    >
      <div className="quote-head">
        <Icon name={tone.icon} size={14} />
        <span className="quote-name">{quote.label}</span>
        <span className="quote-date">{shortDate(quote.date)}</span>
      </div>
      <p className="quote-detail">{quote.detail}</p>
      <div className="quote-figure">
        <span className="quote-value">{bs(quote.value)}</span>
        <span className="quote-unit">Bs</span>
      </div>
      <Change quote={quote} />
      {quote.buy !== null && quote.sell !== null ? (
        <dl className="quote-sides">
          <div>
            <dt>Compra</dt>
            <dd>{bs(quote.buy)}</dd>
          </div>
          <div>
            <dt>Venta</dt>
            <dd>{bs(quote.sell)}</dd>
          </div>
        </dl>
      ) : null}
      {quote.spark.length > 1 ? (
        <div className="quote-spark">
          <Sparkline data={quote.spark} tone={tone.accent} />
        </div>
      ) : null}
      {quote.venues !== null ? (
        <p className="quote-venues">
          {quote.venues} plaza{quote.venues === 1 ? '' : 's'}
        </p>
      ) : null}
    </article>
  );
}

export function DollarQuotesCard({ data }: { data: DollarQuotes }) {
  if (!data.quotes.length) {
    return (
      <div className="callout">
        No hay cotizaciones del dólar para mostrar en esta carga. El detalle está en «Tipo de
        cambio».
      </div>
    );
  }

  /*
   * Dos días de retraso ya no son «hoy». El recolector corre de madrugada, así
   * que ayer es lo normal; a partir de ahí la tarjeta lo dice en vez de dejar que
   * la cifra se lea como de esta mañana.
   */
  const stale = data.ageDays !== null && data.ageDays >= 2;

  return (
    <section className="quotes" aria-labelledby="quotes-title">
      <div className="quotes-head">
        <Icon name="monedas" size={17} />
        <h2 id="quotes-title">Cotización del dólar</h2>
        <span className="tile-hint">Bs por dólar</span>
      </div>

      <div className="quotes-grid">
        {data.quotes.map((quote) => (
          <Quote quote={quote} key={quote.key} />
        ))}
      </div>

      <p className="quotes-foot">
        {data.usdtOverOfficial !== null ? (
          <span>
            USDT sobre el oficial:{' '}
            <b className={data.usdtOverOfficial > 0 ? 'delta-up' : 'delta-down'}>
              {data.usdtOverOfficial > 0 ? '+' : ''}
              {bs(data.usdtOverOfficial)} %
            </b>
          </span>
        ) : null}
        {data.latestDate ? (
          <span className={stale ? 'quotes-stale' : undefined}>
            {stale
              ? `Último dato del ${shortDate(data.latestDate)}, hace ${data.ageDays} días`
              : `Al ${shortDate(data.latestDate)}`}
          </span>
        ) : null}
        <span>Compra y venta: mediana de las plazas P2P · detalle en «Tipo de cambio»</span>
      </p>
    </section>
  );
}

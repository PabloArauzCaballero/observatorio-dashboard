'use client';

import { useMemo } from 'react';
import { ShareBars } from './charts';
import type { ShareSlice } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import { SETTLEMENT_LABEL, tradeFigure } from './trade-vocabulary';
import type { TradeReading } from '@/lib/series';

/**
 * How the money changes hands, which is what tells an informal sale from a
 * formal one.
 *
 * The channel says where a purchase was found; only the settlement says whether
 * it left a record anywhere. In Bolivia the two halves come apart: an offer is
 * seen on Marketplace, agreed on WhatsApp and paid in cash at the door, and
 * nothing about that operation reaches an invoice.
 *
 * Bases are kept apart on purpose. The share of purchases settled by transfer
 * is measured over purchases made through social networks; the share of cash in
 * the country's payments is measured over every payment a Bolivian makes. They
 * are both percentages and they are not the same denominator, so they never
 * share a chart.
 */

function Plot({
  title,
  icon,
  note,
  children,
}: {
  title: string;
  icon: IconName;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="tile-head">
        <Icon name={icon} size={15} />
        <h3>{title}</h3>
      </div>
      {children}
      <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
        {note}
      </p>
    </div>
  );
}

const HEADLINES: ReadonlyArray<{ metric: string; label: string; icon: IconName }> = [
  { metric: 'QR_PAYMENTS_PER_MINUTE', label: 'Pagos con QR por minuto', icon: 'pulso' },
  { metric: 'QR_PAYMENTS_YOY_GROWTH', label: 'Crecimiento del QR en el año', icon: 'tendencia' },
  {
    metric: 'ELECTRONIC_PAYMENTS_PER_CAPITA',
    label: 'Pagos electrónicos por habitante',
    icon: 'personas',
  },
  { metric: 'MOBILE_WALLET_PROVIDERS', label: 'Billeteras móviles operando', icon: 'monedas' },
  { metric: 'IN_APP_SHOP_AVAILABLE', label: 'Tienda dentro de TikTok', icon: 'tienda' },
];

export function PaymentsExplorer({ readings }: { readings: TradeReading[] }) {
  const latest = useMemo(() => {
    const byMetric = new Map<string, TradeReading>();
    for (const reading of readings) {
      const held = byMetric.get(reading.metric);
      if (!held || held.referencePeriod < reading.referencePeriod)
        byMetric.set(reading.metric, reading);
    }
    return byMetric;
  }, [readings]);

  const headlines = HEADLINES.map((entry) => {
    const reading = latest.get(entry.metric);
    return reading ? { ...entry, reading } : null;
  }).filter((entry): entry is typeof entry & { reading: TradeReading } => entry !== null);

  /** How a purchase made in a social network is settled. Base: those purchases. */
  const socialSettlement: ShareSlice[] = useMemo(
    () =>
      readings
        .filter((reading) => reading.metric.startsWith('SOCIAL_SETTLEMENT_'))
        .map((reading) => ({
          name: SETTLEMENT_LABEL[reading.settlementMeans] ?? reading.settlementMeans,
          value: reading.value,
          ...(reading.settlementMeans === 'CONTRA_ENTREGA' ? { emphasis: true } : {}),
        })),
    [readings],
  );

  /** The share of cash in the country's payments, year by year. Base: all payments. */
  const cash: ShareSlice[] = useMemo(
    () =>
      readings
        .filter((reading) => reading.metric === 'CASH_USE_SHARE')
        .sort((left, right) => left.referencePeriod.localeCompare(right.referencePeriod))
        // No emphasis on either year. Red is this report's warning colour, and
        // cash giving way to traceable payment is not the bar to slow down on.
        .map((reading) => ({ name: reading.referencePeriod, value: reading.value })),
    [readings],
  );

  /** What the QR moved, in dollars, in the two years the compiler published. */
  const qrValue: ShareSlice[] = useMemo(
    () =>
      readings
        .filter((reading) => reading.metric === 'QR_PAYMENTS_VALUE')
        .map((reading) => ({
          name: reading.referencePeriod,
          value: Math.round(reading.value / 1_000_000),
        })),
    [readings],
  );

  const friction = useMemo(
    () => readings.filter((reading) => reading.tradeSide === 'FRICCION'),
    [readings],
  );

  if (!readings.length) {
    return (
      <div className="callout">
        Todavía no hay lecturas de medios de pago cargadas. El modelo existe en la base; se llena
        cuando alguien registra una publicación en el catálogo.
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Con qué se paga</h2>
        </div>
        <p className="panel-sub">
          El canal dice dónde se encontró la venta; el medio de pago dice si quedó registrada en
          alguna parte. Es el tramo donde el comercio boliviano se parte en dos: la vitrina es
          digital y la liquidación, con frecuencia, es efectivo en la puerta.
        </p>
        {headlines.length ? (
          <div className="stat-strip">
            {headlines.map((entry) => (
              <div className="stat" key={entry.metric}>
                <span className="stat-label">
                  <Icon name={entry.icon} size={12} />
                  {entry.label}
                </span>
                <span className="stat-value">
                  {tradeFigure(entry.reading.value, entry.reading.unit)}
                </span>
                <span className="stat-hint">
                  {entry.reading.referencePeriod} · {entry.reading.publisher}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="panel-sub" style={{ marginTop: 'var(--s2)' }}>
          Cifras y no barras: un crecimiento interanual, un recuento de billeteras y una tasa por
          minuto no comparten escala, y un mismo eje haría que la tasa pareciera una mayoría.
        </p>
      </div>

      {socialSettlement.length || cash.length ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="monedas" size={17} />
            <h2>Dos preguntas distintas sobre el pago</h2>
            <span className="tile-hint">bases distintas, gráficos distintos</span>
          </div>
          <div className="grid-two">
            {socialSettlement.length ? (
              <Plot
                title="Cómo se paga una compra hecha en redes"
                icon="tienda"
                note="Base: las compras hechas por redes sociales, en seis ciudades, 2021. Tres de cada diez se pagan en efectivo al recibir el producto —en rojo—, que es el tramo que no deja rastro digital de la operación."
              >
                <ShareBars data={socialSettlement} height={170} />
              </Plot>
            ) : null}
            {cash.length ? (
              <Plot
                title="Cuánto pesa el efectivo en el país"
                icon="banco"
                note="Base distinta: todos los pagos de la población, no solo los de redes. El indicador cayó veintiún puntos en cinco años, desplazado por el QR y la billetera móvil."
              >
                <ShareBars data={cash} height={150} />
              </Plot>
            ) : null}
          </div>
        </div>
      ) : null}

      {qrValue.length ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="barras" size={17} />
            <h2>Lo que mueve el código QR</h2>
            <span className="tile-hint">en millones de dólares</span>
          </div>
          <ShareBars data={qrValue} unit="millones USD" height={140} />
          <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
            El instrumento que absorbió el comercio pequeño: la mayor parte de estas operaciones son
            de monto bajo, del tamaño de una compra de mercado o un pasaje. Que crezca no dice que
            el comercio se formalizó —un cobro por QR puede no emitir factura—, dice que dejó una
            huella que antes no existía.
          </p>
        </div>
      ) : null}

      {friction.length ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="balanza" size={17} />
            <h2>Qué cuesta comerciar</h2>
            <span className="tile-hint">las lecturas que miden fricción</span>
          </div>
          <ul className="note-list">
            {friction.map((reading) => (
              <li key={`${reading.metric}-${reading.referencePeriod}`}>
                <strong>{tradeFigure(reading.value, reading.unit)}</strong> — {reading.label} (
                {reading.referencePeriod}, {reading.publisher})
              </li>
            ))}
          </ul>
          <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
            Ni demanda ni oferta: es el costo de comerciar. Un pago que no se concreta y un impuesto
            que se evade son la misma clase de dato, y son los que un panel microeconómico menos
            puede permitirse perder.
          </p>
        </div>
      ) : null}
    </>
  );
}

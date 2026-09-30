'use client';

import { useMemo } from 'react';
import { DivergingBars, ShareBars, StackedBars } from './charts';
import type { ShareSlice, StackedRow } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import { FORM_LABEL, GOODS_LABEL, REGIME_LABEL, TERRITORY_LABEL } from './trade-vocabulary';
import type { ChannelMix, TradeCoverage, TradeGap, TradeReading } from '@/lib/series';

/**
 * How Bolivia buys and sells, read by form of doing business.
 *
 * The section exists because a country where 71% of households buy their
 * clothing in popular fairs and 9% in supermarkets is not described by a figure
 * about e-commerce. Every panel is cut by the way the trade is conducted —
 * fair, market, neighbourhood shop, mall, network, contraband — and by whether
 * that form invoices anything.
 *
 * Two things this section refuses to do. It never adds channel penetrations
 * into a market share: they are multi-response, the same household is counted
 * in a fair and in a mall, and the sum passing 100 is the finding rather than
 * an error. And it never draws a round chart, because none of these breakdowns
 * exhausts a whole.
 */

/** A titled chart with the sentence that says how to read it. */
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

export function MarketsExplorer({
  coverage,
  mix,
  readings,
  gap,
}: {
  coverage: TradeCoverage[];
  mix: ChannelMix[];
  readings: TradeReading[];
  gap: TradeGap[];
}) {
  /** Readings held per form of trade, informal ones marked. */
  const byForm: ShareSlice[] = useMemo(
    () =>
      coverage
        .filter((row) => !row.unread)
        .map((row) => ({
          name: FORM_LABEL[row.businessForm] ?? row.businessForm,
          value: row.readings,
          ...(row.marketRegime === 'INFORMAL' ? { emphasis: true } : {}),
        })),
    [coverage],
  );

  const unread = coverage.filter((row) => row.unread);

  /** Where a household buys its clothing: the one basket read across channels. */
  const clothing: ShareSlice[] = useMemo(
    () =>
      readings
        .filter(
          (reading) =>
            reading.goodsClass === 'ROPA' &&
            reading.measureKind === 'PENETRACION' &&
            reading.populationScope === 'TOTAL' &&
            reading.tradeSide === 'DEMANDA',
        )
        .map((reading) => ({
          name: FORM_LABEL[reading.businessForm] ?? reading.businessForm,
          value: reading.value,
          ...(reading.marketRegime === 'INFORMAL' ? { emphasis: true } : {}),
        })),
    [readings],
  );

  /** Baskets whose channels can be added up, split by regime. */
  const stacked: StackedRow[] = useMemo(
    () =>
      mix
        .filter((row) => row.oneReadingPerForm && row.formsRead > 1)
        .map((row) => ({
          name: `${GOODS_LABEL[row.goodsClass] ?? row.goodsClass} · ${row.referencePeriod}`,
          informal: row.informalPenetration ?? 0,
          mixto: row.mixedPenetration ?? 0,
          formal: row.formalPenetration ?? 0,
        })),
    [mix],
  );

  const headline = mix.find((row) => row.oneReadingPerForm && row.formsRead > 1);

  const distances = useMemo(
    () =>
      gap.map((row) => ({
        // The period belongs in the name and not only in the tooltip: the same
        // reading is registered for several years, and two bars labelled
        // identically are unreadable — and share a React key.
        name: `${row.label.slice(0, 38)}${row.label.length > 38 ? '…' : ''} · ${row.referencePeriod}`,
        value: row.distancePoints ?? 0,
        meta: `${row.socialPublisher} ${row.socialValue} % · serie medida ${row.measuredValue} % (${row.referencePeriod})`,
      })),
    [gap],
  );

  const informalReadings = readings.filter((reading) => reading.marketRegime === 'INFORMAL').length;
  const compilers = new Set(readings.map((reading) => reading.publisher)).size;

  if (!readings.length) {
    return (
      <div className="callout">
        Todavía no hay lecturas de comercio cargadas. Los modelos existen en la base; se llenan
        cuando alguien registra una publicación en el catálogo.
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Cómo se compra y se vende</h2>
        </div>
        <p className="panel-sub">
          El registro no mide plataformas: mide formas de hacer negocio. Cada lectura queda
          archivada por dónde ocurre la venta, quién está de cada lado del mostrador, con qué se
          paga y en qué lugar del país se midió. Ninguna de estas cifras es una medición del Estado:
          son lecturas que terceros publicaron, con su método y su grado de evidencia.
        </p>
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">
              <Icon name="tienda" size={12} />
              Formas leídas
            </span>
            <span className="stat-value">{coverage.length - unread.length}</span>
            <span className="stat-hint">de {coverage.length} en el vocabulario</span>
          </div>
          <div className="stat">
            <span className="stat-label">
              <Icon name="campana" size={12} />
              Lecturas informales
            </span>
            <span className="stat-value">{informalReadings}</span>
            <span className="stat-hint">de {readings.length} lecturas de comercio</span>
          </div>
          <div className="stat">
            <span className="stat-label">
              <Icon name="personas" size={12} />
              Compiladores
            </span>
            <span className="stat-value">{compilers}</span>
            <span className="stat-hint">casas distintas detrás de las cifras</span>
          </div>
          {headline ? (
            <div className="stat">
              <span className="stat-label">
                <Icon name="capas" size={12} />
                Canales por hogar
              </span>
              <span className="stat-value">{headline.channelsPerHousehold}</span>
              <span className="stat-hint">
                {GOODS_LABEL[headline.goodsClass] ?? headline.goodsClass} ·{' '}
                {headline.referencePeriod}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="panel">
        <div className="tile-head">
          <Icon name="barras" size={17} />
          <h2>Qué puede decir el registro de cada forma</h2>
          <span className="tile-hint">
            {unread.length === 0 ? 'todas con lectura' : `${unread.length} sin lectura`}
          </span>
        </div>
        <ShareBars data={byForm} unit="lecturas" height={Math.max(220, byForm.length * 30)} />
        <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
          En rojo, las formas informales. La altura es cuántas lecturas sostiene cada forma, no
          cuánto comercio mueve: el contrabando tiene seis lecturas y un mercado tradicional una, y
          eso dice quién publica, no quién vende más.{' '}
          {unread.length
            ? `Sin ninguna lectura: ${unread.map((row) => FORM_LABEL[row.businessForm] ?? row.businessForm).join(', ')}.`
            : 'Ninguna forma del vocabulario quedó sin lectura.'}
        </p>
      </div>

      {clothing.length || stacked.length ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="capas" size={17} />
            <h2>Canales de una misma canasta</h2>
            <span className="tile-hint">respuesta múltiple: la suma pasa de 100</span>
          </div>
          <div className="grid-two">
            {clothing.length ? (
              <Plot
                title="Dónde compra ropa el hogar boliviano"
                icon="tienda"
                note="Seis canales medidos por un mismo panel en un mismo año, que es lo que hace comparable esta lista. En rojo los informales: siete de cada diez hogares compran ropa en ferias populares y menos de uno de cada diez en supermercados."
              >
                <ShareBars data={clothing} height={230} />
              </Plot>
            ) : null}
            {stacked.length ? (
              <Plot
                title="Cuánto de esas visitas es informal"
                icon="balanza"
                note="Cada barra suma las penetraciones de los canales de una canasta, separadas por régimen. Pasa de 100 porque el mismo hogar compra en varios canales: no es cuota de mercado ni reparto de dinero, es cuántas decisiones de compra ocurren donde no se factura."
              >
                <StackedBars data={stacked} height={190} />
              </Plot>
            ) : null}
          </div>
          {headline ? (
            <p className="panel-sub" style={{ marginTop: 'var(--s2)' }}>
              Para {(GOODS_LABEL[headline.goodsClass] ?? headline.goodsClass).toLowerCase()} en{' '}
              {headline.referencePeriod} el hogar promedio usa{' '}
              <strong>{headline.channelsPerHousehold} canales</strong> y{' '}
              <strong>{headline.informalShareOfVisits} %</strong> de esas visitas ocurre en canales
              informales. Es participación de visitas, no de dinero: un tique de centro comercial y
              uno de feria no son del mismo tamaño, y el registro no tiene lectura de ninguno de los
              dos.
            </p>
          ) : null}
        </div>
      ) : null}

      {distances.length ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="balanza" size={17} />
            <h2>Distancia contra la serie medida</h2>
            <span className="tile-hint">dos mediciones de una misma economía</span>
          </div>
          <DivergingBars data={distances} height={Math.max(200, distances.length * 34)} />
          <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
            A la derecha, la lectura queda por encima de la serie medida; a la izquierda, por
            debajo. La distancia no es el error de ninguna de las dos: el censo cuenta ocupados por
            cuenta propia y la serie internacional suma además a los trabajadores familiares no
            remunerados, así que once puntos de diferencia son dos definiciones, no una
            equivocación.
          </p>
        </div>
      ) : null}

      {mix.some((row) => !row.oneReadingPerForm) ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="info" size={17} />
            <h2>Lo que no se puede sumar</h2>
          </div>
          <ul className="note-list">
            {mix
              .filter((row) => !row.oneReadingPerForm)
              .map((row) => (
                <li key={`${row.goodsClass}-${row.territory}-${row.referencePeriod}`}>
                  <strong>
                    {GOODS_LABEL[row.goodsClass] ?? row.goodsClass} ·{' '}
                    {TERRITORY_LABEL[row.territory] ?? row.territory} · {row.referencePeriod}
                  </strong>{' '}
                  — {row.readings} lecturas de una sola forma (
                  {row.forms.map((form) => FORM_LABEL[form] ?? form).join(', ')}). Son varias
                  preguntas sobre un mismo canal, no varios canales: sumarlas daría un total que no
                  significa nada, así que el modelo devuelve el conteo y ningún cociente.
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <p className="panel-sub">
        Régimen: {REGIME_LABEL.INFORMAL} es comercio que no factura; {REGIME_LABEL.MIXTO}, el que se
        descubre en una plataforma y se liquida a mano; {REGIME_LABEL.FORMAL}, el que emite factura.
        La clasificación se deriva en la base a partir de la etiqueta de cada lectura y puede
        discutirse fila por fila.
      </p>
    </>
  );
}

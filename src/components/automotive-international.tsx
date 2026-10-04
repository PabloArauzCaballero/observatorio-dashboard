'use client';

import { useState } from 'react';
import { Panel } from './ui/panel';
import { ViewToggle } from './ui/view-toggle';
import { StudyBars } from './automotive-shared';
import { Evidence, price, StudyCaveat, studyDownloads, StudyLoader } from './automotive-shared';
import { offerStatus, type AutomotiveStudy, type AutomotiveOffer } from '@/lib/automotive-analysis';

export function AutomotiveInternational() {
  return <StudyLoader>{study => <International study={study} />}</StudyLoader>;
}

function OfferCard({ row, study }: { row: AutomotiveOffer; study: AutomotiveStudy }) {
  return <article><h4>{row.country} · {row.brand} {row.model}</h4><strong className="automotive-price">{price(row)}</strong><p>{row.version} · MY {row.modelYear ?? 'no informado'}</p><p>{row.priceType} · {offerStatus(row, study.observedAt)}</p><p>{row.conditions}</p><p className="panel-note">Captura {row.observedAt}. {row.validUntil ? `Venció ${row.validUntil}.` : 'Vigencia no informada.'} Impuestos: {row.taxes}. Disponibilidad {row.availability.toLowerCase()}.</p><Evidence study={study} ids={[row.sourceId]} /></article>;
}

function International({ study }: { study: AutomotiveStudy }) {
  const [model, setModel] = useState('Todos');
  const [market, setMarket] = useState('Perú');
  const pairs = study.comparisons.filter(row => model === 'Todos' || row.model === model);
  const foreign = study.offers.filter(row => row.country === market);
  // USD and CLP/ARS never share an axis. Select a single national market first.
  const currency = foreign[0]?.currency ?? '';
  return <>
    <StudyCaveat study={study} />
    <Panel id="automotor-internacional" data={{ columnas: ['Modelo', 'Comparabilidad', 'Diferencias'], filas: pairs.map(d => [d.model,d.grade,d.reason]) }} title="El mismo modelo en otros mercados: precios y diferencias" lede="Ocho pares investigados. No hay un par A confirmado con fecha y condiciones equivalentes; por eso no se publica un porcentaje de sobreprecio." source="Ofertas oficiales de Bolivia, Perú, Chile y Paraguay; Argentina excluida por precio no reproducible" updated={study.observedAt} extraDownloads={studyDownloads}>
      <p><strong>A:</strong> SKU o ficha equivalente, mismo año y condiciones cotejadas. <strong>B:</strong> familia próxima con diferencias pendientes o documentadas. <strong>C:</strong> solo coincide el modelo. Un nombre comercial igual no acredita el mismo vehículo.</p>
      <label className="automotive-select">Modelo <select value={model} onChange={event => setModel(event.target.value)}>{['Todos', ...new Set(study.comparisons.map(row => row.model))].map(value => <option key={value}>{value}</option>)}</select></label>
      {pairs.map(pair => {
        const bo = study.offers.find(row => row.id === pair.boliviaId)!;
        const other = study.offers.find(row => row.id === pair.foreignId)!;
        return <section key={pair.id} className="automotive-pair"><h3>{pair.model} <span className="automotive-badge">Comparabilidad {pair.grade}</span></h3><div className="automotive-cards"><OfferCard row={bo} study={study} /><OfferCard row={other} study={study} /></div><p><strong>Qué falta para comparar:</strong> {pair.reason}</p></section>;
      })}
      <p className="callout">El precio minorista extranjero incluye estructura comercial y tributos propios. No equivale a FOB/CIF exportable ni permite calcular el margen del importador boliviano. Las monedas se conservan en origen; no se hace una conversión sin cotización fechada y condiciones equivalentes.</p>
    </Panel>
    <Panel id="automotor-ofertas-exterior" title="Precios observados por mercado y moneda" source="Listas oficiales y campañas enlazadas en cada registro" updated={study.observedAt} extraDownloads={studyDownloads}>
      <label className="automotive-select">Mercado <select value={market} onChange={event => setMarket(event.target.value)}>{[...new Set(study.offers.filter(row => row.country !== 'Bolivia').map(row => row.country))].map(country => <option key={country}>{country}</option>)}</select></label>
      <ViewToggle chart={<StudyBars data={foreign.map(row => ({ name: `${row.model} ${row.version} ${row.modelYear ?? ''}`, value: row.price, note: `${row.priceType} · ${offerStatus(row, study.observedAt)}. ${row.conditions}` }))} unit={currency} height={Math.max(240, foreign.length * 45)} />} table={<div className="table-wrap"><table className="table"><thead><tr><th>Modelo / versión</th><th>Año</th><th>Precio</th><th>Clase / vigencia</th><th>Condiciones / fuente</th></tr></thead><tbody>{foreign.map(row => <tr key={row.id}><td>{row.brand} {row.model} · {row.version}</td><td>{row.modelYear ?? 'No informado'}</td><td>{price(row)}</td><td>{row.priceType} · {offerStatus(row, study.observedAt)} {row.validUntil ?? ''}</td><td>{row.conditions}<Evidence study={study} ids={[row.sourceId]} /></td></tr>)}</tbody></table></div>} />
      <p className="panel-note">Los precios pertenecen a modelos y condiciones distintas. La gráfica describe anuncios y conserva las campañas vencidas como antecedentes, señaladas en el detalle. No es un ranking internacional de vehículos equivalentes.</p>
    </Panel>
  </>;
}

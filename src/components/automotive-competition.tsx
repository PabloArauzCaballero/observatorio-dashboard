'use client';

import { useState } from 'react';
import { Panel } from './ui/panel';
import { ViewToggle } from './ui/view-toggle';
import { StudyBars } from './automotive-shared';
import { Evidence, num, price, StudyCaveat, studyDownloads, StudyLoader } from './automotive-shared';
import { offerStatus, type AutomotiveStudy } from '@/lib/automotive-analysis';

export function AutomotiveCompetition() {
  return <StudyLoader>{study => <Competition study={study} />}</StudyLoader>;
}

function Competition({ study }: { study: AutomotiveStudy }) {
  const [brand, setBrand] = useState('Todas');
  const domestic = study.offers.filter(row => row.country === 'Bolivia');
  const rows = domestic.filter(row => brand === 'Todas' || row.brand === brand);
  const quoted = rows.filter(row => row.currency === 'USD' && !row.status.startsWith('Conflicto') && row.modelYear !== null);
  return <>
    <StudyCaveat study={study} />
    <Panel id="automotor-redes" data={{ columnas: ['Red', 'Marcas', 'Ciudades publicadas', 'Estado', 'L?mites'], filas: study.dealers.map(d => [d.name,d.brands.join(', '),d.cities.join(', '),d.status,d.caveat]) }} title="Competidores y redes comerciales documentadas" lede="Se distingue la empresa, sus marcas y las ciudades publicadas. No es un censo vigente completo ni un ranking de ventas." source="Sitios y documentos oficiales de cada red" updated={study.observedAt} extraDownloads={studyDownloads}>
      <div className="automotive-cards">{study.dealers.map(dealer => <article key={dealer.id}>
        <span className="automotive-badge">{dealer.status}</span><h3>{dealer.name}</h3>
        <p><strong>Marcas documentadas:</strong> {dealer.brands.join(', ')}.</p><p><strong>Ciudades publicadas:</strong> {dealer.cities.join(', ') || 'Sin lista comprobada en este corte'}.</p>
        <p>{dealer.positioning}</p><p>{dealer.services}</p><p className="panel-note">{dealer.caveat}</p><Evidence study={study} ids={dealer.sourceIds} />
      </article>)}</div>
      <details><summary>Padrón histórico AEMP: {study.historicalDealers.length} empresas (2023–junio 2024)</summary>
        <p>Sirve para identificar empresas que requieren verificación adicional. Las representaciones pueden haber cambiado.</p>
        <ul>{study.historicalDealers.map(row => <li key={row.name}><strong>{row.name}:</strong> {row.brands}. {row.period}.</li>)}</ul><Evidence study={study} ids={['aemp']} />
      </details>
    </Panel>
    <Panel id="automotor-oferta-nacional" title="Precios publicados en Bolivia por versión" lede={`${domestic.length} registros: anuncios por versión, pisos de gama y conflictos. No miden tamaño ni participación del mercado.`} source="Capturas directas de los sitios oficiales; ver condiciones por fila" updated={study.observedAt} extraDownloads={studyDownloads}>
      <label className="automotive-select">Marca <select value={brand} onChange={event => setBrand(event.target.value)}>{['Todas', ...new Set(domestic.map(row => row.brand))].map(value => <option key={value}>{value}</option>)}</select></label>
      <ViewToggle chart={<>
        {quoted.length ? <StudyBars data={quoted.map(row => ({ name: `${row.brand} ${row.model} ${row.version} ${row.modelYear}`, value: row.price, note: row.conditions }))} unit="USD anunciados" height={Math.max(250, quoted.length * 38)} /> : <p className="callout">Esta selección tiene pisos sin versión/moneda confirmada o conflictos. Consultá el registro y sus condiciones.</p>}
        <p className="panel-note">Solo se dibujan precios USD con versión y año identificados, sin conflicto interno declarado. {rows.length - quoted.length} registros adicionales se ven en la tabla. No se promedian versiones de distinto equipamiento.</p>
      </>} table={<div className="table-wrap"><table className="table"><thead><tr><th>Marca / modelo / versión</th><th>Año</th><th>Precio publicado</th><th>Clase / estado</th><th>Vendedor y condiciones</th><th>Evidencia</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.brand} {row.model}<br />{row.version}</td><td>{row.modelYear ?? 'No informado'}</td><td>{price(row)}</td><td>{row.priceType}<br />{offerStatus(row, study.observedAt)}</td><td>{row.dealer ?? 'No identificado'}<br />{row.conditions}<br />Impuestos: {row.taxes}. Stock: {row.availability}.</td><td>{row.observedAt}<Evidence study={study} ids={[row.sourceId]} /></td></tr>)}</tbody></table></div>} />
    </Panel>
    <Panel id="automotor-conflictos" data={{ columnas: ['Asunto', 'Detalle'], filas: study.conflicts.map(d => [d.subject,d.detail]) }} title="Conflictos y cobertura de la investigación" source="Auditoría de las capturas y sus metadatos" updated={study.observedAt} extraDownloads={studyDownloads}>
      {study.conflicts.map(row => <article className="automotive-note" key={row.subject}><h3>{row.subject}</h3><p>{row.detail}</p><Evidence study={study} ids={row.sourceIds} /></article>)}
      <details><summary>{num(study.sources.length)} fuentes consultadas y huellas de archivo</summary><p>Una respuesta HTTP exitosa acredita la captura del documento; no confirma por sí sola la vigencia comercial.</p>
        {study.sources.map(source => <p className="automotive-source" key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><br />Captura: {source.capturedAt}; HTTP {source.httpStatus}; {num(source.bytes)} bytes.<br /><code>SHA-256: {source.sha256}</code></p>)}
      </details>
    </Panel>
  </>;
}

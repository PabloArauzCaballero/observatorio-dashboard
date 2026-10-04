'use client';

import { useState } from 'react';
import { Panel } from './ui/panel';
import { ViewToggle } from './ui/view-toggle';
import { ShareBars, ChartLegend } from './charts';
import { num } from './automotive-shared';
import type { AutomotiveStudy } from '@/lib/automotive-analysis';

export function AutomotiveTrade({ study }: { study: AutomotiveStudy }) {
  const [heading, setHeading] = useState('8703');
  return <Panel id="automotor-importaciones" title="Importaciones por partida (USD CIF)" source="Base aduanera INE del núcleo, grano M_DETAIL; valores anuales por NANDINA y país" lede="8702: transporte de 10 o más personas; 8703: principalmente transporte de personas; 8704: mercancías. Incluye las condiciones que la partida permita; no equivale exclusivamente a vehículos nuevos.">
    <div className="chart-kind" aria-label="Partida arancelaria" role="group">{[['8702','Buses · 8702'],['8703','Pasajeros · 8703'],['8704','Carga · 8704']].map(([id,label]) => <button key={id} className={heading === id ? 'chip chip-on' : 'chip'} aria-pressed={heading === id} onClick={() => setHeading(id!)}>{label}</button>)}</div>
    <TradeDetail key={heading} heading={heading} study={study} />
    <p className="panel-note">{study.trade.definition} Los tres grupos no incluyen motos ni repuestos. País de origen no equivale a nacionalidad de la marca.</p>
  </Panel>;
}

function TradeDetail({ heading, study }: { heading: string; study: AutomotiveStudy }) {
  const url = `/api/comercio-exterior/aduana?flow=M&from=2019&to=2025&product=${heading}&views=serie:year,origen:country`;
  const all = study.trade.annual.filter(row => row.heading === heading);
  const rows = all.filter(row => row.months.length === 12);
  const latest = rows.find(row => row.year === 2025)!;
  const prior = rows.find(row => row.year === 2024)!;
  const partial = all.find(row => row.year === 2026);
  const origin = study.trade.origins;
  return <>
    <p><strong>2025: USD {num(latest.usd / 1e6, 2)} millones CIF</strong>, {num((latest.usd / prior.usd - 1) * 100, 2)}% frente a 2024. Peso: {num(latest.kg / 1e6, 2)} millones de kg ({num((latest.kg / prior.kg - 1) * 100, 2)}%). Cifras provisionales; valor y peso no miden ventas ni cantidad de unidades.</p>
    <ViewToggle chart={<><ShareBars data={rows.map(row => ({ name: `${row.year}${row.provisional ? ' (p)' : ''}`, value: row.usd / 1e6 }))} unit="millones USD CIF" decimals={2} height={300} /><ChartLegend items={[{ color: 'var(--official)', label: `Importaciones anuales, partida ${heading} (millones USD CIF)` }]} /></>} table={<div className="table-wrap"><table className="table"><thead><tr><th>Año</th><th>USD CIF</th><th>kg</th><th>Período</th><th>Estado</th></tr></thead><tbody>{rows.map(row => <tr key={row.year}><td>{row.year}</td><td>{num(row.usd, 2)}</td><td>{num(row.kg, 2)}</td><td>Enero–diciembre</td><td>{row.provisional ? 'Provisional' : 'Sin marca provisional en fuente'}</td></tr>)}</tbody></table></div>} />
    {partial && <p className="callout">Enero–agosto 2026: USD {num(partial.usd / 1e6, 2)} millones CIF, provisional. No se compara con un año completo ni se anualiza.</p>}
    {heading === '8703' && <><h3>Principales orígenes en 2025 · partida 8703</h3><ViewToggle chart={<><ShareBars data={origin.map(row => ({ name: row.name, value: row.usd / 1e6 }))} unit="millones USD CIF" decimals={2} height={320} /><ChartLegend items={[{ color: 'var(--official)', label: 'Ocho principales países de origen, 2025 (p)' }]} /></>} table={<div className="table-wrap"><table className="table"><thead><tr><th>Origen</th><th>USD CIF</th><th>% de 8703</th></tr></thead><tbody>{origin.map(row => <tr key={row.code}><td>{row.name}</td><td>{num(row.usd)}</td><td>{num(row.usd / latest.usd * 100, 2)}%</td></tr>)}</tbody></table></div>} /><p>China, Japón e India concentran {num(origin.slice(0, 3).reduce((sum, row) => sum + row.usd, 0) / latest.usd * 100, 1)}% del valor importado 8703. Para el negocio, conviene medir exposición a fábricas, rutas, monedas y repuestos; esta concentración no describe cuota de marcas.</p></>}
    <p>La caída del valor importado de pasajeros frente a la expansión del parque registrado aconseja revisar reposición y caja con datos propios. No permite atribuir la contracción a una sola causa: precios, composición y cantidad pueden variar simultáneamente.</p>
    <details><summary>Proveniencia y reproducción del cálculo</summary>{study.trade.sources.map(source => <p key={source.year}><a href={source.sourceUrl}>{source.title}</a> · captura {source.retrievedAt} · meses {source.months.join(', ')}.<br /><code>SHA-256 fuente: {source.upstreamSha256}</code></p>)}<p>Agregación reproducible: scripts/automotor/aggregate-trade.py. No se suman M_DETAIL y M_MONTHLY.</p></details>
    <a href={url}>Consultar el núcleo con estos filtros (JSON)</a>
  </>;
}

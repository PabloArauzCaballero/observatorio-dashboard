'use client';

import { useState } from 'react';
import { StudyBars } from './automotive-shared';
import { Panel } from './ui/panel';
import { ViewToggle } from './ui/view-toggle';
import { Evidence, num, StudyCaveat, studyDownloads, StudyLoader } from './automotive-shared';
import { fleetSignals, type AutomotiveStudy } from '@/lib/automotive-analysis';
import { AutomotiveTrade } from './automotive-trade';

export function AutomotiveMarket() {
  return <StudyLoader>{study => <Market study={study} />}</StudyLoader>;
}

function Market({ study }: { study: AutomotiveStudy }) {
  const signals = fleetSignals(study);
  const [dimension, setDimension] = useState('departments');
  const rows = dimension === 'classes' ? study.fleet.classes : dimension === 'ages' ? study.fleet.ages : study.fleet.departments;
  return <>
    <StudyCaveat study={study} />
    <Panel id="automotor-decision" data={{ columnas: ['Decisi?n', 'Evidencia', 'Acci?n', 'Indicador', 'L?mite'], filas: study.decisions.map(d => [d.title,d.evidence,d.action,d.trigger,d.limit]) }} title="Mercado automotor: decisiones para el negocio" source="INE/RUAT, sitios oficiales de marcas, ASFI y Aduana; elaboración del Observatorio" updated={study.observedAt} extraDownloads={studyDownloads}>
      <div className="automotive-kpis">
        <article><small>Parque registrado · 2025</small><strong>{num(signals.total)}</strong><span>Incluye motocicletas; +{num(signals.growth, 2)}% anual.</span></article>
        <article><small>Parque sin motocicletas</small><strong>{num(signals.nonMotorcycle)}</strong><span>+{num(signals.nonMotorcycleGrowth, 2)}% anual. Incluye otras clases.</span></article>
        <article><small>Aporte de motos al aumento neto</small><strong>{num(signals.motorcycleContribution, 1)}%</strong><span>Del incremento de {num(signals.increase)} registros.</span></article>
        <article><small>Modelos hasta 2015</small><strong>{num(signals.through2015 / signals.total * 100, 1)}%</strong><span>Señal para investigar posventa, no ventas aseguradas.</span></article>
      </div>
      <p>El crecimiento agregado sobrestima la expansión de autos si se ignora la composición por clase. La antigüedad del registro y su concentración territorial justifican estudiar reposición, mantenimiento y repuestos junto con vehículos nuevos.</p>
      <Evidence study={study} ids={['ine-fleet']} />
      <div className="automotive-cards">{study.decisions.map(decision => <article key={decision.title}>
        <h3>{decision.title}</h3><p><strong>Evidencia:</strong> {decision.evidence}</p>
        <p><strong>Acción propuesta:</strong> {decision.action}</p><p><strong>Medir:</strong> {decision.trigger}</p>
        <p className="panel-note">{decision.limit}</p><Evidence study={study} ids={decision.sourceIds} />
      </article>)}</div>
    </Panel>
    <Panel id="automotor-parque-serie" title="Parque registrado de Bolivia, 2003–2025 (vehículos)" lede={study.fleet.definition} source="INE, boletín Parque Automotor 2025, gráfico 1; fuente primaria RUAT" updated="Cierre 2025">
      <ViewToggle chart={<StudyBars data={study.fleet.annual.map(row => ({ name: String(row.year), value: row.value }))} unit="vehículos" height={610} />} table={<div className="table-wrap"><table className="table"><thead><tr><th>Año</th><th>Vehículos registrados</th><th>Variación anual</th></tr></thead><tbody>{study.fleet.annual.map((row, i, all) => <tr key={row.year}><td>{row.year}</td><td>{num(row.value)}</td><td>{i ? `${num((row.value / all[i - 1]!.value - 1) * 100, 2)}%` : '—'}</td></tr>)}</tbody></table></div>} />
    </Panel>
    <Panel id="automotor-parque-composicion" title="Composición del parque registrado, 2025 (vehículos)" source="INE/RUAT, cuadros 2, 3 y 4 del boletín 2025" updated="Cierre 2025">
      <div className="chart-kind" role="group" aria-label="Composición del parque">{[['departments','Departamento'],['classes','Clase'],['ages','Año modelo']].map(([id,label]) => <button key={id} className={dimension === id ? 'chip chip-on' : 'chip'} aria-pressed={dimension === id} onClick={() => setDimension(id!)}>{label}</button>)}</div>
      <ViewToggle chart={<StudyBars data={rows.map(row => ({ name: row.name, value: row.value }))} unit="vehículos" height={Math.max(280, rows.length * 35)} />} table={<div className="table-wrap"><table className="table"><thead><tr><th>Grupo</th><th>Registros 2025</th><th>% del total nacional</th><th>2024</th></tr></thead><tbody>{rows.map(row => <tr key={row.name}><td>{row.name}</td><td>{num(row.value)}</td><td>{num(row.value / signals.total * 100, 2)}%</td><td>{'prior' in row ? num(row.prior as number) : 'Ver fuente'}</td></tr>)}</tbody></table></div>} />
      {study.fleet.caveats.map(note => <p className="panel-note" key={note}>{note}</p>)}<Evidence study={study} ids={['ine-fleet']} />
    </Panel>
    <AutomotiveTrade study={study} />
    <Panel id="automotor-entorno" data={{ columnas: ['Tema', 'Hecho', 'Implicaci?n', 'Estado'], filas: study.environment.map(d => [d.topic,d.fact,d.implication,d.status]) }} title="Entorno externo y decisiones de abastecimiento" source="ASFI, Aduana y fuentes oficiales enlazadas" updated={study.observedAt} extraDownloads={studyDownloads}>
      <div className="automotive-cards">{study.environment.map(row => <article key={row.topic}><h3>{row.topic}</h3><p>{row.fact}</p><p><strong>Para el negocio:</strong> {row.implication}</p><p className="panel-note">{row.status}</p><Evidence study={study} ids={row.sourceIds} /></article>)}</div>
      <h3>Datos que aún limitan las decisiones</h3><ul>{study.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
    </Panel>
  </>;
}

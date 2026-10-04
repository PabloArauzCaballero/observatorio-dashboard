'use client';

import { useState } from 'react';
import { Panel } from './ui/panel';
import { ViewToggle } from './ui/view-toggle';
import { StudyBars } from './automotive-shared';
import { num } from './automotive-shared';
import { inventoryScenario, ownershipCost, type InventoryInputs } from '@/lib/automotive-analysis';

const initial: InventoryInputs = { purchaseUsd: 15000, freightUsd: 1000, fx: 7, taxesBob: 28000, recoverableTaxBob: 0, localBob: 3000, units: 10, days: 90, annualRate: 15, targetMargin: 18, fixedMonthlyBob: 40000 };
const labels: Record<keyof InventoryInputs, string> = {
  purchaseUsd: 'Compra FOB por unidad (USD)', freightUsd: 'Flete y seguro por unidad (USD)', fx: 'Costo efectivo de USD (Bs/USD)', taxesBob: 'Tributos no recuperables por unidad (Bs)', recoverableTaxBob: 'Tributos recuperables adelantados (Bs)', localBob: 'Logística local por unidad (Bs)', units: 'Unidades compradas', days: 'Días de caja inmovilizada', annualRate: 'Costo financiero simple anual (%)', targetMargin: 'Margen objetivo sobre venta neta (%)', fixedMonthlyBob: 'Costos fijos mensuales (Bs)',
};

export function AutomotiveScenarios() {
  const [inputs, setInputs] = useState(initial);
  const baseline = inventoryScenario(inputs);
  const scenarios = [
    { name: 'Supuestos ingresados', input: inputs },
    { name: 'USD +20%; tributos constantes', input: { ...inputs, fx: inputs.fx * 1.2 } },
    { name: '60 días más de inventario', input: { ...inputs, days: inputs.days + 60 } },
    { name: 'Financiación +5 puntos', input: { ...inputs, annualRate: inputs.annualRate + 5 } },
  ].map(row => ({ ...row, result: inventoryScenario(row.input) }));
  return <div className="automotive-study">
    <Panel id="automotor-inventario" title="Inventario y precio objetivo: simulación en bolivianos" lede="Los valores iniciales son un ejemplo hipotético. Ingresá costos y condiciones propios; no son tasas vigentes ni márgenes observados de concesionarios." source="Modelo explícito del Observatorio; entradas del usuario">
      <div className="automotive-inputs">{(Object.keys(labels) as Array<keyof InventoryInputs>).map(key => <label key={key}>{labels[key]}<input type="number" min="0" step={key === 'units' || key === 'days' ? '1' : '0.01'} max={key === 'targetMargin' ? '99.99' : undefined} value={Number.isFinite(inputs[key]) ? inputs[key] : ''} onChange={event => setInputs(value => ({ ...value, [key]: event.target.value === '' ? NaN : Number(event.target.value) }))} /></label>)}</div>
      <button className="chip" onClick={() => setInputs(initial)}>Restablecer ejemplo</button>
      {!baseline ? <p role="alert" className="callout">Completá valores no negativos, tipo de cambio mayor que cero y margen menor que 100%.</p> : <>
        <div className="automotive-kpis"><article><small>Caja comprometida en el lote</small><strong>Bs {num(baseline.workingCapital)}</strong><span>Incluye tributos recuperables adelantados.</span></article><article><small>Financiación por unidad</small><strong>Bs {num(baseline.financing)}</strong><span>{inputs.days} días; interés simple sobre toda la caja.</span></article><article><small>Precio neto objetivo por unidad</small><strong>Bs {num(baseline.targetPrice)}</strong><span>Antes de impuestos sobre la venta y comisiones no ingresadas.</span></article><article><small>Unidades/mes para cubrir costos fijos</small><strong>{baseline.breakEvenUnits === null ? 'No definido' : num(baseline.breakEvenUnits)}</strong><span>Al margen y plazo ingresados; sin límite de demanda.</span></article></div>
        <ViewToggle chart={<StudyBars legend="Precio neto objetivo simulado (Bs por unidad)" data={scenarios.filter(row => row.result).map(row => ({ name: row.name, value: row.result!.targetPrice }))} unit="Bs netos por unidad" decimals={0} height={260} />} table={<div className="table-wrap"><table className="table"><thead><tr><th>Escenario</th><th>Costo económico/unidad</th><th>Financiación/unidad</th><th>Precio neto objetivo</th><th>Caja lote</th></tr></thead><tbody>{scenarios.map(row => row.result && <tr key={row.name}><td>{row.name}</td><td>{num(row.result.economicCost)}</td><td>{num(row.result.financing)}</td><td>{num(row.result.targetPrice)}</td><td>{num(row.result.workingCapital)}</td></tr>)}</tbody></table></div>} />
      </>}
      <details><summary>Fórmulas y límites</summary><p>Costo económico = (FOB + flete + seguro) × Bs/USD + tributos no recuperables + gastos locales. Caja = costo económico + tributos recuperables adelantados. Interés = caja × tasa anual × días / 365. Precio objetivo neto = (costo económico + interés) / (1 − margen). Punto de equilibrio = costos fijos mensuales / contribución unitaria, redondeado hacia arriba.</p><p>El margen se calcula sobre ventas, no como recargo sobre costo. El ejemplo supone financiación de toda la caja durante el plazo ingresado, sin anticipo del cliente. El escenario de divisas mantiene tributos en Bs constantes: es una sensibilidad parcial, no una liquidación aduanera. Usar montos cotizados por subpartida; añadir seguros comerciales, garantía, comisiones e impuestos de venta si corresponde.</p></details>
    </Panel>
    <Ownership />
    <Panel id="automotor-respuestas" title="Respuestas ante cambios del entorno" source="Hipótesis de gestión; requieren datos del negocio" downloadable={false}>
      <div className="automotive-cards"><article><h3>Presión de divisas</h3><p>Señales: costo efectivo del dólar, plazo del giro y costo de reposición. Respuesta: acortar vigencia de cotización, escalonar pedidos y medir la caja necesaria para reponer cada venta.</p></article><article><h3>Inventario más lento</h3><p>Señales: días de stock, reservas y descuentos por año modelo. Respuesta: reducir profundidad por versión, negociar lote y fecha de pago, evaluar liquidación contra costo financiero de esperar.</p></article><article><h3>Adopción de híbridos y eléctricos</h3><p>Señales: costo de uso por recorrido real, acceso a carga, garantía y repuestos. Respuesta: probar unidades y capacidad de servicio antes de aumentar volumen; revisar vigencia tributaria al nacionalizar.</p></article><article><h3>Competencia por crédito</h3><p>Señales: inicial, tasa efectiva, seguros, cuota final y tasa de aprobación. Respuesta: cotizar costo total financiado y precio al contado por separado. Un bono no prueba un menor desembolso total.</p></article></div>
    </Panel>
  </div>;
}

function Ownership() {
  const [values, setValues] = useState([150000,75000,5,15000,8,7,6000]);
  const names = ['Compra (Bs)','Reventa esperada (Bs)','Años de uso','Kilómetros por año','Litros o kWh / 100 km','Bs por litro o kWh','Seguro, mantenimiento y otros (Bs/año)'];
  const cost = ownershipCost(values[0]!,values[1]!,values[2]!,values[3]!,values[4]!,values[5]!,values[6]!);
  return <Panel id="automotor-costo-uso" data={() => cost ? {columnas: ['Indicador', 'Valor'], filas: [['Costo neto (Bs)', cost.total], ['Energía (Bs)', cost.energy], ['Costo/km (Bs)', cost.perKm], ...names.map((n,i) => [n, values[i]!])]} : undefined} title="Costo de uso: compra, energía, mantenimiento y reventa" lede="Ejemplo hipotético editable. Elegí una tecnología y usá unidades consistentes: litros para combustión o kWh para eléctrico." source="Supuestos del usuario; cálculo sin financiación ni descuento temporal">
    <div className="automotive-inputs">{names.map((label,index) => <label key={label}>{label}<input type="number" min="0" step="0.1" value={Number.isFinite(values[index]) ? values[index] : ''} onChange={event => setValues(old => old.map((v,i) => i === index ? (event.target.value === '' ? NaN : Number(event.target.value)) : v))} /></label>)}</div>
    {cost ? <div className="automotive-kpis"><article><small>Costo neto del período</small><strong>Bs {num(cost.total)}</strong></article><article><small>Energía del período</small><strong>Bs {num(cost.energy)}</strong></article><article><small>Costo por kilómetro</small><strong>Bs {num(cost.perKm, 2)}</strong></article></div> : <p role="alert">Revisá los valores: años y kilómetros deben ser positivos; reventa no puede superar compra.</p>}
    <p className="panel-note">Costo = compra − reventa + años × (km/año × consumo/100 × precio de energía + otros costos anuales). No incluye costo de capital, cargador, batería ni reparaciones extraordinarias salvo que los ingreses. Para comparar dos tecnologías, conservar horizonte y kilometraje y sustituir sus costos documentados.</p>
  </Panel>;
}

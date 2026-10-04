import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fleetSignals, inventoryScenario, ownershipCost, offerStatus } from '../../src/lib/automotive-analysis.ts';

const study = JSON.parse(readFileSync(new URL('../../src/data/automotive-study.json', import.meta.url), 'utf8'));

test('los tres desgloses del parque reconcilian con el total del INE y no se confunden con ventas', () => {
  const signals = fleetSignals(study);
  assert.equal(signals.total, 2672176);
  for (const key of ['departments', 'classes', 'ages']) assert.equal(study.fleet[key].reduce((s,r) => s+r.value,0),signals.total);
  assert.equal(signals.increase, 88893);
  assert.equal(signals.nonMotorcycle,1740971);
  assert.equal(signals.through2015,1657193);
  assert.ok(signals.nonMotorcycleGrowth < signals.growth);
});

test('evidencia y comparaciones: referencias válidas, vigencia y ninguna brecha B/C', () => {
  const ids = new Set(study.offers.map(o => o.id));
  assert.equal(ids.size,study.offers.length);
  for (const offer of study.offers) {
    const source = study.sources.find(s => s.id === offer.sourceId);
    assert.equal(source.httpStatus,200);
    assert.equal(source.capturedAt.slice(0,10),offer.observedAt);
    if (offer.validUntil && offer.validUntil < study.observedAt) assert.equal(offerStatus(offer,study.observedAt),'Vencida');
  }
  for (const pair of study.comparisons) {
    assert.ok(ids.has(pair.boliviaId) && ids.has(pair.foreignId));
    if (pair.grade !== 'A') assert.equal(pair.directGapAllowed,false);
  }
  assert.equal(study.offers.some(o => o.id === 'ar-kardian'),false);
});

test('importaciones: corte anual coincide con consulta del núcleo; 2026 se conserva parcial', () => {
  const row = study.trade.annual.find(r => r.year===2025 && r.heading==='8703');
  assert.equal(row.usd,286593687);
  assert.equal(row.kg,25321733);
  assert.equal(row.months.length,12);
  assert.equal(row.provisional,true);
  assert.ok(study.trade.annual.filter(r => r.year===2026).every(r => r.months.length===8));
});

test('margen sobre venta, IVA recuperable y financiación tienen bases distintas', () => {
  const input = { purchaseUsd:100, freightUsd:0, fx:1, taxesBob:0, recoverableTaxBob:20,localBob:0,units:10,days:365,annualRate:10,targetMargin:20,fixedMonthlyBob:70 };
  const result = inventoryScenario(input);
  assert.equal(result.economicCost,100);
  assert.equal(result.workingCapital,1200);
  assert.equal(result.financing,12);
  assert.equal(result.targetPrice,140);
  assert.equal(result.breakEvenUnits,3);
  assert.equal(inventoryScenario({...input,targetMargin:100}),null);
  assert.equal(inventoryScenario({...input,fx:0}),null);
  assert.equal(inventoryScenario({...input,days:NaN}),null);
});

test('costo de uso incluye residual y distancia, y rechaza divisiones indefinidas', () => {
  const value = ownershipCost(10000,4000,2,10000,5,2,500);
  assert.equal(value.total,9000);
  assert.equal(value.perKm,0.45);
  assert.equal(ownershipCost(100,200,2,10000,5,2,500),null);
  assert.equal(ownershipCost(100,0,0,10000,5,2,500),null);
});

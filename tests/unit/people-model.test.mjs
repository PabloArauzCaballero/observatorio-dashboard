/*
 * «Personalidades»: el resumen que arma la ruta y las cuentas de la pestaña.
 *
 * Correr con: node --test tests/unit/people-model.test.mjs
 *
 * Se prueba con los JSON reales de la investigación, no con ejemplos: lo que se afirma aquí
 * (el índice se reconstruye, la cobertura por sector) es lo que ve el lector.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildDetail, buildSummary, splitUrl } from '../../src/lib/people-payload.ts';
import {
  NO_FILTERS,
  applyFilters,
  contributions,
  coverageBySector,
  filtersFromParams,
  filtersToParams,
  histogram,
  initials,
  lensRows,
  median,
  netOf,
  scatterPoints,
  sectorStats,
  signed,
  sortRows,
  talkState,
} from '../../src/components/people/people-model.ts';

const load = (name) =>
  JSON.parse(readFileSync(new URL(`../../src/data/${name}.json`, import.meta.url), 'utf8'));

const raw = {
  ranking: load('people-impact-ranking-2025'),
  top300: load('people-top300'),
  conversation: load('people-conversation'),
  pilot: load('people-pilot-3'),
};
const summary = buildSummary(raw);
const bySlug = new Map(summary.people.map((p) => [p.slug, p]));

test('el resumen trae a todas las personas y pesa una fracción de lo que pesaba', () => {
  assert.equal(summary.people.length, raw.top300.people.length);
  const kb = Buffer.byteLength(JSON.stringify(summary)) / 1024;
  assert.ok(kb < 200, `el resumen pesa ${kb.toFixed(0)} KB`);
  // Las direcciones de cuentas no verificadas y la evidencia larga no viajan en el resumen.
  assert.ok(!JSON.stringify(summary).includes('unverifiedAccounts'));
  assert.ok(!JSON.stringify(summary).includes('wikidata.org/entity'));
});

test('el índice se reconstruye con el aporte de cada fuente', () => {
  const w = summary.method.weights;
  let medidas = 0;
  for (const person of summary.people.filter((p) => p.measured)) {
    const sum = contributions(person, w).reduce((acc, c) => acc + c.points, 0);
    assert.ok(
      Math.abs(sum - person.score) < 0.2,
      `${person.name}: ${sum} frente a ${person.score}`,
    );
    medidas += 1;
  }
  assert.equal(medidas, summary.method.measuredPeople);
});

test('sin dato no es poco dato: una fuente ausente se marca ausente y aporta cero', () => {
  const dunn = bySlug.get('P_JAIME_DUNN');
  assert.ok(dunn);
  const views = contributions(dunn, summary.method.weights).find((c) => c.key === 'views');
  assert.equal(views.present, false);
  assert.equal(views.points, 0);
  assert.equal(views.percentile, null);
});

test('la nota de actualidad de Ipsos pierde el enlace pegado en medio de la frase', () => {
  const { currentness, currentnessUrl } = summary.ranking;
  assert.ok(!/https?:/.test(currentness));
  assert.match(currentnessUrl, /^https:\/\/www\.ipsosciesmori\.com\//);
  assert.deepEqual(splitUrl('Sin enlace.'), { text: 'Sin enlace.', url: null });
  assert.deepEqual(splitUrl('Mirar el sitio: https://a.bo/x.'), {
    text: 'Mirar el sitio.',
    url: 'https://a.bo/x',
  });
});

test('las dos lentes: Ipsos frente al puesto del índice, con el motivo cuando la distancia es grande', () => {
  const rows = lensRows(summary.ranking.people, summary.people, summary.people.length);
  assert.equal(rows.length, 5);
  const dunn = rows.find((r) => r.slug === 'P_JAIME_DUNN');
  assert.equal(dunn.ipsosRank, 5);
  assert.ok(dunn.indexRank > 200);
  assert.match(dunn.why, /Wikipedia/);
  const paz = rows.find((r) => r.slug === 'P_RODRIGO_PAZ_PEREIRA');
  assert.equal(paz.why, null);
});

test('la cobertura por sector dice lo que de verdad hay: Empresas solo Merco, Ciencia nada', () => {
  const cov = coverageBySector(summary.people);
  const empresas = cov.find((c) => c.key === 'BUSINESS');
  assert.equal(empresas.n, 99);
  assert.equal(empresas.merco, 99);
  assert.ok(empresas.views <= 1);
  const ciencia = cov.find((c) => c.key === 'SCIENCE');
  assert.equal(ciencia.n, 11);
  assert.equal(ciencia.views + ciencia.social + ciencia.merco, 0);
  const stats = sectorStats(summary.people);
  assert.equal(stats.find((s) => s.key === 'SCIENCE').median, null);
  assert.equal(
    stats.reduce((acc, s) => acc + s.n, 0),
    summary.people.length,
  );
});

test('los filtros se cruzan y el orden respeta «mayor es mejor» también en Merco', () => {
  const politica = applyFilters(summary.people, { ...NO_FILTERS, sectors: ['POLITICS'] });
  assert.ok(politica.every((p) => p.sector === 'POLITICS'));
  const conSentimiento = applyFilters(politica, {
    ...NO_FILTERS,
    sectors: ['POLITICS'],
    only: ['talk'],
  });
  assert.ok(
    conSentimiento.length > 0 && conSentimiento.every((p) => talkState(p) === 'publishable'),
  );
  const rango = applyFilters(summary.people, { ...NO_FILTERS, min: 60 });
  assert.ok(rango.every((p) => p.measured && p.score >= 60));
  const busqueda = applyFilters(summary.people, { ...NO_FILTERS, query: 'anez' });
  assert.ok(busqueda.some((p) => p.name.includes('Áñez')));
  const merco = sortRows(applyFilters(summary.people, { ...NO_FILTERS, only: ['merco'] }), 'merco');
  assert.equal(merco[0].components.mercoRank, 1);
});

test('los filtros viajan en la dirección y una dirección inventada no rompe nada', () => {
  const f = {
    sectors: ['POLITICS', 'SPORTS'],
    min: 40,
    max: 90,
    only: ['views', 'talk'],
    query: 'luis',
    sort: 'views',
  };
  const params = filtersToParams(f);
  const back = filtersFromParams((name) => params[name] ?? null);
  assert.deepEqual(back, f);
  assert.deepEqual(filtersToParams(NO_FILTERS), {
    sector: null,
    desde: null,
    hasta: null,
    con: null,
    q: null,
    orden: null,
  });
  const roto = filtersFromParams(
    (name) =>
      ({ sector: 'MARCIANOS,POLITICS', desde: 'abc', hasta: '500', con: 'x', orden: 'caos' })[
        name
      ] ?? null,
  );
  assert.deepEqual(roto.sectors, ['POLITICS']);
  assert.equal(roto.min, 0);
  assert.equal(roto.max, 100);
  assert.deepEqual(roto.only, []);
  assert.equal(roto.sort, 'score');
  const invertido = filtersFromParams((name) => ({ desde: '80', hasta: '20' })[name] ?? null);
  assert.ok(invertido.min <= invertido.max);
});

test('el histograma cuenta a las medidas y la dispersión solo a quien tiene las dos cifras', () => {
  const bins = histogram(summary.people);
  assert.equal(bins.length, 10);
  assert.equal(
    bins.reduce((acc, b) => acc + b.count, 0),
    summary.method.measuredPeople,
  );
  const points = scatterPoints(summary.people);
  assert.ok(points.length > 0 && points.every((p) => p.views > 0 && p.followers > 0));
});

test('el sentimiento: saldo con signo y estado de la muestra', () => {
  const publicables = summary.people.filter((p) => talkState(p) === 'publishable');
  assert.equal(publicables.length, summary.conversation.peoplePublishable);
  for (const p of publicables) assert.equal(typeof netOf(p), 'number');
  assert.equal(netOf(summary.people.find((p) => talkState(p) === 'none')), null);
  assert.equal(signed(21), '+21');
  assert.equal(signed(-54.1), '−54,1');
  assert.equal(signed(0), '0');
  assert.ok(summary.words.length > 10 && summary.words[0].count >= summary.words[1].count);
});

test('la ficha trae lo que el resumen calla, y una persona inexistente no tiene ficha', () => {
  const doria = buildDetail(raw, 'P_SAMUEL_DORIA_MEDINA');
  assert.ok(doria.evidence.length >= 3);
  assert.ok(doria.verifiedAccounts.every((a) => a.url.startsWith('http')));
  assert.ok(doria.videos.length > 0 && doria.words.length > 0);
  assert.equal(buildDetail(raw, 'P_NO_EXISTE'), null);
  const sacaca = buildDetail(raw, 'P_ALBERTINA_SACACA');
  assert.ok(sacaca.own && sacaca.own.words.length > 0);
});

test('mediana, iniciales', () => {
  assert.equal(median([]), null);
  assert.equal(median([1, 9, 5]), 5);
  assert.equal(median([1, 3]), 2);
  assert.equal(initials('Samuel Doria Medina'), 'SM');
  assert.equal(initials('Jorge ‘Tuto’ Quiroga'), 'JQ');
  assert.equal(initials('Madonna'), 'M');
  assert.equal(initials(''), '?');
});

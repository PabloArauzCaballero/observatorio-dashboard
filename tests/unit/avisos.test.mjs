/*
 * Los avisos a clientes: qué aviso le toca a cada cuenta, con qué llave de
 * periodo, qué dice el correo y cómo se comprueba el secreto de la tarea.
 *
 * Correr con: node --test tests/unit/avisos.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLANS } from '../../src/lib/plans.ts';
import {
  EXPIRY_WINDOW_DAYS,
  GRACE_DAYS,
  bearerMatches,
  decideNotices,
  escapeHtml,
  laPazDate,
  linkMail,
  monthKey,
  monthlyQuotas,
  nextMonthStart,
  noticeMail,
  proseDate,
} from '../../src/lib/cuenta/avisos-puro.ts';

/** 27 de octubre de 2026, 12:00 UTC (08:00 en La Paz). */
const AHORA = new Date(Date.UTC(2026, 9, 27, 12, 0, 0));
const ORIGEN = 'https://datosbolivia.com';

/** Las 23:59:59 de un día de La Paz, como lo guarda el núcleo al registrar un pago. */
const finDeDia = (dia) => new Date(`${dia}T23:59:59.000-04:00`).toISOString();

const candidata = ({ usage = [], ...account } = {}) => ({
  account: {
    subscriberAccountId: '7d1c2a5e-3b4f-4c6d-8e9f-0a1b2c3d4e5f',
    email: 'analista@ejemplo.bo',
    fullName: 'Ana Lista',
    planCode: 'analista',
    effectiveStatus: 'ACTIVE',
    entitled: true,
    paidUntil: finDeDia('2026-12-31'),
    ...account,
  },
  usage,
  members: 0,
});

const api = (used) => [
  { usageKind: 'API', used },
  { usageKind: 'DOWNLOAD', used: 3 },
  { usageKind: 'CHAT', used: 5 },
  { usageKind: 'MAP', used: 0 },
];

/* --------------------------------- Fechas --------------------------------- */

test('la llave del mes y el reinicio del cupo van en UTC, también al cambiar de año', () => {
  assert.equal(monthKey(AHORA), '2026-10');
  assert.equal(nextMonthStart(AHORA), '2026-11-01');
  assert.equal(nextMonthStart(new Date(Date.UTC(2026, 11, 31, 23, 0))), '2027-01-01');
  // Las 22:00 del 31 de octubre en La Paz ya son noviembre en UTC: el contador del núcleo también.
  assert.equal(monthKey(new Date('2026-10-31T22:00:00-04:00')), '2026-11');
});

test('el día de La Paz de una vigencia es el que escribió el operador, no el día UTC', () => {
  assert.equal(laPazDate(finDeDia('2026-11-30')), '2026-11-30');
  assert.equal(laPazDate('2026-12-01T03:59:59.000Z'), '2026-11-30');
  assert.equal(laPazDate('2026-12-01T04:00:00.000Z'), '2026-12-01');
  assert.equal(laPazDate(null), null);
  assert.equal(laPazDate('no es una fecha'), null);
});

test('la fecha en prosa sigue el libro de estilo', () => {
  assert.equal(proseDate('2026-11-30'), '30 de noviembre de 2026');
  assert.equal(proseDate('2027-01-01'), '1 de enero de 2027');
});

/* --------------------------------- Cupos ---------------------------------- */

test('solo la API tiene un cupo mensual comparable', () => {
  const analista = PLANS.find((plan) => plan.code === 'analista');
  const gratis = PLANS.find((plan) => plan.code === 'gratis');
  assert.deepEqual(monthlyQuotas(analista), { API: analista.apiPorMes });
  assert.deepEqual(monthlyQuotas(gratis), {});
});

/* -------------------------------- Consumo --------------------------------- */

test('USAGE_80 sale al llegar al 80 % de la API, con el mes UTC como llave', () => {
  const cupo = PLANS.find((plan) => plan.code === 'analista').apiPorMes;
  const [aviso, ...resto] = decideNotices(candidata({ usage: api(cupo * 0.8) }), PLANS, AHORA);
  assert.equal(resto.length, 0);
  assert.equal(aviso.kind, 'USAGE_80');
  assert.equal(aviso.periodKey, '2026-10');
  assert.equal(aviso.renewsOn, '2026-11-01');
  assert.deepEqual(aviso.lines, [{ kind: 'API', used: cupo * 0.8, quota: cupo, share: 0.8 }]);
});

test('USAGE_80 no sale un consumo por debajo del 80 %', () => {
  const cupo = PLANS.find((plan) => plan.code === 'analista').apiPorMes;
  assert.deepEqual(decideNotices(candidata({ usage: api(cupo * 0.8 - 1) }), PLANS, AHORA), []);
});

test('USAGE_80 suma las filas de un mismo tipo y mide contra el cupo del plan de la cuenta', () => {
  const profesional = PLANS.find((plan) => plan.code === 'profesional').apiPorMes;
  const filas = [
    { usageKind: 'API', used: profesional * 0.5 },
    { usageKind: 'API', used: profesional * 0.3 },
  ];
  const avisos = decideNotices(candidata({ planCode: 'profesional', usage: filas }), PLANS, AHORA);
  assert.deepEqual(avisos.map((aviso) => aviso.kind), ['USAGE_80']);
  // El mismo consumo en Analista sería muy superior al cupo; en Profesional es justo el 80 %.
  assert.equal(avisos[0].lines[0].share, 0.8);
});

test('USAGE_80 no sale a una cuenta sin derecho al plan ni a un plan desconocido', () => {
  const lleno = api(1_000_000);
  assert.deepEqual(
    decideNotices(candidata({ usage: lleno, effectiveStatus: 'SUSPENDED', entitled: false }), PLANS, AHORA),
    [],
  );
  assert.deepEqual(
    decideNotices(candidata({ usage: lleno, effectiveStatus: 'EXPIRED', entitled: false, paidUntil: finDeDia('2026-09-30') }), PLANS, AHORA),
    [],
  );
  assert.deepEqual(decideNotices(candidata({ usage: lleno, planCode: 'inexistente' }), PLANS, AHORA), []);
});

/* ------------------------------ Vencimiento ------------------------------- */

test('EXPIRY_5D sale cuando la vigencia termina dentro de cinco días, con el día de La Paz como llave', () => {
  const [aviso, ...resto] = decideNotices(candidata({ paidUntil: finDeDia('2026-10-31') }), PLANS, AHORA);
  assert.equal(resto.length, 0);
  assert.deepEqual(aviso, { kind: 'EXPIRY_5D', periodKey: '2026-10-31', endsOn: '2026-10-31', trial: false });
});

test('EXPIRY_5D marca la prueba como prueba', () => {
  const [aviso] = decideNotices(
    candidata({ effectiveStatus: 'TRIAL', paidUntil: finDeDia('2026-10-28') }),
    PLANS,
    AHORA,
  );
  assert.equal(aviso.kind, 'EXPIRY_5D');
  assert.equal(aviso.trial, true);
});

test('EXPIRY_5D respeta el borde de la ventana', () => {
  const borde = new Date(AHORA.getTime() + EXPIRY_WINDOW_DAYS * 86_400_000).toISOString();
  const fuera = new Date(AHORA.getTime() + EXPIRY_WINDOW_DAYS * 86_400_000 + 1).toISOString();
  assert.deepEqual(decideNotices(candidata({ paidUntil: borde }), PLANS, AHORA).map((a) => a.kind), ['EXPIRY_5D']);
  assert.deepEqual(decideNotices(candidata({ paidUntil: fuera }), PLANS, AHORA), []);
});

test('EXPIRY_5D no sale a una cuenta suspendida, aunque su vigencia termine pronto', () => {
  assert.deepEqual(
    decideNotices(
      candidata({ effectiveStatus: 'SUSPENDED', entitled: false, paidUntil: finDeDia('2026-10-30') }),
      PLANS,
      AHORA,
    ),
    [],
  );
});

/* --------------------------------- Gracia --------------------------------- */

test('GRACE sale en gracia, con el día del vencimiento como llave y no repite EXPIRY_5D', () => {
  const avisos = decideNotices(
    candidata({ effectiveStatus: 'GRACE', paidUntil: finDeDia('2026-10-24') }),
    PLANS,
    AHORA,
  );
  assert.deepEqual(avisos, [
    { kind: 'GRACE', periodKey: '2026-10-24', endedOn: '2026-10-24', graceEndsOn: '2026-10-29' },
  ]);
  assert.equal(GRACE_DAYS, 5);
});

test('una cuenta en gracia con la API casi agotada recibe los dos avisos', () => {
  const cupo = PLANS.find((plan) => plan.code === 'analista').apiPorMes;
  const avisos = decideNotices(
    candidata({ effectiveStatus: 'GRACE', paidUntil: finDeDia('2026-10-25'), usage: api(cupo) }),
    PLANS,
    AHORA,
  );
  assert.deepEqual(avisos.map((aviso) => aviso.kind).sort(), ['GRACE', 'USAGE_80']);
});

test('sin vigencia no hay aviso de vencimiento ni de gracia', () => {
  assert.deepEqual(decideNotices(candidata({ paidUntil: null }), PLANS, AHORA), []);
  assert.deepEqual(decideNotices(candidata({ effectiveStatus: 'GRACE', paidUntil: null }), PLANS, AHORA), []);
});

/* --------------------------------- Correos -------------------------------- */

const SEGUNDA_PERSONA = /\b(usted|tú|tu|vos|tienes|tenés|puedes|podés)\b/iu;

const correosDeEjemplo = () => {
  const cupo = PLANS.find((plan) => plan.code === 'analista').apiPorMes;
  const consumo = decideNotices(candidata({ usage: api(cupo * 0.85) }), PLANS, AHORA)[0];
  const vence = decideNotices(candidata({ paidUntil: finDeDia('2026-10-31') }), PLANS, AHORA)[0];
  const prueba = decideNotices(candidata({ effectiveStatus: 'TRIAL', paidUntil: finDeDia('2026-10-31') }), PLANS, AHORA)[0];
  const gracia = decideNotices(candidata({ effectiveStatus: 'GRACE', paidUntil: finDeDia('2026-10-24') }), PLANS, AHORA)[0];
  const cuenta = { fullName: 'Ana Lista', planCode: 'analista' };
  return {
    consumo: noticeMail(consumo, cuenta, PLANS, `${ORIGEN}/`),
    vence: noticeMail(vence, cuenta, PLANS, ORIGEN),
    prueba: noticeMail(prueba, cuenta, PLANS, ORIGEN),
    gracia: noticeMail(gracia, cuenta, PLANS, ORIGEN),
  };
};

test('cada aviso dice qué pasó, con cifras y fechas, y enlaza a /cuenta y /servicios', () => {
  const { consumo, vence, prueba, gracia } = correosDeEjemplo();
  for (const correo of [consumo, vence, prueba, gracia]) {
    assert.match(correo.text, /^Ana Lista:/u);
    assert.ok(correo.text.includes(`${ORIGEN}/cuenta`), correo.subject);
    assert.ok(correo.text.includes(`${ORIGEN}/servicios`), correo.subject);
    assert.ok(correo.html.includes(`<a href="${ORIGEN}/cuenta">`), correo.subject);
    assert.ok(correo.text.endsWith('DatosBolivia.com'));
    assert.match(correo.subject, /^DatosBolivia\.com: /u);
  }
  assert.ok(consumo.text.includes('85 % de las consultas a la API del mes (8.500 de 10.000)'), consumo.text);
  assert.ok(consumo.text.includes('1 de noviembre de 2026'));
  assert.ok(vence.text.includes('está pagado hasta el 31 de octubre de 2026'), vence.text);
  assert.ok(prueba.subject.includes('la prueba termina el 31 de octubre de 2026'), prueba.subject);
  assert.ok(gracia.text.includes('venció el 24 de octubre de 2026'), gracia.text);
  assert.ok(gracia.text.includes('hasta el 29 de octubre de 2026'), gracia.text);
});

test('los correos son impersonales, sin el nombre en clave ni signos de exclamación', () => {
  const correos = Object.values(correosDeEjemplo());
  correos.push(linkMail('Ana Lista', `${ORIGEN}/cuenta/activar?token=abc`, 'ACTIVATE'));
  correos.push(linkMail('Ana Lista', `${ORIGEN}/cuenta/activar?token=abc`, 'RESET'));
  for (const correo of correos) {
    const todo = `${correo.subject}\n${correo.text}`;
    assert.doesNotMatch(todo, SEGUNDA_PERSONA, correo.subject);
    assert.doesNotMatch(todo, /Observatorio/u, correo.subject);
    assert.doesNotMatch(todo, /[!¡]/u, correo.subject);
  }
});

test('el HTML escapa el nombre y el enlace; el texto plano los deja como están', () => {
  const correo = linkMail('<script>alert(1)</script> & "Cía"', 'https://datosbolivia.com/cuenta/activar?token=a&b', 'ACTIVATE');
  assert.ok(!correo.html.includes('<script>'));
  assert.ok(correo.html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Cía&quot;:'));
  assert.ok(correo.html.includes('href="https://datosbolivia.com/cuenta/activar?token=a&amp;b"'));
  assert.ok(correo.text.includes('https://datosbolivia.com/cuenta/activar?token=a&b'));
  assert.equal(escapeHtml(`'`), '&#39;');
});

test('un nombre con saltos de línea no rompe el saludo', () => {
  const correo = linkMail('Ana\r\nBcc: otro@ejemplo.bo', 'https://datosbolivia.com/x', 'RESET');
  assert.match(correo.text, /^Ana Bcc: otro@ejemplo\.bo:\n\n/u);
  assert.equal(correo.subject, 'Nueva contraseña para DatosBolivia.com');
});

/* ------------------------------ Autorización ------------------------------ */

test('el secreto de la tarea se acepta solo completo y con el esquema Bearer', () => {
  const secreto = 's'.repeat(48);
  assert.equal(bearerMatches(`Bearer ${secreto}`, secreto), true);
  assert.equal(bearerMatches(`bearer ${secreto}`, secreto), true);
  assert.equal(bearerMatches(`  Bearer   ${secreto}  `, secreto), true);
  assert.equal(bearerMatches(`Bearer ${secreto.slice(1)}`, secreto), false);
  assert.equal(bearerMatches(`Bearer ${secreto}x`, secreto), false);
  assert.equal(bearerMatches(secreto, secreto), false);
  assert.equal(bearerMatches(`Basic ${secreto}`, secreto), false);
  assert.equal(bearerMatches('Bearer ', secreto), false);
  assert.equal(bearerMatches(null, secreto), false);
  assert.equal(bearerMatches(undefined, secreto), false);
  assert.equal(bearerMatches('Bearer ', ''), false);
});

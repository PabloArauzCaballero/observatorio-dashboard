/*
 * La cuenta de cliente: cookie firmada, versiones de sesión, validaciones,
 * origen, cupos, equipo, facturación y correo.
 *
 * Correr con: node --test tests/unit/cuenta.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLANS, membersAllowed } from '../../src/lib/plans.ts';
import * as limitesCliente from '../../src/components/cuenta/limites.ts';
import {
  BILLING_LIMITS,
  CUENTA_TTL_SECONDS,
  PASSWORD_MAX,
  PASSWORD_MIN,
  TAX_ID_PATTERN,
  accountLinkEmail,
  activationLink,
  activeKeys,
  activeMembers,
  billingChanges,
  cleanLabel,
  cleanPersonName,
  deriveCustomerSecret,
  encodeCustomerCookie,
  isActivationToken,
  isIsoDate,
  isOwnerSession,
  isSameOrigin,
  isUuid,
  longDate,
  longDateTime,
  memberInvite,
  normalizeEmail,
  passwordProblem,
  planFor,
  readCookieHeader,
  safeReturnPath,
  sessionFromAccount,
  sessionIsCurrent,
  siteOrigin,
  usageLines,
  usedShare,
  verifyCustomerCookie,
} from '../../src/lib/cuenta/puro.ts';

const SECRETO = 'x'.repeat(40);
const AHORA = Date.UTC(2026, 9, 27, 12, 0, 0);

const cuenta = {
  subscriberAccountId: '7d1c2a5e-3b4f-4c6d-8e9f-0a1b2c3d4e5f',
  email: 'analista@ejemplo.bo',
  fullName: 'Ana Lista',
  organization: null,
  legalName: null,
  taxId: null,
  planCode: 'analista',
  billingPeriod: 'MONTHLY',
  status: 'ACTIVE',
  effectiveStatus: 'ACTIVE',
  entitled: true,
  paidUntil: '2026-11-27',
  createdAt: '2026-10-27T12:00:00Z',
  sessionVersion: 3,
  lockedUntil: null,
};

const miembro = {
  memberId: '0b9e8d7c-6a5b-4c3d-9e1f-2a3b4c5d6e7f',
  email: 'equipo@ejemplo.bo',
  fullName: 'Eva Quipo',
  status: 'ACTIVE',
  createdAt: '2026-10-27T12:00:00Z',
  activated: true,
  sessionVersion: 2,
};

test('la cookie firmada se lee de vuelta y dura ocho horas', () => {
  assert.equal(CUENTA_TTL_SECONDS, 8 * 60 * 60);
  const sesion = sessionFromAccount(cuenta, null, AHORA);
  assert.equal(sesion.iat, AHORA / 1000);
  assert.equal(sesion.exp, AHORA / 1000 + CUENTA_TTL_SECONDS);
  assert.equal(sesion.sv, 3);
  assert.equal(sesion.mid, undefined);
  assert.ok(isOwnerSession(sesion));
  const valor = encodeCustomerCookie(sesion, SECRETO);
  assert.deepEqual(verifyCustomerCookie(valor, SECRETO, AHORA), sesion);
});

test('una cookie vencida, alterada o firmada con otro secreto no abre sesión', () => {
  const sesion = sessionFromAccount(cuenta, null, AHORA);
  const valor = encodeCustomerCookie(sesion, SECRETO);
  assert.equal(verifyCustomerCookie(valor, SECRETO, AHORA + (CUENTA_TTL_SECONDS + 1) * 1000), null);
  assert.equal(verifyCustomerCookie(valor, 'y'.repeat(40), AHORA), null);
  const [payload, firma] = valor.split('.');
  const otra = Buffer.from(JSON.stringify({ ...sesion, planCode: 'institucional' })).toString('base64url');
  assert.equal(verifyCustomerCookie(`${otra}.${firma}`, SECRETO, AHORA), null);
  assert.equal(verifyCustomerCookie(`${payload}.`, SECRETO, AHORA), null);
  assert.equal(verifyCustomerCookie('basura', SECRETO, AHORA), null);
  assert.equal(verifyCustomerCookie(undefined, SECRETO, AHORA), null);
  assert.equal(verifyCustomerCookie(valor, null, AHORA), null);
});

test('una cookie bien firmada con un plan desconocido tampoco vale', () => {
  const valor = encodeCustomerCookie({ ...sessionFromAccount(cuenta, null, AHORA), planCode: 'gratis' }, SECRETO);
  assert.equal(verifyCustomerCookie(valor, SECRETO, AHORA), null);
});

test('el secreto propio manda; si falta, se deriva del del portal y no es el mismo', () => {
  assert.equal(deriveCustomerSecret({ CUENTA_SESSION_SECRET: SECRETO }), SECRETO);
  const admin = 'a'.repeat(48);
  const derivado = deriveCustomerSecret({ ADMIN_SESSION_SECRET: admin });
  assert.ok(derivado && derivado.length >= 32);
  assert.notEqual(derivado, admin);
  assert.equal(deriveCustomerSecret({ ADMIN_SESSION_SECRET: admin }), derivado);
  assert.equal(deriveCustomerSecret({ CUENTA_SESSION_SECRET: 'corto', ADMIN_SESSION_SECRET: admin }), derivado);
  assert.equal(deriveCustomerSecret({}), null);
  assert.equal(deriveCustomerSecret({ ADMIN_SESSION_SECRET: 'corto' }), null);
});

test('la cookie se encuentra en un encabezado con varias', () => {
  assert.equal(readCookieHeader('a=1; obs_cuenta=abc.def; b=2', 'obs_cuenta'), 'abc.def');
  assert.equal(readCookieHeader('a=1', 'obs_cuenta'), undefined);
  assert.equal(readCookieHeader(null, 'obs_cuenta'), undefined);
});

/* --------------------------- Versiones de sesión --------------------------- */

test('la cookie de un miembro lleva su id y su versión, y no es de la titular', () => {
  const sesion = sessionFromAccount(cuenta, miembro, AHORA);
  assert.equal(sesion.email, miembro.email);
  assert.equal(sesion.sv, 3);
  assert.equal(sesion.mid, miembro.memberId);
  assert.equal(sesion.msv, 2);
  assert.ok(!isOwnerSession(sesion));
  assert.deepEqual(verifyCustomerCookie(encodeCustomerCookie(sesion, SECRETO), SECRETO, AHORA), sesion);
});

test('sin una versión de sesión válida no se emite cookie', () => {
  assert.equal(sessionFromAccount({ ...cuenta, sessionVersion: undefined }, null, AHORA), null);
  assert.equal(sessionFromAccount({ ...cuenta, sessionVersion: 0 }, null, AHORA), null);
  assert.equal(sessionFromAccount({ ...cuenta, sessionVersion: 1.5 }, null, AHORA), null);
  assert.equal(sessionFromAccount(cuenta, { ...miembro, sessionVersion: null }, AHORA), null);
  assert.equal(sessionFromAccount(cuenta, { ...miembro, memberId: 'no-es-uuid' }, AHORA), null);
});

test('una cookie bien firmada sin sv, o con un miembro a medias, no vale', () => {
  const base = sessionFromAccount(cuenta, null, AHORA);
  const firmar = (sesion) => encodeCustomerCookie(sesion, SECRETO);
  const sinVersion = { ...base };
  delete sinVersion.sv;
  assert.equal(verifyCustomerCookie(firmar(sinVersion), SECRETO, AHORA), null);
  assert.equal(verifyCustomerCookie(firmar({ ...base, sv: '3' }), SECRETO, AHORA), null);
  assert.equal(verifyCustomerCookie(firmar({ ...base, mid: miembro.memberId }), SECRETO, AHORA), null);
  assert.equal(verifyCustomerCookie(firmar({ ...base, msv: 2 }), SECRETO, AHORA), null);
  assert.equal(verifyCustomerCookie(firmar({ ...base, mid: '../otra', msv: 2 }), SECRETO, AHORA), null);
  assert.equal(verifyCustomerCookie(firmar({ ...base, mid: miembro.memberId, msv: 0 }), SECRETO, AHORA), null);
});

test('la sesión de la titular vale mientras la versión de la cuenta no cambie', () => {
  const sesion = sessionFromAccount(cuenta, null, AHORA);
  assert.ok(sessionIsCurrent(sesion, cuenta, null));
  assert.ok(!sessionIsCurrent(sesion, { ...cuenta, sessionVersion: 4 }, null), 'contraseña cambiada o sesiones cerradas');
  assert.ok(!sessionIsCurrent(sesion, { ...cuenta, sessionVersion: undefined }, null), 'núcleo sin versión');
  assert.ok(!sessionIsCurrent(sesion, { ...cuenta, subscriberAccountId: miembro.memberId }, null), 'otra cuenta');
});

test('la sesión de un miembro cae si lo quitan, si cambia su versión o la de la cuenta', () => {
  const sesion = sessionFromAccount(cuenta, miembro, AHORA);
  assert.ok(sessionIsCurrent(sesion, cuenta, miembro));
  assert.ok(!sessionIsCurrent(sesion, cuenta, { ...miembro, status: 'REMOVED' }), 'miembro quitado');
  assert.ok(!sessionIsCurrent(sesion, cuenta, { ...miembro, sessionVersion: 3 }), 'su contraseña cambió');
  assert.ok(!sessionIsCurrent(sesion, { ...cuenta, sessionVersion: 4 }, miembro), 'la titular cerró las sesiones');
  assert.ok(!sessionIsCurrent(sesion, cuenta, null), 'el núcleo no lo encontró');
  assert.ok(!sessionIsCurrent(sesion, cuenta, { ...miembro, memberId: cuenta.subscriberAccountId }), 'otro miembro');
});

/* ------------------------------- Validaciones ------------------------------ */

test('correo, contraseña, etiqueta, token y fecha', () => {
  assert.equal(normalizeEmail('  Ana@Ejemplo.BO '), 'ana@ejemplo.bo');
  assert.equal(normalizeEmail('sin-arroba'), null);
  assert.equal(normalizeEmail(42), null);
  assert.equal(passwordProblem('larga-y-buena'), null);
  assert.match(passwordProblem('corta') ?? '', /al menos 10/u);
  assert.match(passwordProblem('x'.repeat(201)) ?? '', /hasta 200/u);
  assert.notEqual(passwordProblem(' '.repeat(12)), null);
  assert.equal(cleanLabel('  Servidor\nde informes  '), 'Servidor de informes');
  assert.equal(cleanLabel(''), null);
  assert.equal(cleanLabel('x'.repeat(61)), null);
  assert.ok(isActivationToken('abcDEF123_-abcdef12345'));
  assert.ok(!isActivationToken('corto'));
  assert.ok(!isActivationToken('con espacio y más letras'));
  assert.ok(isUuid(cuenta.subscriberAccountId));
  assert.ok(!isUuid('../otra'));
  assert.ok(isIsoDate('2026-11-30'));
  assert.ok(!isIsoDate('2026-02-30'));
  assert.ok(!isIsoDate('30/11/2026'));
});

test('volver solo lleva a rutas de la cuenta', () => {
  assert.equal(safeReturnPath('/cuenta'), '/cuenta');
  assert.equal(safeReturnPath('/cuenta/llaves'), '/cuenta/llaves');
  assert.equal(safeReturnPath('https://malo.example/cuenta'), '/cuenta');
  assert.equal(safeReturnPath('//malo.example'), '/cuenta');
  assert.equal(safeReturnPath('/admin'), '/cuenta');
  assert.equal(safeReturnPath('/cuenta/ingresar'), '/cuenta');
  assert.equal(safeReturnPath('/cuenta/recuperar'), '/cuenta');
  assert.equal(safeReturnPath('/cuenta/activar?token=x'), '/cuenta');
  assert.equal(safeReturnPath(undefined), '/cuenta');
});

test('el origen de un POST se compara con el host que escribió la persona', () => {
  const de = (origin, host, forwardedHost = null, referer = null) => ({ origin, referer, host, forwardedHost });
  assert.ok(isSameOrigin(de('https://datosbolivia.com', 'datosbolivia.com')));
  assert.ok(isSameOrigin(de('https://datosbolivia.com', 'contenedor:3000', 'datosbolivia.com')));
  assert.ok(isSameOrigin(de('http://161.97.85.216:3050', '161.97.85.216:3050')));
  assert.ok(!isSameOrigin(de('https://malo.example', 'datosbolivia.com')));
  assert.ok(isSameOrigin(de(null, 'datosbolivia.com', null, 'https://datosbolivia.com/cuenta')));
  assert.ok(!isSameOrigin(de(null, 'datosbolivia.com')));
  assert.ok(!isSameOrigin(de('null', 'datosbolivia.com')));
  assert.ok(!isSameOrigin(de('https://datosbolivia.com', null)));
});

/* ------------------------------ Plan y cupos ------------------------------- */

test('el consumo se lee contra el cupo del plan', () => {
  const analista = planFor(PLANS, 'analista');
  assert.ok(analista);
  const lineas = usageLines(
    [
      { usageKind: 'API', used: 2500 },
      { usageKind: 'CHAT', used: 12 },
    ],
    analista,
  );
  assert.deepEqual(
    lineas.map((l) => l.kind),
    ['API', 'DOWNLOAD', 'CHAT', 'MAP'],
  );
  const api = lineas[0];
  assert.equal(api.used, 2500);
  assert.equal(api.monthlyQuota, 10_000);
  assert.equal(api.quotaText, 'de 10.000 al mes');
  assert.equal(usedShare(api.used, api.monthlyQuota), 0.25);
  assert.equal(lineas[1].used, 0);
  assert.equal(lineas[1].quotaText, 'sin tope de filas por archivo');
  assert.equal(lineas[2].quotaText, 'hasta 100 por día');
  assert.equal(lineas[3].quotaText, 'hasta 5.000 lugares por descarga');
  assert.equal(usageLines([], planFor(PLANS, 'profesional'))[3].quotaText, 'mapa completo');
  assert.equal(usedShare(20_000, 10_000), 1);
  assert.equal(usedShare(5, null), null);
});

test('las llaves activas no cuentan las revocadas', () => {
  const llave = { apiKeyId: 'a', prefix: 'obs_live', label: null, createdAt: '', lastUsedAt: null };
  assert.equal(activeKeys([{ ...llave, revokedAt: null }, { ...llave, revokedAt: '2026-10-01' }]), 1);
});

/* ------------------------------ Equipo y datos ----------------------------- */

test('el equipo: usuarios del plan menos la titular', () => {
  assert.deepEqual(
    PLANS.map((plan) => [plan.code, membersAllowed(plan)]),
    [
      ['gratis', 0],
      ['analista', 0],
      ['profesional', 2],
      ['institucional', 9],
    ],
  );
  assert.equal(membersAllowed({ usuarios: 0 }), 0);
  assert.equal(activeMembers([{ status: 'ACTIVE' }, { status: 'REMOVED' }, { status: 'ACTIVE' }]), 2);
});

test('sumar a una persona pide nombre y correo válidos', () => {
  assert.deepEqual(memberInvite({ fullName: '  Eva\n Quipo ', email: ' Eva@Ejemplo.BO ' }), {
    ok: true,
    value: { fullName: 'Eva Quipo', email: 'eva@ejemplo.bo' },
  });
  assert.equal(memberInvite({ fullName: 'E', email: 'eva@ejemplo.bo' }).field, 'fullName');
  assert.equal(memberInvite({ fullName: 'Eva', email: 'eva' }).field, 'email');
  assert.equal(memberInvite(null).ok, false);
  assert.equal(cleanPersonName('x'.repeat(121)), null);
});

test('los datos de facturación: en blanco se borran, con límites y un NIT sin espacios', () => {
  assert.deepEqual(billingChanges({ organization: ' Banco  Uno ', legalName: '', taxId: '1023456029' }), {
    ok: true,
    value: { organization: 'Banco Uno', legalName: null, taxId: '1023456029' },
  });
  assert.deepEqual(billingChanges({}), { ok: true, value: { organization: null, legalName: null, taxId: null } });
  assert.equal(billingChanges({ taxId: '102 345' }).field, 'taxId');
  assert.equal(billingChanges({ taxId: 1023456 }).field, 'taxId');
  assert.equal(billingChanges({ organization: 'x'.repeat(121) }).field, 'organization');
  assert.equal(billingChanges({ legalName: 'x'.repeat(201) }).field, 'legalName');
  assert.ok(billingChanges({ taxId: '1234567-1A' }).ok);
});

test('los límites del navegador son los mismos que los del servidor', () => {
  assert.equal(limitesCliente.PASSWORD_MIN, PASSWORD_MIN);
  assert.equal(limitesCliente.PASSWORD_MAX, PASSWORD_MAX);
  assert.deepEqual(limitesCliente.BILLING_LIMITS, BILLING_LIMITS);
  assert.equal(String(limitesCliente.TAX_ID_PATTERN), String(TAX_ID_PATTERN));
});

/* --------------------------------- Correo -------------------------------- */

test('el enlace de activación y la fecha en palabras', () => {
  assert.equal(
    activationLink('https://datosbolivia.com/', 'abc+/='),
    'https://datosbolivia.com/cuenta/activar?token=abc%2B%2F%3D',
  );
  assert.equal(longDate('2026-10-14'), '14 de octubre de 2026');
  assert.equal(longDate(null), '—');
});

test('los enlaces por correo salen de la configuración, nunca de la petición', () => {
  assert.equal(siteOrigin('https://test.datosbolivia.com/'), 'https://test.datosbolivia.com');
  assert.equal(siteOrigin('http://161.97.85.216:3050'), 'http://161.97.85.216:3050');
  assert.equal(siteOrigin(undefined), 'https://datosbolivia.com');
  assert.equal(siteOrigin('  '), 'https://datosbolivia.com');
  assert.equal(siteOrigin('javascript:alert(1)'), 'https://datosbolivia.com');
  assert.equal(siteOrigin('no es una url'), 'https://datosbolivia.com');
});

test('el correo con el enlace escapa el nombre y dice cuándo vence', () => {
  const link = activationLink('https://datosbolivia.com', 'abcDEF123_-abcdef12345');
  const reset = accountLinkEmail({
    purpose: 'RESET',
    fullName: '<b>Ana</b> & "Lista"',
    link,
    expiresAt: '2026-10-27T22:30:00Z',
  });
  assert.equal(reset.subject, 'Nueva contraseña para DatosBolivia.com');
  assert.ok(reset.text.includes(link));
  assert.ok(reset.text.includes('27 de octubre de 2026, 18:30 (hora de Bolivia)'));
  assert.ok(reset.html.includes('&lt;b&gt;Ana&lt;/b&gt; &amp; &quot;Lista&quot;'));
  assert.ok(!reset.html.includes('<b>Ana'));
  const invitacion = accountLinkEmail({ purpose: 'INVITE', fullName: 'Eva', link, accountName: 'Banco Uno' });
  assert.match(invitacion.text, /cuenta de DatosBolivia\.com de Banco Uno/u);
  assert.ok(!/vence el/u.test(invitacion.text));
});

test('fecha y hora en hora de Bolivia', () => {
  assert.equal(longDateTime('2026-11-01T02:05:00Z'), '31 de octubre de 2026, 22:05 (hora de Bolivia)');
  assert.equal(longDateTime(null), '—');
  assert.equal(longDateTime('basura'), '—');
});

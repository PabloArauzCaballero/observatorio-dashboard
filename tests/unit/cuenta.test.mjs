/*
 * La cuenta de cliente: cookie firmada, validaciones, origen y cupos.
 *
 * Correr con: node --test tests/unit/cuenta.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLANS } from '../../src/lib/plans.ts';
import {
  CUENTA_TTL_SECONDS,
  activationLink,
  activeKeys,
  cleanLabel,
  deriveCustomerSecret,
  encodeCustomerCookie,
  isActivationToken,
  isIsoDate,
  isSameOrigin,
  isUuid,
  longDate,
  normalizeEmail,
  passwordProblem,
  planFor,
  readCookieHeader,
  safeReturnPath,
  sessionFromAccount,
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
};

test('la cookie firmada se lee de vuelta y dura doce horas', () => {
  const sesion = sessionFromAccount(cuenta, AHORA);
  assert.equal(sesion.exp, AHORA / 1000 + CUENTA_TTL_SECONDS);
  const valor = encodeCustomerCookie(sesion, SECRETO);
  assert.deepEqual(verifyCustomerCookie(valor, SECRETO, AHORA), sesion);
});

test('una cookie vencida, alterada o firmada con otro secreto no abre sesión', () => {
  const sesion = sessionFromAccount(cuenta, AHORA);
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
  const valor = encodeCustomerCookie({ ...sessionFromAccount(cuenta, AHORA), planCode: 'gratis' }, SECRETO);
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

test('el enlace de activación y la fecha en palabras', () => {
  assert.equal(
    activationLink('https://datosbolivia.com/', 'abc+/='),
    'https://datosbolivia.com/cuenta/activar?token=abc%2B%2F%3D',
  );
  assert.equal(longDate('2026-10-14'), '14 de octubre de 2026');
  assert.equal(longDate(null), '—');
});

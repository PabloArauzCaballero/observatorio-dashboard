/**
 * Los límites que los formularios revisan antes de enviar.
 *
 * Copia de los de `src/lib/cuenta/puro.ts`, que es quien manda: ese módulo usa
 * `node:crypto` y no puede viajar al navegador. `tests/unit/cuenta.test.mjs`
 * comprueba que las dos copias digan lo mismo.
 */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

export const BILLING_LIMITS = { organization: 120, legalName: 200, taxId: 20 } as const;

/** El NIT: cifras, letras o guiones, sin espacios. */
export const TAX_ID_PATTERN = /^[0-9A-Za-z-]{3,20}$/u;

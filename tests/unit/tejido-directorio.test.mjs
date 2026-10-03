import assert from 'node:assert/strict';
import { test } from 'node:test';

import { businessNameTerms } from '../../src/lib/business-directory-words.ts';
import { buildDirectoryPage } from '../../src/lib/business-directory-contract.ts';

test('la nube agrupa tildes y omite razones sociales y palabras genéricas', () => {
  const terms = businessNameTerms([
    'Águila Dorada S.R.L.',
    'AGUILA ANDINA S.A.',
    'Empresa Comercial de Servicios Bolivia 2025',
    'Transportes Cóndor Ltda.',
  ]);

  assert.deepEqual(
    terms.map(({ term, value }) => [term, value]),
    [
      ['aguila', 2],
      ['andina', 1],
      ['condor', 1],
      ['dorada', 1],
      ['transportes', 1],
    ],
  );
});

test('la nube ordena por frecuencia, desempata por nombre y respeta el límite', () => {
  const terms = businessNameTerms(
    ['Zeta', 'Zeta', 'Alfa', 'Alfa', 'Beta', 'Gamma', 'Delta', 'Epsilon'],
    3,
  );

  assert.deepEqual(
    terms.map(({ term, value }) => [term, value]),
    [
      ['alfa', 2],
      ['zeta', 2],
      ['beta', 1],
    ],
  );
});

test('el contrato deduplica el registro, conserva el identificador textual y pagina', () => {
  const result = buildDirectoryPage(
    [
      {
        placeId: 'seprec:establecimiento:000481319',
        registrationId: '000481319',
        name: 'Águila Dorada',
        department: 'Chuquisaca',
        municipality: 'Sucre',
        address: 'Plaza 25 de Mayo 25',
        activity: 'OV_SERVICES_AND_BUSINESS',
        licence: 'información pública; redistribución no verificada',
        cutDate: '2026-09-12T00:00:00.000Z',
      },
      {
        placeId: 'seprec:establecimiento:000481319',
        registrationId: '000481319',
        name: 'Águila Dorada duplicada',
        department: 'Chuquisaca',
        municipality: 'Sucre',
        address: null,
        activity: 'OTRA_ENTIDAD',
        licence: null,
        cutDate: null,
      },
      {
        placeId: 'seprec:establecimiento:9',
        registrationId: '9',
        name: 'Cóndor Tours',
        department: 'La Paz',
        municipality: 'La Paz',
        address: null,
        activity: 'TURISMO',
        licence: null,
        cutDate: null,
      },
    ],
    { department: 'Chuquisaca', search: 'aguila', page: 1, pageSize: 20 },
  );

  assert.equal(result.total, 1);
  assert.equal(result.rows[0]?.registrationId, '000481319');
  assert.equal(result.meta.coverage, 'PARCIAL');
});

test('un filtro sin coincidencias devuelve cero filas y conserva metadatos de cobertura', () => {
  const result = buildDirectoryPage([], { search: 'inexistente', page: 1, pageSize: 20 });

  assert.deepEqual(result.rows, []);
  assert.equal(result.total, 0);
  assert.equal(result.meta.coverage, 'PARCIAL');
  assert.equal(result.meta.publisher, 'SEPREC');
});

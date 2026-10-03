import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';

import { businessNameTerms } from '../../src/lib/business-directory-words.ts';
import { buildDirectoryPage, directoryMeta } from '../../src/lib/business-directory-contract.ts';
import { writeBusinessDirectoryWorkbook } from '../../src/lib/business-directory-workbook.ts';

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

const workbookRows = [
  {
    placeId: 'seprec:empresa:00123',
    registrationId: '00123',
    name: 'Águila Dorada S.R.L.',
    department: 'Chuquisaca',
    municipality: 'Sucre',
    address: 'Plaza 25 de Mayo 25',
    activity: 'SERVICIOS',
    licence: 'información pública',
    cutDate: '2026-09-12T00:00:00.000Z',
  },
  {
    placeId: 'seprec:empresa:9',
    registrationId: '9',
    name: 'Cóndor Tours',
    department: 'La Paz',
    municipality: 'La Paz',
    address: null,
    activity: 'TURISMO',
    licence: 'información pública',
    cutDate: null,
  },
];

async function workbookBuffer(rows = workbookRows, meta = directoryMeta(rows.length, rows)) {
  const stream = new PassThrough();
  const chunks = [];
  stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  await writeBusinessDirectoryWorkbook(stream, rows, meta);
  return Buffer.concat(chunks);
}

test('el Excel conserva nombres e identificadores y documenta su cobertura', async () => {
  const { default: ExcelJS } = await import('exceljs');
  const buffer = await workbookBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Empresas', 'Metadatos']);
  const companies = workbook.getWorksheet('Empresas');
  assert.equal(companies?.getCell('A2').value, '00123');
  assert.equal(companies?.getCell('B2').value, 'Águila Dorada S.R.L.');
  assert.ok(companies?.autoFilter);
  assert.equal(companies?.views[0]?.state, 'frozen');
  const headers = companies?.getRow(1).values.join('|').toLocaleLowerCase('es') ?? '';
  assert.doesNotMatch(headers, /teléfono|correo|email/u);
  assert.equal(workbook.getWorksheet('Metadatos')?.getCell('B2').value, 'PARCIAL');
});

test('el Excel rechaza una selección vacía o no autorizada para descarga', async () => {
  await assert.rejects(workbookBuffer([], directoryMeta(0, [])), /no contiene empresas/u);
  await assert.rejects(
    workbookBuffer(workbookRows, { ...directoryMeta(2, workbookRows), redistributable: false }),
    /redistribución no está autorizada/u,
  );
});

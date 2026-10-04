import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workbookTitle } from '../../src/lib/bcb-board.ts';

test('los informes de una misma página del BCB conservan nombres distintos', () => {
  const url = 'https://www.bcb.gob.bo/?q=tasas_interes';
  assert.equal(workbookTitle(url, 'tasas_interes/activas mensuales'), 'Activas mensuales');
  assert.equal(workbookTitle(url, 'tasas_interes/pasivas anuales'), 'Pasivas anuales');
  assert.equal(
    workbookTitle('https://www.bcb.gob.bo/?q=content/operaciones-de-mercado-abierto', 'omas/letras'),
    'Letras',
  );
});

test('los archivos conservan su nombre legible sin parámetros ni fragmentos', () => {
  assert.equal(
    workbookTitle('https://www.bcb.gob.bo/webdocs/Reservas%20internacionales.xlsx?download=1#datos', 'reservas'),
    'Reservas internacionales',
  );
  assert.equal(workbookTitle('/webdocs/Tasas_activas.PDF', 'tasas'), 'Tasas activas');
});

test('sin archivo se usa el catálogo, incluso con una URL vacía o mal codificada', () => {
  for (const url of [null, '', 'https://www.bcb.gob.bo/', 'https://www.bcb.gob.bo/index.php?q=tasas']) {
    assert.equal(workbookTitle(url, 'tasas_interes/tasas_pasivas'), 'Tasas pasivas');
  }
  assert.equal(workbookTitle('/webdocs/100%_tasas.xlsx', 'tasas'), '100% tasas');
});

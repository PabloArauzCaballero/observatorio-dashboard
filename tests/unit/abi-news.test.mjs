import test from 'node:test';
import assert from 'node:assert/strict';
import { abiSelection, abiWhere, abiCsv } from '../../src/lib/abi-news-query.ts';

test('ABI rejects invalid dates, pagination, issuer and inverted ranges', () => {
  for (const query of ['desde=2026-02-30', 'pagina=-1', 'pagina=1.5', 'emisor=x%27', 'desde=2026-10-01&hasta=2026-01-01']) {
    assert.throws(() => abiSelection(new URLSearchParams(query)));
  }
});
test('issuer and role apply to the same mention and search is parameterized', () => {
  const selection = abiSelection(new URLSearchParams({ emisor: 'BUN', rol: 'HEADLINE', q: "Unión 20%_'" }));
  const { sql, values } = abiWhere(selection);
  assert.deepEqual(JSON.parse(values[0]), [{ filerCode: 'BUN', role: 'HEADLINE' }]);
  assert.ok(!sql.includes("20%_"));
  assert.equal(values[1], "%union 20\\%\\_'%");
});
test('CSV protects formulas and quotes while keeping evidence', () => {
  const csv = abiCsv([{ key: 'abi:wp:1', title: '=1+1,"nota"', mentions: [], topics: [], evidenceSha256: 'proof' }]);
  assert.ok(csv.includes('"\'=1+1,""nota"""'));
  assert.ok(csv.includes('"proof"'));
});

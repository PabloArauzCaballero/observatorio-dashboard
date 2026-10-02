/*
 * El armado de «Empresas › Redes sociales» sin base: qué lectura gana cuando
 * una cuenta se leyó dos veces, que una cuenta bloqueada nunca sume cero, y el
 * cruce con el ránking Merco.
 *
 * Correr con: node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCompanySocialBoard, followersOf } from '../../src/lib/company-social-board.ts';

const profile = (overrides) => ({
  slug: 'ENTEL',
  platform: 'facebook',
  reading_date: '2026-10-01',
  account_url: 'https://www.facebook.com/Entel.Bolivia',
  handle: 'Entel.Bolivia',
  read_status: 'OK',
  status_note: null,
  followers: '974180',
  post_count: null,
  likes_total: null,
  talking_about: '18045',
  posts_read: 6,
  posts_per_week: '6',
  engagement_pct: '0.006',
  comments_read: 0,
  comment_sentiment: null,
  ...overrides,
});

const seat = (slug, name, rank, year, sector = null) => ({ slug, name, rank, year, sector });

test('cada cuenta muestra su lectura más reciente', () => {
  const board = buildCompanySocialBoard(
    [profile({ reading_date: '2026-09-24', followers: '900000' }), profile({})],
    [],
    [],
    [seat('ENTEL', 'Entel', 45, 2026)],
    [],
  );
  assert.equal(board.readingDate, '2026-10-01');
  assert.equal(board.companies[0].accounts[0].followers, 974180);
});

test('una cuenta que no se dejó leer no suma cero', () => {
  const board = buildCompanySocialBoard(
    [
      profile({}),
      profile({ platform: 'linkedin', read_status: 'BLOCKED', followers: '123', status_note: 'muro' }),
    ],
    [],
    [],
    [],
    [],
  );
  const company = board.companies[0];
  const linkedin = company.accounts.find((account) => account.platform === 'linkedin');
  assert.equal(linkedin.followers, null);
  assert.equal(linkedin.status, 'BLOCKED');
  assert.equal(followersOf(company), 974180);
  assert.equal(followersOf(company, new Set(['linkedin'])), null);
});

test('el nombre, el puesto y el sector salen de la última edición de Merco', () => {
  const board = buildCompanySocialBoard(
    [profile({ slug: 'TIGO' }), profile({})],
    [],
    [],
    [seat('TIGO', 'Tigo', 7, 2024), seat('TIGO', 'Tigo', 5, 2026), seat('ENTEL', 'Entel', 45, 2026)],
    [seat('TIGO', 'Tigo', 1, 2026, 'TELECOMUNICACIONES')],
  );
  assert.deepEqual(
    board.companies.map((company) => [company.slug, company.name, company.mercoRank, company.sector]),
    [
      ['TIGO', 'Tigo', 5, 'TELECOMUNICACIONES'],
      ['ENTEL', 'Entel', 45, null],
    ],
  );
});

test('los términos viajan recortados por empresa, ámbito y clase', () => {
  const terms = Array.from({ length: 40 }, (_, index) => ({
    slug: 'ENTEL',
    scope: 'COMPANY',
    kind: 'WORD',
    term: `palabra${index}`,
    mentions: 100 - index,
  }));
  const board = buildCompanySocialBoard([profile({})], [], terms, [], []);
  assert.equal(board.terms.length, 25);
  assert.deepEqual(board.terms[0], ['ENTEL', 'COMPANY', 'WORD', 'palabra0', 100]);
});

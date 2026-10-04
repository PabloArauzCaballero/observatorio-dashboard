/*
 * El armado de «Empresas › Redes sociales» sin base: qué lectura gana cuando
 * una cuenta se leyó dos veces, que una cuenta bloqueada nunca sume cero, y el
 * cruce con el ránking Merco.
 *
 * Correr con: node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCompanySocialBoard, commentBreakdown, followersOf } from '../../src/lib/company-social-board.ts';
import { formatMix } from '../../src/lib/company-social-format.ts';

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

test('el reparto de sentimiento pondera cada red por comentarios leídos', () => {
  const board = buildCompanySocialBoard(
    [
      profile({
        comment_sentiment: { analyzed: 10, positivePct: 80, neutralPct: 10, negativePct: 10, ironyPct: 20, netScore: 70, topEmotion: null },
      }),
      profile({
        platform: 'youtube',
        comment_sentiment: { analyzed: 30, positivePct: 20, neutralPct: 50, negativePct: 30, ironyPct: 10, netScore: -10, topEmotion: null },
      }),
    ],
    [], [], [], [],
  );
  const companies = board.companies;
  const all = commentBreakdown(companies, new Set());
  assert.equal(all.analyzed, 40);
  assert.equal(all.positivePct, 35);
  assert.equal(all.neutralPct, 40);
  assert.equal(all.negativePct, 25);
  assert.equal(all.ironyPct, 12.5);
  assert.equal(commentBreakdown(companies, new Set(['instagram'])), null);
});

import { parseQuery, queryPosts } from '../../src/lib/company-social-posts-view.ts';

const post = (overrides) => ({
  slug: 'ENTEL',
  platform: 'youtube',
  url: `https://example.test/${Math.random()}`,
  date: '2026-08-10',
  text: 'Un video de la campaña',
  likes: null,
  comments: null,
  shares: null,
  views: 100,
  interactions: null,
  format: 'VIDEO',
  sentiment: null,
  ...overrides,
});

test('«Posts a fondo» filtra por empresa, red, fecha y texto sin acentos', () => {
  const all = [
    post({ url: 'a', date: '2026-07-01', text: 'Campaña de verano' }),
    post({ url: 'b', date: '2026-08-15', text: 'Nueva campana' }),
    post({ url: 'c', slug: 'TIGO', date: '2026-08-16' }),
    post({ url: 'd', platform: 'facebook', date: '2026-08-17', format: 'TEXT' }),
    post({ url: 'e', date: null }),
  ];
  const page = queryPosts(all, parseQuery({ slugs: ['ENTEL'], platforms: ['youtube'], from: '2026-08-01', text: 'CAMPANA' }));
  assert.deepEqual(page.rows.map((row) => row.url), ['b']);
  assert.equal(page.total, 1);
});

test('«Posts a fondo» suma por mes sólo los posts con fecha y no cuenta lo no declarado como cero', () => {
  const all = [
    post({ url: 'a', date: '2026-07-01', interactions: 10, views: 100 }),
    post({ url: 'b', date: '2026-07-20', interactions: null, views: 50 }),
    post({ url: 'c', date: '2026-08-02', interactions: 5, views: null }),
    post({ url: 'd', date: null, interactions: 99 }),
  ];
  const { series, total } = queryPosts(all, parseQuery({}));
  assert.equal(total, 4);
  assert.deepEqual(series, [
    { month: '2026-07', posts: 2, interactions: 10, views: 150 },
    { month: '2026-08', posts: 1, interactions: 5, views: 0 },
  ]);
});

test('«Posts a fondo» ordena, pagina y deja el reparto por formato sin recortar por formato', () => {
  const all = [
    post({ url: 'a', interactions: 1, format: 'VIDEO' }),
    post({ url: 'b', interactions: 9, format: 'TEXT' }),
    post({ url: 'c', interactions: 5, format: 'VIDEO' }),
    post({ url: 'd', interactions: null, format: 'VIDEO' }),
  ];
  const first = queryPosts(all, parseQuery({ sort: 'interactions', limit: 2 }));
  assert.deepEqual(first.rows.map((row) => row.url), ['b', 'c']);
  const next = queryPosts(all, parseQuery({ sort: 'interactions', limit: 2, offset: 2 }));
  assert.deepEqual(next.rows.map((row) => row.url), ['a', 'd']);
  const videos = queryPosts(all, parseQuery({ format: 'VIDEO' }));
  assert.equal(videos.total, 3);
  assert.deepEqual(videos.formats, [{ format: 'VIDEO', posts: 3 }, { format: 'TEXT', posts: 1 }]);
});

test('«Posts a fondo» encuentra los posts con comentarios analizados y su tono', () => {
  const sentiment = (analyzed, netScore) => ({ analyzed, netScore });
  const all = [
    post({ url: 'a', sentiment: sentiment(12, -50) }),
    post({ url: 'b', sentiment: sentiment(3, 67) }),
    post({ url: 'c', sentiment: null }),
    post({ url: 'd', sentiment: sentiment(20, 0) }),
  ];
  assert.deepEqual(
    queryPosts(all, parseQuery({ commentTone: 'analyzed', sort: 'analyzed' })).rows.map((row) => row.url),
    ['d', 'a', 'b'],
  );
  assert.deepEqual(queryPosts(all, parseQuery({ commentTone: 'negative' })).rows.map((row) => row.url), ['a']);
  assert.deepEqual(queryPosts(all, parseQuery({ commentTone: 'positive' })).rows.map((row) => row.url), ['b']);
});

test('«Posts a fondo» no se fía de lo que llega en la petición', () => {
  const query = parseQuery({
    slugs: ['OK_1', "'; DROP TABLE x;--", 7],
    platforms: 'facebook',
    from: 'ayer',
    format: 'video',
    text: 'x'.repeat(500),
    sort: 'inventado',
    commentTone: 'inventado',
    offset: -5,
    limit: 100_000,
  });
  assert.deepEqual(query.slugs, ['OK_1']);
  assert.deepEqual(query.platforms, []);
  assert.equal(query.from, null);
  assert.equal(query.format, null);
  assert.equal(query.text.length, 80);
  assert.equal(query.sort, 'interactions');
  assert.equal(query.commentTone, 'all');
  assert.equal(query.offset, 0);
  assert.equal(query.limit, 60);
});

test('una selección de empresas vacía no vuelve a mostrar todos los posts', () => {
  const all = [post({ url: 'a' }), post({ url: 'b', slug: 'TIGO' })];
  const selected = queryPosts(all, parseQuery({ emptySelection: true, limit: 8 }));
  assert.equal(selected.total, 0);
  assert.deepEqual(selected.rows, []);
  assert.deepEqual(selected.series, []);
  assert.equal(selected.summary.medianInteractions, null);
  assert.equal(queryPosts(all, parseQuery({ limit: 8 })).total, 2);
});

test('los formatos sin dato se filtran y las medianas excluyen interacciones desconocidas', () => {
  const all = [
    post({ url: 'a', format: null, interactions: null }),
    post({ url: 'b', format: null, interactions: 10 }),
    post({ url: 'c', format: null, interactions: 30 }),
    post({ url: 'd', format: 'VIDEO', interactions: 100 }),
  ];
  const page = queryPosts(all, parseQuery({ format: 'SIN DATO', limit: 2 }));
  assert.equal(page.total, 3);
  assert.deepEqual(page.rows.map((row) => row.url), ['c', 'b']);
  assert.equal(page.summary.measured, 2);
  assert.equal(page.summary.medianInteractions, 20);
  assert.equal(page.summary.topFiveShare, 100);
  assert.deepEqual(page.formats, [{ format: 'SIN DATO', posts: 3 }, { format: 'VIDEO', posts: 1 }]);
});

test('los indicadores de posts usan el recorte completo y ponderan el sentimiento por comentarios', () => {
  const sentiment = (analyzed, netScore) => ({ analyzed, netScore });
  const all = [
    post({ url: 'a', interactions: 10, sentiment: sentiment(10, 50) }),
    post({ url: 'b', interactions: 20, sentiment: sentiment(30, -10) }),
    post({ url: 'c', interactions: null, sentiment: null }),
  ];
  const first = queryPosts(all, parseQuery({ limit: 1 }));
  const second = queryPosts(all, parseQuery({ limit: 1, offset: 1 }));
  assert.deepEqual(first.summary, second.summary);
  assert.equal(first.summary.medianInteractions, 15);
  assert.equal(first.summary.analyzed, 40);
  assert.equal(first.summary.net, 5);
  assert.equal(first.summary.topFiveShare, 100);
});

test('el reparto de formatos distingue posts sin formato y excluye métricas ausentes de la mediana', () => {
  const shapes = [
    { slug: 'ENTEL', platform: 'facebook', format: 'VIDEO', hour: null, interactions: null },
    { slug: 'ENTEL', platform: 'facebook', format: 'VIDEO', hour: null, interactions: 10 },
    { slug: 'ENTEL', platform: 'facebook', format: 'VIDEO', hour: null, interactions: 30 },
    { slug: 'ENTEL', platform: 'facebook', format: null, hour: null, interactions: null },
    { slug: 'ENTEL', platform: 'youtube', format: 'VIDEO', hour: null, interactions: 100 },
  ];
  const all = formatMix(shapes, new Set(['ENTEL']), new Set(['facebook']));
  assert.equal(all.reduce((sum, row) => sum + row.posts, 0), 4);
  assert.equal(all.reduce((sum, row) => sum + row.value, 0), 100);
  assert.deepEqual(all.map(({ name, posts, measured, median }) => ({ name, posts, measured, median })), [
    { name: 'Video', posts: 3, measured: 2, median: 20 },
    { name: 'Sin dato', posts: 1, measured: 0, median: null },
  ]);
});

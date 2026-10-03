/*
 * El armado de las tres páginas nuevas de «Empresas» sin base: que el código
 * de cada serie vuelva a ser su lugar, su dimensión y su categoría; que las
 * dos varas del ránking se crucen por empresa; y que la estimación de una
 * fortuna multiplique bien una cadena de sociedades sin contar dos veces.
 *
 * Correr con: node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FIRM_MEASURES, buildClosureSeries, buildFabricBoard } from '../../src/lib/business-fabric-board.ts';
import { buildLargestBoard } from '../../src/lib/largest-companies-board.ts';
import { buildOwnersBoard } from '../../src/lib/business-owners-board.ts';

const point = (indicatorCode, period, value, name = null, unit = 'COUNT') => ({
  indicatorCode,
  sector: 'X',
  name,
  period: String(period),
  unit,
  value,
  previousValue: null,
  changePercent: null,
  publisher: 'Fuente',
  sourceUrl: 'https://example.org',
});

test('el registro deshace el código en lugar, dimensión y categoría', () => {
  const board = buildFabricBoard([
    point('FIRMS_STOCK_TOTAL_BOLIVIA', 2024, 387764),
    point('FIRMS_STOCK_DEPT_LA_PAZ', 2024, 120296),
    point('FIRMS_STOCK_FORM_SA', 2024, 4043),
    point('FIRMS_STOCK_DEPTFORM_LA_PAZ__SRL', 2024, 29887),
    point('FIRMS_STOCK_DEPTCIIU_TARIJA__C', 2025, 1899),
    point('FIRMS_OWNER_WOMEN_DEPT_LA_PAZ', 2025, 39583),
    point('FIRMS_SIZE_ACT_GRAN__SECTOR_COMERCIO', 2025, 183, 'Empresas activas: Gran Empresa · Comercio'),
    point('TAXROLL_ROLL_PCT_CAT_PRICO', 2025, 0.02, 'Padrón: PRICO', 'PERCENT'),
    point('TAXROLL_REVENUE_PCT_CAT_PRICO', 2025, 42.67, 'Padrón: PRICO', 'PERCENT'),
  ]);
  const find = (where) => board.firms.find((row) => Object.entries(where).every(([key, value]) => row[key] === value));
  assert.equal(find({ place: 'BOLIVIA', dimension: 'TOTAL' })?.count, 387764);
  assert.equal(find({ place: 'LA_PAZ', dimension: 'TOTAL' })?.count, 120296);
  assert.equal(find({ place: 'BOLIVIA', dimension: 'FORM', key: 'SA' })?.count, 4043);
  assert.equal(find({ place: 'LA_PAZ', dimension: 'FORM', key: 'SRL' })?.count, 29887);
  assert.equal(find({ place: 'TARIJA', dimension: 'CIIU', key: 'C' })?.year, 2025);
  assert.deepEqual(board.owners[0], { place: 'LA_PAZ', kind: 'WOMEN', year: 2025, count: 39583 });
  assert.equal(board.size[0]?.columnLabel, 'Comercio');
  assert.equal(board.size[0]?.rowKey, 'GRAN');
  assert.deepEqual(
    board.taxRoll.map((row) => [row.key, row.roll, row.revenue]),
    [['PRICO', 0.02, 42.67]],
  );
});

test('las dos varas del ránking se cruzan por empresa y los atributos salen de las llaves', () => {
  const board = buildLargestBoard([
    point('TAXTOP_RANK_BANCO_GANADERO', 2025, 4, 'Banco Ganadero: puesto {departamento=Santa Cruz}', 'RANK'),
    point('TAXTOP_PAID_BANCO_GANADERO', 2025, 657.7, 'Banco Ganadero: impuesto pagado {departamento=Santa Cruz}', 'MILLION_BOB'),
    point('LARGEST_REVENUE_BANCO_GANADERO', 2024, 2100, 'Banco Ganadero: ingresos {sector=Bancos}', 'MILLION_BOB'),
    point('TAXTOP_COVERAGE_PCT', 2025, 53.1, 'Las cien: parte de la recaudación', 'PERCENT'),
  ]);
  assert.equal(board.companies.length, 1);
  const bank = board.companies[0];
  assert.deepEqual(bank.attributes, { departamento: 'Santa Cruz', sector: 'Bancos' });
  assert.equal(bank.name, 'Banco Ganadero');
  assert.deepEqual(bank.years.map((row) => row.year), [2024, 2025]);
  assert.equal(bank.years[1].taxPaid, 657.7);
  assert.equal(board.units.taxPaid, 'MILLION_BOB');
  assert.deepEqual(board.coverage, [{ year: 2025, pct: 53.1 }]);
});

test('la estimación multiplica la cadena y no cuenta dos veces al holding', () => {
  const stake = (holder, company, pct, year, tipo = 'persona') =>
    point(
      `OWNER_STAKE_${holder}_${company}`,
      year,
      pct,
      `${holder}: participación en ${company} {tipo=${tipo}; titular=${holder}; empresa=${company}}`,
      'PERCENT',
    );
  const ranking = [
    point('LARGEST_EQUITY_BANCO_X', 2024, 696, 'Banco X: patrimonio {sector=Bancos}', 'MILLION_BOB'),
    point('LARGEST_EQUITY_HOLDING_X', 2024, 900, 'Holding X: patrimonio {sector=Inversiones}', 'MILLION_BOB'),
  ];
  const fortunes = [
    stake('ANA', 'HOLDING_X', 50, 2023),
    stake('HOLDING_X', 'BANCO_X', 80, 2024, 'sociedad'),
    point('WEALTH_PBV_EM_BANKS', 2024, 1.5, 'Damodaran: Banks (Regional)', 'RATIO'),
  ];
  const board = buildOwnersBoard(ranking, fortunes);
  const ana = board.estimates.find((row) => row.person === 'ANA' && row.year === 2024);
  assert.ok(ana, 'Ana tiene estimación en 2024');
  // 50 % de 80 % = 40 % del banco; el holding no suma aparte porque sólo tiene el banco.
  assert.equal(ana.holdings.length, 1);
  assert.equal(ana.holdings[0].company, 'BANCO_X');
  assert.ok(Math.abs(ana.holdings[0].stake - 40) < 1e-9);
  // 696 M Bs / 6,96 = 100 M USD; el 40 % son 40.
  assert.ok(Math.abs(ana.book - 40) < 1e-9);
  assert.ok(Math.abs((ana.market ?? 0) - 60) < 1e-9);
  assert.equal(ana.holdings[0].via, 'Holding X');
});

test('el patrimonio del balance publicado alimenta la estimación aunque no haya «Las 500»', () => {
  const board = buildOwnersBoard([], [
    point('OWNER_EQUITY_BANCO_Y', 2024, 1392000, 'Banco Y: patrimonio {empresa=BANCO_Y; sector=Bancos}', 'THOUSAND_BOB'),
    point('OWNER_STAKE_LUIS_BANCO_Y', 2024, 25, 'Luis: participación en Banco Y {tipo=persona; titular=LUIS; empresa=BANCO_Y}', 'PERCENT'),
  ]);
  const luis = board.estimates.find((row) => row.person === 'LUIS');
  // 1.392.000 miles de Bs / 6,96 = 200 M USD; el 25 % son 50.
  assert.ok(luis && Math.abs(luis.book - 50) < 1e-9);
  assert.equal(luis.holdings[0].sector, 'Bancos');
});

test('el tablero conserva los nombres y arma el podio y la trayectoria histórica de cada empresario', () => {
  const stake = (holder, name, company) =>
    point(
      `OWNER_STAKE_${holder}_${company}`,
      2023,
      100,
      `${name}: participación en ${company} {tipo=persona; titular=${holder}; empresa=${company}}`,
      'PERCENT',
    );
  const equity = (company, companyName, year, value) =>
    point(
      `OWNER_EQUITY_${company}`,
      year,
      value,
      `${companyName}: patrimonio {empresa=${company}; sector=Industria}`,
      'MILLION_BOB',
    );

  const board = buildOwnersBoard([], [
    stake('ANA_PEREZ', 'Ana Pérez', 'EMPRESA_A'),
    stake('LUIS_ROJAS', 'Luis Rojas', 'EMPRESA_B'),
    stake('CARLA_SUAREZ', 'Carla Suárez', 'EMPRESA_C'),
    equity('EMPRESA_A', 'Empresa A', 2023, 696),
    equity('EMPRESA_A', 'Empresa A', 2024, 348),
    equity('EMPRESA_B', 'Empresa B', 2023, 556.8),
    equity('EMPRESA_B', 'Empresa B', 2024, 1113.6),
    equity('EMPRESA_C', 'Empresa C', 2023, 417.6),
    equity('EMPRESA_C', 'Empresa C', 2024, 835.2),
  ]);

  assert.deepEqual(
    board.podiums.map((podium) => [podium.year, podium.population, podium.places.map((place) => [place.rank, place.name])]),
    [
      [2023, 3, [[1, 'Ana Pérez'], [2, 'Luis Rojas'], [3, 'Carla Suárez']]],
      [2024, 3, [[1, 'Luis Rojas'], [2, 'Carla Suárez'], [3, 'Ana Pérez']]],
    ],
  );
  const ana = board.histories.find((history) => history.person === 'ANA_PEREZ');
  assert.deepEqual(
    {
      name: ana?.name,
      firstYear: ana?.firstYear,
      latestYear: ana?.latestYear,
      bestRank: ana?.bestRank,
      podiumYears: ana?.podiumYears,
      peak: ana?.peak,
      years: ana?.years.map((year) => [year.year, year.rank, year.population, year.leadingHolding]),
      mainHoldings: ana?.mainHoldings,
    },
    {
      name: 'Ana Pérez',
      firstYear: 2023,
      latestYear: 2024,
      bestRank: 1,
      podiumYears: [2023, 2024],
      peak: { year: 2023, rank: 1, book: 100, market: null },
      years: [[2023, 1, 3, 'Empresa A'], [2024, 3, 3, 'Empresa A']],
      mainHoldings: [{
        company: 'EMPRESA_A',
        name: 'Empresa A',
        firstYear: 2023,
        latestYear: 2024,
        peakYear: 2023,
        peakBook: 100,
        latestStake: 100,
        estimateYears: [2023, 2024],
      }],
    },
  );
});

test('el historial de empresas enumera las gestiones disponibles sin inventar un período continuo', () => {
  const board = buildOwnersBoard([], [
    point(
      'OWNER_STAKE_ANA_EMPRESA_A',
      2021,
      100,
      'Ana Pérez: participación en Empresa A {tipo=persona; titular=ANA; empresa=EMPRESA_A}',
      'PERCENT',
    ),
    point('OWNER_EQUITY_EMPRESA_A', 2021, 696, 'Empresa A: patrimonio {empresa=EMPRESA_A}', 'MILLION_BOB'),
    point('OWNER_EQUITY_EMPRESA_A', 2024, 835.2, 'Empresa A: patrimonio {empresa=EMPRESA_A}', 'MILLION_BOB'),
  ]);

  assert.deepEqual(board.histories[0]?.mainHoldings[0]?.estimateYears, [2021, 2024]);
});

test('el padrón nombra cada fila por su categoría, no por la medida que sigue a los dos puntos', () => {
  // Los nombres reales de la semilla: «<categoría>: participación en el padrón».
  const board = buildFabricBoard([
    point('TAXROLL_ROLL_PCT_ACT_COMERCIO', 2025, 31.2, 'Comercio: participación en el padrón', 'PERCENT'),
    point('TAXROLL_ROLL_PCT_ACT_SERVICIOS', 2025, 12.4, 'Servicios: participación en el padrón', 'PERCENT'),
    point('TAXROLL_REVENUE_PCT_ACT_COMERCIO', 2025, 22.5, 'Comercio: participación en la recaudación {unidad=porcentaje}', 'PERCENT'),
  ]);
  const labels = board.taxRoll.map((row) => row.label).sort();
  assert.deepEqual(labels, ['Comercio', 'Servicios']);
  assert.equal(new Set(labels).size, labels.length, 'dos filas con la misma etiqueta repiten la clave de React');
});

test('los cierres se nombran como tales y conservan años ausentes', () => {
  assert.equal(FIRM_MEASURES.find((measure) => measure.value === 'CANCELLED')?.label, 'Cierres');
  const board = buildFabricBoard([
    point('FIRMS_CANCELLED_TOTAL_BOLIVIA', 2021, 4398),
    point('FIRMS_CANCELLED_TOTAL_BOLIVIA', 2023, 3945),
  ]);

  assert.deepEqual(buildClosureSeries(board.firms, 'BOLIVIA'), [
    { year: 2021, count: 4398 },
    { year: 2022, count: null },
    { year: 2023, count: 3945 },
  ]);
});

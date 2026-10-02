'use client';

import { useMemo, useState } from 'react';
import { RankLines, ShareBars, WorldLines, seriesTone } from './charts';
import type { RankLine, WorldLineSeries } from './charts';
import { CompanyLogo } from './company-logo';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import { InfoPopover } from './info-popover';
import { Pager } from './pager';
import styles from './business.module.css';
import { ANY, additive, picked, toggle } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import { downloadCsv } from '@/lib/csv';
import type { CompanyMeasure, LargestBoard, LargestCompany } from '@/lib/largest-companies-board';

/**
 * Las empresas más grandes de Bolivia, año a año, con la vara que el lector
 * elija: el impuesto que pagan (Impuestos, oficial) o lo que facturan, ganan y
 * poseen («Las 500», privada).
 *
 * Todo se recorta junto: la medida, el año, el departamento, el sector, si es
 * pública o privada y el nombre. La lista lleva la marca de cada empresa, su
 * cifra como barra, cuánto se movió desde el año anterior y dónde aparece en
 * las otras listas de «Empresas»; elegir una abre su ficha con todas sus
 * series, y seguirla la pone en la trayectoria.
 */

export interface CrossLinks {
  merco?: { rank: number; year: number };
  exporter?: { rank: number; share: number };
}

const MEASURES: ReadonlyArray<{ value: CompanyMeasure; label: string; source: 'TAXTOP' | 'LARGEST'; rank: CompanyMeasure }> = [
  { value: 'taxPaid', label: 'Impuesto pagado', source: 'TAXTOP', rank: 'taxRank' },
  { value: 'revenue', label: 'Ingresos', source: 'LARGEST', rank: 'rank' },
  { value: 'profit', label: 'Utilidad', source: 'LARGEST', rank: 'rank' },
  { value: 'assets', label: 'Activos', source: 'LARGEST', rank: 'rank' },
  { value: 'equity', label: 'Patrimonio', source: 'LARGEST', rank: 'rank' },
];

const PAGE = 25;
const FOLLOWED_MAX = 6;

/** Una cifra con la unidad que el colector declaró. */
export function money(value: number, unit: string | undefined): string {
  const say = (amount: number, decimals: number): string =>
    amount.toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  switch (unit) {
    case 'MILLION_BOB':
      return `Bs ${say(value, 1)} M`;
    case 'THOUSAND_BOB':
      return `Bs ${say(value / 1000, 1)} M`;
    case 'BOB':
      return `Bs ${say(value / 1_000_000, 1)} M`;
    case 'MILLION_USD':
      return `$us ${say(value, 1)} M`;
    case 'THOUSAND_USD':
      return `$us ${say(value / 1000, 1)} M`;
    case 'USD':
      return `$us ${say(value / 1_000_000, 1)} M`;
    case 'PERCENT':
      return `${say(value, 1)} %`;
    default:
      return say(value, 0);
  }
}

const plain = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLocaleLowerCase('es');

function valueIn(company: LargestCompany, year: number, measure: CompanyMeasure): number | undefined {
  return company.years.find((row) => row.year === year)?.[measure];
}

export function LargestCompaniesExplorer({
  board,
  links,
  exportYear,
}: {
  board: LargestBoard;
  links: Record<string, CrossLinks>;
  exportYear: number | null;
}) {
  const measures = MEASURES.filter((one) => board.companies.some((company) => company.years.some((row) => row[one.value] !== undefined)));
  const [measure, setMeasure] = useState<CompanyMeasure>(measures[0]?.value ?? 'taxPaid');
  const spec = MEASURES.find((one) => one.value === measure) ?? MEASURES[0]!;
  const years = useMemo(
    () => [...new Set(board.companies.flatMap((company) => company.years.filter((row) => row[measure] !== undefined).map((row) => row.year)))].sort((a, b) => b - a),
    [board, measure],
  );
  const [chosenYear, setYear] = useState<number | null>(null);
  const year = chosenYear !== null && years.includes(chosenYear) ? chosenYear : (years[0] ?? 0);
  const [department, setDepartment] = useState<Choice>(ANY);
  const [sector, setSector] = useState<Choice>(ANY);
  const [ownership, setOwnership] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [followed, setFollowed] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const unit = board.units[measure];
  const ranked = board.companies
    .map((company) => ({ company, value: valueIn(company, year, measure), rank: valueIn(company, year, spec.rank) }))
    .filter((row): row is { company: LargestCompany; value: number; rank: number | undefined } => row.value !== undefined)
    .sort((left, right) => (left.rank ?? Infinity) - (right.rank ?? Infinity) || right.value - left.value);

  const needle = plain(query.trim());
  const passes = (company: LargestCompany, skip?: 'department' | 'sector'): boolean =>
    (!needle || plain(company.name).includes(needle)) &&
    (ownership === 'all' || company.attributes.propiedad === ownership) &&
    (skip === 'department' || department.size === 0 || department.has(company.attributes.departamento ?? '')) &&
    (skip === 'sector' || sector.size === 0 || sector.has(company.attributes.sector ?? ''));
  const rows = ranked.filter((row) => passes(row.company));
  const shown = rows.slice(offset, offset + PAGE);
  const peak = ranked[0]?.value ?? 1;
  const total = ranked.reduce((sum, row) => sum + row.value, 0);
  const topTen = ranked.slice(0, 10).reduce((sum, row) => sum + row.value, 0);

  const previousYear = years.find((one) => one < year) ?? null;
  const before = new Map(
    previousYear === null
      ? []
      : board.companies.map((company) => [company.slug, valueIn(company, previousYear, spec.rank)] as const),
  );

  const facet = (key: 'departamento' | 'sector', skip: 'department' | 'sector') => {
    const counts = new Map<string, number>();
    for (const row of ranked) {
      const value = row.company.attributes[key];
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + (passes(row.company, skip) ? 1 : 0));
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  };
  const departments = facet('departamento', 'department');
  const sectors = facet('sector', 'sector');
  const owned = [...new Set(ranked.map((row) => row.company.attributes.propiedad).filter(Boolean))] as string[];

  const trail = followed.length ? followed : ranked.slice(0, 5).map((row) => row.company.slug);
  const follow = (slug: string): void =>
    setFollowed((current) => {
      const base = current.length ? current : trail;
      return base.includes(slug) ? base.filter((one) => one !== slug) : [...base, slug].slice(-FOLLOWED_MAX);
    });
  const byslug = new Map(board.companies.map((company) => [company.slug, company]));
  const rankYears = [...years].sort((a, b) => a - b);
  const lines: RankLine[] = trail.map((slug, index) => ({
    key: slug,
    label: byslug.get(slug)?.name ?? slug,
    tone: seriesTone(index),
    ranks: new Map(
      (byslug.get(slug)?.years ?? [])
        .filter((row) => row[spec.rank] !== undefined)
        .map((row) => [row.year, row[spec.rank] as number]),
    ),
  }));
  const worst = Math.max(10, ...lines.flatMap((line) => [...line.ranks.values()]));

  const concentration: WorldLineSeries[] = [
    ...(board.coverage.length ? [{ key: 'coverage', label: 'Las 100 sobre la recaudación total', tone: seriesTone(0) }] : []),
    { key: 'top10', label: 'Las 10 primeras sobre las 100', tone: seriesTone(1) },
  ];
  const concentrationData = rankYears.map((when) => {
    const pool = board.companies
      .map((company) => valueIn(company, when, 'taxPaid'))
      .filter((value): value is number => value !== undefined)
      .sort((a, b) => b - a);
    const sum = pool.reduce((all, value) => all + value, 0);
    return {
      year: String(when),
      coverage: board.coverage.find((row) => row.year === when)?.pct ?? null,
      top10: sum ? (pool.slice(0, 10).reduce((all, value) => all + value, 0) / sum) * 100 : null,
    };
  });

  const sheet = open ? byslug.get(open) : null;
  const sheetSeries: WorldLineSeries[] = sheet
    ? MEASURES.filter((one) => sheet.years.some((row) => row[one.value] !== undefined)).map((one, index) => ({ key: one.value, label: one.label, tone: seriesTone(index) }))
    : [];

  const reset = (): void => {
    setDepartment(ANY);
    setSector(ANY);
    setOwnership('all');
    setQuery('');
    setOffset(0);
  };
  const active = (department.size ? 1 : 0) + (sector.size ? 1 : 0) + (ownership !== 'all' ? 1 : 0) + (needle ? 1 : 0);

  if (!board.companies.length) {
    return <div className="callout">Todavía no hay ránking de empresas cargado.</div>;
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>
            Principales empresas de Bolivia, {year}: {spec.label.toLowerCase()} ({spec.source === 'TAXTOP' ? 'millones de bolivianos' : unit?.includes('USD') ? 'millones de dólares' : 'millones de bolivianos'})
          </h2>
          <p className="panel-sub">
            {spec.source === 'TAXTOP'
              ? 'Servicio de Impuestos Nacionales: las cien empresas que más impuestos pagaron, con el monto y su parte de la recaudación. Mide impuesto pagado, no ventas.'
              : '«Las 500 empresas más grandes de Bolivia», de Hugo Siles Espada: ingresos, utilidad, activo y patrimonio a partir de estados publicados por reguladores, la bolsa y las propias empresas; no todos están auditados.'}{' '}
            {measures.length === 1 && spec.source === 'TAXTOP'
              ? 'La vara por ingresos y patrimonio («Las 500 empresas más grandes») no está: la única edición gratuita publica sus tablas como imagen y el observatorio no transcribe cifras a mano. '
              : null}
            <InfoPopover label="Dos varas distintas">
              <p>
                El impuesto pagado depende del régimen y de la utilidad: un banco rentable paga más que un comercio que
                factura el doble. Los ingresos dicen el tamaño de la operación. Por eso la página deja elegir la vara y
                no las mezcla en una sola lista.
              </p>
            </InfoPopover>
          </p>
        </div>
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">Primera de {year}</span>
            <span className="stat-value">{ranked[0]?.company.name ?? '—'}</span>
            <span className="stat-hint">{ranked[0] ? money(ranked[0].value, unit) : ''}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Las 10 primeras</span>
            <span className="stat-value">{total ? `${((topTen / total) * 100).toLocaleString('es-BO', { maximumFractionDigits: 1 })} %` : '—'}</span>
            <span className="stat-hint">de lo que suman las {ranked.length} de la lista</span>
          </div>
          {spec.source === 'TAXTOP' && board.coverage.find((row) => row.year === year) ? (
            <div className="stat">
              <span className="stat-label">Las 100, sobre el país</span>
              <span className="stat-value">
                {board.coverage.find((row) => row.year === year)?.pct.toLocaleString('es-BO', { maximumFractionDigits: 1 })} %
              </span>
              <span className="stat-hint">de toda la recaudación de {year}</span>
            </div>
          ) : null}
          <div className="stat">
            <span className="stat-label">Años publicados</span>
            <span className="stat-value">{years.length}</span>
            <span className="stat-hint">{rankYears[0]}–{rankYears.at(-1)}</span>
          </div>
        </div>
      </div>

      <div className="workspace">
        <aside className="rail" id="principales-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">{active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}</span>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="barras" size={13} />
              Medida
            </div>
            <div className="rail-pills">
              {measures.map((one) => (
                <button key={one.value} type="button" className={measure === one.value ? 'chip chip-on' : 'chip'} aria-pressed={measure === one.value} onClick={() => { setMeasure(one.value); setOffset(0); }}>
                  {one.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} />
              Año
            </div>
            <div className="rail-field">
              <select aria-label="Año" value={year} onChange={(event) => { setYear(Number(event.target.value)); setOffset(0); }}>
                {years.map((one) => (
                  <option key={one} value={one}>{one}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="buscar" size={13} />
              Empresa
            </div>
            <div className="rail-field">
              <input type="search" placeholder="Buscar por nombre…" aria-label="Buscar una empresa" value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} />
            </div>
          </div>
          {owned.length > 1 ? (
            <div className="rail-sec">
              <div className="rail-head">
                <Icon name="edificio" size={13} />
                Propiedad
              </div>
              <div className="rail-pills">
                {['all', ...owned].map((value) => (
                  <button key={value} type="button" className={ownership === value ? 'chip chip-on' : 'chip'} aria-pressed={ownership === value} onClick={() => { setOwnership(value); setOffset(0); }}>
                    {value === 'all' ? 'Todas' : value}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {[
            { title: 'Departamento', icon: 'mapa' as const, list: departments, choice: department, set: setDepartment },
            { title: 'Sector', icon: 'capas' as const, list: sectors, choice: sector, set: setSector },
          ].map((group) =>
            group.list.length ? (
              <div className="rail-sec" key={group.title}>
                <div className="rail-head">
                  <Icon name={group.icon} size={13} />
                  {group.title} ({year})
                  <PickedCount choice={group.choice} />
                </div>
                <FilterHint />
                <div className="rail-list rail-list-cut">
                  {group.list.map(([value, count]) => {
                    const on = picked(group.choice, value);
                    return (
                      <button key={value} type="button" className={on ? 'rail-item rail-item-on' : 'rail-item'} aria-pressed={on} onClick={(event) => { group.set((current) => toggle(current, value, additive(event))); setOffset(0); }}>
                        <span className="rail-name">{value}</span>
                        <span className="rail-n">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null,
          )}
          {active ? (
            <div className="rail-sec">
              <button type="button" className="chip" onClick={reset}>Limpiar todo</button>
            </div>
          ) : null}
        </aside>

        <div className="workspace-main">
          <div className="panel">
            <div className="panel-head panel-head-kind">
              <div>
                <h2>Ránking {year}: {spec.label.toLowerCase()} por empresa</h2>
                <p className="panel-sub">
                  {rows.length === ranked.length ? `Las ${rows.length} empresas de la lista.` : `${rows.length} de ${ranked.length} con los filtros puestos.`}{' '}
                  La barra es la cifra frente a la primera; el marcador, el puesto ganado o perdido desde {previousYear ?? 'el año anterior'}. Toca un nombre para abrir su ficha.
                </p>
              </div>
              <button
                type="button"
                className="chip"
                onClick={() =>
                  downloadCsv(
                    `principales-empresas-${measure}-${year}.csv`,
                    ['Puesto', 'Empresa', 'Departamento', 'Sector', spec.label, 'Unidad'],
                    rows.map((row) => [row.rank ?? null, row.company.name, row.company.attributes.departamento ?? '', row.company.attributes.sector ?? '', row.value, unit ?? '']),
                  )
                }
              >
                <Icon name="descarga" size={13} /> CSV
              </button>
            </div>
            {shown.length ? (
              <ol className="rep-list">
                {shown.map((row) => {
                  const prior = before.get(row.company.slug);
                  const moved = prior !== undefined && row.rank !== undefined ? prior - row.rank : null;
                  const link = links[row.company.slug];
                  const isFollowed = trail.includes(row.company.slug);
                  return (
                    <li key={row.company.slug} className={`rep-row ${styles.rankFigure}`}>
                      <span className="rep-rank">{row.rank ?? '—'}</span>
                      <CompanyLogo slug={row.company.slug} name={row.company.name} size={36} />
                      <span className="rep-who">
                        <button type="button" className="rep-name table-link" onClick={() => setOpen((current) => (current === row.company.slug ? null : row.company.slug))}>
                          {row.company.name}
                        </button>
                        <span className="rep-tags">
                          {row.company.attributes.departamento ? <span>{row.company.attributes.departamento}</span> : null}
                          {row.company.attributes.sector ? <span>{row.company.attributes.sector}</span> : null}
                          {link?.merco ? <span className={styles.badge}>Merco #{link.merco.rank}</span> : null}
                          {link?.exporter ? <span className="rep-tag-export">Exporta #{link.exporter.rank}</span> : null}
                        </span>
                      </span>
                      <span className="rep-score">
                        <span className="rep-bar">
                          <span style={{ width: `${Math.max(2, (Math.abs(row.value) / Math.abs(peak || 1)) * 100)}%` }} />
                        </span>
                        <span className="rep-score-n">{money(row.value, unit)}</span>
                      </span>
                      {moved === null ? (
                        previousYear === null ? null : <span className="rep-move rep-move-new">Nueva</span>
                      ) : moved === 0 ? (
                        <span className="rep-move rep-move-same">= igual</span>
                      ) : (
                        <span className={moved > 0 ? 'rep-move rep-move-up' : 'rep-move rep-move-down'}>
                          <span aria-hidden="true">{moved > 0 ? '▲' : '▼'}</span> {Math.abs(moved)}
                        </span>
                      )}
                      <button type="button" className={isFollowed ? 'rep-follow rep-follow-on' : 'rep-follow'} aria-pressed={isFollowed} onClick={() => follow(row.company.slug)} title={isFollowed ? `Quitar ${row.company.name} de la trayectoria` : `Seguir a ${row.company.name}`}>
                        <Icon name="linea" size={14} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="callout">
                Ninguna empresa de {year} pasa estos filtros.{' '}
                <button type="button" className="chip" onClick={reset}>Limpiar filtros</button>
              </div>
            )}
            <Pager page={Math.floor(offset / PAGE) + 1} pages={Math.max(1, Math.ceil(rows.length / PAGE))} first={rows.length ? offset + 1 : 0} last={Math.min(offset + PAGE, rows.length)} total={rows.length} pageSize={PAGE} onGo={setOffset} where="ránking de empresas" noun="empresas" />

            {sheet ? (
              <div className={styles.sheet}>
                <h3 className={styles.subhead}>
                  <CompanyLogo slug={sheet.slug} name={sheet.name} size={22} /> {sheet.name}: todas sus cifras publicadas
                </h3>
                <div className={styles.figures}>
                  {MEASURES.map((one) => {
                    const lastRow = [...sheet.years].reverse().find((row) => row[one.value] !== undefined);
                    return lastRow ? (
                      <div className={styles.figure} key={one.value}>
                        <span>{one.label} ({lastRow.year})</span>
                        <b>{money(lastRow[one.value] as number, board.units[one.value])}</b>
                        <span>{one.source === 'TAXTOP' ? `Puesto ${lastRow.taxRank ?? '—'} · Impuestos` : `Puesto ${lastRow.rank ?? '—'} · Las 500`}</span>
                      </div>
                    ) : null;
                  })}
                  {links[sheet.slug]?.merco ? (
                    <div className={styles.figure}>
                      <span>Reputación Merco {links[sheet.slug]?.merco?.year}</span>
                      <b>#{links[sheet.slug]?.merco?.rank}</b>
                      <span>en «Reputación empresarial»</span>
                    </div>
                  ) : null}
                  {links[sheet.slug]?.exporter ? (
                    <div className={styles.figure}>
                      <span>Exportadora {exportYear ?? ''}</span>
                      <b>#{links[sheet.slug]?.exporter?.rank}</b>
                      <span>{links[sheet.slug]?.exporter?.share.toLocaleString('es-BO', { maximumFractionDigits: 1 })} % de las exportaciones</span>
                    </div>
                  ) : null}
                </div>
                {sheetSeries.length ? (
                  <WorldLines
                    data={sheet.years.map((row) => {
                      const out: { year: string; [key: string]: string | number | null } = { year: String(row.year) };
                      for (const series of sheetSeries) out[series.key] = (row[series.key as CompanyMeasure] as number | undefined) ?? null;
                      return out;
                    })}
                    series={sheetSeries.filter((series) => board.units[series.key as CompanyMeasure] === board.units[sheetSeries[0]?.key as CompanyMeasure])}
                    format={(value) => money(value, board.units[sheetSeries[0]?.key as CompanyMeasure])}
                    tick={(value) => value.toLocaleString('es-BO', { maximumFractionDigits: 0 })}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Trayectoria en el ránking ({spec.source === 'TAXTOP' ? 'Impuestos' : 'Las 500'}), {rankYears[0]}–{rankYears.at(-1)} (puesto, 1 = primera)</h2>
              <p className="panel-sub">
                {followed.length ? 'Las empresas que elegiste.' : `Las cinco primeras de ${year}; elige otras con el botón de cada fila.`} Un hueco es un año en que la empresa no entró en la lista.
              </p>
            </div>
            <RankLines years={rankYears} lines={lines} floor={[10, 25, 50, 100, 250, 500].find((step) => worst <= step) ?? 500} />
          </div>

          {spec.source === 'TAXTOP' ? (
            <div className="grid-two">
              <div className="panel">
                <div className="panel-head">
                  <h2>Concentración del impuesto, {rankYears[0]}–{rankYears.at(-1)} (%)</h2>
                  <p className="panel-sub">Qué parte de la recaudación pagan las cien y qué parte de lo de las cien pagan las diez primeras.</p>
                </div>
                <WorldLines data={concentrationData} series={concentration} format={(value) => `${value.toLocaleString('es-BO', { maximumFractionDigits: 1 })} %`} tick={(value) => `${value} %`} countsOnly />
              </div>
              <div className="panel">
                <div className="panel-head">
                  <h2>Impuesto pagado por departamento, {year} (millones de bolivianos)</h2>
                  <p className="panel-sub">Suma de las empresas de la lista según la gerencia donde tributan. Toca una barra para filtrar.</p>
                </div>
                <ShareBars
                  data={[...ranked.reduce((all, row) => {
                    const key = row.company.attributes.departamento ?? 'Sin dato';
                    all.set(key, (all.get(key) ?? 0) + row.value);
                    return all;
                  }, new Map<string, number>())].map(([name, value]) => ({ name, value, pick: name, emphasis: department.has(name) })).sort((a, b) => b.value - a.value)}
                  unit=" M Bs"
                  decimals={1}
                  height={260}
                  onPick={(value, add) => setDepartment((current) => toggle(current, value, add))}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

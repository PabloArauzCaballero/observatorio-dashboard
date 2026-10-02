'use client';

import { useMemo, useState } from 'react';
import { WorldLines, seriesTone } from './charts';
import type { WorldLineSeries } from './charts';
import { CompanyLogo } from './company-logo';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import { InfoPopover } from './info-popover';
import styles from './business.module.css';
import { ANY, additive, picked, toggle } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import { downloadCsv } from '@/lib/csv';
import type { OwnerEstimate, OwnersBoard } from '@/lib/business-owners-board';

/**
 * Los principales empresarios de Bolivia y sus fortunas, año a año.
 *
 * Dos clases de cifra, siempre rotuladas y nunca mezcladas sin decirlo:
 *
 * - **Forbes**, donde Forbes publica a la persona. Son dos, nacidos en Bolivia
 *   y con otra ciudadanía.
 * - **Estimación del observatorio** para el resto: la participación que los
 *   documentos públicos atribuyen a cada accionista por el patrimonio de cada
 *   empresa, y una referencia de mercado con el múltiplo de su industria. Es
 *   una cota inferior y la ficha de cada persona la abre empresa por empresa,
 *   con el documento que sostiene cada tramo.
 *
 * Abajo va lo que se sabe de la riqueza del país sin nombres: cuántos pagan el
 * impuesto a las grandes fortunas y cuánto, y los millonarios que cuenta UBS.
 */

type Basis = 'book' | 'market';

const usd = (value: number): string =>
  `$us ${value.toLocaleString('es-BO', { minimumFractionDigits: value < 10 ? 1 : 0, maximumFractionDigits: value < 10 ? 1 : 0 })} M`;
const pct = (value: number): string => `${value.toLocaleString('es-BO', { maximumFractionDigits: 2 })} %`;
const UNIT_LABEL: Record<string, string> = {
  COUNT: 'cantidad',
  USD: 'dólares',
  MILLION_USD: 'millones de dólares',
  BILLION_USD: 'miles de millones de dólares',
  THOUSAND_PERSONS: 'miles de personas',
  PERCENT: '%',
  RATIO: 'razón',
};
const plain = (value: string): string => value.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLocaleLowerCase('es');

interface Row {
  key: string;
  name: string;
  kind: 'estimate' | 'forbes';
  value: number;
  low: number | null;
  high: number | null;
  estimate: OwnerEstimate | null;
  note: string;
}

export function BusinessOwnersExplorer({ board }: { board: OwnersBoard }) {
  const years = useMemo(
    () => [...new Set([...board.estimates.map((one) => one.year), ...board.forbes.flatMap((one) => one.points.map((point) => point.year))])].sort((a, b) => b - a),
    [board],
  );
  const [chosenYear, setYear] = useState<number | null>(null);
  const year = chosenYear ?? years.find((one) => board.estimates.some((row) => row.year === one)) ?? years[0] ?? 0;
  const [basis, setBasis] = useState<Basis>('book');
  const [withForbes, setWithForbes] = useState(true);
  const [sector, setSector] = useState<Choice>(ANY);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const needle = plain(query.trim());
  const estimates = board.estimates.filter((one) => one.year === year);
  const inSector = (estimate: OwnerEstimate | null): boolean =>
    sector.size === 0 || Boolean(estimate?.holdings.some((holding) => sector.has(holding.sector ?? '')));
  const rows: Row[] = [
    ...estimates.map((one) => ({
      key: one.person,
      name: one.name,
      kind: 'estimate' as const,
      value: basis === 'market' && one.market !== null ? one.market : one.book,
      low: one.book,
      high: one.market,
      estimate: one,
      note: `${one.holdings.length} empresa${one.holdings.length === 1 ? '' : 's'} · ${one.holdings[0]?.name ?? ''}`,
    })),
    ...(withForbes
      ? board.forbes
          .map((one) => ({ one, point: one.points.find((point) => point.year === year) }))
          .filter((row): row is { one: OwnersBoard['forbes'][number]; point: { year: number; value: number } } => Boolean(row.point))
          .map(({ one, point }) => ({
            key: `forbes:${one.slug}`,
            name: one.name,
            kind: 'forbes' as const,
            value: point.value,
            low: null,
            high: null,
            estimate: null,
            note: [one.attributes.fuente_riqueza, one.attributes.ciudadania ? `ciudadanía: ${one.attributes.ciudadania}` : ''].filter(Boolean).join(' · '),
          }))
      : []),
  ]
    .filter((row) => (!needle || plain(row.name).includes(needle)) && (row.kind === 'forbes' ? sector.size === 0 : inSector(row.estimate)))
    .sort((left, right) => right.value - left.value);
  const peak = rows[0]?.value ?? 1;

  const sectorCounts = new Map<string, number>();
  for (const one of estimates) {
    for (const holding of new Set(one.holdings.map((h) => h.sector).filter(Boolean))) {
      sectorCounts.set(holding as string, (sectorCounts.get(holding as string) ?? 0) + 1);
    }
  }

  const sheet = open ? board.estimates.filter((one) => one.person === open) : [];
  const current = sheet.find((one) => one.year === year) ?? sheet.at(-1) ?? null;
  const personSeries: WorldLineSeries[] = [
    { key: 'book', label: 'Piso contable', tone: seriesTone(0) },
    { key: 'market', label: 'Referencia de mercado', tone: seriesTone(1), dashed: true },
  ];

  const forbesSeries: WorldLineSeries[] = board.forbes.map((one, index) => ({ key: one.slug, label: one.name, tone: seriesTone(index) }));
  const forbesYears = [...new Set(board.forbes.flatMap((one) => one.points.map((point) => point.year)))].sort((a, b) => a - b);
  const latestTax = board.wealthTax.at(-1);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Empresarios de Bolivia: fortuna estimada por sus participaciones en empresas, {year} (millones de dólares)</h2>
          <p className="panel-sub">
            <span className={`${styles.badge} ${styles.estimate}`}>Estimación del Observatorio</span> cota inferior: participación
            documentada × patrimonio de la empresa. No incluye inmuebles, cuentas, empresas fuera de la lista ni activos fuera
            de Bolivia. <span className={styles.badge}>Forbes</span> cifra publicada por Forbes, sólo para quien Forbes nombra.{' '}
            <InfoPopover label="Cómo se calcula">
              <p>
                1) Participación efectiva de cada persona en cada empresa, directa o a través de sociedades, según el documento
                público más reciente hasta ese año (memorias de bancos, prospectos y registros de la bolsa). 2) Piso contable:
                participación × patrimonio del balance auditado que publica la propia empresa. 3) Referencia de mercado: el piso por la razón precio/valor en
                libros de su industria en mercados emergentes (Damodaran) ese año. 4) Bolivianos a dólares a 6,96.
              </p>
            </InfoPopover>
          </p>
        </div>
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">Personas con estimación</span>
            <span className="stat-value">{board.coverage.people}</span>
            <span className="stat-hint">accionistas con 10 % o más en un documento público</span>
          </div>
          <div className="stat">
            <span className="stat-label">Empresas con dueños documentados</span>
            <span className="stat-value">{board.coverage.withOwners}</span>
            <span className="stat-hint">de {board.coverage.withEquity} con patrimonio publicado</span>
          </div>
          {latestTax ? (
            <div className="stat">
              <span className="stat-label">Impuesto a las grandes fortunas, {latestTax.year}</span>
              <span className="stat-value">{latestTax.payers?.toLocaleString('es-BO') ?? '—'}</span>
              <span className="stat-hint">contribuyentes con patrimonio sobre Bs 30 millones</span>
            </div>
          ) : null}
          <div className="stat">
            <span className="stat-label">En Forbes</span>
            <span className="stat-value">{board.forbes.length}</span>
            <span className="stat-hint">nacidos en Bolivia, con otra ciudadanía</span>
          </div>
        </div>
      </div>

      <div className="workspace">
        <aside className="rail" id="empresarios-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} />
              Año
            </div>
            <div className="rail-field">
              <select aria-label="Año" value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {years.map((one) => (
                  <option key={one} value={one}>{one}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="monedas" size={13} />
              Vara de la estimación
            </div>
            <div className="rail-pills">
              {(['book', 'market'] as const).map((value) => (
                <button key={value} type="button" className={basis === value ? 'chip chip-on chip-wide' : 'chip chip-wide'} aria-pressed={basis === value} onClick={() => setBasis(value)}>
                  {value === 'book' ? 'Piso contable' : 'Referencia de mercado'}
                </button>
              ))}
            </div>
          </div>
          <div className="rail-sec">
            <label className="rep-toggle">
              <input type="checkbox" checked={withForbes} onChange={(event) => setWithForbes(event.target.checked)} />
              <span>Incluir las cifras de Forbes</span>
            </label>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="buscar" size={13} />
              Persona
            </div>
            <div className="rail-field">
              <input type="search" placeholder="Buscar por nombre…" aria-label="Buscar una persona" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>
          {sectorCounts.size ? (
            <div className="rail-sec">
              <div className="rail-head">
                <Icon name="capas" size={13} />
                Sector de sus empresas
                <PickedCount choice={sector} />
              </div>
              <FilterHint />
              <div className="rail-list rail-list-cut">
                {[...sectorCounts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => {
                  const on = picked(sector, value);
                  return (
                    <button key={value} type="button" className={on ? 'rail-item rail-item-on' : 'rail-item'} aria-pressed={on} onClick={(event) => setSector((choice) => toggle(choice, value, additive(event)))}>
                      <span className="rail-name">{value}</span>
                      <span className="rail-n">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </aside>

        <div className="workspace-main">
          <div className="panel">
            <div className="panel-head panel-head-kind">
              <div>
                <h2>Ránking {year}: fortuna {basis === 'book' ? 'en libros' : 'a valor de mercado de referencia'} (millones de dólares)</h2>
                <p className="panel-sub">La barra fina marca el rango entre el piso contable y la referencia de mercado. Toca un nombre para abrir su composición.</p>
              </div>
              <button
                type="button"
                className="chip"
                onClick={() =>
                  downloadCsv(
                    `empresarios-${year}.csv`,
                    ['Puesto', 'Persona', 'Cifra', 'Piso contable (M USD)', 'Referencia de mercado (M USD)', 'Valor mostrado (M USD)'],
                    rows.map((row, index) => [index + 1, row.name, row.kind === 'forbes' ? 'Forbes' : 'Estimación del Observatorio', row.low, row.high, row.value]),
                  )
                }
              >
                <Icon name="descarga" size={13} /> CSV
              </button>
            </div>
            {rows.length ? (
              <ol className="rep-list">
                {rows.map((row, index) => (
                  <li key={row.key} className={`rep-row ${styles.rankRow}`}>
                    <span className="rep-rank">{index + 1}</span>
                    <span className="rep-who">
                      {row.estimate ? (
                        <button type="button" className="rep-name table-link" onClick={() => setOpen((current) => (current === row.key ? null : row.key))}>
                          {row.name}
                        </button>
                      ) : (
                        <span className="rep-name">{row.name}</span>
                      )}
                      <span className="rep-tags">
                        <span className={row.kind === 'forbes' ? styles.badge : `${styles.badge} ${styles.estimate}`}>
                          {row.kind === 'forbes' ? 'Forbes' : 'Estimación'}
                        </span>
                        <span>{row.note}</span>
                      </span>
                    </span>
                    <span className="rep-score">
                      <span className="rep-bar">
                        <span style={{ width: `${Math.max(2, (row.value / peak) * 100)}%` }} />
                      </span>
                      <span className="rep-score-n">
                        {usd(row.value)}
                        {row.low !== null && row.high !== null ? <small> ({usd(row.low)}–{usd(row.high)})</small> : null}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="callout">No hay fortunas publicadas ni estimadas para {year} con estos filtros.</div>
            )}

            {current ? (
              <div className={styles.sheet}>
                <h3 className={styles.subhead}>
                  {current.name}: composición de la estimación, {current.year}
                </h3>
                <div className="table-wrap">
                  <table className="grid-table">
                    <thead>
                      <tr>
                        <th>Empresa</th>
                        <th>Sector</th>
                        <th className="num">Participación</th>
                        <th className="num">Documento</th>
                        <th className="num">Patrimonio</th>
                        <th className="num">Piso contable</th>
                        <th className="num">P/VL</th>
                        <th className="num">Mercado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.holdings.map((holding) => (
                        <tr key={holding.company}>
                          <td>
                            <CompanyLogo slug={holding.company} name={holding.name} size={18} /> {holding.name}
                            {holding.via ? <small> · vía {holding.via}</small> : null}
                          </td>
                          <td>{holding.sector ?? '—'}</td>
                          <td className="num">{pct(holding.stake)}</td>
                          <td className="num">{holding.documentYear}</td>
                          <td className="num">{usd(holding.equity)}</td>
                          <td className="num">{usd(holding.book)}</td>
                          <td className="num" title={holding.industry ?? ''}>{holding.multiple === null ? '—' : holding.multiple.toLocaleString('es-BO', { maximumFractionDigits: 2 })}</td>
                          <td className="num">{holding.market === null ? '—' : usd(holding.market)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sheet.length > 1 ? (
                  <WorldLines
                    data={sheet.map((one) => ({ year: String(one.year), book: one.book, market: one.market }))}
                    series={personSeries}
                    format={usd}
                    tick={(value) => value.toLocaleString('es-BO', { maximumFractionDigits: 0 })}
                    countsOnly
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          {forbesSeries.length ? (
            <div className="panel">
              <div className="panel-head">
                <h2>Nacidos en Bolivia en la lista de Forbes, {forbesYears[0]}–{forbesYears.at(-1)} (patrimonio, millones de dólares)</h2>
                <p className="panel-sub">Forbes World’s Billionaires. Ninguna persona con ciudadanía boliviana figura en la lista en ningún año.</p>
              </div>
              <WorldLines
                data={forbesYears.map((when) => {
                  const row: { year: string; [key: string]: string | number | null } = { year: String(when) };
                  for (const one of board.forbes) row[one.slug] = one.points.find((point) => point.year === when)?.value ?? null;
                  return row;
                })}
                series={forbesSeries}
                format={usd}
                tick={(value) => value.toLocaleString('es-BO', { maximumFractionDigits: 0 })}
                countsOnly
              />
            </div>
          ) : null}

          {board.wealthTax.length ? (
            <div className="grid-two">
              <div className="panel">
                <div className="panel-head">
                  <h2>Impuesto a las Grandes Fortunas: contribuyentes por año (cantidad)</h2>
                  <p className="panel-sub">Personas con patrimonio neto sobre Bs 30 millones que lo declararon y pagaron (Impuestos Nacionales).</p>
                </div>
                <WorldLines
                  data={board.wealthTax.map((row) => ({ year: String(row.year), payers: row.payers }))}
                  series={[{ key: 'payers', label: 'Contribuyentes', tone: seriesTone(0) }]}
                  format={(value) => `${value.toLocaleString('es-BO')} personas`}
                  tick={(value) => value.toLocaleString('es-BO')}
                  countsOnly
                />
              </div>
              <div className="panel">
                <div className="panel-head">
                  <h2>Impuesto a las Grandes Fortunas: recaudación por año ({board.wealthTax.find((row) => row.unit)?.unit === 'MILLION_BOB' ? 'millones de bolivianos' : 'bolivianos'})</h2>
                  <p className="panel-sub">Lo que el impuesto recaudó cada gestión; el año en curso puede ser parcial.</p>
                </div>
                <WorldLines
                  data={board.wealthTax.map((row) => ({ year: String(row.year), collected: row.collected }))}
                  series={[{ key: 'collected', label: 'Recaudación', tone: seriesTone(1) }]}
                  format={(value) => value.toLocaleString('es-BO', { maximumFractionDigits: 1 })}
                  tick={(value) => value.toLocaleString('es-BO', { notation: 'compact' })}
                  countsOnly
                />
              </div>
            </div>
          ) : null}

          {board.benchmarks.filter((one) => !one.code.startsWith('WEALTH_PBV_')).map((one, index) => (
            <div className="panel" key={one.code}>
              <div className="panel-head">
                <h2>
                  {one.label}, {one.points[0]?.year}–{one.points.at(-1)?.year} ({UNIT_LABEL[one.unit] ?? one.unit})
                </h2>
                <p className="panel-sub">{board.sources[one.code.split('_').slice(0, 2).join('_')]?.publisher ?? ''}</p>
              </div>
              <WorldLines
                data={one.points.map((point) => ({ year: String(point.year), value: point.value }))}
                series={[{ key: 'value', label: one.label, tone: seriesTone(index) }]}
                format={(value) => value.toLocaleString('es-BO', { maximumFractionDigits: 1 })}
                tick={(value) => value.toLocaleString('es-BO', { notation: 'compact' })}
                countsOnly
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
